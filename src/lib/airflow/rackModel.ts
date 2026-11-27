import type { Airflow, HardwareTemplate, PlacedDevice, RackConfig, SimulationResult } from '../../types';
import { FluidSolver, type BoundaryConditions } from './fluidSolver';
import type { CoolingOrientation } from './types';

export const U_HEIGHT_MM = 44.45;
export const MM_SCALE = 1 / 250;
export const SCENE_PER_METER = 1000 * MM_SCALE; // 4
const MM = 0.001; // mm -> m

export interface DeviceModel {
  instanceId: string;
  hardwareId: string;
  name: string;
  airflow: Airflow;
  heatW: number;
  /** volumetric flow through device (m³/s) */
  flowM3s: number;
  /** world-metre bbox */
  min: [number, number, number];
  max: [number, number, number];
  /** world-metre intake port + outward normal */
  intake: { point: [number, number, number]; normal: [number, number, number] };
  /** world-metre exhaust port + outward normal */
  exhaust: { point: [number, number, number]; normal: [number, number, number] };
  /** scene-space ports for rendering */
  intakeScene: [number, number, number];
  exhaustScene: [number, number, number];
  /** fan velocity magnitude (m/s) injected inside device */
  fanSpeedMps: number;
  /** exhaust direction (unit) */
  exhaustNormal: [number, number, number];
}

