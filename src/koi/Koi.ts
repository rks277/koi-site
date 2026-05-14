import { genomeFromSeed } from '../genome/generate';
import { buildSpine } from '../morphology/spine';
import { buildBody } from '../morphology/body';
import { buildFins } from '../morphology/fins';
import { buildWhiskers } from '../morphology/whiskers';
import { buildMarkings } from '../pigmentation/markings';
import { PALETTES } from '../pigmentation/palettes';
import { mulberry32 } from '../rng/mulberry32';
import { makePerlin2D } from '../rng/noise';
import type { Genome, Koi } from '../types';

/**
 * Build a complete Koi from a seed. The result holds the rest-pose spine and
 * canonical fin/whisker rays; per-frame motion mutates copies in compose.ts.
 */
export function buildKoi(seed: number, scale: number): Koi {
  const { genome } = genomeFromSeed(seed);
  return buildKoiFromGenome(seed, genome, scale);
}

export function buildKoiFromGenome(seed: number, genome: Genome, scale: number): Koi {
  // Independent RNG streams for sub-systems so changing one stage doesn't shift others
  const spineRng = mulberry32(seed ^ 0x9e3779b9);
  const finRng = mulberry32(seed ^ 0x6a88b3a1);
  const whiskerRng = mulberry32(seed ^ 0x12345678);
  const markRng = mulberry32(seed ^ 0xbeef1234);
  const noiseRng = mulberry32(seed ^ 0xcafef00d);

  const spine = buildSpine(genome, spineRng);
  const body = buildBody(spine, genome);
  const fins = buildFins(spine, genome, finRng);
  const whiskers = buildWhiskers(spine, genome, whiskerRng);
  const palette = PALETTES[genome.variety];
  const noise2D = makePerlin2D(noiseRng);
  const markings = buildMarkings(genome, markRng, noise2D);

  return { seed, genome, palette, spine, body, fins, whiskers, markings, noise2D, scale };
}
