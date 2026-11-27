import type { AirflowField } from './field';

export interface StreamlineSet {
  /** lineSegments positions */
  positions: Float32Array;
  /** lineSegments colors (rgb 0..1) */
  colors: Float32Array;
  segmentCount: number;
}

const clampNum = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

// cold -> hot gradient endpoints (sRGB)
function tempColor(tempC: number, ambientC: number, out: [number, number, number]): void {
  const t = clampNum((tempC - ambientC + 1) / 14, 0, 1);
  // cold #6f9fca -> hot #d47a4f
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
 * Returns lineSegments positions + per-vertex temperature colors.
 */
export function computeStreamlineSegments(
  field: AirflowField,
  seeds: Array<[number, number, number]>,
  steps = 90,
  dt = 0.02,
): StreamlineSet {
  const spm = field.scenePerMeter;
  const min: [number, number, number] = [field.grid.boundsMin[0] * spm, field.grid.boundsMin[1] * spm, field.grid.boundsMin[2] * spm];
  const max: [number, number, number] = [field.grid.boundsMax[0] * spm, field.grid.boundsMax[1] * spm, field.grid.boundsMax[2] * spm];
  const ambientC = field.report.averageIntakeC;

  const pos: number[] = [];
  const col: number[] = [];
  const v1: [number, number, number] = [0, 0, 0];
  const v2: [number, number, number] = [0, 0, 0];
  const cA: [number, number, number] = [0, 0, 0];
  const cB: [number, number, number] = [0, 0, 0];

  for (const seed of seeds) {
    let x = seed[0]; let y = seed[1]; let z = seed[2];
    // ensure seed inside
    x = clampNum(x, min[0] + 1e-3, max[0] - 1e-3);
    y = clampNum(y, min[1] + 1e-3, max[1] - 1e-3);
    z = clampNum(z, min[2] + 1e-3, max[2] - 1e-3);
    for (let s = 0; s < steps; s++) {
      vel(field, x, y, z, v1);
      const speed = Math.hypot(v1[0], v1[1], v1[2]);
      if (!Number.isFinite(speed) || speed < 1e-4) break;
      const mx = x + v1[0] * dt * 0.5;
      const my = y + v1[1] * dt * 0.5;
      const mz = z + v1[2] * dt * 0.5;
      vel(field, mx, my, mz, v2);
      const nx = x + v2[0] * dt;
      const ny = y + v2[1] * dt;
      const nz = z + v2[2] * dt;
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) break;
      if (nx < min[0] || nx > max[0] || ny < min[1] || ny > max[1] || nz < min[2] || nz > max[2]) break;
      const ta = field.sampleScene(x, y, z).tempC;
      const tb = field.sampleScene(nx, ny, nz).tempC;
      tempColor(ta, ambientC, cA); tempColor(tb, ambientC, cB);
      pos.push(x, y, z, nx, ny, nz);
      col.push(cA[0], cA[1], cA[2], cB[0], cB[1], cB[2]);
      x = nx; y = ny; z = nz;
    }
  }

  return { positions: new Float32Array(pos), colors: new Float32Array(col), segmentCount: pos.length / 6 };
}

/** build inlet + device seeds in scene space */
export function buildStreamlineSeeds(field: AirflowField, deviceIntakes: Array<[number, number, number]>): Array<[number, number, number]> {
  const spm = field.scenePerMeter;
  const minX = field.grid.boundsMin[0] * spm; const maxX = field.grid.boundsMax[0] * spm;
  const minY = field.grid.boundsMin[1] * spm; const maxY = field.grid.boundsMax[1] * spm;
  const minZ = field.grid.boundsMin[2] * spm; const maxZ = field.grid.boundsMax[2] * spm;
  const seeds: Array<[number, number, number]> = [];
  const X = 4; const Y = 6;
  // front cold-aisle inlet plane
  for (let j = 0; j < Y; j++) for (let i = 0; i < X; i++) {
    seeds.push([minX + (maxX - minX) * (i + 0.5) / X, minY + (maxY - minY) * (j + 0.5) / Y, maxZ - 0.02]);
  }
  // floor supply
  for (let k = 0; k < X; k++) for (let i = 0; i < X; i++) {
    seeds.push([minX + (maxX - minX) * (i + 0.5) / X, minY + 0.02, minZ + (maxZ - minZ) * (k + 0.5) / X]);
  }
  // device intakes (scene)
  for (const p of deviceIntakes) seeds.push([p[0], p[1], p[2]]);
  return seeds;
}
