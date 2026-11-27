import { useMemo, useState } from 'react';
import { Box, Cable, CircuitBoard, Database, Fan, GripVertical, ListFilter, Plus, Search, Server, Zap } from 'lucide-react';
import { CATEGORY_META } from '../data/catalog';
import type { Category, HardwareTemplate } from '../types';

const categoryIcons: Record<Category, typeof Server> = {
  compute: Server,
  sbc: CircuitBoard,
  storage: Database,
  network: Cable,
  power: Zap,
  thermal: Fan,
  accessory: Box,
};

interface LibraryPanelProps {
  catalog: HardwareTemplate[];
  pendingId: string | null;
  onPick: (hardware: HardwareTemplate) => void;
  onDragStart?: (id: string) => void;
  onCustom: () => void;
  onClose?: () => void;
}

export function LibraryPanel({ catalog, pendingId, onPick, onDragStart, onCustom, onClose }: LibraryPanelProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const subtypes = useMemo(() => [...new Set(catalog.map((item) => item.subtype).filter((value): value is string => Boolean(value)))].sort(), [catalog]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return catalog.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (typeFilter !== 'all' && item.subtype !== typeFilter) return false;
      if (!query) return true;
      return `${item.name} ${item.vendor} ${item.subtype ?? ''} ${item.ports} ${item.description}`.toLowerCase().includes(query);
    });
  }, [catalog, category, search, typeFilter]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-panel">
      <div className="border-b border-line px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.13em] text-white">Hardware library</h2>
            <p className="mt-0.5 text-[10px] text-muted">{catalog.length} components · drag or click to place</p>
          </div>
          <button onClick={onCustom} title="Create custom hardware" className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition hover:border-accent/40 hover:text-accent"><Plus size={14} /></button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search model, vendor, ports…"
            className="h-9 w-full rounded-lg border border-line bg-ink pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-muted/60 focus:border-accent/40"
          />
        </div>
        <div className="mt-2.5 flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {(['all', ...Object.keys(CATEGORY_META)] as (Category | 'all')[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => { setCategory(key); setTypeFilter('all'); }}
              className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition ${category === key ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-white/5 hover:text-white'}`}
            >
              {key === 'all' ? 'All' : CATEGORY_META[key].label}
            </button>
          ))}
        </div>
        <div className="relative mt-2">
          <ListFilter size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-8 w-full appearance-none rounded-lg border border-line bg-ink pl-8 pr-2 text-[10px] text-white outline-none focus:border-accent/40">
            <option value="all">All equipment types</option>
            {subtypes.map((subtype) => <option key={subtype} value={subtype}>{subtype}</option>)}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {filtered.map((item) => {
          const Icon = categoryIcons[item.category];
          const pending = pendingId === item.id;
          return (
            <button
              key={item.id}
              draggable
              type="button"
              aria-pressed={pending}
              aria-label={`${item.name}, ${item.subtype ?? CATEGORY_META[item.category].label}`}
              onDragStart={(event) => {
                event.dataTransfer.setData('application/rackforge-hardware', item.id);
                event.dataTransfer.effectAllowed = 'copy';
                onDragStart?.(item.id);
              }}
              onClick={() => onPick(item)}
              className={`group relative w-full overflow-hidden rounded-xl border p-3 text-left transition-all ${pending ? 'border-accent/50 bg-accent/[0.07] shadow-glow' : 'border-line bg-panel2/60 hover:-translate-y-px hover:border-white/20 hover:bg-panel2'}`}
            >
              <span className="absolute bottom-0 left-0 top-0 w-0.5 opacity-60" style={{ backgroundColor: item.color }} />
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-ink" style={{ color: item.color }}>
                  <Icon size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold leading-4 text-white">{item.name}</p>
                    <GripVertical size={12} className="mt-0.5 shrink-0 text-muted/30 group-hover:text-muted" />
                  </div>
                  <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-muted">{item.vendor} · {item.subtype ?? CATEGORY_META[item.category].label}{item.custom ? ' · Custom' : ''}</p>
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5 font-mono text-[9px]">
                <span className="rounded border border-line bg-ink/70 px-1.5 py-0.5 text-white/80">{item.uHeight === 0 ? '0U' : `${item.uHeight}U`}</span>
                <span className="rounded border border-line bg-ink/70 px-1.5 py-0.5 text-white/80">{item.depthMm}mm</span>
                <span className="rounded border border-line bg-ink/70 px-1.5 py-0.5 text-white/80">{item.typicalW}W</span>
                <span className="rounded border border-line bg-ink/70 px-1.5 py-0.5 text-white/80">{item.weightKg}kg</span>
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-muted">{item.description}</p>
              {pending && <p className="mt-2 font-mono text-[9px] text-accent">SELECTED · click a rack unit to install</p>}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Search size={22} className="mx-auto mb-2 text-muted/40" />
            <p className="text-xs text-muted">No matching hardware.</p>
            <button onClick={() => { setSearch(''); setCategory('all'); setTypeFilter('all'); }} className="mt-2 text-[10px] text-accent hover:underline">Clear filters</button>
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 py-3">
        <p className="text-[9px] leading-relaxed text-muted"><span className="text-accent">TIP</span> · In 2D elevation, drag a component between U slots. Use the inspector to switch front/rear mounting.</p>
        {onClose && <button onClick={onClose} className="mt-2 w-full rounded-lg border border-line py-1.5 text-[10px] text-muted lg:hidden">Close library</button>}
      </div>
    </aside>
  );
}
