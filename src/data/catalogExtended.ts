import type { HardwareTemplate } from '../types';

const hw = (item: HardwareTemplate): HardwareTemplate => item;

export const EXTENDED_HARDWARE_CATALOG: HardwareTemplate[] = [
  // Rackmount PCs, workstations, and additional server configurations
  hw({
    id: 'ws-gpu-4u', name: 'Precision 7960 Rack Workstation', vendor: 'Dell', category: 'compute', subtype: 'GPU Workstation', uHeight: 4,
    depthMm: 900, widthMm: 482, weightKg: 68, ratedW: 2200, typicalW: 1150, peakW: 1900,
    airflow: 'front-to-back', ports: '2× RTX 6000 Ada, 4× 10GbE, 2× TB NVMe', color: '#b38363',
    description: 'Four-U GPU workstation for CAD, rendering, simulation, and AI inference with redundant power.',
  }),
  hw({
    id: 'ws-gpu-2u', name: 'ThinkStation P620 Rack', vendor: 'Lenovo', category: 'compute', subtype: 'GPU Workstation', uHeight: 2,
    depthMm: 650, widthMm: 482, weightKg: 31, ratedW: 1400, typicalW: 620, peakW: 1100,
    airflow: 'front-to-back', ports: '1× RTX 5000 Ada, 2× 25GbE, 4× M.2', color: '#b38363',
    description: 'Compact two-U accelerated workstation with ISV certification and quiet operation.',
  }),
  hw({
    id: 'pc-office-1u', name: 'OptiPlex Micro Rack PC', vendor: 'Dell', category: 'compute', subtype: 'Rack PC', uHeight: 1,
    depthMm: 380, widthMm: 482, weightKg: 12, ratedW: 450, typicalW: 160, peakW: 300,
    airflow: 'front-to-back', ports: '2× 2.5GbE, 2× DP, 1× M.2, 1× 2.5″ SSD', color: '#6f93b8',
    description: 'Low-power one-U terminal and virtualization PC in a secured rack carrier.',
  }),
  hw({
    id: 'pc-office-2u', name: 'ProDesk 400 G9 Rack PC', vendor: 'HP', category: 'compute', subtype: 'Rack PC', uHeight: 2,
    depthMm: 500, widthMm: 482, weightKg: 19, ratedW: 650, typicalW: 220, peakW: 420,
    airflow: 'front-to-back', ports: '2× 1GbE, 2× DP, 2× M.2, 1× 3.5″', color: '#6f93b8',
    description: 'General-purpose two-U rack PC for office workloads, lab automation, and VDI endpoints.',
  }),
  hw({
    id: 'srv-amd-2u', name: 'PowerEdge R7625', vendor: 'Dell', category: 'compute', subtype: 'Rack Server', uHeight: 2,
    depthMm: 737, widthMm: 482, weightKg: 29.5, ratedW: 1800, typicalW: 640, peakW: 1250,
    airflow: 'front-to-back', ports: '2× 25GbE, 4× 10GbE, 24× DDR5', color: '#6f93b8',
    description: 'Dual AMD EPYC 9004 server with 24 DIMMs and twelve front-accessible drive bays.',
  }),
  hw({
    id: 'srv-density-2u', name: 'ProLiant DL380 Gen11 Plus', vendor: 'HPE', category: 'compute', subtype: 'Rack Server', uHeight: 2,
    depthMm: 800, widthMm: 482, weightKg: 34, ratedW: 2000, typicalW: 720, peakW: 1350,
    airflow: 'front-to-back', ports: '2× 100GbE, 4× 25GbE, 24× SFF', color: '#6f93b8',
    description: 'High-density two-U virtualization node with 24 SFF bays and high-speed fabric options.',
  }),
  hw({
    id: 'edge-short-2u', name: 'SYS-E302-12D Edge Server', vendor: 'Supermicro', category: 'compute', subtype: 'Edge Server', uHeight: 2,
    depthMm: 480, widthMm: 444, weightKg: 18, ratedW: 700, typicalW: 280, peakW: 520,
    airflow: 'front-to-back', ports: '2× 10GbE, 4× 2.5GbE, 2× NVMe', color: '#6f93b8',
    description: 'Short-depth two-U edge server for distributed sites and constrained cabinets.',
  }),
  hw({
    id: 'srv-lowpower-1u', name: 'ThinkSystem SR650 V3 Eco', vendor: 'Lenovo', category: 'compute', subtype: 'Rack Server', uHeight: 1,
    depthMm: 600, widthMm: 482, weightKg: 17, ratedW: 800, typicalW: 260, peakW: 500,
    airflow: 'front-to-back', ports: '2× 10GbE, 4× 1GbE, 8× DDR5', color: '#6f93b8',
    description: 'Efficiency-tuned one-U server with low idle draw for always-on services.',
  }),
  hw({
    id: 'ws-amd-2u', name: 'Threadripper Pro Rack Workstation', vendor: 'AMD', category: 'compute', subtype: 'GPU Workstation', uHeight: 2,
    depthMm: 700, widthMm: 482, weightKg: 36, ratedW: 1600, typicalW: 780, peakW: 1300,
    airflow: 'front-to-back', ports: '64× PCIe 5.0, 2× 100GbE, 4× NVMe', color: '#b38363',
    description: 'Two-U creator workstation for 3D rendering, simulation, and multi-GPU inference.',
  }),
  hw({
    id: 'pc-thin-1u', name: 'Thin Client Rack PC', vendor: 'Lenovo', category: 'compute', subtype: 'Rack PC', uHeight: 1,
    depthMm: 320, widthMm: 482, weightKg: 4.5, ratedW: 90, typicalW: 25, peakW: 50,
    airflow: 'passive', ports: '2× DisplayPort, 2× USB-C, 1× GbE', color: '#6f93b8',
    description: 'Low-power one-U thin client for VDI, signage, and managed endpoint fleets.',
  }),

  // Single-board computers and miniature edge nodes
  hw({
    id: 'sbc-pi8-1u', name: 'Raspberry Pi 5 · 8-Node Cluster', vendor: 'Raspberry Pi', category: 'sbc', subtype: 'SBC Cluster', uHeight: 1,
    depthMm: 300, widthMm: 482, weightKg: 8, ratedW: 180, typicalW: 65, peakW: 110,
    airflow: 'front-to-back', ports: '8× 2.5GbE, 8× USB-C, 32× microSD', color: '#8d99a6',
    description: 'Eight Raspberry Pi 5 nodes in a one-U carrier with individual power and network breakout.',
  }),
  hw({
    id: 'sbc-pi24-4u', name: 'Raspberry Pi CM5 · 24-Node Cluster', vendor: 'Raspberry Pi', category: 'sbc', subtype: 'SBC Cluster', uHeight: 4,
    depthMm: 400, widthMm: 482, weightKg: 18, ratedW: 420, typicalW: 150, peakW: 240,
    airflow: 'front-to-back', ports: '24× 1GbE, 24× CM5, NVMe carrier', color: '#8d99a6',
    description: 'Four-U ARM cluster with 24 compute modules for Kubernetes and distributed build workloads.',
  }),
  hw({
    id: 'sbc-nuc13-1u', name: 'Intel NUC 13 Pro Rack Carrier', vendor: 'Intel', category: 'sbc', subtype: 'Mini PC', uHeight: 1,
    depthMm: 220, widthMm: 482, weightKg: 5, ratedW: 120, typicalW: 45, peakW: 90,
    airflow: 'side-to-side', ports: '2× Thunderbolt 4, 2× 2.5GbE, 2× M.2', color: '#8d99a6',
    description: 'Fanless one-U carrier for a NUC 13 Pro mini PC with side intake and exhaust.',
  }),
  hw({
    id: 'sbc-ryzen-1u', name: 'Ryzen 7 Mini PC · Rack Kit', vendor: 'AMD', category: 'sbc', subtype: 'Mini PC', uHeight: 1,
    depthMm: 250, widthMm: 482, weightKg: 6, ratedW: 150, typicalW: 65, peakW: 120,
    airflow: 'front-to-back', ports: '2× USB4, 2× 2.5GbE, 2× M.2', color: '#8d99a6',
    description: 'Compact Ryzen mini workstation with rack ears, front I/O, and a 65W thermal design.',
  }),
  hw({
    id: 'sbc-ampere-2u', name: 'Ampere Altra Developer Rack', vendor: 'Ampere', category: 'sbc', subtype: 'ARM Server', uHeight: 2,
    depthMm: 600, widthMm: 482, weightKg: 16, ratedW: 600, typicalW: 320, peakW: 520,
    airflow: 'front-to-back', ports: '32× Arm Neoverse N1, 8× 25GbE, 4× NVMe', color: '#8d99a6',
    description: 'Two-U cloud-native ARM development server with 32 cores and high core density.',
  }),
  hw({
    id: 'sbc-fanless-1u', name: 'Fanless ARM Edge Node', vendor: 'SolidRun', category: 'sbc', subtype: 'Fanless SBC', uHeight: 1,
    depthMm: 280, widthMm: 482, weightKg: 4, ratedW: 60, typicalW: 28, peakW: 55,
    airflow: 'passive', ports: '2× 1GbE, 2× USB 3.2, eMMC + M.2', color: '#8d99a6',
    description: 'Silent one-U ARM node for protocol gateways, monitoring, and lightweight services.',
  }),
  hw({
    id: 'sbc-jetson-2u', name: 'Jetson AGX Orin · 8-Node Cluster', vendor: 'NVIDIA', category: 'sbc', subtype: 'Edge AI SBC', uHeight: 2,
    depthMm: 550, widthMm: 482, weightKg: 15, ratedW: 600, typicalW: 250, peakW: 450,
    airflow: 'front-to-back', ports: '8× Jetson AGX Orin, 4× 25GbE, NVMe', color: '#8d99a6',
    description: 'Two-U edge AI cluster for computer vision, robotics, and distributed inference workloads.',
  }),
  hw({
    id: 'sbc-poe-1u', name: 'Raspberry Pi 4 · PoE Sensor Node', vendor: 'Raspberry Pi', category: 'sbc', subtype: 'PoE SBC', uHeight: 1,
    depthMm: 350, widthMm: 482, weightKg: 7, ratedW: 120, typicalW: 55, peakW: 100,
    airflow: 'passive', ports: '4× 802.3at PoE, 4× GPIO breakouts', color: '#8d99a6',
    description: 'One-U carrier for four PoE-powered sensor computers with protected GPIO terminals.',
  }),
  hw({
    id: 'sbc-pi12-2u', name: 'Raspberry Pi 5 · 12-Node Cluster', vendor: 'Raspberry Pi', category: 'sbc', subtype: 'SBC Cluster', uHeight: 2,
    depthMm: 450, widthMm: 482, weightKg: 12, ratedW: 260, typicalW: 110, peakW: 190,
    airflow: 'front-to-back', ports: '12× 2.5GbE, 12× USB-C, NVMe option', color: '#8d99a6',
    description: 'Twelve-node Pi cluster with a managed fan module and per-node network status LEDs.',
  }),

  // Additional switch classes and port configurations
  hw({
    id: 'sw-poe24-1u', name: 'Catalyst C1000-24P PoE+', vendor: 'Cisco', category: 'network', subtype: 'PoE Switch', uHeight: 1,
    depthMm: 250, widthMm: 482, weightKg: 5.8, ratedW: 480, typicalW: 190, peakW: 370,
    airflow: 'front-to-back', ports: '24× GbE PoE+, 4× SFP, 190W budget', color: '#d6a34c',
    description: 'Managed one-Gigabit access switch with a 190W PoE+ budget for APs and endpoints.',
  }),
  hw({
    id: 'sw-poe48-1u', name: 'Instant On 1930 48G PoE', vendor: 'HPE', category: 'network', subtype: 'PoE Switch', uHeight: 1,
    depthMm: 280, widthMm: 482, weightKg: 6.9, ratedW: 760, typicalW: 400, peakW: 750,
    airflow: 'front-to-back', ports: '48× GbE PoE+, 4× SFP, 370W budget', color: '#d6a34c',
    description: 'High-port-count access switch with cloud management and a 370W PoE+ power budget.',
  }),
  hw({
    id: 'sw-sfp10-1u', name: 'MikroTik CRS309 10G', vendor: 'MikroTik', category: 'network', subtype: '10G Switch', uHeight: 1,
    depthMm: 200, widthMm: 482, weightKg: 3.2, ratedW: 90, typicalW: 35, peakW: 70,
    airflow: 'front-to-back', ports: '8× SFP+, 1× 10G SFP+, 1× 1G', color: '#d6a34c',
    description: 'Compact fan-assisted ten-gigabit aggregation switch for homelabs and edge sites.',
  }),
  hw({
    id: 'sw-sfp28-32-1u', name: 'Arista 7050SX3-32S', vendor: 'Arista', category: 'network', subtype: '25G Switch', uHeight: 1,
    depthMm: 420, widthMm: 482, weightKg: 9.1, ratedW: 420, typicalW: 195, peakW: 380,
    airflow: 'front-to-back', ports: '32× SFP28, 4× QSFP28', color: '#d6a34c',
    description: 'Thirty-two-port 25GbE leaf switch with deep packet buffers and ECS telemetry.',
  }),
  hw({
    id: 'sw-100g-2u', name: 'Nexus 9316D-GX', vendor: 'Cisco', category: 'network', subtype: '100G Core Switch', uHeight: 2,
    depthMm: 650, widthMm: 482, weightKg: 22, ratedW: 1600, typicalW: 780, peakW: 1250,
    airflow: 'front-to-back', ports: '14× 100G QSFP28, 2× 400G QSFP-DD', color: '#d6a34c',
    description: 'Two-U 100/400GbE spine for storage fabrics, AI clusters, and virtualized compute.',
  }),
  hw({
    id: 'sw-modular-4u', name: 'Virtual Services Framework Chassis', vendor: 'Cisco', category: 'network', subtype: 'Modular Core', uHeight: 4,
    depthMm: 850, widthMm: 482, weightKg: 45, ratedW: 3000, typicalW: 1450, peakW: 2400,
    airflow: 'front-to-back', ports: '8× line-card slots, dual supervisor', color: '#d6a34c',
    description: 'Four-U modular core chassis with redundant supervisors and hot-swappable line cards.',
  }),
  hw({
    id: 'sw-industrial-1u', name: 'IE-3300 Industrial Switch', vendor: 'Cisco', category: 'network', subtype: 'Industrial Switch', uHeight: 1,
    depthMm: 360, widthMm: 482, weightKg: 8.4, ratedW: 140, typicalW: 60, peakW: 110,
    airflow: 'front-to-back', ports: '8× GbE, 2× SFP, 4× PoE', color: '#d6a34c',
    description: 'Rugged managed switch with vibration resistance, wide-temperature parts, and DIN-rail kit.',
  }),
  hw({
    id: 'sw-legacy-reverse-2u', name: 'Legacy 48G Rear-Air Switch', vendor: 'Generic', category: 'network', subtype: 'Switch', uHeight: 2,
    depthMm: 480, widthMm: 482, weightKg: 10.5, ratedW: 240, typicalW: 105, peakW: 190,
    airflow: 'back-to-front', ports: '48× GbE, 4× SFP, console', color: '#cf8b52',
    description: 'Older two-U access switch with rear-to-front airflow for legacy hot-aisle deployments.',
  }),

  // Fan trays, exhaust kits, and airflow appliances
  hw({
    id: 'fan-tray-2u', name: 'Six-Fan High-Static Tray', vendor: 'nVent', category: 'thermal', subtype: 'Fan Tray', uHeight: 2,
    depthMm: 140, widthMm: 482, weightKg: 4.8, ratedW: 180, typicalW: 120, peakW: 165,
    airflow: 'front-to-back', ports: '6× counter-rotating fans, PWM', color: '#6f9f7f',
    description: 'Two-U six-fan tray with high static pressure for dense storage and perforated doors.',
  }),
  hw({
    id: 'fan-rear-exhaust-1u', name: 'Rear Rack Exhaust Kit', vendor: 'Middle Atlantic', category: 'thermal', subtype: 'Exhaust Fan', uHeight: 1,
    depthMm: 120, widthMm: 482, weightKg: 3.1, ratedW: 110, typicalW: 75, peakW: 100,
    airflow: 'back-to-front', ports: '3× rear exhaust fans, thermostat', color: '#6f9f7f',
    description: 'Rear-mounted three-fan exhaust kit with temperature probe and adjustable trigger point.',
  }),
  hw({
    id: 'fan-vertical-0u', name: '0U Vertical Exhaust Fan', vendor: 'nVent', category: 'thermal', subtype: 'Vertical Fan', uHeight: 0,
    depthMm: 48, widthMm: 48, weightKg: 2.8, ratedW: 70, typicalW: 45, peakW: 65,
    airflow: 'side-to-side', ports: '2× high-static fans, 0U rail kit', color: '#6f9f7f',
    description: 'Zero-U vertical fan unit that moves hot exhaust laterally out of enclosed cabinets.',
  }),
  hw({
    id: 'fan-filter-wall-2u', name: 'Filtered Fan Wall · 4-Fan', vendor: 'APC', category: 'thermal', subtype: 'Filter Fan Wall', uHeight: 2,
    depthMm: 90, widthMm: 482, weightKg: 5.4, ratedW: 140, typicalW: 95, peakW: 130,
    airflow: 'front-to-back', ports: '4× washable filter fans', color: '#6f9f7f',
    description: 'Two-U filtered intake wall for dusty edge environments with tool-free filter access.',
  }),
  hw({
    id: 'fan-thermostat-1u', name: 'Thermostatic Dual-Fan Tray', vendor: 'nVent', category: 'thermal', subtype: 'Fan Tray', uHeight: 1,
    depthMm: 140, widthMm: 482, weightKg: 2.9, ratedW: 80, typicalW: 50, peakW: 75,
    airflow: 'front-to-back', ports: '2× variable-speed fans, 10–40°C control', color: '#6f9f7f',
    description: 'Energy-saving dual-fan tray that ramps speed according to measured intake temperature.',
  }),
  hw({
    id: 'fan-highstatic-1u', name: 'High-Static 1U Fan Panel', vendor: 'Generic', category: 'thermal', subtype: 'Fan Panel', uHeight: 1,
    depthMm: 100, widthMm: 482, weightKg: 2.6, ratedW: 95, typicalW: 68, peakW: 88,
    airflow: 'front-to-back', ports: '3× 10K RPM high-static fans', color: '#6f9f7f',
    description: 'One-U pressurization panel for cabinets with restrictive filters or cable obstructions.',
  }),
  hw({
    id: 'fan-blower-1u', name: '1U High-Volume Blower', vendor: 'nVent', category: 'thermal', subtype: 'Blower Fan', uHeight: 1,
    depthMm: 180, widthMm: 482, weightKg: 4.2, ratedW: 240, typicalW: 160, peakW: 220,
    airflow: 'front-to-back', ports: '2× centrifugal blowers, tachometer alarms', color: '#6f9f7f',
    description: 'High-volume one-U blower for moving air through long equipment depths and containment ducts.',
  }),
];
