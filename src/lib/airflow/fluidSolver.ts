import type { AirflowGrid, AirflowSample } from './types';

export const AIR_DENSITY_KGM3 = 1.204; // kg/m³ at ~20°C, 1 atm
export const AIR_CP_JKGK = 1005; // J/(kg·K)
export const AIR_KINEMATIC_VISCOSITY = 1.5e-5; // m²/s
export const AIR_THERMAL_DIFFUSIVITY = 2.2e-5; // m²/s
export const THERMAL_EXPANSION_K = 1 / 293.15; // 1/K (ideal gas β at ~20°C)
export const GRAVITY = 9.81; // m/s²

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
const safe = (v: number, fallback = 0): number => (Number.isFinite(v) ? v : fallback);

export interface BoundaryConditions {
  /** cold-aisle inflow speed at the inlet boundary (m/s) */
  inletSpeedMps: number;
  /** inlet air temperature (°C) */
  inletTempC: number;
  /** which domain face is the cold inlet */
  inletFace: 'front' | 'rear' | 'bottom';
  /** outlet faces */
  outletFaces: Array<'front' | 'rear' | 'top' | 'bottom'>;
  /** side walls solid (true) or open (false) */
  solidSideWalls: boolean;
  /** top wall solid */
  solidTop: boolean;
  /** bottom wall solid */
  solidBottom: boolean;
}

/**
 * Stable-fluids incompressible Navier–Stokes solver with advected temperature,
 * Boussinesq buoyancy, diffusion, obstacle masking and explicit boundary
 * conditions. Grid-based, deterministic, finite; NOT a certified CFD tool.
 *
 * Units: metres, seconds, kelvin offset in Celsius, kg, J.
 */
export class FluidSolver {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly n: number;
  readonly spacing: number;
  readonly origin: [number, number, number];

  u: Float32Array;
  v: Float32Array;
  w: Float32Array;
  private u0: Float32Array;
  private v0: Float32Array;
  private w0: Float32Array;
  temp: Float32Array;
  private temp0: Float32Array;
  private p: Float32Array;
  private div: Float32Array;
  /** solid cells (no flow, no heat diffusion inside) */
  blocked: Uint8Array;
  /** volumetric heat source per cell (W) accumulated for the current step */
  private heatSourceW: Float32Array;
  /** velocity source per cell (m/s) accumulated for current step */
  private srcU: Float32Array;
  private srcV: Float32Array;
  private srcW: Float32Array;

  private bc: BoundaryConditions;
  private readonly maxSpeed = 60; // m/s safety clamp
  private readonly maxTempC = 1000;

  constructor(grid: Omit<AirflowGrid, 'scenePerMeter' | 'boundsMin' | 'boundsMax'>, bc: BoundaryConditions, ambientC = 22) {
    this.nx = Math.max(2, grid.nx | 0);
    this.ny = Math.max(2, grid.ny | 0);
    this.nz = Math.max(2, grid.nz | 0);
    this.n = this.nx * this.ny * this.nz;
    this.spacing = Math.max(1e-4, grid.spacing);
    this.origin = [...grid.origin];
    this.bc = bc;
    const n = this.n;
    this.u = new Float32Array(n);
    this.v = new Float32Array(n);
    this.w = new Float32Array(n);
    this.u0 = new Float32Array(n);
    this.v0 = new Float32Array(n);
    this.w0 = new Float32Array(n);
    this.temp = new Float32Array(n).fill(ambientC);
    this.temp0 = new Float32Array(n);
    this.p = new Float32Array(n);
    this.div = new Float32Array(n);
    this.blocked = new Uint8Array(n);
    this.heatSourceW = new Float32Array(n);
    this.srcU = new Float32Array(n);
    this.srcV = new Float32Array(n);
    this.srcW = new Float32Array(n);
  }

  index(i: number, j: number, k: number): number {
    return i + this.nx * (j + this.ny * k);
  }

  setBoundaryConditions(bc: BoundaryConditions): void {
    this.bc = bc;
  }

