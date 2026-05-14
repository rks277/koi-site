import {
  activateFishSlot,
  createFishGenome,
  hasSupabaseConfig,
  loadActiveFishSlots,
  recordSiteVisitor,
  updateFishFitness
} from './backend/supabase';
import {
  createRandomStoredGenome,
  generateChildGenome,
  normalizeStoredGenome,
  selectParentPair,
  type FishGenomeRecord
} from './evolution/genomes';
import { buildKoiFromGenome } from './koi/Koi';
import { renderKoi, clearScene } from './render/compose';
import type { Koi, Whisker } from './types';

const cvs = document.getElementById('c') as HTMLCanvasElement;
const ctx = cvs.getContext('2d')!;
const infoToggle = document.getElementById('info-toggle') as HTMLButtonElement | null;
const infoPanel = document.getElementById('info-panel') as HTMLElement | null;

const FISH_COUNT = 7;
const PLACEMENT_TRIES = 40;
const LOCAL_STORAGE_KEY = 'koi.local.activeFish.v1';
const VISITOR_STORAGE_KEY = 'koi.site.visitorId.v1';

interface Fish {
  slotIndex: number;
  genomeRecord: FishGenomeRecord;
  activatedAtMs: number;
  koi: Koi;
  pos: { x: number; y: number };
  heading: number; // radians; 0 = +x
  speed: number;   // px / second
  prevWhiskers: Whisker[] | null;
  replacing: boolean;
}

let W = 0;
let H = 0;
let fish: Fish[] = [];
let loadingPond = false;
let canvasDpr = 0;
let resizeFrame: number | null = null;
let pendingLayoutResize = false;

let contentRect: DOMRect | null = null;
const contentElement = document.getElementById('content');

infoToggle?.addEventListener('click', (event) => {
  event.stopPropagation();
  if (!infoPanel) return;
  const isOpen = !infoPanel.hidden;
  infoPanel.hidden = isOpen;
  infoToggle.setAttribute('aria-expanded', String(!isOpen));
});

infoPanel?.addEventListener('click', (event) => {
  event.stopPropagation();
});

function recordUniqueVisitor(): void {
  if (!hasSupabaseConfig()) return;
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  void recordSiteVisitor(visitorId).catch((error) => {
    console.warn('Could not record site visitor.', error);
  });
}

function getOrCreateVisitorId(): string | null {
  try {
    const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (stored) return stored;

    const visitorId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : fallbackVisitorId();
    localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
    return visitorId;
  } catch (error) {
    console.warn('Could not create site visitor id.', error);
    return null;
  }
}

