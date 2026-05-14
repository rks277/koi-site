import type { Fin, Genome, Vec2, Whisker } from '../types';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/**
 * Secondary motion: each fin tip oscillates slowly around its current pose,
 * with phase based on fin index and per-fin attachment. Read as flutter.
 */
export function applyFinFlutter(fins: Fin[], time: number, genome: Genome): void {
  for (let i = 0; i < fins.length; i++) {
    const fin = fins[i];
    const localPhase = i * 0.7 + fin.attachmentT * 2.0;
    const flutter = Math.sin(time * 2.8 + localPhase + genome.motionPhase);
    const flutter2 = Math.sin(time * 4.2 + localPhase * 1.3 + genome.motionPhase);
    const mag = genome.bodyLength * 0.012;
    for (let r = 0; r < fin.rays.length; r++) {
      const u = fin.rays.length > 1 ? r / (fin.rays.length - 1) : 0.5;
      const tipBias = Math.pow(Math.sin(Math.PI * u), 0.5);
      const dx = flutter * tipBias * mag * (fin.kind === 'caudal' ? 2.0 : 1.0);
      const dy = flutter2 * tipBias * mag * (fin.kind === 'caudal' ? 1.5 : 1.0);
      fin.rays[r].tip.x += dx;
      fin.rays[r].tip.y += dy;
      fin.rays[r].control.x += dx * 0.5;
      fin.rays[r].control.y += dy * 0.5;
    }
    // Rebuild membrane envelope from updated rays
    fin.membrane.length = 0;
    for (const ry of fin.rays) fin.membrane.push(ry.tip);
    for (let r = fin.rays.length - 1; r >= 0; r--) fin.membrane.push(fin.rays[r].base);
  }
}

export function applyWhiskerLag(
  whiskers: Whisker[],
  prev: Whisker[] | null,
  time: number,
  genome: Genome
): void {
  for (let i = 0; i < whiskers.length; i++) {
    const w = whiskers[i];
    const swayX = Math.sin(time * 1.6 + i + genome.motionPhase) * 0.022 * genome.bodyLength;
    const swayY = Math.cos(time * 2.1 + i * 1.3 + genome.motionPhase) * 0.016 * genome.bodyLength;
    const N = w.spine.length;
    // Sway scales with distance from base — base sits still, tip drifts most.
    for (let j = 0; j < N; j++) {
      const t = N > 1 ? j / (N - 1) : 0;
      w.spine[j] = {
        x: w.spine[j].x + swayX * t,
        y: w.spine[j].y + swayY * t
      };
    }
    if (prev && prev[i] && prev[i].spine.length === N) {
      const k = 0.25;
      for (let j = 0; j < N; j++) {
        w.spine[j] = lerpVec(prev[i].spine[j], w.spine[j], k);
      }
    }
  }
}
