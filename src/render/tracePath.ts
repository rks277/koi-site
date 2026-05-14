import type { Vec2 } from '../types';

/**
 * Build a closed-or-open Path2D through `pts` using quadratic Béziers between
 * midpoints. Each input point acts as a control point; the curve passes
 * through midpoints, guaranteeing C1 continuity with no visible vertices.
 */
export function makePath(pts: Vec2[], closed: boolean): Path2D {
  const p = new Path2D();
  const N = pts.length;
  if (N < 2) return p;
  if (N === 2) {
    p.moveTo(pts[0].x, pts[0].y);
    p.lineTo(pts[1].x, pts[1].y);
    return p;
  }
  if (closed) {
    const last = pts[N - 1];
    const first = pts[0];
    p.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2);
    for (let i = 0; i < N; i++) {
      const cur = pts[i];
      const next = pts[(i + 1) % N];
      p.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
    }
    p.closePath();
  } else {
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N - 1; i++) {
      const cur = pts[i];
      const next = pts[i + 1];
      p.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
    }
    p.lineTo(pts[N - 1].x, pts[N - 1].y);
  }
  return p;
}
