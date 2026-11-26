import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle, ArrowRight, BatteryCharging, CircleDollarSign, Fan, Gauge,
  Ruler, Thermometer, Weight, Wind, Zap,
} from 'lucide-react';
import type { FanProfile, RackConfig, SimulationResult } from '../types';
import { EmptyState, inputClass, StatusBadge } from './ui';

function Meter({ value, max = 100, warning = 80, critical = 100 }: { value: number; max?: number; warning?: number; critical?: number }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  const color = safeValue >= critical ? 'bg-danger' : safeValue >= warning ? 'bg-warning' : 'bg-success';
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-line/70">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function NumericField({ label, value, onCommit, min, max, step = 1, className = '' }: { label: string; value: number; onCommit: (value: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const raw = draft.trim();
    if (!raw) { setDraft(String(value)); return; }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) { setDraft(String(value)); return; }
    const lower = min ?? Number.NEGATIVE_INFINITY;
    const upper = max ?? Number.POSITIVE_INFINITY;
    const next = Math.max(lower, Math.min(upper, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] text-muted">{label}</span>
      <input
        type="number" min={min} max={max} step={step} value={draft} aria-label={label}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') { setDraft(String(value)); event.currentTarget.blur(); }
        }}
        className={`${inputClass} h-8 font-mono text-xs ${className}`}
      />
    </label>
  );
}

