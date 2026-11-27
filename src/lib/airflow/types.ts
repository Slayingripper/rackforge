import type { Airflow, Severity } from '../../types';

/** Facility-level cooling orientation, in addition to per-device airflow. */
export type CoolingOrientation =
  | 'front-to-back' // cold aisle front, hot aisle rear (default; racks pull front, exhaust rear)
  | 'reverse' // hot/cold swapped
  | 'bottom-to-top' // cold supply at floor, hot return at ceiling (still device-level front-to-back)
  | 'front-only'; // cold inlet front only

export interface AirflowGrid {
  nx: number;
  ny: number;
  nz: number;
  /** cell edge length in metres */
  spacing: number;
  /** world (metres) coordinate of the centre of cell (0,0,0) */
  origin: [number, number, number];
  /** world-metres -> scene-unit scale (scene = world * scenePerMeter) */
  scenePerMeter: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

export interface AirflowSample {
  /** velocity in world metres/second */
  vx: number;
  vy: number;
  vz: number;
  /** speed in world metres/second */
  speed: number;
  /** temperature in degrees Celsius */
  tempC: number;
  /** true if inside a solid cell */
  blocked: boolean;
}

export interface DeviceAirflow {
  instanceId: string;
  airflow: Airflow;
  /** estimated temperature at device intake (°C) */
  intakeTempC: number;
  /** estimated temperature at device exhaust (°C) */
  exhaustTempC: number;
  /** exhaust − intake (°C) */
  deltaT: number;
  /** air speed at intake (m/s) */
  intakeSpeedMps: number;
  /** air speed at exhaust (m/s) */
  exhaustSpeedMps: number;
  /** 0..100 share of intake air that is re-circulated hot exhaust */
  recirculationPct: number;
  /** per-device local hotspot temperature (°C) */
  localTempC: number;
  severity: Severity;
  /** volumetric flow through device (m³/s) */
  flowM3s: number;
  /** scene-space intake port */
  intakeScene: [number, number, number];
  /** scene-space exhaust port */
  exhaustScene: [number, number, number];
}

export interface AirflowReport {
  /** mean temperature at rear/top hot-aisle outlets (°C) */
  averageExhaustC: number;
  /** hottest sampled region temperature (°C) */
  maxTempC: number;
  /** mean intake temperature across active devices (°C) */
  averageIntakeC: number;
  /** hottest intake temperature across active devices (°C) */
  maxIntakeC: number;
  /** rack ΔT: average exhaust − average intake (°C) */
  rackDeltaT: number;
  /** total estimated rack airflow (CFM) */
  estimatedAirflowCfm: number;
  /** total estimated rack airflow (m³/s) */
  totalFlowM3s: number;
  /** total mass flow (kg/s) */
  massFlowKgS: number;
  /** 0..100 flow efficiency (useful front→rear flow vs bypass + recirculation) */
  airflowEfficiencyPct: number;
  /** 0..100 hot-exhaust re-circulating into intakes */
  recirculationRiskPct: number;
  /** 0..100 cold air bypassing equipment straight to hot aisle */
  bypassRiskPct: number;
  /** 0..100 intake air already heated above ambient */
  hotIntakeRiskPct: number;
  /** fraction of rear outlet flow still ~ambient (bypass) 0..100 */
  rearBypassPct: number;
  perDevice: DeviceAirflow[];
  hotspots: { scene: [number, number, number]; tempC: number; severity: Severity }[];
  /** max |divergence| residual after projection (incompressibility check) */
  divergenceResidual: number;
  /** max speed anywhere in field (m/s) */
  maxSpeedMps: number;
  /** convergence flag — steady state approximated within tolerance */
  converged: boolean;
  /** honest note */
  note: string;
}
