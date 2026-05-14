import { buildKoi } from './koi/Koi';
import { renderKoi, clearScene } from './render/compose';
import type { Koi, Whisker } from './types';

const cvs = document.getElementById('c') as HTMLCanvasElement;
const ctx = cvs.getContext('2d')!;

let W = 0;
let H = 0;
let seed = 42;
let koi: Koi | null = null;
let prevWhiskers: Whisker[] | null = null;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  cvs.width = Math.floor(innerWidth * dpr);
  cvs.height = Math.floor(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = innerWidth;
  H = innerHeight;
  koi = null; // rebuild with new scale
}
addEventListener('resize', resize);

addEventListener('click', () => {
  seed = Math.floor(Math.random() * 1e9);
  koi = null;
  prevWhiskers = null;
});

const start = performance.now();
function frame(now: number): void {
  const time = (now - start) / 1000;
  if (W === 0 || H === 0) {
    requestAnimationFrame(frame);
    return;
  }
  if (!koi) {
    const scale = Math.min(W, H) * 0.55;
    koi = buildKoi(seed, scale);
  }
  clearScene(ctx, W, H);
  // Fixed at screen center, head pointing right (heading = 0).
  prevWhiskers = renderKoi(ctx, koi, W * 0.5, H * 0.5, 0, time, prevWhiskers);
  requestAnimationFrame(frame);
}

resize();
requestAnimationFrame(frame);
