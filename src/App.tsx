import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, CheckCircle2, Command, Cpu, HardDrive, Keyboard, Server, X } from 'lucide-react';
import { Header } from './components/Header';
import { LibraryPanel } from './components/LibraryPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { TelemetryPanel } from './components/TelemetryPanel';
import { RackStage } from './components/RackStage';
import { RackSettingsModal } from './components/RackSettingsModal';
import { CustomHardwareModal } from './components/CustomHardwareModal';
import { PresetsModal } from './components/PresetsModal';
import { ReportModal } from './components/ReportModal';
import { WorkspaceHealthRibbon } from './components/WorkspaceHealthRibbon';
import { CommandPalette } from './components/CommandPalette';
import { HARDWARE_CATALOG } from './data/catalog';
import { RACK_PRESETS } from './data/presets';
import { checkPlacement, simulateRack, uid } from './lib/simulation';
import { sanitizeImportedState, useRackState } from './hooks/useRackState';
import type { AppState, HardwareTemplate, OverlayMode, PlacedDevice, RackConfig, ViewMode } from './types';

function numberOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function sanitizeOverrides(value: PlacedDevice['overrides']): PlacedDevice['overrides'] {
  if (value === undefined) return undefined;
  const overrides: NonNullable<PlacedDevice['overrides']> = {};
  if (typeof value.label === 'string' && value.label.trim()) overrides.label = value.label.slice(0, 200);
  if (value.typicalW !== undefined && Number.isFinite(value.typicalW) && value.typicalW >= 0) overrides.typicalW = value.typicalW;
  if (value.peakW !== undefined && Number.isFinite(value.peakW) && value.peakW >= 0) overrides.peakW = value.peakW;
  if (value.weightKg !== undefined && Number.isFinite(value.weightKg) && value.weightKg >= 0) overrides.weightKg = value.weightKg;
  return Object.keys(overrides).length ? overrides : undefined;
}

function applyRackPatch(rack: RackConfig, patch: Partial<RackConfig>): RackConfig {
  const next = { ...rack, ...patch };
  next.ambientC = clamp(numberOr(next.ambientC, rack.ambientC), -50, 80);
  next.coolingKw = Math.max(0.0001, numberOr(next.coolingKw, rack.coolingKw));
  next.electricityRate = Math.max(0, numberOr(next.electricityRate, rack.electricityRate));
  next.circuitAAmps = Math.max(0, numberOr(next.circuitAAmps, rack.circuitAAmps));
  next.circuitBAmps = Math.max(0, numberOr(next.circuitBAmps, rack.circuitBAmps));
  next.staticRatingKg = Math.max(0, numberOr(next.staticRatingKg, rack.staticRatingKg));
  next.rollingRatingKg = clamp(numberOr(next.rollingRatingKg, rack.rollingRatingKg), 0, next.staticRatingKg);
  next.phases = next.phases === 3 ? 3 : 1;
  next.perforatedDoors = next.perforatedDoors === true;
  next.sidePanels = next.sidePanels !== false;
  next.name = typeof next.name === 'string' && next.name.trim() ? next.name : rack.name;
  return next;
}

type ModalName = 'settings' | 'custom' | 'presets' | 'report' | null;

