import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { RACK_PRESETS } from '../data/presets';
import { HARDWARE_CATALOG } from '../data/catalog';
import { checkPlacement } from '../lib/simulation';
import type {
  Airflow,
  AppState,
  Category,
  FanProfile,
  HardwareTemplate,
  PlacedDevice,
  RackConfig,
  RackForm,
  RackZone,
  Redundancy,
} from '../types';

const STORAGE_KEY = 'rackforge.workspace.v1';
const HISTORY_LIMIT = 80;

interface HistoryState {
  present: AppState;
  past: AppState[];
  future: AppState[];
}

type Updater = (state: AppState) => AppState;
type HistoryAction =
  | { type: 'commit'; updater: Updater }
  | { type: 'transient'; updater: Updater }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

export const defaultState = (): AppState =>
  (RACK_PRESETS.find((preset) => preset.id === 'enterprise-42u') ?? RACK_PRESETS[0]).build();

function historyReducer(history: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case 'commit': {
      const next = action.updater(history.present);
      if (next === history.present || JSON.stringify(next) === JSON.stringify(history.present)) return history;
      return {
        present: next,
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        future: [],
      };
    }
    case 'transient':
      return { ...history, present: action.updater(history.present) };
    case 'undo': {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        present: previous,
        past: history.past.slice(0, -1),
        future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
      };
    }
    case 'redo': {
      const next = history.future[0];
      if (!next) return history;
      return {
        present: next,
        past: [...history.past, history.present].slice(-HISTORY_LIMIT),
        future: history.future.slice(1),
      };
    }
    case 'reset':
      return { present: defaultState(), past: [], future: [] };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberOr(value: unknown, fallback: number): number {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function textOr(value: unknown, fallback: string, maxLength = 500): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function enumOr<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((entry) => entry === value) ?? fallback;
}

const RACK_HEIGHTS = [12, 24, 42, 48] as const;
const RACK_WIDTHS = [600, 800] as const;
const RACK_DEPTHS = [800, 1000, 1200] as const;
const RACK_FORMS = ['open-2post', 'open-4post', 'enclosed'] as const;
const FAN_PROFILES = ['eco', 'balanced', 'max'] as const;
const COOLING_ORIENTATIONS: NonNullable<RackConfig['coolingOrientation']>[] = ['front-to-back', 'reverse', 'bottom-to-top', 'front-only'];
const REDUNDANCIES = ['N', 'N+1', '2N'] as const;
const VOLTAGES = [120, 208, 230, 240] as const;
const CATEGORIES = ['compute', 'sbc', 'storage', 'network', 'power', 'thermal', 'accessory'] as const;
const AIRFLOWS = ['front-to-back', 'back-to-front', 'side-to-side', 'passive'] as const;

function normalizeZone(value: unknown, heightU: number, index: number): RackZone | null {
  if (!isRecord(value)) return null;
  const startU = clamp(Math.floor(numberOr(value.startU, -1)), 0, heightU);
  const endU = clamp(Math.floor(numberOr(value.endU, -1)), 0, heightU);
  if (endU <= startU) return null;
  if (value.kind !== 'blocked' && value.kind !== 'reserved') return null;
  return {
    id: textOr(value.id, `zone-${index + 1}-${startU}-${endU}`, 100),
    name: textOr(value.name, `Zone ${index + 1}`, 200),
    startU,
    endU,
    kind: value.kind,
  };
}

