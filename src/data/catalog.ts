import type { HardwareTemplate } from '../types';
import { EXTENDED_HARDWARE_CATALOG } from './catalogExtended';

const hw = (item: HardwareTemplate): HardwareTemplate => item;

const BASE_HARDWARE: HardwareTemplate[] = [
  hw({
    id: 'srv-1u-650', name: 'PowerEdge R650', vendor: 'Dell', category: 'compute', uHeight: 1,
    depthMm: 737, widthMm: 482, weightKg: 21.5, ratedW: 1100, typicalW: 420, peakW: 850,
    airflow: 'front-to-back', ports: '2× 10GbE, 2× 25GbE, iDRAC', color: '#6f93b8',
    description: 'Dual-socket 1U virtualization node with 32 DIMM slots and redundant PSUs.',
  }),
  hw({
    id: 'srv-2u-750', name: 'ProLiant DL380 Gen11', vendor: 'HPE', category: 'compute', uHeight: 2,
    depthMm: 737, widthMm: 482, weightKg: 27.2, ratedW: 1600, typicalW: 510, peakW: 1100,
    airflow: 'front-to-back', ports: '4× 1GbE, 2× 25GbE, iLO', color: '#6f93b8',
    description: 'Versatile 2U enterprise server for virtualization, databases, and VDI.',
  }),
  hw({
    id: 'edge-short-1u', name: 'SYS-E200-8D Edge Node', vendor: 'Supermicro', category: 'compute', uHeight: 1,
    depthMm: 450, widthMm: 444, weightKg: 14.8, ratedW: 650, typicalW: 210, peakW: 460,
    airflow: 'front-to-back', ports: '2× 10GbE, 4× 2.5GbE, IPMI', color: '#6f93b8',
    description: 'Short-depth fanless-compatible edge server with low acoustic profile.',
  }),
  hw({
    id: 'blade-enclosure', name: 'FlexSystem Enterprise Chassis', vendor: 'Lenovo', category: 'compute', uHeight: 10,
    depthMm: 1140, widthMm: 482, weightKg: 128, ratedW: 8000, typicalW: 3600, peakW: 6800,
    airflow: 'front-to-back', ports: '14× compute bays, dual fabric', color: '#6f93b8',
    description: 'Dense 10U blade chassis with 14 half-width compute nodes and shared power.',
  }),
  hw({
    id: 'ai-trainer-4u', name: 'HGX A100 4U Baseboard', vendor: 'Generic', category: 'compute', uHeight: 4,
    depthMm: 900, widthMm: 482, weightKg: 62, ratedW: 6500, typicalW: 3100, peakW: 5800,
    airflow: 'front-to-back', ports: '4× 200GbE, 8× GPU', color: '#b38363',
    description: 'Four-GPU accelerated node intended for high-density AI training.',
  }),
  hw({
    id: 'nas-2u', name: 'Synology RS2423RP+', vendor: 'Synology', category: 'storage', uHeight: 2,
    depthMm: 656, widthMm: 482, weightKg: 15.1, ratedW: 360, typicalW: 130, peakW: 260,
    airflow: 'front-to-back', ports: '12× 3.5″, 4× 2.5GbE', color: '#5f8f83',
    description: '12-bay rack NAS with redundant power and compact management UI.',
  }),
  hw({
    id: 'jbod-4u', name: 'Unity 4U60 JBOD', vendor: 'Generic', category: 'storage', uHeight: 4,
    depthMm: 850, widthMm: 482, weightKg: 44, ratedW: 800, typicalW: 280, peakW: 520,
    airflow: 'front-to-back', ports: '60× 3.5″, 4× 12Gb/s SAS', color: '#5f8f83',
    description: 'High-density 60-bay SAS JBOD for backup and cold-storage tiers.',
  }),
  hw({
    id: 'storage-array-4u', name: 'PowerVault ME5084', vendor: 'Dell', category: 'storage', uHeight: 4,
    depthMm: 870, widthMm: 482, weightKg: 48.5, ratedW: 1100, typicalW: 460, peakW: 820,
    airflow: 'front-to-back', ports: '84× 3.5″, 4× 32Gb FC', color: '#5f8f83',
    description: '84-bay unified storage array with dual active-active controllers.',
  }),
  hw({
    id: 'nas-4u', name: 'TrueNAS M-Series 4U', vendor: 'iXsystems', category: 'storage', uHeight: 4,
    depthMm: 760, widthMm: 482, weightKg: 36.8, ratedW: 900, typicalW: 340, peakW: 660,
    airflow: 'front-to-back', ports: '48× LFF, 2× 100GbE', color: '#5f8f83',
    description: '48-bay ZFS appliance with flash tier and scale-out networking.',
  }),
  hw({
    id: 'tor-1u', name: 'Nexus 93180YC-FX', vendor: 'Cisco', category: 'network', uHeight: 1,
    depthMm: 516, widthMm: 482, weightKg: 10.4, ratedW: 440, typicalW: 180, peakW: 350,
    airflow: 'front-to-back', ports: '48× 25G, 6× 100G', color: '#d6a34c',
    description: 'Top-of-rack leaf with 48 SFP28 and 6 QSFP28 uplinks.',
  }),
  hw({
    id: 'core-2u', name: 'Arista 7050SX3-48YC8', vendor: 'Arista', category: 'network', uHeight: 2,
    depthMm: 420, widthMm: 482, weightKg: 12.8, ratedW: 550, typicalW: 210, peakW: 430,
    airflow: 'front-to-back', ports: '48× 25G, 8× 100G', color: '#d6a34c',
    description: 'Programmable spine/core switch with telemetry and low latency.',
  }),
  hw({
    id: 'switch-reverse-1u', name: 'Legacy 48G Switch', vendor: 'Generic', category: 'network', uHeight: 1,
    depthMm: 432, widthMm: 482, weightKg: 6.5, ratedW: 180, typicalW: 78, peakW: 140,
    airflow: 'back-to-front', ports: '48× 1GbE, 4× SFP', color: '#cf8b52',
    description: 'Older switch with reverse airflow; verify aisle orientation before deployment.',
  }),
  hw({
    id: 'patch-48-1u', name: '48-Port Cat6A Patch Panel', vendor: 'Panduit', category: 'network', uHeight: 1,
    depthMm: 86, widthMm: 482, weightKg: 2.1, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: '48× RJ45, shielded', color: '#78889e',
    description: 'High-density shielded copper patching panel with rear cable management.',
  }),
  hw({
    id: 'patch-fiber-1u', name: 'LC Duplex Fiber Panel', vendor: 'Corning', category: 'network', uHeight: 1,
    depthMm: 254, widthMm: 482, weightKg: 3.8, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: '48× LC duplex', color: '#78889e',
    description: 'MTP-to-LC fiber distribution panel for structured cabling.',
  }),
  hw({
    id: 'cable-manager-1u', name: 'Horizontal Cable Manager', vendor: 'nVent', category: 'accessory', uHeight: 1,
    depthMm: 140, widthMm: 482, weightKg: 1.2, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: '5× finger guides', color: '#78889e',
    description: 'Low-profile horizontal manager with reusable hook-and-loop straps.',
  }),
  hw({
    id: 'pdu-vertical', name: 'Metered 0U Vertical PDU', vendor: 'APC', category: 'power', uHeight: 0,
    depthMm: 48, widthMm: 48, weightKg: 4.2, ratedW: 7040, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: '24× C13, 6× C19, NEMA L14-30P', color: '#cf8b52',
    description: 'Zero-U three-phase metered PDU with per-outlet switching.',
  }),
  hw({
    id: 'ups-2u', name: 'Smart-UPS SRT 2200VA', vendor: 'APC', category: 'power', uHeight: 2,
    depthMm: 614, widthMm: 482, weightKg: 31.6, ratedW: 2200, typicalW: 55, peakW: 2200,
    airflow: 'front-to-back', ports: '6× C13, 2× C19', color: '#cf8b52',
    description: 'Line-interactive 2.2kVA UPS with network card and battery bypass.',
  }),
  hw({
    id: 'ups-4u', name: 'Smart-UPS SRT 5000VA', vendor: 'APC', category: 'power', uHeight: 4,
    depthMm: 716, widthMm: 482, weightKg: 56.8, ratedW: 5000, typicalW: 120, peakW: 5000,
    airflow: 'front-to-back', ports: '8× C13, 2× C19', color: '#cf8b52',
    description: 'Heavy 4U UPS. Mount low in the rack to preserve center of gravity.',
  }),
  hw({
    id: 'blanking-1u', name: 'Perforated Blanking Panel', vendor: 'nVent', category: 'thermal', uHeight: 1,
    depthMm: 42, widthMm: 482, weightKg: 0.6, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: 'Tool-free clip', color: '#6f9f7f',
    description: 'Perforated 1U panel that closes unused rack space and limits recirculation.',
  }),
  hw({
    id: 'blanking-solid-1u', name: 'Solid Blanking Panel', vendor: 'nVent', category: 'thermal', uHeight: 1,
    depthMm: 42, widthMm: 482, weightKg: 0.7, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: 'Tool-free clip', color: '#6f9f7f',
    description: 'Solid 1U blank for aisle separation and maximum recirculation control.',
  }),
  hw({
    id: 'fan-tray-1u', name: 'Active Fan Tray', vendor: 'nVent', category: 'thermal', uHeight: 1,
    depthMm: 140, widthMm: 482, weightKg: 2.4, ratedW: 65, typicalW: 38, peakW: 55,
    airflow: 'front-to-back', ports: '3× high-static fans', color: '#6f9f7f',
    description: 'Variable-speed fan tray that supplements cabinet airflow.',
  }),
  hw({
    id: 'baffle-2u', name: 'Rack Airflow Baffle', vendor: 'nVent', category: 'thermal', uHeight: 2,
    depthMm: 900, widthMm: 482, weightKg: 5.1, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: 'Seals duct interface', color: '#6f9f7f',
    description: 'Two-U sealing baffle to connect rack exhaust to a containment duct.',
  }),
  hw({
    id: 'shelf-1u', name: 'Cantilever Equipment Shelf', vendor: 'Middle Atlantic', category: 'accessory', uHeight: 1,
    depthMm: 600, widthMm: 482, weightKg: 4.5, ratedW: 0, typicalW: 0, peakW: 0,
    airflow: 'passive', ports: '45 kg load rating', color: '#78889e',
    description: 'Ventilated 1U shelf for non-rackmount equipment.',
  }),
  hw({
    id: 'console-1u', name: '1U KVM Console', vendor: 'Dell', category: 'accessory', uHeight: 1,
    depthMm: 508, widthMm: 482, weightKg: 8.6, ratedW: 15, typicalW: 8, peakW: 12,
    airflow: 'passive', ports: '17″ LCD, 8-port KVM', color: '#78889e',
    description: 'Slide-out console with integrated keyboard, touchpad, and KVM switch.',
  }),
];