export default function App() {
  const { state, commit, transient, undo, redo, canUndo, canRedo } = useRackState();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalName>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth >= 1024);
  const [rightOpen, setRightOpen] = useState(() => window.innerWidth >= 1280);
  const [rightTab, setRightTab] = useState<'inspector' | 'telemetry'>('inspector');
  const [toast, setToast] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const closeDrawersOnSmallScreens = () => {
      if (window.innerWidth < 1024) setLeftOpen(false);
      if (window.innerWidth < 1280) setRightOpen(false);
    };
    window.addEventListener('resize', closeDrawersOnSmallScreens);
    return () => window.removeEventListener('resize', closeDrawersOnSmallScreens);
  }, []);

  const catalog = useMemo(() => [...HARDWARE_CATALOG, ...state.customHardware], [state.customHardware]);
  const result = useMemo(() => simulateRack(state.rack, state.devices, catalog), [state.rack, state.devices, catalog]);
  const selectedDevice = state.devices.find((device) => device.instanceId === state.selectedId) ?? null;
  const selectedHardware = selectedDevice ? catalog.find((item) => item.id === selectedDevice.hardwareId) ?? null : null;
  const selectedTelemetry = selectedDevice ? result.telemetry.find((item) => item.instanceId === selectedDevice.instanceId) ?? null : null;
  const pendingHardware = pendingId ? catalog.find((item) => item.id === pendingId) ?? null : null;

  const notify = useCallback((message: string) => setToast(message), []);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const select = useCallback((id: string | null) => {
    transient((current) => ({ ...current, selectedId: id }));
    if (id) setRightTab('inspector');
  }, [transient]);

  const changeView = (view: ViewMode) => transient((current) => ({ ...current, view }));
  const changeOverlay = (overlay: OverlayMode) => transient((current) => ({ ...current, overlay }));
  const reviewTelemetry = useCallback(() => {
    setRightOpen(true);
    setRightTab('telemetry');
  }, []);

  const placeDevice = useCallback((hardwareId: string, startU: number, mount: 'front' | 'rear') => {
    const hardware = catalog.find((item) => item.id === hardwareId);
    if (!hardware) return;
    const leftOccupied = state.devices.some((device) => device.mount === 'vertical' && device.side === 'left');
    const candidate: PlacedDevice = {
      instanceId: uid(),
      hardwareId,
      startU: hardware.uHeight === 0 ? 0 : startU,
      status: 'active',
      mount: hardware.uHeight === 0 ? 'vertical' : mount,
      pdu: state.devices.filter((device) => device.status === 'active').length % 2 === 0 ? 'A' : 'B',
      side: leftOccupied ? 'right' : 'left',
      flipped: false,
    };
    const check = checkPlacement(state.rack, state.devices, hardware, candidate, catalog);
    if (!check.valid) {
      notify(check.reason ?? 'That placement is not valid.');
      return;
    }
    commit((current) => ({
      ...current,
      devices: [...current.devices, candidate],
      selectedId: candidate.instanceId,
      activePreset: null,
    }));
    setPendingId(null);
    setRightTab('inspector');
    notify(`${hardware.name} installed at ${candidate.mount === 'vertical' ? `0U ${candidate.side} rail` : `U${candidate.startU + 1}`}.`);
  }, [catalog, commit, notify, state.devices, state.rack]);

  const moveDevice = useCallback((instanceId: string, startU: number) => {
    const device = state.devices.find((item) => item.instanceId === instanceId);
    const hardware = device ? catalog.find((item) => item.id === device.hardwareId) : null;
    if (!device || !hardware) return;
    const candidate = { ...device, startU };
    const check = checkPlacement(state.rack, state.devices, hardware, candidate, catalog);
    if (!check.valid) {
      notify(check.reason ?? 'That rack unit is unavailable.');
      return;
    }
    commit((current) => ({
      ...current,
      devices: current.devices.map((item) => item.instanceId === instanceId ? candidate : item),
      selectedId: instanceId,
      activePreset: null,
    }));
    notify(`${hardware.name} moved to U${startU + 1}.`);
  }, [catalog, commit, notify, state.devices, state.rack]);

  const updateSelected = useCallback((patch: Partial<PlacedDevice>) => {
    if (!selectedDevice || !selectedHardware) return;
    const patchWithSafeOverrides = patch.overrides === undefined
      ? patch
      : { ...patch, overrides: sanitizeOverrides(patch.overrides) };
    const candidate = { ...selectedDevice, ...patchWithSafeOverrides };
    if (candidate.overrides) {
      const overrides = { ...candidate.overrides };
      const effectiveTypical = overrides.typicalW ?? selectedHardware.typicalW;
      const effectivePeak = overrides.peakW ?? selectedHardware.peakW;
      if (effectivePeak < effectiveTypical) overrides.peakW = effectiveTypical;
      candidate.overrides = Object.keys(overrides).length ? overrides : undefined;
    }
    const check = checkPlacement(state.rack, state.devices, selectedHardware, candidate, catalog);
    if (!check.valid) {
      notify(check.reason ?? 'This change would create an invalid placement.');
      return;
    }
    commit((current) => ({
      ...current,
      devices: current.devices.map((device) => device.instanceId === selectedDevice.instanceId ? candidate : device),
      activePreset: null,
    }));
  }, [catalog, commit, notify, selectedDevice, selectedHardware, state.devices, state.rack]);

  const removeSelected = useCallback(() => {
    if (!selectedDevice) return;
    const name = selectedDevice.overrides?.label ?? selectedHardware?.name ?? 'Device';
    commit((current) => ({
      ...current,
      devices: current.devices.filter((device) => device.instanceId !== selectedDevice.instanceId),
      selectedId: null,
      activePreset: null,
    }));
    notify(`${name} removed. Undo is available.`);
  }, [commit, notify, selectedDevice, selectedHardware]);

  const duplicateSelected = useCallback(() => {
    if (!selectedDevice || !selectedHardware) return;
    const sourceHeight = selectedHardware.uHeight;
    const candidates: PlacedDevice[] = [];
    if (selectedDevice.mount === 'vertical') {
      const otherSide = selectedDevice.side === 'left' ? 'right' : 'left';
      candidates.push({ ...selectedDevice, instanceId: uid(), side: otherSide, overrides: selectedDevice.overrides ? { ...selectedDevice.overrides } : undefined });
    } else {
      for (let startU = selectedDevice.startU + sourceHeight; startU + sourceHeight <= state.rack.heightU; startU++) {
        candidates.push({ ...selectedDevice, instanceId: uid(), startU, overrides: selectedDevice.overrides ? { ...selectedDevice.overrides } : undefined });
      }
      for (let startU = 0; startU + sourceHeight <= state.rack.heightU; startU++) {
        candidates.push({ ...selectedDevice, instanceId: uid(), startU, overrides: selectedDevice.overrides ? { ...selectedDevice.overrides } : undefined });
      }
    }
    const duplicate = candidates.find((candidate) => checkPlacement(state.rack, state.devices, selectedHardware, candidate, catalog).valid);
    if (!duplicate) {
      notify('No valid space is available for another copy of this device.');
      return;
    }
    commit((current) => ({ ...current, devices: [...current.devices, duplicate], selectedId: duplicate.instanceId, activePreset: null }));
    notify(`${selectedHardware.name} duplicated.`);
  }, [catalog, commit, notify, selectedDevice, selectedHardware, state.devices, state.rack]);

  const patchRack = useCallback((patch: Partial<RackConfig>) => {
    commit((current) => {
      const rack = applyRackPatch(current.rack, patch);
      return { ...current, rack, activePreset: null };
    });
  }, [commit]);

  const saveCustom = (hardware: HardwareTemplate) => {
    commit((current) => ({ ...current, customHardware: [...current.customHardware, hardware] }));
    notify(`${hardware.name} saved to the reusable hardware library.`);
  };

  const deleteCustom = (id: string) => {
    if (state.devices.some((device) => device.hardwareId === id)) {
      notify('Remove all instances of this profile before deleting it.');
      return;
    }
    commit((current) => ({ ...current, customHardware: current.customHardware.filter((item) => item.id !== id) }));
    notify('Custom hardware profile deleted.');
  };

  const loadPreset = (id: string) => {
    const preset = RACK_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    const next = preset.build();
    commit((current): AppState => ({
      ...next,
      customHardware: current.customHardware,
      view: current.view,
      overlay: current.overlay,
    }));
    setPendingId(null);
    setModal(null);
    setRightTab('inspector');
    notify(`${preset.name} loaded.`);
  };

  const exportWorkspace = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${state.rack.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'rack'}.rackforge.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify('Workspace JSON exported.');
  };

  const importWorkspace = async (file: File) => {
    try {
      const imported = sanitizeImportedState(JSON.parse(await file.text()));
      commit(() => imported);
      setPendingId(null);
      setModal(null);
      notify('Workspace imported successfully.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not import this workspace.');
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === 'Escape') {
        setPendingId(null);
        setCommandOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (commandOpen) setCommandOpen(false);
        else if (!modal) setCommandOpen(true);
        return;
      }
      // Never steal native editing keys or shortcuts while a dialog/palette owns focus.
      if (editing || modal || commandOpen) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedId) {
        event.preventDefault();
        removeSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commandOpen, modal, redo, removeSelected, state.selectedId, undo]);

  return (
    <div className="flex h-screen min-h-[560px] flex-col overflow-hidden bg-ink text-white">
      <Header
        rackName={state.rack.name} severity={result.severity} canUndo={canUndo} canRedo={canRedo}
        leftOpen={leftOpen} rightOpen={rightOpen} onUndo={undo} onRedo={redo}
        onToggleLeft={() => setLeftOpen((open) => !open)} onToggleRight={() => setRightOpen((open) => !open)}
        onSettings={() => setModal('settings')} onCustom={() => setModal('custom')}
        onPresets={() => setModal('presets')} onReport={() => setModal('report')}
        onExport={exportWorkspace} onImport={() => importRef.current?.click()}
      />
      <WorkspaceHealthRibbon rack={state.rack} result={result} onReview={reviewTelemetry} onCommand={() => setCommandOpen(true)} />
      <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkspace(file); }} />

      <main className="relative flex min-h-0 flex-1">
        {leftOpen && (
          <>
            <div className="hidden w-[282px] shrink-0 lg:block"><LibraryPanel catalog={catalog} pendingId={pendingId} onPick={(item) => setPendingId((current) => current === item.id ? null : item.id)} onCustom={() => setModal('custom')} /></div>
            <div className="absolute inset-y-0 left-0 z-40 w-[300px] max-w-[88vw] shadow-panel lg:hidden">
              <button className="absolute inset-0 bg-black/60" onClick={() => setLeftOpen(false)} aria-label="Close library drawer" />
              <div className="relative h-full"><LibraryPanel catalog={catalog} pendingId={pendingId} onPick={(item) => { setPendingId((current) => current === item.id ? null : item.id); if (window.innerWidth < 1024) setLeftOpen(false); }} onCustom={() => { setModal('custom'); setLeftOpen(false); }} onClose={() => setLeftOpen(false)} /></div>
            </div>
          </>
        )}

        <div className="min-w-0 flex-1"><RackStage rack={state.rack} devices={state.devices} catalog={catalog} selectedId={state.selectedId} pendingHardware={pendingHardware} view={state.view} overlay={state.overlay} result={result} contextHud={!rightOpen} onViewChange={changeView} onOverlayChange={changeOverlay} onSelect={select} onUpdateSelected={updateSelected} onDuplicateSelected={duplicateSelected} onRemoveSelected={removeSelected} onPlace={placeDevice} onMove={moveDevice} onCancelPending={() => setPendingId(null)} /></div>

        {rightOpen && (
          <>
            <div className="hidden w-[308px] shrink-0 lg:block">
              <div className="flex h-full flex-col">
                <div className="flex h-9 shrink-0 border-b border-line bg-panel2/60">
                  <button onClick={() => setRightTab('inspector')} className={`flex-1 border-r border-line text-[9px] font-bold uppercase tracking-[0.12em] transition ${rightTab === 'inspector' ? 'bg-accent/[0.06] text-accent' : 'text-muted hover:text-white'}`}>Inspector</button>
                  <button onClick={() => setRightTab('telemetry')} className={`flex-1 text-[9px] font-bold uppercase tracking-[0.12em] transition ${rightTab === 'telemetry' ? 'bg-accent/[0.06] text-accent' : 'text-muted hover:text-white'}`}>Telemetry</button>
                </div>
                <div className="min-h-0 flex-1">
                  {rightTab === 'inspector' ? <InspectorPanel device={selectedDevice} hardware={selectedHardware} telemetry={selectedTelemetry} rack={state.rack} onUpdate={updateSelected} onDuplicate={duplicateSelected} onRemove={removeSelected} onResetOverrides={() => updateSelected({ overrides: undefined })} /> : <TelemetryPanel rack={state.rack} result={result} onRackPatch={patchRack} onSelectDevice={select} />}
                </div>
              </div>
            </div>
            <div className="absolute inset-y-0 right-0 z-40 w-[320px] max-w-[92vw] shadow-panel lg:hidden">
              <button className="absolute inset-0 bg-black/60" onClick={() => setRightOpen(false)} aria-label="Close inspector drawer" />
              <div className="relative flex h-full flex-col">
                <div className="flex h-9 shrink-0 border-b border-line bg-panel2"><button onClick={() => setRightTab('inspector')} className={`flex-1 border-r border-line text-[9px] font-bold uppercase tracking-wider ${rightTab === 'inspector' ? 'text-accent' : 'text-muted'}`}>Inspector</button><button onClick={() => setRightTab('telemetry')} className={`flex-1 text-[9px] font-bold uppercase tracking-wider ${rightTab === 'telemetry' ? 'text-accent' : 'text-muted'}`}>Telemetry</button><button onClick={() => setRightOpen(false)} className="w-9 text-muted"><X size={14} className="mx-auto" /></button></div>
                <div className="min-h-0 flex-1">{rightTab === 'inspector' ? <InspectorPanel device={selectedDevice} hardware={selectedHardware} telemetry={selectedTelemetry} rack={state.rack} onUpdate={updateSelected} onDuplicate={duplicateSelected} onRemove={removeSelected} onResetOverrides={() => updateSelected({ overrides: undefined })} onClose={() => setRightOpen(false)} /> : <TelemetryPanel rack={state.rack} result={result} onRackPatch={patchRack} onSelectDevice={(id) => { select(id); if (window.innerWidth < 1024) setRightOpen(false); }} />}</div>
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-line bg-panel px-3 font-mono text-[8px] text-muted">
        <div className="flex items-center gap-3"><span className="flex items-center gap-1"><Activity size={10} className="text-success" /> SIM ONLINE</span><span className="hidden items-center gap-1 sm:flex"><Cpu size={10} /> {result.activeDevices.length} active</span><span className="hidden items-center gap-1 sm:flex"><HardDrive size={10} /> {state.devices.length} installed</span><span className="hidden items-center gap-1 md:flex"><Server size={10} /> {state.rack.heightU}U {state.rack.form.replace('-', ' ')}</span></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-1 lg:flex"><Keyboard size={10} /> DEL remove · CTRL+Z undo · CTRL+K commands</span><span className="flex items-center gap-1"><CheckCircle2 size={10} className="text-success" /> LOCAL AUTOSAVE</span><Command size={9} /></div>
      </footer>

      {toast && (
        <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-10 left-1/2 z-[70] flex max-w-[90vw] -translate-x-1/2 items-start gap-2 rounded-xl border border-line bg-panel2/95 px-4 py-3 text-[11px] text-white shadow-panel backdrop-blur-xl">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-success" /><span>{toast}</span><button onClick={() => setToast(null)} className="ml-2 text-muted hover:text-white"><X size={12} /></button>
        </div>
      )}

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        rackName={state.rack.name}
        catalog={catalog}
        selectedDevice={selectedDevice}
        selectedHardware={selectedHardware}
        onPickHardware={(item) => setPendingId(item.id)}
        onViewChange={changeView}
        onOverlayChange={changeOverlay}
        onLoadPreset={(id) => { setCommandOpen(false); loadPreset(id); }}
        onOpenPresets={() => { setCommandOpen(false); setModal('presets'); }}
        onOpenSettings={() => { setCommandOpen(false); setModal('settings'); }}
        onOpenCustom={() => { setCommandOpen(false); setModal('custom'); }}
        onOpenReport={() => { setCommandOpen(false); setModal('report'); }}
        onExport={() => { setCommandOpen(false); exportWorkspace(); }}
        onImport={() => { setCommandOpen(false); importRef.current?.click(); }}
        onReviewTelemetry={() => { setCommandOpen(false); reviewTelemetry(); }}
        onOpenLibrary={() => { setCommandOpen(false); setLeftOpen(true); }}
        onUpdateSelected={updateSelected}
        onDuplicate={duplicateSelected}
        onRemove={removeSelected}
      />

      {modal === 'settings' && <RackSettingsModal rack={state.rack} devices={state.devices} catalog={catalog} onSave={(rack) => { commit((current) => ({ ...current, rack, activePreset: null })); setModal(null); notify('Rack configuration updated.'); }} onClose={() => setModal(null)} />}
      {modal === 'custom' && <CustomHardwareModal existing={state.customHardware} onSave={saveCustom} onDelete={deleteCustom} onClose={() => setModal(null)} />}
      {modal === 'presets' && <PresetsModal activePreset={state.activePreset} onLoad={loadPreset} onClose={() => setModal(null)} />}
      {modal === 'report' && <ReportModal rack={state.rack} devices={state.devices} catalog={catalog} result={result} onClose={() => setModal(null)} onNotify={notify} />}
    </div>
  );
}