function SectionTitle({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return <div className="mb-2.5 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{icon}{title}</h3>{right}</div>;
}

export function TelemetryPanel({
  rack,
  result,
  onRackPatch,
  onSelectDevice,
}: {
  rack: RackConfig;
  result: SimulationResult;
  onRackPatch: (patch: Partial<RackConfig>) => void;
  onSelectDevice: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
      <div className={`rounded-xl border p-3 ${result.severity === 'critical' ? 'border-danger/30 bg-danger/[0.06]' : result.severity === 'warning' ? 'border-warning/30 bg-warning/[0.05]' : 'border-accent/25 bg-accent/[0.05]'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted">System health</p>
            <p className="mt-1 text-sm font-semibold text-white">{result.warnings.length === 0 ? 'All checks within limits' : `${result.warnings.length} active ${result.warnings.length === 1 ? 'advisory' : 'advisories'}`}</p>
          </div>
          <StatusBadge severity={result.severity} />
        </div>
      </div>

      <section>
        <SectionTitle icon={<Zap size={12} className="text-warning" />} title="Power budget" right={<span className="font-mono text-[10px] text-white">{(result.typicalW / 1000).toFixed(2)} kW</span>} />
        <div className="rounded-xl border border-line bg-panel2 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[9px] text-muted">Typical / peak</p><p className="mt-1 font-mono text-sm font-semibold text-white">{result.typicalW.toFixed(0)} <span className="text-[9px] font-normal text-muted">/ {result.peakW.toFixed(0)} W</span></p></div>
            <div><p className="text-[9px] text-muted">Heat output</p><p className="mt-1 font-mono text-sm font-semibold text-white">{Math.round(result.heatBtuHr).toLocaleString()} <span className="text-[9px] font-normal text-muted">BTU/h</span></p></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-[10px]">
            <span className="flex items-center gap-1.5 text-muted"><CircleDollarSign size={12} /> ${result.monthlyCost.toFixed(0)}/mo</span>
            <span className="flex items-center gap-1.5 text-muted"><BatteryCharging size={12} /> {Math.round(result.annualKwh).toLocaleString()} kWh/yr</span>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Zap size={12} className="text-warning" />} title={`Dual-feed · ${rack.redundancy}`} />
        <div className="space-y-2">
          {[result.pduA, result.pduB].map((pdu) => (
            <div key={pdu.feed} className="rounded-xl border border-line bg-panel2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-[11px] font-semibold text-white"><span className={`flex h-5 w-5 items-center justify-center rounded font-mono text-[9px] ${pdu.feed === 'A' ? 'bg-electric/15 text-electric' : 'bg-accent/15 text-accent'}`}>{pdu.feed}</span> PDU {pdu.feed}</span>
                <span className={`font-mono text-[10px] ${pdu.severity === 'critical' ? 'text-danger' : pdu.severity === 'warning' ? 'text-warning' : 'text-accent'}`}>{pdu.loadPercent.toFixed(0)}%</span>
              </div>
              <Meter value={pdu.loadPercent} />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-muted"><span>{(pdu.typicalW / 1000).toFixed(2)}kW · {pdu.amps.toFixed(1)}A</span><span>{pdu.breakerAmps}A breaker</span></div>
              {pdu.peakPercent > pdu.loadPercent + 5 && <p className="mt-1.5 text-[9px] text-warning">Peak projection: {pdu.peakPercent.toFixed(0)}% ({pdu.peakAmps.toFixed(1)}A)</p>}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9px] leading-relaxed text-muted">{result.redundancyNote}</p>
      </section>

      <section>
        <SectionTitle icon={<Fan size={12} className="text-accent" />} title="Thermal envelope" right={<StatusBadge severity={result.thermalLoadPct >= 100 ? 'critical' : result.thermalLoadPct >= 80 ? 'warning' : 'ok'} />} />
        <div className="rounded-xl border border-line bg-panel2 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="flex items-center gap-1 text-[9px] text-muted"><Thermometer size={10} /> Exhaust avg.</p><p className="mt-1 font-mono text-sm font-semibold text-white">{result.averageExhaustC.toFixed(1)}°C</p></div>
            <div><p className="flex items-center gap-1 text-[9px] text-muted"><Gauge size={10} /> Max local</p><p className={`mt-1 font-mono text-sm font-semibold ${result.maxDeviceTempC >= 40 ? 'text-danger' : result.maxDeviceTempC >= 32 ? 'text-warning' : 'text-white'}`}>{result.maxDeviceTempC.toFixed(1)}°C</p></div>
          </div>
          <div className="mt-3"><div className="mb-1.5 flex justify-between text-[9px] text-muted"><span>Cooling allocation</span><span>{result.heatKw.toFixed(2)} / {result.availableCoolingKw.toFixed(2)} kW</span></div><Meter value={result.thermalLoadPct} /></div>
          <p className="mt-2 font-mono text-[9px] text-muted">~{Math.round(result.estimatedAirflowCfm).toLocaleString()} CFM required · {rack.ambientC}°C intake</p>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Wind size={12} className="text-electric" />} title="Airflow analysis" right={<span className="font-mono text-[10px] text-accent">{result.airflowEfficiencyPct.toFixed(0)}% efficient</span>} />
        <div className="space-y-3 rounded-xl border border-line bg-panel2 p-3">
          <div>
            <div className="mb-1.5 flex justify-between text-[9px]"><span className="text-muted">Recirculation risk</span><span className={`font-mono ${result.recirculationRiskPct >= 50 ? 'text-danger' : result.recirculationRiskPct >= 25 ? 'text-warning' : 'text-white'}`}>{result.recirculationRiskPct.toFixed(0)}%</span></div>
            <Meter value={result.recirculationRiskPct} warning={25} critical={50} />
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-[9px]"><span className="text-muted">Bypass risk</span><span className={`font-mono ${result.bypassRiskPct >= 50 ? 'text-danger' : result.bypassRiskPct >= 25 ? 'text-warning' : 'text-white'}`}>{result.bypassRiskPct.toFixed(0)}%</span></div>
            <Meter value={result.bypassRiskPct} warning={25} critical={50} />
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2.5 font-mono text-[9px] text-muted"><span className="flex items-center gap-1"><Fan size={10} /> {Math.round(result.estimatedAirflowCfm).toLocaleString()} CFM</span><span>{result.recirculationGaps.length} open gaps</span></div>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Weight size={12} className="text-electric" />} title="Structural capacity" />
        <div className="space-y-3 rounded-xl border border-line bg-panel2 p-3">
          <div><div className="mb-1.5 flex justify-between text-[9px]"><span className="text-muted">Installed weight</span><span className="font-mono text-white">{result.totalWeightKg.toFixed(1)} / {rack.staticRatingKg} kg</span></div><Meter value={result.totalWeightKg} max={rack.staticRatingKg} /></div>
          <div><div className="mb-1.5 flex justify-between text-[9px]"><span className="text-muted">Center of gravity</span><span className={`font-mono ${result.centerOfGravityPct > 68 ? 'text-warning' : 'text-white'}`}>{result.centerOfGravityPct.toFixed(0)}% height</span></div><Meter value={result.centerOfGravityPct} warning={68} critical={78} /></div>
          <div><div className="mb-1.5 flex justify-between text-[9px]"><span className="flex items-center gap-1 text-muted"><Ruler size={10} /> U-space</span><span className="font-mono text-white">{result.occupiedU} / {rack.heightU}U</span></div><Meter value={result.utilizationPct} /></div>
        </div>
      </section>

      <section>
        <SectionTitle icon={<AlertTriangle size={12} className="text-warning" />} title="Advisories" right={<span className="font-mono text-[9px] text-muted">{result.warnings.length}</span>} />
        <div className="space-y-2">
          {result.warnings.map((warning) => (
            <button key={warning.id} onClick={() => warning.deviceId && onSelectDevice(warning.deviceId)} disabled={!warning.deviceId} className={`w-full rounded-lg border p-2.5 text-left transition ${warning.deviceId ? 'hover:bg-white/[0.03]' : 'cursor-default'} ${warning.severity === 'critical' ? 'border-danger/20 bg-danger/[0.04]' : 'border-warning/20 bg-warning/[0.04]'}`}>
              <div className="flex items-start gap-2">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${warning.severity === 'critical' ? 'bg-danger' : 'bg-warning'}`} />
                <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold leading-4 text-white">{warning.title}</p><p className="mt-1 text-[9px] leading-relaxed text-muted">{warning.detail}</p></div>
                {warning.deviceId && <ArrowRight size={11} className="mt-1 shrink-0 text-muted" />}
              </div>
            </button>
          ))}
          {result.warnings.length === 0 && <EmptyState icon={<Gauge size={18} />} title="No active warnings" detail="Power, thermal, structural, and airflow checks are all within the configured limits." />}
        </div>
      </section>

      <section className="border-t border-line pt-4">
        <SectionTitle icon={<Fan size={12} className="text-accent" />} title="Facility controls" />
        <div className="grid grid-cols-2 gap-2">
          <NumericField label="Ambient °C" value={rack.ambientC} min={-10} max={50} onCommit={(ambientC) => onRackPatch({ ambientC })} />
          <NumericField label="Cooling kW" value={rack.coolingKw} min={0.5} max={100} step={0.5} onCommit={(coolingKw) => onRackPatch({ coolingKw })} />
          <label className="block"><span className="mb-1 block text-[9px] text-muted">Fan profile</span><select value={rack.fanProfile} onChange={(event) => onRackPatch({ fanProfile: event.target.value as FanProfile })} aria-label="Fan profile" className={`${inputClass} h-8 text-xs`}><option value="eco">Eco · 82%</option><option value="balanced">Balanced · 100%</option><option value="max">Max · 118%</option></select></label>
          <NumericField label="$/kWh" value={rack.electricityRate} min={0} max={5} step={0.01} onCommit={(electricityRate) => onRackPatch({ electricityRate })} />
        </div>
      </section>
    </div>
  );
}
