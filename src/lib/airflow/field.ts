import type { AirflowGrid, AirflowReport, AirflowSample } from './types';
import type { FluidSolver } from './fluidSolver';

/** A solved, queryable airflow field. World units are metres; scene = world * scenePerMeter. */
export class AirflowField {
  constructor(
    public readonly solver: FluidSolver,
    public readonly grid: AirflowGrid,
    public readonly report: AirflowReport,
  ) {}

  /** sample at world-metre coordinates */
  sampleWorld(x: number, y: number, z: number): AirflowSample {
    return this.solver.sample(x, y, z);
  }

  /** sample at scene coordinates (Three.js space) */
  sampleScene(x: number, y: number, z: number): AirflowSample {
    const s = this.grid.scenePerMeter;
    return this.solver.sample(x / s, y / s, z / s);
  }

  /** velocity scaled into scene units (scene units / second) */
  sampleSceneVelocity(x: number, y: number, z: number): { vx: number; vy: number; vz: number; speed: number; tempC: number } {
    const s = this.sampleScene(x, y, z);
    const k = this.grid.scenePerMeter;
    return { vx: s.vx * k, vy: s.vy * k, vz: s.vz * k, speed: s.speed * k, tempC: s.tempC };
  }

  get scenePerMeter(): number {
    return this.grid.scenePerMeter;
  }
}