export interface RackModel {
  solver: FluidSolver;
  devices: DeviceModel[];
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  rackMin: [number, number, number];
  rackMax: [number, number, number];
  ambientC: number;
  orientation: CoolingOrientation;
  boundary: BoundaryConditions;
  inletSpeedMps: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function deviceBbox(rack: RackConfig, device: PlacedDevice, hw: HardwareTemplate): { min: [number, number, number]; max: [number, number, number] } {
  const W = rack.widthMm * MM;
  const D = rack.depthMm * MM;
  const u = U_HEIGHT_MM * MM;
  const wM = num(hw.widthMm, 482) * MM;
  const dM = num(hw.depthMm, 400) * MM;
  const hU = num(hw.uHeight, 1);
  const startU = num(device.startU, 0);
  const y0 = startU * u;
  const y1 = (startU + Math.max(hU, 0)) * u;
  // horizontal centering
  const x0 = -wM / 2;
  const x1 = wM / 2;
  let z0: number;
  let z1: number;
  if (device.mount === 'rear') {
    z1 = -D / 2 + 0.03 + dM; // rear mount extends into rack
    z0 = -D / 2 + 0.03;
  } else if (device.mount === 'vertical') {
    z0 = -D / 2 + 0.03;
    z1 = -D / 2 + 0.03 + dM;
  } else {
    z0 = D / 2 - 0.03 - dM; // front mount
    z1 = D / 2 - 0.03;
  }
  void W;
  return { min: [x0, y0, z0], max: [x1, Math.max(y1, y0 + u * 0.5), z1] };
}

function airflowPorts(
  min: [number, number, number],
  max: [number, number, number],
  airflow: Airflow,
  device: PlacedDevice,
): { intake: { point: [number, number, number]; normal: [number, number, number] }; exhaust: { point: [number, number, number]; normal: [number, number, number] }; exhaustNormal: [number, number, number] } {
  const cx = (min[0] + max[0]) / 2;
  const cy = (min[1] + max[1]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const reverseSide = device.side === 'right' || device.flipped;
  let intakeNormal: [number, number, number];
  let exhaustNormal: [number, number, number];
  if (airflow === 'front-to-back') {
    intakeNormal = [0, 0, 1]; exhaustNormal = [0, 0, -1];
  } else if (airflow === 'back-to-front') {
    intakeNormal = [0, 0, -1]; exhaustNormal = [0, 0, 1];
  } else if (airflow === 'side-to-side') {
    if (reverseSide) { intakeNormal = [1, 0, 0]; exhaustNormal = [-1, 0, 0]; }
    else { intakeNormal = [-1, 0, 0]; exhaustNormal = [1, 0, 0]; }
  } else {
    intakeNormal = [0, 0, 0]; exhaustNormal = [0, 0, 0];
  }
  const intake: [number, number, number] = [cx + intakeNormal[0] * (max[0] - min[0]) / 2, cy + intakeNormal[1] * (max[1] - min[1]) / 2, cz + intakeNormal[2] * (max[2] - min[2]) / 2];
  const exhaust: [number, number, number] = [cx + exhaustNormal[0] * (max[0] - min[0]) / 2, cy + exhaustNormal[1] * (max[1] - min[1]) / 2, cz + exhaustNormal[2] * (max[2] - min[2]) / 2];
  return { intake: { point: intake, normal: intakeNormal }, exhaust: { point: exhaust, normal: exhaustNormal }, exhaustNormal };
}

export function buildRackModel(
  rack: RackConfig,
  devices: PlacedDevice[],
  catalog: HardwareTemplate[],
  result: SimulationResult,
  options?: { steps?: number; resolution?: number; orientation?: CoolingOrientation; inletSpeedMps?: number; includeFacilityBottomInlet?: boolean },
): RackModel {
  const W = rack.widthMm * MM;
  const D = rack.depthMm * MM;
  const H = rack.heightU * U_HEIGHT_MM * MM;
  const ambientC = num(rack.ambientC, 22);

  const orientation: CoolingOrientation = options?.orientation
    ?? (rack as RackConfig & { coolingOrientation?: CoolingOrientation }).coolingOrientation
    ?? 'front-to-back';

  // domain margins (metres)
  const frontMargin = 0.45;
  const rearMargin = 0.45;
  const sideMargin = 0.3;
  const topMargin = 0.55;
  const bottomMargin = 0.3;

  const rackMin: [number, number, number] = [-W / 2, 0, -D / 2];
  const rackMax: [number, number, number] = [W / 2, H, D / 2];
  const domainMin: [number, number, number] = [-W / 2 - sideMargin, -bottomMargin, -D / 2 - rearMargin];
  const domainMax: [number, number, number] = [W / 2 + sideMargin, H + topMargin, D / 2 + frontMargin];

  const domainSize: [number, number, number] = [domainMax[0] - domainMin[0], domainMax[1] - domainMin[1], domainMax[2] - domainMin[2]];
  const targetRes = Math.max(8, options?.resolution ?? 20);
  const maxDim = Math.max(domainSize[0], domainSize[1], domainSize[2]);
  const spacing = Math.max(0.02, maxDim / targetRes);
  const nx = Math.max(4, Math.round(domainSize[0] / spacing));
  const ny = Math.max(4, Math.round(domainSize[1] / spacing));
  const nz = Math.max(4, Math.round(domainSize[2] / spacing));
  // recompute spacing so grid covers domain exactly-ish
  const spacingX = domainSize[0] / nx;
  const spacingY = domainSize[1] / ny;
  const spacingZ = domainSize[2] / nz;
  const cellSpacing = Math.max(spacingX, spacingY, spacingZ);
  const origin: [number, number, number] = [
    domainMin[0] + cellSpacing / 2,
    domainMin[1] + cellSpacing / 2,
    domainMin[2] + cellSpacing / 2,
  ];

  // inlet speed scales with fan profile + cooling demand
  const fanFactor = rack.fanProfile === 'max' ? 1.25 : rack.fanProfile === 'eco' ? 0.8 : 1.0;
  const inletSpeedMps = clamp((options?.inletSpeedMps ?? 0.55) * fanFactor, 0.05, 4);

  // boundary conditions per orientation
  let inletFace: BoundaryConditions['inletFace'] = 'front';
  let outletFaces: BoundaryConditions['outletFaces'] = ['rear'];
  let deviceFlip = false;
  if (orientation === 'reverse') { inletFace = 'rear'; outletFaces = ['front']; deviceFlip = true; }
  else if (orientation === 'bottom-to-top') {
    inletFace = 'bottom';
    outletFaces = ['rear', 'top'];
  } else if (orientation === 'front-only') { inletFace = 'front'; outletFaces = ['rear', 'top']; }
  void deviceFlip;

  const enclosed = rack.form === 'enclosed';
  const sidePanels = rack.sidePanels !== false;
  const contained = enclosed || sidePanels;
  const openingHalf = contained ? W / 2 + cellSpacing * 0.25 : Infinity;
  const boundary: BoundaryConditions = {
    inletSpeedMps,
    inletTempC: ambientC,
    inletFace,
    outletFaces,
    opening: contained ? { minX: -openingHalf, maxX: openingHalf } : null,
    solidSideWalls: contained,
    solidTop: enclosed,
    solidBottom: enclosed,
  };

  const solver = new FluidSolver({ nx, ny, nz, spacing: cellSpacing, origin }, boundary, ambientC);

  // ---- obstacles: rack side shells (and enclosed top/bottom) ----
  const insideRack = (x: number, y: number, z: number): boolean =>
    x >= rackMin[0] && x <= rackMax[0] && y >= rackMin[1] && y <= rackMax[1] && z >= rackMin[2] && z <= rackMax[2];
  const shellThickness = 0.05;
  if (enclosed || sidePanels) {
    for (let k = 0; k < nz; k++) {
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const [x, y, z] = solver.cellCenter(i, j, k);
          if (!insideRack(x, y, z)) continue;
          const onSide = x < rackMin[0] + shellThickness || x > rackMax[0] - shellThickness;
          const onTop = enclosed && y > rackMax[1] - shellThickness;
          const onBottom = enclosed && y < rackMin[1] + shellThickness;
          // leave front & rear faces open for inflow/outflow
          if (onSide || onTop || onBottom) solver.markBlocked(i, j, k);
        }
      }
    }
  }

