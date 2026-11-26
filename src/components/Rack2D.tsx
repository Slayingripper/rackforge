import { useMemo } from 'react';
import type { DragEvent } from 'react';
import type { HardwareTemplate, OverlayMode, PlacedDevice, RackConfig, SimulationResult } from '../types';
import { CATEGORY_META } from '../data/catalog';
import { Airflow2DOverlay } from './Airflow2D';

const U_PX = 28;
const SVG_WIDTH = 500;
const RACK_X = 62;
const RACK_WIDTH = 376;
const FRONT_X = 92;
const DEVICE_WIDTH = 316;

function tempColor(temp: number) {
  if (temp >= 40) return '#d46565';
  if (temp >= 34) return '#cf8b52';
  if (temp >= 29) return '#d6a34c';
  if (temp >= 25) return '#6f9f7f';
  return '#6f93b8';
}

function deviceColor(
  hardware: HardwareTemplate,
  overlay: OverlayMode,
  telemetry: SimulationResult['telemetry'][number] | undefined,
) {
  if (overlay === 'airflow') {
    if (hardware.airflow === 'back-to-front') return '#cf8b52';
    if (hardware.airflow === 'side-to-side') return '#6f9f7f';
    if (hardware.airflow === 'passive') return '#526174';
    return '#6f93b8';
  }
  if (overlay === 'thermal') return tempColor(telemetry?.localTempC ?? 22);
  if (overlay === 'power') {
    const watts = telemetry?.typicalW ?? hardware.typicalW;
    if (watts >= 1500) return '#d46565';
    if (watts >= 700) return '#d6a34c';
    if (watts > 0) return '#6f93b8';
    return '#526174';
  }
  if (overlay === 'weight') {
    const kg = telemetry?.weightKg ?? hardware.weightKg;
    if (kg >= 45) return '#d46565';
    if (kg >= 25) return '#d6a34c';
    if (kg > 0) return '#6f93b8';
    return '#526174';
  }
  return hardware.color;
}

interface Rack2DProps {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  selectedId: string | null;
  pendingHardware: HardwareTemplate | null;
  viewSide: 'front' | 'rear';
  overlay: OverlayMode;
  result: SimulationResult;
  animationEnabled: boolean;
  speedMultiplier: number;
  onSelect: (id: string | null) => void;
  onPlace: (hardwareId: string, startU: number, mount: 'front' | 'rear') => void;
  onMove: (instanceId: string, startU: number) => void;
}

function activateOnKey(event: React.KeyboardEvent, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
}

