import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import {
  Box, ChevronLeft, ChevronRight, Expand, Focus, Gauge,
  Layers3, Pause, Play, LoaderCircle, RotateCcw, ScanLine, Thermometer, Weight, Wind, X, Zap,
} from 'lucide-react';
import { Rack2D } from './Rack2D';
import { TelemetryBento } from './TelemetryBento';
import { DeviceHud } from './DeviceHud';
import { IconButton } from './ui';
import type { HardwareTemplate, OverlayMode, PlacedDevice, RackConfig, SimulationResult, ViewMode } from '../types';
import type { AirflowField } from '../lib/airflow';

const Rack3D = lazy(() => import('./Rack3D').then((module) => ({ default: module.Rack3D })));

interface RackStageProps {
  rack: RackConfig;
  devices: PlacedDevice[];
  catalog: HardwareTemplate[];
  selectedId: string | null;
  pendingHardware: HardwareTemplate | null;
  view: ViewMode;
  overlay: OverlayMode;
  result: SimulationResult;
  field?: AirflowField | null;
  contextHud: boolean;
  onViewChange: (view: ViewMode) => void;
  onOverlayChange: (overlay: OverlayMode) => void;
  onSelect: (id: string | null) => void;
  onUpdateSelected: (patch: Partial<PlacedDevice>) => void;
  onDuplicateSelected: () => void;
  onRemoveSelected: () => void;
  onPlace: (hardwareId: string, startU: number, mount: 'front' | 'rear') => void;
  onMove: (instanceId: string, startU: number) => void;
  onCancelPending: () => void;
}

