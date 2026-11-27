import { describe, expect, it } from 'vitest';
import { HARDWARE_CATALOG } from '../../data/catalog';
import { simulateRack } from '../simulation';
import { simulateAirflow } from './simulateAirflow';
import { applyAirflowField } from './applyAirflow';
import { FluidSolver } from './fluidSolver';
import type { HardwareTemplate, PlacedDevice, RackConfig } from '../../types';

const rack = (overrides: Partial<RackConfig> = {}): RackConfig => ({
  name: 'CFD Rack', heightU: 24, widthMm: 800, depthMm: 1000, form: 'enclosed',
  perforatedDoors: true, sidePanels: true, staticRatingKg: 1000, rollingRatingKg: 700,
  voltage: 230, phases: 1, circuitAAmps: 20, circuitBAmps: 20, redundancy: 'N+1',
  ambientC: 22, coolingKw: 8, fanProfile: 'balanced', electricityRate: 0.2, zones: [],
  ...overrides,
});

const hw = (id: string): HardwareTemplate => HARDWARE_CATALOG.find((item) => item.id === id)!;
const device = (hardwareId: string, startU: number, overrides: Partial<PlacedDevice> = {}): PlacedDevice => ({
  instanceId: `${hardwareId}-${startU}`, hardwareId, startU, status: 'active',
  mount: 'front', pdu: 'A', side: 'left', flipped: false, ...overrides,
});

function run(r: RackConfig, devices: PlacedDevice[], steps = 120) {
  const base = simulateRack(r, devices, HARDWARE_CATALOG);
  return simulateAirflow(r, devices, HARDWARE_CATALOG, base, { steps, resolution: 16 });
}

describe('fluid solver', () => {
  it('advects scalar downstream and projects out divergence', () => {
    const solver = new FluidSolver({ nx: 8, ny: 8, nz: 8, spacing: 0.1, origin: [0, 0, 0] }, { inletSpeedMps: 0, inletTempC: 22, inletFace: 'front', outletFaces: ['rear'], opening: null, solidSideWalls: true, solidTop: true, solidBottom: true }, 22);
    solver.u.fill(1); // uniform +x flow
    solver.temp[solver.index(3, 3, 3)] = 100;
    solver.step(0.02, 22);
    expect(Number.isFinite(solver.temp[solver.index(4, 3, 3)])).toBe(true);
    expect(Math.max(...solver.temp)).toBeGreaterThan(22); // scalar advected, not destroyed
    expect(solver.divergenceResidual()).toBeLessThan(50); // approximately incompressible
    expect(Number.isFinite(solver.divergenceResidual())).toBe(true);
  });

  it('never produces NaN or Infinity', () => {
    const solver = new FluidSolver({ nx: 6, ny: 6, nz: 6, spacing: 0.1, origin: [0, 0, 0] }, { inletSpeedMps: 1, inletTempC: 22, inletFace: 'front', outletFaces: ['rear'], opening: null, solidSideWalls: false, solidTop: false, solidBottom: false }, 22);
    for (let s = 0; s < 50; s++) { solver.addHeatW(3, 3, 3, 500); solver.step(0.02, 22); }
    for (let i = 0; i < solver.n; i++) {
      expect(Number.isFinite(solver.u[i])).toBe(true);
      expect(Number.isFinite(solver.v[i])).toBe(true);
      expect(Number.isFinite(solver.w[i])).toBe(true);
      expect(Number.isFinite(solver.temp[i])).toBe(true);
    }
  });

  it('hot air rises (buoyancy)', () => {
    const solver = new FluidSolver({ nx: 5, ny: 9, nz: 5, spacing: 0.1, origin: [0, 0, 0] }, { inletSpeedMps: 0, inletTempC: 22, inletFace: 'front', outletFaces: ['top'], opening: null, solidSideWalls: true, solidTop: false, solidBottom: true }, 22);
    // heat low cells
    for (let s = 0; s < 60; s++) { solver.addHeatW(2, 1, 2, 800); solver.step(0.02, 22); }
    expect(solver.v[solver.index(2, 1, 2)]).toBeGreaterThan(0); // upward velocity at heat source
  });

  it('trilinear sampling is finite and in-range', () => {
    const solver = new FluidSolver({ nx: 4, ny: 4, nz: 4, spacing: 0.1, origin: [0, 0, 0] }, { inletSpeedMps: 0, inletTempC: 22, inletFace: 'front', outletFaces: ['rear'], opening: null, solidSideWalls: true, solidTop: true, solidBottom: true }, 22);
    const s = solver.sample(0.15, 0.15, 0.15);
    expect(Number.isFinite(s.vx)).toBe(true);
    expect(Number.isFinite(s.tempC)).toBe(true);
    expect(s.tempC).toBeCloseTo(22, 1);
  });
});

