import { useState } from 'react';
import { AlertTriangle, Save, Trash2 } from 'lucide-react';
import { CATEGORY_META } from '../data/catalog';
import { Field, Modal, inputClass } from './ui';
import { uid } from '../lib/simulation';
import type { Airflow, Category, HardwareTemplate } from '../types';

interface CustomHardwareModalProps {
  existing: HardwareTemplate[];
  onSave: (hardware: HardwareTemplate) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const blank = (): HardwareTemplate => ({
  id: '', name: '', vendor: 'Custom', category: 'compute', subtype: 'Custom', uHeight: 1,
  depthMm: 600, widthMm: 482, weightKg: 10, ratedW: 500, typicalW: 200, peakW: 350,
  airflow: 'front-to-back', ports: '', description: '', color: '#6f93b8', custom: true,
});

function numericValue(value: number): number | '' {
  return Number.isFinite(value) ? value : '';
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function CustomHardwareModal({ existing, onSave, onDelete, onClose }: CustomHardwareModalProps) {
  const [draft, setDraft] = useState<HardwareTemplate>(blank);
  const [error, setError] = useState('');
  const patch = (value: Partial<HardwareTemplate>) => { setDraft((current) => ({ ...current, ...value })); setError(''); };

  const save = () => {
    const name = draft.name.trim();
    const { uHeight, depthMm, widthMm, weightKg, ratedW, typicalW, peakW } = draft;
    if (!name) { setError('Enter an equipment name.'); return; }
    if (!Number.isInteger(uHeight) || uHeight < 0 || uHeight > 12) { setError('U height must be a whole number from 0 to 12.'); return; }
    if (!Number.isFinite(depthMm) || depthMm < 20 || depthMm > 1200) { setError('Depth must be between 20mm and 1200mm.'); return; }
    if (!Number.isFinite(widthMm) || widthMm < 20 || widthMm > 800) { setError('Width must be between 20mm and 800mm.'); return; }
    if (![weightKg, typicalW, peakW, ratedW].every(Number.isFinite)) { setError('Use finite numeric values for weight and power.'); return; }
    if (weightKg < 0 || typicalW < 0 || peakW < typicalW || ratedW < peakW) {
      setError('Use non-negative values. Peak power must be at least typical power, and rated power must cover peak draw.');
      return;
    }
    onSave({
      ...draft,
      id: uid('custom'),
      name,
      vendor: draft.vendor.trim() || 'Custom',
      subtype: draft.subtype?.trim() || CATEGORY_META[draft.category].label,
      weightKg,
      ratedW,
      typicalW,
      peakW,
      custom: true,
    });
    setDraft(blank());
    setError('');
  };

  return (
    <Modal title="Custom hardware builder" eyebrow="Reusable equipment profile" onClose={onClose} wide>
      <div className="grid gap-0 lg:grid-cols-[1fr_260px]">
        <form onSubmit={(event) => { event.preventDefault(); save(); }} className="space-y-5 p-5">
          <section>
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-accent">Identity & form factor</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Equipment name"><input value={draft.name} onChange={(event) => patch({ name: event.target.value })} placeholder="e.g. 2U Storage Node" className={inputClass} /></Field>
              <Field label="Vendor / model family"><input value={draft.vendor} onChange={(event) => patch({ vendor: event.target.value })} className={inputClass} /></Field>
              <Field label="Category"><select value={draft.category} onChange={(event) => patch({ category: event.target.value as Category, color: CATEGORY_META[event.target.value as Category].color })} className={inputClass}>{Object.entries(CATEGORY_META).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}</select></Field>
              <Field label="Equipment type"><input value={draft.subtype ?? ''} onChange={(event) => patch({ subtype: event.target.value })} list="equipment-type-options" placeholder="e.g. Fan Tray, PoE Switch, SBC Cluster" className={inputClass} /><datalist id="equipment-type-options">{['Rack PC', 'GPU Workstation', 'SBC Cluster', 'Mini PC', 'Fanless SBC', 'PoE Switch', '25G Switch', 'Core Switch', 'Fan Tray', 'Exhaust Fan', 'Vertical Fan', 'Patch Panel', 'UPS', 'PDU'].map((type) => <option key={type} value={type} />)}</datalist></Field>
              <Field label="Accent color"><div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-ink px-2"><input type="color" value={draft.color} onChange={(event) => patch({ color: event.target.value })} className="h-6 w-8 cursor-pointer border-0 bg-transparent" /><span className="font-mono text-[10px] text-muted">{draft.color}</span></div></Field>
              <Field label="U height" hint="0 = vertical"><input type="number" min={0} max={12} value={numericValue(draft.uHeight)} onChange={(event) => patch({ uHeight: event.target.valueAsNumber })} className={inputClass} /></Field>
              <Field label="Airflow profile"><select value={draft.airflow} onChange={(event) => patch({ airflow: event.target.value as Airflow })} className={inputClass}><option value="front-to-back">Front → back</option><option value="back-to-front">Back → front</option><option value="side-to-side">Side → side</option><option value="passive">Passive / no fan</option></select></Field>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-warning">Physical & electrical specifications</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Depth" hint="mm"><input type="number" min={20} max={1200} value={numericValue(draft.depthMm)} onChange={(event) => patch({ depthMm: event.target.valueAsNumber })} className={inputClass} /></Field>
              <Field label="Width" hint="mm"><input type="number" min={20} max={800} value={numericValue(draft.widthMm)} onChange={(event) => patch({ widthMm: event.target.valueAsNumber })} className={inputClass} /></Field>
              <Field label="Weight" hint="kg"><input type="number" min={0} step="0.1" value={draft.weightKg} onChange={(event) => patch({ weightKg: nonNegative(event.target.valueAsNumber) })} className={inputClass} /></Field>
              <Field label="Rated power" hint="W"><input type="number" min={0} value={draft.ratedW} onChange={(event) => patch({ ratedW: nonNegative(event.target.valueAsNumber) })} className={inputClass} /></Field>
              <Field label="Typical draw" hint="W"><input type="number" min={0} value={draft.typicalW} onChange={(event) => patch({ typicalW: nonNegative(event.target.valueAsNumber) })} className={inputClass} /></Field>
              <Field label="Peak draw" hint="W"><input type="number" min={0} value={draft.peakW} onChange={(event) => patch({ peakW: nonNegative(event.target.valueAsNumber) })} className={inputClass} /></Field>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-ink p-3 font-mono text-[10px] text-muted">
              Estimated heat: <span className="text-white">{(nonNegative(draft.typicalW) * 3.412142).toFixed(0)} BTU/hr</span> · nameplate-to-typical ratio: <span className="text-white">{draft.typicalW > 0 ? `${(nonNegative(draft.ratedW) / draft.typicalW).toFixed(2)}×` : '—'}</span>
            </div>
          </section>

          <section className="border-t border-line pt-5">
            <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted">Ports & documentation</h3>
            <div className="space-y-3">
              <Field label="Ports / bays"><input value={draft.ports} onChange={(event) => patch({ ports: event.target.value })} placeholder="e.g. 8× 10GbE, 12× 3.5″ bays" className={inputClass} /></Field>
              <Field label="Description"><textarea value={draft.description} onChange={(event) => patch({ description: event.target.value })} rows={3} placeholder="Deployment notes, cooling requirements, compatibility…" className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-white outline-none focus:border-accent/50" /></Field>
            </div>
          </section>

          {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/[0.06] p-3 text-[11px] text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error}</div>}
          <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-xs text-muted hover:text-white">Close</button><button type="submit" className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-bold text-ink hover:bg-accent/85"><Save size={14} /> Save to library</button></div>
        </form>

        <aside className="border-t border-line bg-panel2/50 p-4 lg:border-l lg:border-t-0">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Saved custom profiles</h3>
          <p className="mt-1 text-[9px] leading-relaxed text-muted">Profiles persist in this browser and are included in JSON exports.</p>
          <div className="mt-3 space-y-2">
            {existing.map((item) => (
              <div key={item.id} className="rounded-lg border border-line bg-ink p-2.5">
                <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-semibold text-white">{item.name}</p><button onClick={() => onDelete(item.id)} className="text-muted hover:text-danger" title="Delete custom profile"><Trash2 size={12} /></button></div>
                <p className="mt-1 font-mono text-[8px] text-muted">{item.uHeight === 0 ? '0U' : `${item.uHeight}U`} · {item.depthMm}mm · {item.typicalW}W</p>
              </div>
            ))}
            {existing.length === 0 && <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[10px] text-muted">No custom profiles yet.</p>}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
