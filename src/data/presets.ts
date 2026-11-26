import type { AppState, PlacedDevice, RackConfig } from '../types';

export interface RackPreset {
  id: string;
  name: string;
  shortName: string;
  description: string;
  badge: string;
  build: () => AppState;
}

const baseRack = (overrides: Partial<RackConfig> = {}): RackConfig => ({
  name: 'Untitled Rack',
  heightU: 42,
  widthMm: 800,
  depthMm: 1000,
  form: 'enclosed',
  perforatedDoors: true,
  sidePanels: true,
  staticRatingKg: 1000,
  rollingRatingKg: 700,
  voltage: 230,
  phases: 1,
  circuitAAmps: 20,
  circuitBAmps: 20,
  redundancy: 'N+1',
  ambientC: 22,
  coolingKw: 8,
  fanProfile: 'balanced',
  electricityRate: 0.18,
  zones: [],
  ...overrides,
});

let serial = 0;
const place = (
  hardwareId: string,
  startU: number,
  options: Partial<PlacedDevice> = {},
): PlacedDevice => ({
  instanceId: `preset-${++serial}`,
  hardwareId,
  startU,
  status: 'active',
  mount: 'front',
  pdu: serial % 2 ? 'A' : 'B',
  side: 'left',
  flipped: false,
  ...options,
});

const state = (
  rack: RackConfig,
  devices: PlacedDevice[],
  activePreset: string,
): AppState => ({
  version: 1,
  rack,
  devices,
  customHardware: [],
  selectedId: devices[0]?.instanceId ?? null,
  view: '3d',
  overlay: 'normal',
  activePreset,
});

export const RACK_PRESETS: RackPreset[] = [
  {
    id: 'edge-12u',
    name: 'Small Edge / Homelab 12U',
    shortName: 'Edge 12U',
    description: 'Compact networking, virtualization, and NAS in a short-depth enclosed rack.',
    badge: 'Balanced',
    build: () => state(baseRack({
      name: 'Homelab Edge 12U', heightU: 12, depthMm: 800, coolingKw: 3,
      circuitAAmps: 15, circuitBAmps: 15, redundancy: 'N', voltage: 120,
    }), [
      place('tor-1u', 10),
      place('patch-48-1u', 8),
      place('edge-short-1u', 5),
      place('nas-2u', 2),
      place('cable-manager-1u', 7),
      place('blanking-solid-1u', 9),
      place('blanking-solid-1u', 1),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'right' }),
    ], 'edge-12u'),
  },
  {
    id: 'sbc-edge-24u',
    name: 'SBC / Edge Lab 24U',
    shortName: 'Edge Lab 24U',
    description: 'ARM and x86 SBC clusters, mini PCs, PoE access switching, and active cabinet cooling.',
    badge: 'Edge Lab',
    build: () => state(baseRack({
      name: 'SBC & Edge Lab 24U', heightU: 24, depthMm: 800, coolingKw: 4,
      circuitAAmps: 20, circuitBAmps: 20, redundancy: 'N+1', voltage: 120,
    }), [
      place('sw-poe48-1u', 22),
      place('sw-sfp10-1u', 20),
      place('patch-48-1u', 19),
      place('sbc-pi24-4u', 15),
      place('sbc-pi12-2u', 12),
      place('sbc-nuc13-1u', 10),
      place('sbc-ryzen-1u', 9),
      place('pc-office-2u', 6),
      place('fan-tray-2u', 3),
      place('cable-manager-1u', 14),
      place('blanking-solid-1u', 21), place('blanking-solid-1u', 11),
      place('blanking-solid-1u', 8), place('blanking-solid-1u', 5),
      place('blanking-solid-1u', 0), place('blanking-solid-1u', 1), place('blanking-solid-1u', 2),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'left' }),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'right', pdu: 'B' }),
    ], 'sbc-edge-24u'),
  },
  {
    id: 'enterprise-42u',
    name: 'Enterprise Virtualization 42U',
    shortName: 'Enterprise 42U',
    description: 'Dual-spine virtualization cluster with redundant power and FC storage.',
    badge: 'Production',
    build: () => state(baseRack({
      name: 'Virtualization Cluster Rack 07', heightU: 42, depthMm: 1200,
      coolingKw: 10, staticRatingKg: 1200, rollingRatingKg: 800,
    }), [
      place('core-2u', 39),
      place('tor-1u', 36),
      place('patch-fiber-1u', 34),
      place('patch-48-1u', 33),
      place('srv-1u-650', 28), place('srv-1u-650', 27),
      place('srv-1u-650', 25), place('srv-1u-650', 24),
      place('srv-1u-650', 22), place('srv-1u-650', 21),
      place('srv-2u-750', 17), place('srv-2u-750', 14),
      place('cable-manager-1u', 20), place('cable-manager-1u', 19),
      place('storage-array-4u', 9),
      place('nas-2u', 6),
      place('ups-2u', 2),
      place('blanking-solid-1u', 30), place('blanking-solid-1u', 13),
      place('blanking-solid-1u', 37),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'left' }),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'right', pdu: 'B' }),
    ], 'enterprise-42u'),
  },
  {
    id: 'ai-storage-48u',
    name: 'High-Density AI / Storage 48U',
    shortName: 'AI 48U',
    description: 'Accelerated compute with constrained cooling and a heavy UPS — a troubleshooting scenario.',
    badge: 'Warnings',
    build: () => state(baseRack({
      name: 'AI Training Rack A-12', heightU: 48, depthMm: 1200, coolingKw: 6,
      staticRatingKg: 1400, rollingRatingKg: 900, circuitAAmps: 30,
      circuitBAmps: 30, ambientC: 25,
    }), [
      place('core-2u', 46),
      place('tor-1u', 45),
      place('ai-trainer-4u', 35), place('ai-trainer-4u', 31), place('ai-trainer-4u', 27),
      place('srv-2u-750', 18), place('srv-2u-750', 15),
      place('jbod-4u', 10), place('jbod-4u', 5), place('storage-array-4u', 0),
      place('ups-4u', 39),
      place('switch-reverse-1u', 20),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'left' }),
      place('pdu-vertical', 0, { mount: 'vertical', side: 'right', pdu: 'B' }),
    ], 'ai-storage-48u'),
  },
];
