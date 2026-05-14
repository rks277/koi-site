# Koi Parameters

A reference for every knob that controls how the fish look and move. Grouped by file. Effective ranges are given so you know how big a change "matters."

---

## Genome — sampled per fish

`src/genome/generate.ts`. Each value is drawn from a deterministic RNG seeded by the fish's seed, so the same seed always produces the same koi.

### Body shape

| Param | Range | What it does |
|---|---|---|
| `bodyLength` | 1.20–1.50 | Length in body-local units. Mostly a scaling knob — the body silhouette is roughly proportional. |
| `bodyThickness` | 0.12–0.16 | Maximum half-width as a fraction of bodyLength. Larger → chubbier fish. The current range gives aspect ratios ≈ 4–6 : 1. |
| `taperStrength` | 0.85–1.15 | How aggressively the peduncle squeezes after t≈0.72. Higher = thinner tail wrist. |
| `headSize` | 0.85–1.10 | Localized bias to the radius profile near t≈0.22. Larger = more pronounced shoulder. |

### Spine

| Param | Range | What it does |
|---|---|---|
| `spineCurvature` | -0.10 – 0.10 | Resting S-curve amplitude. Near zero = straight spine; nonzero = a slight permanent bend. |
| `spineNoise` | 0.0 – 0.04 | Per-control-point random jitter on the y-axis. Adds organic asymmetry. |

### Fins

| Param | Range | What it does |
|---|---|---|
| `pectoralFinSize` | 0.85–1.30 | Length scalar on pectorals only. |
| `pectoralFinSpread` | 0.55–0.90 | Fan-angle factor for pectorals. |
| `tailSize` | 0.85–1.20 | Length scalar on the caudal fan. |
| `tailForkDepth` | 0.20–0.50 | Widens the caudal fan's spread (now that caudal is one centerline fan, this controls how wide the fan opens). |
| `finRoundness` | 0.55–0.85 | Affects per-ray curl and jitter magnitudes. Higher = cleaner/rounder fins. |

### Motion

| Param | Range | What it does |
|---|---|---|
| `swimAmplitude` | 0.06–0.10 | Peak lateral spine displacement at the tail tip, in body-local units. |
| `swimFrequency` | 4.0–5.5 | How fast the traveling wave moves down the spine. Visual swim speed. |
| `bodyStiffness` | 0.55–0.85 | Attenuates wave amplitude — stiffer body = less wiggle. |
| `motionPhase` | 0 – 2π | Per-fish phase offset so fish don't beat in unison. |

### Pigmentation

| Param | Range | What it does |
|---|---|---|
| `markingCount` | 2–6 (int) | Base body-patch count; the tancho spot (if rolled) is added on top. |
| `markingSize` | 0.18–0.36 | Base size scalar; each marking multiplies this by another random 0.55–1.30. |
| `variety` | kohaku, sanke, showa, asagi, utsuri, ogon, platinum | Selects the palette (base color, marking colors). |

### Rendering style

| Param | Range | What it does |
|---|---|---|
| `inkJitter` | 0.4–0.9 | Offset magnitude on the multi-pass body/fin outlines — controls how "shaky" the line work looks. |
| `strokeTaper` | 0.6–1.0 | Scales the final body outline width. |

---

## Body silhouette

`src/morphology/body.ts`.

The radius profile is:
```
tShape = t^0.6
profile = sin(π · tShape)^0.75
```
This gives a pointed snout at t=0, peak around t≈0.28, gentle taper to a near-point at t=1. Then a `headBias` (centered at t≈0.22) and a `peduncleSqueeze` (kicks in past t≈0.72) modulate the profile.

| Param | Default | What it does |
|---|---|---|
| `tShape` exponent | 0.6 | Shifts the peak forward/back. Smaller → peak further forward (more "shoulder near head"). |
| `profile` exponent | 0.75 | Plumpness of the curve. Smaller → fatter midsection. |
| `headBias` window σ | 0.22 | Width of the region where `headSize` matters. |
| `peduncleSqueeze` threshold | t=0.72 | Where the tail-narrowing starts. |
| `bumpDepth` | 0.015 × bodyLength | How far the mouth protrudes forward of the snout. |
| `bumpHalfWidth` | ≈ radius at t≈0.012 × 1.02 | Width of the mouth bump. |