export function Rack2D({ rack, devices, catalog, selectedId, pendingHardware, viewSide, overlay, result, animationEnabled, speedMultiplier, onSelect, onPlace, onMove }: Rack2DProps) {
  const height = rack.heightU * U_PX + 44;
  const telemetryById = useMemo(() => new Map(result.telemetry.map((item) => [item.instanceId, item])), [result.telemetry]);
  const hardwareById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const visible = devices.filter((device) => {
    if (device.mount === 'vertical') return true;
    return device.mount === viewSide;
  });

  const handleDrop = (event: DragEvent<SVGRectElement>, startU: number) => {
    event.preventDefault();
    const hardwareId = event.dataTransfer.getData('application/rackforge-hardware');
    const instanceId = event.dataTransfer.getData('application/rackforge-device');
    if (hardwareId) onPlace(hardwareId, startU, viewSide);
    else if (instanceId) onMove(instanceId, startU);
  };

  const handleRowClick = (startU: number) => {
    if (pendingHardware) onPlace(pendingHardware.id, startU, viewSide);
    else onSelect(null);
  };

  return (
    <div className="relative h-full overflow-auto bg-[radial-gradient(circle_at_50%_30%,rgba(49,75,108,.12),transparent_60%)]">
      <div className="pointer-events-none sticky top-0 z-10 flex items-center justify-between border-b border-line/70 bg-ink/85 px-4 py-2 backdrop-blur-md">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{viewSide} elevation · 1U grid = {U_PX}px</p>
        <div className="flex items-center gap-3 font-mono text-[8px] text-muted">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Active</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm border border-dashed border-muted" /> Reserved</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-sm bg-warning" /> Restricted</span>
        </div>
      </div>
      <svg width={SVG_WIDTH} height={height} viewBox={`0 0 ${SVG_WIDTH} ${height}`} className="mx-auto block select-none" role="group" aria-label={`${rack.name} ${viewSide} elevation with ${visible.length} visible devices`}>
        <defs>
          <pattern id="rack-grid" width={U_PX} height={U_PX} patternUnits="userSpaceOnUse">
            <path d={`M 0 0 H ${RACK_WIDTH}`} stroke="#1b2839" strokeWidth="1" />
          </pattern>
          <pattern id="blocked-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="rgba(255,100,124,.07)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255,100,124,.3)" strokeWidth="2" />
          </pattern>
          <pattern id="reserved-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="10" height="10" fill="rgba(247,185,85,.06)" />
            <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(247,185,85,.25)" strokeWidth="2" />
          </pattern>
          <pattern id="perforations" width="9" height="9" patternUnits="userSpaceOnUse">
            <rect width="9" height="9" fill="#0d1520" />
            <circle cx="4.5" cy="4.5" r="1.4" fill="#33455c" />
          </pattern>
          <marker id="flow-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#6f9f7f" /></marker>
          <marker id="flow-arrow-reverse" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#cf8b52" /></marker>
          <linearGradient id="thermal-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#6f93b8" />
            <stop offset="45%" stopColor="#6f9f7f" />
            <stop offset="75%" stopColor="#d6a34c" />
            <stop offset="100%" stopColor="#d46565" />
          </linearGradient>
          <filter id="device-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <text x="26" y="21" fill="#78889e" fontSize="8" fontFamily="monospace" letterSpacing="1.5">{viewSide.toUpperCase()} ELEVATION</text>
        <text x="392" y="21" fill="#8fa9bf" fontSize="8" fontFamily="monospace" textAnchor="end">{rack.heightU}U · {rack.widthMm} × {rack.depthMm}mm</text>

        <rect x={RACK_X} y="34" width={RACK_WIDTH} height={rack.heightU * U_PX} rx="4" fill="#0a111b" stroke="#3b4d63" strokeWidth="2" />
        <rect x={FRONT_X} y="34" width={DEVICE_WIDTH} height={rack.heightU * U_PX} fill="url(#rack-grid)" />

        {Array.from({ length: rack.heightU }, (_, index) => {
          const startU = index;
          const y = 34 + (rack.heightU - startU - 1) * U_PX;
          return (
            <g key={`row-${startU}`}>
              <text x="51" y={y + 18} fill="#64768d" fontSize="8" textAnchor="end" fontFamily="monospace">{startU + 1}</text>
              <text x="449" y={y + 18} fill="#64768d" fontSize="8" fontFamily="monospace">{startU + 1}</text>
              <rect
                x={FRONT_X} y={y} width={DEVICE_WIDTH} height={U_PX}
                role="button"
                tabIndex={0}
                aria-label={`U${startU + 1}${pendingHardware ? ` · place ${pendingHardware.name}` : ''}`}
                fill={pendingHardware ? 'rgba(143,169,191,.025)' : 'transparent'}
                stroke={pendingHardware ? 'rgba(143,169,191,.11)' : 'transparent'}
                className={pendingHardware ? 'cursor-crosshair hover:fill-accent/10' : 'cursor-default'}
                onClick={() => handleRowClick(startU)}
                onKeyDown={(event) => activateOnKey(event, () => handleRowClick(startU))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, startU)}
              >
                <title>U{startU + 1}{pendingHardware ? ` · place ${pendingHardware.name}` : ''}</title>
              </rect>
            </g>
          );
        })}

        {rack.zones.map((zone) => {
          const y = 34 + (rack.heightU - zone.endU) * U_PX;
          const zoneHeight = (zone.endU - zone.startU) * U_PX;
          return (
            <g key={zone.id} pointerEvents="none">
              <rect x={FRONT_X} y={y} width={DEVICE_WIDTH} height={zoneHeight} fill={`url(#${zone.kind === 'blocked' ? 'blocked' : 'reserved'}-hatch)`} stroke={zone.kind === 'blocked' ? '#d4656555' : '#d6a34c55'} strokeDasharray="4 3" />
              <text x={FRONT_X + 8} y={y + 13} fill={zone.kind === 'blocked' ? '#d46565' : '#d6a34c'} fontSize="7" fontFamily="monospace">{zone.name.toUpperCase()}</text>
            </g>
          );
        })}

        {visible.map((device) => {
          const hardware = hardwareById.get(device.hardwareId);
          if (!hardware || device.mount === 'vertical') return null;
          const telemetry = telemetryById.get(device.instanceId);
          const y = 34 + (rack.heightU - device.startU - hardware.uHeight) * U_PX + 1;
          const rectHeight = hardware.uHeight * U_PX - 2;
          const selected = selectedId === device.instanceId;
          const color = deviceColor(hardware, overlay, telemetry);
          const isBlank = hardware.category === 'thermal' && hardware.typicalW === 0;
          return (
            <g
              key={device.instanceId}
              {...{ draggable: true }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={`${device.overrides?.label ?? hardware.name} at U${device.startU + 1}, ${device.mount}, ${device.status}`}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/rackforge-device', device.instanceId);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onClick={(event) => { event.stopPropagation(); onSelect(device.instanceId); }}
              onKeyDown={(event) => { event.stopPropagation(); activateOnKey(event, () => onSelect(device.instanceId)); }}
              className="cursor-grab active:cursor-grabbing"
            >
              <title>{device.overrides?.label ?? hardware.name} · U{device.startU + 1}–{device.startU + hardware.uHeight} · {telemetry?.typicalW ?? 0}W</title>
              <rect
                x={FRONT_X + 1} y={y} width={DEVICE_WIDTH - 2} height={rectHeight} rx="3"
                fill={isBlank ? 'rgba(66,211,146,.10)' : color}
                fillOpacity={device.status === 'reserved' ? 0.16 : isBlank ? 1 : overlay === 'normal' ? 0.18 : 0.32}
                stroke={selected ? '#ffffff' : color}
                strokeOpacity={selected ? 0.95 : device.status === 'reserved' ? 0.45 : 0.8}
                strokeWidth={selected ? 2 : 1}
                strokeDasharray={device.status === 'reserved' ? '5 3' : undefined}
                filter={selected ? 'url(#device-glow)' : undefined}
              />
              <rect x={FRONT_X + 7} y={y + 5} width="3" height={Math.max(5, rectHeight - 10)} rx="1" fill={color} opacity="0.85" />
              <text x={FRONT_X + 17} y={y + Math.min(18, rectHeight / 2 + 3)} fill={device.status === 'reserved' ? '#78889e' : '#e8eef7'} fontSize="9" fontWeight="600" fontFamily="Inter, sans-serif">
                {device.overrides?.label ?? hardware.name}
              </text>
              {rectHeight >= 31 && <>
                <text x={FRONT_X + 17} y={y + 30} fill="#8ea0b8" fontSize="7" fontFamily="monospace">
                  {device.flipped ? 'REV · ' : ''}{CATEGORY_META[hardware.category].label.toUpperCase()} · {telemetry?.typicalW ?? 0}W · {telemetry?.weightKg ?? hardware.weightKg}kg
                </text>
                {!isBlank && Array.from({ length: Math.min(8, Math.floor(rectHeight / 10)) }, (_, bay) => (
                  <rect key={bay} x={FRONT_X + DEVICE_WIDTH - 66 + bay * 6.5} y={y + 7} width="4" height={Math.max(5, rectHeight - 14)} rx="1" fill="#060a10" opacity="0.65" />
                ))}
              </>}

            </g>
          );
        })}

        {(overlay === 'thermal' || overlay === 'airflow') && (
          <Airflow2DOverlay
            rack={rack}
            devices={visible}
            catalog={catalog}
            result={result}
            animationEnabled={animationEnabled}
            speedMultiplier={speedMultiplier}
          />
        )}

        {devices.filter((device) => device.mount === 'vertical').map((device) => {
          const hardware = hardwareById.get(device.hardwareId);
          if (!hardware) return null;
          const x = device.side === 'left' ? 18 : 460;
          const selected = selectedId === device.instanceId;
          return (
            <g key={device.instanceId} role="button" tabIndex={0} aria-pressed={selected} aria-label={`${hardware.name}, 0U ${device.side} rail`} onClick={(event) => { event.stopPropagation(); onSelect(device.instanceId); }} onKeyDown={(event) => { event.stopPropagation(); activateOnKey(event, () => onSelect(device.instanceId)); }} className="cursor-pointer">
              <title>{hardware.name} · 0U {device.side} rail</title>
              <rect x={x} y="48" width="22" height={rack.heightU * U_PX - 28} rx="3" fill="#1a2330" stroke={selected ? '#fff' : hardware.color} strokeOpacity="0.7" />
              {Array.from({ length: Math.floor((rack.heightU * U_PX - 40) / 14) }, (_, index) => <rect key={index} x={x + 5} y={54 + index * 14} width="12" height="5" rx="1" fill="#05080d" stroke="#3a485a" strokeWidth="0.5" />)}
              <text x={x + 11} y={34 + rack.heightU * U_PX / 2} fill="#78889e" fontSize="7" fontFamily="monospace" textAnchor="middle" transform={`rotate(-90 ${x + 11} ${34 + rack.heightU * U_PX / 2})`}>0U {(hardware.subtype ?? 'ACCESSORY').toUpperCase()} · {device.pdu}</text>
            </g>
          );
        })}

        <line x1={RACK_X - 6} y1="34" x2={RACK_X - 6} y2={34 + rack.heightU * U_PX} stroke="#53677f" strokeWidth="4" />
        <line x1={RACK_X + RACK_WIDTH + 6} y1="34" x2={RACK_X + RACK_WIDTH + 6} y2={34 + rack.heightU * U_PX} stroke="#53677f" strokeWidth="4" />
        <line x1={RACK_X - 10} y1="34" x2={RACK_X + RACK_WIDTH + 10} y2="34" stroke="#53677f" strokeWidth="5" />
        <line x1={RACK_X - 10} y1={34 + rack.heightU * U_PX} x2={RACK_X + RACK_WIDTH + 10} y2={34 + rack.heightU * U_PX} stroke="#53677f" strokeWidth="5" />
        {rack.form === 'enclosed' && <rect x={RACK_X - 2} y="32" width={RACK_WIDTH + 4} height={rack.heightU * U_PX + 4} rx="4" fill="url(#perforations)" opacity="0.08" pointerEvents="none" />}
        <text x="250" y={height - 5} fill="#526174" fontSize="7" textAnchor="middle" fontFamily="monospace">DRAG TO MOVE · CLICK A ROW TO PLACE · SCROLL TO NAVIGATE</text>
      </svg>
    </div>
  );
}
