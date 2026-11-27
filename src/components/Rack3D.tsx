import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Edges, Environment, Grid, Lightformer, OrbitControls, RoundedBox } from '@react-three/drei';
import { Bloom, EffectComposer, SMAA, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, useState, Fragment, type ComponentRef, type DragEvent } from 'react';
import { ACESFilmicToneMapping, CanvasTexture, Plane, Raycaster, RepeatWrapping, Vector2, Vector3, type Camera, type Group, type Mesh, type MeshBasicMaterial } from 'three';
import type { HardwareTemplate, OverlayMode, PlacedDevice, RackConfig, SimulationResult } from '../types';
import { LabelSprite } from './SceneLabel';
import { Airflow3DOverlay } from './Airflow3D';

const MM_SCALE = 1 / 250;
const U = 44.45 * MM_SCALE;

function perforationTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#aab6c5';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#26364a';
  for (let y = 8; y < 64; y += 16) {
    for (let x = 8; x < 64; x += 16) {
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(4, 10);
  texture.colorSpace = 'srgb';
  return texture;
}

function tempColor(temp: number) {
  if (temp >= 40) return '#d46565';
  if (temp >= 34) return '#cf8b52';
  if (temp >= 29) return '#d6a34c';
  if (temp >= 25) return '#6f9f7f';
  return '#6f93b8';
}

function chassisColor(hardware: HardwareTemplate, overlay: OverlayMode, telemetry: SimulationResult['telemetry'][number] | undefined) {
  if (overlay === 'airflow') {
    if (hardware.airflow === 'back-to-front') return '#cf8b52';
    if (hardware.airflow === 'side-to-side') return '#6f9f7f';
    if (hardware.airflow === 'passive') return '#526174';
    return '#6f93b8';
  }
  if (overlay === 'thermal') return tempColor(telemetry?.localTempC ?? 22);
  if (overlay === 'power') {
    const watts = telemetry?.typicalW ?? hardware.typicalW;
    return watts >= 1500 ? '#d46565' : watts >= 700 ? '#d6a34c' : watts > 0 ? '#6f93b8' : '#526174';
  }
  if (overlay === 'weight') {
    const kg = telemetry?.weightKg ?? hardware.weightKg;
    return kg >= 45 ? '#d46565' : kg >= 25 ? '#d6a34c' : kg > 0 ? '#6f93b8' : '#526174';
  }
  return hardware.color;
}

function FanRotor({ position, radius, active, animationEnabled }: { position: [number, number, number]; radius: number; active: boolean; animationEnabled: boolean }) {
  const rotor = useRef<Group>(null);
  useFrame((_, delta) => {
    if (rotor.current && active && animationEnabled) rotor.current.rotation.z -= delta * 5.5;
  });
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[radius, radius * 0.09, 8, 24]} />
        <meshStandardMaterial color="#3c4d61" metalness={0.75} roughness={0.3} />
      </mesh>
      <group ref={rotor}>
        {Array.from({ length: 5 }, (_, index) => (
          <mesh key={index} position={[0, radius * 0.43, 0]} rotation={[0, 0, (index / 5) * Math.PI * 2]}>
            <boxGeometry args={[radius * 0.2, radius * 0.68, 0.012]} />
            <meshStandardMaterial color="#182433" metalness={0.45} roughness={0.4} />
          </mesh>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius * 0.18, radius * 0.18, 0.025, 16]} />
          <meshStandardMaterial color="#52667d" metalness={0.8} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

function HotspotHalo({ width, height, depth, critical, animationEnabled }: { width: number; height: number; depth: number; critical: boolean; animationEnabled: boolean }) {
  const halo = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!halo.current) return;
    const pulse = animationEnabled ? 1 + Math.sin(clock.elapsedTime * 2.8) * 0.025 : 1;
    halo.current.scale.set(pulse, pulse, pulse);
    const material = halo.current.material as MeshBasicMaterial;
    material.opacity = animationEnabled ? 0.22 + Math.sin(clock.elapsedTime * 2.8) * 0.1 : 0.24;
  });
  return (
    <mesh ref={halo}>
      <boxGeometry args={[width * 1.035, height * 1.16, depth * 1.035]} />
      <meshBasicMaterial color={critical ? '#d46565' : '#d6a34c'} wireframe transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

function Chassis({
  device, hardware, rack, selected, overlay, telemetry, animationEnabled, onSelect,
}: {
  device: PlacedDevice;
  hardware: HardwareTemplate;
  rack: RackConfig;
  selected: boolean;
  overlay: OverlayMode;
  telemetry: SimulationResult['telemetry'][number] | undefined;
  animationEnabled: boolean;
  onSelect: (id: string) => void;
}) {
  const rackWidth = rack.widthMm * MM_SCALE;
  const innerWidth = Math.max(0.5, rackWidth - 0.16);
  const width = Math.min(hardware.widthMm * MM_SCALE, innerWidth);
  const depth = hardware.depthMm * MM_SCALE;
  const height = Math.max(0.045, hardware.uHeight * U - 0.004);
  const y = (device.startU + hardware.uHeight / 2) * U;
  const rackDepth = rack.depthMm * MM_SCALE;
  const z = device.mount === 'rear'
    ? -rackDepth / 2 + depth / 2 + 0.12
    : rackDepth / 2 - depth / 2 - 0.12;
  const rotationY = (device.mount === 'rear' ? Math.PI : 0) + (device.flipped ? Math.PI : 0);
  const color = chassisColor(hardware, overlay, telemetry);
  const isBlank = hardware.category === 'thermal' && hardware.typicalW === 0;
  const isReserved = device.status === 'reserved';
  const hotspot = telemetry?.severity === 'critical';

  return (
    <group
      position={[0, y, z]}
      rotation={[0, rotationY, 0]}
      onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(device.instanceId); }}
      onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = 'default'; }}
    >
      <RoundedBox args={[width, height, depth]} radius={0.025} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial
          color={color}
          metalness={0.65}
          roughness={0.34}
          transparent={isReserved || isBlank || overlay !== 'normal'}
          opacity={isReserved ? 0.2 : isBlank ? 0.18 : overlay === 'normal' ? 0.92 : 0.55}
          emissive={hotspot ? '#ff334f' : color}
          emissiveIntensity={hotspot ? 0.32 : selected ? 0.12 : 0.015}
        />
        {selected && <Edges scale={1.015} threshold={15} color="#ffffff" />}
      </RoundedBox>
      {!isBlank && (
        <>
          <mesh position={[0, 0, depth / 2 + 0.008]}>
            <planeGeometry args={[width * 0.9, height * 0.72]} />
            <meshStandardMaterial color="#111a25" metalness={0.5} roughness={0.45} transparent opacity={isReserved ? 0.15 : 0.95} />
          </mesh>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh position={[side * (width / 2 + 0.025), 0, depth / 2 - 0.035]} castShadow>
                <boxGeometry args={[0.05, height * 0.82, 0.05]} />
                <meshStandardMaterial color="#3c4d61" metalness={0.85} roughness={0.26} />
              </mesh>
              <mesh position={[side * width * 0.415, 0, depth / 2 + 0.035]}>
                <boxGeometry args={[0.022, height * 0.62, 0.045]} />
                <meshStandardMaterial color="#0a111b" metalness={0.55} roughness={0.35} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, height * 0.41, depth / 2 + 0.022]}>
            <boxGeometry args={[width * 0.82, 0.012, 0.014]} />
            <meshBasicMaterial color={color} transparent opacity={0.75} />
          </mesh>
          {Array.from({ length: hardware.uHeight > 2 ? 4 : 2 }, (_, row) =>
            Array.from({ length: hardware.uHeight > 2 ? 5 : 7 }, (_, bay) => (
              <mesh key={`${row}-${bay}`} position={[-width * 0.34 + bay * (width * 0.105), height * 0.27 - row * height * 0.22, depth / 2 + 0.015]}>
                <boxGeometry args={[width * 0.075, height * 0.12, 0.018]} />
                <meshStandardMaterial color="#04070b" metalness={0.3} roughness={0.6} />
              </mesh>
            )),
          )}
          {[0, 1, 2].map((led) => (
            <mesh key={led} position={[width * 0.34, height * 0.25 - led * height * 0.16, depth / 2 + 0.022]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color={led === 0 ? '#6f9f7f' : led === 1 ? '#d6a34c' : '#243448'} />
            </mesh>
          ))}
          <mesh position={[-width * 0.35, -height * 0.36, depth / 2 + 0.015]}>
            <boxGeometry args={[0.15, 0.035, 0.02]} />
            <meshBasicMaterial color="#05090e" />
          </mesh>
          {hardware.category === 'thermal' && hardware.typicalW > 0 && [-0.24, 0, 0.24].map((offset) => (
            <FanRotor key={offset} position={[offset * width, 0, depth / 2 + 0.035]} radius={Math.min(height * 0.28, 0.07)} active={!isReserved} animationEnabled={animationEnabled} />
          ))}
        </>
      )}
      {(telemetry?.severity === 'critical' || telemetry?.severity === 'warning') && (
        <HotspotHalo width={width} height={height} depth={depth} critical={telemetry.severity === 'critical'} animationEnabled={animationEnabled} />
      )}
      {selected && (
        <LabelSprite text={device.overrides?.label ?? hardware.name} position={[0, height / 2 + 0.13, depth / 2]} width={2.1} />
      )}
    </group>
  );
}