---

## Markings

`src/pigmentation/markings.ts`.

| Param | Default | What it does |
|---|---|---|
| `TANCHO_PROBABILITY` | 0.20 | Chance per fish of getting a uniform red disc on the crown. |
| `TEX_SIZE` | 192 | Resolution of each marking's baked noise texture, in pixels per side. |
| `threshold` (per marking) | 0.15–0.40 | Noise cutoff. **Lower → thicker, more solid clouds. Higher → sparse, patchy speckling.** |
| `noiseFreq` (per marking) | 1.4–4.0 | Pattern scale. Lower freq = bigger, blobbier cloud features; higher freq = finer texture. |
| `size` (per marking) | `markingSize × (0.55–1.30) × 0.65` | Half-extent of the marking in body-length units. |
| `s` (per marking) | 0.22–0.84 | Along-body position. Smaller = more toward the head. |
| `u` (per marking) | -0.8 – 0.8 | Across-body position. Negative/positive = opposite flanks; 0 = centerline. |
| FBM in `bakeMarkingTexture` | 4 octaves, lacunarity 2.0, persistence 0.55 | Standard Perlin FBM. |

The marking texture is **baked once** when the koi is built and **stamped** onto the body each frame via `drawImage` (rotated to match the spine tangent). Per-frame cost is essentially one `drawImage` per marking.

---

## Fins

`src/morphology/fins.ts`. Every fin shares the same builder (`buildFin`) with the following per-spec knobs:

| Param | What it does |
|---|---|
| `attachmentT` | Body t where the fin attaches. |
| `attachSpan` | How wide along the body the attachment is — spreads the rays' bases across this range. |
| `baseSweep` | The center angle of the fan, in radians. 0 = perpendicular to spine (straight out from body). π/2 = straight back. Larger values → fin "slicked back." |
| `spread` | Half-width of the fan in radians. The rays sweep from `baseSweep - spread` to `baseSweep + spread`. |
| `rayCount` | Number of rays. More rays = denser fin. |
| `length` | Ray length in body-local units. |
| `opacity` | Membrane fill alpha (unused now — membrane fill was removed). |
| `lobeFloor` (default 0.72) | Length of outer rays as a fraction of the longest ray. Lower → more dramatic taper, more "veil"-shaped. |
| `lobePower` (default 0.65) | Sharpness of the length envelope. Higher = sharper peak in the middle. |
| `curlBoost` (default 0) | Extra perpendicular bias on each ray's tip — sweeps the fan into a curved shape. |
| `jitter` (default ≈ 0.08–0.14) | Random length variation per ray. |

Current specs (summary):
- **Pectoral**: small fan on each flank, attach at t=0.22, length 0.20 × bodyLength.
- **Pelvic**: small symmetric pair mid-belly at t=0.52, length 0.11.
- **Anal**: single small fin under the rear belly at t=0.68, length 0.09.
- **Dorsal**: centerline fin on the back at t=0.44, `baseSweep: 0.70` (slicked back), `curlBoost: 0.22`, length 0.12.
- **Caudal**: single centerline fan at t=0.96, 15 rays, spread widens with `tailForkDepth`, length 0.34 × bodyLength.

---

## Whiskers

`src/morphology/whiskers.ts`.

Each whisker is a **cubic Bézier** anchored at the corner of the mouth, with **three unconstrained control points** (cp1, cp2, tip). Each control point is sampled independently in `(back, out)` coords — `back` is the along-spine direction, `out` is the perpendicular bow distance.

