# Part 1 — Architecture Audit

**What this document is:** a plain-language breakdown of how the AlignCanvas editor at `aligncanvas.com/create` is built under the hood — its templates, effects, parameters, canvas, layers, timeline and everything else that makes up the app.

**Where it came from:** I read every one of the ~40 source files in the copy you downloaded (`Reference\sites\aligncanvas.com\`). This document is the readable summary. The four forensic deep-dives it is drawn from sit alongside it:

| Deep dive | File | Covers |
|---|---|---|
| Orchestration | `Audit\01-orchestration.md` | Boot order, state flow, undo, saving, export flow, what to remove |
| Templates | `Audit\02-templates.md` | Template shape, parameters, choreography, looping, migration |
| Rendering | `Audit\03-rendering.md` | WebGL, shaders, every effect, media, export, performance |
| UI | `Audit\04-ui.md` | Panels, inspector controls, timeline, interactions, shortcuts |

---

## 1. The one-sentence version

> It is a **browser-only 3D motion editor**: you give it a set of images and a *template* (a recipe for movement), it positions your images as floating cards in 3D space using your graphics chip, paints them with optional glass/blur/shadow effects, and lets you export the result as a video, GIF or still image — **entirely on your own computer, with no server involved in rendering**.

There is no AI, no image generation, no server-side rendering. Rendering happens in your browser.

---

## 2. The single idea that makes the whole app work

Everything in this app rests on one property, and it is worth understanding because every design decision flows from it:

> **One frame = a pure function of (your settings, a time value).**

```
   your settings  +  time T  ───►  buildFrame()  ───►  "frame description"  ───►  Renderer  ───►  pixels
   (the project)                (a pure function)     (a plain list of           (draws it)
                                                          what's where)
```

Give it the same settings and the same moment in time, and it produces the exact same picture every single time. No hidden memory, no "it depends what happened before".

**Why this matters so much:**

- **Export becomes trivial.** To make a 60fps, 5-second video you just ask for time `0, 1/60, 2/60, 3/60…` — 300 frames — and save each one. Frame-perfect, no matter how slow each frame takes to draw. This is exactly what the original does.
- **The preview and the export are literally the same code.** If it looks right on screen, it is right in the file. There is no "it looked fine in the preview" bug class.
- **It's testable.** You can assert "at time 2.4s card 3 should be at x=0.8".
- **The renderer is dumb.** You can swap WebGL for WebGPU later without touching a single line of motion maths.

**Hold onto this.** Almost every good decision in the blueprint in Part 3 exists to protect this property.

---

## 3. The shape of the app

### 3.1 The screen layout

`create.html` is a fixed shell — a header across the top and four columns below:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ header.top   [logo] [project name ▸ save status] [undo][redo] [☀︎|☾] [Export] [?] │
├────┬──────────────┬─────────────────────────────────────┬─────────────────────┤
│ 64 │    292 px    │              stage                  │       316 px        │
│ px │  left panel  │  ┌───────────────────────────────┐  │     right panel     │
│    │              │  │  toolbar (floating)           │  │                     │
│ r  │  Motion ▸    │  │  ┌─────────────────────────┐  │  │   Visual ⇄ Export   │
│ a  │  Templates / │  │  │                         │  │  │                     │
│ i  │  Controls    │  │  │   <canvas>  (WebGL2)    │  │  │   (the inspector)   │
│ l  │              │  │  │   + guides + safe zones │  │  │                     │
│    │  Media       │  │  │                         │  │  │                     │
│ 🎞 │  Text        │  │  └─────────────────────────┘  │  │                     │
│    │  Project     │  │  timeline (floating scrubber) │  │                     │
└────┴──────────────┴──┴──────────────────────────────┴──┴─────────────────────┘
```

- **Rail** (far left, 64px) — four destinations: **Motion**, **Media**, **Text**, **Project**. Clicking one swaps what's in the *left panel*. It never touches the right panel.
- **Left panel** — templates browser / controls, your images, title-labels-logo, project manager.
- **Right panel** — two permanent tabs: **Visual** (the inspector) and **Export**.
- **Stage** — the canvas, with a floating toolbar above it and a floating timeline below it.

Both side panels get completely rebuilt (`innerHTML = ''`, then rebuilt from scratch) whenever something structural changes, with scroll position carefully preserved. This is the original's refresh strategy, and it's a weak point — see §13.

### 3.2 The module map

40 files. Here is what each one is actually for:

**Core (all in scope)**

| Module | Size | What it owns |
|---|---|---|
| `main.js` | 63 KB | The `App` class — owns state, boots the app, binds every global event, runs the frame loop, autosave, export orchestration |
| `state.js` | 9 KB | The project data shape, the default look (`BASE_STYLE`), style presets, save/load/migrate, and the **undo history** |
| `store.js` | 5 KB | IndexedDB — where image/video *files* and saved *projects* live |
| `engine.js` | 21 KB | **Turns (settings, time) into a frame description.** All the motion maths. Touches no graphics code |
| `renderer.js` | 17 KB | WebGL2 — programs, textures, buffers, draw calls, depth sorting, export read-back |
| `shaders.js` | 25 KB | All 6 GPU shader programs (the actual pixel-painting code) |
| `faces.js` | 27 KB | Turns an image into a card texture, plus its 3 pre-blurred copies. Also paints the built-in demo images |
| `media.js` | 5 KB | Loading images/videos, downscaling, seeking video to an exact frame |
| `templates.js` | 128 KB | The template registry: 68 templates + the parameter schema system + shared modifier groups |
| `templates-x/y/z.js` | 97 KB | 98 more templates, split across files for size |
| `choreo-a…j.js` | 145 KB | 40 "choreography" templates — hand-written physical motion |
| `kit.js` | 4 KB | Shared maths helpers every template uses (stepped motion, matrices, param factories) |
| `flare.js` | 7 KB | The one special template kind ("Flare Duo") and its parameters |
| `ui.js` | 54 KB | Every panel and control widget — the whole inspector |
| `export.js` | 7 KB | Video/GIF/sequence/still encoding |
| `math.js` | 6 KB | Matrices, easing curves, seeded random numbers, colour helpers |
| `tour.js` | 5 KB | First-visit guided tour |
| `brand.js` | 4 KB | Brand kit (colours, fonts, logo) |

**Excluded from the rebuild** (detailed in Part 2)

| Module | What it is |
|---|---|
| `account.js`, `auth-ui.js` | Sign-in, accounts, plan limits, Stripe checkout |
| `cloud.js` | Sync projects to a Supabase cloud account |
| `analytics.js`, `_vercel/insights/` | PostHog, Google Analytics, Vercel tracking |
| `config.js` | Supabase keys, payment switches, free-plan limits |

### 3.3 How the pieces talk to each other

**There is no framework, no event bus, and no shared store library.** Just:

1. **One plain object** — `app.state` — is the single source of truth for the project. Exposed as `window.alignCanvas` for debugging.
2. **Direct calls** — a control calls `app.set('style.glass.width', 0.3)`, `app.commit()`, `app.rebuild()`. That's the whole communication system.
3. **Pull for rendering** — `buildFrame(app, T, W, H)` reaches in and *reads* `app.state` itself. The renderer never holds any project state.

```
   UI control ──app.set(path, value)──► app.state ──(next animation frame)──► buildFrame() ──► Renderer
        │                                   │
        └──app.commit()──► history.push()   └──(debounced)──► localStorage + IndexedDB
```

---

## 4. The canvas and rendering

### 4.1 Technology

- **WebGL2 only.** The renderer throws an error if your browser lacks it (Chrome, Edge, Firefox, Safari all have it). There is no fallback.
- **Canvas2D is used only to prepare assets** — drawing an image onto a canvas to make a texture, and painting the text/logo overlay.
- **3D is real** — a perspective camera, a projection matrix, a view matrix. But there is **no depth buffer**; the renderer sorts cards from back to front on the CPU and draws them in that order (a "painter's algorithm"), using transparency blending.

### 4.2 Two passes, not twenty

Each frame is drawn in exactly two steps:

```
PASS A — into an off-screen buffer ("the scene")
   1. fullscreen background
   2. per card: drop shadow  →  thick edge walls  →  the card face
      (drawn back-to-front)
   └─ then build a mip chain (progressively smaller copies) of that buffer

PASS B — one fullscreen "finishing" pass over the scene
   glass edges → lens → chromatic aberration → blur → bloom →
   exposure → contrast → saturation → vignette → grain → text/logo → screen
```

The clever part: **almost every "blur" effect in this app is not a blur pass.** It reads the mip chain built at the end of Pass A — i.e. it blurs by asking the GPU for a smaller version of the image it already has. That costs one `generateMipmap` call instead of the 5–10 separate blur passes a naive implementation would need. This is a genuinely good design decision and we should keep it.

### 4.3 The six shader programs

| Program | Job |
|---|---|
| `bg` | Full-screen background — 10 different modes |
| `shadow` | Soft rounded-rectangle drop shadow behind each card |
| `side` | The visible *thickness* of a card (so it looks like a physical slab) |
| `card` | The card face: rounding, bend, tint, glass rim, shading |
| `flare` | The one special "Flare Duo" template, drawn as a single full-screen effect |
| `post` | Everything in Pass B |

Each card is drawn on a 40×16 grid of triangles (2,400 triangles per card) rather than a flat square — that grid is what lets cards **bend** smoothly into cylinders and rings in the vertex shader.

### 4.4 What the effects actually do

This is the `BASE_STYLE` structure — the 14 groups of settings that define "the look". This table is the most important reference in this document:

| Group | What it does visually | Where |
|---|---|---|
| `card` | Corner rounding, white rim light around the edge, what the *back* of a card looks like (mirror vs solid colour), tint, brightness, opacity | card shader |
| `shadow` | Soft drop shadow under each card | shadow shader |
| `shade` | Angle-based darkening (cards turned away get darker) + a moving glare band sweeping across | card shader |
| `blur` | **Depth of field** — cards far from the focus plane blur. Plus a frame-edge blur | card shader + post |
| `cardGlass` | A bevelled glass rim around *each individual card*, with rainbow fringing | card shader |
| `glass` | The signature **"liquid glass"** — the whole frame's content smears, stretches and bulges toward the edges you choose, with spectral rainbow dispersion | post shader |
| `lens` | A floating glass pill/circle hovering over the frame that really refracts what's under it — or a "black hole" swirl variant | post shader |
| `bg` | Background: solid, linear, radial, mesh, aurora, grid, dots, holographic, spotlight, plasma | bg shader |
| `fx` | Grain, vignette, bloom, chromatic aberration, contrast, saturation, exposure | post shader |
| `camera` | Field of view, zoom, orbit, tilt, slow drift | engine → renderer |
| `title` | Big centred headline | Canvas2D overlay |
| `labels` | Four small corner captions | Canvas2D overlay |
| `logo` | Your logo image | Canvas2D overlay |
| `anim` | Animates title/labels/logo in at the start of the clip and out at the end, so loops stay seamless | engine |

**The signature look** is dispersion — the rainbow splitting at glass edges. It appears in four places (glass edges, card glass, the lens, the flare) and they all use the same trick: instead of offsetting red/green/blue by a fixed amount (which looks cheap), they sample the image 3–32 times at different wavelengths and weight each sample by a colour-matching curve, so **white stays white and only the edges split into a spectrum**. This is the detail that makes it look expensive, and it must be preserved.

Text and logo are painted onto one 2D canvas and composited as the *very last* step, so your titles never get grain or vignette applied to them.

---

## 5. The template system

A **template** is a recipe: "put N cards into space like this, and loop it seamlessly."

### 5.1 What one template actually is

Every template is a plain data object with a contract documented at the top of `templates.js`:

```js
{
  id:   'revolving-door',      // stable key saved into projects
  name: 'Revolving Door',      // shown in the browser
  cat:  'choreo',              // which category bucket
  n:    8,                     // default card count
  aspect: 1.8,                 // card width/height ratio
  frame: '5:4',                // the frame shape it was designed for
  fov:  38,                    // its own field of view
  dur:  12,                    // seconds for one loop (continuous templates)
  step: true,                  // "stepped" — cards hand off one at a time
  perCard: 1.4,                // seconds per card if stepped

  style: { ... },              // optional look layered over the default
  params: [ ... ],             // ← the controls it shows (see §6)
  mods:  { ... },              // fixed parameter values

  fill(P, E) { ... },          // optional: multiply the number of slots
  camera(P, E) { ... },        // optional: where the camera sits
  layout(i, P, E) { ... },     // ← THE ANIMATION ITSELF
}
```

**`layout()` is the heart of it.** It answers one question: *"where should card number `i` be, right now?"*

- `i` — which card
- `P` — this template's parameters (the sliders you moved)
- `E` — the environment: `E.p` is the **loop phase, a number from 0 to 1** that wraps forever, plus card count, screen size, an easing function, and a seeded random function

It returns a pose: `{x, y, z, rx, ry, rz, s, o, blur, glare, zBias, bend}` — position, rotation, scale, opacity, blur — or a full 4×4 matrix for more complex cases.

**The critical rule** (stated in the source header): *every value returned must be periodic in `E.p`*. Because phase wraps 0→1→0, and every calculation is a function of that phase, **the animation loops perfectly by construction**. Frame at t=0 and frame at t=end are mathematically identical.

### 5.2 The library

**166 templates** across **11 categories**:

| Category | Count | What it looks like |
|---|---|---|
| Choreography | 40 | Hand-crafted physical motion — doors, ribbons, waves, spirals |
| Stack & Grid | 20 | Cards piled or gridded |
| Ring & Orbit | 17 | Cards circling |
| Carousel & Slider | 16 | Cards sliding past |
| Kinetic | 14 | Type-and-shape motion |
| Infinite Gallery | 13 | Endlessly scrolling walls |
| Sculpture | 11 | Cards arranged as 3D objects |
| 3D Showcase | 11 | Rotating product-style displays |
| Transitions | 10 | Card hand-offs (includes the special Flare Duo) |
| Signature | 10 | Premium-looking showcase pieces |
| Liquid Glass | 4 | Glass-heavy treatments |

They're split across four files purely for file size (`templates.js` + `-x` + `-y` + `-z`). `templates-z.js` is **not** a lazy loader — it eagerly imports all ten choreography batches and concatenates them.

### 5.3 Two families

1. **Continuous** (`dur: 12`) — the loop runs for 12 seconds, the motion flows continuously.
2. **Stepped** (`step: true`) — cards take turns. Duration = `perCard × card count`, so adding a card makes the loop longer.

### 5.4 One special case: `kind: 'flare'`

Exactly one template (`flare-duo`) has a `kind` field. It has no `layout()` at all — its motion is hand-traced from a reference video as 40 data points, smoothed and re-integrated, and it renders through its own shader. It branches in six places across the codebase.

**Honest assessment:** this is a wart. It's one template handled as a special case rather than as a normal template with parameters. For the rebuild I'd keep it (it's a nice effect) but isolate it cleanly behind an interface so it can't leak conditionals into six files.

---

## 6. The parameter system and inspector

**This is the most important architectural finding in the whole audit.**

### 6.1 Parameters are a schema, not hardcoded UI

Each template declares its controls as **data**:

```js
params: [
  {group: 'Layout'},                                     // a section header
  {key: 'gap', label: 'Gap', type: 'range', min: .02, max: .4, step: .01, def: .06},
  {key: 'prismDepth', label: 'Prism depth', type: 'range', min: .3, max: 2.5, step: .01, def: 1, unit: '×'},
  {group: 'Motion'},
  {key: 'lean', label: 'Lean in turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
  {key: 'axis', label: 'Axis', type: 'seg', options: {x:'X', y:'Y'}, def: 'x'},
  {key: 'glow', label: 'Glow', type: 'toggle', def: false},
  {key: 'tint', label: 'Tint', type: 'color', def: '#ffffff'},
]
```

And **one single function** renders every control in the entire app from that data:

```js
function paramControl(app, p) {
  if (p.type === 'range')  return slider(app, p.label, 'params.' + p.key, {...});
  if (p.type === 'seg')    return seg(app, p.label, 'params.' + p.key, p.options, {...});
  if (p.type === 'select') return select(...);
  if (p.type === 'toggle') return toggle(...);
  if (p.type === 'color')  return color(...);
}
```

The same schema also generates the **default values**:

```js
function defaults(t) {
  const P = {count: t.n, speed: 1, dir: '1', hold: .5, ease: 'inOutQuint'};
  MOD_GROUPS.forEach(g => g.params.forEach(p => p.key && (P[p.key] = p.def)));
  (t.params || []).forEach(p => p.key && (P[p.key] = p.def));
  return Object.assign(P, t.mods || {});
}
```

**Why this is such a big deal:**

- Adding a new slider to a template is *one line of data*. No UI code, no defaults code, no migration.
- Old saved projects upgrade automatically, because saved values are merged *over* freshly-generated defaults. A brand-new parameter simply appears with its default value in every old project.
- Groups, headers, reset buttons, and "this control has been modified" markers all come for free.
- Even which controls *appear* is data-driven — the "easing" group shows only two controls for continuous templates but four for stepped ones, computed from the parameter values.

### 6.2 …but only half the inspector is like that

**The style inspector is hand-written.** The right-hand Visual panel is one long function that calls `slider(...)` with literal paths like `'style.glass.width'` and literal min/max values, with conditionals sprinkled through it (`if (L.mode === 'glass') show these five controls else show those four`).

There are roughly **90 style controls** written this way, in ~200 lines of hand-maintained code.

**Assessment:** this is the app's biggest maintenance liability, and it's the first thing the rebuild should fix — by giving the style tree the *same* declarative schema treatment the template parameters already get. Same control widgets, one registry, zero special cases. See Part 3.

### 6.3 Conditional controls

Many controls change depending on other settings:

| When this changes | The control set changes |
|---|---|
| Background mode | Which of the 4 colours exist, whether Motion/Scale/Intensity/Angle show |
| Glass mode (`all` / `per`) | One "Amount" slider **or** four per-edge sliders |
| Lens mode (`glass` / `hole`) | Half the lens controls swap out |
| Template has fixed card count | The "Cards" slider disappears |

The original handles this by flagging a control `rebuild: true`, which causes a full re-render of both panels. In React this problem mostly dissolves — conditional rendering is just JSX. But the *behaviour* must be preserved: the controls shown are a function of current state.

---

## 7. The layer system — what actually exists

**Finding: there is no layer stack. No visibility toggles, no z-order list, no click-to-select on the canvas.**

What plays the role of layers is the **ordered media list**:

```js
media: { set: 'auto', order: 'in', seed: 1, images: [
  {id, kind: 'image'|'video', name, w, h, dur?},
  ...
]}
```

- **Array order = card order.** Card 0 shows `images[0]`, card 1 shows `images[1]`, and so on (wrapping if there are fewer images than cards).
- Operations: add (file picker, drag-drop, paste, stock library), **drag to reorder**, remove one, remove all, switch order between "in order" and "shuffle", and a Reshuffle button.
- **Not possible:** hiding an item without deleting it, clicking a card to select it, manual z-order.

If there are *no* user images, the engine falls back to 10 bundled stock photos.

**Two dead fields to not port:** `state.media.set` (always `'auto'`, never read) and `template.set` (always `'photos'`). The engine hardcodes its fallback.

---

## 8. The timeline — what actually exists

**Finding: it's a loop scrubber. There are no keyframes, no tracks, no per-layer rows.**

```
  ▶  ━━━━━━━━━━●──────────────────────────────  1.42 / 8.00s
   play      scrub track (fill + playhead)      time
```

That's the entire timeline — three elements.

- The clock is **one number**, `app.T` (seconds), advanced by the animation frame loop while playing, wrapping at the clip length.
- Dragging the scrubber sets `T` directly and pauses; release restores play state.
- Arrow keys step one frame (Shift = ten); Home returns to zero.

**No keyframe system exists anywhere.** Nothing in the project state stores a value *at a time*. The only time-shaped data are loop parameters (`speed`, `dir`, `hold`, `ease`) and the text/logo in/out envelope.

**How duration works** — worth understanding because it's subtle:

```
loop  = template's loop length ÷ speed          e.g. 8s ÷ 1 = 8s
clip  = your chosen duration  (0 = "auto" = exactly one loop)

if "seamless loop" is ON:
    loops   = round(clip / loop)                 how whole loops fit
    rate    = loops × loop / clip                e.g. 1.04
    → motion runs at 1.04× so a whole number of loops fits your duration exactly
    → the last frame matches the first frame

if OFF: rate = 1, and the end won't match the start
```

The UI tells you this out loud: *"Motion runs at 1.04× so 3 loops fit exactly."*

---

## 9. State, undo, and saving

### 9.1 The project state

```js
{
  v: 3,                        // schema version
  template: 'flare-duo',       // which template
  params: {...},               // that template's parameter values
  style: {...},                // the whole look tree (14 groups)
  keepStyle: false,            // "Keep my look" when switching templates
  media: {set, order, seed, images: [...]},
  frame: {aspect:'5:4', preview:'auto', zone:'', social:''},
  theme: 'dark',
  name: 'My project',
  export: {kind, format, res, fps, quality, duration, seamless, ...}
}
```

### 9.2 Undo — one snapshot per *gesture*, not per pixel

This is a really well-designed detail worth copying exactly:

- While you **drag** a slider, every movement calls `app.set()` — which marks the app dirty and schedules a save, but **does not push undo history**.
- When you **release** (`pointerup`), `app.commit()` pushes exactly **one** snapshot.

So a 3-second slider drag = 1 undo step, not 200. Colour pickers and text fields use the same rule (`oninput → set`, `onchange → commit`).

Snapshots are JSON strings of the whole state, with **image references reduced to just their IDs** (so a snapshot is a few KB even with 50 images), re-resolved against the current images when stepping. Capped at 80, deduplicated, redo tail truncated on new push, and locked while an undo is being applied so side-effects can't pollute the stack.

### 9.3 Two save paths

| What | Where | When |
|---|---|---|
| The working draft | `localStorage['aligncanvas-v1']` | 400 ms after any change |
| Image/video **files** | IndexedDB, store `media` | Immediately on upload |
| Saved projects | IndexedDB, store `projects` | 1200 ms after any change (single-flight, deferred during export) |

**Key design:** a project's state only *names* its media by ID. The actual image bytes live once in IndexedDB and are shared by every project that references them — so duplicating a project costs nothing. A garbage collector deletes unreferenced media, but only if it's older than 24 hours (so it never destroys another tab's unsaved work).

The header shows a live status: **Draft / Saving… / Saved / Not saved**.

You can also save a project as a portable `.aligncanvas.json` file with images inlined as data-URLs — so projects are shareable without any server.

---

## 10. Export

**Everything renders locally, frame by frame. No MediaRecorder, no server.**

| Output | How |
|---|---|
| **MP4 / WebM** | Browser's built-in `VideoEncoder` (WebCodecs) + a small "muxer" library that writes the file container |
| **GIF** | `gifenc` library |
| **PNG sequence** | Rendered frames zipped with `fflate` |
| **PNG / JPEG / WebP still** | Canvas `toBlob`, or copy to clipboard |

The core loop:

```js
for (let i = 0; i < totalFrames; i++) {
  await prepareFrame(i / fps);      // seek every video to the exact frame, wait for it
  drawExport(i / fps, W, H);        // same buildFrame + render, at export size
  encoder.encode(new VideoFrame(canvas, {timestamp: i * 1e6 / fps}));
  while (encoder.encodeQueueSize > 6) await delay(2);   // don't overwhelm it
}
```

Timestamps are computed from the frame *number*, not the clock — so output is frame-perfect regardless of how long each frame takes.

**The one non-deterministic input is video.** It's handled explicitly: before each frame, every video is seeked to the exact time and the code waits for it to arrive. A flag (`renderer.exact`) tells the blur layers to refresh every frame instead of being throttled.

**Dependencies currently loaded from a CDN at runtime** (must be bundled in the rebuild): `mp4-muxer`, `webm-muxer`, `gifenc`, `fflate`.

**Four things to remove** (billing, detailed in Part 2): the free-plan resolution/fps clamping, the "N exports left" counter, the server call before every download, and the Pro feature gates.

---

## 11. UI construction and refresh

- **DOM is built imperatively** with a 10-line `h()` helper over `document.createElement`. No framework, no virtual DOM.
- **Refresh happens three ways:**
  1. *Targeted* — a slider updates its own fill/knob/label as you drag.
  2. *Full panel rebuild* — `rebuild()` wipes both panels and rebuilds them, preserving scroll position. Called on tab changes, template switches, toggles flagged `rebuild: true`, and after undo.
  3. *Canvas* — a single animation loop gated by a `dirty` flag. **The canvas never redraws directly from `set()`**; the dirty flag feeds the one loop.

- **The animation loop runs forever**, even when paused (needed for hover previews and video sync) — but actual GPU work only happens when `dirty` is set. Paused idle frames cost almost nothing.

- **Keyboard shortcuts:** Space (play/pause), ←/→ (step frame, Shift = 10), Home, F (fullscreen), G (guides), R (surprise random look), T (theme), E (export), ⌘Z / ⇧⌘Z (undo/redo), ? (shortcuts), Esc (close).

- **Modals and toasts** are a single shared container each; toasts are single-slot (a new one replaces the current).

---

## 12. Performance — what it does well

| Technique | Effect |
|---|---|
| Dirty-flag rendering | Idle/paused frames cost nothing |
| Preview quality tiers | Draft 0.6×, Auto = screen resolution, Max 1.25× — with pixel caps |
| Quantised texture sizes | Textures snap to a fixed ladder (192…3072), so editing at 1080p doesn't build 4K textures — but exporting at 4K does build them |
| Texture cache with LRU eviction | 160 card textures max, evicts 40 oldest |
| Blur via mip chain | No separate blur passes at all |
| Time-sliced thumbnails | Template thumbnails render 10 ms at a time, spread across frames, so the UI never hitches |
| Text redraw caching | The text overlay only repaints when a value actually changed |
| Encoder backpressure | Export pauses when the encoder falls behind |
| Anisotropic filtering | Photos stay sharp on steeply-angled cards |

**Missing (to add in the rebuild):** no handling for the graphics context being lost (switching GPU, driver reset → the app just dies), no automatic quality downgrade if the frame rate drops (it *measures* frame rate but only sends it to analytics), no GPU memory budget (160 textures × 4 images each at 4K is a real risk), and no instancing (one draw call per card).

---

## 13. Honest engineering assessment

### What is genuinely excellent — protect it

1. **The pure (state, time) → frame pipeline.** The single most valuable property in the app.
2. **Declarative parameter schema.** 166 templates with unique controls, zero per-template UI code, free migrations.
3. **Gesture-level undo.** One drag = one undo step.
4. **Media-by-reference storage.** Projects are tiny; duplicates are free.
5. **Mip-chain blur instead of blur passes.** Cheap and looks good.
6. **Spectral dispersion.** The signature look, done properly rather than cheaply.
7. **Seamless looping by construction.** Periodicity, not by eyeballing.

### What is weak — fix in the rebuild

1. **The style inspector is 90 hand-written controls** with literal paths and scattered conditionals. Give it the same schema treatment as template parameters.
2. **Full-panel `innerHTML` rebuilds.** Causes flicker, loses input focus mid-typing, needs scroll-preservation workarounds, and re-binds every event listener on every change. A reactive framework fixes this entirely.
3. **Pro/billing gates are woven into the controls themselves** — a `locked` option on segments, a `proToggleEl` variant, `inert` wrappers, value-clamping at panel build time. This needs to be *deleted*, not refactored, since we're dropping billing entirely.
4. **Special cases leak everywhere.** The `flare` template branches in six files. The conditional control sets require a rebuild flag. Centralise both.
5. **No context-loss recovery.** Add `webglcontextlost` / `webglcontextrestore` handling.
6. **Two dead fields** (`media.set`, `template.set`) and an unreachable `mixed` code branch.
7. **Everything is one 926-line class plus one 635-line file.** Split by responsibility.

---

## 14. Quick reference — the numbers

| | |
|---|---|
| Templates | **166** across **11** categories |
| Style groups (the look) | **14** (`BASE_STYLE`) |
| Hand-written style controls | **~90** |
| Declarative parameter types | **5** (`range`, `seg`, `select`, `toggle`, `color`) |
| Shader programs | **6** |
| Background modes | **10** |
| Undo depth | **80** snapshots |
| Render passes per frame | **2** |
| Rail destinations | **4** (Motion, Media, Text, Project) |
| Right panel tabs | **2** (Visual, Export) |
| Keyboard shortcuts | **13** |
| Export formats | **MP4, WebM, GIF, PNG sequence, PNG/JPEG/WebP still, clipboard** |
| Backend required for rendering | **None** |

---

**Next:** [Part 2 — Scope Definition](./02-SCOPE.md) · [Part 3 — Implementation Blueprint](./03-BLUEPRINT.md)
