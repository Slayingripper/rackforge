import type { AirflowField } from './field';

export interface StreamlineSet {
  /** lineSegments positions */
  positions: Float32Array;
  /** lineSegments colors (rgb 0..1) */
  colors: Float32Array;
  segmentCount: number;
}

export interface StreamlinePolyline {
  /** [x,y,z, ...] scene-space points */
  points: Float32Array;
  /** temperature at each point */
  temps: Float32Array;
  /** cumulative arc length at each point */
  cumulative: Float32Array;
  /** total arc length (scene units) */
  length: number;
}

const clampNum = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

function tempColor(tempC: number, ambientC: number, out: [number, number, number]): void {
  const t = clampNum((tempC - ambientC + 1) / 14, 0, 1);
  out[0] = 0x6f / 255 + (0xd4 - 0x6f) / 255 * t;
  out[1] = 0x9f / 255 + (0x7a - 0x9f) / 255 * t;
  out[2] = 0xca / 255 + (0x4f - 0xca) / 255 * t;
}

function vel(field: AirflowField, x: number, y: number, z: number, out: [number, number, number]): void {
  const s = field.sampleSceneVelocity(x, y, z);
  out[0] = s.vx; out[1] = s.vy; out[2] = s.vz;
}

/**
 * Integrate streamlines through the solved scene-space velocity field (RK2).
 * Returns polylines with arc-length tables for particle animation.
 */
export function computeStreamlines(
  field: AirflowField,
  seeds: Array<[number, number, number]>,
  steps = 220,
  dt = 0.02,
): StreamlinePolyline[] {
  const spm = field.scenePerMeter;
  const min: [number, number, number] = [field.grid.boundsMin[0] * spm, field.grid.boundsMin[1] * spm, field.grid.boundsMin[2] * spm];
  const max: [number, number, number] = [field.grid.boundsMax[0] * spm, field.grid.boundsMax[1] * spm, field.grid.boundsMax[2] * spm];
  const v1: [number, number, number] = [0, 0, 0];
  const v2: [number, number, number] = [0, 0, 0];
  const lines: StreamlinePolyline[] = [];

  for (const seed of seeds) {
    const pts: number[] = [];
    const temps: number[] = [];
    let travelled = 0;
    let x = clampNum(seed[0], min[0] + 1e-3, max[0] - 1e-3);
    let y = clampNum(seed[1], min[1] + 1e-3, max[1] - 1e-3);
    let z = clampNum(seed[2], min[2] + 1e-3, max[2] - 1e-3);
    pts.push(x, y, z);
    temps.push(field.sampleScene(x, y, z).tempC);
    for (let s = 0; s < steps; s++) {
      vel(field, x, y, z, v1);
      const speed = Math.hypot(v1[0], v1[1], v1[2]);
      if (!Number.isFinite(speed) || speed < 2e-4) break;
      const mx = x + v1[0] * dt * 0.5;
      const my = y + v1[1] * dt * 0.5;
      const mz = z + v1[2] * dt * 0.5;
      vel(field, mx, my, mz, v2);
      const nx = x + v2[0] * dt;
      const ny = y + v2[1] * dt;
      const nz = z + v2[2] * dt;
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) break;
      if (nx < min[0] || nx > max[0] || ny < min[1] || ny > max[1] || nz < min[2] || nz > max[2]) break;
      travelled += Math.hypot(nx - x, ny - y, nz - z);
      x = nx; y = ny; z = nz;
      pts.push(x, y, z);
      temps.push(field.sampleScene(x, y, z).tempC);
      if (travelled > 13) break;
    }
    if (pts.length < 9) continue; // need at least 3 points
    const points = new Float32Array(pts);
    const pointTemps = new Float32Array(temps);
    const cumulative = new Float32Array(points.length / 3);
    let length = 0;
    for (let i = 1; i < cumulative.length; i++) {
      const dx = points[i * 3] - points[(i - 1) * 3];
      const dy = points[i * 3 + 1] - points[(i - 1) * 3 + 1];
      const dz = points[i * 3 + 2] - points[(i - 1) * 3 + 2];
      length += Math.hypot(dx, dy, dz);
      cumulative[i] = length;
    }
    if (length > 0.25) lines.push({ points, temps: pointTemps, cumulative, length });
  }
  return lines;
}

/** lineSegments geometry data from polylines */
export function streamlinesToSegments(lines: StreamlinePolyline[], ambientC: number): StreamlineSet {
  const pos: number[] = [];
  const col: number[] = [];
  const cA: [number, number, number] = [0, 0, 0];
  const cB: [number, number, number] = [0, 0, 0];
  for (const line of lines) {
    for (let i = 1; i < line.cumulative.length; i++) {
      const a = (i - 1) * 3;
      const b = i * 3;
      pos.push(line.points[a], line.points[a + 1], line.points[a + 2], line.points[b], line.points[b + 1], line.points[b + 2]);
      tempColor(line.temps[i - 1], ambientC, cA);
      tempColor(line.temps[i], ambientC, cB);
      col.push(cA[0], cA[1], cA[2], cB[0], cB[1], cB[2]);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), segmentCount: pos.length / 6 };
}

/** build broad inlet + device seeds in scene space */
export function buildStreamlineSeeds(field: AirflowField, deviceIntakes: Array<[number, number, number]>): Array<[number, number, number]> {
  const spm = field.scenePerMeter;
  const minX = field.grid.boundsMin[0] * spm; const maxX = field.grid.boundsMax[0] * spm;
  const minY = field.grid.boundsMin[1] * spm; const maxY = field.grid.boundsMax[1] * spm;
  const maxZ = field.grid.boundsMax[2] * spm;
  const seeds: Array<[number, number, number]> = [];
  // focus seeds on the rack opening + cold aisle, not stagnant side/ceiling margins
  const cx = (minX + maxX) / 2;
  const halfOpen = (maxX - minX) * 0.30; // central 60% ≈ rack opening
  const maxDeviceY = deviceIntakes.length ? Math.max(...deviceIntakes.map((p) => p[1])) : maxY;
  const seedTopY = Math.min(maxY - 0.05, maxDeviceY + (maxY - minY) * 0.10);
  const seedBottomY = Math.max(minY + 0.02, minY);
  const X = 5; const Y = 6;
  // front cold-aisle inlet plane (rack width, device-height band)
  for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
    seeds.push([cx - halfOpen + (2 * halfOpen) * (i + 0.5) / X, seedBottomY + (seedTopY - seedBottomY) * (j + 0.5) / Y, maxZ - 0.02]);
  }
  // one seed per device intake so each unit's path is represented
  for (const p of deviceIntakes) seeds.push([p[0], p[1], p[2]]);
  return seeds;
}