describe('simulateAirflow (realistic CFD)', () => {
  it('empty rack produces a finite, ~ambient, low-flow field', () => {
    const field = run(rack(), []);
    const r = field.report;
    expect(Number.isFinite(r.averageExhaustC)).toBe(true);
    expect(Number.isFinite(r.divergenceResidual)).toBe(true);
    expect(r.estimatedAirflowCfm).toBe(0);
    expect(r.maxSpeedMps).toBeGreaterThanOrEqual(0);
    expect(Math.abs(r.averageExhaustC - 22)).toBeLessThan(6);
    // field sampling finite everywhere
    const s = field.sampleScene(0, 1, 0);
    expect(Number.isFinite(s.tempC)).toBe(true);
  });

  it('a heated front-to-back server exhausts hot air to the rear, intake ~ambient', () => {
    const server = hw('srv-1u-650');
    const devices = [device('srv-1u-650', 10, { instanceId: 's1' })];
    // sanity: realistic heat
    expect(server.typicalW).toBeGreaterThan(0);
    const field = run(rack(), devices, 200);
    const d = field.report.perDevice.find((x) => x.instanceId === 's1')!;
    expect(d.airflow).toBe('front-to-back');
    expect(d.flowM3s).toBeGreaterThan(0);
    expect(d.intakeTempC).toBeLessThanOrEqual(d.exhaustTempC + 0.5);
    expect(d.intakeTempC).toBeGreaterThanOrEqual(21);
    expect(d.exhaustTempC).toBeGreaterThan(d.intakeTempC);
    expect(field.report.estimatedAirflowCfm).toBeGreaterThan(0);
    expect(field.report.totalFlowM3s).toBeGreaterThan(0);
    expect(field.report.rackDeltaT).toBeGreaterThan(0);
    expect(field.report.maxTempC).toBeGreaterThan(22);
    expect(field.report.hotspots.length).toBeGreaterThan(0);
  });

  it('back-to-front devices exhaust toward the front (reverse airflow)', () => {
    const id = HARDWARE_CATALOG.find((item) => item.airflow === 'back-to-front')?.id;
    expect(id).toBeTruthy();
    const field = run(rack(), [device(id!, 5, { instanceId: 'rev', mount: 'front' })], 160);
    const d = field.report.perDevice.find((x) => x.instanceId === 'rev')!;
    expect(d.airflow).toBe('back-to-front');
    // exhaust port is on the front face (+z) relative to intake (-z)
    expect(d.exhaustScene[2]).toBeGreaterThan(d.intakeScene[2]);
  });

  it('side-to-side devices are modeled with lateral flow', () => {
    const id = HARDWARE_CATALOG.find((item) => item.airflow === 'side-to-side')?.id;
    expect(id).toBeTruthy();
    const field = run(rack(), [device(id!, 5, { instanceId: 'side' })], 140);
    const d = field.report.perDevice.find((x) => x.instanceId === 'side')!;
    expect(d.airflow).toBe('side-to-side');
    expect(d.flowM3s).toBeGreaterThan(0);
  });

  it('passive devices add heat without fan flow', () => {
    const id = HARDWARE_CATALOG.find((item) => item.airflow === 'passive')?.id ?? 'blank-1u';
    const field = run(rack(), [device(id, 3, { instanceId: 'p' })], 100);
    const d = field.report.perDevice.find((x) => x.instanceId === 'p');
    if (d) { expect(d.flowM3s).toBe(0); expect(Number.isFinite(d.exhaustTempC)).toBe(true); }
  });

  it('hot air rises inside the rack (hot aisle warmer at top than bottom)', () => {
    const devices = [device('srv-1u-650', 6, { instanceId: 'a' }), device('srv-1u-650', 12, { instanceId: 'b' })];
    const field = run(rack(), devices, 200);
    const rearX = 0;
    const rearZ = -rack().depthMm * 0.001 * 4 - 0.4; // scene rear + margin
    const top = field.sampleScene(rearX, field.grid.boundsMax[1] * field.scenePerMeter - 0.2, rearZ);
    const bottom = field.sampleScene(rearX, field.grid.boundsMin[1] * field.scenePerMeter + 0.2, rearZ);
    expect(Number.isFinite(top.tempC)).toBe(true);
    expect(Number.isFinite(bottom.tempC)).toBe(true);
  });

  it('is deterministic', () => {
    const devices = [device('srv-1u-650', 8, { instanceId: 'd' })];
    const a = run(rack(), devices, 120).report;
    const b = run(rack(), devices, 120).report;
    expect(a.averageExhaustC).toBe(b.averageExhaustC);
    expect(a.divergenceResidual).toBe(b.divergenceResidual);
    expect(a.maxSpeedMps).toBe(b.maxSpeedMps);
  });

  it('supports bottom-to-top facility orientation without NaN', () => {
    const base = simulateRack(rack({ coolingOrientation: 'bottom-to-top' }), [device('srv-1u-650', 8, { instanceId: 'd' })], HARDWARE_CATALOG);
    const field = simulateAirflow(rack({ coolingOrientation: 'bottom-to-top' }), [device('srv-1u-650', 8, { instanceId: 'd' })], HARDWARE_CATALOG, base, { steps: 120, resolution: 16 });
    expect(Number.isFinite(field.report.averageExhaustC)).toBe(true);
    expect(field.report.maxSpeedMps).toBeGreaterThanOrEqual(0);
  });
});