  /** world-metre position of cell centre */
  cellCenter(i: number, j: number, k: number): [number, number, number] {
    return [
      this.origin[0] + i * this.spacing,
      this.origin[1] + j * this.spacing,
      this.origin[2] + k * this.spacing,
    ];
  }

  /** convert world-metre point to (clamped) cell coordinates (continuous) */
  toCell(x: number, y: number, z: number): [number, number, number] {
    return [
      clamp((x - this.origin[0]) / this.spacing, 0, this.nx - 1),
      clamp((y - this.origin[1]) / this.spacing, 0, this.ny - 1),
      clamp((z - this.origin[2]) / this.spacing, 0, this.nz - 1),
    ];
  }

  markBlocked(i: number, j: number, k: number): void {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    this.blocked[this.index(i, j, k)] = 1;
  }

  addHeatW(i: number, j: number, k: number, watts: number): void {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    if (!Number.isFinite(watts)) return;
    this.heatSourceW[this.index(i, j, k)] += watts;
  }

  addVelocitySource(i: number, j: number, k: number, du: number, dv: number, dw: number): void {
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return;
    const idx = this.index(i, j, k);
    if (this.blocked[idx]) return;
    this.srcU[idx] += safe(du);
    this.srcV[idx] += safe(dv);
    this.srcW[idx] += safe(dw);
  }

  /** trilinear sample of the solved field at a world-metre point */
  sample(x: number, y: number, z: number): AirflowSample {
    const [cx, cy, cz] = this.toCell(x, y, z);
    const i0 = Math.floor(cx);
    const j0 = Math.floor(cy);
    const k0 = Math.floor(cz);
    const i1 = Math.min(this.nx - 1, i0 + 1);
    const j1 = Math.min(this.ny - 1, j0 + 1);
    const k1 = Math.min(this.nz - 1, k0 + 1);
    const fx = cx - i0;
    const fy = cy - j0;
    const fz = cz - k0;

    const tri = (arr: Float32Array): number => {
      const c000 = arr[this.index(i0, j0, k0)];
      const c100 = arr[this.index(i1, j0, k0)];
      const c010 = arr[this.index(i0, j1, k0)];
      const c110 = arr[this.index(i1, j1, k0)];
      const c001 = arr[this.index(i0, j0, k1)];
      const c101 = arr[this.index(i1, j0, k1)];
      const c011 = arr[this.index(i0, j1, k1)];
      const c111 = arr[this.index(i1, j1, k1)];
      const c00 = c000 * (1 - fx) + c100 * fx;
      const c10 = c010 * (1 - fx) + c110 * fx;
      const c01 = c001 * (1 - fx) + c101 * fx;
      const c11 = c011 * (1 - fx) + c111 * fx;
      const c0 = c00 * (1 - fy) + c10 * fy;
      const c1 = c01 * (1 - fy) + c11 * fy;
      return c0 * (1 - fz) + c1 * fz;
    };

    const idx = this.index(
      Math.round(cx),
      Math.round(cy),
      Math.round(cz),
    );
    const vx = safe(tri(this.u));
    const vy = safe(tri(this.v));
    const vz = safe(tri(this.w));
    return {
      vx,
      vy,
      vz,
      speed: Math.hypot(vx, vy, vz),
      tempC: safe(tri(this.temp)),
      blocked: this.blocked[idx] === 1,
    };
  }

  // ---- stable fluids core -------------------------------------------------

