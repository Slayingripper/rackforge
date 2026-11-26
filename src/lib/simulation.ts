import type {
  AirflowGap,
  DeviceTelemetry,
  HardwareTemplate,
  PduFeed,
  PduMetrics,
  PlacedDevice,
  RackConfig,
  RackZone,
  FanProfile,
  RackForm,
  Redundancy,
  Severity,
  SimulationResult,
  SimulationWarning,
} from '../types';

export const U_HEIGHT_MM = 44.45;
export const RACK_CABLE_CLEARANCE_MM = 80;
export const BTU_PER_WATT = 3.412142;

export const FAN_PROFILE_FACTOR = {
  eco: 0.82,
  balanced: 1,
  max: 1.18,
} as const;

export const uid = (prefix = 'device') =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const getHardware = (
  catalog: HardwareTemplate[],
  hardwareId: string,
): HardwareTemplate | undefined => catalog.find((item) => item.id === hardwareId);

function numberOr(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isMountType(value: unknown): value is PlacedDevice['mount'] {
  return value === 'front' || value === 'rear' || value === 'vertical';
}

function isSide(value: unknown): value is PlacedDevice['side'] {
  return value === 'left' || value === 'right';
}

export function checkPlacement(
  rack: RackConfig,
  devices: PlacedDevice[],
  hardware: HardwareTemplate,
  candidate: PlacedDevice,
  catalog: HardwareTemplate[],
): { valid: boolean; reason?: string } {
  const rackHeightU = Math.floor(numberOr(rack.heightU, 42));
  const rackDepthMm = Math.max(1, numberOr(rack.depthMm, 1000));
  const rackWidthMm = Math.max(1, numberOr(rack.widthMm, 800));
  const hardwareDepthMm = numberOr(hardware.depthMm, -1);
  const hardwareWidthMm = numberOr(hardware.widthMm, -1);
  const hardwareUHeight = numberOr(hardware.uHeight, -1);
  const candidateMount = candidate.mount;
  const candidateSide = candidate.side;
  const candidateStartU = numberOr(candidate.startU, -1);

  if (!Number.isInteger(hardwareUHeight) || hardwareUHeight < 0) {
    return { valid: false, reason: 'Equipment U height must be a non-negative integer.' };
  }
  if (!Number.isFinite(hardwareDepthMm) || hardwareDepthMm <= 0 || !Number.isFinite(hardwareWidthMm) || hardwareWidthMm <= 0) {
    return { valid: false, reason: 'Equipment depth and width must be positive numbers.' };
  }
  if (hardwareWidthMm > rackWidthMm) {
    return { valid: false, reason: `Equipment is ${hardwareWidthMm}mm wide; rack opening is ${rackWidthMm}mm.` };
  }
  if (hardwareDepthMm + RACK_CABLE_CLEARANCE_MM > rackDepthMm) {
    return {
      valid: false,
      reason: `Needs ${hardwareDepthMm + RACK_CABLE_CLEARANCE_MM}mm depth including cable clearance; rack is ${rackDepthMm}mm.`,
    };
  }
  if (!isMountType(candidateMount) || !isSide(candidateSide)) {
    return { valid: false, reason: 'Invalid mounting plane or side.' };
  }

  const endU = candidateMount === 'vertical' ? candidateStartU : candidateStartU + hardwareUHeight;
  const blockedZone = (Array.isArray(rack.zones) ? rack.zones : []).find(
    (zone: RackZone) => candidateStartU < numberOr(zone.endU, -1) && endU > numberOr(zone.startU, rackHeightU),
  );
  if (blockedZone) {
    return {
      valid: false,
      reason: `${blockedZone.name} reserves U${numberOr(blockedZone.startU, 0) + 1}–${numberOr(blockedZone.endU, 0)}.`,
    };
  }

  if (candidateMount === 'vertical') {
    if (!Number.isInteger(candidateStartU) || candidateStartU !== 0) {
      return { valid: false, reason: 'Vertical accessories must start at U position 0.' };
    }
    if (hardwareUHeight !== 0) {
      return { valid: false, reason: 'Only 0U accessories can be mounted vertically.' };
    }
    const occupied = devices.some(
      (device) =>
        device.instanceId !== candidate.instanceId &&
        device.mount === 'vertical' &&
        device.side === candidateSide,
    );
    return occupied
      ? { valid: false, reason: `The ${candidateSide} vertical mounting rail is already occupied.` }
      : { valid: true };
  }

  if (hardwareUHeight < 1) {
    return { valid: false, reason: 'Choose a vertical side mount for 0U accessories.' };
  }
  if (!Number.isInteger(candidateStartU) || candidateStartU < 0) {
    return { valid: false, reason: 'The device must start on a valid rack unit.' };
  }
  if (endU > rackHeightU) {
    return { valid: false, reason: `This device extends above the ${rackHeightU}U enclosure.` };
  }

  const usableDepth = rackDepthMm - RACK_CABLE_CLEARANCE_MM;
  for (const other of devices) {
    if (other.instanceId === candidate.instanceId || other.mount === 'vertical') continue;
    const otherHardware = getHardwareInList(catalog, other.hardwareId);
    if (!otherHardware) continue;
    const otherUHeight = numberOr(otherHardware.uHeight, 0);
    const otherStartU = numberOr(other.startU, -1);
    if (!Number.isInteger(otherUHeight) || otherUHeight < 1 || !Number.isInteger(otherStartU) || otherStartU < 0) continue;
    const otherEnd = otherStartU + otherUHeight;
    if (candidateStartU >= otherEnd || endU <= otherStartU) continue;
    if (candidateMount === other.mount) {
      return {
        valid: false,
        reason: `Collides with ${otherHardware.name} at U${otherStartU + 1} on the same mounting plane.`,
      };
    }
    const otherDepthMm = numberOr(otherHardware.depthMm, usableDepth);
    if (hardwareDepthMm + otherDepthMm > usableDepth) {
      return {
        valid: false,
        reason: `Front/rear depth overlap with ${otherHardware.name}; ${hardwareDepthMm + otherDepthMm}mm exceeds ${usableDepth}mm usable depth.`,
      };
    }
  }
  return { valid: true };
}

function getHardwareInList(catalog: HardwareTemplate[], id: string) {
  return catalog.find((item) => item.id === id);
}

function severityOf(value: number, warning: number, critical: number): Severity {
  if (!Number.isFinite(value)) return 'critical';
  if (value >= critical) return 'critical';
  if (value >= warning) return 'warning';
  return 'ok';
}

function worstSeverity(severities: Severity[]): Severity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warning')) return 'warning';
  return 'ok';
}

