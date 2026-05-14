import { sampleSpine, SPINE_SAMPLES, frameAt } from '../morphology/spine';
import { buildBody, radius } from '../morphology/body';
import { buildFins } from '../morphology/fins';
import { buildWhiskers } from '../morphology/whiskers';
import { swimWaveOffset, bodyBreathe } from '../motion/swimWave';
import { applyFinFlutter, applyWhiskerLag } from '../motion/secondaryMotion';
import { stampMarking } from './watercolor';
import {
  strokeBodyOutline,
  strokeFinOutline,
  strokeFinRays,
  strokeWhisker,
  renderEye
} from './outline';
import { makePath } from './tracePath';
import { mulberry32 } from '../rng/mulberry32';
import type { Koi, Spine, Whisker } from '../types';

/** Clear the frame to a flat background. */
export function clearScene(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  background = '#ffffff'
): void {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Render one koi at world position (posX, posY), facing the given heading.
 * Returns the per-frame whisker spines so the caller can pass them back next
 * frame for critically-damped lag.
 */
export function renderKoi(
  ctx: CanvasRenderingContext2D,
  koi: Koi,
  posX: number,
  posY: number,
  heading: number,
  time: number,
  prevWhiskers: Whisker[] | null
): Whisker[] {
  // 1. Deform spine
  const deformedSamples = sampleSpine(koi.spine.base, SPINE_SAMPLES, (t) =>
    swimWaveOffset(t, time, koi.genome)
  );
  const deformedSpine: Spine = {
    base: koi.spine.base,
    samples: deformedSamples,
    length: koi.spine.length
  };

  // 2. Regenerate downstream morphology (deterministic per-seed jitter streams).
  const body = buildBody(deformedSpine, koi.genome);
  const fins = buildFins(deformedSpine, koi.genome, mulberry32(koi.seed ^ 0x6a88b3a1));
  const whiskers = buildWhiskers(deformedSpine, koi.genome, mulberry32(koi.seed ^ 0x12345678));

  // 3. Secondary motion
  applyFinFlutter(fins, time, koi.genome);
  applyWhiskerLag(whiskers, prevWhiskers, time, koi.genome);
  const whiskerSnapshot: Whisker[] = whiskers.map((w) => ({
    spine: w.spine.map((p) => ({ x: p.x, y: p.y })),
    width: w.width
  }));

  // 4. World transform: position → orient to heading → scale → flip x so the
  //    fish's local +x (head→tail) points opposite the heading direction.
  const breathe = bodyBreathe(time, koi.genome);
  ctx.save();
  ctx.translate(posX, posY);
  ctx.rotate(heading);
  ctx.translate(0, breathe * koi.scale);
  ctx.scale(koi.scale, koi.scale);
  ctx.scale(-1, 1);
  ctx.translate(-koi.spine.length * 0.5, 0);

  // 5. Pipeline: markings (clipped to silhouette) → whiskers (outside body) →
  //    fins → body outline → eyes.
  const bodyPath = makePath(body.silhouette, true);

  ctx.save();
  ctx.clip(bodyPath);
  for (const mark of koi.markings) {
    stampMarking(ctx, mark, deformedSpine, koi.genome);
  }
  ctx.restore();

  ctx.save();
  const outerClip = new Path2D();
  outerClip.rect(-50, -50, 100, 100);
  outerClip.addPath(bodyPath);
  ctx.clip(outerClip, 'evenodd');
  for (const w of whiskers) strokeWhisker(ctx, w);
  ctx.restore();

  const drawOrder: typeof fins = [];
  for (const k of ['caudal', 'pelvic', 'anal', 'dorsal', 'pectoral'] as const) {
    for (const fin of fins) if (fin.kind === k) drawOrder.push(fin);
  }
  for (const fin of drawOrder) {
    const membranePath = makePath(fin.membrane, true);
    ctx.save();
    ctx.clip(membranePath);
    strokeFinRays(ctx, fin.rays, koi.genome);
    ctx.restore();
    strokeFinOutline(ctx, fin.membrane, koi.genome);
  }

  strokeBodyOutline(ctx, body.silhouette, koi.genome);

  const eyeFrame = frameAt(deformedSpine.samples, 0.10);
  const eyeBodyR = radius(eyeFrame.t, koi.genome);
  for (const side of [-1, 1] as const) {
    renderEye(
      ctx,
      {
        x: eyeFrame.pos.x + eyeFrame.normal.x * eyeBodyR * 0.90 * side,
        y: eyeFrame.pos.y + eyeFrame.normal.y * eyeBodyR * 0.90 * side
      },
      0.0085 * koi.genome.bodyLength
    );
  }

  ctx.restore();
  return whiskerSnapshot;
}