function normalizeRack(value: Record<string, unknown>): RackConfig {
  const heightU = RACK_HEIGHTS.find((entry) => numberOr(value.heightU, 42) === entry) ?? 42;
  const widthMm = RACK_WIDTHS.find((entry) => numberOr(value.widthMm, 800) === entry) ?? 800;
  const depthMm = RACK_DEPTHS.find((entry) => numberOr(value.depthMm, 1000) === entry) ?? 1000;
  const staticRatingKg = Math.max(0, numberOr(value.staticRatingKg, 1000));
  const rollingRatingKg = clamp(numberOr(value.rollingRatingKg, staticRatingKg), 0, staticRatingKg);
  const zones = (Array.isArray(value.zones) ? value.zones : [])
    .map((zone, index) => normalizeZone(zone, heightU, index))
    .filter((zone): zone is RackZone => zone !== null);

  return {
    name: textOr(value.name, 'Untitled Rack', 200),
    heightU,
    widthMm,
    depthMm,
    form: enumOr<RackForm>(value.form, RACK_FORMS, 'enclosed'),
    perforatedDoors: value.perforatedDoors === true,
    sidePanels: value.sidePanels !== false,
    staticRatingKg,
    rollingRatingKg,
    voltage: (VOLTAGES.find((entry) => numberOr(value.voltage, 230) === entry) ?? 230) as RackConfig['voltage'],
    phases: value.phases === 3 ? 3 : 1,
    circuitAAmps: Math.max(0, numberOr(value.circuitAAmps, 20)),
    circuitBAmps: Math.max(0, numberOr(value.circuitBAmps, 20)),
    redundancy: enumOr<Redundancy>(value.redundancy, REDUNDANCIES, 'N+1'),
    ambientC: clamp(numberOr(value.ambientC, 22), -50, 80),
    coolingKw: Math.max(0.0001, numberOr(value.coolingKw, 8)),
    fanProfile: enumOr<FanProfile>(value.fanProfile, FAN_PROFILES, 'balanced'),
    electricityRate: Math.max(0, numberOr(value.electricityRate, 0.18)),
    coolingOrientation: enumOr<NonNullable<RackConfig['coolingOrientation']>>(value.coolingOrientation, COOLING_ORIENTATIONS, 'front-to-back'),
    zones,
  };
}

function normalizeOverrides(value: unknown): PlacedDevice['overrides'] {
  if (!isRecord(value)) return undefined;
  const overrides: NonNullable<PlacedDevice['overrides']> = {};
  if (typeof value.label === 'string' && value.label.trim()) overrides.label = value.label.trim().slice(0, 200);
  const typicalW = numberOr(value.typicalW, NaN);
  const peakW = numberOr(value.peakW, NaN);
  const weightKg = numberOr(value.weightKg, NaN);
  if (Number.isFinite(typicalW) && typicalW >= 0) overrides.typicalW = typicalW;
  if (Number.isFinite(peakW) && peakW >= 0) overrides.peakW = peakW;
  if (Number.isFinite(weightKg) && weightKg >= 0) overrides.weightKg = weightKg;
  return Object.keys(overrides).length ? overrides : undefined;
}

function normalizeHardware(value: unknown, id: string): HardwareTemplate | null {
  if (!isRecord(value)) return null;
  const name = textOr(value.name, '', 200);
  if (!name) return null;
  const rawUHeight = numberOr(value.uHeight, NaN);
  const rawDepthMm = numberOr(value.depthMm, NaN);
  const rawWidthMm = numberOr(value.widthMm, NaN);
  const rawWeightKg = numberOr(value.weightKg, NaN);
  const rawTypicalW = numberOr(value.typicalW, NaN);
  const rawPeakW = numberOr(value.peakW, NaN);
  const rawRatedW = numberOr(value.ratedW, NaN);
  if (!Number.isInteger(rawUHeight) || rawUHeight < 0 || rawUHeight > 12) return null;
  if (!Number.isFinite(rawDepthMm) || rawDepthMm <= 0 || !Number.isFinite(rawWidthMm) || rawWidthMm <= 0) return null;
  if (!Number.isFinite(rawWeightKg) || rawWeightKg < 0 || ![rawTypicalW, rawPeakW, rawRatedW].every((entry) => Number.isFinite(entry) && entry >= 0)) return null;
  if (rawPeakW < rawTypicalW || rawRatedW < rawPeakW) return null;
  const uHeight = rawUHeight;
  const depthMm = rawDepthMm;
  const widthMm = rawWidthMm;
  const weightKg = rawWeightKg;
  const typicalW = rawTypicalW;
  const peakW = rawPeakW;
  const ratedW = rawRatedW;
  if (!CATEGORIES.includes(value.category as Category)) return null;
  if (!AIRFLOWS.includes(value.airflow as Airflow)) return null;
  return {
    id,
    name,
    vendor: textOr(value.vendor, 'Custom', 200),
    category: value.category as Category,
    subtype: textOr(value.subtype, 'Custom', 200),
    uHeight,
    depthMm,
    widthMm,
    weightKg,
    ratedW,
    typicalW,
    peakW,
    airflow: value.airflow as Airflow,
    ports: typeof value.ports === 'string' ? value.ports.slice(0, 1000) : '',
    description: typeof value.description === 'string' ? value.description.slice(0, 2000) : '',
    color: textOr(value.color, '#8fa9bf', 100),
    custom: true,
  };
}