function pduMetrics(
  feed: PduFeed,
  rack: RackConfig,
  active: DeviceTelemetry[],
): PduMetrics {
  const typicalW = active.filter((item) => item.pdu === feed).reduce((sum, item) => sum + numberOr(item.typicalW, 0), 0);
  const peakW = active.filter((item) => item.pdu === feed).reduce((sum, item) => sum + numberOr(item.peakW, 0), 0);
  const breakerAmps = Math.max(0, numberOr(feed === 'A' ? rack.circuitAAmps : rack.circuitBAmps, 0));
  const phaseCount = rack.phases === 3 ? 3 : 1;
  const voltage = Math.max(1, numberOr(rack.voltage, 230));
  const amps = typicalW / (voltage * phaseCount);
  const peakAmps = peakW / (voltage * phaseCount);
  const capacityW = voltage * breakerAmps * phaseCount;
  const hasCapacity = Number.isFinite(capacityW) && capacityW > 0;
  const loadPercent = hasCapacity ? (typicalW / capacityW) * 100 : 999;
  const peakPercent = hasCapacity ? (peakW / capacityW) * 100 : 999;
  return {
    feed,
    typicalW,
    peakW,
    amps,
    peakAmps,
    capacityW,
    breakerAmps,
    loadPercent,
    peakPercent,
    severity: !hasCapacity ? 'critical' : worstSeverity([severityOf(loadPercent, 80, 100), severityOf(peakPercent, 80, 100)]),
  };
}

export type EmptyGap = AirflowGap;

