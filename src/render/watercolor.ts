import { markingCenter } from '../pigmentation/markings';
import type { Genome, Marking, Spine } from '../types';

/**
 * Stamp a pre-baked noise-mask texture onto the body at the marking's current
 * world position. The texture covers a square in world units sized as
 * `mark.size * bodyLength`, rotated by mark.rot + the spine tangent at mark.s.
 * Caller should already have clipped to the body silhouette.
 */
export function stampMarking(
  ctx: CanvasRenderingContext2D,
  mark: Marking,
  spine: Spine,
  genome: Genome
): void {
  const { x, y, angle } = markingCenter(mark, spine, genome);
  const half = mark.size * genome.bodyLength;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mark.texture, -half, -half, half * 2, half * 2);
  ctx.restore();
}