  private setBnd(b: number, x: Float32Array): void {
    const { nx, ny, nz } = this;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        // x walls
        x[this.index(0, j, k)] = b === 1 ? -x[this.index(1, j, k)] : x[this.index(1, j, k)];
        x[this.index(nx - 1, j, k)] = b === 1 ? -x[this.index(nx - 2, j, k)] : x[this.index(nx - 2, j, k)];
      }
    }
    for (let k = 1; k < nz - 1; k++) {
      for (let i = 1; i < nx - 1; i++) {
        // y walls
        x[this.index(i, 0, k)] = b === 2 ? -x[this.index(i, 1, k)] : x[this.index(i, 1, k)];
        x[this.index(i, ny - 1, k)] = b === 2 ? -x[this.index(i, ny - 2, k)] : x[this.index(i, ny - 2, k)];
      }
    }
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        // z walls
        x[this.index(i, j, 0)] = b === 3 ? -x[this.index(i, j, 1)] : x[this.index(i, j, 1)];
        x[this.index(i, j, nz - 1)] = b === 3 ? -x[this.index(i, j, nz - 2)] : x[this.index(i, j, nz - 2)];
      }
    }
    // corners
    x[this.index(0, 0, 0)] = 0.5 * (x[this.index(1, 0, 0)] + x[this.index(0, 1, 0)]);
    x[this.index(0, ny - 1, 0)] = 0.5 * (x[this.index(1, ny - 1, 0)] + x[this.index(0, ny - 2, 0)]);
    x[this.index(0, 0, nz - 1)] = 0.5 * (x[this.index(1, 0, nz - 1)] + x[this.index(0, 1, nz - 1)]);
    x[this.index(0, ny - 1, nz - 1)] = 0.5 * (x[this.index(1, ny - 1, nz - 1)] + x[this.index(0, ny - 2, nz - 1)]);
    x[this.index(nx - 1, 0, 0)] = 0.5 * (x[this.index(nx - 2, 0, 0)] + x[this.index(nx - 1, 1, 0)]);
    x[this.index(nx - 1, ny - 1, 0)] = 0.5 * (x[this.index(nx - 2, ny - 1, 0)] + x[this.index(nx - 1, ny - 2, 0)]);
    x[this.index(nx - 1, 0, nz - 1)] = 0.5 * (x[this.index(nx - 2, 0, nz - 1)] + x[this.index(nx - 1, 1, nz - 1)]);
    x[this.index(nx - 1, ny - 1, nz - 1)] = 0.5 * (x[this.index(nx - 2, ny - 1, nz - 1)] + x[this.index(nx - 1, ny - 2, nz - 1)]);
    this.applyObstacles(x);
  }

  private applyObstacles(x: Float32Array): void {
    for (let idx = 0; idx < this.n; idx++) {
      if (this.blocked[idx]) x[idx] = 0;
    }
  }

  private diffuse(b: number, x: Float32Array, x0: Float32Array, diff: number, dt: number, iterations = 8): void {
    const a = dt * diff / (this.spacing * this.spacing);
    const cInv = 1 / (1 + 6 * a);
    for (let iter = 0; iter < iterations; iter++) {
      for (let k = 1; k < this.nz - 1; k++) {
        for (let j = 1; j < this.ny - 1; j++) {
          for (let i = 1; i < this.nx - 1; i++) {
            const idx = this.index(i, j, k);
            if (this.blocked[idx]) continue;
            x[idx] = cInv * (
              x0[idx]
              + a * (
                x[this.index(i + 1, j, k)] + x[this.index(i - 1, j, k)]
                + x[this.index(i, j + 1, k)] + x[this.index(i, j - 1, k)]
                + x[this.index(i, j, k + 1)] + x[this.index(i, j, k - 1)]
              )
            );
          }
        }
      }
      this.setBnd(b, x);
    }
  }

  private advect(b: number, d: Float32Array, d0: Float32Array, dt: number): void {
    const { nx, ny, nz, spacing } = this;
    const dtScaled = dt / spacing;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, k);
          if (this.blocked[idx]) continue;
          let x = i - dtScaled * this.u[idx];
          let y = j - dtScaled * this.v[idx];
          let z = k - dtScaled * this.w[idx];
          x = clamp(x, 0.5, nx - 1.5);
          y = clamp(y, 0.5, ny - 1.5);
          z = clamp(z, 0.5, nz - 1.5);
          const i0 = Math.floor(x);
          const j0 = Math.floor(y);
          const k0 = Math.floor(z);
          const i1 = i0 + 1;
          const j1 = j0 + 1;
          const k1 = k0 + 1;
          const s1 = x - i0;
          const s0 = 1 - s1;
          const t1 = y - j0;
          const t0 = 1 - t1;
          const r1 = z - k0;
          const r0 = 1 - r1;
          const sampleField = (ii: number, jj: number, kk: number): number => d0[this.index(ii, jj, kk)];
          d[idx] =
            s0 * (t0 * (r0 * sampleField(i0, j0, k0) + r1 * sampleField(i0, j0, k1)) +
                  t1 * (r0 * sampleField(i0, j1, k0) + r1 * sampleField(i0, j1, k1))) +
            s1 * (t0 * (r0 * sampleField(i1, j0, k0) + r1 * sampleField(i1, j0, k1)) +
                  t1 * (r0 * sampleField(i1, j1, k0) + r1 * sampleField(i1, j1, k1)));
        }
      }
    }
    this.setBnd(b, d);
  }

  private project(u: Float32Array, v: Float32Array, w: Float32Array, p: Float32Array, div: Float32Array, iterations = 40): void {
    const { nx, ny, nz, spacing } = this;
    const h = spacing;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, k);
          if (this.blocked[idx]) continue;
          div[idx] = -0.5 * h * (
            u[this.index(i + 1, j, k)] - u[this.index(i - 1, j, k)]
            + v[this.index(i, j + 1, k)] - v[this.index(i, j - 1, k)]
            + w[this.index(i, j, k + 1)] - w[this.index(i, j, k - 1)]
          );
          p[idx] = 0;
        }
      }
    }
    this.setBnd(0, div);
    this.setBnd(0, p);
    for (let iter = 0; iter < iterations; iter++) {
      for (let k = 1; k < nz - 1; k++) {
        for (let j = 1; j < ny - 1; j++) {
          for (let i = 1; i < nx - 1; i++) {
            const idx = this.index(i, j, k);
            if (this.blocked[idx]) continue;
            p[idx] = (
              div[idx]
              + p[this.index(i + 1, j, k)] + p[this.index(i - 1, j, k)]
              + p[this.index(i, j + 1, k)] + p[this.index(i, j - 1, k)]
              + p[this.index(i, j, k + 1)] + p[this.index(i, j, k - 1)]
            ) / 6;
          }
        }
      }
      this.setBnd(0, p);
    }
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, k);
          if (this.blocked[idx]) continue;
          u[idx] -= 0.5 * (p[this.index(i + 1, j, k)] - p[this.index(i - 1, j, k)]) / h;
          v[idx] -= 0.5 * (p[this.index(i, j + 1, k)] - p[this.index(i, j - 1, k)]) / h;
          w[idx] -= 0.5 * (p[this.index(i, j, k + 1)] - p[this.index(i, j, k - 1)]) / h;
        }
      }
    }
    this.setBnd(1, u);
    this.setBnd(2, v);
    this.setBnd(3, w);
  }

  // ---- boundary conditions -----------------------------------------------

  private applyBoundaryConditions(): void {
    const { nx, ny, nz } = this;
    const bc = this.bc;
    const front = nz - 1; // +z
    const rear = 0; // -z
    const top = ny - 1;
    const bottom = 0;
    const ambient = bc.inletTempC;

    const setFrontInlet = (i: number, j: number): void => {
      const idx = this.index(i, j, front);
      if (this.blocked[idx]) return;
      // inflow toward -z
      this.u[idx] = 0; this.v[idx] = 0; this.w[idx] = -bc.inletSpeedMps; this.temp[idx] = ambient;
    };
    const setRearInlet = (i: number, j: number): void => {
      const idx = this.index(i, j, rear);
      if (this.blocked[idx]) return;
      this.u[idx] = 0; this.v[idx] = 0; this.w[idx] = bc.inletSpeedMps; this.temp[idx] = ambient;
    };
    const setBottomInlet = (i: number, kk: number): void => {
      const idx = this.index(i, bottom, kk);
      if (this.blocked[idx]) return;
      this.u[idx] = 0; this.v[idx] = bc.inletSpeedMps * 0.5; this.w[idx] = 0; this.temp[idx] = ambient;
    };

    if (bc.inletFace === 'front' || bc.inletFace === 'rear') {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          if (bc.inletFace === 'front') setFrontInlet(i, j);
          else setRearInlet(i, j);
        }
      }
    } else if (bc.inletFace === 'bottom') {
      for (let kk = 1; kk < nz - 1; kk++) {
        for (let i = 1; i < nx - 1; i++) setBottomInlet(i, kk);
      }
    }

    const outlet = (face: 'front' | 'rear' | 'top' | 'bottom'): void => {
      if (face === 'rear') {
        for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, rear); const inside = this.index(i, j, rear + 1);
          if (this.blocked[idx]) continue;
          // outflow + zero-gradient temperature
          this.w[idx] = -Math.abs(this.w[inside]);
          this.u[idx] = this.u[inside]; this.v[idx] = this.v[inside]; this.temp[idx] = this.temp[inside];
        }
      } else if (face === 'front') {
        for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, front); const inside = this.index(i, j, front - 1);
          if (this.blocked[idx]) continue;
          this.w[idx] = Math.abs(this.w[inside]) + bc.inletSpeedMps * 0.25;
          this.u[idx] = this.u[inside]; this.v[idx] = this.v[inside]; this.temp[idx] = this.temp[inside];
        }
      } else if (face === 'top') {
        for (let kk = 1; kk < nz - 1; kk++) for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, top, kk); const inside = this.index(i, top - 1, kk);
          if (this.blocked[idx]) continue;
          this.v[idx] = Math.abs(this.v[inside]) + bc.inletSpeedMps * 0.15;
          this.u[idx] = this.u[inside]; this.w[idx] = this.w[inside]; this.temp[idx] = this.temp[inside];
        }
      } else {
        for (let kk = 1; kk < nz - 1; kk++) for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, bottom, kk); const inside = this.index(i, bottom + 1, kk);
          if (this.blocked[idx]) continue;
          this.v[idx] = -Math.abs(this.v[inside]) - bc.inletSpeedMps * 0.15;
          this.u[idx] = this.u[inside]; this.w[idx] = this.w[inside]; this.temp[idx] = this.temp[inside];
        }
      }
    };
    for (const face of bc.outletFaces) outlet(face);

    // side walls
    if (bc.solidSideWalls) {
      for (let kk = 0; kk < nz; kk++) for (let j = 0; j < ny; j++) {
        const l = this.index(0, j, kk); const r = this.index(nx - 1, j, kk);
        this.u[l] = 0; this.v[l] = 0; this.w[l] = 0;
        this.u[r] = 0; this.v[r] = 0; this.w[r] = 0;
      }
    }
    if (bc.solidTop) {
      for (let kk = 0; kk < nz; kk++) for (let i = 0; i < nx; i++) {
        const idx = this.index(i, top, kk); this.u[idx] = 0; this.v[idx] = 0; this.w[idx] = 0;
      }
    }
    if (bc.solidBottom) {
      for (let kk = 0; kk < nz; kk++) for (let i = 0; i < nx; i++) {
        const idx = this.index(i, bottom, kk); this.u[idx] = 0; this.v[idx] = 0; this.w[idx] = 0;
      }
    }
  }

  /** advance one time step */
  step(dt: number, ambientC: number): void {
    const safeDt = clamp(dt, 1e-5, 0.1);
    const cellVol = this.spacing * this.spacing * this.spacing;

    // ---- velocity ----
    this.u0.set(this.u); this.v0.set(this.v); this.w0.set(this.w);
    // buoyancy (Boussinesq): hotter than ambient rises; apply to v
    for (let idx = 0; idx < this.n; idx++) {
      if (this.blocked[idx]) continue;
      const dT = this.temp[idx] - ambientC;
      this.v[idx] += safeDt * GRAVITY * THERMAL_EXPANSION_K * dT;
    }
    // explicit velocity sources (fans)
    for (let idx = 0; idx < this.n; idx++) {
      if (this.blocked[idx]) continue;
      this.u[idx] += safeDt * this.srcU[idx];
      this.v[idx] += safeDt * this.srcV[idx];
      this.w[idx] += safeDt * this.srcW[idx];
    }
    // diffuse velocity
    this.u0.set(this.u); this.diffuse(1, this.u, this.u0, AIR_KINEMATIC_VISCOSITY, safeDt);
    this.v0.set(this.v); this.diffuse(2, this.v, this.v0, AIR_KINEMATIC_VISCOSITY, safeDt);
    this.w0.set(this.w); this.diffuse(3, this.w, this.w0, AIR_KINEMATIC_VISCOSITY, safeDt);
    this.project(this.u, this.v, this.w, this.p, this.div);
    // advect velocity
    this.u0.set(this.u); this.v0.set(this.v); this.w0.set(this.w);
    this.advect(1, this.u, this.u0, safeDt);
    this.advect(2, this.v, this.v0, safeDt);
    this.advect(3, this.w, this.w0, safeDt);
    this.project(this.u, this.v, this.w, this.p, this.div);
    // clamp
    for (let idx = 0; idx < this.n; idx++) {
      this.u[idx] = clamp(safe(this.u[idx]), -this.maxSpeed, this.maxSpeed);
      this.v[idx] = clamp(safe(this.v[idx]), -this.maxSpeed, this.maxSpeed);
      this.w[idx] = clamp(safe(this.w[idx]), -this.maxSpeed, this.maxSpeed);
    }

    // ---- temperature ----
    this.temp0.set(this.temp);
    // heat sources (W -> K/s). Air in cell has mass rho*cellVol.
    const heatToKps = 1 / (AIR_DENSITY_KGM3 * AIR_CP_JKGK * cellVol);
    for (let idx = 0; idx < this.n; idx++) {
      if (this.blocked[idx]) continue;
      this.temp[idx] += safeDt * safe(this.heatSourceW[idx]) * heatToKps;
    }
    // diffuse
    this.temp0.set(this.temp); this.diffuse(0, this.temp, this.temp0, AIR_THERMAL_DIFFUSIVITY, safeDt);
    // advect
    this.temp0.set(this.temp); this.advect(0, this.temp, this.temp0, safeDt);
    // clamp temp
    for (let idx = 0; idx < this.n; idx++) {
      this.temp[idx] = clamp(safe(this.temp[idx], ambientC), ambientC - 100, ambientC + this.maxTempC);
    }

    this.applyBoundaryConditions();

    // clear per-step sources
    this.srcU.fill(0); this.srcV.fill(0); this.srcW.fill(0); this.heatSourceW.fill(0);
  }

  /** max |divergence| over fluid cells (incompressibility residual) */
  divergenceResidual(): number {
    const { nx, ny, nz, spacing } = this;
    let maxDiv = 0;
    for (let k = 1; k < nz - 1; k++) {
      for (let j = 1; j < ny - 1; j++) {
        for (let i = 1; i < nx - 1; i++) {
          const idx = this.index(i, j, k);
          if (this.blocked[idx]) continue;
          const div = (
            this.u[this.index(i + 1, j, k)] - this.u[this.index(i - 1, j, k)]
            + this.v[this.index(i, j + 1, k)] - this.v[this.index(i, j - 1, k)]
            + this.w[this.index(i, j, k + 1)] - this.w[this.index(i, j, k - 1)]
          ) / (2 * spacing);
          if (Number.isFinite(div)) maxDiv = Math.max(maxDiv, Math.abs(div));
        }
      }
    }
    return maxDiv;
  }

  maxSpeedMps(): number {
    let m = 0;
    for (let idx = 0; idx < this.n; idx++) {
      const s = Math.hypot(this.u[idx], this.v[idx], this.w[idx]);
      if (Number.isFinite(s)) m = Math.max(m, s);
    }
    return m;
  }
}
