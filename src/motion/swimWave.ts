import type { Genome } from '../types';

/**
 * Traveling wave deformation along the spine.
 *  - head (t=0) moves minimally
 *  - tail (t=1) moves strongly
 * Returns a y-offset in body-local units.
 */
export function swimWaveOffset(t: number, time: number, genome: Genome): number {
  const ampShape = Math.pow(t, 1.5);
  const stiffnessAttenuation = 1 - genome.bodyStiffness * 0.4;
  const amp = ampShape * genome.swimAmplitude * genome.bodyLength * stiffnessAttenuation;
  return amp * Math.sin(t * 4.5 - time * genome.swimFrequency + genome.motionPhase);
}

/** A small overall body translation/sway separate from the traveling wave. */
export function bodyBreathe(time: number, genome: Genome): number {
  return Math.sin(time * 1.5 + genome.motionPhase) * genome.bodyLength * 0.005;
}
