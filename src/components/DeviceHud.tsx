import { Copy, FlipHorizontal2, Server, Thermometer, Trash2, Weight, Wind, X, Zap } from 'lucide-react';
import { CATEGORY_META } from '../data/catalog';
import type { DeviceTelemetry, HardwareTemplate, PlacedDevice, RackConfig } from '../types';

export function DeviceHud({
  device,
  hardware,
  telemetry,
  rack,
  onUpdate,
  onDuplicate,
  onRemove,
  onClose,
}: {
  device: PlacedDevice;
  hardware: HardwareTemplate;
  telemetry: DeviceTelemetry | null;
  rack: RackConfig;
  onUpdate: (patch: Partial<PlacedDevice>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const airflowLabel = hardware.airflow === 'front-to-back' ? 'Front → back' : hardware.airflow === 'back-to-front' ? 'Back → front' : hardware.airflow === 'side-to-side' ? 'Side → side' : 'Passive';
  return (
    <div className="absolute right-4 top-4 z-20 w-[252px] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-white/15 bg-panel/90 shadow-panel backdrop-blur-xl">
      <div className="flex items-start gap-2.5 border-b border-line p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-ink" style={{ color: hardware.color }}><Server size={17} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-white">{device.overrides?.label ?? hardware.name}</p>
          <p className="mt-0.5 truncate font-mono text-[8px] text-muted">{hardware.vendor} · {CATEGORY_META[hardware.category].label}</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted hover:bg-white/5 hover:text-white" aria-label="Close device HUD"><X size={13} /></button>
      </div>

      <div className="p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded border border-line bg-ink px-2 py-1 font-mono text-[8px] text-white/80">{device.mount === 'vertical' ? `0U ${device.side} rail` : `U${device.startU + 1} · ${device.mount}`}</span>
          <span className="flex items-center gap-1 font-mono text-[8px] text-muted"><Wind size={10} style={{ color: hardware.color }} /> {airflowLabel}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded-lg border border-line bg-ink p-2"><Zap size={11} className="mb-1 text-warning" /><p className="font-mono text-[10px] font-semibold text-white">{telemetry?.typicalW ?? 0}W</p><p className="mt-0.5 text-[7px] uppercase tracking-wider text-muted">Typical</p></div>
          <div className="rounded-lg border border-line bg-ink p-2"><Thermometer size={11} className="mb-1 text-danger" /><p className="font-mono text-[10px] font-semibold text-white">{telemetry?.localTempC.toFixed(1) ?? rack.ambientC}°</p><p className="mt-0.5 text-[7px] uppercase tracking-wider text-muted">Est. temp</p></div>
          <div className="rounded-lg border border-line bg-ink p-2"><Weight size={11} className="mb-1 text-electric" /><p className="font-mono text-[10px] font-semibold text-white">{telemetry?.weightKg ?? hardware.weightKg}kg</p><p className="mt-0.5 text-[7px] uppercase tracking-wider text-muted">Installed</p></div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-muted">Power feed</span>
          <div className="flex rounded-md border border-line bg-ink p-0.5">
            {(['A', 'B'] as const).map((feed) => (
              <button key={feed} onClick={() => onUpdate({ pdu: feed })} className={`h-6 w-8 rounded font-mono text-[9px] font-semibold transition ${device.pdu === feed ? feed === 'A' ? 'bg-electric/15 text-electric' : 'bg-accent/15 text-accent' : 'text-muted'}`}>{feed}</button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-line pt-3">
          <button onClick={() => onUpdate({ flipped: !device.flipped })} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-line bg-panel2 text-[9px] text-muted transition hover:text-electric"><FlipHorizontal2 size={12} /> Flip</button>
          <button onClick={onDuplicate} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-line bg-panel2 text-[9px] text-muted transition hover:text-electric"><Copy size={12} /> Copy</button>
          <button onClick={onRemove} className="flex h-8 items-center justify-center gap-1 rounded-lg border border-danger/20 bg-danger/5 text-[9px] text-danger transition hover:bg-danger/10"><Trash2 size={12} /> Remove</button>
        </div>
      </div>
    </div>
  );
}
