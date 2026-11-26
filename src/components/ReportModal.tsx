import { Clipboard, Download, Printer } from 'lucide-react';
import { Modal, StatusBadge } from './ui';
import type { HardwareTemplate, RackConfig, SimulationResult, PlacedDevice } from '../types';

export function ReportModal({ rack, devices, catalog, result, onClose, onNotify }: { rack: RackConfig; devices: PlacedDevice[]; catalog: HardwareTemplate[]; result: SimulationResult; onClose: () => void; onNotify: (message: string) => void }) {
  const hardwareById = new Map(catalog.map((item) => [item.id, item]));
  const sorted = [...devices].sort((a, b) => b.startU - a.startU || a.mount.localeCompare(b.mount));
  const summary = [
    `RACKFORGE CAPACITY REPORT — ${rack.name}`,
    `${rack.heightU}U ${rack.widthMm}×${rack.depthMm}mm ${rack.form} · ${rack.redundancy} power`,
    '',
    `Power: ${result.typicalW.toFixed(0)}W typical / ${result.peakW.toFixed(0)}W peak`,
    `Heat: ${Math.round(result.heatBtuHr)} BTU/hr · ${result.heatKw.toFixed(2)} kW`,
    `Energy: ${result.monthlyKwh.toFixed(0)} kWh/month · $${result.monthlyCost.toFixed(2)}/month`,
    `Weight: ${result.totalWeightKg.toFixed(1)}kg · CoG ${result.centerOfGravityPct.toFixed(0)}%`,
    `Capacity: ${result.occupiedU}/${rack.heightU}U (${result.utilizationPct.toFixed(0)}%)`,
    `Cooling: ${result.thermalLoadPct.toFixed(0)}% allocated · ${result.averageExhaustC.toFixed(1)}°C estimated exhaust`,
    `Airflow: ${result.airflowEfficiencyPct.toFixed(0)}% efficiency · ${result.recirculationRiskPct.toFixed(0)}% recirculation risk · ${result.bypassRiskPct.toFixed(0)}% bypass risk`,
    '',
    'ADVISORIES',
    ...result.warnings.map((warning) => `[${warning.severity.toUpperCase()}] ${warning.title}: ${warning.detail}`),
    '',
    'INSTALLED EQUIPMENT',
    ...sorted.map((device) => {
      const hardware = hardwareById.get(device.hardwareId);
      return `${device.mount === 'vertical' ? `0U ${device.side}` : `U${device.startU + 1}`} · ${device.overrides?.label ?? hardware?.name ?? device.hardwareId} · PDU ${device.pdu} · ${device.status}`;
    }),
  ].join('\n');

  const download = () => {
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${rack.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    onNotify('Capacity report downloaded.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      onNotify('Report summary copied to clipboard.');
    } catch {
      onNotify('Clipboard unavailable. Download the report instead.');
    }
  };

  return (
    <Modal title="Rack capacity report" eyebrow="Planning summary & engineering advisories" onClose={onClose} wide>
      <div id="print-report" className="bg-white p-6 text-slate-900 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-900 pb-5">
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-slate-700">RackForge · Capacity report</p>
            <h2 className="mt-2 text-2xl font-bold">{rack.name}</h2>
            <p className="mt-1 text-xs text-slate-600">{rack.heightU}U · {rack.widthMm} × {rack.depthMm}mm · {rack.form.replace('-', ' ')} · {rack.voltage}V {rack.phases === 3 ? 'three-phase' : 'single-phase'}</p>
          </div>
          <div className="text-right">
            <StatusBadge severity={result.severity} />
            <p className="mt-2 font-mono text-[9px] text-slate-500">{new Date().toLocaleDateString()} · {rack.redundancy} power</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {[
            ['Typical power', `${(result.typicalW / 1000).toFixed(2)} kW`, `${result.peakW.toFixed(0)}W peak`],
            ['Heat output', `${Math.round(result.heatBtuHr).toLocaleString()} BTU/h`, `${result.heatKw.toFixed(2)} kW`],
            ['Installed weight', `${result.totalWeightKg.toFixed(1)} kg`, `${rack.staticRatingKg}kg rated`],
            ['U-space', `${result.occupiedU} / ${rack.heightU}U`, `${result.utilizationPct.toFixed(0)}% occupied`],
            ['Monthly energy', `${result.monthlyKwh.toFixed(0)} kWh`, `$${result.monthlyCost.toFixed(2)} estimated`],
            ['Annual energy', `${result.annualKwh.toFixed(0)} kWh`, `$${result.annualCost.toFixed(2)} estimated`],
            ['Cooling load', `${result.thermalLoadPct.toFixed(0)}%`, `${result.averageExhaustC.toFixed(1)}°C exhaust`],
            ['Center of gravity', `${result.centerOfGravityPct.toFixed(0)}%`, `${result.centerOfGravityMm.toFixed(0)}mm from base`],
          ].map(([label, value, detail]) => (
            <div key={label} className="bg-slate-50 p-3"><p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-mono text-sm font-bold">{value}</p><p className="mt-0.5 text-[9px] text-slate-500">{detail}</p></div>
          ))}
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <section>
            <h3 className="border-b border-slate-300 pb-2 text-[11px] font-bold uppercase tracking-wider">Power distribution</h3>
            <div className="mt-3 space-y-3">
              {[result.pduA, result.pduB].map((pdu) => (
                <div key={pdu.feed} className="rounded border border-slate-200 p-3">
                  <div className="flex justify-between text-xs font-semibold"><span>PDU {pdu.feed} · {pdu.breakerAmps}A</span><span>{pdu.loadPercent.toFixed(0)}% typical</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full ${pdu.severity === 'critical' ? 'bg-red-500' : pdu.severity === 'warning' ? 'bg-amber-500' : 'bg-slate-600'}`} style={{ width: `${Math.min(100, pdu.loadPercent)}%` }} /></div>
                  <p className="mt-2 font-mono text-[9px] text-slate-600">{pdu.typicalW.toFixed(0)}W typical · {pdu.peakW.toFixed(0)}W peak · {pdu.amps.toFixed(1)}A / phase</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-600">{result.redundancyNote}</p>
          </section>
          <section>
            <h3 className="border-b border-slate-300 pb-2 text-[11px] font-bold uppercase tracking-wider">Engineering advisories</h3>
            <div className="mt-3 space-y-2">
              {result.warnings.map((warning) => (
                <div key={warning.id} className={`rounded border p-2.5 ${warning.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <p className="text-[10px] font-bold">{warning.title}</p><p className="mt-1 text-[9px] leading-relaxed text-slate-600">{warning.detail}</p>
                </div>
              ))}
              {result.warnings.length === 0 && <p className="rounded border border-slate-300 bg-slate-50 p-3 text-[10px] text-slate-700">No active warnings. All modeled limits are within configured thresholds.</p>}
            </div>
          </section>
        </div>

        <section className="mt-6">
          <h3 className="border-b border-slate-300 pb-2 text-[11px] font-bold uppercase tracking-wider">Rack elevation schedule</h3>
          <table className="mt-2 w-full border-collapse text-left text-[9px]">
            <thead><tr className="bg-slate-100 text-[8px] uppercase tracking-wider text-slate-500"><th className="px-2 py-2">Position</th><th className="px-2 py-2">Equipment</th><th className="px-2 py-2">Mount</th><th className="px-2 py-2">Feed</th><th className="px-2 py-2">Typical</th><th className="px-2 py-2">Weight</th></tr></thead>
            <tbody>
              {sorted.map((device) => {
                const hardware = hardwareById.get(device.hardwareId);
                const telemetry = result.telemetry.find((item) => item.instanceId === device.instanceId);
                return <tr key={device.instanceId} className="border-b border-slate-100"><td className="px-2 py-1.5 font-mono">{device.mount === 'vertical' ? `0U ${device.side}` : `U${device.startU + 1}–${device.startU + (hardware?.uHeight ?? 0)}`}</td><td className="px-2 py-1.5 font-medium">{device.overrides?.label ?? hardware?.name ?? device.hardwareId}</td><td className="px-2 py-1.5 capitalize">{device.mount}</td><td className="px-2 py-1.5">{device.pdu}</td><td className="px-2 py-1.5 font-mono">{telemetry?.typicalW ?? 0}W</td><td className="px-2 py-1.5 font-mono">{telemetry?.weightKg ?? 0}kg</td></tr>;
              })}
            </tbody>
          </table>
        </section>
        <p className="mt-5 border-t border-slate-200 pt-3 text-[8px] leading-relaxed text-slate-500">Estimates are for planning and comparison, not a substitute for site-specific electrical, structural, or CFD validation. Heat output assumes typical electrical draw is dissipated in the rack. Continuous-load guidance uses 80% of breaker rating.</p>
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line bg-panel2 px-5 py-3">
        <p className="text-[9px] text-muted">Print-ready layout · plain-text summary · local data only</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={copy} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] text-muted hover:text-white"><Clipboard size={13} /> Copy</button>
          <button onClick={download} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[11px] text-muted hover:text-white"><Download size={13} /> Download</button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[11px] font-bold text-ink"><Printer size={13} /> Print report</button>
        </div>
      </div>
    </Modal>
  );
}
