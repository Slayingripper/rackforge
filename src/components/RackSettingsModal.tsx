import { useMemo, useState } from 'react';
import { AlertTriangle, Plus, Save, Trash2 } from 'lucide-react';
import { Field, Modal, Toggle, inputClass } from './ui';
import { RACK_CABLE_CLEARANCE_MM } from '../lib/simulation';
import type { FanProfile, HardwareTemplate, PlacedDevice, RackConfig, RackForm, RackZone } from '../types';

interface RackSettingsModalProps {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  onSave: (rack: RackConfig) => void;
  onClose: () => void;
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function numericValue(value: number): number | '' {
  return Number.isFinite(value) ? value : '';
}

export function RackSettingsModal({ rack, devices, catalog, onSave, onClose }: RackSettingsModalProps) {
  const [draft, setDraft] = useState<RackConfig>(() => structuredClone(rack));
  const [zoneDraft, setZoneDraft] = useState({ name: 'Clearance zone', startU: 0, endU: 1, kind: 'reserved' as RackZone['kind'] });
  const [error, setError] = useState('');
  const hardwareById = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const patch = (value: Partial<RackConfig>) => { setDraft((current) => ({ ...current, ...value })); setError(''); };

  const addZone = () => {
    const startU = Number.isFinite(zoneDraft.startU) ? Math.floor(zoneDraft.startU) : -1;
    const endU = Number.isFinite(zoneDraft.endU) ? Math.floor(zoneDraft.endU) : -1;
    if (!zoneDraft.name.trim() || startU < 0 || endU > draft.heightU || endU <= startU || endU < 0) {
      setError('Zone must have a name and a valid U range inside the rack.');
      return;
    }
    if (draft.zones.some((zone) => startU < zone.endU && endU > zone.startU)) {
      setError('This zone overlaps an existing reserved or blocked zone.');
      return;
    }
    patch({ zones: [...draft.zones, { ...zoneDraft, startU, endU, id: `zone-${Date.now()}` }] });
    setZoneDraft((current) => ({ ...current, startU: Math.min(draft.heightU - 1, endU), endU: Math.min(draft.heightU, endU + 1) }));
  };

  const save = () => {
    let requiredU = 0;
    let requiredDepth = 0;
    for (const device of devices) {
      const hardware = hardwareById.get(device.hardwareId);
      if (!hardware || device.mount === 'vertical') continue;
      requiredU = Math.max(requiredU, device.startU + hardware.uHeight);
      requiredDepth = Math.max(requiredDepth, hardware.depthMm + RACK_CABLE_CLEARANCE_MM);
    }
    if (draft.heightU < requiredU) {
      setError(`Rack height cannot be reduced below ${requiredU}U while equipment is installed.`);
      return;
    }
    if (draft.depthMm < requiredDepth) {
      setError(`Installed equipment requires at least ${requiredDepth}mm rack depth including cable clearance.`);
      return;
    }
    for (const zone of draft.zones) {
      if (zone.startU < 0 || zone.endU > draft.heightU || zone.endU <= zone.startU) {
        setError(`${zone.name} has an invalid U range.`);
        return;
      }
      const collision = devices.some((device) => {
        const hardware = hardwareById.get(device.hardwareId);
        return hardware && device.mount !== 'vertical' && zone.startU < device.startU + hardware.uHeight && zone.endU > device.startU;
      });
      if (collision) {
        setError(`${zone.name} overlaps installed equipment. Move the equipment or adjust the zone.`);
        return;
      }
    }
    if (!Number.isFinite(draft.ambientC) || !Number.isFinite(draft.coolingKw) || draft.coolingKw <= 0) {
      setError('Ambient intake must be numeric and cooling capacity must be greater than zero.');
      return;
    }
    if (!Number.isFinite(draft.electricityRate) || draft.electricityRate < 0) {
      setError('Electricity rate must be a non-negative number.');
      return;
    }
    if (![draft.circuitAAmps, draft.circuitBAmps].every((value) => Number.isFinite(value) && value >= 0)) {
      setError('Breaker ratings must be non-negative finite numbers.');
      return;
    }
    if (!Number.isFinite(draft.staticRatingKg) || !Number.isFinite(draft.rollingRatingKg) || draft.staticRatingKg < 0 || draft.rollingRatingKg < 0) {
      setError('Load ratings must be non-negative finite numbers.');
      return;
    }
    if (draft.rollingRatingKg > draft.staticRatingKg) {
      setError('Rolling load rating cannot exceed the static load rating.');
      return;
    }
    const name = draft.name.trim();
    if (!name) { setError('Enter a rack name.'); return; }
    const cleaned: RackConfig = {
      ...draft,
      name,
      ambientC: finite(draft.ambientC, 22),
      coolingKw: finite(draft.coolingKw, 8),
      electricityRate: finite(draft.electricityRate, 0.18),
      circuitAAmps: finite(draft.circuitAAmps, 20),
      circuitBAmps: finite(draft.circuitBAmps, 20),
      staticRatingKg: finite(draft.staticRatingKg, 1000),
      rollingRatingKg: finite(draft.rollingRatingKg, draft.staticRatingKg),
    };
    onSave(cleaned);
  };

  return (
    <Modal title="Rack & facility configuration" eyebrow="Engineering parameters" onClose={onClose} wide>
      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div className="space-y-6 p-5">
          <section>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">01 · Enclosure</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Rack name"><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} className={inputClass} /></Field>
              <Field label="Height"><select value={draft.heightU} onChange={(event) => patch({ heightU: Number(event.target.value) as RackConfig['heightU'] })} className={inputClass}>{[12, 24, 42, 48].map((u) => <option key={u} value={u}>{u}U</option>)}</select></Field>
              <Field label="External width"><select value={draft.widthMm} onChange={(event) => patch({ widthMm: Number(event.target.value) as RackConfig['widthMm'] })} className={inputClass}><option value={600}>600 mm</option><option value={800}>800 mm</option></select></Field>
              <Field label="External depth"><select value={draft.depthMm} onChange={(event) => patch({ depthMm: Number(event.target.value) as RackConfig['depthMm'] })} className={inputClass}>{[800, 1000, 1200].map((d) => <option key={d} value={d}>{d} mm</option>)}</select></Field>
              <Field label="Frame type"><select value={draft.form} onChange={(event) => patch({ form: event.target.value as RackForm })} className={inputClass}><option value="enclosed">Enclosed cabinet</option><option value="open-4post">Open-frame 4-post</option><option value="open-2post">Open-frame 2-post</option></select></Field>
              <div className="flex items-end justify-between rounded-lg border border-line bg-ink px-3 py-2"><span className="text-[11px] text-muted">Perforated doors</span><Toggle checked={draft.perforatedDoors} onChange={(perforatedDoors) => patch({ perforatedDoors })} label="Perforated doors" /></div>
              <div className="flex items-end justify-between rounded-lg border border-line bg-ink px-3 py-2"><span className="text-[11px] text-muted">Side panels</span><Toggle checked={draft.sidePanels} onChange={(sidePanels) => patch({ sidePanels })} label="Side panels" /></div>
              <div className="rounded-lg border border-line bg-ink px-3 py-2 text-[9px] leading-relaxed text-muted">Usable depth reserves <span className="font-mono text-white">{RACK_CABLE_CLEARANCE_MM}mm</span> for rails, plugs, and cable bend radius.</div>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-warning">02 · Electrical & redundancy</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Voltage"><select value={draft.voltage} onChange={(event) => patch({ voltage: Number(event.target.value) as RackConfig['voltage'] })} className={inputClass}>{[120, 208, 230, 240].map((v) => <option key={v} value={v}>{v}V</option>)}</select></Field>
              <Field label="Phase"><select value={draft.phases} onChange={(event) => patch({ phases: Number(event.target.value) as 1 | 3 })} className={inputClass}><option value={1}>Single phase</option><option value={3}>Three phase</option></select></Field>
              <Field label="PDU A breaker"><select value={draft.circuitAAmps} onChange={(event) => patch({ circuitAAmps: Number(event.target.value) })} className={inputClass}>{[15, 20, 30, 40, 60].map((a) => <option key={a} value={a}>{a}A</option>)}</select></Field>
              <Field label="PDU B breaker"><select value={draft.circuitBAmps} onChange={(event) => patch({ circuitBAmps: Number(event.target.value) })} className={inputClass}>{[15, 20, 30, 40, 60].map((a) => <option key={a} value={a}>{a}A</option>)}</select></Field>
              <Field label="Redundancy model"><select value={draft.redundancy} onChange={(event) => patch({ redundancy: event.target.value as RackConfig['redundancy'] })} className={inputClass}><option value="N">N · no redundancy</option><option value="N+1">N+1 · one feed survives</option><option value="2N">2N · dual full capacity</option></select></Field>
              <Field label="Electricity rate" hint="$/kWh"><input type="number" min={0} max={5} step="0.01" value={numericValue(draft.electricityRate)} onChange={(event) => patch({ electricityRate: Number(event.target.value) })} className={inputClass} /></Field>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">03 · Thermal facility</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Ambient intake" hint="°C"><input type="number" min={-10} max={50} value={numericValue(draft.ambientC)} onChange={(event) => patch({ ambientC: Number(event.target.value) })} className={inputClass} /></Field>
              <Field label="Cooling capacity" hint="kW"><input type="number" min={0.5} max={100} step={0.5} value={numericValue(draft.coolingKw)} onChange={(event) => patch({ coolingKw: Number(event.target.value) })} className={inputClass} /></Field>
              <Field label="Fan / cooling profile"><select value={draft.fanProfile} onChange={(event) => patch({ fanProfile: event.target.value as FanProfile })} className={inputClass}><option value="eco">Eco · 82% effective</option><option value="balanced">Balanced · 100% effective</option><option value="max">Max Cooling · 118% effective</option></select></Field>
              <div className="rounded-lg border border-line bg-ink px-3 py-2 text-[9px] leading-relaxed text-muted">Thermal calculations combine rack heat, local vertical density, airflow direction, and cooling headroom.</div>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-electric">04 · Structural limits</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Static rating" hint="kg"><input type="number" min={50} step={10} value={numericValue(draft.staticRatingKg)} onChange={(event) => patch({ staticRatingKg: Number(event.target.value) })} className={inputClass} /></Field>
              <Field label="Rolling rating" hint="kg"><input type="number" min={50} step={10} value={numericValue(draft.rollingRatingKg)} onChange={(event) => patch({ rollingRatingKg: Number(event.target.value) })} className={inputClass} /></Field>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">05 · Reserved & blocked zones</h3>
            <div className="space-y-2">
              {draft.zones.map((zone) => (
                <div key={zone.id} className="flex items-center gap-3 rounded-lg border border-line bg-ink px-3 py-2">
                  <span className={`h-2 w-2 rounded-full ${zone.kind === 'blocked' ? 'bg-danger' : 'bg-warning'}`} />
                  <span className="flex-1 text-xs text-white">{zone.name}</span>
                  <span className="font-mono text-[10px] text-muted">U{zone.startU + 1}–U{zone.endU}</span>
                  <span className="rounded border border-line px-1.5 py-0.5 text-[9px] uppercase text-muted">{zone.kind}</span>
                  <button type="button" onClick={() => patch({ zones: draft.zones.filter((item) => item.id !== zone.id) })} className="text-muted hover:text-danger"><Trash2 size={13} /></button>
                </div>
              ))}
              {draft.zones.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[10px] text-muted">No reserved zones. Add clearance for ducting, cable trays, or inaccessible space.</p>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-panel2 p-3 md:grid-cols-5">
              <Field label="Zone name"><input value={zoneDraft.name} onChange={(event) => setZoneDraft({ ...zoneDraft, name: event.target.value })} className={`${inputClass} h-8 text-xs`} /></Field>
              <Field label="Type"><select value={zoneDraft.kind} onChange={(event) => setZoneDraft({ ...zoneDraft, kind: event.target.value as RackZone['kind'] })} className={`${inputClass} h-8 text-xs`}><option value="reserved">Reserved</option><option value="blocked">Blocked</option></select></Field>
              <Field label="Start U"><input type="number" min={1} max={draft.heightU} value={numericValue(zoneDraft.startU + 1)} onChange={(event) => setZoneDraft({ ...zoneDraft, startU: Number(event.target.value) - 1 })} className={`${inputClass} h-8 text-xs`} /></Field>
              <Field label="End U"><input type="number" min={1} max={draft.heightU} value={numericValue(zoneDraft.endU)} onChange={(event) => setZoneDraft({ ...zoneDraft, endU: Number(event.target.value) })} className={`${inputClass} h-8 text-xs`} /></Field>
              <button type="button" onClick={addZone} className="mt-[18px] flex h-8 items-center justify-center gap-1 rounded-lg border border-accent/25 bg-accent/10 text-[10px] font-semibold text-accent"><Plus size={12} /> Add zone</button>
            </div>
          </section>

          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/[0.06] p-3 text-[11px] text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</div>}
        </div>
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-panel2/95 px-5 py-3 backdrop-blur">
          <p className="hidden text-[9px] text-muted sm:block">Changes are validated against installed equipment before saving.</p>
          <div className="ml-auto flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-white">Cancel</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-ink transition hover:bg-accent/85"><Save size={14} /> Apply configuration</button></div>
        </div>
      </form>
    </Modal>
  );
}