function VerticalPdu({ device, hardware, rack, selected, onSelect }: { device: PlacedDevice; hardware: HardwareTemplate; rack: RackConfig; selected: boolean; onSelect: (id: string) => void }) {
  const rackHeight = rack.heightU * U;
  const rackWidth = rack.widthMm * MM_SCALE;
  const pduHeight = rackHeight * 0.86;
  const x = (device.side === 'left' ? -1 : 1) * (rackWidth / 2 - 0.075);
  return (
    <group position={[x, rackHeight / 2, 0]} onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(device.instanceId); }}>
      <RoundedBox args={[0.12, pduHeight, 0.32]} radius={0.025} smoothness={2} castShadow>
        <meshStandardMaterial color={hardware.color} metalness={0.55} roughness={0.38} emissive={selected ? '#ffffff' : '#000000'} emissiveIntensity={selected ? 0.15 : 0} />
        {selected && <Edges color="#fff" />}
      </RoundedBox>
      {Array.from({ length: Math.max(1, Math.floor((pduHeight - 0.2) / 0.15)) }, (_, index) => (
        <mesh key={index} position={[device.side === 'left' ? -0.066 : 0.066, -pduHeight / 2 + 0.1 + index * 0.15, 0]}>
          <boxGeometry args={[0.01, 0.055, 0.14]} />
          <meshStandardMaterial color="#05080d" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function RackUnitGrid({ rack, width, depth }: { rack: RackConfig; width: number; depth: number }) {
  const innerWidth = Math.max(0.5, width - 0.16);
  return (
    <group>
      {Array.from({ length: Math.max(0, rack.heightU - 1) }, (_, index) => {
        const y = (index + 1) * U;
        return (
          <group key={index}>
            <mesh position={[0, y, depth / 2 - 0.008]}><boxGeometry args={[innerWidth, 0.003, 0.006]} /><meshBasicMaterial color="#89939c" transparent opacity={0.38} /></mesh>
            <mesh position={[0, y, -depth / 2 + 0.008]}><boxGeometry args={[innerWidth, 0.003, 0.006]} /><meshBasicMaterial color="#89939c" transparent opacity={0.38} /></mesh>
          </group>
        );
      })}
    </group>
  );
}

function RackFrame({ rack, cutaway, xray, thermal }: { rack: RackConfig; cutaway: boolean; xray: boolean; thermal: boolean }) {
  const width = rack.widthMm * MM_SCALE;
  const depth = rack.depthMm * MM_SCALE;
  const height = rack.heightU * U;
  const rail = 0.08;
  const panelThickness = 0.06;
  const doorThickness = 0.06;
  const frontZ = depth / 2 + rail;
  const rearZ = -depth / 2 - rail;
  const outerWidth = width + rail * 2;
  const outerDepth = depth + rail * 2;
  const frameColor = '#a7adb3';
  const panelColor = '#8d969d';
  const texture = useMemo(perforationTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const panelOpacity = xray ? 0.1 : 0.82;
  const doorOpacity = xray ? 0.08 : 0.48;
  const enclosed = rack.form === 'enclosed';
  const rearPosts = rack.form !== 'open-2post';

  return (
    <group>
      <RackUnitGrid rack={rack} width={width} depth={depth} />
      <RoundedBox args={[outerWidth + 0.12, 0.1, outerDepth + 0.12]} radius={0.04} smoothness={3} position={[0, -0.22, 0]} receiveShadow>
        <meshStandardMaterial color="#2b3239" metalness={0.45} roughness={0.5} />
      </RoundedBox>

      {[-1, 1].map((side) => (
        <mesh key={`front-${side}`} position={[side * (width / 2 + rail / 2), height / 2, depth / 2 + rail / 2]} castShadow>
          <boxGeometry args={[rail, height + rail * 2, rail]} />
          <meshStandardMaterial color={frameColor} metalness={0.72} roughness={0.34} />
        </mesh>
      ))}
      {rearPosts && [-1, 1].map((side) => (
        <mesh key={`rear-${side}`} position={[side * (width / 2 + rail / 2), height / 2, -depth / 2 - rail / 2]} castShadow>
          <boxGeometry args={[rail, height + rail * 2, rail]} />
          <meshStandardMaterial color={frameColor} metalness={0.72} roughness={0.34} />
        </mesh>
      ))}

      {[{ key: 'bottom', y: -rail / 2 }, { key: 'top', y: height + rail / 2 }].map((beam) => (
        <group key={beam.key}>
          <mesh position={[0, beam.y, depth / 2 + rail / 2]} castShadow><boxGeometry args={[outerWidth, rail, rail]} /><meshStandardMaterial color={frameColor} metalness={0.72} roughness={0.34} /></mesh>
          {rearPosts && <mesh position={[0, beam.y, -depth / 2 - rail / 2]} castShadow><boxGeometry args={[outerWidth, rail, rail]} /><meshStandardMaterial color={frameColor} metalness={0.72} roughness={0.34} /></mesh>}
          {rearPosts && <mesh position={[0, beam.y, 0]}><boxGeometry args={[outerWidth, rail * 0.65, outerDepth - rail * 2]} /><meshStandardMaterial color={frameColor} metalness={0.72} roughness={0.34} /></mesh>}
        </group>
      ))}

      {enclosed && (
        <>
          <mesh position={[0, height / 2, rearZ]}><boxGeometry args={[width, height, panelThickness]} /><meshStandardMaterial color={panelColor} transparent opacity={panelOpacity} metalness={0.55} roughness={0.42} depthWrite={!xray} /></mesh>
          <mesh position={[-width / 2 - rail - panelThickness / 2, height / 2, 0]}><boxGeometry args={[panelThickness, height, depth]} /><meshStandardMaterial color={panelColor} transparent opacity={panelOpacity} metalness={0.55} roughness={0.42} depthWrite={!xray} /></mesh>
          {rack.sidePanels && !cutaway && <mesh position={[width / 2 + rail + panelThickness / 2, height / 2, 0]}><boxGeometry args={[panelThickness, height, depth]} /><meshStandardMaterial color={panelColor} transparent opacity={panelOpacity} metalness={0.55} roughness={0.42} depthWrite={!xray} /></mesh>}
          <mesh position={[0, height + rail + panelThickness / 2, 0]}><boxGeometry args={[width, panelThickness, depth]} /><meshStandardMaterial color={panelColor} transparent opacity={panelOpacity} metalness={0.55} roughness={0.42} depthWrite={!xray} /></mesh>
          {!cutaway && (
            <mesh position={[0, height / 2, frontZ + doorThickness / 2 + rail / 2]}>
              <boxGeometry args={[outerWidth, height + rail, doorThickness]} />
              <meshStandardMaterial color={rack.perforatedDoors ? '#b7bec4' : panelColor} map={rack.perforatedDoors ? texture : undefined} transparent opacity={doorOpacity} metalness={0.55} roughness={0.4} depthWrite={!xray} />
            </mesh>
          )}
          {!cutaway && !xray && <mesh position={[width / 2 - 0.035, height / 2, frontZ + doorThickness + 0.01]}><boxGeometry args={[0.025, height * 0.55, 0.025]} /><meshStandardMaterial color="#4c5863" metalness={0.75} roughness={0.3} /></mesh>}
        </>
      )}

      {[-1, 1].map((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * (width / 2 + rail / 2), -0.29, z * (depth / 2 + rail / 2)]}>
          <cylinderGeometry args={[0.055, 0.055, 0.13, 16]} />
          <meshStandardMaterial color="#161c22" metalness={0.45} roughness={0.55} />
        </mesh>
      )))}

      <LabelSprite text={`${rack.name} · ${rack.heightU}U`} position={[0, height + 0.22, frontZ + 0.06]} color="#4f5c68" width={Math.min(2.1, width * 0.58)} fontSize={23} />

      {thermal && (
        <>
          <mesh position={[0, -0.015, depth / 2 + 1.25]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width + 1.3, 2.5]} /><meshBasicMaterial color="#6f93b8" transparent opacity={0.11} depthWrite={false} /></mesh>
          <LabelSprite text="COLD AISLE · INTAKE" position={[0, 0.04, depth / 2 + 1.15]} color="#6f93b8" width={2.15} />
          <mesh position={[0, -0.012, -depth / 2 - 1.25]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[width + 1.3, 2.5]} /><meshBasicMaterial color="#d46565" transparent opacity={0.13} depthWrite={false} /></mesh>
          <LabelSprite text="HOT AISLE · EXHAUST" position={[0, 0.04, -depth / 2 - 1.15]} color="#d46565" width={2.15} />
        </>
      )}
    </group>
  );
}