function inferSubtype(item: HardwareTemplate): string {
  if (item.subtype) return item.subtype;
  if (item.category === 'network') {
    if (item.name.includes('Patch')) return 'Patch Panel';
    if (item.name.includes('Cable')) return 'Cable Manager';
    return 'Switch';
  }
  if (item.category === 'power') return item.name.includes('UPS') ? 'UPS' : 'PDU';
  if (item.category === 'thermal') return item.typicalW > 0 ? 'Fan / Airflow' : item.name.includes('Baffle') ? 'Airflow Baffle' : 'Blanking Panel';
  if (item.category === 'accessory') return item.name.includes('Shelf') ? 'Equipment Shelf' : 'Console / KVM';
  if (item.category === 'storage') return item.name.includes('JBOD') ? 'JBOD' : item.name.includes('NAS') || item.name.includes('TrueNAS') ? 'NAS Appliance' : 'Storage Array';
  if (item.name.includes('Blade')) return 'Blade Chassis';
  if (item.name.includes('HGX')) return 'AI Server';
  if (item.name.startsWith('PowerEdge') || item.name.startsWith('ProLiant') || item.name.startsWith('ThinkSystem')) return 'Rack Server';
  if (item.name.includes('Edge')) return 'Edge Server';
  return 'Rack Server';
}

export const HARDWARE_CATALOG: HardwareTemplate[] = [
  ...BASE_HARDWARE.map((item) => ({ ...item, subtype: inferSubtype(item) })),
  ...EXTENDED_HARDWARE_CATALOG,
];

export const CATEGORY_META = {
  compute: { label: 'Compute', color: '#6f93b8' },
  sbc: { label: 'SBC / Edge', color: '#8d99a6' },
  storage: { label: 'Storage', color: '#5f8f83' },
  network: { label: 'Network', color: '#d6a34c' },
  power: { label: 'Power', color: '#cf8b52' },
  thermal: { label: 'Thermal', color: '#6f9f7f' },
  accessory: { label: 'Accessory', color: '#84909d' },
} as const;
