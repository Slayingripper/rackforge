import { describe, expect, it } from 'vitest';
import { HARDWARE_CATALOG } from './catalog';
import { RACK_PRESETS } from './presets';

describe('hardware catalog', () => {
  it('contains unique, fully classified equipment profiles', () => {
    const ids = HARDWARE_CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of HARDWARE_CATALOG) {
      expect(item.name.length).toBeGreaterThan(2);
      expect(item.subtype, `${item.id} needs an equipment type`).toBeTruthy();
      expect(item.uHeight).toBeGreaterThanOrEqual(0);
      expect(item.uHeight).toBeLessThanOrEqual(12);
      expect(item.depthMm).toBeGreaterThan(0);
      expect(item.weightKg).toBeGreaterThanOrEqual(0);
    }
  });

  it('classifies brand names without confusing PowerEdge with short-depth edge servers', () => {
    expect(HARDWARE_CATALOG.find((item) => item.id === 'srv-1u-650')?.subtype).toBe('Rack Server');
    expect(HARDWARE_CATALOG.find((item) => item.id === 'edge-short-1u')?.subtype).toBe('Edge Server');
  });

  it('includes multiple fans, switches, rack PCs, workstations, and SBC configurations', () => {
    const fans = HARDWARE_CATALOG.filter((item) => item.subtype?.includes('Fan'));
    const switches = HARDWARE_CATALOG.filter((item) => item.subtype?.includes('Switch'));
    const pcs = HARDWARE_CATALOG.filter((item) => item.subtype === 'Rack PC' || item.subtype === 'GPU Workstation');
    const sbc = HARDWARE_CATALOG.filter((item) => item.category === 'sbc');
    expect(fans.length).toBeGreaterThanOrEqual(8);
    expect(switches.length).toBeGreaterThanOrEqual(10);
    expect(pcs.length).toBeGreaterThanOrEqual(6);
    expect(sbc.length).toBeGreaterThanOrEqual(8);
    expect(new Set(sbc.map((item) => item.subtype)).size).toBeGreaterThanOrEqual(6);
  });

  it('keeps electrical specifications internally consistent', () => {
    for (const item of HARDWARE_CATALOG) {
      expect(item.typicalW, `${item.id} typical power`).toBeGreaterThanOrEqual(0);
      expect(item.peakW, `${item.id} peak power`).toBeGreaterThanOrEqual(item.typicalW);
      expect(item.ratedW, `${item.id} rated power`).toBeGreaterThanOrEqual(item.peakW);
      if (item.airflow === 'passive') expect(item.typicalW, `${item.id} passive draw`).toBeGreaterThanOrEqual(0);
    }
  });

  it('resolves every preset hardware reference', () => {
    const ids = new Set(HARDWARE_CATALOG.map((item) => item.id));
    for (const preset of RACK_PRESETS) {
      for (const device of preset.build().devices) {
        expect(ids.has(device.hardwareId), `${preset.id} references missing ${device.hardwareId}`).toBe(true);
      }
    }
  });
});