export function findUnblankedGaps(rack: RackConfig, devices: PlacedDevice[], catalog: HardwareTemplate[]): EmptyGap[] {
  const heightU = Math.max(0, Math.floor(numberOr(rack.heightU, 0)));
  const units = Array.from({ length: heightU }, () => ({
    powered: false,
    blank: false,
  }));
  for (const device of devices) {
    const hardware = getHardwareInList(catalog, device.hardwareId);
    if (!hardware || device.mount === 'vertical') continue;
    const startU = numberOr(device.startU, -1);
    const uHeight = numberOr(hardware.uHeight, 0);
    if (!Number.isInteger(startU) || !Number.isInteger(uHeight) || startU < 0 || uHeight < 1) continue;
    for (let u = startU; u < startU + uHeight; u++) {
      if (!units[u]) continue;
      units[u].powered ||= device.status === 'active' && numberOr(hardware.typicalW, 0) > 0;
      units[u].blank ||= hardware.category === 'thermal' && numberOr(hardware.typicalW, 0) === 0;
    }
  }
  const gaps: EmptyGap[] = [];
  let start: number | null = null;
  for (let u = 0; u <= heightU; u++) {
    const empty = u < heightU && !units[u].powered && !units[u].blank;
    if (empty && start === null) start = u;
    if ((!empty || u === heightU) && start !== null) {
      const end = u;
      const hasPoweredNeighbor = start > 0 && end < heightU && units[start - 1]?.powered && units[end]?.powered;
      if (hasPoweredNeighbor && end - start >= 2) gaps.push({ startU: start, endU: end, size: end - start });
      start = null;
    }
  }
  return gaps;
}

function normalizeRackForSimulation(rack: RackConfig): RackConfig {
  const heightU = ([12, 24, 42, 48] as const).find((value) => numberOr(rack.heightU, 42) === value) ?? 42;
  const widthMm = numberOr(rack.widthMm, 800) === 600 ? 600 : 800;
  const depthMm = ([800, 1000, 1200] as const).find((value) => numberOr(rack.depthMm, 1000) === value) ?? 1000;
  const forms: RackForm[] = ['open-2post', 'open-4post', 'enclosed'];
  const fanProfiles: FanProfile[] = ['eco', 'balanced', 'max'];
  const redundancies: Redundancy[] = ['N', 'N+1', '2N'];
  const voltages = [120, 208, 230, 240];
  const staticRatingKg = Math.max(0, numberOr(rack.staticRatingKg, 1000));
  const rollingRatingKg = Math.max(0, Math.min(staticRatingKg, numberOr(rack.rollingRatingKg, staticRatingKg)));
  const zones = (Array.isArray(rack.zones) ? rack.zones : []).flatMap((zone): RackZone[] => {
    if (!zone || typeof zone !== 'object') return [];
    const startU = Math.max(0, Math.floor(numberOr(zone.startU, -1)));
    const endU = Math.min(heightU, Math.floor(numberOr(zone.endU, -1)));
    if (startU < 0 || endU <= startU || endU > heightU || typeof zone.name !== 'string') return [];
    return [{
      id: typeof zone.id === 'string' && zone.id ? zone.id : `zone-${startU}-${endU}`,
      name: zone.name,
      startU,
      endU,
      kind: zone.kind === 'blocked' ? 'blocked' : 'reserved',
    }];
  });

  return {
    ...rack,
    name: typeof rack.name === 'string' && rack.name.trim() ? rack.name : 'Untitled Rack',
    heightU,
    widthMm,
    depthMm,
    form: forms.find((form) => form === rack.form) ?? 'enclosed',
    perforatedDoors: rack.perforatedDoors === true,
    sidePanels: rack.sidePanels !== false,
    staticRatingKg,
    rollingRatingKg,
    voltage: (voltages.find((voltage) => voltage === numberOr(rack.voltage, 230)) ?? 230) as RackConfig['voltage'],
    phases: rack.phases === 3 ? 3 : 1,
    circuitAAmps: Math.max(0, numberOr(rack.circuitAAmps, 20)),
    circuitBAmps: Math.max(0, numberOr(rack.circuitBAmps, 20)),
    redundancy: redundancies.find((value) => value === rack.redundancy) ?? 'N+1',
    ambientC: Math.max(-50, Math.min(80, numberOr(rack.ambientC, 22))),
    coolingKw: Math.max(0.0001, numberOr(rack.coolingKw, 8)),
    fanProfile: fanProfiles.find((value) => value === rack.fanProfile) ?? 'balanced',
    electricityRate: Math.max(0, numberOr(rack.electricityRate, 0.18)),
    zones,
  };
}

