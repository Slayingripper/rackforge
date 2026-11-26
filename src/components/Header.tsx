import { useState } from 'react';
import {
  Boxes, ChevronDown, Download, FileText, Layers3, MoreHorizontal, PanelLeftClose, PanelLeftOpen,
  PanelRightClose, PanelRightOpen, Plus, Redo2, Settings2, Undo2, Upload,
} from 'lucide-react';
import { IconButton, StatusBadge } from './ui';
import type { Severity } from '../types';

interface HeaderProps {
  rackName: string;
  severity: Severity;
  canUndo: boolean;
  canRedo: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onSettings: () => void;
  onCustom: () => void;
  onPresets: () => void;
  onReport: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function Header(props: HeaderProps) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const runMobileAction = (action: () => void) => {
    setMobileMenu(false);
    action();
  };
  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-ink/95 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent shadow-glow">
          <Boxes size={19} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-ink bg-accent" />
        </div>
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-extrabold tracking-[0.08em] text-white">RACKFORGE</span>
            <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[8px] tracking-wider text-muted">BETA</span>
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Data center digital twin</p>
        </div>
      </div>

      <div className="mx-1 hidden h-7 w-px bg-line md:block" />
      <div className="hidden min-w-0 md:block">
        <div className="flex items-center gap-2">
          <p className="max-w-[220px] truncate text-xs font-semibold text-white">{props.rackName}</p>
          <StatusBadge severity={props.severity} />
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted"><span className="h-1 w-1 rounded-full bg-success" /> Autosaved locally</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <IconButton label={props.leftOpen ? 'Hide hardware library' : 'Show hardware library'} onClick={props.onToggleLeft} active={props.leftOpen}>
          {props.leftOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </IconButton>
        <div className="flex items-center rounded-lg border border-line bg-panel2 p-0.5">
          <IconButton label="Undo (Ctrl+Z)" onClick={props.onUndo} disabled={!props.canUndo} className="border-0 bg-transparent"><Undo2 size={15} /></IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" onClick={props.onRedo} disabled={!props.canRedo} className="border-0 bg-transparent"><Redo2 size={15} /></IconButton>
        </div>
        <button onClick={props.onPresets} className="hidden h-8 items-center gap-1.5 rounded-lg border border-line bg-panel2 px-2.5 text-[11px] font-medium text-muted transition hover:text-white xl:inline-flex">
          Scenarios <ChevronDown size={13} />
        </button>
        <IconButton label="Custom hardware" onClick={props.onCustom}><Plus size={16} /></IconButton>
        <IconButton label="Rack settings" onClick={props.onSettings}><Settings2 size={16} /></IconButton>
        <IconButton label="Import workspace JSON" onClick={props.onImport} className="hidden sm:inline-flex"><Upload size={15} /></IconButton>
        <IconButton label="Export workspace JSON" onClick={props.onExport} className="hidden sm:inline-flex"><Download size={15} /></IconButton>
        <button onClick={props.onReport} className="hidden h-8 items-center gap-1.5 rounded-lg border border-accent/25 bg-accent/10 px-3 text-[11px] font-semibold text-accent transition hover:bg-accent/15 sm:inline-flex">
          <FileText size={14} /> Report
        </button>
        <div className="relative sm:hidden">
          <IconButton label="More actions" onClick={() => setMobileMenu((open) => !open)} active={mobileMenu}><MoreHorizontal size={16} /></IconButton>
          {mobileMenu && (
            <>
              <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMobileMenu(false)} aria-label="Close actions menu" />
              <div className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl border border-line bg-panel2 p-1.5 shadow-panel">
                <button onClick={() => runMobileAction(props.onPresets)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-white/5"><Layers3 size={14} className="text-accent" /> Scenario library</button>
                <button onClick={() => runMobileAction(props.onReport)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-white/5"><FileText size={14} className="text-accent" /> Capacity report</button>
                <button onClick={() => runMobileAction(props.onImport)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-white/5"><Upload size={14} className="text-muted" /> Import workspace</button>
                <button onClick={() => runMobileAction(props.onExport)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] text-white hover:bg-white/5"><Download size={14} className="text-muted" /> Export workspace</button>
              </div>
            </>
          )}
        </div>
        <IconButton label={props.rightOpen ? 'Hide inspector' : 'Show inspector'} onClick={props.onToggleRight} active={props.rightOpen}>
          {props.rightOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
        </IconButton>
      </div>
    </header>
  );
}
