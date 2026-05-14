import type { Body, Genome, Spine, Vec2 } from '../types';

/**
 * Half-width radius along the spine in body-local units. Goes to ~0 at the
 * snout (t=0), peaks around t≈0.28 (head/shoulder), then tapers through a
 * narrow peduncle to a near-point at the caudal attachment (t=1).
 */
export function radius(t: number, genome: Genome): number {
  const tc = Math.max(0, Math.min(1, t));

  // Reshape t so the silhouette peak sits forward of center, giving the
  // classic koi "shoulder near the head" look.
  const tShape = Math.pow(tc, 0.6);
  const profile = Math.pow(Math.sin(Math.PI * tShape), 0.75);

  // Subtle head-size bias localized to the front quarter.
  const headWeight = Math.exp(-Math.pow((tc - 0.22) / 0.22, 2));
  const headBias = 1 + (genome.headSize - 1) * headWeight * 0.5;

  // Peduncle squeeze in the tail third.
  const peduncleT = Math.max(0, (tc - 0.72) / 0.28);
  const peduncleSqueeze = 1 - Math.pow(peduncleT, 1.8) * 0.55 * genome.taperStrength;

  return profile * headBias * peduncleSqueeze * genome.bodyThickness * genome.bodyLength;
}

export function buildBody(spine: Spine, genome: Genome): Body {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  const N = spine.samples.length;
  for (let i = 0; i < N; i++) {
    const s = spine.samples[i];
    const r = radius(s.t, genome);
    left.push({ x: s.pos.x + s.normal.x * r, y: s.pos.y + s.normal.y * r });
    right.push({ x: s.pos.x - s.normal.x * r, y: s.pos.y - s.normal.y * r });
  }

  // Silhouette: skip the degenerate t=0 endpoints and replace them with a
  // forward-arcing mouth bump that joins right[1] → bump arc → left[1].
  const silhouette: Vec2[] = [];
  for (let i = 1; i < N; i++) silhouette.push(left[i]);
  for (let i = N - 1; i >= 1; i--) silhouette.push(right[i]);

  const head = spine.samples[0];
  const tx = head.tangent.x;
  const ty = head.tangent.y;
  const nx = head.normal.x;
  const ny = head.normal.y;
  const bumpDepth = genome.bodyLength * 0.015;
  const bumpHalfWidth = radius(spine.samples[1].t, genome) * 1.02;
  const BUMP_POINTS = 7;
  for (let i = 1; i <= BUMP_POINTS; i++) {
    const a = i / (BUMP_POINTS + 1);     // open interval (0, 1)
    const ang = (a - 0.5) * Math.PI;     // -π/2 … +π/2
    const sideOff = Math.sin(ang) * bumpHalfWidth;
    const forwardOff = Math.cos(ang) * bumpDepth;
    silhouette.push({
      x: head.pos.x + nx * sideOff - tx * forwardOff,
      y: head.pos.y + ny * sideOff - ty * forwardOff
    });
  }

  return { left, right, silhouette };
}
