import { useMemo } from 'react';
import type { HardwareTemplate, PlacedDevice, RackConfig, SimulationResult } from '../types';

const U_PX = 28;
const RACK_TOP = 34;
const FRONT_X = 92;
const DEVICE_WIDTH = 316;

// A 2D elevation has no rear/front depth axis. Do not invent left-to-right airflow.
// Front-to-back motion is rendered in 3D; here we show only per-device direction and U-axis motion.
export function Airflow2DOverlay({ rack, devices, catalog, result, animationEnabled, speedMultiplier }: {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  result: SimulationResult;
  animationEnabled: boolean;
  speedMultiplier: number;
}) {
  const hardwareById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const telemetryById = useMemo(() => new Map(result.telemetry.map((item) => [item.instanceId, item])), [result.telemetry]);
  const rackHeight = rack.heightU * U_PX;
  const active = devices.filter((device) => device.status === 'active');
  const durationScale = 1 / Math.max(0.1, speedMultiplier);
  const directionLabel = (airflow: HardwareTemplate['airflow']) =>
    airflow === 'front-to-back' ? 'F→R' : airflow === 'back-to-front' ? 'R→F' : airflow === 'side-to-side' ? 'S→S' : '—';

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="cold-aisle-band" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#6f93b8" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#6f93b8" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="hot-aisle-band" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#cf8b52" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#cf8b52" stopOpacity="0.38" />
        </linearGradient>
        <radialGradient id="airflow-particle">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#d6e2eb" />
          <stop offset="100%" stopColor="#6f9fca" stopOpacity="0" />
        </radialGradient>
        <marker id="flow-arrow-up" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
          <path d="M0,6 L3,0 L6,6 Z" fill="#6f9fca" />
        </marker>
        <filter id="particle-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x={FRONT_X - 25} y={RACK_TOP} width="15" height={rackHeight} fill="url(#cold-aisle-band)" rx="3" />
      <text x={FRONT_X - 16} y={RACK_TOP + rackHeight / 2} fill="#6f93b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle" letterSpacing="1.2" transform={`rotate(-90 ${FRONT_X - 16} ${RACK_TOP + rackHeight / 2})`}>COLD · INTAKE</text>

      {active.map((device) => {
        const hardware = hardwareById.get(device.hardwareId);
        if (!hardware || hardware.airflow === 'passive' || device.mount === 'vertical') return null;
        const deviceHeight = hardware.uHeight * U_PX - 2;
        const y = RACK_TOP + (rack.heightU - device.startU - hardware.uHeight) * U_PX + 1;
        const centerX = FRONT_X + DEVICE_WIDTH / 2;
        const path = `M ${centerX} ${y + deviceHeight - 5} L ${centerX} ${y + 5}`;
        const duration = 2.4 * durationScale;
        const temperature = telemetryById.get(device.instanceId)?.localTempC;
        const safeTemperature = Number.isFinite(temperature) ? temperature!.toFixed(1) : rack.ambientC.toFixed(1);
        return (
          <g key={device.instanceId}>
            <path d={path} fill="none" stroke="#6f9fca" strokeWidth="1.4" strokeDasharray="4 5" className="animate-flow" style={{ animationDuration: `${duration}s`, animationPlayState: animationEnabled ? 'running' : 'paused' }} markerEnd="url(#flow-arrow-up)" />
            {animationEnabled && <circle r="3" fill="url(#airflow-particle)" filter="url(#particle-glow)"><animateMotion dur={`${duration}s`} repeatCount="indefinite" path={path} /></circle>}
            <text x={centerX + 12} y={y + 13} fill="#9fb2c8" fontSize="6.5" fontFamily="monospace">{directionLabel(hardware.airflow)}</text>
            {deviceHeight >= 52 && <text x={FRONT_X + DEVICE_WIDTH - 7} y={y + 12} fill="#9fb2c8" fontSize="6.5" textAnchor="end" fontFamily="monospace">INTAKE {rack.ambientC.toFixed(1)}° → EXHAUST {safeTemperature}°</text>}
          </g>
        );
      })}

      {result.recirculationGaps.slice(0, 4).map((gap) => {
        const y = RACK_TOP + (rack.heightU - gap.startU - gap.size / 2) * U_PX;
        return <text key={gap.startU} x={FRONT_X + DEVICE_WIDTH + 20} y={y} fill="#d46565" fontSize="6.5" textAnchor="end" fontFamily="monospace">RECIRC {gap.size}U</text>;
      })}
    </g>
  );
}
