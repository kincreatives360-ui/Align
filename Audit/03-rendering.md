# 03 — Rendering & Effects Pipeline Audit (AlignCanvas)

**Scope of this document.** Rendering stack, frame loop, effect pipeline, shader programs, face/flare modules, media handling, export, and performance characteristics of the captured `aligncanvas.com` editor.

**Files read in full:** `js/engine.js` (308 lines), `js/renderer.js` (288), `js/shaders.js` (508), `js/faces.js` (387), `js/flare.js` (118), `js/media.js` (95), `js/export.js` (120), `js/math.js` (104). Supporting context was pulled from `js/main.js`, `js/state.js`, `js/ui.js`, `js/config.js`, `js/account.js`, `js/templates.js` where those files define the frame loop, `BASE_STYLE`, and export limits.

---

## 0. The one-paragraph version (for non-programmers)

Everything you see in the preview is painted by **WebGL2**, a technology that lets a web page draw with the computer's graphics chip. There is no "object list" that stays alive between frames: for every frame, a plain JavaScript function (`buildFrame`) reads the current project settings plus a single number — **the time T in seconds** — and produces a *description* of that one frame (background settings, camera position, a list of cards with positions, which picture each card shows, shadow/glass/blur values, and post-processing values). The renderer turns that description into pixels in two steps: (1) paint the background and all cards into an off-screen image, (2) run one full-screen "finishing" pass over that image that applies the liquid-glass edges, the floating lens, blur, bloom, colour grading, grain, vignette, and finally the text/logo overlay. Because step 1 and 2 are pure functions of `(settings, T)`, the exporter can simply call the same code at `T = 0, 1/fps, 2/fps, …` to get frame-perfect video — the preview and the export are literally the same render function.

```
state + T ──► buildFrame() ──► desc ──► Renderer.render(desc)
              (engine.js)              ├─ pass A: FS_BG  (fullscreen)  ┐
                                       ├─ per card: FS_SHADOW,         │ into one FBO
                                       │            VS/FS_SIDE,        │ ("scene")
                                       │            VS/FS_CARD         │
                                       ├─ (or) FS_FLARE fullscreen     ┘
                                       └─ pass B: FS_POST (fullscreen) ─► canvas / out FBO
                                                                    ▲
                          labels.png (Canvas2D, engine.syncLabels) ─┘
```

---

## 1. Rendering stack

### 1.1 What technology?

| Layer | Technology | Evidence |
|---|---|---|
| Main scene + post | **WebGL2 only** (`#version 300 es` shaders) | `renderer.js:12` `canvas.getContext('webgl2', …)`; `renderer.js:13` throws `'WebGL2 is not available in this browser.'` — no WebGL1 fallback, no Canvas2D scene path |
| Card faces / demo art / text overlay | **Canvas2D** used as an *asset rasteriser*, then uploaded as textures | `faces.js:333 renderFace()`, `engine.js:263` label canvas |
| Read-back for stills/GIF/sequence | **Canvas2D `ImageData`** produced from `gl.readPixels` | `renderer.js:267–287 snapshot()` |

Context attributes (`renderer.js:12`): `{alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true}`. `preserveDrawingBuffer` is what allows `new VideoFrame(app.canvas, …)` (`export.js:48`) to read the frame after the draw. The renderer also enables `EXT_texture_filter_anisotropic` up to 16× (`renderer.js:16–17`) so photos stay sharp on steeply-turned cards.

### 1.2 Scene-graph model: there isn't one

There is **no persistent scene graph**. Each frame `engine.buildFrame(app, T, W, H, opts)` returns a plain descriptor object (`engine.js:96`):

```js
const desc = {W, H, bg: null, camera: null, cards: [], shadow: null, flare: null, post: null};
```

* `bg` — background mode/colours/phase (`bgDesc`, `engine.js:63–66`)
* `camera` — `{fov, eye, target}` (`engine.js:134`)
* `cards[]` — one entry per card: 4×4 model matrix `m`, size, radius, face textures, opacity, blur, shade, glare, glass, bend, crumple, thickness… (`engine.js:198–210`)
* `shadow` — `{on, alpha, soft, offset, color}` (`engine.js:213`)
* `flare` — only for `kind === 'flare'` templates: two face bundles + uniforms (`engine.js:106`)
* `post` — `{labels, seed, u:{…}}`, the whole post-processing uniform block (`postDesc`, `engine.js:74–91`)

### 1.3 3D camera, matrices, depth

Yes — it is a real 3D perspective pipeline, but with **no depth buffer**; ordering is done on the CPU.

* Projection: `mat4.perspective(cam.fov, W/H, .05, 200)` (`renderer.js:208`, matrix built in `math.js:50–54`).
* View: `lookAt(cam.eye, cam.target, up)` (`renderer.js:209`, `math.js:88–94`).
* `gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);` (`renderer.js:177`) — **painter's algorithm only**: cards are sorted back-to-front by view-space z plus an optional per-card `zBias`:

```js
// renderer.js:212–216
const list = desc.cards.filter(c => c.opacity > .002).map(c => {
  const m = c.m || mat4.model(...);
  const w = mat4.transform(view, c.x, c.y, c.z);
  return {c, m, depth: w[2] + (c.zBias || 0)};
}).sort((a, b) => a.depth - b.depth);
```

* Camera motion is composed in `buildFrame` (`engine.js:117–134`): template `t.camera(P, E)` gives a base eye/target, then global `style.camera` zoom / orbit / tilt / drift are applied to the eye-target vector, with an aspect-fit correction (`engine.js:125`) that zooms out when the output aspect is narrower than the template's design frame.
* Model matrices are column-major `Float32Array(16)` (`math.js:48–80`), matching GLSL.

### 1.4 Who owns what

| File | Owns | Does **not** own |
|---|---|---|
| `engine.js` | Time → frame *description*: clip/loop timing, layout maths, camera, per-card transform stack (pose, pan, wave, stagger, bend, tilt, spin, anim-in, displacement), depth-of-field distance, label/title/logo rasterisation (`syncLabels`), background & post uniform packing (`postDesc`) | Any GL calls |
| `renderer.js` | The WebGL2 context, shader programs, VAOs, texture/FBO caches, face texture cache + eviction, video texture sync, depth sorting, all draw calls, snapshot read-back | Anything about *what* the frame contains |
| `shaders.js` | All GLSL (6 programs) | — |
| `main.js` | The rAF loop, playhead `T`, preview sizing/DPR, export orchestration, thumbnails | — |
| `math.js` | `mat4`, `lookAt`, easing, `hash`/`mulberry` deterministic RNG, colour helpers | — |

