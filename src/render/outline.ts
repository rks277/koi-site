import { makePath } from './tracePath';
import type { Genome, Vec2 } from '../types';

interface OutlinePass {
  // All values below are in CSS pixels; converted to body-local units at draw time.
  ox: number;
  oy: number;
  lineWidth: number;
  alpha: number;
}

const BODY_PASSES: OutlinePass[] = [
  { ox: -0.8, oy: -0.5, lineWidth: 1.1, alpha: 0.22 },
  { ox: 0.7, oy: 0.3, lineWidth: 1.0, alpha: 0.18 },
  { ox: 0.0, oy: 0.0, lineWidth: 1.6, alpha: 0.55 }
];

const FIN_PASSES: OutlinePass[] = [
  { ox: 0.0, oy: 0.0, lineWidth: 0.9, alpha: 0.32 },
  { ox: -0.5, oy: -0.3, lineWidth: 0.7, alpha: 0.18 }
];

/** Convert a CSS-pixel value to body-local units under the current transform. */
function pxToLocal(ctx: CanvasRenderingContext2D, px: number): number {
  const m = ctx.getTransform();
  const s = Math.hypot(m.a, m.b);
  return s > 0 ? px / s : px;
}

/** Multi-pass jittery body outline with C1-continuous quad-bezier tracing. */
export function strokeBodyOutline(
  ctx: CanvasRenderingContext2D,
  silhouette: Vec2[],
  genome: Genome
): void {
  const path = makePath(silhouette, true);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const jitter = genome.inkJitter;
  for (const p of BODY_PASSES) {
    ctx.save();
    ctx.translate(pxToLocal(ctx, p.ox * jitter), pxToLocal(ctx, p.oy * jitter));
    ctx.strokeStyle = `rgba(50, 35, 28, ${p.alpha})`;
    ctx.lineWidth = pxToLocal(ctx, p.lineWidth * (0.85 + 0.3 * genome.strokeTaper));
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

/** Light outline around a fin membrane (used in addition to ray strokes). */
export function strokeFinOutline(
  ctx: CanvasRenderingContext2D,
  membrane: Vec2[],
  genome: Genome
): void {
  const path = makePath(membrane, true);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const p of FIN_PASSES) {
    ctx.save();
    ctx.translate(pxToLocal(ctx, p.ox * genome.inkJitter), pxToLocal(ctx, p.oy * genome.inkJitter));
    ctx.strokeStyle = `rgba(70, 55, 45, ${p.alpha})`;
    ctx.lineWidth = pxToLocal(ctx, p.lineWidth);
    ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

/** Fin-ray strokes: hair-thin tapered quadratic curves. */
export function strokeFinRays(
  ctx: CanvasRenderingContext2D,
  rays: { base: Vec2; control: Vec2; tip: Vec2 }[],
  genome: Genome
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lw = pxToLocal(ctx, 0.7);
  for (const ry of rays) {
    ctx.beginPath();
    ctx.moveTo(ry.base.x, ry.base.y);
    ctx.quadraticCurveTo(ry.control.x, ry.control.y, ry.tip.x, ry.tip.y);
    ctx.strokeStyle = `rgba(75, 60, 50, ${0.26 + 0.10 * genome.inkJitter})`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Whisker: the tapered shape rendered as a stroke-only outline (no fill) so
 * the background shows through. Two splines (top + bottom edge) meet at the
 * tip. Designed to be drawn with a clip that hides the part inside the body.
 */
export function strokeWhisker(
  ctx: CanvasRenderingContext2D,
  w: { spine: Vec2[]; width: number }
): void {
  const N = w.spine.length;
  if (N < 2) return;
  // w.width is in body-local units, so it scales with the fish directly.
  const baseHalfWidth = w.width * 0.5;

  const top: Vec2[] = new Array(N);
  const bot: Vec2[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const im = Math.max(0, i - 1);
    const ip = Math.min(N - 1, i + 1);
    const tx = w.spine[ip].x - w.spine[im].x;
    const ty = w.spine[ip].y - w.spine[im].y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const t = i / (N - 1);
    // Gentle taper: width stays close to the base most of the way and only
    // collapses to zero near the very tip.
    const half = baseHalfWidth * Math.pow(1 - t, 0.55);
    top[i] = { x: w.spine[i].x + nx * half, y: w.spine[i].y + ny * half };
    bot[i] = { x: w.spine[i].x - nx * half, y: w.spine[i].y - ny * half };
  }
  const outline: Vec2[] = [];
  for (let i = 0; i < N; i++) outline.push(top[i]);
  for (let i = N - 1; i >= 0; i--) outline.push(bot[i]);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(60, 45, 35, 0.70)';
  ctx.lineWidth = pxToLocal(ctx, 1.0);
  ctx.stroke(makePath(outline, true));
  ctx.restore();
}

/** Eye glyph: a single soft dot. Subtle from a top-down view. */
export function renderEye(ctx: CanvasRenderingContext2D, center: Vec2, radius: number): void {
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70, 55, 45, 0.20)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(50, 38, 30, 0.75)';
  ctx.fill();
}
