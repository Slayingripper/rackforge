import { describe, expect, it } from 'vitest';
import { defaultState, sanitizeImportedState } from './useRackState';

describe('workspace state', () => {
  it('keeps the enterprise rack as the default workspace', () => {
    expect(defaultState().rack.name).toBe('Virtualization Cluster Rack 07');
    expect(defaultState().activePreset).toBe('enterprise-42u');
  });

  it('accepts the airflow overlay when importing workspaces', () => {
    const state = defaultState();
    const imported = sanitizeImportedState({ ...state, overlay: 'airflow' });
    expect(imported.overlay).toBe('airflow');
  });

  it('rejects invalid workspace files', () => {
    expect(() => sanitizeImportedState({ version: 1 })).toThrow('Not a valid RackForge workspace file.');
  });

  it('normalizes hostile workspaces and rejects invalid devices and custom hardware', () => {
    const state = defaultState();
    const hostile = {
      ...state,
      rack: {
        ...state.rack,
        name: 42,
        heightU: '42',
        widthMm: 'huge',
        depthMm: -5,
        form: 'sphere',
        fanProfile: 'turbo',
        redundancy: 'N+99',
        phases: '3',
        voltage: 'x',
        circuitAAmps: -4,
        circuitBAmps: 'x',
        ambientC: 1e9,
        coolingKw: 'lots',
        electricityRate: 'free',
        staticRatingKg: -100,
        rollingRatingKg: -1,
        zones: [{ id: 'z', name: 'Bad', startU: 20, endU: 2, kind: 'mystery' }],
      },
      devices: [
        ...state.devices.map((device, index) => index === 0 ? { ...device, startU: 999 } : device),
        { instanceId: 'bad', hardwareId: 'missing', startU: 0, status: 'active', mount: 'front', pdu: 'A', side: 'left', flipped: false },
        { instanceId: 'bad-pdu', hardwareId: state.devices[0].hardwareId, startU: 2, status: 'active', mount: 'front', pdu: 'C', side: 'left', flipped: false },
        { instanceId: 'bad-mount', hardwareId: state.devices[0].hardwareId, startU: 2, status: 'active', mount: 'side', pdu: 'A', side: 'left', flipped: false },
      ],
      customHardware: [
        { id: 'srv-1u-650', name: 'Shadow built-in', uHeight: 1, depthMm: 600, widthMm: 482, weightKg: 1, ratedW: 1, typicalW: 1, peakW: 1, airflow: 'passive', category: 'accessory', vendor: 'x', ports: '', description: '', color: '#fff' },
        { id: 'custom', name: 'Custom', uHeight: 'tall', depthMm: 600, widthMm: 482, weightKg: 1, ratedW: 1, typicalW: 1, peakW: 1, airflow: 'passive', category: 'accessory', vendor: 'x', ports: '', description: '', color: '#fff' },
      ],
    };
    const imported = sanitizeImportedState(hostile);
    expect(imported.rack.name).toBe('Untitled Rack');
    expect(imported.rack.heightU).toBe(42);
    expect(imported.rack.widthMm).toBe(800);
    expect(imported.rack.depthMm).toBe(1000);
    expect(imported.rack.form).toBe('enclosed');
    expect(imported.rack.fanProfile).toBe('balanced');
    expect(imported.rack.redundancy).toBe('N+1');
    expect(imported.rack.phases).toBe(1);
    expect(imported.rack.voltage).toBe(230);
    expect(imported.rack.circuitAAmps).toBe(0);
    expect(imported.rack.circuitBAmps).toBe(20);
    expect(imported.rack.ambientC).toBe(80);
    expect(imported.rack.coolingKw).toBe(8);
    expect(imported.rack.electricityRate).toBe(0.18);
    expect(imported.rack.staticRatingKg).toBe(0);
    expect(imported.rack.rollingRatingKg).toBe(0);
    expect(imported.rack.zones).toEqual([]);
    expect(imported.devices).toHaveLength(state.devices.length - 1);
    expect(imported.devices.some((device) => device.instanceId === 'bad')).toBe(false);
    expect(imported.devices.some((device) => device.instanceId === 'bad-pdu')).toBe(false);
    expect(imported.devices.some((device) => device.instanceId === 'bad-mount')).toBe(false);
    expect(imported.customHardware).toEqual([]);
  });
});