  // ---- devices: porous fan + heat ----
  const hardwareById = new Map(catalog.map((item) => [item.id, item]));
  const telemetryById = new Map(result.telemetry.map((item) => [item.instanceId, item]));
  const deviceModels: DeviceModel[] = [];

  for (const device of devices) {
    if (device.status !== 'active') continue;
    const hw = hardwareById.get(device.hardwareId);
    if (!hw) continue;
    const heatW = Math.max(0, num(telemetryById.get(device.instanceId)?.typicalW, num(hw.typicalW, 0)));
    const airflow: Airflow = hw.airflow;
    const { min, max } = deviceBbox(rack, device, hw);
    const ports = airflowPorts(min, max, airflow, device);

    // volumetric flow: servers move air proportional to heat; minimum ventilation.
    const crossArea = Math.max(1e-4, (max[0] - min[0]) * (max[1] - min[1]));
    const deltaTDevice = 12; // °C typical rack ΔT across a device
    const qByHeat = heatW / (1.204 * 1005 * deltaTDevice); // ρcpΔT
    const qMin = airflow === 'passive' ? 0 : 0.015;
    const flowM3s = airflow === 'passive' ? 0 : clamp(Math.max(qMin, qByHeat), 0.015, 3);
    const fanSpeedMps = airflow === 'passive' ? 0 : clamp(flowM3s / crossArea, 0.05, 12);

    const model: DeviceModel = {
      instanceId: device.instanceId,
      hardwareId: device.hardwareId,
      name: hw.name,
      airflow,
      heatW,
      flowM3s,
      min,
      max,
      intake: ports.intake,
      exhaust: ports.exhaust,
      intakeScene: [ports.intake.point[0] * SCENE_PER_METER, ports.intake.point[1] * SCENE_PER_METER, ports.intake.point[2] * SCENE_PER_METER],
      exhaustScene: [ports.exhaust.point[0] * SCENE_PER_METER, ports.exhaust.point[1] * SCENE_PER_METER, ports.exhaust.point[2] * SCENE_PER_METER],
      fanSpeedMps,
      exhaustNormal: ports.exhaustNormal,
    };
    deviceModels.push(model);
  }

  return {
    solver,
    devices: deviceModels,
    domainMin,
    domainMax,
    rackMin,
    rackMax,
    ambientC,
    orientation,
    boundary,
    inletSpeedMps,
  };
}

/** apply per-step device sources (heat + fan) to the solver */
export function applyDeviceSources(model: RackModel): void {
  const solver = model.solver;
  for (const device of model.devices) {
    const { min, max } = device;
    const cmin = solver.toCell(min[0], min[1], min[2]);
    const cmax = solver.toCell(max[0], max[1], max[2]);
    const i0 = Math.max(0, Math.floor(cmin[0]));
    const j0 = Math.max(0, Math.floor(cmin[1]));
    const k0 = Math.max(0, Math.floor(cmin[2]));
    const i1 = Math.min(solver.nx - 1, Math.ceil(cmax[0]));
    const j1 = Math.min(solver.ny - 1, Math.ceil(cmax[1]));
    const k1 = Math.min(solver.nz - 1, Math.ceil(cmax[2]));
    const cells = Math.max(1, (i1 - i0 + 1) * (j1 - j0 + 1) * (k1 - k0 + 1));
    const heatPerCell = device.heatW / cells;
    const fanPerCell = device.fanSpeedMps / Math.max(1, cells * 0.4);
    for (let k = k0; k <= k1; k++) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          solver.addHeatW(i, j, k, heatPerCell);
          if (device.airflow !== 'passive') {
            solver.addVelocitySource(i, j, k, device.exhaustNormal[0] * fanPerCell, device.exhaustNormal[1] * fanPerCell, device.exhaustNormal[2] * fanPerCell);
          }
        }
      }
    }
  }
}
