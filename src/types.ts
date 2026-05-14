export interface Vec2 {
  x: number;
  y: number;
}

export interface Genome {
  // Body
  bodyLength: number;
  bodyThickness: number;
  taperStrength: number;
  headSize: number;

  // Spine
  spineCurvature: number;
  spineNoise: number;

  // Fins
  pectoralFinSize: number;
  pectoralFinSpread: number;
  tailSize: number;
  tailForkDepth: number;
  finRoundness: number;

  // Motion
  swimAmplitude: number;
  swimFrequency: number;
  bodyStiffness: number;
  motionPhase: number;

  // Pigmentation
  markingCount: number;
  markingSize: number;
  variety: KoiVariety;

  // Rendering
  inkJitter: number;
  strokeTaper: number;
}

export type KoiVariety =
  | 'kohaku'
  | 'sanke'
  | 'showa'
  | 'asagi'
  | 'utsuri'
  | 'ogon'
  | 'platinum';

export interface Palette {
  base: string;
  baseLight: string;
  marks: string[];
}

export interface SpineSample {
  t: number;
  pos: Vec2;
  tangent: Vec2;
  normal: Vec2;
}

export interface Spine {
  // canonical (un-deformed) control points
  base: Vec2[];
  // sampled frames in current pose (regenerated each frame)
  samples: SpineSample[];
  // length in local coords
  length: number;
}

export interface Body {
  left: Vec2[]; // contour samples on +normal side
  right: Vec2[]; // contour samples on -normal side
  silhouette: Vec2[]; // closed polygon left + right reversed
}

export type FinKind = 'pectoral' | 'pelvic' | 'anal' | 'dorsal' | 'caudal';

export interface FinRay {
  base: Vec2;
  control: Vec2;
  tip: Vec2;
  width: number;
}

export interface Fin {
  kind: FinKind;
  side: -1 | 0 | 1; // -1 left, 1 right, 0 centerline (dorsal, anal, caudal)
  attachmentT: number; // body-local t in [0, 1]
  attachSpan: number; // along-body span of attachment in t-units
  rays: FinRay[];
  membrane: Vec2[]; // closed envelope
  opacity: number;
}

export interface Whisker {
  // Sample points along the whisker curve, base → tip.
  spine: Vec2[];
  // Base width in body-local units (scales 1:1 with the fish).
  width: number;
}

export interface Marking {
  // Center position on the body. s ∈ [0, 1] along spine, u ∈ [-1, 1] across.
  s: number;
  u: number;
  // Half-size in world units (fraction of bodyLength).
  size: number;
  // Rotation of the noise frame relative to the world tangent.
  rot: number;
  // Per-marking noise-space offset / frequency for sample decorrelation.
  noiseOffset: { x: number; y: number };
  noiseFreq: number;
  // Soft threshold cutoff. Higher = sparser/more patchy mask.
  threshold: number;
  // Tancho dots and similar uniform fills disable the noise contribution.
  uniform?: boolean;
  color: string;
  // Pre-baked alpha-noise texture. Stamped into the body per frame.
  texture: HTMLCanvasElement;
}

export interface Koi {
  seed: number;
  genome: Genome;
  palette: Palette;
  spine: Spine;
  body: Body;
  fins: Fin[];
  whiskers: Whisker[];
  markings: Marking[];
  noise2D: (x: number, y: number) => number;
  // visual scale (pixels per body unit)
  scale: number;
}