function isValidDevice(rack: RackConfig, catalog: HardwareTemplate[], device: PlacedDevice): boolean {
  const hardware = getHardwareInList(catalog, device.hardwareId);
  if (!hardware) return false;
  const uHeight = numberOr(hardware.uHeight, -1);
  const startU = numberOr(device.startU, -1);
  if (!device.instanceId || !Number.isInteger(uHeight) || uHeight < 0 || !Number.isInteger(startU)) return false;
  if (!isMountType(device.mount) || !isSide(device.side)) return false;
  if (device.status !== 'active' && device.status !== 'reserved') return false;
  if (device.pdu !== 'A' && device.pdu !== 'B') return false;
  if (hardware.airflow !== 'front-to-back' && hardware.airflow !== 'back-to-front' && hardware.airflow !== 'side-to-side' && hardware.airflow !== 'passive') return false;
  if (device.mount === 'vertical') return uHeight === 0 && startU === 0;
  if (uHeight < 1 || startU < 0 || startU + uHeight > numberOr(rack.heightU, 0)) return false;
  return true;
}

export function simulateRack(
  rack: RackConfig,
  devices: PlacedDevice[],
  catalog: HardwareTemplate[],
): SimulationResult {
  const warnings: SimulationWarning[] = [];
  rack = normalizeRackForSimulation(rack);
  const allKnownDevices = devices.filter((device) => getHardwareInList(catalog, device.hardwareId));
  const knownDevices = allKnownDevices.filter((device) => isValidDevice(rack, catalog, device));
  for (const device of devices) {
    const hardware = getHardwareInList(catalog, device.hardwareId);
    const isKnown = Boolean(hardware);
    if (isKnown && !isValidDevice(rack, catalog, device)) {
      warnings.push({
        id: `invalid-placement-${device.instanceId}`,
        title: `${hardware?.name ?? device.hardwareId} has an invalid placement`,
        detail: 'Check U range, mounting plane, vertical rail, and provisioning fields. This device is excluded from simulation totals.',
        severity: 'critical',
        deviceId: typeof device.instanceId === 'string' ? device.instanceId : undefined,
      });
    } else if (!isKnown) {
      warnings.push({
        id: `unknown-hardware-${String(device.instanceId)}`,
        title: 'Unknown hardware profile',
        detail: `No hardware profile was found for ${device.hardwareId}. This device is excluded from simulation totals.`,
        severity: 'critical',
      });
    }
  }
  const activeDevices = knownDevices.filter((device) => device.status === 'active');
  const occupied = new Set<number>();
  for (const device of knownDevices) {
    const hardware = getHardwareInList(catalog, device.hardwareId)!;
    if (device.mount === 'vertical') continue;
    const startU = numberOr(device.startU, 0);
    const endU = startU + numberOr(hardware.uHeight, 0);
    for (let u = Math.max(0, startU); u < Math.min(numberOr(rack.heightU, 0), endU); u++) occupied.add(u);
  }

  let typicalW = 0;
  let peakW = 0;
  let ratedW = 0;
  let totalWeightKg = 0;
  let cgMomentKgMm = 0;
  let verticalWeightKg = 0;
  let estimatedAirflowCfm = 0;

  const telemetry: DeviceTelemetry[] = knownDevices.map((device) => {
    const hardware = getHardwareInList(catalog, device.hardwareId)!;
    const active = device.status === 'active';
    const effectiveTypical = active ? Math.max(0, numberOr(device.overrides?.typicalW, numberOr(hardware.typicalW, 0))) : 0;
    const effectivePeak = active ? Math.max(0, numberOr(device.overrides?.peakW, numberOr(hardware.peakW, 0))) : 0;
    const effectiveWeight = Math.max(0, numberOr(device.overrides?.weightKg, numberOr(hardware.weightKg, 0)));
    const heatW = effectiveTypical;
    const amps = effectiveTypical / rack.voltage / (rack.phases === 3 ? 3 : 1);
    const deviceCenterMm = device.mount === 'vertical'
      ? U_HEIGHT_MM * 0.4
      : (device.startU + hardware.uHeight / 2) * U_HEIGHT_MM;
    totalWeightKg += effectiveWeight;
    cgMomentKgMm += effectiveWeight * deviceCenterMm;
    if (device.mount === 'vertical') verticalWeightKg += effectiveWeight;
    typicalW += effectiveTypical;
    peakW += effectivePeak;
    if (active && hardware.category !== 'power') ratedW += Math.max(0, numberOr(hardware.ratedW, 0));
    if (active && effectiveTypical > 0) {
      estimatedAirflowCfm += effectiveTypical * 0.92 + (hardware.category === 'thermal' ? 160 : 18);
    }
    return {
      instanceId: device.instanceId,
      pdu: device.pdu,
      typicalW: effectiveTypical,
      peakW: effectivePeak,
      heatW,
      weightKg: effectiveWeight,
      ampsA: device.pdu === 'A' ? amps : 0,
      ampsB: device.pdu === 'B' ? amps : 0,
      localTempC: rack.ambientC,
      severity: 'ok',
    };
  });

  const availableCoolingKw = rack.coolingKw * (FAN_PROFILE_FACTOR[rack.fanProfile] ?? 1);
  const heatKw = typicalW / 1000;
  const thermalLoadPct = availableCoolingKw > 0 ? (heatKw / availableCoolingKw) * 100 : typicalW > 0 ? 999 : 0;
  const averageExhaustC = rack.ambientC + 6 + Math.min(25, heatKw * 2.25) + Math.max(0, thermalLoadPct - 85) * 0.045;

  const telemetryById = new Map(telemetry.map((item) => [item.instanceId, item]));
  let maxDeviceTempC = rack.ambientC;
  const hotspots: { device: PlacedDevice; hardware: HardwareTemplate; tempC: number; severity: Severity }[] = [];

  for (const device of activeDevices) {
    const hardware = getHardwareInList(catalog, device.hardwareId)!;
    const item = telemetryById.get(device.instanceId)!;
    let localHeatW = item.typicalW * 0.5;
    const centerU = device.startU + hardware.uHeight / 2;
    for (const neighbor of activeDevices) {
      if (neighbor.instanceId === device.instanceId) continue;
      const neighborHardware = getHardwareInList(catalog, neighbor.hardwareId)!;
      const neighborCenter = neighbor.startU + neighborHardware.uHeight / 2;
      const distance = Math.abs(centerU - neighborCenter);
      if (distance <= 4) localHeatW += (telemetryById.get(neighbor.instanceId)?.typicalW ?? 0) * (1 - distance / 5);
    }
    const localDensityKwPerU = hardware.uHeight > 0 ? localHeatW / (Math.max(hardware.uHeight, 1) * 2.5) / 1000 : 0;
    const localTempC = averageExhaustC + Math.min(8, Math.max(0, localDensityKwPerU - 0.25) * 6);
    item.localTempC = Math.round(localTempC * 10) / 10;
    item.severity = severityOf(localTempC, 36, 42);
    maxDeviceTempC = Math.max(maxDeviceTempC, localTempC);

    if (hardware.airflow === 'back-to-front') {
      warnings.push({
        id: `airflow-reverse-${device.instanceId}`,
        title: `${hardware.name} has reverse airflow`,
        detail: 'Back-to-front exhaust can mix with the cold aisle. Orient the rack or use a compatible device.',
        severity: 'warning', deviceId: device.instanceId, startU: device.startU + 1,
      });
    } else if (hardware.airflow === 'side-to-side') {
      warnings.push({
        id: `airflow-side-${device.instanceId}`,
        title: `${hardware.name} uses side-to-side airflow`,
        detail: 'Provide a clear side intake path and avoid dense neighboring equipment.',
        severity: 'warning', deviceId: device.instanceId, startU: device.startU + 1,
      });
    }
    if (item.severity !== 'ok') {
      hotspots.push({ device, hardware, tempC: item.localTempC, severity: item.severity });
    }
    if (numberOr(hardware.depthMm, 0) > numberOr(rack.depthMm, 0) - 120) {
      warnings.push({
        id: `depth-${device.instanceId}`,
        title: `${hardware.name} has limited cable clearance`,
        detail: `${Math.max(0, numberOr(rack.depthMm, 0) - numberOr(hardware.depthMm, 0))}mm remains behind the chassis; verify doors and bend radius.`,
        severity: 'warning', deviceId: device.instanceId,
      });
    }
  }

  hotspots.sort((a, b) => b.tempC - a.tempC);
  for (const hotspot of hotspots.slice(0, 3)) {
    warnings.push({
      id: `hotspot-${hotspot.device.instanceId}`,
      title: `${hotspot.hardware.name} thermal hotspot`,
      detail: `Estimated local temperature is ${hotspot.tempC.toFixed(1)}°C. Add blanking panels, improve cooling, or redistribute heat.`,
      severity: hotspot.severity,
      deviceId: hotspot.device.instanceId,
      startU: hotspot.device.startU + 1,
    });
  }
  if (hotspots.length > 3) {
    warnings.push({
      id: 'hotspot-summary',
      title: `${hotspots.length - 3} additional warm locations`,
      detail: `The hottest reported location is ${hotspots[0].tempC.toFixed(1)}°C. Review the thermal overlay for the full vertical heat distribution.`,
      severity: hotspots.slice(3).some((hotspot) => hotspot.severity === 'critical') ? 'critical' : 'warning',
    });
  }

  const pduA = pduMetrics('A', rack, telemetry);
  const pduB = pduMetrics('B', rack, telemetry);
  for (const pdu of [pduA, pduB]) {
    if (pdu.severity !== 'ok') {
      warnings.push({
        id: `breaker-${pdu.feed}`,
        title: `PDU ${pdu.feed} exceeds ${pdu.severity === 'critical' ? 'breaker capacity' : '80% continuous-load guidance'}`,
        detail: `${pdu.typicalW.toFixed(0)}W typical / ${pdu.peakW.toFixed(0)}W peak on a ${pdu.breakerAmps}A ${rack.phases === 3 ? 'three-phase ' : ''}feed (${pdu.amps.toFixed(1)}A typical per phase).`,
        severity: pdu.severity,
      });
    }
  }

  if (thermalLoadPct >= 100) {
    warnings.push({
      id: 'cooling-critical', title: 'Cooling capacity exceeded',
      detail: `${heatKw.toFixed(2)}kW heat load against ${availableCoolingKw.toFixed(2)}kW effective cooling (${thermalLoadPct.toFixed(0)}%).`,
      severity: 'critical',
    });
  } else if (thermalLoadPct >= 80) {
    warnings.push({
      id: 'cooling-warning', title: 'Limited cooling headroom',
      detail: `${thermalLoadPct.toFixed(0)}% of effective cooling is allocated. Consider Max Cooling or load redistribution.`,
      severity: 'warning',
    });
  }

  const gaps = findUnblankedGaps(rack, knownDevices, catalog);
  for (const gap of gaps) {
    warnings.push({
      id: `gap-${gap.startU}`,
      title: `${gap.size}U unblanked recirculation gap`,
      detail: `U${gap.startU + 1}–U${gap.endU} is open between powered devices. Add blanking panels to reduce exhaust recirculation.`,
      severity: 'warning', startU: gap.startU + 1,
    });
  }

  if (totalWeightKg > rack.staticRatingKg) {
    warnings.push({
      id: 'weight-static', title: 'Static load rating exceeded',
      detail: `${totalWeightKg.toFixed(1)}kg installed exceeds the ${rack.staticRatingKg}kg static rating.`,
      severity: 'critical',
    });
  } else if (totalWeightKg > rack.staticRatingKg * 0.85) {
    warnings.push({
      id: 'weight-static-warning', title: 'Static load rating nearing capacity',
      detail: `${totalWeightKg.toFixed(1)}kg installed; ${(rack.staticRatingKg - totalWeightKg).toFixed(1)}kg static headroom remains.`,
      severity: 'warning',
    });
  }
  if (totalWeightKg > rack.rollingRatingKg) {
    warnings.push({
      id: 'weight-rolling', title: 'Rolling load rating exceeded',
      detail: `${totalWeightKg.toFixed(1)}kg installed exceeds the ${rack.rollingRatingKg}kg rolling rating. Remove equipment before moving.`,
      severity: 'critical',
    });
  }

  const rackHeightMm = rack.heightU * U_HEIGHT_MM;
  const centerOfGravityMm = totalWeightKg > 0 ? cgMomentKgMm / totalWeightKg : 0;
  const centerOfGravityPct = rackHeightMm ? (centerOfGravityMm / rackHeightMm) * 100 : 0;
  const highHeavy = knownDevices.find((device) => {
    const hardware = getHardwareInList(catalog, device.hardwareId)!;
    return (device.overrides?.weightKg ?? hardware.weightKg) >= 25 && device.mount !== 'vertical' && device.startU / rack.heightU > 0.65;
  });
  if (centerOfGravityPct > 68) {
    warnings.push({
      id: 'cog-high', title: 'High center of gravity',
      detail: `Weight is concentrated at ${centerOfGravityPct.toFixed(0)}% of rack height.${highHeavy ? ` Move ${getHardwareInList(catalog, highHeavy.hardwareId)?.name} lower.` : ' Mount heavy UPS and storage units low.'}`,
      severity: centerOfGravityPct > 78 ? 'critical' : 'warning',
    });
  } else if (highHeavy) {
    warnings.push({
      id: 'heavy-mounted-high', title: 'Heavy equipment mounted high',
      detail: `${getHardwareInList(catalog, highHeavy.hardwareId)?.name} is installed in the upper rack. Move UPS and storage units lower to improve stability.`,
      severity: 'warning', deviceId: highHeavy.instanceId,
    });
  }

  const utilizationPct = (occupied.size / rack.heightU) * 100;
  if (utilizationPct > 92) {
    warnings.push({
      id: 'u-capacity', title: 'Rack U-space is nearly full',
      detail: `${occupied.size}/${rack.heightU}U occupied. Preserve cable and airflow clearance.`,
      severity: utilizationPct >= 100 ? 'critical' : 'warning',
    });
  }

  let redundancyNote = 'Independent PDU feeds; no automatic failover is assumed.';
  const smallerFeedCapacity = Math.min(pduA.capacityW, pduB.capacityW);
  if (rack.redundancy === 'N+1') {
    redundancyNote = 'Failover check: the surviving feed must carry peak rack load after one PDU or circuit fails.';
    if (peakW > smallerFeedCapacity) {
      warnings.push({
        id: 'redundancy-failover', title: 'N+1 failover capacity is insufficient',
        detail: `${peakW.toFixed(0)}W rack peak exceeds the ${smallerFeedCapacity.toFixed(0)}W surviving-feed capacity.`,
        severity: 'critical',
      });
    }
  } else if (rack.redundancy === '2N') {
    redundancyNote = '2N modeled as two full-capacity independent power paths; verify dual-cord devices are split A/B.';
    if (pduA.capacityW < peakW || pduB.capacityW < peakW) {
      warnings.push({
        id: 'redundancy-2n', title: 'A 2N power path cannot carry rack peak',
        detail: `Each independent path should be rated for at least ${peakW.toFixed(0)}W peak.`,
        severity: 'warning',
      });
    }
  }

  const openGapU = gaps.reduce((sum, gap) => sum + gap.size, 0);
  const reverseAirflowCount = activeDevices.filter((device) => getHardwareInList(catalog, device.hardwareId)?.airflow === 'back-to-front').length;
  const sideAirflowCount = activeDevices.filter((device) => getHardwareInList(catalog, device.hardwareId)?.airflow === 'side-to-side').length;
  const clampPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
  const recirculationRiskPct = clampPercent(openGapU * 7 + reverseAirflowCount * 14 + Math.max(0, thermalLoadPct - 80) * 0.35);
  const bypassRiskPct = clampPercent(((rack.heightU - occupied.size) / rack.heightU) * 45 + openGapU * 3);
  const airflowEfficiencyPct = clampPercent(100 - recirculationRiskPct * 0.65 - bypassRiskPct * 0.35 - sideAirflowCount * 4);

  const severity = worstSeverity(warnings.map((warning) => warning.severity));
  return {
    activeDevices,
    telemetry,
    typicalW,
    peakW,
    ratedW,
    heatW: typicalW,
    heatBtuHr: typicalW * BTU_PER_WATT,
    heatKw,
    monthlyKwh: (typicalW / 1000) * 730,
    annualKwh: (typicalW / 1000) * 8760,
    monthlyCost: (typicalW / 1000) * 730 * rack.electricityRate,
    annualCost: (typicalW / 1000) * 8760 * rack.electricityRate,
    totalWeightKg,
    occupiedU: occupied.size,
    utilizationPct,
    centerOfGravityMm,
    centerOfGravityPct,
    pduA,
    pduB,
    estimatedAirflowCfm,
    airflowEfficiencyPct,
    recirculationRiskPct,
    bypassRiskPct,
    recirculationGaps: gaps,
    availableCoolingKw,
    thermalLoadPct,
    averageExhaustC,
    maxDeviceTempC,
    warnings,
    severity,
    redundancyNote,
    verticalWeightKg,
  };
}
