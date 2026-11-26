import {
  ArrowDown, ArrowUp, Copy, FlipHorizontal2, Gauge, Layers3, RotateCcw,
  Server, Trash2, Weight, Wind, Zap,
} from 'lucide-react';
import { CATEGORY_META } from '../data/catalog';
import type { DeviceTelemetry, HardwareTemplate, PlacedDevice, RackConfig } from '../types';
import { EmptyState, Field, IconButton, inputClass, StatusBadge } from './ui';

interface InspectorPanelProps {
  device: PlacedDevice | null;
  hardware: HardwareTemplate | null;
  telemetry: DeviceTelemetry | null;
  rack: RackConfig;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onResetOverrides: () => void;
  onClose?: () => void;
}

function finite(value: string | number, fallback: number): number {
  if (value === '') return fallback;
  const numeric = typeof value === 'number' ? value : Number(value.trim());
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function InspectorPanel({ device, hardware, telemetry, rack, onUpdate, onDuplicate, onRemove, onResetOverrides, onClose }: InspectorPanelProps) {
  if (!device || !hardware) {
    return (
      <aside className="flex h-full flex-col border-l border-line bg-panel">
        <div className="border-b border-line px-4 py-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.13em] text-white">Device inspector</h2>
          <p className="mt-0.5 text-[10px] text-muted">Mounting, orientation & overrides</p>
        </div>
        <EmptyState icon={<Server size={20} />} title="No device selected" detail="Select a chassis in the rack to inspect placement, tune power draw, or assign a PDU feed." />
        {onClose && <button onClick={onClose} className="m-4 rounded-lg border border-line py-2 text-xs text-muted lg:hidden">Close inspector</button>}
      </aside>
    );
  }

  const adjusted = Boolean(device.overrides && Object.keys(device.overrides).length);
  const assetLabel = device.overrides?.label ?? hardware.name;
  const currentTypicalW = device.overrides?.typicalW ?? hardware.typicalW;
  const currentPeakW = device.overrides?.peakW ?? hardware.peakW;
  const currentWeightKg = device.overrides?.weightKg ?? hardware.weightKg;
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-line bg-panel">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-[0.13em] text-white">Device inspector</h2>
            <p className="mt-0.5 truncate text-[10px] text-muted">{hardware.vendor} · {hardware.subtype ?? CATEGORY_META[hardware.category].label}</p>
          </div>
          <StatusBadge severity={telemetry?.severity ?? 'ok'} label={device.status === 'active' ? 'Active' : 'Reserved'} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="rounded-xl border border-line bg-panel2 p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-ink" style={{ color: hardware.color }}><Server size={19} /></div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">{hardware.name}</p>
              <p className="mt-0.5 font-mono text-[9px] text-muted">{hardware.uHeight === 0 ? '0U VERTICAL' : `${hardware.uHeight}U`} · {hardware.depthMm}mm · {hardware.weightKg}kg</p>
              <p className="mt-1 truncate text-[9px] text-muted">{hardware.ports}</p>
              <p className="mt-1 flex items-center gap-1 text-[9px] text-muted"><Wind size={10} style={{ color: hardware.color }} /> {hardware.airflow === 'front-to-back' ? 'Front → back' : hardware.airflow === 'back-to-front' ? 'Back → front' : hardware.airflow === 'side-to-side' ? 'Side → side' : 'Passive airflow'}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Asset label">
            <input
              key={`label-${device.instanceId}-${assetLabel}`}
              defaultValue={assetLabel}
              aria-label="Asset label"
              onBlur={(event) => {
                const next = event.target.value.trim() || hardware.name;
                if (next !== assetLabel) onUpdate({ overrides: { ...device.overrides, label: next } });
              }}
              className={inputClass}
            />
          </Field>
          <div>
            <span className="mb-1.5 block text-[11px] font-medium text-muted">Provisioning state</span>
            <div className="grid grid-cols-2 rounded-lg border border-line bg-ink p-1">
              {(['active', 'reserved'] as const).map((status) => (
                <button key={status} type="button" aria-pressed={device.status === status} onClick={() => onUpdate({ status })} className={`rounded-md py-1.5 text-[10px] font-semibold capitalize transition ${device.status === status ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white'}`}>{status}</button>
              ))}
            </div>
            <p className="mt-1.5 text-[9px] leading-relaxed text-muted">Reserved devices occupy U-space but draw no power and generate no heat.</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Placement</h3>
            <Layers3 size={13} className="text-muted" />
          </div>
          {device.mount === 'vertical' ? (
            <Field label="Vertical mounting rail">
              <select value={device.side} onChange={(event) => onUpdate({ side: event.target.value as 'left' | 'right' })} aria-label="Vertical mounting rail" className={inputClass}>
                <option value="left">Left rail · 0U</option>
                <option value="right">Right rail · 0U</option>
              </select>
            </Field>
          ) : (
            <Field label="Rack unit" hint={`bottom U = ${device.startU + 1}`}>
              <div className="flex gap-1.5">
                <IconButton label="Move down 1U" onClick={() => onUpdate({ startU: Math.max(0, device.startU - 1) })}><ArrowDown size={14} /></IconButton>
                <input
                  key={`u-${device.instanceId}-${device.startU}`}
                  type="number" min={1} max={rack.heightU - hardware.uHeight + 1} defaultValue={device.startU + 1}
                  aria-label="Rack unit"
                  onBlur={(event) => {
                    const raw = event.target.value.trim();
                    const current = device.startU + 1;
                    if (!raw) { event.currentTarget.value = String(current); return; }
                    const parsed = Number(raw);
                    if (!Number.isFinite(parsed)) { event.currentTarget.value = String(current); return; }
                    const next = Math.trunc(parsed) - 1;
                    if (next === device.startU) return;
                    onUpdate({ startU: next });
                  }}
                  onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  className={`${inputClass} text-center font-mono`}
                />
                <IconButton label="Move up 1U" onClick={() => onUpdate({ startU: device.startU + 1 })}><ArrowUp size={14} /></IconButton>
              </div>
            </Field>
          )}
          <Field label="Mounting plane">
            <select value={device.mount} onChange={(event) => onUpdate({ mount: event.target.value as PlacedDevice['mount'] })} aria-label="Mounting plane" className={inputClass}>
              <option value="front">Front rails</option>
              <option value="rear">Rear rails</option>
              {hardware.uHeight === 0 && <option value="vertical">Vertical · 0U rail</option>}
            </select>
          </Field>
          <button type="button" aria-pressed={device.flipped} onClick={() => onUpdate({ flipped: !device.flipped })} className={`flex h-9 w-full items-center justify-center gap-2 rounded-lg border text-[11px] font-medium transition ${device.flipped ? 'border-electric/30 bg-electric/10 text-electric' : 'border-line bg-panel2 text-muted hover:text-white'}`}>
            <FlipHorizontal2 size={14} /> {device.flipped ? 'Flipped 180°' : 'Flip orientation 180°'}
          </button>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Power feed</h3>
            <Zap size={13} className="text-warning" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['A', 'B'] as const).map((feed) => (
              <button key={feed} type="button" aria-pressed={device.pdu === feed} onClick={() => onUpdate({ pdu: feed })} className={`rounded-lg border py-2 text-[11px] font-semibold transition ${device.pdu === feed ? 'border-warning/40 bg-warning/10 text-warning' : 'border-line bg-panel2 text-muted hover:text-white'}`}>PDU {feed}</button>
            ))}
          </div>
          <p className="text-[9px] leading-relaxed text-muted">Split redundant dual-cord equipment across A/B. Single-cord equipment follows its assigned feed.</p>
        </div>

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">Engineering overrides</h3>
            {adjusted && <button type="button" onClick={onResetOverrides} className="flex items-center gap-1 text-[9px] text-accent hover:underline"><RotateCcw size={10} /> Reset</button>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Typical W">
              <input key={`tw-${device.instanceId}-${currentTypicalW}`} type="number" min={0} defaultValue={currentTypicalW} aria-label="Typical power override in watts" onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) { event.currentTarget.value = String(currentTypicalW); return; }
                const next = Math.max(0, finite(raw, currentTypicalW));
                if (!Number.isFinite(next) || next === currentTypicalW) return;
                onUpdate({ overrides: { ...device.overrides, typicalW: next } });
              }} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Peak W">
              <input key={`pw-${device.instanceId}-${currentPeakW}`} type="number" min={0} defaultValue={currentPeakW} aria-label="Peak power override in watts" onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) { event.currentTarget.value = String(currentPeakW); return; }
                const next = Math.max(0, finite(raw, currentPeakW));
                if (!Number.isFinite(next) || next === currentPeakW) return;
                onUpdate({ overrides: { ...device.overrides, peakW: next } });
              }} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Weight kg">
              <input key={`kg-${device.instanceId}-${currentWeightKg}`} type="number" min={0} step="0.1" defaultValue={currentWeightKg} aria-label="Weight override in kilograms" onBlur={(event) => {
                const raw = event.target.value.trim();
                if (!raw) { event.currentTarget.value = String(currentWeightKg); return; }
                const next = Math.max(0, finite(raw, currentWeightKg));
                if (!Number.isFinite(next) || next === currentWeightKg) return;
                onUpdate({ overrides: { ...device.overrides, weightKg: next } });
              }} className={`${inputClass} font-mono`} />
            </Field>
            <Field label="Rated W">
              <div className="flex h-9 items-center rounded-lg border border-line bg-ink px-3 font-mono text-xs text-muted">{hardware.ratedW}</div>
            </Field>
          </div>
        </div>

        {telemetry && (
          <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">
            <div className="rounded-lg border border-line bg-ink p-2 text-center"><Zap size={12} className="mx-auto mb-1 text-warning" /><p className="font-mono text-[10px] text-white">{telemetry.typicalW}W</p><p className="text-[8px] text-muted">Typical</p></div>
            <div className="rounded-lg border border-line bg-ink p-2 text-center"><Gauge size={12} className="mx-auto mb-1 text-danger" /><p className="font-mono text-[10px] text-white">{telemetry.localTempC.toFixed(1)}°</p><p className="text-[8px] text-muted">Est. local</p></div>
            <div className="rounded-lg border border-line bg-ink p-2 text-center"><Weight size={12} className="mx-auto mb-1 text-electric" /><p className="font-mono text-[10px] text-white">{telemetry.weightKg}kg</p><p className="text-[8px] text-muted">Installed</p></div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
        <button onClick={onDuplicate} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-line bg-panel2 text-[11px] font-medium text-white transition hover:border-electric/40 hover:text-electric"><Copy size={14} /> Duplicate</button>
        <button onClick={onRemove} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-danger/20 bg-danger/5 text-[11px] font-medium text-danger transition hover:bg-danger/10"><Trash2 size={14} /> Remove</button>
      </div>
    </aside>
  );
}
