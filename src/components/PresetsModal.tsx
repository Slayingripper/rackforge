import { useMemo } from 'react';
import { ArrowRight, Check, Flame, Server, Zap } from 'lucide-react';
import { HARDWARE_CATALOG } from '../data/catalog';
import { RACK_PRESETS } from '../data/presets';
import { simulateRack } from '../lib/simulation';
import { Modal, StatusBadge } from './ui';

export function PresetsModal({ activePreset, onLoad, onClose }: { activePreset: string | null; onLoad: (id: string) => void; onClose: () => void }) {
  const previews = useMemo(() => RACK_PRESETS.map((preset) => {
    const state = preset.build();
    return { preset, state, result: simulateRack(state.rack, state.devices, HARDWARE_CATALOG) };
  }), []);

  return (
    <Modal title="Scenario library" eyebrow="Ready-to-load rack configurations" onClose={onClose} wide>
      <div className="grid gap-4 p-5 md:grid-cols-3">
        {previews.map(({ preset, state, result }) => (
          <button key={preset.id} onClick={() => onLoad(preset.id)} className={`group overflow-hidden rounded-xl border text-left transition-all hover:-translate-y-1 ${activePreset === preset.id ? 'border-accent/45 bg-accent/[0.05]' : 'border-line bg-panel2 hover:border-white/25'}`}>
            <div className="relative flex h-44 items-center justify-center overflow-hidden border-b border-line bg-[radial-gradient(circle_at_50%_80%,rgba(82,224,196,.1),transparent_65%)]">
              <div className="absolute inset-0 opacity-30 blueprint-grid" />
              <div className="relative flex h-32 w-20 flex-col-reverse gap-[2px] rounded border-2 border-[#52667d] bg-ink p-1.5 shadow-panel">
                {state.devices.filter((device) => device.mount !== 'vertical').map((device) => {
                  const hardware = HARDWARE_CATALOG.find((item) => item.id === device.hardwareId)!;
                  return <div key={device.instanceId} className="shrink-0 rounded-[1px] border border-white/10" style={{ height: `${Math.max(2, hardware.uHeight * 5)}px`, backgroundColor: `${hardware.color}35`, borderLeftColor: hardware.color }} />;
                })}
              </div>
              <span className="absolute left-3 top-3 rounded border border-line bg-ink/80 px-1.5 py-0.5 font-mono text-[8px] text-muted">{state.rack.heightU}U</span>
              {activePreset === preset.id && <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-ink"><Check size={13} /></span>}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-[8px] uppercase tracking-[0.15em] text-accent">{preset.badge}</span><StatusBadge severity={result.severity} /></div>
              <h3 className="mt-2 text-sm font-semibold leading-5 text-white">{preset.name}</h3>
              <p className="mt-2 min-h-[48px] text-[10px] leading-relaxed text-muted">{preset.description}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 font-mono text-[9px]">
                <span className="flex items-center gap-1 text-muted"><Zap size={10} /> {(result.typicalW / 1000).toFixed(1)}kW</span>
                <span className="flex items-center gap-1 text-muted"><Server size={10} /> {state.devices.length} items</span>
                <span className="flex items-center gap-1 text-muted"><Flame size={10} /> {result.warnings.length} alerts</span>
              </div>
              <span className="mt-4 flex items-center justify-between text-[10px] font-semibold text-accent">Load scenario <ArrowRight size={13} className="transition group-hover:translate-x-1" /></span>
            </div>
          </button>
        ))}
      </div>
      <div className="border-t border-line bg-panel2/60 px-5 py-3 text-[10px] leading-relaxed text-muted">Loading a scenario replaces the current rack layout. Your custom hardware profiles are preserved, and you can undo the change.</div>
    </Modal>
  );
}
