import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Box, CircuitBoard, Command, Copy, Download, FileText, FlipHorizontal2, FolderOpen,
  Layers3, Monitor, Plus, Search, Server, Settings2, SlidersHorizontal, Thermometer,
  Trash2, Upload, Weight, Wind, X, Zap,
} from 'lucide-react';
import { CATEGORY_META } from '../data/catalog';
import { RACK_PRESETS } from '../data/presets';
import type { HardwareTemplate, OverlayMode, PlacedDevice, ViewMode } from '../types';

interface CommandItem {
  id: string;
  group: string;
  label: string;
  detail: string;
  icon: ReactNode;
  keywords: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  rackName: string;
  catalog: HardwareTemplate[];
  selectedDevice: PlacedDevice | null;
  selectedHardware: HardwareTemplate | null;
  onPickHardware: (hardware: HardwareTemplate) => void;
  onViewChange: (view: ViewMode) => void;
  onOverlayChange: (overlay: OverlayMode) => void;
  onLoadPreset: (id: string) => void;
  onOpenPresets: () => void;
  onOpenSettings: () => void;
  onOpenCustom: () => void;
  onOpenReport: () => void;
  onExport: () => void;
  onImport: () => void;
  onReviewTelemetry: () => void;
  onOpenLibrary: () => void;
  onUpdateSelected: (patch: Partial<PlacedDevice>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const featuredHardware = ['ws-gpu-4u', 'sbc-pi8-1u', 'sw-poe24-1u', 'fan-tray-2u', 'ups-2u', 'blanking-solid-1u'];

export function CommandPalette(props: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      { id: 'view-3d', group: 'View', label: 'Switch to 3D view', detail: 'Orbitable rack stage', icon: <Box size={15} />, keywords: '3d three dimension orbit', run: () => props.onViewChange('3d') },
      { id: 'view-2d', group: 'View', label: 'Switch to 2D elevation', detail: 'Precision U-level editor', icon: <Layers3 size={15} />, keywords: '2d elevation front rear svg', run: () => props.onViewChange('2d') },
      { id: 'overlay-airflow', group: 'View', label: 'Show animated airflow', detail: 'Streamlines, recirculation, bypass', icon: <Wind size={15} />, keywords: 'air flow cooling thermal particles', run: () => props.onOverlayChange('airflow') },
      { id: 'overlay-thermal', group: 'View', label: 'Show thermal overlay', detail: 'Temperature gradients and hotspots', icon: <Thermometer size={15} />, keywords: 'thermal temperature heat hotspot', run: () => props.onOverlayChange('thermal') },
      { id: 'overlay-power', group: 'View', label: 'Show power overlay', detail: 'Device-level power density', icon: <Zap size={15} />, keywords: 'power watts pdu energy', run: () => props.onOverlayChange('power') },
      { id: 'overlay-weight', group: 'View', label: 'Show weight overlay', detail: 'Structural load distribution', icon: <Weight size={15} />, keywords: 'weight kg structural cog', run: () => props.onOverlayChange('weight') },
      { id: 'overlay-normal', group: 'View', label: 'Return to normal view', detail: 'Hardware materials and colors', icon: <Monitor size={15} />, keywords: 'normal default materials', run: () => props.onOverlayChange('normal') },
      { id: 'review', group: 'Workspace', label: 'Review telemetry and advisories', detail: 'Power, airflow, thermal, structural', icon: <SlidersHorizontal size={15} />, keywords: 'telemetry warnings issues health dashboard', run: props.onReviewTelemetry },
      { id: 'library', group: 'Workspace', label: 'Open hardware library', detail: `${props.catalog.length} components`, icon: <FolderOpen size={15} />, keywords: 'library hardware catalog browse', run: props.onOpenLibrary },
      { id: 'settings', group: 'Workspace', label: 'Configure rack and facility', detail: props.rackName, icon: <Settings2 size={15} />, keywords: 'rack settings enclosure power cooling', run: props.onOpenSettings },
      { id: 'custom', group: 'Workspace', label: 'Create custom hardware', detail: 'Reusable equipment profile', icon: <Plus size={15} />, keywords: 'custom new hardware builder', run: props.onOpenCustom },
      { id: 'presets', group: 'Workspace', label: 'Browse scenario library', detail: 'Ready-to-load rack layouts', icon: <Layers3 size={15} />, keywords: 'presets scenarios examples templates', run: props.onOpenPresets },
      { id: 'report', group: 'Workspace', label: 'Open capacity report', detail: 'Printable planning summary', icon: <FileText size={15} />, keywords: 'report print summary export pdf', run: props.onOpenReport },
      { id: 'export', group: 'Workspace', label: 'Export workspace JSON', detail: 'Download complete rack state', icon: <Download size={15} />, keywords: 'export save download json backup', run: props.onExport },
      { id: 'import', group: 'Workspace', label: 'Import workspace JSON', detail: 'Restore a saved rack', icon: <Upload size={15} />, keywords: 'import load upload json restore', run: props.onImport },
    ];

    const scenarios: CommandItem[] = RACK_PRESETS.map((preset) => ({
      id: `preset-${preset.id}`,
      group: 'Scenarios',
      label: `Load ${preset.shortName}`,
      detail: preset.name,
      icon: <Layers3 size={15} />,
      keywords: `${preset.name} ${preset.description} scenario preset`,
      run: () => props.onLoadPreset(preset.id),
    }));

    const deviceActions: CommandItem[] = props.selectedDevice && props.selectedHardware ? [
      { id: 'device-flip', group: 'Selected device', label: 'Flip selected device', detail: props.selectedHardware.name, icon: <FlipHorizontal2 size={15} />, keywords: 'flip rotate orientation reverse selected', run: () => props.onUpdateSelected({ flipped: !props.selectedDevice?.flipped }) },
      { id: 'device-pdu-a', group: 'Selected device', label: 'Assign selected device to PDU A', detail: props.selectedHardware.name, icon: <Zap size={15} />, keywords: 'pdu a power feed selected', run: () => props.onUpdateSelected({ pdu: 'A' }) },
      { id: 'device-pdu-b', group: 'Selected device', label: 'Assign selected device to PDU B', detail: props.selectedHardware.name, icon: <Zap size={15} />, keywords: 'pdu b power feed selected', run: () => props.onUpdateSelected({ pdu: 'B' }) },
      { id: 'device-duplicate', group: 'Selected device', label: 'Duplicate selected device', detail: props.selectedHardware.name, icon: <Copy size={15} />, keywords: 'duplicate copy clone selected', run: props.onDuplicate },
      { id: 'device-remove', group: 'Selected device', label: 'Remove selected device', detail: props.selectedHardware.name, icon: <Trash2 size={15} />, keywords: 'remove delete selected device', run: props.onRemove },
    ] : [];

    const normalized = query.trim().toLowerCase();
    const hardwareMatches = normalized
      ? props.catalog.filter((item) => `${item.name} ${item.vendor} ${item.subtype ?? ''} ${item.category} ${item.ports}`.toLowerCase().includes(normalized)).slice(0, 8)
      : featuredHardware.map((id) => props.catalog.find((item) => item.id === id)).filter((item): item is HardwareTemplate => Boolean(item));
    const hardwareItems: CommandItem[] = hardwareMatches.map((item) => ({
      id: `hardware-${item.id}`,
      group: 'Hardware',
      label: item.name,
      detail: `${item.subtype ?? CATEGORY_META[item.category].label} · ${item.uHeight === 0 ? '0U' : `${item.uHeight}U`} · ${item.typicalW}W`,
      icon: item.category === 'sbc' ? <CircuitBoard size={15} /> : <Server size={15} />,
      keywords: `${item.name} ${item.vendor} ${item.subtype ?? ''} ${item.category} ${item.ports} place add install`,
      run: () => props.onPickHardware(item),
    }));

    const all = [...actions, ...scenarios, ...deviceActions, ...hardwareItems];
    if (!normalized) return all;
    return all
      .map((item) => {
        const haystack = `${item.label} ${item.detail} ${item.keywords}`.toLowerCase();
        const tokens = normalized.split(/\s+/);
        if (!tokens.every((token) => haystack.includes(token))) return { item, score: -1 };
        const score = item.label.toLowerCase().startsWith(normalized) ? 3 : item.label.toLowerCase().includes(normalized) ? 2 : 1;
        return { item, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 18)
      .map((entry) => entry.item);
  }, [props, query]);

  const filtered = items;
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!props.open) return;
    previouslyFocused.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    setActiveIndex(0);
    const timeout = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(timeout);
      previouslyFocused.current?.focus();
    };
  }, [props.open]);

  useEffect(() => setActiveIndex(0), [query]);
  useEffect(() => setActiveIndex((index) => filtered.length ? Math.min(index, filtered.length - 1) : 0), [filtered]);

  if (!props.open) return null;

  const runItem = (item: CommandItem) => {
    props.onClose();
    item.run();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[10vh] sm:pt-[14vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={props.onClose} aria-label="Close command palette" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-panel shadow-panel">
        <div className="flex items-center gap-3 border-b border-line bg-panel2/70 px-4">
          <Search size={17} className="shrink-0 text-accent" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => filtered.length ? (index + 1) % filtered.length : 0);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => filtered.length ? (index - 1 + filtered.length) % filtered.length : 0);
              } else if (event.key === 'Enter' && filtered[activeIndex]) {
                event.preventDefault();
                runItem(filtered[activeIndex]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                props.onClose();
              }
            }}
            placeholder="Search hardware or type a command…"
            className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-muted/60"
            aria-label="Search commands and hardware"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={filtered[activeIndex] ? `command-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
          />
          <button onClick={props.onClose} className="rounded p-1 text-muted hover:text-white" aria-label="Close"><X size={15} /></button>
        </div>

        <div id="command-palette-results" role="listbox" aria-label="Commands and hardware" className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.map((item, index) => {
            const showGroup = index === 0 || filtered[index - 1].group !== item.group;
            return (
              <div key={item.id} role="presentation">
                {showGroup && <p className="px-2 pb-1 pt-2 text-[8px] font-bold uppercase tracking-[0.16em] text-muted">{item.group}</p>}
                <button
                  id={`command-option-${index}`}
                  role="option"
                  aria-selected={activeIndex === index}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => runItem(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${activeIndex === index ? 'bg-accent/10' : 'hover:bg-white/[0.03]'}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${activeIndex === index ? 'border-accent/25 bg-accent/10 text-accent' : 'border-line bg-ink text-muted'}`}>{item.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-white">{item.label}</span><span className="mt-0.5 block truncate text-[9px] text-muted">{item.detail}</span></span>
                  {activeIndex === index && <span className="font-mono text-[9px] text-accent">↵</span>}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-10 text-center"><Search size={22} className="mx-auto mb-2 text-muted/40" /><p className="text-xs text-muted">No matching hardware or commands.</p></div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-ink/60 px-4 py-2 font-mono text-[8px] text-muted">
          <span className="flex items-center gap-3"><span>↑↓ navigate</span><span>↵ select</span><span>esc close</span></span>
          <span className="flex items-center gap-1"><Command size={9} /> K</span>
        </div>
      </div>
    </div>
  );
}