### 1.5 Draw-call inventory per frame

| Program | Geometry | Drawn when | Count |
|---|---|---|---|
| `bg` | fullscreen triangle (`renderer.js:23–26`) | when `!bg.transparent` | 1 |
| `shadow` | shared 40×16 grid mesh (`renderer.js:28–36`, 6400 tris… `meshCount = 40*16*6 = 3840` indices) | per visible card, if `shadow.on && alpha>0` | ≤ N |
| `side` | 128-segment outline strip (`renderer.js:38–43`) | per card with `thick > 0` (edge walls drawn first, front/back face on top) | ≤ N |
| `card` | same 40×16 grid | every card | N |
| `flare` | fullscreen triangle | flare templates instead of all of the above | 1 |
| `post` | fullscreen triangle | always, last | 1 |

The 40×16 grid exists so cards can **bend** smoothly (cylinders/rings) — vertex-shader deformation (`BEND`, `shaders.js:97–109`) rather than tessellating per-card meshes. There is **no instancing and no batching**: one `drawElements` per card per pass.

---

## 2. Frame loop

### 2.1 Where time comes from

`main.js:612–625`:

```js
loop(now){
  const dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
  if (!this.exporting){
    if (this.playing){ this.T += dt; this.dirty = true; }
    const len = clipLength(this.state);
    if (this.T >= len) this.T = this.T % len;
    this.syncVideos();
    if (this.dirty){ this.draw(this.T); this.dirty = false; this.updateTimeline(); }
    this.thumbTick(now);
    this.perf(now, dt);
  }
  requestAnimationFrame(t => this.loop(t));
}
```