function DragGhost({ hardware, rack, startU }: { hardware: HardwareTemplate; rack: RackConfig; startU: number }) {
  if (hardware.uHeight === 0) return null;
  const width = Math.min(hardware.widthMm * MM_SCALE, rack.widthMm * MM_SCALE - 0.16);
  const depth = hardware.depthMm * MM_SCALE;
  const height = Math.max(0.045, hardware.uHeight * U - 0.004);
  const rackDepth = rack.depthMm * MM_SCALE;
  const z = rackDepth / 2 - depth / 2 - 0.12;
  return (
    <group position={[0, (startU + hardware.uHeight / 2) * U, z]}>
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#8fa9bf" transparent opacity={0.24} depthWrite={false} />
      </mesh>
      <mesh>
        <boxGeometry args={[width + 0.02, height + 0.02, depth + 0.02]} />
        <meshBasicMaterial color="#8fa9bf" wireframe transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </group>
  );
}

function PlacementSlots({
  rack, pending, hovered, onHover, onPlace,
}: {
  rack: RackConfig;
  pending: HardwareTemplate | null;
  hovered: number | null;
  onHover: (u: number | null) => void;
  onPlace: (u: number) => void;
}) {
  if (!pending) return null;
  const width = Math.max(0.5, rack.widthMm * MM_SCALE - 0.16);
  const depth = Math.max(0.5, rack.depthMm * MM_SCALE - 0.16);
  return (
    <group>
      {Array.from({ length: rack.heightU }, (_, startU) => (
        <mesh
          key={startU}
          position={[0, (startU + 0.5) * U, 0]}
          onClick={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onPlace(startU); }}
          onPointerOver={(event) => { event.stopPropagation(); onHover(startU); document.body.style.cursor = 'crosshair'; }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = 'default'; }}
        >
          <boxGeometry args={[width, U * 0.92, depth]} />
          <meshBasicMaterial color={hovered === startU ? '#8fa9bf' : '#8fa9bf'} transparent opacity={hovered === startU ? 0.22 : 0.025} depthWrite={false} />
        </mesh>
      ))}
      {hovered !== null && pending.uHeight > 0 && <DragGhost hardware={pending} rack={rack} startU={hovered} />}
    </group>
  );
}

