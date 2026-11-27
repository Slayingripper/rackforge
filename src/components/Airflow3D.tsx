import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  Object3D,
  Vector3,
  type InstancedMesh,
} from 'three';
import type { HardwareTemplate, PlacedDevice, RackConfig, SimulationResult } from '../types';
import { LabelSprite } from './SceneLabel';
import type { AirflowField } from '../lib/airflow';
import { buildStreamlineSeeds, computeStreamlines } from '../lib/airflow/streamlines';

const MM_SCALE = 1 / 250;
const U = 44.45 * MM_SCALE;
const COLD = new Color('#6f9fca');
const HOT = new Color('#d47a4f');
const RISK = new Color('#d46565');

const clampNum = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Particles advected through the REAL solved CFD velocity field.
 * Cold particles enter at inlets, are heated by devices, rise by buoyancy,
 * exhaust at outlets; recirculation & bypass emerge from the field.
 */
const UP = new Vector3(0, 1, 0);

function FlowArrows({ field }: { field: AirflowField }) {
  const mesh = useRef<InstancedMesh>(null);
  const ambientC = field.report.averageIntakeC;
  const items = useMemo(() => {
    const spm = field.scenePerMeter;
    const minX = field.grid.boundsMin[0] * spm; const maxX = field.grid.boundsMax[0] * spm;
    const minY = field.grid.boundsMin[1] * spm; const maxY = field.grid.boundsMax[1] * spm;
    const minZ = field.grid.boundsMin[2] * spm; const maxZ = field.grid.boundsMax[2] * spm;
    const list: { pos: [number, number, number]; dir: [number, number, number]; speed: number; tempC: number }[] = [];
    const NX = 4; const NY = 6; const NZ = 3;
    for (let k = 0; k < NZ; k++) {
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX; i++) {
          const x = minX + (maxX - minX) * (i + 0.5) / NX;
          const y = minY + (maxY - minY) * (j + 0.5) / NY;
          const z = minZ + (maxZ - minZ) * (k + 0.5) / NZ;
          const s = field.sampleScene(x, y, z);
          if (s.blocked || s.speed < 0.05) continue;
          list.push({ pos: [x, y, z], dir: [s.vx, s.vy, s.vz], speed: s.speed, tempC: s.tempC });
        }
      }
    }
    return list;
  }, [field]);

  useEffect(() => {
    if (!mesh.current) return;
    mesh.current.instanceMatrix.setUsage(DynamicDrawUsage);
    const dummy = new Object3D();
    const dir = new Vector3();
    const color = new Color();
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      dir.set(item.dir[0], item.dir[1], item.dir[2]);
      const speed = dir.length();
      if (speed < 1e-5) continue;
      dir.normalize();
      dummy.position.set(item.pos[0], item.pos[1], item.pos[2]);
      dummy.quaternion.setFromUnitVectors(UP, dir);
      const len = clampNum(0.5 + speed * 0.25, 0.5, 2.2);
      dummy.scale.set(1, len, 1);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      const t = clampNum((item.tempC - ambientC + 1) / 14, 0, 1);
      color.lerpColors(COLD, HOT, t);
      mesh.current.setColorAt(i, color);
    }
    mesh.current.count = items.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [items, ambientC]);

  if (items.length === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, items.length)]} frustumCulled={false}>
      <coneGeometry args={[0.03, 0.16, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.82} depthWrite={false} depthTest={false} toneMapped={false} />
    </instancedMesh>
  );
}