export function RackStage(props: RackStageProps) {
  const [side, setSide] = useState<'front' | 'rear'>('front');
  const [cutaway, setCutaway] = useState(true);
  const [xray, setXray] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const flowAnimationEnabled = animationEnabled && !reducedMotion;
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const selectedDevice = props.devices.find((device) => device.instanceId === props.selectedId) ?? null;
  const selectedHardware = selectedDevice ? props.catalog.find((item) => item.id === selectedDevice.hardwareId) ?? null : null;
  const selectedTelemetry = selectedDevice ? props.result.telemetry.find((item) => item.instanceId === selectedDevice.instanceId) ?? null : null;
  const showFlow = props.overlay === 'airflow' || props.overlay === 'thermal';
  const airs = {
    avgIntake: props.result.airflowReport?.averageIntakeC ?? props.rack.ambientC,
    avgExhaust: props.result.airflowReport?.averageExhaustC ?? props.result.averageExhaustC,
    deltaT: props.result.airflowReport?.rackDeltaT ?? (props.result.averageExhaustC - props.rack.ambientC),
  };
  const overlayOptions: { id: OverlayMode; label: string; icon: ReactNode }[] = [
    { id: 'normal', label: 'Normal', icon: <Box size={12} /> },
    { id: 'airflow', label: 'Airflow', icon: <Wind size={12} /> },
    { id: 'thermal', label: 'Thermal', icon: <Thermometer size={12} /> },
    { id: 'power', label: 'Power', icon: <Zap size={12} /> },
    { id: 'weight', label: 'Weight', icon: <Weight size={12} /> },
  ];

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-ink">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-panel px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-line bg-ink p-0.5">
            <button type="button" aria-pressed={props.view === '3d'} onClick={() => props.onViewChange('3d')} className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition ${props.view === '3d' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white'}`}><Box size={13} /> 3D</button>
            <button type="button" aria-pressed={props.view === '2d'} onClick={() => props.onViewChange('2d')} className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-semibold transition ${props.view === '2d' ? 'bg-accent/15 text-accent' : 'text-muted hover:text-white'}`}><Layers3 size={13} /> 2D</button>
          </div>
          <div className="hidden h-5 w-px bg-line sm:block" />
          <div className="flex max-w-[260px] items-center gap-0.5 overflow-x-auto rounded-lg border border-line bg-ink p-0.5 scrollbar-none sm:max-w-none">
            {overlayOptions.map((option) => (
              <button key={option.id} type="button" aria-pressed={props.overlay === option.id} onClick={() => props.onOverlayChange(option.id)} title={`${option.label} overlay`} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[9px] font-medium transition ${props.overlay === option.id ? 'bg-white/10 text-white' : 'text-muted hover:text-white'}`}>{option.icon}<span className="hidden xl:inline">{option.label}</span></button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {showFlow && (
            <div className="flex items-center rounded-lg border border-accent/20 bg-accent/[0.06] p-0.5">
              <IconButton label={animationEnabled ? 'Pause airflow animation' : 'Play airflow animation'} onClick={() => setAnimationEnabled((enabled) => !enabled)} active={animationEnabled} className="border-0 bg-transparent">
                {animationEnabled ? <Pause size={12} /> : <Play size={12} />}
              </IconButton>
              <button type="button" aria-label="Change airflow animation speed" title="Change airflow animation speed" onClick={() => setSpeedMultiplier((speed) => speed >= 2 ? 0.5 : speed === 0.5 ? 1 : speed === 1 ? 1.5 : 2)} className="flex h-7 min-w-9 items-center justify-center rounded-md px-1 font-mono text-[9px] text-accent hover:bg-accent/10">
                {speedMultiplier}×
              </button>
            </div>
          )}
          {props.view === '2d' ? (
            <div className="flex rounded-lg border border-line bg-ink p-0.5">
              <button type="button" aria-pressed={side === 'front'} onClick={() => setSide('front')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[9px] font-medium ${side === 'front' ? 'bg-electric/15 text-electric' : 'text-muted'}`}><ChevronLeft size={12} /> Front</button>
              <button type="button" aria-pressed={side === 'rear'} onClick={() => setSide('rear')} className={`flex h-7 items-center gap-1 rounded-md px-2 text-[9px] font-medium ${side === 'rear' ? 'bg-electric/15 text-electric' : 'text-muted'}`}>Rear <ChevronRight size={12} /></button>
            </div>
          ) : (
            <>
              <button type="button" aria-pressed={cutaway} onClick={() => setCutaway(!cutaway)} className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-medium transition md:flex ${cutaway ? 'border-accent/30 bg-accent/10 text-accent' : 'border-line bg-panel2 text-muted'}`}><ScanLine size={13} /> Cutaway</button>
              <button type="button" aria-pressed={xray} onClick={() => setXray(!xray)} className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[9px] font-medium transition md:flex ${xray ? 'border-electric/30 bg-electric/10 text-electric' : 'border-line bg-panel2 text-muted'}`}><Expand size={13} /> X-ray</button>
              <IconButton label="Reset camera" onClick={() => setResetKey((key) => key + 1)}><Focus size={14} /></IconButton>
            </>
          )}
          <IconButton label="Refresh view" onClick={() => setResetKey((key) => key + 1)} className="md:hidden"><RotateCcw size={14} /></IconButton>
        </div>
      </div>

      {props.pendingHardware && (
        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-accent/20 bg-accent/[0.07] px-3 py-2 text-[10px] text-accent">
          <span className="h-1.5 w-1.5 animate-pulseSoft rounded-full bg-accent" />
          <span className="truncate"><strong>{props.pendingHardware.name}</strong> selected · click a rack unit{props.pendingHardware.uHeight === 0 ? ' or rail' : ''} to place</span>
          <button onClick={props.onCancelPending} className="ml-1 rounded p-0.5 hover:bg-accent/10" aria-label="Cancel placement"><X size={13} /></button>
        </div>
      )}

      <TelemetryBento rack={props.rack} result={props.result} />

      <div className="relative min-h-0 flex-1">
        {props.contextHud && selectedDevice && selectedHardware && !props.pendingHardware && (
          <DeviceHud
            device={selectedDevice}
            hardware={selectedHardware}
            telemetry={selectedTelemetry}
            rack={props.rack}
            onUpdate={props.onUpdateSelected}
            onDuplicate={props.onDuplicateSelected}
            onRemove={props.onRemoveSelected}
            onClose={() => props.onSelect(null)}
          />
        )}
        {showFlow && (
          <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-accent/25 bg-ink/80 px-2.5 py-1.5 backdrop-blur-md">
            <span className={`h-1.5 w-1.5 rounded-full bg-accent ${flowAnimationEnabled ? 'animate-pulseSoft' : ''}`} />
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">{props.overlay === 'airflow' ? 'Live airflow model' : 'Thermal + flow model'}</span>
          </div>
        )}
        {props.view === '3d' ? (
          <Suspense fallback={<div className="flex h-full flex-col items-center justify-center gap-3 bg-ink"><LoaderCircle size={24} className="animate-spin text-accent" /><p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted">Initializing 3D engine</p></div>}>
            <Rack3D
              rack={props.rack} devices={props.devices} catalog={props.catalog} selectedId={props.selectedId}
              pendingHardware={props.pendingHardware} overlay={props.overlay} result={props.result}
              cutaway={cutaway} xray={xray} resetKey={resetKey} animationEnabled={flowAnimationEnabled} speedMultiplier={speedMultiplier} onSelect={props.onSelect} onPlace={props.onPlace} field={props.field ?? null}
            />
          </Suspense>
        ) : (
          <Rack2D
            rack={props.rack} devices={props.devices} catalog={props.catalog} selectedId={props.selectedId}
            pendingHardware={props.pendingHardware} viewSide={side} overlay={props.overlay} result={props.result} animationEnabled={flowAnimationEnabled} speedMultiplier={speedMultiplier}
            onSelect={props.onSelect} onPlace={props.onPlace} onMove={props.onMove}
          />
        )}
        {showFlow && (
          <div className="pointer-events-none absolute bottom-4 right-4 w-[228px] rounded-xl border border-line/80 bg-ink/85 p-3 backdrop-blur-md">
            {props.overlay === 'airflow' ? (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-white"><Wind size={11} className="text-accent" /> Airflow pathways</p>
                  <span className="font-mono text-[9px] text-accent">{props.result.airflowEfficiencyPct.toFixed(0)}% eff.</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 text-[8px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-electric" /> Cold intake</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-[#d47a4f]" /> Hot exhaust</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-danger" /> Recirculation</span>
                  <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-electric/50" /> Bypass air</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-line pt-2 font-mono text-[8px] text-muted">
                  <span>Intake <span className="text-white">{airs.avgIntake.toFixed(1)}°C</span></span>
                  <span>Exhaust <span className="text-white">{airs.avgExhaust.toFixed(1)}°C</span></span>
                  <span>Recirc <span className="text-danger">{props.result.recirculationRiskPct.toFixed(0)}%</span></span>
                  <span>Bypass <span className="text-electric">{props.result.bypassRiskPct.toFixed(0)}%</span></span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[8px] text-muted"><span className="flex items-center gap-1"><Gauge size={10} /> {Math.round(props.result.estimatedAirflowCfm).toLocaleString()} CFM</span><span>{props.result.recirculationGaps.length} open gaps</span></div>
                <p className="mt-1.5 font-mono text-[7px] text-muted/80">CFD grid {props.field ? `${props.field.grid.nx}×${props.field.grid.ny}×${props.field.grid.nz}` : '—'} · ΔT {airs.deltaT.toFixed(1)}K · residual {props.result.airflowReport ? props.result.airflowReport.divergenceResidual.toFixed(2) : '—'}</p>
                {props.view === '2d' && <p className="mt-2 text-[7px] leading-relaxed text-muted">2D elevation has no depth axis; vertical marks show U-axis motion. Use 3D for front→rear airflow.</p>}
              </>
            ) : (
              <>
                <p className="mb-1.5 font-mono text-[8px] uppercase tracking-wider text-muted">Intake → exhaust gradient</p>
                <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-electric via-warning to-danger" />
                <div className="mt-1 flex justify-between font-mono text-[8px] text-muted"><span>{props.rack.ambientC}°C</span><span>{props.result.averageExhaustC.toFixed(1)}°C</span></div>
                <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[8px] text-muted"><span>Flow efficiency</span><span className="text-accent">{props.result.airflowEfficiencyPct.toFixed(0)}%</span></div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
