import { CircleGauge, Fan, Weight, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RackConfig, SimulationResult } from '../types';

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative min-h-[94px] min-w-0 overflow-hidden border-b border-line bg-panel/80 p-3 sm:border-b-0 sm:border-r sm:last:border-r-0 ${className}`}>{children}</div>;
}

function CardHeading({ icon, label, detail }: { icon: ReactNode; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted">{icon}</span>
      <p className="truncate text-[8px] font-bold uppercase tracking-[0.13em] text-muted">{label}</p>
      {detail && <span className="ml-auto hidden truncate font-mono text-[8px] text-muted sm:inline">{detail}</span>}
    </div>
  );
}

function CapacityRing({ value, color }: { value: number; color: string }) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90">
      <circle cx="21" cy="21" r={radius} fill="none" stroke="#233043" strokeWidth="3" />
      <circle cx="21" cy="21" r={radius} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} className="transition-all duration-500" />
    </svg>
  );
}

function MiniRack({ fillPct, markerPct, mode }: { fillPct: number; markerPct?: number; mode: 'weight' | 'capacity' }) {
  const safeFillPct = Math.max(0, Math.min(100, Number.isFinite(fillPct) ? fillPct : 0));
  const safeMarkerPct = markerPct === undefined ? undefined : Math.max(0, Math.min(100, Number.isFinite(markerPct) ? markerPct : 0));
  return (
    <div className="relative h-11 w-7 rounded-[3px] border border-[#40536a] bg-ink p-[3px]">
      <div className="flex h-full flex-col-reverse gap-[2px]">
        {Array.from({ length: 6 }, (_, index) => {
          const filled = (index + 1) / 6 <= safeFillPct / 100;
          return <span key={index} className={`flex-1 rounded-[1px] ${filled ? mode === 'weight' ? 'bg-electric/55' : 'bg-accent/55' : 'bg-line/50'}`} />;
        })}
      </div>
      {safeMarkerPct !== undefined && <span className="absolute -left-1 -right-1 h-px bg-warning shadow-[0_0_6px_rgba(247,185,85,.6)]" style={{ bottom: `${Math.min(96, Math.max(2, safeMarkerPct))}%` }} />}
    </div>
  );
}

export function TelemetryBento({ rack, result }: { rack: RackConfig; result: SimulationResult }) {
  const thermalColor = result.thermalLoadPct >= 100 ? '#d46565' : result.thermalLoadPct >= 80 ? '#d6a34c' : '#6f9f7f';
  const totalFeedW = result.pduA.typicalW + result.pduB.typicalW;
  const feedAPct = totalFeedW > 0 ? (result.pduA.typicalW / totalFeedW) * 100 : 50;
  const weightPct = (result.totalWeightKg / rack.staticRatingKg) * 100;

  return (
    <div className="grid shrink-0 grid-cols-2 border-b border-line bg-panel 2xl:grid-cols-4">
      <Card>
        <CardHeading icon={<Zap size={12} className="text-warning" />} label="Rack power" detail={rack.redundancy} />
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-lg font-semibold leading-none text-white">{(result.typicalW / 1000).toFixed(2)} <span className="text-[10px] font-normal text-muted">kW</span></p>
            <p className="mt-1.5 truncate font-mono text-[8px] text-muted">{(result.peakW / 1000).toFixed(2)}kW peak · ${result.monthlyCost.toFixed(0)}/mo</p>
          </div>
        </div>
        <div className="mt-2.5 flex h-1 overflow-hidden rounded-full bg-line/70">
          <span className="bg-electric transition-all duration-500" style={{ width: `${feedAPct}%` }} />
          <span className="bg-accent transition-all duration-500" style={{ width: `${100 - feedAPct}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[7px] text-muted"><span>A · {(result.pduA.typicalW / 1000).toFixed(2)}kW</span><span>B · {(result.pduB.typicalW / 1000).toFixed(2)}kW</span></div>
      </Card>

      <Card>
        <CardHeading icon={<Fan size={12} className="text-accent" />} label="Thermal load" detail={`${Math.round(result.estimatedAirflowCfm).toLocaleString()} CFM`} />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-lg font-semibold leading-none" style={{ color: thermalColor }}>{result.thermalLoadPct.toFixed(0)}<span className="text-[10px] font-normal text-muted">%</span></p>
            <p className="mt-1.5 truncate font-mono text-[8px] text-muted">{result.averageExhaustC.toFixed(1)}°C exhaust</p>
            <p className="mt-1 truncate font-mono text-[7px] text-muted">{result.heatKw.toFixed(2)} / {result.availableCoolingKw.toFixed(2)}kW cooling</p>
          </div>
          <CapacityRing value={result.thermalLoadPct} color={thermalColor} />
        </div>
      </Card>

      <Card>
        <CardHeading icon={<Weight size={12} className="text-electric" />} label="Installed weight" detail={`${rack.rollingRatingKg}kg rolling`} />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className={`truncate font-mono text-lg font-semibold leading-none ${weightPct > 100 ? 'text-danger' : 'text-white'}`}>{result.totalWeightKg.toFixed(1)} <span className="text-[10px] font-normal text-muted">kg</span></p>
            <p className="mt-1.5 truncate font-mono text-[8px] text-muted">CoG · {result.centerOfGravityPct.toFixed(0)}% height</p>
            <p className="mt-1 truncate font-mono text-[7px] text-muted">{(rack.staticRatingKg - result.totalWeightKg).toFixed(0)}kg static headroom</p>
          </div>
          <MiniRack fillPct={Math.min(100, weightPct)} markerPct={result.centerOfGravityPct} mode="weight" />
        </div>
      </Card>

      <Card>
        <CardHeading icon={<CircleGauge size={12} className="text-muted" />} label="U-space capacity" detail={`${rack.heightU}U enclosure`} />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-lg font-semibold leading-none text-white">{result.occupiedU}<span className="text-[10px] font-normal text-muted"> / {rack.heightU}U</span></p>
            <p className="mt-1.5 truncate font-mono text-[8px] text-muted">{result.utilizationPct.toFixed(0)}% occupied</p>
            <p className="mt-1 truncate font-mono text-[7px] text-muted">{result.activeDevices.length} active · {result.recirculationGaps.length} open gaps</p>
          </div>
          <MiniRack fillPct={result.utilizationPct} mode="capacity" />
        </div>
      </Card>
    </div>
  );
}