function CameraRegistration({ cameraRef }: { cameraRef: { current: Camera | null } }) {
  const { camera } = useThree();
  useEffect(() => { cameraRef.current = camera; }, [camera, cameraRef]);
  return null;
}

function CameraRig({ resetKey, rackHeight }: { resetKey: number; rackHeight: number }) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();
  const targetY = rackHeight * 0.5;
  useEffect(() => {
    const scale = Math.max(0.8, Math.min(1.15, rackHeight / 7.5));
    camera.position.set(6.6 * scale, targetY + 2.6, 7.2 * scale);
    camera.lookAt(0, targetY, 0);
    if (controls.current) {
      controls.current.target.set(0, targetY, 0);
      controls.current.update();
    }
  }, [camera, rackHeight, resetKey, targetY]);
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={3.2} maxDistance={17} maxPolarAngle={Math.PI * 0.53} target={[0, targetY, 0]} />;
}

interface Rack3DProps {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  selectedId: string | null;
  pendingHardware: HardwareTemplate | null;
  overlay: OverlayMode;
  result: SimulationResult;
  cutaway: boolean;
  xray: boolean;
  resetKey: number;
  animationEnabled: boolean;
  speedMultiplier: number;
  onSelect: (id: string | null) => void;
  onPlace: (hardwareId: string, startU: number, mount: 'front' | 'rear') => void;
}

