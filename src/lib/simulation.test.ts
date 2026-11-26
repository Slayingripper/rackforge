import { describe, expect, it } from 'vitest';
import { HARDWARE_CATALOG } from '../data/catalog';
import { RACK_PRESETS } from '../data/presets';
import { checkPlacement, findUnblankedGaps, simulateRack } from './simulation';
import type { HardwareTemplate, PlacedDevice, RackConfig } from '../types';

const rack = (overrides: Partial<RackConfig> = {}): RackConfig => ({
  name: 'Test Rack', heightU: 42, widthMm: 800, depthMm: 1000, form: 'enclosed',
  perforatedDoors: true, sidePanels: true, staticRatingKg: 1000, rollingRatingKg: 700,
  voltage: 230, phases: 1, circuitAAmps: 20, circuitBAmps: 20, redundancy: 'N+1',
  ambientC: 22, coolingKw: 8, fanProfile: 'balanced', electricityRate: 0.2, zones: [],
  ...overrides,
});

const hardware = (id: string) => HARDWARE_CATALOG.find((item) => item.id === id)!;
const device = (hardwareId: string, startU: number, overrides: Partial<PlacedDevice> = {}): PlacedDevice => ({
  instanceId: `${hardwareId}-${startU}-${Math.random()}`, hardwareId, startU, status: 'active',
  mount: 'front', pdu: 'A', side: 'left', flipped: false, ...overrides,
});

describe('placement validation', () => {
  it('rejects two devices occupying the same front mounting plane', () => {
    const existing = device('srv-1u-650', 10);
    const candidate = device('tor-1u', 10, { instanceId: 'candidate' });
    const check = checkPlacement(rack(), [existing], hardware('tor-1u'), candidate, HARDWARE_CATALOG);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Collides');
  });

  it('allows shallow front and rear equipment to share U-space', () => {
    const existing = device('srv-1u-650', 10);
    const candidate = device('patch-48-1u', 10, { instanceId: 'candidate', mount: 'rear' });
    expect(checkPlacement(rack(), [existing], hardware('patch-48-1u'), candidate, HARDWARE_CATALOG).valid).toBe(true);
  });

  it('rejects front/rear equipment when combined depth exceeds usable clearance', () => {
    const existing = device('srv-1u-650', 10);
    const candidate = device('srv-2u-750', 10, { instanceId: 'candidate', mount: 'rear' });
    const check = checkPlacement(rack(), [existing], hardware('srv-2u-750'), candidate, HARDWARE_CATALOG);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('depth overlap');
  });

  it('rejects invalid equipment dimensions and mounting metadata', () => {
    const candidate = device('srv-1u-650', 0, { instanceId: 'candidate' });
    expect(checkPlacement(rack(), [], { ...hardware('srv-1u-650'), widthMm: 1000 }, candidate, HARDWARE_CATALOG).valid).toBe(false);
    expect(checkPlacement(rack(), [], { ...hardware('srv-1u-650'), uHeight: 1.5 }, candidate, HARDWARE_CATALOG).valid).toBe(false);
    expect(checkPlacement(rack(), [], { ...hardware('srv-1u-650'), depthMm: Number.NaN }, candidate, HARDWARE_CATALOG).valid).toBe(false);
    expect(checkPlacement(rack(), [], hardware('srv-1u-650'), { ...candidate, startU: 0.5 }, HARDWARE_CATALOG).valid).toBe(false);
  });

  it('enforces cable clearance and reserved zones', () => {
    const candidate = device('blade-enclosure', 0, { instanceId: 'candidate' });
    expect(checkPlacement(rack({ depthMm: 1200 }), [], hardware('blade-enclosure'), candidate, HARDWARE_CATALOG).reason).toContain('cable clearance');
    const shallow = device('srv-1u-650', 5, { instanceId: 'shallow' });
    expect(checkPlacement(rack({ zones: [{ id: 'z', name: 'Duct', startU: 4, endU: 7, kind: 'blocked' }] }), [], hardware('srv-1u-650'), shallow, HARDWARE_CATALOG).valid).toBe(false);
  });

  it('supports one 0U accessory per vertical rail', () => {
    const first = device('pdu-vertical', 0, { instanceId: 'first', mount: 'vertical', side: 'left' });
    const second = device('pdu-vertical', 0, { instanceId: 'second', mount: 'vertical', side: 'left' });
    const opposite = { ...second, instanceId: 'opposite', side: 'right' as const };
    expect(checkPlacement(rack(), [first], hardware('pdu-vertical'), second, HARDWARE_CATALOG).valid).toBe(false);
    expect(checkPlacement(rack(), [first], hardware('pdu-vertical'), opposite, HARDWARE_CATALOG).valid).toBe(true);
    expect(checkPlacement(rack(), [], hardware('srv-1u-650'), device('srv-1u-650', 0, { mount: 'vertical' }), HARDWARE_CATALOG).valid).toBe(false);
  });

  it('ships presets without U, plane, depth, or vertical-rail collisions', () => {
    for (const preset of RACK_PRESETS) {
      const state = preset.build();
      for (const placed of state.devices) {
        const item = HARDWARE_CATALOG.find((entry) => entry.id === placed.hardwareId)!;
        const others = state.devices.filter((entry) => entry.instanceId !== placed.instanceId);
        const check = checkPlacement(state.rack, others, item, placed, HARDWARE_CATALOG);
        expect(check.valid, `${preset.id}: ${item.name} — ${check.reason}`).toBe(true);
      }
    }
  });
});