| Param | Default range | What it does |
|---|---|---|
| `len` | 0.16 × bodyLength | Reference length used to scale the control point coords. |
| `cp1Back` | 0.15–0.55 | First control point's along-direction component. |
| `cp1Out` | 0.30–0.85 | First control point's outward bow. Larger = more aggressive initial swing outward. |
| `cp2Back` | 0.50–0.90 | Second control point's along-direction component. |
| `cp2Out` | 0.05–0.75 | Second control point's outward bow. Lower than cp1 = pulling back inward. |
| `tipBack` | 0.80–1.05 | Tip along-direction position. |
| `tipOut` | -0.15 – 0.30 | Tip perpendicular position. Negative = curls back inward past the centerline of the curve. |
| `SAMPLES` | 24 | Number of points sampled along the Bézier for the rendered polygon. |
| `width` | 13 px | Base width of the rendered shape (tapers to 0 at tip). |

Rendered as a **stroke-only outline** (two splines meeting at a point) clipped to the region *outside* the body silhouette — so the body covers any part of the whisker that would overlap the head.

Per-frame whisker lag (`src/motion/secondaryMotion.ts`) sways each spine point with magnitude scaled by `t` (distance from base), with a critically-damped follow against the previous frame.

---

## Outlines and eyes

`src/render/outline.ts`. All `lineWidth` values are in **CSS pixels** and converted to body-local units via `pxToLocal(ctx, px)`, which divides by the current transform's scale.

| Param | Value | What it does |
|---|---|---|
| `BODY_PASSES` | 3 passes, lineWidth 1.0–1.6 px | Multi-pass wobbly body outline. |
| `FIN_PASSES` | 2 passes, lineWidth 0.7–0.9 px | Fin membrane outline (caudal also outlined now). |
| Fin-ray strokes | lineWidth 0.7 px | Thin curved lines inside each fin. |
| Whisker stroke | lineWidth 1.0 px, color `rgba(60, 45, 35, 0.70)` | Sinuous, semi-transparent. |
| Eye radius | 0.0085 × bodyLength | Tiny soft dot at 90% of the body half-width — reads as a side-eye from the top-down view. |

---

## Noise

`src/rng/noise.ts`.

| Function | What it does |
|---|---|
| `makePerlin2D(rng)` | Classic Perlin noise, output in roughly [-1, 1]. Permutation table built from the koi's noise RNG. |
| `fbm2(noise, x, y, octaves, lacunarity, persistence)` | Sum of `octaves` noise samples at decreasing amplitude. Defaults: 4 octaves, lacunarity 2, persistence 0.5. |

Used by:
- Marking edge displacement and texture baking (`pigmentation/markings.ts`).
- Optionally available elsewhere via `koi.noise2D`.

---

## Multi-fish pond

`src/main.ts`. The "main" page.

| Param | Value | What it does |
|---|---|---|
| `FISH_COUNT` | 6 | How many fish to spawn. |
| `PLACEMENT_TRIES` | 40 | Retries for non-overlapping spawn before falling back. |
| Fish scale | 10–16% of `min(W, H)` | Visual size of each fish. |
| Speed | 22–50 px/sec | Per-fish forward speed. |

### Schooling forces (in `updatePhysics`)

| Param | Value | What it does |
|---|---|---|
| `sepGain` | 1.7 | How hard fish steer away from close neighbors. |
| `wallGain` | 2.0 | How hard they steer away from edges. |
| `alignGain` | 0.55 | How much they match the average heading of nearby fish. Higher = tighter school. |
| `cohesionGain` | 0.35 | How much they drift toward the local centroid. Higher = clumpier. |
| `sepRadiusFactor` | 0.65 | Separation kicks in within (sum of body lengths) × this factor. |
| `flockRadiusFactor` | 2.4 | Alignment and cohesion only consider neighbors within this many pair-lengths. |
| `wanderRate` | 0.5 rad/sec | Std-dev of random heading drift per second. Keeps fish from locking on rigid headings. |
| `margin` | 60 px | Distance from a wall at which avoidance starts. |
| Click hit-test radius | 55% of body length | How close you have to click to a fish's center to count as a hit (which reseeds *just that fish*). |

---

## Dev preview

`src/dev.ts` and `dev.html`. Single fish at screen center, heading = 0 (facing right). Click anywhere to reseed.

The fish scale is `min(W, H) × 0.55` — large because the whole viewport shows one fish.
