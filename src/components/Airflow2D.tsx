import { useMemo } from 'react';
import type { HardwareTemplate, PlacedDevice, RackConfig, SimulationResult } from '../types';

const U_PX = 28;
const RACK_TOP = 34;
const FRONT_X = 92;
const DEVICE_WIDTH = 316;

export function Airflow2DOverlay({
  rack,
  devices,
  catalog,
  result,
  animationEnabled,
  speedMultiplier,
}: {
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
  const durationScale = 1 / speedMultiplier;

  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id="airflow-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6f9fca" />
          <stop offset="48%" stopColor="#8fa9bf" />
          <stop offset="100%" stopColor="#d47a4f" />
        </linearGradient>
        <linearGradient id="airflow-gradient-reverse" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d47a4f" />
          <stop offset="52%" stopColor="#d6a34c" />
          <stop offset="100%" stopColor="#6f9fca" />
        </linearGradient>
        <linearGradient id="cold-aisle-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6f93b8" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#6f93b8" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id="hot-aisle-band" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d47a4f" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#d47a4f" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id="airflow-particle">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#d6e2eb" />
          <stop offset="100%" stopColor="#6f9fca" stopOpacity="0" />
        </radialGradient>
        <filter id="particle-glow" x="-300%" y="-300%" width="700%" height="700%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect x={FRONT_X - 25} y={RACK_TOP} width="15" height={rackHeight} fill="url(#cold-aisle-band)" rx="3" />
      <rect x={FRONT_X + DEVICE_WIDTH + 10} y={RACK_TOP} width="15" height={rackHeight} fill="url(#hot-aisle-band)" rx="3" />
      <text x={FRONT_X - 16} y={RACK_TOP + rackHeight / 2} fill="#6f93b8" fontSize="6.5" fontFamily="monospace" textAnchor="middle" letterSpacing="1.2" transform={`rotate(-90 ${FRONT_X - 16} ${RACK_TOP + rackHeight / 2})`}>COLD · INTAKE</text>
      <text x={FRONT_X + DEVICE_WIDTH + 19} y={RACK_TOP + rackHeight / 2} fill="#cf8b52" fontSize="6.5" fontFamily="monospace" textAnchor="middle" letterSpacing="1.2" transform={`rotate(90 ${FRONT_X + DEVICE_WIDTH + 19} ${RACK_TOP + rackHeight / 2})`}>HOT · EXHAUST</text>

      {active.map((device) => {
        const hardware = hardwareById.get(device.hardwareId);
        if (!hardware || hardware.airflow === 'passive') return null;
        if (device.mount === 'vertical') {
          const x = device.side === 'left' ? FRONT_X - 17 : FRONT_X + DEVICE_WIDTH + 17;
          const path = `M ${x} ${RACK_TOP + 45} C ${x + 8} ${RACK_TOP + rackHeight * 0.35}, ${x - 8} ${RACK_TOP + rackHeight * 0.65}, ${x} ${RACK_TOP + rackHeight - 45}`;
          return (
            <g key={device.instanceId}>
              <path d={path} fill="none" stroke="#6f9f7f" strokeWidth="1.5" strokeDasharray="4 5" className="animate-flow" style={{ animationDuration: `${2.6 * durationScale}s`, animationPlayState: animationEnabled ? 'running' : 'paused' }} markerEnd="url(#flow-arrow)" />
              {animationEnabled && <circle r="3" fill="url(#airflow-particle)" filter="url(#particle-glow)"><animateMotion dur={`${2.6 * durationScale}s`} repeatCount="indefinite" path={path} /></circle>}
            </g>
          );
        }
        const telemetry = telemetryById.get(device.instanceId);
        const deviceHeight = hardware.uHeight * U_PX - 2;
        const y = RACK_TOP + (rack.heightU - device.startU - hardware.uHeight) * U_PX + 1 + deviceHeight / 2;
        const reverse = hardware.airflow === 'back-to-front';
        const side = hardware.airflow === 'side-to-side';
        const lanes = deviceHeight > 50 ? [-0.22, 0, 0.22] : [0];
        const heatW = telemetry?.typicalW ?? hardware.typicalW;
        return (
          <g key={device.instanceId}>
            {lanes.map((lane, laneIndex) => {
              const laneY = y + lane * deviceHeight;
              const path = side
                ? `M ${FRONT_X + DEVICE_WIDTH * 0.5} ${laneY - Math.min(13, deviceHeight * 0.3)} C ${FRONT_X + DEVICE_WIDTH * 0.62} ${laneY - 5}, ${FRONT_X + DEVICE_WIDTH * 0.38} ${laneY + 5}, ${FRONT_X + DEVICE_WIDTH * 0.5} ${laneY + Math.min(13, deviceHeight * 0.3)}`
                : reverse
                  ? `M ${FRONT_X + DEVICE_WIDTH + 17} ${laneY} C ${FRONT_X + DEVICE_WIDTH * 0.72} ${laneY - 3}, ${FRONT_X + DEVICE_WIDTH * 0.28} ${laneY + 3}, ${FRONT_X - 17} ${laneY}`
                  : `M ${FRONT_X - 17} ${laneY} C ${FRONT_X + DEVICE_WIDTH * 0.28} ${laneY - 3}, ${FRONT_X + DEVICE_WIDTH * 0.72} ${laneY + 3}, ${FRONT_X + DEVICE_WIDTH + 17} ${laneY}`;
              const duration = (2.2 + Math.min(1.8, heatW / 2500)) * durationScale;
              return (
                <g key={laneIndex}>
                  <path
                    d={path}
                    fill="none"
                    stroke={reverse ? 'url(#airflow-gradient-reverse)' : side ? '#6f9f7f' : 'url(#airflow-gradient)'}
                    strokeWidth="1.35"
                    strokeDasharray="4 6"
                    strokeLinecap="round"
                    className="animate-flow"
                    style={{ animationDuration: `${duration}s`, animationPlayState: animationEnabled ? 'running' : 'paused' }}
                    markerEnd={reverse ? 'url(#flow-arrow-reverse)' : side ? 'url(#flow-arrow)' : 'url(#flow-arrow)'}
                  />
                  {[0, 1].map((particle) => animationEnabled ? (
                    <circle key={particle} r="3.1" fill="url(#airflow-particle)" filter="url(#particle-glow)">
                      <animateMotion dur={`${duration}s`} begin={`${-particle * duration / 2 - laneIndex * 0.33}s`} repeatCount="indefinite" path={path} />
                    </circle>
                  ) : (
                    <circle key={particle} r="2.2" fill={reverse ? '#cf8b52' : '#8fd8ff'} opacity="0.75" cx={FRONT_X + DEVICE_WIDTH * (reverse ? 0.78 - particle * 0.5 : 0.22 + particle * 0.5)} cy={laneY} />
                  ))}
                </g>
              );
            })}
            {deviceHeight >= 52 && (
              <text x={FRONT_X + DEVICE_WIDTH - 7} y={y - deviceHeight * 0.29} fill="#9fb2c8" fontSize="6.5" textAnchor="end" fontFamily="monospace">
                IN {rack.ambientC.toFixed(1)}° → OUT {telemetry && Number.isFinite(telemetry.localTempC) ? telemetry.localTempC.toFixed(1) : rack.ambientC.toFixed(1)}°
              </text>
            )}
          </g>
        );
      })}

      {result.recirculationGaps.slice(0, 4).map((gap) => {
        const y = RACK_TOP + (rack.heightU - gap.startU - gap.size / 2) * U_PX;
        const path = `M ${FRONT_X + DEVICE_WIDTH + 18} ${y} C 477 ${y - 16}, 477 ${y + 16}, 448 ${y + 12} L 84 ${y + 12} C 62 ${y + 12}, 62 ${y}, 84 ${y}`;
        const duration = 3.4 * durationScale;
        return (
          <g key={gap.startU}>
            <path d={path} fill="none" stroke="#d46565" strokeWidth="1.4" strokeDasharray="5 5" opacity="0.75" className="animate-flow" style={{ animationDuration: `${duration}s`, animationPlayState: animationEnabled ? 'running' : 'paused' }} markerEnd="url(#flow-arrow-reverse)" />
            {animationEnabled && <circle r="3.4" fill="#d46565" filter="url(#particle-glow)"><animateMotion dur={`${duration}s`} repeatCount="indefinite" path={path} /></circle>}
            <text x="474" y={y - 5} fill="#d46565" fontSize="6.5" textAnchor="end" fontFamily="monospace">RECIRC {gap.size}U</text>
          </g>
        );
      })}

      {result.bypassRiskPct > 8 && (
        <g>
          <path d={`M 76 27 C 180 14, 322 14, 424 27`} fill="none" stroke="#6f93b8" strokeWidth="1.2" strokeDasharray="3 6" opacity="0.55" className="animate-flow" style={{ animationDuration: `${2.8 * durationScale}s`, animationPlayState: animationEnabled ? 'running' : 'paused' }} markerEnd="url(#flow-arrow)" />
          {animationEnabled && <circle r="2.8" fill="#8fc5ff" filter="url(#particle-glow)"><animateMotion dur={`${2.8 * durationScale}s`} repeatCount="indefinite" path="M 76 27 C 180 14, 322 14, 424 27" /></circle>}
        </g>
      )}
    </g>
  );
}