function Streamlines({ field, speedMultiplier, enabled }: { field: AirflowField; speedMultiplier: number; enabled: boolean }) {
  const lines = useMemo(() => {
    const intakes = field.report.perDevice.map((d) => d.intakeScene);
    return computeStreamlines(field, buildStreamlineSeeds(field, intakes), 520, 0.04);
  }, [field]);
  const rendered = useMemo(() => {
    const ambient = field.report.averageIntakeC;
    return lines.map((line) => {
      const points: [number, number, number][] = [];
      const colors: [number, number, number][] = [];
      for (let i = 0; i < line.cumulative.length; i++) {
        points.push([line.points[i * 3], line.points[i * 3 + 1], line.points[i * 3 + 2]]);
        const t = clampNum((line.temps[i] - ambient + 1) / 14, 0, 1);
        colors.push([0x6f / 255 + (0xd4 - 0x6f) / 255 * t, 0x9f / 255 + (0x7a - 0x9f) / 255 * t, 0xca / 255 + (0x4f - 0xca) / 255 * t]);
      }
      return { points, colors };
    });
  }, [lines, field]);
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const mixedColor = useMemo(() => new Color(), []);
  const particlesPerLine = 4;
  const count = lines.length * particlesPerLine;
  const ambientC = field.report.averageIntakeC;

  useEffect(() => { mesh.current?.instanceMatrix.setUsage(DynamicDrawUsage); }, [count]);

  useFrame(({ clock }) => {
    if (!mesh.current || count === 0) return;
    const time = enabled ? clock.elapsedTime * speedMultiplier : 0;
    let index = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const n = line.cumulative.length;
      for (let p = 0; p < particlesPerLine; p++) {
        const phase = (((time * 0.11 + p / particlesPerLine + li * 0.017) % 1) + 1) % 1;
        const dist = phase * line.length;
        let i = 1;
        while (i < n - 1 && line.cumulative[i] < dist) i++;
        const prev = line.cumulative[i - 1];
        const span = Math.max(1e-6, line.cumulative[i] - prev);
        const f = clampNum((dist - prev) / span, 0, 1);
        const a = (i - 1) * 3;
        const b = i * 3;
        const x = line.points[a] + (line.points[b] - line.points[a]) * f;
        const y = line.points[a + 1] + (line.points[b + 1] - line.points[a + 1]) * f;
        const z = line.points[a + 2] + (line.points[b + 2] - line.points[a + 2]) * f;
        const temp = line.temps[i - 1] + (line.temps[i] - line.temps[i - 1]) * f;
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(1.15 + Math.sin(phase * Math.PI) * 0.5);
        dummy.updateMatrix();
        mesh.current.setMatrixAt(index, dummy.matrix);
        const tNorm = clampNum((temp - ambientC + 1) / 14, 0, 1);
        mixedColor.lerpColors(COLD, HOT, tNorm);
        mesh.current.setColorAt(index, mixedColor);
        index++;
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  if (rendered.length === 0) return null;
  return (
    <group>
      {rendered.map((line, index) => (
        <Line
          key={index}
          points={line.points}
          vertexColors={line.colors}
          lineWidth={2.6}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      ))}
      <instancedMesh ref={mesh} args={[undefined, undefined, Math.max(1, count)]} frustumCulled={false}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.98} depthWrite={false} depthTest={false} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

function FlowParticles({
  curves,
  speed,
  enabled,
  gradient = true,
  color = RISK,
  particlesPerCurve = 3,
  size = 1,
}: {
  curves: CatmullRomCurve3[];
  speed: number;
  enabled: boolean;
  gradient?: boolean;
  color?: Color;
  particlesPerCurve?: number;
  size?: number;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const point = useMemo(() => new Vector3(), []);
  const mixedColor = useMemo(() => new Color(), []);
  const count = curves.length * particlesPerCurve;

  useEffect(() => {
    mesh.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const time = enabled ? clock.elapsedTime * speed : 0;
    let index = 0;
    for (let curveIndex = 0; curveIndex < curves.length; curveIndex++) {
      const curve = curves[curveIndex];
      for (let particle = 0; particle < particlesPerCurve; particle++) {
        const phase = particle / particlesPerCurve + curveIndex * 0.037;
        const t = ((time + phase) % 1 + 1) % 1;
        curve.getPointAt(t, point);
        dummy.position.copy(point);
        dummy.scale.setScalar(size * (0.7 + Math.sin(t * Math.PI) * 0.55));
        dummy.updateMatrix();
        mesh.current.setMatrixAt(index, dummy.matrix);
        if (gradient) mixedColor.lerpColors(COLD, HOT, t);
        else mixedColor.copy(color);
        mesh.current.setColorAt(index, mixedColor);
        index++;
      }
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  if (count === 0) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function DeviceStream({
  airflow,
  y,
  width,
  depth,
  heatW,
  speedMultiplier,
  enabled,
}: {
  airflow: HardwareTemplate['airflow'];
  y: number;
  width: number;
  depth: number;
  heatW: number;
  speedMultiplier: number;
  enabled: boolean;
}) {
  const curves = useMemo(() => {
    const front = depth / 2 + 1.15;
    const rear = -depth / 2 - 0.85;
    const lanes = [-0.3, 0, 0.3];
    if (airflow === 'side-to-side') {
      return lanes.map((lane) => new CatmullRomCurve3([
        new Vector3(-width / 2 - 1.05, y + lane * 0.12, 0.15),
        new Vector3(-width * 0.28, y + lane * 0.08, 0),
        new Vector3(0, y + lane * 0.04, -0.08),
        new Vector3(width * 0.28, y - lane * 0.08, 0),
        new Vector3(width / 2 + 1.05, y - lane * 0.12, -0.15),
      ]));
    }
    return lanes.map((lane, index) => {
      const x = lane * width;
      const wave = (index - 1) * 0.035;
      const points = airflow === 'back-to-front'
        ? [
            new Vector3(x * 0.85, y + wave, rear),
            new Vector3(x * 0.78, y + wave, -depth / 2 - 0.08),
            new Vector3(x * 0.72, y, 0),
            new Vector3(x * 0.8, y - wave, depth / 2 + 0.08),
            new Vector3(x * 0.9, y - wave, front),
          ]
        : [
            new Vector3(x * 0.9, y + wave, front),
            new Vector3(x * 0.8, y + wave, depth / 2 + 0.08),
            new Vector3(x * 0.72, y, 0),
            new Vector3(x * 0.78, y - wave, -depth / 2 - 0.08),
            new Vector3(x * 0.85, y - wave, rear),
          ];
      return new CatmullRomCurve3(points);
    });
  }, [airflow, depth, width, y]);

  const streamColor = airflow === 'back-to-front' ? '#cf8b52' : airflow === 'side-to-side' ? '#6f9f7f' : '#6f9fca';
  const speed = (0.14 + Math.min(0.28, heatW / 11000)) * speedMultiplier;

  return (
    <group>
      {curves.map((curve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[curve, 36, 0.007, 5, false]} />
          <meshBasicMaterial color={streamColor} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <FlowParticles curves={curves} speed={speed} enabled={enabled} size={0.85 + Math.min(0.55, heatW / 5000)} />
    </group>
  );
}

function ThermalPlume({ rack, heatKw, speedMultiplier, enabled }: { rack: RackConfig; heatKw: number; speedMultiplier: number; enabled: boolean }) {
  const count = 110;
  const attribute = useRef<BufferAttribute>(null);
  const rackWidth = rack.widthMm * MM_SCALE;
  const rackDepth = rack.depthMm * MM_SCALE;
  const rackHeight = rack.heightU * U;
  const positions = useMemo(() => new Float32Array(count * 3), []);
  const colors = useMemo(() => {
    const hot = new Color('#d46565');
    const warm = new Color('#d6a34c');
    const mixed = new Color();
    const values = new Float32Array(count * 3);
    for (let index = 0; index < count; index++) {
      mixed.lerpColors(warm, hot, (index % 11) / 10);
      values[index * 3] = mixed.r;
      values[index * 3 + 1] = mixed.g;
      values[index * 3 + 2] = mixed.b;
    }
    return values;
  }, []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, index) => ({
    x: (Math.random() - 0.5) * rackWidth * 0.85,
    z: (Math.random() - 0.5) * 0.7,
    phase: index / count,
    drift: Math.random() * Math.PI * 2,
    speed: 0.65 + Math.random() * 0.7,
  })), [rackWidth]);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,.9)');
    gradient.addColorStop(0.25, 'rgba(255,255,255,.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const map = new CanvasTexture(canvas);
    map.colorSpace = 'srgb';
    return map;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame(({ clock }) => {
    if (!attribute.current) return;
    const time = enabled ? clock.elapsedTime * speedMultiplier : 0;
    const rise = 0.055 + Math.min(0.09, heatKw / 180);
    for (let index = 0; index < count; index++) {
      const seed = seeds[index];
      const progress = (seed.phase + time * rise * seed.speed) % 1;
      positions[index * 3] = seed.x + Math.sin(time * 0.8 + seed.drift + progress * 4) * (0.08 + progress * 0.18);
      positions[index * 3 + 1] = 0.15 + progress * (rackHeight + 1.7);
      positions[index * 3 + 2] = -rackDepth / 2 - 0.5 + seed.z + progress * 0.35;
    }
    attribute.current.needsUpdate = true;
  });

  if (heatKw <= 0) return null;
  return (
    <points frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute ref={attribute} attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.17 + Math.min(0.16, heatKw / 80)}
        map={texture}
        vertexColors
        transparent
        opacity={0.22 + Math.min(0.32, heatKw / 35)}
        depthWrite={false}
        blending={AdditiveBlending}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
}

function RiskLoop({ curve, speed, enabled }: { curve: CatmullRomCurve3; speed: number; enabled: boolean }) {
  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 48, 0.012, 5, false]} />
        <meshBasicMaterial color="#d46565" transparent opacity={0.28} depthWrite={false} toneMapped={false} />
      </mesh>
      <FlowParticles curves={[curve]} speed={speed} enabled={enabled} gradient={false} color={RISK} particlesPerCurve={5} size={1.05} />
    </group>
  );
}

export function Airflow3DOverlay({
  rack,
  devices,
  catalog,
  result,
  animationEnabled,
  speedMultiplier,
  field = null,
}: {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  result: SimulationResult;
  animationEnabled: boolean;
  speedMultiplier: number;
  field?: AirflowField | null;
}) {
  const hardwareById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const telemetryById = useMemo(() => new Map(result.telemetry.map((item) => [item.instanceId, item])), [result.telemetry]);
  const width = rack.widthMm * MM_SCALE;
  const depth = rack.depthMm * MM_SCALE;
  const height = rack.heightU * U;
  const active = devices.filter((device) => device.status === 'active');

  const riskCurves = useMemo(() => result.recirculationGaps.slice(0, 4).map((gap) => {
    const y = (gap.startU + gap.size / 2) * U;
    return new CatmullRomCurve3([
      new Vector3(0, y, -depth / 2 - 0.45),
      new Vector3(width * 0.38, y + 0.08, -depth / 2 - 0.2),
      new Vector3(width / 2 + 0.65, y + 0.14, 0),
      new Vector3(width / 2 + 0.58, y + 0.04, depth / 2 + 0.3),
      new Vector3(0, y, depth / 2 + 0.55),
    ]);
  }), [depth, result.recirculationGaps, width]);

  const bypassCurves = useMemo(() => [-1, 1].map((side) => new CatmullRomCurve3([
    new Vector3(side * (width / 2 + 0.48), height * 0.3, depth / 2 + 0.75),
    new Vector3(side * (width / 2 + 0.7), height * 0.36, 0),
    new Vector3(side * (width / 2 + 0.48), height * 0.3, -depth / 2 - 0.65),
  ])), [depth, height, width]);

  return (
    <group>
      {field && <Streamlines field={field} speedMultiplier={speedMultiplier} enabled={animationEnabled} />}
      {field && <FlowArrows field={field} />}
      {!field && active.map((device) => {
        const hardware = hardwareById.get(device.hardwareId);
        if (!hardware || hardware.airflow === 'passive') return null;
        if (device.mount === 'vertical') {
          if (hardware.uHeight !== 0) return null;
          return (
            <DeviceStream
              key={device.instanceId}
              airflow="side-to-side"
              y={height * 0.5}
              width={width * 0.75}
              depth={depth}
              heatW={telemetryById.get(device.instanceId)?.typicalW ?? hardware.typicalW}
              speedMultiplier={speedMultiplier}
              enabled={animationEnabled}
            />
          );
        }
        const telemetry = telemetryById.get(device.instanceId);
        const deviceWidth = Math.min(hardware.widthMm * MM_SCALE, width * 0.8);
        return (
          <DeviceStream
            key={device.instanceId}
            airflow={hardware.airflow}
            y={(device.startU + hardware.uHeight / 2) * U}
            width={deviceWidth}
            depth={depth}
            heatW={telemetry?.typicalW ?? hardware.typicalW}
            speedMultiplier={speedMultiplier}
            enabled={animationEnabled}
          />
        );
      })}
      {riskCurves.map((curve, index) => (
        <RiskLoop key={index} curve={curve} speed={0.22 * speedMultiplier} enabled={animationEnabled} />
      ))}
      {result.recirculationGaps.slice(0, 3).map((gap) => (
        <LabelSprite
          key={gap.startU}
          text={`RECIRC · ${gap.size}U`}
          position={[width / 2 + 0.68, (gap.startU + gap.size / 2) * U + 0.12, depth / 2 + 0.34]}
          color="#d46565"
          width={0.95}
          fontSize={24}
        />
      ))}
      {!field && result.bypassRiskPct > 8 && bypassCurves.map((curve, index) => (
        <group key={index}>
          <mesh>
            <tubeGeometry args={[curve, 32, 0.009, 5, false]} />
            <meshBasicMaterial color="#6f9fca" transparent opacity={0.08 + result.bypassRiskPct / 700} depthWrite={false} toneMapped={false} />
          </mesh>
          <FlowParticles curves={[curve]} speed={0.16 * speedMultiplier} enabled={animationEnabled} gradient={false} color={COLD} particlesPerCurve={3} size={0.7} />
        </group>
      ))}
      {!field && result.bypassRiskPct > 15 && (
        <LabelSprite text="BYPASS AIR" position={[width / 2 + 0.55, height * 0.34, -depth / 2 - 0.4]} color="#6f93b8" width={1.05} fontSize={23} />
      )}
      {!field && <ThermalPlume rack={rack} heatKw={result.heatKw} speedMultiplier={speedMultiplier} enabled={animationEnabled} />}
    </group>
  );
}