* Started once at `main.js:97` (`requestAnimationFrame(t => this.loop(t))`), re-armed every frame (`main.js:624`) — an unconditional rAF chain, but **drawing is gated by a `dirty` flag**: paused/idle frames cost nothing but bookkeeping.
* Playhead `this.T` (seconds) advances by wall-clock `dt` (clamped to 100 ms so a backgrounded tab doesn't jump), wraps at `clipLength(state)`.
* Scrubbing/keyboard set `T` directly (`main.js:706`, `749–751`).
* `draw(T)` (`main.js:591–596`): `buildFrame → syncLabels → renderer.render(desc)`.

### 2.2 Loop length, clip length, seamless export

* `loopLength(state)` (`engine.js:25–29`) = one template loop in seconds (`templates.duration(t, P)` — `step` templates use `perCard × count`, others `t.dur`), divided by `speed`.
* `clipInfo(state)` (`engine.js:32–37`): the export/preview clip is `export.duration` (0 ⇒ exactly one loop). With `export.seamless` on, a whole number of loops is fitted to the clip by **time-scaling**: `rate = loops*loop/clip`, applied at `engine.js:98` (`T = T * opts.rate`). The UI shows this ("Motion runs at 1.17× so 2 loops fit exactly", `ui.js:590`).

### 2.3 Determinism (this is what makes export correct)

`buildFrame(app, T, W, H, opts)` is **a pure function of `(state, T, W, H, opts)` plus which media elements exist**:

* All randomness is seeded: `hash(i+1, k+7, seed)` with `seed = state.media.seed` (`engine.js:122`), `mulberry(seed)` for scatter order (`engine.js:58`), `faces.js` art uses fixed seeds.
* Grain seed is derived from time: `seed: Math.floor(T * 60) % 997` (`engine.js:79`) — same T ⇒ same grain.
* Text/logo animation `animAt(st, T)` (`engine.js:246–252`) is a closed-form function of T (quantised to 1/400 and cached by a JSON key in `syncLabels`, `engine.js:259–262`).
* No `performance.now()`, no unseeded randomness, no accumulation of state inside the render path (the only mutable render-path state is *caches*: face textures, FBOs, label key).

**The one non-deterministic input is video frames**, and the export path solves it explicitly: `app.prepareFrame(T)` (`main.js:561–565`) pauses and seeks every video to `videoTime(v, T)` and waits for `seeked` (helper `seekVideo`, `media.js:42–51`), then sets `renderer.exact = true` so blur layers refresh every frame instead of being throttled. `export.js:29` calls it before every frame: `const prep = (app, T) => app.prepareFrame?.(T);`.

### 2.4 Preview vs export

| | Preview | Export |
|---|---|---|
| Driver | `requestAnimationFrame` loop, `dt`-based `T` | deterministic `for i in 0..N: T = i/fps` |
| Canvas size | `layout()` (`main.js:576–590`): CSS box × quality factor, **even dimensions** | exact `sizeFor(aspect, res)`; `drawExport` resizes canvas (`main.js:598`) |
| Face texture resolution | `quantRes(... × template.resBoost)` | same × `resBoost: 1.15` (`main.js:599`) |
| Draw function | `app.draw(T)` → `renderer.render(desc)` (to default framebuffer) | `app.drawExport(T,W,H)` → same `render(desc)`; stills via `renderer.snapshot()` (off-screen FBO + `readPixels`) |
| Video | plays natively, nudged back when drifting >0.2 s (`main.js:545–559`) | frame-exact seek per frame, `renderer.exact = true` |
| Frame loop | continues running (`this.exporting` makes `loop()` skip drawing, `main.js:614`) | loop still runs but is inert; export drives everything |
| Throttles | video blur layers refresh ≥90 ms apart (`VIDEO_BLUR_MS`) | every frame (`exact`) |

---

## 3. Effect pipeline — every `BASE_STYLE` group

`BASE_STYLE` is defined at `state.js:6–24`. Below: what each group *does*, and where it is implemented. All shader references are `shaders.js` unless noted.

### 3.0 Summary table

| Group | Defaults (`state.js`) | What it does visually | Implemented in |
|---|---|---|---|
| `card` | radius .06, border 0, aspect auto, back mirror, brightness 1, opacity 1, tint | Corner rounding, white "rim light" edge, back-face colour (mirror vs solid), tint, brightness/opacity | `FS_CARD` (`shaders.js:219–265`); radius via `sdRoundBox` AA; back at `:248`; rim `:264–265` |
| `shadow` | off, alpha .28, soft .16, offset .05 | Soft rounded-rect drop shadow under each card, offset down & behind in world space | `FS_SHADOW` (`:187–197`) + draw at `renderer.js:220–228` |
| `shade` | off, amount .3, glare 1, sweep false | Angle-based edge darkening (cards facing away go darker) + a moving specular glare band across the card | `FS_CARD` `:250–253` (`uShade`) and `:262–263` (`uGlare`, `uGlareP`); glare phase from `engine.js:205` |
| `blur` | off, depth .25, focus 0, edge 0 | **Depth of field** (per-card blur by distance from focus plane) + frame-edge blur | DOF: `engine.js:145,196–197` → `uBlur` → `FS_CARD` mip-layer blend `:209–224`; edge blur: `FS_POST` `:469` (`uEdgeBlur` adds mip LOD) |
| `cardGlass` | off, width .22, refraction .6, dispersion .5 | **Per-card rim refraction**: a bevelled glass slab around each card's own border, with spectral dispersion | `FS_CARD` `:226–246` (`uGlassW/uGlassR/uGlassD`) |
| `glass` | off, per-edge, width .27 … | **"Liquid glass" frame-edge smear**: the whole frame's content is smeared/stretched/bulged toward chosen frame edges, tinted & hazed, with dispersion | `FS_POST` `:396–416` (smear/scale/stretch/lod/haze) + tap loop `:475–492` |
| `lens` | off, glass, pill, … | **Floating glass lens** (or "black hole" swirl) refracting the frame with bevel highlights, tint, magnification, drop shadow | `lensCenter` `engine.js:67–73`; `FS_POST` `:420–467` |
| `bg` | solid, 4 colours, cycles, scale, angle, amt, transparent | Full-screen background; 10 modes | `bgDesc` `engine.js:63–66` → `FS_BG` `:24–91` |
| `fx` | grain 0, vignette 0, bloom 0, chroma 0, contrast 1, saturation 1, exposure 1 | Post colour grade + film effects | `postDesc` `engine.js:87` → `FS_POST` `:468,495–505` |
| `camera` | fov 30, zoom 1, orbit 0, tilt 0, drift 0 | Global perspective / dolly / orbit / tilt / slow drift over the loop | `engine.js:117–134` → `renderer.js:208–210` |
| `title` | off, "Collection", Inter, y .5 | Centred headline over the cards | Canvas2D in `syncLabels` `engine.js:286–291` |
| `labels` | off, 4 corner strings, mark, auto colour | Corner HUD labels (top-left/top-right/bottom-left/bottom-right) + optional logo mark | `engine.js:292–305` |
| `logo` | off, id, pos br, size .14 | Your brand logo image (from IndexedDB) in a corner or centred | `engine.js:277–282` |
| `anim` | off, rise, speed 1 | Animates logo→title→labels in at clip start and out at clip end so loops stay seamless | `animAt` `engine.js:246–252`, `enter()` `engine.js:268–276` |

All three text groups (`title`, `labels`, `logo`) are rasterised into **one Canvas2D canvas** by `syncLabels(app, W, H, T)` (`engine.js:254–307`), uploaded as a texture (`renderer.setLabels`, `renderer.js:159–167`, premultiplied), and composited in the **last** stage of the post pass (`FS_POST:506`) — after grade/vignette/grain, so text is never grainy or vignetted. A JSON key (`engine.js:260`) makes it redraw only when something actually changed.

### 3.1 Deep dive — "liquid glass" edge refraction & dispersion (`glass`)

State (`state.js:13`): `mode: 'per' | 'all'`, per-edge strengths `top/bottom/left/right`, `width`, `refraction` (smear), `curve` (`panel|lens|wave`), `dispersion`, `soften`, `feather`, `highlight`, `bulge`, `stretch`.

`postDesc` (`engine.js:76–83`) packs this into uniforms `uEdge` (vec4), `uEW, uER, uED, uES, uEF, uEH, uEB, uEX, uECurve, uEdgeTint`.

Shader (`FS_POST:396–416`): for each of the four edges, a normalized distance `t0` from the frame border is raised to a curve (`prof()`, `:387–391` — panel = smoothstep-like, lens = `pow(t,1.35)`, wave = adds `sin(along*46)` ripples) and multiplied by the edge strength. That single factor drives five things:

```glsl
smear  += dirs[k] * f * uER * W * 1.25;            // sample offset along the edge normal
stretch+= dirs[k] * W * t0 * (uEX * f / (1. + uEX * f)); // crisp pull of content across the band
if (k < 2) scale.x /= 1. + uEB * f; else scale.y /= 1. + uEB * f;  // bulge (magnify/compress)
lod    += f * uES * 4.5;                           // mip blur = "soften"
haze   += f * f * uEH;                             // white-ish "highlight" haze
```

Then a **jittered multi-tap spectral loop** (`:475–492`) samples the scene 32× (smear) or 3–16× (short dispersion) times. Each tap `d ∈ [-1,1]` is one wavelength: the colour weight is `spec(d)` from `COMMON` (`:14–18`), which is a colour-matching-curve-like function (violet↔red with a small negative lobe) normalised per channel so **white stays white and only edges split into a spectrum**. Jitter uses `ign()` interleaved-gradient noise (`:20`) to avoid banding; smear taps are evenly spaced with a golden-ratio shuffle because per-pixel jitter reads as grain there. Finally `col = mix(col, uEdgeTint, haze)` (`:493`).

### 3.2 Deep dive — `cardGlass` (per-card rim)

`FS_CARD:226–246`. The card's own SDF `d = sdRoundBox(vLocal, halfSize, radius)` defines a bevel band of width `bw = uGlassW * min(hs)`. Inside the band:

* `t = clamp(1 + d/bw, 0, 1)` climbs toward the rim; `bev = t²(.35+.65t)`.
* The bevel normal `n` is the SDF gradient; the sample offset is `off = -n * bev * uGlassR * bw / size`.
* Dispersion: `D = off * uGlassD`; if the colour spread exceeds ~0.5 px, 3–10 spectral taps (`spec(dd)`, jittered by `ign`) are accumulated (`:239–243`) — each colour channel sees the scene shifted by a different amount, giving the rainbow fringe; otherwise a single tap.
* `layG()` (`:216`) samples the sharp layer with `textureGrad` so the jittered taps don't accidentally pull a coarse mip (keeps the card face crisp under refraction).
* A Fresnel-ish rim sheen `pow(t,4)` (`:246`).

This is applied **per card before compositing**, i.e. it refracts the card's own picture, not the background behind it.

### 3.3 Deep dive — the `lens` (floating glass / black hole)

Position: `lensCenter(L, p)` (`engine.js:67–73`) applies the motion mode (`static|drift|sweep|orbit`, sinusoidal in loop phase `p`) and flips y (`[x, 1-y]`). Uniforms packed at `engine.js:84–86`: `uLensOn, uLensMode (glass=0/hole=1), uLensC, uLensS, uLensR, uLensRef, uLensFrost, uLensDisp, uLensBevel, uLensHi, uLensMag, uLensShadow, uLensTint, uLensTintA`.

**Glass mode** (`FS_POST:434–466`):
* SDF of a rounded box (`sdRoundBox`) with radius from `shape` (pill/circle/squircle → `engine.js:77`).
* Only pixels within 1 px of the surface do work. Bevel profile: `u = clamp(e/bw,0,1)`, `q = 1-u`, circular slope `q/sqrt(1-q²)` capped at 14 → a 3D normal `N = normalize(vec3(n2*slope, 1))`.
* **Real refraction**: `refract(vec3(0,0,-1), N, 1/1.5)` gives `bend`; per-colour offsets `offG = bend - p*uLensMag`, `offR/offB = offG ± bend*.4*uLensDisp` → chromatic dispersion zero on the flat top, widest where the bevel bends (`:449–452`).
* Frost adds mip LOD (`uLensFrost*4`), highlights come from a Blinn-Phong `spec = pow(...,80)` plus rim-top and inner-rim terms (`:456–459`), Fresnel `pow(1-N.z, 2.2)`.
* Outside the lens: a soft drop shadow `lensShade` (`:463–464`).
* Tint mixes in at `:494`.

**Hole mode** ("black hole", `uLensMode == 1`, `:424–433`): a rotational warp — `ang = uLensRef*4*k²`, `mat2` rotation of the sample point with a `1-.35k²` radial squeeze, i.e. a swirl with magnification loss, plus frost LOD and a warm highlight ring.

### 3.4 Deep dive — depth-of-field `blur`

Three independent controls:

1. **Depth blur** (`blur.depth`, `blur.focus`): in `buildFrame`, `focusDist = hypot(eye−target) + focus` (`engine.js:145`) and per card
   `dBlur = blur.depth * |dist − focusDist| * .45` (`engine.js:196–197`) where `dist` is eye→card-centre distance. Result is clamped to 0..1 and passed as `uBlur`.
   In `FS_CARD`, `lv = uBlur * 3` selects a blend across **four pre-blurred copies of the card face** (`lay()`, `:209–214`): texture0 = sharp (mipped), textures 1–3 = Gaussian layers at increasing radius. So DOF is *not* a screen-space blur — each card carries its own blur pyramid (built on the CPU by `faces.faceLayers`, see §5).
2. **Edge blur** (`blur.edge`): `uEdgeBlur` in `FS_POST:469` raises the mip LOD toward the frame border (`lod += uEdgeBlur*6*smoothstep(.45,1,max(c.x,c.y))`) — a cheap radial defocus of the *whole* frame.
3. **Animation blur** (separate): cards arriving in the "anim in" phase get `blur0 += q*.5` (`engine.js:175`).

### 3.5 Background modes (`bg`)

`BG_MODES` (`engine.js:9`), all rendered by `FS_BG` as one fullscreen pass with `uPhase/uCycles/uScale/uAngle/uAmt` and colours `uC0..uC3`. Everything is **periodic in phase** so it loops seamlessly (`A = TAU*uPhase*uCycles`, `:39`).

| Key | Id | Shader branch | Visual |
|---|---|---|---|
| `solid` | 0 | default `c = uC0` (`:40`) | flat colour |
| `linear` | 1 | `:41` | two-stop gradient along `uAngle` |
| `radial` | 2 | `:42` | radial gradient from `uC1` at `(0,.55)` |
| `mesh` | 3 | `:43–52` | weighted sum of 3 orbiting Gaussian blobs (`uC1..uC3`) over base — classic mesh gradient |
| `aurora` | 4 | `:53–62` | 3 sinuous luminous bands (`uC1..uC3`) with `uAmt` intensity, darkened toward the bottom |
| `grid` | 5 | `:63–73` | cell grid lines (cell size scaled by `uScale` and output height), radial fade |
| `dots` | 6 | `:63–73` | dot matrix, same block |
| `holo` | 7 | `:74–78` | holographic rainbow (`hue()` from COMMON) mixed 55% over base |
| `spotlight` | 8 | `:79–83` | light cone from the top + floor glow |
| `plasma` | 9 | `:84–88` | 3 layered `wave()` noise fields thresholded into 3 colours |

`bg.transparent` (`state.js:15`) skips the bg draw entirely (`renderer.js:181`) and makes the post pass output real alpha (`uAlphaOut`, `FS_POST:507`) — used for transparent PNG/WebP/sequence export. A ±1/255 dither is added at `:89` to kill banding.

### 3.6 Post FX (`fx`) — order of operations inside `FS_POST`

Exact order (lines are `shaders.js`):

1. Edge-glass sampling offsets + LOD/haze (§3.1) — `:396–418`
2. Lens warp / refraction / tint (§3.3) — `:420–467`
3. Global chromatic aberration: `ca = (uv-.5)*uChroma*.012` folded into the tap direction `D` — `:468`
4. Edge blur LOD — `:469`
5. Spectral tap loop (or single tap) producing `col` — `:475–492`
6. Edge haze tint, lens tint/shade/highlight composite — `:493–494`
7. **Bloom** — `:495–498`: `col += (max(textureLod(scene, uv, 3) − .55, 0)*.7 + max(textureLod(scene, uv, 5) − .45, 0)*.9) * uBloom` — a two-tap mip-chain bloom, *no separate blur pass*
8. **Exposure** `col *= uExposure` — `:499`
9. **Contrast** `(col−.5)*uContrast + .5` — `:500`
10. **Saturation** luma-mix — `:501–502`
11. **Vignette** radial `smoothstep(.3,1.05, …)` — `:503–504`
12. **Grain** `(hash12(gl_FragCoord + uSeed*17.31) − .5)*uGrain*.16` — `:505`
13. **Label/logo/title composite** — `:506` (alpha-premultiplied over)
14. Output with/without alpha — `:507`

Grain, vignette, bloom, chroma, contrast, saturation, exposure are all packed by `postDesc` (`engine.js:87`) and uploaded wholesale by `for (const k in p.u) this.u(P, k, p.u[k])` (`renderer.js:202`).

### 3.7 `camera` group

Covered in §1.3. Note the interaction with templates: `t.fov` is the template's base (`baseFov`), `style.camera.fov` (10–75°) scales it (`engine.js:119`); `zoom` scales the eye-target vector, `orbit`/`tilt` rotate it, `drift` adds a sinusoidal wobble per loop phase (`engine.js:129–133`).

---

## 4. `shaders.js` — programs, passes, composition

### 4.1 Programs (all GLSL ES 3.00)

| Key in `renderer.progs` | Vertex | Fragment | Purpose |
|---|---|---|---|
| `bg` | `VS_FULL` (`:4–5`) | `FS_BG` (`:24–91`) | fullscreen background |
| `card` | `VS_CARD` (`:110–143`) | `FS_CARD` (`:199–268`) | card face (bend, crumple, glass, shade, glare, tint) |
| `shadow` | `VS_CARD` | `FS_SHADOW` (`:187–197`) | rounded-rect soft shadow (uses `vLocal`, `uExpand` to inflate the quad) |
| `flare` | `VS_FULL` | `FS_FLARE` (`:271–370`) | Flare Duo transition |
| `post` | `VS_FULL` | `FS_POST` (`:373–508`) | all finishing |
| `side` | `VS_SIDE` (`:146–173`) | `FS_SIDE` (`:174–186`) | thick-card edge walls, camera-lit |

Shared chunks: `COMMON` (`:7–21`) = `sdRoundBox`, `hash12`, `hue`, `spec` (dispersion weights), `ign` (interleaved gradient noise); `BEND` (`:97–109`) = cylindrical bend used by both card and side vertex shaders.

### 4.2 Pass graph (per `Renderer.render(desc, out)`, `renderer.js:171–205`)

```
1. syncVideos(desc)                       — refresh changed video face textures
2. bind FBO target('scene' | 'scene-WxH')  (cached by name+size, RGBA8, mipmapped)
3. clear to (0,0,0,0), blending off
4. FS_BG fullscreen  (skipped if bg.transparent)
5. blending ON: blendFunc(ONE, ONE_MINUS_SRC_ALPHA)   ← premultiplied alpha
6. drawFlare(desc)   OR   drawCards(desc)  (shadow → side → card, depth-sorted)
7. gl.generateMipmap(scene.tex)            ← the scene gets a full mip pyramid
8. bind output FBO (or null = canvas), blending OFF
9. FS_POST fullscreen: uScene=unit0, uLabel=unit1, + postDesc uniforms
```

**There is no ping-pong / no multi-FBO chain.** Exactly two render targets exist per resolution: `scene` and the output. All "blur" comes from (a) the four CPU-built face layers selected by `uBlur`, and (b) `textureLod` reads off the scene's own mip pyramid (edge blur, lens frost, bloom). This is a deliberate, cheap design: it costs one `generateMipmap` per frame instead of 5–10 separable blur passes.

### 4.3 Uniform plumbing

* `renderer.u(prog, name, v)` (`renderer.js:63–74`) — polymorphic setter: number → `uniform1f`, `{i:n}` → `uniform1i`, length-16 → `uniformMatrix4fv`, else `uniform2/3/4fv`. Locations cached in `prog.loc`.
* Per-card uniforms are set inline in the card loop (`renderer.js:242–251`): `uT0..uT3`, `uModel`, `uVP`, `uCam`, `uSize`, `uExpand`, `uBend/uBendY/uOff`, `uRadius`, `uOpacity`, `uBlur`, `uShade`, `uBorder`, `uGlare/uGlareP`, `uBackMix/uBackCol`, `uBright`, `uTint/uTintA`, `uGlassW/R/D`, `uCrumple/uCrSeed`.
* Post uniforms arrive as a flat object from `postDesc` and are bulk-uploaded (`renderer.js:202`).
* Flare uniforms likewise (`renderer.js:263`) plus 8 textures bound to units 0–7 (`:259–261`).

### 4.4 Notable shader techniques (for a rebuild)

* **SDF-based rounded rects** everywhere (card alpha, shadow, side outline, lens) with `fwidth`-based analytic AA (`FS_CARD:219–222`).
* **Vertex deformation**: cylindrical bend (`BEND`), crumple (`crumple()`, `:119–131` — triangle-wave creases + spherical "ball" wrap, lit by screen-space normals `cross(dFdx(vW),dFdy(vW))` at `:256`).
* **Back faces**: `gl_FrontFacing` flips the normal and mixes in `uBackCol` (`:248`); `uBackMix` = 0 for solid, 1 for "mirror" (the same face, darkened 50%).
* **Thick cards**: `VS_SIDE` walks a 128-step outline (24 steps per side + 8 per corner) from front to back (`:155–167`), lit by camera + top light (`FS_SIDE:181–185`).
* **Chromatic dispersion everywhere** is spectral-tap accumulation weighted by `spec(d)` — this is the signature look of the whole product (edge glass, card glass, lens, flare split).

---

## 5. `faces.js` and `flare.js`

### 5.1 `faces.js` — what a card shows, plus its blur pyramid

Two responsibilities:

**(a) Procedural demo content.** `MEDIA_SETS` (`faces.js:313–323`) maps a set name → `{count, draw(ctx,i,w,h), aspect}`. Each `draw*` paints a Canvas2D image: `drawLogo` (16 geometric `MARKS`), `drawWordmark` (8 fake wordmarks), `drawGradient`, `drawScenery`, `drawUI` (10 dashboard mock-ups), `drawPoster`, `drawPayCard`, `drawShape`, and `drawPhoto` (the 10 bundled JPEGs loaded by `loadPhotos()` from `../media/photo-NN.jpg`, `:298–311`). `FONTS_TO_LOAD` (`:324–325`) lists every font string these painters need; `main.js:70–71` preloads them (racing a 2.5 s timeout).

**(b) Face → texture pipeline.**

| Function | Line | Role |
|---|---|---|
| `faceSize(aspect, res)` | 329 | longest side = `res` |
| `renderFace(item, aspect, res)` | 333 | creates a canvas, `paintFace`s it |
| `paintFace(c, item)` | 340 | draws image/video (cover) or the procedural set — also used to repaint video faces in place |
| `BLUR_FRACS` | 346 | `[.008, .024, .064]` of the longer side |
| `blurLayer(face, sigma, scale)` | 347 | downscales (1/2, 1/4, 1/8), pads by edge-clamped pixels, then Canvas2D `filter: blur(σ)` (fallback: 3× down/up-sample trick if `filter` unsupported, `:360–366`) |
| `faceLayers(face)` | 370 | returns the 3 blurred layers |
| `analyse(face)` | 375 | 12×12 average + "most colourful" accent (stored on the cache entry as `info`; currently only `renderer.js:100` writes it — no consumer found) |

`Renderer.face(item, key, aspect, res)` (`renderer.js:92–107`) is the cache: key = `` `${key}|${aspect}|${res}` ``, value = **4 GL textures** (index 0 = sharp with mips + anisotropy, 1–3 = blur layers, no mips). Cache cap 160, `evict()` deletes the 40 least-recently-used (`:137–140`); `dropFaces(prefix)` deletes by key prefix (used by `App.forget`, `main.js:150`).

**Video faces** are capped at `VIDEO_MAX = 1024` px (`renderer.js:7,94`), tracked in `this.live`, and repainted in place via `update()` → `texSubImage2D` when `video._ver` changes (`:112–129`); their three blur layers are rebuilt at most every `VIDEO_BLUR_MS = 90` ms in preview, but every frame when `renderer.exact` (export).

### 5.2 `flare.js` — the "Flare Duo" transition template

`flare.js` is **not** a generic effect — it is the motion model for one special template kind (`t.kind === 'flare'`, handled as an early-out branch of `buildFrame` at `engine.js:100–109`): two cards at a time, where a glass edge "flares" across the screen as one card hands over to the next (like a liquid-glass wipe).

* **Traced reference motion**: `REF_PX` (`flare.js:5–6`) is 39 per-frame positions hand-traced from a reference video at 1600 px wide; `REF` (`:8–16`) differentiates → 3× binomial smoothing → re-integrates → normalises to 0..1. `refCurve` (`:17–21`) is a Catmull-Rom sampler over it. Alternative curves (`sine/cubic/quint/expo/linear`) live in `CURVES` (`:22–29`).
* **`FLARE_PARAMS`** (`:37–60`) is the parameter schema for the template (cards, width, speed, direction, timing: hold/anticipation/sweep/settle, flaring edge: peak/edge/spread/handoff/pinch/rim/edge shadow, lens blur: blur/reach/colour split) with defaults; `flareDefaults(n)` (`:61`) materialises them.
* **Timing**: `segLen = hold+antic+sweep+settle`, `flareDuration = segLen * n` (`:66–67`) — the whole template's loop length.
* **State**: `flareState(P, n, T)` (`:96–102`) → `{a, b, m}` = current card index, next card index, and a motion record from `motionAt()` (`:70–94`: amplitude `ampO/ampN`, spread, blur, rim, `newTop` z-order flag, hand-off `X = sstep(.5−handoff, .5+handoff, pc)`).
* **Geometry**: `flareRect(P, W, H, aspect)` (`:104–107`) → the card's pixel rect.
* **`flareUniforms`** (`:108–118`) → the uniform block for `FS_FLARE`, including `uLv` = blur-layer thresholds from `BLUR_FRACS × cardWidth`.

The **shader** `FS_FLARE` (`shaders.js:271–370`) then draws the whole screen in one pass: two signed-distance shapes (`sdfO`/`sdfN`) describing the old and new cards with a horn-shaped bulge (`horn()`/`profO/profN`) that peaks at the sweep midpoint, spectral `split()` for chromatic fringing, a `BLUR` macro that blends the two cards' 4-layer blur pyramids by distance behind the edge, `rimShade()` glass-rim lighting, border line, drop shadow, and `uNewTop`-controlled compositing order. `FS_FLARE` is drawn **instead of** the card list (renderer `drawFlare`, `renderer.js:256–265`) — still inside the scene buffer, so it still receives the post pass afterwards.

---

## 6. `media.js` — loading, textures, memory

| Concern | Implementation |
|---|---|
| Type detection | `kindOf(f)` by MIME + extension regexes (`VIDEO_EXT`, `IMAGE_EXT`, `:2–5`) |
| Images | `loadImage(url)` → `HTMLImageElement` (`:9–16`); app stores it in `app.images` (`main.js:141–144`) |
| Uploads | `downscale(file, 2400)` (`:67–81`): re-encodes to JPEG 0.92 / PNG unless the original is already <2.5 MB and ≤2400 px — keeps project storage small; blobs live in IndexedDB (via `store.js`), only ids live in state |
| Videos | `loadVideo(url, 15000)` (`:22–38`): muted, looped, `playsinline`, `preload:auto`, appended to a **hidden 2×2 holder div** (`:19–21`) so every browser keeps decoding; a `requestVideoFrameCallback` loop bumps `v._ver` on every presented frame and `seeked` bumps it too (`:35–36`) — this is the freshness signal the renderer uses |
| Video disposal | `dropVideo(v)` (`:39`) pauses, clears `src`, `load()`s (frees the decoder), removes the element — called from `App.forget` (`main.js:148`) |
| Frame-exact seek | `seekVideo(v, t)` (`:42–51`): resolves on `seeked` or a 4 s timeout; `videoTime(v, T)` (`:53`) loops the clip over the video's own duration |
| Poster stills | `poster(v, max=480)` (`:56–63`) → canvas, used for media grid/thumbnails (`main.js:136–137`) |
| Textures | Created only in `Renderer` (`texture()`, `upload()`, `update()`), premultiply flag forced off for card faces (`UNPACK_PREMULTIPLY_ALPHA_WEBGL=false`, `renderer.js:87`) and on for the label canvas (`:163`) |
| Disposal | `Renderer.evict()` (LRU 40), `Renderer.dropFaces(prefix)` (by media id), FBO/texture replaced on resize in `target()` (`renderer.js:144–158`), object URLs revoked in `App.forget` (`main.js:149`) |
| Library | `library()` fetches `media/library/manifest.json` (`:85–95`), tolerant of missing/broken manifest |
| **Gap** | No `webglcontextlost` handler anywhere in the bundle (grep found none), and no explicit dispose on page unload beyond element removal |

---

## 7. `export.js` — exactly how export works

### 7.1 The four export kinds

| Kind | Entry point | Encoder | Output |
|---|---|---|---|
| Video (MP4/WebM) | `exportVideo(app, opts)` `export.js:30–59` | **WebCodecs `VideoEncoder`** + `mp4-muxer@5.1.3` / `webm-muxer@5.0.3` (dynamic import from jsDelivr, `:3–10`) | `Blob` `video/mp4` / `video/webm` |
| GIF | `exportGif(app, opts)` `:61–76` | **`gifenc@1.0.3`** (`GIFEncoder`, `quantize` rgb565, `applyPalette`) | `Blob` `image/gif` |
| PNG sequence | `exportSequence(app, opts)` `:95–107` | `fflate@0.8.2` `zipSync` of `frame_00000.png`… (compression level 0 — already-deflated PNGs) | `Blob` `application/zip` |
| Stills / clipboard | `exportImage` `:85–90`, `copyImage` `:91–94` | `canvas.toBlob` (PNG/JPEG/WebP) | Blob / ClipboardItem |

**No MediaRecorder** anywhere — recording live would not be frame-exact, so everything is offline, frame by frame. `canEncode()` (`:13`) checks `'VideoEncoder' in window && 'VideoFrame' in window` and the UI tells users to use Chrome/Edge/Safari if absent.

### 7.2 Codec selection & bitrate

* `pickConfig(format, W, H, fps, bitrate)` (`:16–24`) walks a preference list — WebM: `vp09.00.51.08 → vp09.00.41.08 → vp09.00.31.08 → vp8`; MP4: `avc1.640034 … avc1.42001f` — returning the first `VideoEncoder.isConfigSupported` hit, with `latencyMode: 'quality'`.
* `bitrateFor(W,H,fps,q) = clamp(W*H*fps*QUALITY[q], 2e6, 150e6)` where `QUALITY = {low:.05, medium:.09, high:.14, max:.22}` (`:12–14`).
* Muxer: `fastStart: 'in-memory'` for MP4 (`:38`), array-buffer target for both.

### 7.3 Frame stepping (the core loop)

```js
// export.js:42–53
const N = Math.max(1, Math.round(duration * fps));
for (let i = 0; i < N; i++){
  if (signal?.aborted){ enc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
  if (failure) throw failure;
  await prep(app, i / fps);                 // seek videos exactly (main.js:561)
  app.drawExport(i / fps, W, H);            // resize canvas, buildFrame(resBoost 1.15), render
  const vf = new VideoFrame(app.canvas, {timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps)});
  enc.encode(vf, {keyFrame: i % (fps * 2) === 0});   // keyframe every 2 s
  vf.close();
  while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));  // backpressure
  if (i % 4 === 0){ onProgress?.(i / N); await tick(); }                    // yield to UI
}
await enc.flush(); muxer.finalize(); return new Blob([muxer.target.buffer], …);
```

GIF/sequence use the same cadence but call `app.snapshot(T, W, H, …)` (off-screen FBO + `readPixels` → `ImageData`, `renderer.js:267–287`) instead of drawing to the visible canvas; progress is yielded every 2 frames. Timestamps are `Math.round(i * 1e6 / fps)` µs, so output is frame-perfect regardless of how long each frame takes — the file comment says exactly this (`export.js:1–2`).

`app.snapshot()` (`main.js:603–611`) temporarily forces `bg.transparent` on/off per the `opaque`/`transparent` option, renders, then restores the flag.

### 7.4 Settings, resolution, fps, quality — where the limits live

**Settings live in state** (`state.js:71`):

```js
export: {kind:'video', format:'mp4', res:1080, fps:60, quality:'high', duration:0, seamless:true,
         img:'png', scale:2160, transparent:false, gifWidth:640, gifFps:25, gifColors:256, seqFps:30}
```

**UI option sets** (`ui.js`): `RES = {480,720,1080,1440,2160}` (`:564`), `IMG_RES = {1080,1440,2160,3240,4320}` (`:565`), fps `{24,30,60,120}` (GIF `{15,20,25,50}`, sequence `{12,24,30,60}`) (`:587`, `:624`), quality `{low,medium,high,max}` (`:604`), GIF width `{320…1080}` (`:600`), duration slider 0.5–60 s with 0 = "auto = one loop" (`:583–585`). Output pixel size = `sizeFor(aspect, res)` (`engine.js:15–19`, always even dimensions).

**Plan limits** (`config.js:29–32` + `account.js:41–46`):

| Constant | Value | Enforced by |
|---|---|---|
| `FREE_MAX` | 1080 (video) | `canExportSize` — `main.js:868`, clamped in UI at `ui.js:570` |
| `FREE_IMG_MAX` | 1440 (stills) | `canExportStill` — `main.js:869`, `ui.js:572` |
| `FREE_FPS` | 30 | `canUseFps` — `main.js:870`, `ui.js:571` |
| `FREE_EXPORTS` | 5 | `exportsLeft()` — `main.js:865` (server-counted via `useExport()`) |

Also gated behind Pro: image sequences (`main.js:867`), Signature templates (`:866`), text/logo animation (`:871`), logo (`:872`), videos on cards (`:873`). Everything renders **locally** — no server rendering (`ui.js:634`: "Exports render each frame one by one, so they never drop frames").

`runExport()` (`main.js:854–921`) is the orchestrator: entitlement checks → modal with progress bar + `AbortController` → sets `this.exporting = true` (which silences the rAF draw loop) → calls the `export.js` entry → `useExport()` server counter → `download()` (`export.js:111–120`, which uses a claude.ai artifact save hook if present, else an `<a download>` click).

### 7.5 Why preview == export

Both paths call the *same* `buildFrame` + `Renderer.render`. The only deltas are documented in §2.4: canvas size, `resBoost 1.15` on face textures, `renderer.exact` for video blur layers, and the exact video seek. Anything that renders correctly in the preview renders identically in the export at that T.

---

## 8. Performance mechanisms

| Mechanism | Where | Detail |
|---|---|---|
| **Dirty-flag rendering** | `main.js:620` | Draw only when `dirty` (playback sets it each frame; paused UI edits set it on change) |
| **Preview resolution tiers** | `main.js:584–588` | `frame.preview`: `draft` → 0.6× (cap 900 px), `auto` → `min(2, dpr)` (cap 2200), `max` → `dpr*1.25` (cap 3000); canvas forced to even sizes |
| **Quantised face textures** | `engine.js:12–13,147` | `RES_STEPS = [192…3072]`, `quantRes` rounds a *computed on-screen card size* (`max(w,h) * H/2`, i.e. card pixels at z=0 for a 30° camera) up to a step — so editing at 1080p doesn't build 4K textures, but a 4K export does, and cards stay sharp (`resBoost` 1.3 per template, 1.15 for export) |
| **Face texture cache + LRU eviction** | `renderer.js:92–143` | keyed `media\|aspect\|res`, cap **160** entries, evicts 40 oldest (4 GL textures each) |
| **Video texture throttling** | `renderer.js:7,112–129` | face ≤1024 px; main face re-uploads only when `_ver` changes; **blur layers only if actually blurred**, and only every 90 ms in preview (`every frame` when exporting) |
| **FBO reuse** | `renderer.js:144–158` | `target(name,w,h)` caches per name+size; export reuses `scene-WxH`/`snap-WxH` for every frame |
| **Scene mip chain instead of blur passes** | `renderer.js:191`, `FS_POST:495–498` | bloom/edge-blur/frost read `textureLod` — no ping-pong blur buffers |
| **Anisotropic filtering** | `renderer.js:16–17,89` | up to 16× on face textures |
| **Time-sliced thumbnail queue** | `main.js:638–661` | template thumbnails render at 320×256 with `res:192` faces, max **10 ms** of work per rAF tick; hovering a template animates its thumb live |
| **Label rasterisation cache** | `engine.js:253–262` | Canvas2D text redrawn only when a JSON key (values rounded to 1/400) changes |
| **Encoder backpressure** | `export.js:51` | pauses the frame loop when `encodeQueueSize > 6` |
| **Font preloading race** | `main.js:70` | fonts load in parallel with a 2.5 s cap so first paint isn't blocked |
| **Perf telemetry (not adaptive)** | `main.js:841–851` | 10-second average fps is *tracked* for analytics (up to 5 templates/session) — **there is no automatic quality downscaling or frame-rate-based tiering** |
| **Absent** | — | no instancing, no texture atlasing, no batching (one draw per card per pass), no WebGL context-loss recovery, no worker/off-thread rendering, no WebGPU |

---

## 9. Notes for a production rebuild

1. **Keep the two-phase architecture** (pure `buildFrame(state,T)` → descriptor → dumb renderer). It is the single most valuable property: it gives deterministic export, easy testing, and lets you swap WebGL for WebGPU/Canvas without touching motion logic.
2. **The descriptor is the contract.** Freeze it as a typed schema (`{W,H,bg,camera,cards[],shadow,flare,post}`) before writing any renderer.
3. **Dispersion is the signature look.** Budget for 3–32 spectral taps in the post and card shaders; `spec()` + `ign()` jitter + per-channel normalisation is what keeps it smooth rather than "three offset copies".
4. **Blur strategy = pre-baked layers + mip LODs**, not screen-space blur passes. Cheaper, but note its limits: DOF blur can't respond to background detail behind a card (only the card's own image is blurred).
5. **No depth buffer** — if you add real transparency/overlaps, keep the CPU sort (or move to depth-tested order-independent techniques deliberately).
6. **Video determinism must be explicit** (seek-and-wait + `exact` flag) or exports will drift.
7. **Missing hardening** to add in the rebuild: `webglcontextlost/restore`, GPU-memory budgeting (4 textures × up to 160 faces × 4K is a real risk), and an actual adaptive-quality tier (today `perf()` only reports).
8. **Dependency surface to replace or vendor**: `mp4-muxer`, `webm-muxer`, `gifenc`, `fflate` (all loaded from jsDelivr at runtime — a rebuild should bundle them).