describe('power, thermal, and structural simulation', () => {
  it('calculates deterministic power, heat, energy, and dual-feed current', () => {
    const devices = [device('srv-1u-650', 0, { pdu: 'A' }), device('srv-1u-650', 1, { pdu: 'B' })];
    const result = simulateRack(rack(), devices, HARDWARE_CATALOG);
    expect(result.typicalW).toBe(840);
    expect(result.peakW).toBe(1700);
    expect(result.heatBtuHr).toBeCloseTo(840 * 3.412142, 4);
    expect(result.monthlyKwh).toBeCloseTo(0.84 * 730, 5);
    expect(result.annualCost).toBeCloseTo(0.84 * 8760 * 0.2, 4);
    expect(result.pduA.typicalW).toBe(420);
    expect(result.pduB.typicalW).toBe(420);
    expect(result.pduA.amps).toBeCloseTo(420 / 230, 5);
    expect(result.pduA.loadPercent).toBeCloseTo((420 / (230 * 20)) * 100, 5);
  });

  it('keeps reserved equipment physical but removes its electrical and thermal load', () => {
    const active = device('srv-2u-750', 0);
    const reserved = device('ai-trainer-4u', 4, { status: 'reserved' });
    const result = simulateRack(rack(), [active, reserved], HARDWARE_CATALOG);
    expect(result.typicalW).toBe(510);
    expect(result.totalWeightKg).toBeCloseTo(27.2 + 62, 5);
    expect(result.occupiedU).toBe(6);
  });

  it('models fan profiles and raises cooling warnings under dense load', () => {
    const preset = RACK_PRESETS.find((item) => item.id === 'ai-storage-48u')!.build();
    const balanced = simulateRack(preset.rack, preset.devices, HARDWARE_CATALOG);
    const max = simulateRack({ ...preset.rack, fanProfile: 'max' }, preset.devices, HARDWARE_CATALOG);
    expect(max.availableCoolingKw).toBeGreaterThan(balanced.availableCoolingKw);
    expect(balanced.warnings.some((warning) => warning.id === 'cooling-critical')).toBe(true);
    expect(balanced.warnings.some((warning) => warning.title.includes('reverse airflow'))).toBe(true);
    expect(balanced.warnings.some((warning) => warning.id === 'heavy-mounted-high')).toBe(true);
  });

  it('detects recirculation gaps and recognizes blanking panels', () => {
    const open = [device('srv-1u-650', 0), device('srv-1u-650', 4)];
    expect(findUnblankedGaps(rack(), open, HARDWARE_CATALOG)).toEqual([{ startU: 1, endU: 4, size: 3 }]);
    const blanked = [...open, device('blanking-solid-1u', 1), device('blanking-solid-1u', 2), device('blanking-solid-1u', 3)];
    expect(findUnblankedGaps(rack(), blanked, HARDWARE_CATALOG)).toEqual([]);
    const openResult = simulateRack(rack(), open, HARDWARE_CATALOG);
    const blankedResult = simulateRack(rack(), blanked, HARDWARE_CATALOG);
    expect(openResult.recirculationRiskPct).toBeGreaterThan(blankedResult.recirculationRiskPct);
    expect(blankedResult.airflowEfficiencyPct).toBeGreaterThan(openResult.airflowEfficiencyPct);
  });

  it('aggregates dense thermal hotspots instead of emitting one warning per device', () => {
    const devices = Array.from({ length: 8 }, (_, index) => device('srv-1u-650', index));
    const result = simulateRack(rack({ coolingKw: 1, ambientC: 25 }), devices, HARDWARE_CATALOG);
    const hotspotWarnings = result.warnings.filter((warning) => warning.id.startsWith('hotspot'));
    expect(hotspotWarnings.length).toBeLessThanOrEqual(4);
    expect(result.warnings.some((warning) => warning.id === 'hotspot-summary')).toBe(true);
  });

  it('flags high-mounted heavy equipment and structural limits', () => {
    const devices = [device('ups-4u', 38), device('patch-48-1u', 0)];
    const result = simulateRack(rack({ staticRatingKg: 50, rollingRatingKg: 40 }), devices, HARDWARE_CATALOG);
    expect(result.centerOfGravityPct).toBeGreaterThan(80);
    expect(result.warnings.some((warning) => warning.id === 'weight-static')).toBe(true);
    expect(result.warnings.some((warning) => warning.id === 'weight-rolling')).toBe(true);
    expect(result.warnings.some((warning) => warning.id === 'cog-high')).toBe(true);
  });

  it('calculates three-phase breaker loading per phase', () => {
    const result = simulateRack(rack({ voltage: 208, phases: 3, circuitAAmps: 20 }), [device('srv-1u-650', 0)], HARDWARE_CATALOG);
    expect(result.pduA.capacityW).toBe(208 * 20 * 3);
    expect(result.pduA.amps).toBeCloseTo(420 / (208 * 3), 5);
  });

  it('keeps all calculations finite when overrides contain invalid numbers', () => {
    const placed = device('srv-1u-650', 0, {
      overrides: { typicalW: Number.NaN, peakW: Number.POSITIVE_INFINITY, weightKg: -20, label: 'Invalid numbers' },
    });
    const result = simulateRack(rack({ coolingKw: 0, voltage: 0 as unknown as RackConfig['voltage'], circuitAAmps: 0 }), [placed], HARDWARE_CATALOG);
    expect(Number.isFinite(result.typicalW)).toBe(true);
    expect(Number.isFinite(result.peakW)).toBe(true);
    expect(Number.isFinite(result.totalWeightKg)).toBe(true);
    expect(Number.isFinite(result.thermalLoadPct)).toBe(true);
    expect(Number.isFinite(result.averageExhaustC)).toBe(true);
    expect(Number.isFinite(result.heatBtuHr)).toBe(true);
    expect(result.typicalW).toBe(420);
    expect(result.totalWeightKg).toBe(0);
    expect(result.severity).toBe('critical');
  });

  it('applies custom per-device engineering overrides', () => {
    const custom: HardwareTemplate = { ...hardware('srv-1u-650'), id: 'custom-node', name: 'Custom Node', typicalW: 100, peakW: 150, weightKg: 12, custom: true };
    const placed = device('custom-node', 0, { overrides: { typicalW: 333, peakW: 444, weightKg: 18 } });
    const result = simulateRack(rack(), [placed], [...HARDWARE_CATALOG, custom]);
    expect(result.typicalW).toBe(333);
    expect(result.peakW).toBe(444);
    expect(result.totalWeightKg).toBe(18);
  });
});
