import { mulberry32, rngPick, rngRange, type Rng } from '../rng/mulberry32';
import { VARIETIES } from '../pigmentation/palettes';
import type { Genome } from '../types';

export interface GenomeBundle {
  genome: Genome;
  rng: Rng;
  seed: number;
}

export function genomeFromSeed(seed: number): GenomeBundle {
  const rng = mulberry32(seed);
  const r = rng;

  const genome: Genome = {
    // Body
    bodyLength: rngRange(r, 1.20, 1.50),
    bodyThickness: rngRange(r, 0.12, 0.16),
    taperStrength: rngRange(r, 0.85, 1.15),
    headSize: rngRange(r, 0.85, 1.10),

    // Spine
    spineCurvature: rngRange(r, -0.10, 0.10),
    spineNoise: rngRange(r, 0.0, 0.04),

    // Fins
    pectoralFinSize: rngRange(r, 0.85, 1.30),
    pectoralFinSpread: rngRange(r, 0.55, 0.90),
    tailSize: rngRange(r, 0.85, 1.20),
    tailForkDepth: rngRange(r, 0.20, 0.50),
    finRoundness: rngRange(r, 0.55, 0.85),

    // Motion
    swimAmplitude: rngRange(r, 0.06, 0.10),
    swimFrequency: rngRange(r, 4.0, 5.5),
    bodyStiffness: rngRange(r, 0.55, 0.85),
    motionPhase: r() * Math.PI * 2,

    // Pigmentation
    markingCount: Math.floor(rngRange(r, 2, 6)),
    markingSize: rngRange(r, 0.18, 0.36),
    variety: rngPick(r, VARIETIES),

    // Rendering
    inkJitter: rngRange(r, 0.4, 0.9),
    strokeTaper: rngRange(r, 0.6, 1.0)
  };

  return { genome, rng, seed };
}
