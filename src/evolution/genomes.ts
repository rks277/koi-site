import { genomeFromSeed } from '../genome/generate';
import type { Genome, KoiVariety } from '../types';

export interface StoredGenome {
  seed: number;
  sizeFactor: number;
  parameters: Genome;
}

export interface FishGenomeRecord {
  id: string;
  genome: StoredGenome;
  generation: number;
  parent_a: string | null;
  parent_b: string | null;
  fitness: number;
  created_at: string;
}

const NUMERIC_RANGES = {
  bodyLength: [1.20, 1.50],
  bodyThickness: [0.12, 0.16],
  taperStrength: [0.85, 1.15],
  headSize: [0.85, 1.10],
  spineCurvature: [-0.10, 0.10],
  spineNoise: [0.0, 0.04],
  pectoralFinSize: [0.85, 1.30],
  pectoralFinSpread: [0.55, 0.90],
  tailSize: [0.85, 1.20],
  tailForkDepth: [0.20, 0.50],
  finRoundness: [0.55, 0.85],
  swimAmplitude: [0.06, 0.10],
  swimFrequency: [4.0, 5.5],
  bodyStiffness: [0.55, 0.85],
  motionPhase: [0, Math.PI * 2],
  markingCount: [2, 6],
  markingSize: [0.18, 0.36],
  inkJitter: [0.4, 0.9],
  strokeTaper: [0.6, 1.0]
} satisfies Record<keyof Omit<Genome, 'variety'>, readonly [number, number]>;

type NumericGenomeKey = keyof typeof NUMERIC_RANGES;

const INTEGER_KEYS = new Set<NumericGenomeKey>(['markingCount']);
const SIZE_FACTOR_RANGE = [0.045, 0.080] as const;
const VARIETY_WEIGHTS: Array<[KoiVariety, number]> = [
  ['kohaku', 26],
  ['sanke', 24],
  ['asagi', 18],
  ['platinum', 14],
  ['ogon', 8],
  ['showa', 3],
  ['utsuri', 2]
];
const VARIETIES = VARIETY_WEIGHTS.map(([variety]) => variety);

export function createRandomStoredGenome(): StoredGenome {
  const seed = Math.floor(Math.random() * 1e9);
  const parameters = genomeFromSeed(seed).genome;
  parameters.variety = weightedRandomVariety();
  return {
    seed,
    sizeFactor: randomSizeFactor(),
    parameters
  };
}

export function createStoredGenomeForVariety(variety: KoiVariety): StoredGenome {
  const stored = createRandomStoredGenome();
  stored.parameters.variety = variety;
  return stored;
}

export function normalizeStoredGenome(value: unknown): StoredGenome {
  if (isStoredGenome(value)) {
    return {
      ...value,
      sizeFactor: clamp(value.sizeFactor ?? sizeFactorFromSeed(value.seed), SIZE_FACTOR_RANGE[0], SIZE_FACTOR_RANGE[1])
    };
  }
  if (isGenome(value)) {
    const seed = seedFromGenome(value);
    return {
      seed,
      sizeFactor: sizeFactorFromSeed(seed),
      parameters: value
    };
  }
  return createRandomStoredGenome();
}

export function generateChildGenome(parentA: StoredGenome, parentB: StoredGenome): StoredGenome {
  const lambda = Math.random();
  const sigma = Math.random() < 0.05 ? 0.25 : 0.08;
  const child = { ...parentA.parameters };

  for (const key of Object.keys(NUMERIC_RANGES) as NumericGenomeKey[]) {
    const [min, max] = NUMERIC_RANGES[key];
    const a = normalize(parentA.parameters[key], min, max);
    const b = normalize(parentB.parameters[key], min, max);
    const blended = lambda * a + (1 - lambda) * b;
    let value = denormalize(clamp01(blended + gaussianNoise() * sigma), min, max);
    if (INTEGER_KEYS.has(key)) value = Math.round(value);
    child[key] = value as never;
  }

  child.variety = inheritVariety(parentA.parameters.variety, parentB.parameters.variety);
  const sizeA = normalize(parentA.sizeFactor, SIZE_FACTOR_RANGE[0], SIZE_FACTOR_RANGE[1]);
  const sizeB = normalize(parentB.sizeFactor, SIZE_FACTOR_RANGE[0], SIZE_FACTOR_RANGE[1]);
  const size = denormalize(clamp01(lambda * sizeA + (1 - lambda) * sizeB + gaussianNoise() * sigma), SIZE_FACTOR_RANGE[0], SIZE_FACTOR_RANGE[1]);

  return {
    seed: Math.floor(Math.random() * 1e9),
    sizeFactor: size,
    parameters: child
  };
}

export function selectParentPair(records: FishGenomeRecord[]): [FishGenomeRecord, FishGenomeRecord] {
  if (records.length === 0) {
    throw new Error('Cannot select parents from an empty population.');
  }
  if (records.length === 1) return [records[0], records[0]];

  const first = weightedPick(records);
  let second = weightedPick(records);
  for (let i = 0; i < 5 && second.id === first.id; i++) {
    second = weightedPick(records);
  }
  return [first, second];
}

function weightedPick(records: FishGenomeRecord[]): FishGenomeRecord {
  const beta = 0.5;
  const weights = records.map((record) => Math.exp(beta * Math.max(0, record.fitness)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let target = Math.random() * total;

  for (let i = 0; i < records.length; i++) {
    target -= weights[i];
    if (target <= 0) return records[i];
  }
  return records[records.length - 1];
}

function inheritVariety(a: KoiVariety, b: KoiVariety): KoiVariety {
  if (Math.random() < 0.04) return weightedRandomVariety();
  return Math.random() < 0.5 ? a : b;
}

function weightedRandomVariety(): KoiVariety {
  const total = VARIETY_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let target = Math.random() * total;
  for (const [variety, weight] of VARIETY_WEIGHTS) {
    target -= weight;
    if (target <= 0) return variety;
  }
  return VARIETY_WEIGHTS[0][0];
}

function normalize(value: number, min: number, max: number): number {
  return (value - min) / (max - min);
}

function denormalize(value: number, min: number, max: number): number {
  return min + value * (max - min);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomSizeFactor(): number {
  return SIZE_FACTOR_RANGE[0] + Math.random() * (SIZE_FACTOR_RANGE[1] - SIZE_FACTOR_RANGE[0]);
}

function sizeFactorFromSeed(seed: number): number {
  const normalized = ((seed >>> 0) % 10000) / 9999;
  return denormalize(normalized, SIZE_FACTOR_RANGE[0], SIZE_FACTOR_RANGE[1]);
}

function gaussianNoise(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(Math.PI * 2 * v);
}

function isStoredGenome(value: unknown): value is StoredGenome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredGenome>;
  return typeof candidate.seed === 'number' && isGenome(candidate.parameters);
}

function isGenome(value: unknown): value is Genome {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Genome>;
  return (
    typeof candidate.bodyLength === 'number' &&
    typeof candidate.bodyThickness === 'number' &&
    typeof candidate.markingCount === 'number' &&
    typeof candidate.variety === 'string' &&
    (VARIETIES as string[]).includes(candidate.variety)
  );
}

function seedFromGenome(genome: Genome): number {
  const json = JSON.stringify(genome, Object.keys(genome).sort());
  let hash = 2166136261;
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
