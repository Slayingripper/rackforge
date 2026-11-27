import type { Severity, SimulationResult } from '../../types';
import type { AirflowField } from './field';

function worstSeverity(severities: Severity[]): Severity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('warning')) return 'warning';
  return 'ok';
}

/**
 * Merge CFD-derived airflow results into a SimulationResult, replacing the
 * heuristic airflow estimates with physics-derived values. Power, energy and
 * structural fields are untouched.
 */
export function applyAirflowField(result: SimulationResult, field: AirflowField | null | undefined): SimulationResult {
  if (!field) return result;
  const r = field.report;
  const byId = new Map(r.perDevice.map((d) => [d.instanceId, d]));

  const telemetry = result.telemetry.map((item) => {
    const d = byId.get(item.instanceId);
    if (!d) return item;
    return { ...item, localTempC: d.localTempC, severity: d.severity };
  });

  const maxDeviceTempC = r.perDevice.length
    ? Math.max(...r.perDevice.map((d) => d.localTempC), result.telemetry.length ? result.maxDeviceTempC : 0, r.maxTempC)
    : result.maxDeviceTempC;

  return {
    ...result,
    telemetry,
    averageExhaustC: r.averageExhaustC,
    maxDeviceTempC: Math.round(maxDeviceTempC * 10) / 10,
    estimatedAirflowCfm: r.estimatedAirflowCfm > 0 ? r.estimatedAirflowCfm : result.estimatedAirflowCfm,
    airflowEfficiencyPct: r.airflowEfficiencyPct,
    recirculationRiskPct: r.recirculationRiskPct,
    bypassRiskPct: r.bypassRiskPct,
    severity: worstSeverity([result.severity, r.perDevice.some((d) => d.severity === 'critical') ? 'critical' : r.perDevice.some((d) => d.severity === 'warning') ? 'warning' : 'ok']),
    airflowReport: r,
  };
}