export function sanitizeImportedState(value: unknown): AppState {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.rack) || !Array.isArray(value.devices)) {
    throw new Error('Not a valid RackForge workspace file.');
  }
  const rack = normalizeRack(value.rack);
  const rawCustom = Array.isArray(value.customHardware) ? value.customHardware : [];
  const knownBuiltInIds = new Set(HARDWARE_CATALOG.map((item) => item.id));
  const customHardware: HardwareTemplate[] = [];
  const customIds = new Set<string>();
  for (const raw of rawCustom) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim()) continue;
    const id = raw.id.trim().slice(0, 200);
    if (customIds.has(id) || knownBuiltInIds.has(id)) continue;
    const hardware = normalizeHardware(raw, id);
    if (!hardware) continue;
    customIds.add(id);
    customHardware.push(hardware);
  }

  const knownHardware = new Set([...knownBuiltInIds, ...customIds]);
  const acceptedDevices: PlacedDevice[] = [];
  const usedInstanceIds = new Set<string>();
  for (const raw of value.devices) {
    if (!isRecord(raw)) continue;
    const instanceId = typeof raw.instanceId === 'string' ? raw.instanceId.trim().slice(0, 200) : '';
    const hardwareId = typeof raw.hardwareId === 'string' ? raw.hardwareId.trim() : '';
    if (!instanceId || !hardwareId || !knownHardware.has(hardwareId) || usedInstanceIds.has(instanceId)) continue;
    const rawMount = raw.mount;
    const rawStatus = raw.status;
    const rawPdu = raw.pdu;
    const rawSide = raw.side;
    if (rawMount !== 'front' && rawMount !== 'rear' && rawMount !== 'vertical') continue;
    if (rawStatus !== 'active' && rawStatus !== 'reserved') continue;
    if (rawPdu !== 'A' && rawPdu !== 'B') continue;
    if (rawSide !== 'left' && rawSide !== 'right') continue;
    const startU = Math.floor(numberOr(raw.startU, -1));
    const candidate: PlacedDevice = {
      instanceId,
      hardwareId,
      startU,
      status: rawStatus,
      mount: rawMount,
      pdu: rawPdu,
      side: rawSide,
      flipped: raw.flipped === true,
      overrides: normalizeOverrides(raw.overrides),
    };
    const hardware = HARDWARE_CATALOG.find((item) => item.id === hardwareId) ?? customHardware.find((item) => item.id === hardwareId);
    if (!hardware) continue;
    const completeCatalog = [...HARDWARE_CATALOG, ...customHardware];
    const check = checkPlacement(rack, acceptedDevices, hardware, candidate, completeCatalog);
    if (!check.valid) continue;
    usedInstanceIds.add(instanceId);
    acceptedDevices.push(candidate);
  }

  const selectedId = typeof value.selectedId === 'string' && usedInstanceIds.has(value.selectedId) ? value.selectedId : null;
  return {
    version: 1,
    rack,
    devices: acceptedDevices,
    customHardware,
    selectedId,
    view: value.view === '2d' ? '2d' : '3d',
    overlay: enumOr<AppState['overlay']>(value.overlay, ['normal', 'airflow', 'thermal', 'power', 'weight'] as const, 'normal'),
    activePreset: typeof value.activePreset === 'string' ? value.activePreset : null,
  };
}

const OVERLAYS: AppState['overlay'][] = ['normal', 'airflow', 'thermal', 'power', 'weight'];

function loadInitialState(): AppState {
  let base: AppState;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    base = saved ? sanitizeImportedState(JSON.parse(saved)) : defaultState();
  } catch {
    // A malformed local workspace should never prevent the application from starting.
    base = defaultState();
  }
  // convenience deep-link: ?overlay=airflow|thermal|power|weight|normal
  try {
    const overlayParam = new URLSearchParams(globalThis.location?.search ?? '').get('overlay');
    if (overlayParam && (OVERLAYS as string[]).includes(overlayParam)) return { ...base, overlay: overlayParam as AppState['overlay'] };
  } catch { /* ignore */ }
  return base;
}

export function useRackState() {
  const [history, dispatch] = useReducer(historyReducer, undefined, () => ({ present: loadInitialState(), past: [], future: [] }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.present));
    } catch {
      // Private browsing and quota errors are non-fatal; export remains available.
    }
  }, [history.present]);

  const commit = useCallback((updater: Updater) => dispatch({ type: 'commit', updater }), []);
  const transient = useCallback((updater: Updater) => dispatch({ type: 'transient', updater }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return useMemo(() => ({
    state: history.present,
    commit,
    transient,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }), [history, commit, transient, undo, redo, reset]);
}