---

### Appendix — key exported symbols

| File | Exports (rendering-relevant) |
|---|---|
| `engine.js` | `ASPECTS`, `BG_MODES`, `sizeFor`, `cardAspect`, `loopLength`, `clipInfo`, `clipLength`, `mediaItems`, `buildFrame`, `ANIMS`, `syncLabels`, `resetLabels` |
| `renderer.js` | `class Renderer` — `program`, `u`, `texture`, `upload`, `update`, `face`, `syncVideos`, `evict`, `dropFaces`, `target`, `setLabels`, `bindTex`, `render`, `drawCards`, `drawFlare`, `snapshot` |
| `shaders.js` | `VS_FULL`, `FS_BG`, `VS_CARD`, `FS_CARD`, `FS_SHADOW`, `FS_FLARE`, `FS_POST`, `VS_SIDE`, `FS_SIDE` |
| `faces.js` | `MEDIA_SETS`, `FONTS_TO_LOAD`, `BLUR_FRACS`, `loadPhotos`, `faceSize`, `renderFace`, `paintFace`, `blurLayer`, `faceLayers`, `analyse` |
| `flare.js` | `FLARE_PARAMS`, `flareDefaults`, `flareDuration`, `flareState`, `flareRect`, `flareUniforms` |
| `media.js` | `VIDEO_EXT`, `IMAGE_EXT`, `kindOf`, `isVideo`, `loadImage`, `loadVideo`, `dropVideo`, `seekVideo`, `videoTime`, `poster`, `toBlob`, `downscale`, `libUrl`, `library` |
| `export.js` | `QUALITY`, `canEncode`, `bitrateFor`, `exportVideo`, `exportGif`, `exportImage`, `copyImage`, `exportSequence`, `download` |
| `math.js` | `TAU`, `clamp`, `clamp01`, `lerp`, `fract`, `sstep`, `smoother`, `wrap`, `loopDelta`, `ease`, `EASE_NAMES`, `hash`, `mulberry`, `mat4`, `lookAt`, `hexToRgb`, `rgbToHex`, `luminance`, `mixRgb` |
