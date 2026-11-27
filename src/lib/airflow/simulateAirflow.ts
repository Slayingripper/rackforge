import type { HardwareTemplate, PlacedDevice, RackConfig, Severity, SimulationResult } from '../../types';
import { AirflowField } from './field';
import { FluidSolver } from './fluidSolver';
import { applyDeviceSources, buildRackModel, SCENE_PER_METER, type DeviceModel } from './rackModel';
import type { AirflowReport, AirflowGrid, CoolingOrientation, DeviceAirflow } from './types';

const CFM_PER_M3S = 2118.880003;
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const round = (v: number, dp = 1): number => { const p = 10 ** dp; return Math.round(v * p) / p; };

function severityOf(value: number, warning: number, critical: number): Severity {
  if (!Number.isFinite(value)) return 'critical';
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'ok';
}

export interface SimulateAirflowOptions {
  /** solver steps to approach steady state (default 160) */
  steps?: number;
  /** seconds per step (default 0.02) */
  dt?: number;
  /** grid resolution target per domain dimension (default 20) */
  resolution?: number;
  orientation?: CoolingOrientation;
  inletSpeedMps?: number;
}

/**
 * Run a real grid-based incompressible CFD simulation of the rack and return a
 * queryable velocity + temperature field plus physics-derived metrics.
 *
 * Deterministic, finite, no network. Reduced-order coarse-grid planning model;
 * NOT certified CFD.
 */
export function simulateAirflow(
  rack: RackConfig,
  devices: PlacedDevice[],
  catalog: HardwareTemplate[],
  result: SimulationResult,
  options?: SimulateAirflowOptions,
): AirflowField {
  const steps = Math.max(1, Math.floor(options?.steps ?? 160));
  const dt = clamp(options?.dt ?? 0.02, 1e-4, 0.05);

  const model = buildRackModel(rack, devices, catalog, result, {
    resolution: options?.resolution,
    orientation: options?.orientation,
    inletSpeedMps: options?.inletSpeedMps,
  });
  const { solver } = model;
  const ambientC = model.ambientC;

  // approach steady state
  for (let step = 0; step < steps; step++) {
    applyDeviceSources(model);
    solver.step(dt, ambientC);
  }

  const grid: AirflowGrid = {
    nx: solver.nx,
    ny: solver.ny,
    nz: solver.nz,
    spacing: solver.spacing,
    origin: [solver.origin[0], solver.origin[1], solver.origin[2]],
    scenePerMeter: SCENE_PER_METER,
    boundsMin: [...model.domainMin],
    boundsMax: [...model.domainMax],
  };

  const sample = (x: number, y: number, z: number) => solver.sample(x, y, z);
  const sp = solver.spacing;

  // ---- per-device airflow ----
  const perDevice: DeviceAirflow[] = model.devices.map((device: DeviceModel): DeviceAirflow => {
    const inN = device.intake.normal;
    const exN = device.exhaustNormal;
    const ip = device.intake.point;
    const ep = device.exhaust.point;
    const intakePt: [number, number, number] = [ip[0] + inN[0] * sp * 0.7, ip[1] + inN[1] * sp * 0.7, ip[2] + inN[2] * sp * 0.7];
    const exhaustPt: [number, number, number] = [ep[0] + exN[0] * sp * 0.9, ep[1] + exN[1] * sp * 0.9, ep[2] + exN[2] * sp * 0.9];
    const intake = sample(intakePt[0], intakePt[1], intakePt[2]);
    const exhaustSample = sample(exhaustPt[0], exhaustPt[1], exhaustPt[2]);
    const cx = (device.min[0] + device.max[0]) / 2;
    const cy = (device.min[1] + device.max[1]) / 2;
    const cz = (device.min[2] + device.max[2]) / 2;
    const inside = sample(cx, cy, cz);
    const intakeTempC = round(intake.tempC);
    // Physical exhaust relation: exhaust = intake + Q / (ρ · cp · Q̇).
    const massFlowKgS = 1.204 * Math.max(1e-6, device.flowM3s);
    const physicalDeltaT = device.heatW > 0 && device.flowM3s > 0 ? device.heatW / (massFlowKgS * 1005) : 0;
    const exhaustTempC = round(Math.max(exhaustSample.tempC, intakeTempC + physicalDeltaT));
    const localTempC = round(Math.max(exhaustTempC, inside.tempC, intakeTempC));
    const deltaT = round(exhaustTempC - intakeTempC);
    const recirculationPct = clamp(round((intakeTempC - ambientC) * 8, 0), 0, 100);
    const severity = worstSeverity(severityOf(localTempC, 36, 42), severityOf(intakeTempC, 30, 35));
    return {
      instanceId: device.instanceId,
      airflow: device.airflow,
      intakeTempC,
      exhaustTempC,
      deltaT,
      intakeSpeedMps: round(intake.speed, 2),
      exhaustSpeedMps: round(exhaustSample.speed, 2),
      recirculationPct,
      localTempC,
      severity,
      flowM3s: round(device.flowM3s, 4),
      intakeScene: device.intakeScene,
      exhaustScene: device.exhaustScene,
    };
  });

  // ---- global field stats ----
  let maxTempC = ambientC;
  let maxSpeedMps = 0;
  const temp = solver.temp;
  const n = solver.n;
  for (let idx = 0; idx < n; idx++) {
    if (Number.isFinite(temp[idx])) maxTempC = Math.max(maxTempC, temp[idx]);
    const spd = Math.hypot(solver.u[idx], solver.v[idx], solver.w[idx]);
    if (Number.isFinite(spd)) maxSpeedMps = Math.max(maxSpeedMps, spd);
  }

  // hotspots: hottest cells (scene coords), non-blocked
  const hotspots = topHotspots(solver, SCENE_PER_METER, 6);

  // rear hot-aisle outlet stats
  const rearStats = rearOutletStats(solver, model, ambientC);

  const totalFlowM3s = model.devices.reduce((sum, d) => sum + d.flowM3s, 0);
  const totalHeatW = model.devices.reduce((sum, d) => sum + d.heatW, 0);
  const intakes = perDevice.map((d) => d.intakeTempC);
  const exhausts = perDevice.map((d) => d.exhaustTempC);
  const averageIntakeC = intakes.length ? round(intakes.reduce((a, b) => a + b, 0) / intakes.length) : round(ambientC);
  const maxIntakeC = intakes.length ? round(Math.max(...intakes)) : round(ambientC);
  // Physical rack ΔT = ΣQ̇_heat / (ρ · cp · ΣQ̇_air). Realistic hot-aisle warming,
  // cross-checked against the CFD rear hot-aisle sample.
  const physicalRackDeltaT = totalHeatW > 0 && totalFlowM3s > 1e-6 ? totalHeatW / (1.204 * 1005 * totalFlowM3s) : 0;
  const rearMean = rearStats.meanTempC;
  const sampledExhaustMean = exhausts.length ? exhausts.reduce((a, b) => a + b, 0) / exhausts.length : averageIntakeC;
  const averageExhaustC = round(Math.max(rearMean, sampledExhaustMean, averageIntakeC + physicalRackDeltaT));
  const rackDeltaT = round(averageExhaustC - averageIntakeC);

  const recirculationRiskPct = perDevice.length
    ? clamp(round(perDevice.reduce((a, d) => a + d.recirculationPct, 0) / perDevice.length, 1), 0, 100)
    : 0;
  const hotIntakeRiskPct = perDevice.length
    ? clamp(round(100 * perDevice.filter((d) => d.intakeTempC > ambientC + 1).length / perDevice.length, 1), 0, 100)
    : 0;
  const bypassRiskPct = clamp(round(rearStats.bypassPct, 1), 0, 100);
  const airflowEfficiencyPct = clamp(round(100 - recirculationRiskPct * 0.5 - bypassRiskPct * 0.4 - hotIntakeRiskPct * 0.3, 1), 0, 100);

  const divergenceResidual = round(solver.divergenceResidual(), 4);
  const converged = Number.isFinite(divergenceResidual) && divergenceResidual < 0.5;

  const report: AirflowReport = {
    averageExhaustC: round(averageExhaustC),
    maxTempC: round(maxTempC),
    averageIntakeC,
    maxIntakeC,
    rackDeltaT,
    estimatedAirflowCfm: round(totalFlowM3s * CFM_PER_M3S, 0),
    totalFlowM3s: round(totalFlowM3s, 4),
    massFlowKgS: round(totalFlowM3s * 1.204, 4),
    airflowEfficiencyPct,
    recirculationRiskPct,
    bypassRiskPct,
    hotIntakeRiskPct,
    rearBypassPct: clamp(round(rearStats.bypassPct, 1), 0, 100),
    perDevice,
    hotspots,
    divergenceResidual,
    maxSpeedMps: round(maxSpeedMps, 3),
    converged,
    note: 'Reduced-order grid-based CFD planning approximation (stable-fluids incompressible Navier–Stokes + advected temperature + Boussinesq buoyancy, porous-fan device model, coarse grid). Not certified CFD; verify with manufacturer data and a full CFD study for production.',
  };

  return new AirflowField(solver, grid, report);
}