export function Rack3D(props: Rack3DProps) {
  const [hoveredU, setHoveredU] = useState<number | null>(null);
  useEffect(() => () => { document.body.style.cursor = 'default'; }, []);
  const hardwareById = useMemo(() => new Map(props.catalog.map((item) => [item.id, item])), [props.catalog]);
  const telemetryById = useMemo(() => new Map(props.result.telemetry.map((item) => [item.instanceId, item])), [props.result.telemetry]);
  const cameraRef = useRef<Camera | null>(null);

  const getDropStartU = (event: DragEvent<HTMLDivElement>, hardware: HardwareTemplate | undefined): number => {
    const canvasRect = event.currentTarget.querySelector('canvas')?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const ndcX = ((event.clientX - canvasRect.left) / canvasRect.width) * 2 - 1;
    const ndcY = -((event.clientY - canvasRect.top) / canvasRect.height) * 2 + 1;
    let startU = 0;
    if (cameraRef.current) {
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(ndcX, ndcY), cameraRef.current);
      const rackDepth = props.rack.depthMm * MM_SCALE;
      const frontZ = rackDepth / 2 - 0.12;
      const hit = raycaster.ray.intersectPlane(new Plane(new Vector3(0, 0, 1), -frontZ), new Vector3());
      if (hit) startU = Math.floor(hit.y / U);
    } else {
      const ratio = Math.max(0, Math.min(0.999, (event.clientY - canvasRect.top) / canvasRect.height));
      startU = Math.floor((1 - ratio) * props.rack.heightU);
    }
    const uHeight = hardware?.uHeight ?? 1;
    return Math.max(0, Math.min(Math.max(0, props.rack.heightU - uHeight), startU));
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    if (!props.pendingHardware) return;
    setHoveredU(getDropStartU(event, props.pendingHardware));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const hardwareId = event.dataTransfer.getData('application/rackforge-hardware');
    if (!hardwareId) return;
    const hardware = hardwareById.get(hardwareId);
    const startU = getDropStartU(event, hardware);
    setHoveredU(null);
    props.onPlace(hardwareId, startU, 'front');
  };

  return (
    <div className="relative h-full" onDragOver={handleDragOver} onDragLeave={() => setHoveredU(null)} onDrop={handleDrop}>
      <Canvas
        shadows="soft"
        dpr={[1, 1.75]}
        camera={{ position: [6.6, 4.7, 7.2], fov: 40 }}
        role="img"
        aria-label={`Interactive 3D ${props.rack.name}, ${props.rack.heightU}U; use 2D elevation for keyboard editing`}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.outputColorSpace = 'srgb';
        }}
        onPointerMissed={() => props.onSelect(null)}
      >
        <color attach="background" args={['#0b0e12']} />
        <fog attach="fog" args={['#0b0e12', 14, 28]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={['#c4d2df', '#11161c', 1.0]} />
        <directionalLight position={[5, 9, 6]} intensity={2.6} castShadow shadow-mapSize={[1536, 1536]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={8} shadow-camera-bottom={-2} shadow-bias={-0.0003} />
        <pointLight position={[-4, 3, -4]} intensity={10} color="#8fa9bf" distance={10} />
        <pointLight position={[4, 5, -3]} intensity={8} color="#d47a4f" distance={9} />
        <Environment resolution={128}>
          <Lightformer intensity={2.2} rotation-x={Math.PI / 2} position={[0, 5, -7]} scale={[10, 6, 1]} color="#d6e2eb" />
          <Lightformer intensity={1.4} rotation-y={Math.PI / 2} position={[-5, 2, 0]} scale={[8, 3, 1]} color="#8fa9bf" />
          <Lightformer intensity={1.1} rotation-y={-Math.PI / 2} position={[5, 1, 0]} scale={[8, 3, 1]} color="#cf8b52" />
        </Environment>
        <RackFrame rack={props.rack} cutaway={props.cutaway} xray={props.xray} thermal={props.overlay === 'thermal' || props.overlay === 'airflow'} />
        {props.devices.map((device) => {
          const hardware = hardwareById.get(device.hardwareId);
          if (!hardware) return null;
          if (device.mount === 'vertical') return <VerticalPdu key={device.instanceId} device={device} hardware={hardware} rack={props.rack} selected={props.selectedId === device.instanceId} onSelect={props.onSelect} />;
          return (
            <Fragment key={device.instanceId}>
              <Chassis device={device} hardware={hardware} rack={props.rack} selected={props.selectedId === device.instanceId} overlay={props.overlay} telemetry={telemetryById.get(device.instanceId)} animationEnabled={props.animationEnabled} onSelect={props.onSelect} />
            </Fragment>
          );
        })}
        {(props.overlay === 'thermal' || props.overlay === 'airflow') && (
          <Airflow3DOverlay
            rack={props.rack}
            devices={props.devices}
            catalog={props.catalog}
            result={props.result}
            animationEnabled={props.animationEnabled}
            speedMultiplier={props.speedMultiplier}
          />
        )}
        <PlacementSlots rack={props.rack} pending={props.pendingHardware} hovered={hoveredU} onHover={setHoveredU} onPlace={(startU) => props.pendingHardware && props.onPlace(props.pendingHardware.id, startU, 'front')} />
        <mesh position={[0, -0.255, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[40, 40]} />
          <meshStandardMaterial color="#10151a" roughness={0.72} metalness={0.22} />
        </mesh>
        <Grid position={[0, -0.25, 0]} args={[30, 30]} cellSize={0.5} cellThickness={0.45} cellColor="#2b3540" sectionSize={2.5} sectionThickness={0.8} sectionColor="#3a4856" fadeDistance={19} fadeStrength={1.8} infiniteGrid />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.18} luminanceThreshold={0.88} luminanceSmoothing={0.3} mipmapBlur radius={0.6} />
          <Vignette eskil={false} offset={0.2} darkness={0.45} />
          <SMAA />
        </EffectComposer>
        <CameraRegistration cameraRef={cameraRef} />
        <CameraRig resetKey={props.resetKey} rackHeight={props.rack.heightU * U} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-line/80 bg-ink/75 px-3 py-2 font-mono text-[9px] text-muted backdrop-blur-md">
        <span className="text-white">LMB</span> orbit · <span className="text-white">RMB</span> pan · <span className="text-white">SCROLL</span> zoom
      </div>
      {hoveredU !== null && props.pendingHardware && (
        <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-[10px] text-accent backdrop-blur-md">
          Place {props.pendingHardware.name} at U{hoveredU + 1}
        </div>
      )}
    </div>
  );
}