function fallbackVisitorId(): string {
  const random = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${random}`;
}

function updateContentRect() {
  if (contentElement) {
    contentRect = contentElement.getBoundingClientRect();
  }
}

function bodyLengthPx(k: Koi): number {
  return k.spine.length * k.scale;
}

function scaleForFish(record: FishGenomeRecord): number {
  return Math.min(W, H) * record.genome.sizeFactor;
}

function randomPosForLength(len: number): { x: number; y: number } {
  return {
    x: len + Math.random() * Math.max(1, W - 2 * len),
    y: len + Math.random() * Math.max(1, H - 2 * len)
  };
}

function overlapsExisting(pos: { x: number; y: number }, len: number): boolean {
  for (const other of fish) {
    const dx = pos.x - other.pos.x;
    const dy = pos.y - other.pos.y;
    const minDist = (len + bodyLengthPx(other.koi)) * 0.65;
    if (Math.hypot(dx, dy) < minDist) return true;
  }
  return false;
}

function spawnFish(record: FishGenomeRecord, slotIndex: number, activatedAt: string): Fish {
  const koi = buildKoiFromGenome(record.genome.seed, record.genome.parameters, scaleForFish(record));
  const len = bodyLengthPx(koi);

  let pos = randomPosForLength(len);
  for (let t = 0; t < PLACEMENT_TRIES; t++) {
    if (!overlapsExisting(pos, len)) break;
    pos = randomPosForLength(len);
  }
  return {
    slotIndex,
    genomeRecord: record,
    activatedAtMs: Date.parse(activatedAt),
    koi,
    pos,
    heading: Math.random() * Math.PI * 2,
    speed: 22 + Math.random() * 28,
    prevWhiskers: null,
    replacing: false
  };
}

function rebuildPond(records: Array<{ slotIndex: number; record: FishGenomeRecord; activatedAt: string }>): void {
  fish = [];
  for (const entry of records) {
    fish.push(spawnFish(entry.record, entry.slotIndex, entry.activatedAt));
  }
}

async function initializePond(): Promise<void> {
  if (loadingPond || fish.length > 0) return;
  loadingPond = true;
  try {
    if (hasSupabaseConfig()) {
      const slots = await loadActiveFishSlots();
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      rebuildPond(slots.map((slot) => ({
        slotIndex: slot.slot_index,
        record: slot.fish,
        activatedAt: slot.activated_at
      })));
    } else {
      rebuildPond(createLocalRecords());
      console.warn('Supabase is not configured; koi persistence is running in local-only mode.');
    }
  } catch (error) {
    console.error('Could not load koi from Supabase; using local-only fish.', error);
    rebuildPond(createLocalRecords());
  } finally {
    loadingPond = false;
  }
}

function createLocalRecords(): Array<{ slotIndex: number; record: FishGenomeRecord; activatedAt: string }> {
  const stored = loadLocalRecords();
  if (stored) return stored;

  const records = Array.from({ length: FISH_COUNT }, (_, index) => {
    const now = new Date().toISOString();
    return {
      slotIndex: index + 1,
      activatedAt: now,
      record: {
        id: `local-${index + 1}-${Date.now()}`,
        genome: createRandomStoredGenome(),
        generation: 0,
        parent_a: null,
        parent_b: null,
        fitness: 0,
        created_at: now
      }
    };
  });
  saveLocalRecords(records);
  return records;
}

async function regenerateFish(f: Fish): Promise<void> {
  if (f.replacing) return;
  f.replacing = true;

  try {
    const survivalSeconds = Math.max(0, (Date.now() - f.activatedAtMs) / 1000);
    const previousRecord = f.genomeRecord;
    const optimistic = createOptimisticReplacement(f, survivalSeconds);
    applyReplacement(f, optimistic);

    if (hasSupabaseConfig() && isUuid(previousRecord.id)) {
      const persisted = await createBackendReplacement(previousRecord, f.slotIndex, survivalSeconds, optimistic)
        .catch((error) => {
          console.warn('Backend koi evolution failed; keeping optimistic local replacement.', error);
          return null;
        });
      if (persisted) applyReplacement(f, persisted);
    } else {
      saveCurrentLocalRecords();
    }
  } finally {
    f.replacing = false;
  }
}

function applyReplacement(f: Fish, replacement: { record: FishGenomeRecord; activatedAt: string }): void {
  f.genomeRecord = replacement.record;
  f.activatedAtMs = Date.parse(replacement.activatedAt);
  f.koi = buildKoiFromGenome(replacement.record.genome.seed, replacement.record.genome.parameters, scaleForFish(replacement.record));
  f.prevWhiskers = null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function createBackendReplacement(
  previousRecord: FishGenomeRecord,
  slotIndex: number,
  survivalSeconds: number,
  replacement: { record: FishGenomeRecord; activatedAt: string }
): Promise<{ record: FishGenomeRecord; activatedAt: string }> {
  await withStep('update fish fitness', () => updateFishFitness(previousRecord.id, survivalSeconds));
  const record = await withStep('create fish genome', () => createFishGenome({
    genome: replacement.record.genome,
    generation: replacement.record.generation,
    parentA: isUuid(replacement.record.parent_a ?? '') ? replacement.record.parent_a : null,
    parentB: isUuid(replacement.record.parent_b ?? '') ? replacement.record.parent_b : null
  }));
  await withStep('activate fish slot', () => activateFishSlot(slotIndex, record.id));
  return { record, activatedAt: replacement.activatedAt };
}

async function withStep<T>(step: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw new Error(`Could not ${step}.`, { cause: error });
  }
}

function createOptimisticReplacement(
  f: Fish,
  survivalSeconds: number
): { record: FishGenomeRecord; activatedAt: string } {
  const population = fish.map((entry) => ({
    ...entry.genomeRecord,
    fitness: entry === f ? survivalSeconds : entry.genomeRecord.fitness
  }));
  const [parentA, parentB] = selectParentPair(population);
  const now = new Date().toISOString();
  const replacement = {
    activatedAt: now,
    record: {
      id: `local-${f.slotIndex}-${Date.now()}`,
      genome: generateChildGenome(parentA.genome, parentB.genome),
      generation: Math.max(parentA.generation, parentB.generation) + 1,
      parent_a: parentA.id,
      parent_b: parentB.id,
      fitness: 0,
      created_at: now
    }
  };
  return replacement;
}

function saveCurrentLocalRecords(): void {
  saveLocalRecords(fish.map((entry) => ({
    slotIndex: entry.slotIndex,
    record: entry.genomeRecord,
    activatedAt: new Date(entry.activatedAtMs).toISOString()
  })));
}

function loadLocalRecords(): Array<{ slotIndex: number; record: FishGenomeRecord; activatedAt: string }> | null {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const records = JSON.parse(raw) as Array<{ slotIndex: number; record: FishGenomeRecord; activatedAt: string }>;
    if (!Array.isArray(records) || records.length !== FISH_COUNT) return null;
    const normalized = records.map((entry, index) => normalizeLocalRecord(entry, index));
    saveLocalRecords(normalized);
    return normalized.sort((a, b) => a.slotIndex - b.slotIndex);
  } catch {
    return null;
  }
}

function normalizeLocalRecord(
  entry: Partial<{ slotIndex: number; record: Partial<FishGenomeRecord>; activatedAt: string }>,
  index: number
): { slotIndex: number; record: FishGenomeRecord; activatedAt: string } {
  const now = new Date().toISOString();
  const slotIndex = Number.isFinite(entry.slotIndex) ? Number(entry.slotIndex) : index + 1;
  const record = entry.record ?? {};
  const id = typeof record.id === 'string' ? record.id : `local-${slotIndex}-${Date.now()}-${index}`;
  const createdAt = typeof record.created_at === 'string' ? record.created_at : now;

  return {
    slotIndex,
    activatedAt: typeof entry.activatedAt === 'string' ? entry.activatedAt : createdAt,
    record: {
      id,
      genome: normalizeStoredGenome(record.genome),
      generation: typeof record.generation === 'number' ? record.generation : 0,
      parent_a: typeof record.parent_a === 'string' ? record.parent_a : null,
      parent_b: typeof record.parent_b === 'string' ? record.parent_b : null,
      fitness: typeof record.fitness === 'number' ? record.fitness : 0,
      created_at: createdAt
    }
  };
}

function saveLocalRecords(records: Array<{ slotIndex: number; record: FishGenomeRecord; activatedAt: string }>): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
}

function effectiveCanvasDpr(): number {
  const viewportScale = window.visualViewport?.scale ?? 1;
  return Math.min(3, Math.max(1, (window.devicePixelRatio || 1) * viewportScale));
}

function isViewportZoomed(): boolean {
  return (window.visualViewport?.scale ?? 1) > 1.01;
}

function resize(updateLayout: boolean): void {
  const dpr = effectiveCanvasDpr();
  const nextW = updateLayout || W === 0 ? innerWidth : W;
  const nextH = updateLayout || H === 0 ? innerHeight : H;
  const nextCanvasW = Math.floor(nextW * dpr);
  const nextCanvasH = Math.floor(nextH * dpr);

  if (cvs.width !== nextCanvasW || cvs.height !== nextCanvasH) {
    cvs.width = nextCanvasW;
    cvs.height = nextCanvasH;
  }
  if (canvasDpr !== dpr) {
    canvasDpr = dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (updateLayout || W === 0 || H === 0) {
    W = nextW;
    H = nextH;
    updateContentRect();
  }
  if (fish.length === 0) void initializePond();
}

function scheduleResize(updateLayout: boolean): void {
  pendingLayoutResize ||= updateLayout;
  if (resizeFrame !== null) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;
    const shouldUpdateLayout = pendingLayoutResize;
    pendingLayoutResize = false;
    resize(shouldUpdateLayout);
  });
}
addEventListener('resize', () => scheduleResize(!isViewportZoomed()));
window.visualViewport?.addEventListener('resize', () => scheduleResize(false));
window.visualViewport?.addEventListener('scroll', () => scheduleResize(false));

function fishAtPoint(x: number, y: number, extraHitRadius = 0): Fish | null {
  for (const f of fish) {
    const len = bodyLengthPx(f.koi);
    const halfLen = len * 0.5;
    const dx = x - f.pos.x;
    const dy = y - f.pos.y;
    const along = dx * Math.cos(f.heading) + dy * Math.sin(f.heading);
    const across = -dx * Math.sin(f.heading) + dy * Math.cos(f.heading);
    const clampedAlong = Math.max(-halfLen, Math.min(halfLen, along));
    const distToBody = Math.hypot(along - clampedAlong, across);
    const hitR = Math.max(18, len * 0.18) + extraHitRadius;

    if (distToBody < hitR) return f;
  }
  return null;
}

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') {
    document.body.style.cursor = fishAtPoint(e.clientX, e.clientY) ? 'pointer' : '';
  }
});

addEventListener('pointerdown', (e) => {
  const f = fishAtPoint(e.clientX, e.clientY, e.pointerType === 'touch' ? 18 : 0);
  if (f) {
    e.preventDefault();
    void regenerateFish(f).catch((error) => {
      f.replacing = false;
      console.error('Could not evolve koi.', error);
    });
  }
});

function angleDelta(from: number, to: number): number {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function steerToward(current: number, target: number, rate: number): number {
  return current + angleDelta(current, target) * rate;
}

function turnAwayFromWall(f: Fish, normalX: number, normalY: number): void {
  const vx = Math.cos(f.heading);
  const vy = Math.sin(f.heading);
  if (vx * normalX + vy * normalY >= 0) return;
  const tangentSign = Math.random() < 0.5 ? -1 : 1;
  const tangentX = -normalY * tangentSign;
  const tangentY = normalX * tangentSign;
  f.heading = Math.atan2(normalY * 0.9 + tangentY * 0.35, normalX * 0.9 + tangentX * 0.35);
}

function updatePhysics(dt: number): void {
  const margin = 100;

  // Steering weights — kept small so the school feels loose, not tight.
  const sepGain = 1.7;
  const wallGain = 2.0;
  const alignGain = 0.55;
  const cohesionGain = 0.35;
  const boxGain = 3.5; // text rect is a strong repeller, but smooth

  // Neighborhood radii in units of "fish length pairs."
  const sepRadiusFactor = 0.65;
  const flockRadiusFactor = 2.4;
  const wanderRate = 0.5;

  for (let i = 0; i < fish.length; i++) {
    const f = fish[i];
    const lenF = bodyLengthPx(f.koi);

    // Wall avoidance: pull a desired-direction vector inward when near edges.
    const distL = f.pos.x;
    const distR = W - f.pos.x;
    const distT = f.pos.y;
    const distB = H - f.pos.y;
    let wallX = 0;
    let wallY = 0;
    if (distL < margin + lenF) wallX += (margin + lenF - distL) / margin;
    if (distR < margin + lenF) wallX -= (margin + lenF - distR) / margin;
    if (distT < margin + lenF) wallY += (margin + lenF - distT) / margin;
    if (distB < margin + lenF) wallY -= (margin + lenF - distB) / margin;

    // Flocking sums.
    let sepX = 0;
    let sepY = 0;
    let alignVX = 0;
    let alignVY = 0;
    let alignCount = 0;
    let cohX = 0;
    let cohY = 0;
    let cohCount = 0;

    for (let j = 0; j < fish.length; j++) {
      if (j === i) continue;
      const g = fish[j];
      const lenG = bodyLengthPx(g.koi);
      const pairLen = lenF + lenG;
      const dx = f.pos.x - g.pos.x;
      const dy = f.pos.y - g.pos.y;
      const dist = Math.hypot(dx, dy);

      const sepR = pairLen * sepRadiusFactor;
      if (dist > 0 && dist < sepR) {
        const w = (sepR - dist) / sepR;
        sepX += (dx / dist) * w;
        sepY += (dy / dist) * w;
      }

      const flockR = pairLen * flockRadiusFactor;
      if (dist > 0 && dist < flockR) {
        alignVX += Math.cos(g.heading);
        alignVY += Math.sin(g.heading);
        alignCount++;
        cohX += g.pos.x;
        cohY += g.pos.y;
        cohCount++;
      }
    }

    // Text-box repulsion: smoothly steer around the content rect when close,
    // and push out if the fish ends up inside. Force is computed against the
    // nearest point on the (margin-expanded) rect so behavior is continuous
    // along edges and corners — no abrupt turn-around.
    let boxX = 0;
    let boxY = 0;
    if (contentRect) {
      const pad = 12 + lenF * 0.25;
      const rL = contentRect.left - pad;
      const rR = contentRect.right + pad;
      const rT = contentRect.top - pad;
      const rB = contentRect.bottom + pad;
      const influence = lenF * 1.4;

      // Closest point on the rect to the fish (clamped).
      const cx = Math.max(rL, Math.min(rR, f.pos.x));
      const cy = Math.max(rT, Math.min(rB, f.pos.y));
      let dx = f.pos.x - cx;
      let dy = f.pos.y - cy;
      let dist = Math.hypot(dx, dy);

      if (dist < 0.001) {
        // Inside — synthesize an outward direction toward the nearest edge.
        const dL = f.pos.x - rL;
        const dR = rR - f.pos.x;
        const dT = f.pos.y - rT;
        const dB = rB - f.pos.y;
        const minD = Math.min(dL, dR, dT, dB);
        if (minD === dL) { dx = -1; dy = 0; }
        else if (minD === dR) { dx = 1; dy = 0; }
        else if (minD === dT) { dx = 0; dy = -1; }
        else { dx = 0; dy = 1; }
        dist = 1;
        // Nudge out of the rect so the fish doesn't sit stuck inside.
        f.pos.x += dx * 2;
        f.pos.y += dy * 2;
        boxX = dx;
        boxY = dy;
      } else if (dist < influence) {
        const w = (influence - dist) / influence;
        boxX = (dx / dist) * w;
        boxY = (dy / dist) * w;
      }
    }

    // Compose a single desired-direction vector from all forces.
    let desiredX = wallX * wallGain + sepX * sepGain + boxX * boxGain;
    let desiredY = wallY * wallGain + sepY * sepGain + boxY * boxGain;

    if (alignCount > 0) {
      const avgHX = alignVX / alignCount;
      const avgHY = alignVY / alignCount;
      desiredX += avgHX * alignGain;
      desiredY += avgHY * alignGain;
    }
    if (cohCount > 0) {
      const ax = cohX / cohCount;
      const ay = cohY / cohCount;
      const tx = ax - f.pos.x;
      const ty = ay - f.pos.y;
      const tl = Math.hypot(tx, ty) || 1;
      desiredX += (tx / tl) * cohesionGain;
      desiredY += (ty / tl) * cohesionGain;
    }

    const desiredMag = Math.hypot(desiredX, desiredY);
    if (desiredMag > 0.01) {
      const target = Math.atan2(desiredY, desiredX);
      f.heading = steerToward(f.heading, target, Math.min(1, desiredMag) * dt * 4.0);
    }

    // Light random wander so headings don't lock into a single line.
    f.heading += (Math.random() - 0.5) * wanderRate * dt;

    // Integrate position.
    f.pos.x += Math.cos(f.heading) * f.speed * dt;
    f.pos.y += Math.sin(f.heading) * f.speed * dt;

    // Hard clamp safety: if the steering wasn't enough to keep the fish out
    // of the text rect this frame, snap to the nearest edge so it can never
    // visually swim under the text.
    if (contentRect) {
      const pad = 12 + lenF * 0.25;
      const rL = contentRect.left - pad;
      const rR = contentRect.right + pad;
      const rT = contentRect.top - pad;
      const rB = contentRect.bottom + pad;
      if (f.pos.x > rL && f.pos.x < rR && f.pos.y > rT && f.pos.y < rB) {
        const dL = f.pos.x - rL;
        const dR = rR - f.pos.x;
        const dT = f.pos.y - rT;
        const dB = rB - f.pos.y;
        const minD = Math.min(dL, dR, dT, dB);
        if (minD === dL) f.pos.x = rL;
        else if (minD === dR) f.pos.x = rR;
        else if (minD === dT) f.pos.y = rT;
        else f.pos.y = rB;
      }
    }

    // Keep the *entire* fish body on screen, not just the centroid.
    const screenPad = lenF * 0.5;
    if (f.pos.x < screenPad) {
      f.pos.x = screenPad;
      turnAwayFromWall(f, 1, 0);
    }
    if (f.pos.x > W - screenPad) {
      f.pos.x = W - screenPad;
      turnAwayFromWall(f, -1, 0);
    }
    if (f.pos.y < screenPad) {
      f.pos.y = screenPad;
      turnAwayFromWall(f, 0, 1);
    }
    if (f.pos.y > H - screenPad) {
      f.pos.y = H - screenPad;
      turnAwayFromWall(f, 0, -1);
    }
  }
}

let lastTime = performance.now();
function frame(now: number): void {
  if (W === 0 || H === 0) {
    requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  const time = now / 1000;

  updatePhysics(dt);

  clearScene(ctx, W, H);
  for (const f of fish) {
    f.prevWhiskers = renderKoi(ctx, f.koi, f.pos.x, f.pos.y, f.heading, time, f.prevWhiskers);
  }
  requestAnimationFrame(frame);
}

resize(true);
recordUniqueVisitor();
void initializePond();
lastTime = performance.now();
requestAnimationFrame(frame);