function worstSeverity(a: Severity, b: Severity): Severity {
  if (a === 'critical' || b === 'critical') return 'critical';
  if (a === 'warning' || b === 'warning') return 'warning';
  return 'ok';
}

function topHotspots(solver: FluidSolver, scenePerMeter: number, count: number): AirflowReport['hotspots'] {
  const candidates: { scene: [number, number, number]; tempC: number; severity: Severity }[] = [];
  const { nx, ny, nz } = solver;
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const idx = solver.index(i, j, k);
        if (solver.blocked[idx]) continue;
        const t = solver.temp[idx];
        if (!Number.isFinite(t)) continue;
        const [x, y, z] = solver.cellCenter(i, j, k);
        candidates.push({ scene: [x * scenePerMeter, y * scenePerMeter, z * scenePerMeter], tempC: round(t), severity: severityOf(t, 36, 42) });
      }
    }
  }
  candidates.sort((a, b) => b.tempC - a.tempC);
  return candidates.slice(0, count);
}

function rearOutletStats(solver: FluidSolver, model: ReturnType<typeof buildRackModel>, ambientC: number): { meanTempC: number; bypassPct: number } {
  // rear hot aisle = low-z domain edge region, inside rack width/height
  const rearZ = model.rackMin[2] - 0.05;
  const xs = 5;
  const ys = Math.min(12, solver.ny);
  let total = 0;
  let count = 0;
  let bypass = 0;
  const yMin = model.rackMin[1];
  const yMax = model.rackMax[1];
  const xMin = model.rackMin[0];
  const xMax = model.rackMax[0];
  for (let j = 0; j < ys; j++) {
    for (let i = 0; i < xs; i++) {
      const x = xMin + ((xMax - xMin) * (i + 0.5)) / xs;
      const y = yMin + ((yMax - yMin) * (j + 0.5)) / ys;
      const s = solver.sample(x, y, rearZ);
      total += s.tempC;
      count++;
      if (s.tempC < ambientC + 1) bypass++;
    }
  }
  return { meanTempC: count ? total / count : ambientC, bypassPct: count ? (100 * bypass) / count : 0 };
}
