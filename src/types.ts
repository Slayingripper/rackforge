export type Category = 'compute' | 'sbc' | 'storage' | 'network' | 'power' | 'thermal' | 'accessory';
export type Airflow = 'front-to-back' | 'back-to-front' | 'side-to-side' | 'passive';
export type MountType = 'front' | 'rear' | 'vertical';
export type DeviceStatus = 'active' | 'reserved';
export type PduFeed = 'A' | 'B';
export type FanProfile = 'eco' | 'balanced' | 'max';
export type Redundancy = 'N' | 'N+1' | '2N';
export type ViewMode = '3d' | '2d';
export type OverlayMode = 'normal' | 'airflow' | 'thermal' | 'power' | 'weight';
export type RackForm = 'open-2post' | 'open-4post' | 'enclosed';
export type Severity = 'ok' | 'warning' | 'critical';

export interface RackZone {
  id: string;
  name: string;
  startU: number;
  endU: number;
  kind: 'reserved' | 'blocked';
}

export interface RackConfig {
  name: string;
  heightU: 12 | 24 | 42 | 48;
  widthMm: 600 | 800;
  depthMm: 800 | 1000 | 1200;
  form: RackForm;
  perforatedDoors: boolean;
  sidePanels: boolean;
  staticRatingKg: number;
  rollingRatingKg: number;
  voltage: 120 | 208 | 230 | 240;
  phases: 1 | 3;
  circuitAAmps: number;
  circuitBAmps: number;
  redundancy: Redundancy;
  ambientC: number;
  coolingKw: number;
  fanProfile: FanProfile;
  electricityRate: number;
  zones: RackZone[];
}

export interface HardwareTemplate {
  id: string;
  name: string;
  vendor: string;
  category: Category;
  subtype?: string;
  uHeight: number;
  depthMm: number;
  widthMm: number;
  weightKg: number;
  ratedW: number;
  typicalW: number;
  peakW: number;
  airflow: Airflow;
  ports: string;
  description: string;
  color: string;
  custom?: boolean;
}

export interface DeviceOverrides {
  label?: string;
  typicalW?: number;
  peakW?: number;
  weightKg?: number;
}

export interface PlacedDevice {
  instanceId: string;
  hardwareId: string;
  startU: number;
  status: DeviceStatus;
  mount: MountType;
  pdu: PduFeed;
  side: 'left' | 'right';
  flipped: boolean;
  overrides?: DeviceOverrides;
}

export interface AppState {
  version: 1;
  rack: RackConfig;
  devices: PlacedDevice[];
  customHardware: HardwareTemplate[];
  selectedId: string | null;
  view: ViewMode;
  overlay: OverlayMode;
  activePreset: string | null;
}

export interface PlacementCheck {
  valid: boolean;
  reason?: string;
}

export interface DeviceTelemetry {
  instanceId: string;
  pdu: PduFeed;
  typicalW: number;
  peakW: number;
  heatW: number;
  weightKg: number;
  ampsA: number;
  ampsB: number;
  localTempC: number;
  severity: Severity;
}

export interface PduMetrics {
  feed: PduFeed;
  typicalW: number;
  peakW: number;
  amps: number;
  peakAmps: number;
  capacityW: number;
  breakerAmps: number;
  loadPercent: number;
  peakPercent: number;
  severity: Severity;
}

export interface SimulationWarning {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
  deviceId?: string;
  startU?: number;
}

export interface AirflowGap {
  startU: number;
  endU: number;
  size: number;
}

export interface SimulationResult {
  activeDevices: PlacedDevice[];
  telemetry: DeviceTelemetry[];
  typicalW: number;
  peakW: number;
  ratedW: number;
  heatW: number;
  heatBtuHr: number;
  heatKw: number;
  monthlyKwh: number;
  annualKwh: number;
  monthlyCost: number;
  annualCost: number;
  totalWeightKg: number;
  occupiedU: number;
  utilizationPct: number;
  centerOfGravityMm: number;
  centerOfGravityPct: number;
  pduA: PduMetrics;
  pduB: PduMetrics;
  estimatedAirflowCfm: number;
  airflowEfficiencyPct: number;
  recirculationRiskPct: number;
  bypassRiskPct: number;
  recirculationGaps: AirflowGap[];
  availableCoolingKw: number;
  thermalLoadPct: number;
  averageExhaustC: number;
  maxDeviceTempC: number;
  warnings: SimulationWarning[];
  severity: Severity;
  redundancyNote: string;
  verticalWeightKg: number;
}