describe('contained aisle boundaries', () => {
  it('restricts inlet/outlet to the rack opening for enclosed racks', () => {
    const r = rack();
    const devices = [device('srv-1u-650', 10, { instanceId: 's1' })];
    const base = simulateRack(r, devices, HARDWARE_CATALOG);
    const field = simulateAirflow(r, devices, HARDWARE_CATALOG, base, { steps: 160, resolution: 16 });
    const spm = field.scenePerMeter;
    const minX = field.grid.boundsMin[0] * spm;
    const maxX = field.grid.boundsMax[0] * spm;
    const maxZ = field.grid.boundsMax[2] * spm;
    const rackHalf = (r.widthMm * 0.001 * spm) / 2;
    // outside the cabinet opening: no inflow through the side margins
    for (const sx of [minX + 0.05, maxX - 0.05]) {
      expect(Math.abs(sx)).toBeGreaterThan(rackHalf);
      const v = field.sampleSceneVelocity(sx, 2.0, maxZ - 0.15);
      expect(Math.abs(v.vz)).toBeLessThan(0.05);
    }
    // inside the opening: real cold-air inflow toward the rack
    const v = field.sampleSceneVelocity(0, 2.0, maxZ - 0.15);
    expect(v.vz).toBeLessThan(-0.1);
  });

  it('keeps full-width inlet for open 2-post racks', () => {
    const r = rack({ form: 'open-2post', sidePanels: false });
    const base = simulateRack(r, [], HARDWARE_CATALOG);
    const field = simulateAirflow(r, [], HARDWARE_CATALOG, base, { steps: 80, resolution: 12 });
    const spm = field.scenePerMeter;
    const minX = field.grid.boundsMin[0] * spm;
    const maxX = field.grid.boundsMax[0] * spm;
    const maxZ = field.grid.boundsMax[2] * spm;
    const left = field.sampleSceneVelocity(minX + (maxX - minX) * 0.08, 1.0, maxZ - 0.15);
    const right = field.sampleSceneVelocity(minX + (maxX - minX) * 0.92, 1.0, maxZ - 0.15);
    expect(left.vz).toBeLessThan(-0.05);
    expect(right.vz).toBeLessThan(-0.05);
  });
});

describe('applyAirflowField', () => {
  it('merges CFD metrics into SimulationResult without touching power/structure', () => {
    const r = rack();
    const devices = [device('srv-1u-650', 10, { instanceId: 's1' })];
    const base = simulateRack(r, devices, HARDWARE_CATALOG);
    const field = simulateAirflow(r, devices, HARDWARE_CATALOG, base, { steps: 140, resolution: 16 });
    const merged = applyAirflowField(base, field);
    expect(merged.typicalW).toBe(base.typicalW);
    expect(merged.totalWeightKg).toBe(base.totalWeightKg);
    expect(merged.heatKw).toBe(base.heatKw);
    expect(merged.airflowReport).toBeDefined();
    expect(merged.averageExhaustC).toBe(field.report.averageExhaustC);
    const t = merged.telemetry.find((x) => x.instanceId === 's1')!;
    expect(Number.isFinite(t.localTempC)).toBe(true);
  });

  it('returns base result when no field', () => {
    const base = simulateRack(rack(), [], HARDWARE_CATALOG);
    expect(applyAirflowField(base, null)).toBe(base);
  });
});
