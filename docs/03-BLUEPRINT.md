# Part 3 — Implementation Blueprint

**What this document is:** the practical plan for building the app — the data structures, the component breakdown, the folder layout, and a milestone-by-milestone roadmap you can follow one piece at a time.

**Decisions already locked in** (see [Part 2](./02-SCOPE.md)): React + TypeScript + Vite · plain WebGL2 for drawing · faithful parity first, layers/keyframes in Phase 2 · ~20 templates first · no backend · no auth, billing, cloud, analytics or AI.

---

## Contents

1. [Getting started — the exact commands](#1-getting-started--the-exact-commands)
2. [Folder structure](#2-folder-structure)
3. [The data structures](#3-the-data-structures)
4. [The engine–renderer contract](#4-the-enginerenderer-contract)
5. [Component breakdown](#5-component-breakdown)
6. [The control library](#6-the-control-library)
7. [The roadmap](#7-the-roadmap)
8. [Testing strategy](#8-testing-strategy)
9. [Risks and how to handle them](#9-risks-and-how-to-handle-them)

---

## 1. Getting started — the exact commands

You need two things installed: **Node.js** (the tooling) and a code editor (**VS Code**).

### Step 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the button that says **LTS** (the green one — currently v22.x)
3. Run the installer, clicking **Next** through every screen with the defaults
4. When it finishes, **close and reopen** any command prompt / terminal windows

**Check it worked.** Open a terminal (on Windows: press the Windows key, type `powershell`, press Enter) and type:

```powershell
node --version
```

You should see something like `v22.x.x`. If you see an error, close and reopen the terminal and try again.

### Step 2 — Install VS Code

1. Go to **https://code.visualstudio.com**
2. Download and install it with all defaults
3. Open it — you'll do all your work in here

### Step 3 — Create the project

In VS Code, open **Terminal → New Terminal** (the menu at the top), then run these one at a time by pasting each line and pressing Enter:

```powershell
cd "$env:USERPROFILE\Downloads\Align"
npm create vite@latest app -- --template react-ts
cd app
npm install
```

What just happened:
- `npm create vite…` created a brand-new React + TypeScript project in a folder called `app`
- `cd app` moved into that folder
- `npm install` downloaded the ~200 libraries it needs (this takes a minute or two)

### Step 4 — Start it

```powershell
npm run dev
```

You'll see something like:

```
  VITE ready in 400 ms
  ➜  Local:   http://localhost:5173/
```

**Hold Ctrl and click that link** (or copy it into your browser). You should see a page that says *Vite + React + TS*.

**Leave this terminal window running.** Now open **http://localhost:5173** in your browser whenever you want to see the app. Every time you save a file, the page updates instantly by itself.

### The commands you'll use daily

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server (you'll type this every day) |
| `npm run build` | Produce the final, minified version for publishing |
| `npm run typecheck` | Ask TypeScript to check the whole project for mistakes |
| `npm test` | Run the automated tests |

### Installing the libraries you'll need

Run these **once**, inside the `app` folder:

```powershell
npm install zustand fflate
npm install -D vitest @testing-library/react jsdom
```

| Library | Why |
|---|---|
| `zustand` | A tiny store to hold the project state and tell React when it changes |
| `fflate` | Zipping PNG image sequences (bundled locally, not loaded from a CDN) |
| `vitest` | The test runner (fast, works with Vite automatically) |

You do **not** need React Three.js, Redux, or any 3D library — we're writing the WebGL directly, exactly as the original does.

> **Windows note:** if `npm` isn't found, reinstall Node.js and make sure the option **"Add to PATH"** is ticked.

---

## 2. Folder structure

```
app/
├─ index.html
├─ vite.config.ts
├─ package.json
└─ src/
   ├─ main.tsx                      ← entry
   ├─ App.tsx                       ← the screen layout
   ├─ styles/
   │   ├─ tokens.css                ← colours, spacing, fonts (design variables)
   │   └─ app.css                    ← the interface styling
   │
   ├─ state/                         ← PROJECT DATA
   │   ├─ types.ts                   ← ProjectState and friends  ★
   │   ├─ defaults.ts                ← BASE_STYLE, presets, palettes
   │   ├─ store.ts                   ← zustand store + set/commit pattern ★
   │   ├─ history.ts                 ← undo/redo
   │   ├─ migrate.ts                 ← schema version upgrades
   │   └─ persistence.ts             ← localStorage draft + autosave
   │
   ├─ engine/                        ← PURE: no graphics code at all ★
   │   ├─ buildFrame.ts              ← (state, time) → FrameDescriptor
   │   ├─ timing.ts                  ← loop length, clip, seamless rate
   │   ├─ layout.ts                  ← per-card pose maths
   │   ├─ camera.ts                  ← eye/target/zoom/orbit
   │   ├─ media.ts                   ← which image on which card
   │   ├─ labels.ts                  ← title/labels/logo painting (Canvas2D)
   │   └─ random.ts                  ← seeded hash + shuffle
   │
   ├─ render/                        ← WEBGL: knows nothing about the project
   │   ├─ Renderer.ts                ← context, programs, textures, draw calls
   │   ├─ shaders/                   ← the 6 shader programs
   │   │   ├─ common.glsl.ts
   │   │   ├─ bg.ts    ├─ card.ts   ├─ shadow.ts
   │   │   ├─ side.ts  ├─ post.ts   └─ flare.ts
   │   │   ├─ vertex/full.ts        └─ vertex/card.ts
   │   ├─ framebuffers.ts
   │   ├─ textureCache.ts           ← card textures + LRU eviction
   │   └─ snapshot.ts                ← read pixels back for stills
   │
   ├─ templates/                     ← THE 166 RECIPES
   │   ├─ types.ts                   ← Template + ParamDef  ★
   │   ├─ registry.ts                ← all templates, byId, categories
   │   ├─ params.ts                  ← defaults(), controlGroups()
   │   ├─ kit.ts                     ← shared maths helpers
   │   ├─ flare.ts                   ← the one special template
   │   └─ batches/
   │       ├─ core.ts     ├─ x.ts    ├─ y.ts
   │       └─ choreo-a.ts … choreo-j.ts
   │
   ├─ media/                         ← FILES IN AND OUT
   │   ├─ ingest.ts                  ← decode, downscale, classify
   │   ├─ store.ts                   ← IndexedDB (media + projects)
   │   ├─ video.ts                   ← hidden video holders, exact seek
   │   └─ library.ts                 ← the stock photo library
   │
   ├─ export/                        ← MAKING FILES
   │   ├─ video.ts                   ← WebCodecs + muxers
   │   ├─ gif.ts    ├─ sequence.ts   └─ still.ts
   │   └─ vendors/                   ← mp4-muxer, webm-muxer, gifenc (bundled)
   │
   └─ ui/                            ← REACT COMPONENTS
      ├─ shell/
      │   ├─ Header.tsx   ├─ Rail.tsx   ├─ Stage.tsx
      │   ├─ LeftPanel.tsx ├─ RightPanel.tsx
      │   ├─ Toolbar.tsx  ├─ Timeline.tsx
      │   └─ Modal.tsx    ├─ Toast.tsx
      ├─ controls/                   ← the reusable control widgets ★
      │   ├─ Slider.tsx   ├─ Segmented.tsx   ├─ Select.tsx
      │   ├─ Toggle.tsx   ├─ ColorInput.tsx   ├─ TextInput.tsx
      │   ├─ Section.tsx  └─ ControlRenderer.tsx  ← schema → widget ★
      ├─ panels/
      │   ├─ TemplateBrowser.tsx  ├─ ControlsPanel.tsx
      │   ├─ MediaPanel.tsx       ├─ TextPanel.tsx
      │   ├─ ProjectPanel.tsx     ├─ VisualPanel.tsx  ← style inspector
      │   └─ ExportPanel.tsx
      ├─ canvas/
      │   ├─ StageCanvas.tsx      ← the <canvas> + rAF loop ★
      │   └─ Overlays.tsx         ← guides + safe zones
      └─ hooks/
         ├─ useProject.ts   ├─ useShortcuts.ts
         └─ usePointer.ts   ← drag behaviour
```

★ = the files that matter most. If you only deeply understand six files, make them `state/types.ts`, `state/store.ts`, `engine/buildFrame.ts`, `templates/types.ts`, `render/Renderer.ts`, and `ui/controls/ControlRenderer.tsx`.

---

## 3. The data structures

**These are the blueprint.** Get them right and most of the app falls out of them. Get them wrong and everything downstream fights you.

### 3.1 `state/types.ts` — the project

```ts
/** Everything about one project. This is what gets saved. */
export interface ProjectState {
  /** Schema version — bump when the shape changes, see migrate.ts */
  v: 1;

  /** The project name shown in the header */
  name: string;

  /** Which template is active */
  templateId: string;

  /** Values for that template's parameters. Keyed by param key. */
  params: Record<string, ParamValue>;

  /** The whole "look" — see 3.2 */
  style: StyleTree;

  /** "Keep my look" when switching templates */
  keepStyle: boolean;

  /** Your images/videos, in card order. This array IS the layer list. */
  media: MediaState;

  /** Frame shape and preview preferences */
  frame: FrameState;

  /** Export settings */
  export: ExportSettings;

  /** 'light' | 'dark' | 'system' */
  theme: ThemeSetting;
}

export type ParamValue = number | string | boolean;
```

```ts
export interface MediaState {
  /** How images are assigned to cards: 'in' | 'shuffle' */
  order: 'in' | 'shuffle';
  /** Seed driving the shuffle AND per-card randomness */
  seed: number;
  /** Ordered list — index = card number */
  images: MediaItem[];
}

export interface MediaItem {
  /** Stable id — this is all a history snapshot stores */
  id: string;
  kind: 'image' | 'video';
  name: string;
  width: number;
  height: number;
  /** videos only */
  duration?: number;
  /** stock library only — a path, never copied into IndexedDB */
  libraryPath?: string;
}
```

```ts
export interface FrameState {
  /** '16:9' | '9:16' | '1:1' | '4:5' | '5:4' | '4:3' | '3:4' | '21:9' | '2:3' */
  aspect: Aspect;
  /** Preview quality: draft | auto | max */
  preview: 'draft' | 'auto' | 'max';
  /** Which safe-zone overlay to draw (never exported) */
  zone: '' | 'reels' | 'story' | 'feed';
  /** Show the overlay at all */
  zoneShow: boolean;
}

export interface ExportSettings {
  kind: 'video' | 'gif' | 'image' | 'sequence';
  format: 'mp4' | 'webm';
  res: number;              // 480 | 720 | 1080 | 1440 | 2160
  fps: number;              // 24 | 30 | 60 | 120
  quality: 'low' | 'medium' | 'high' | 'max';
  /** 0 = "auto" = exactly one template loop */
  duration: number;
  /** Fit a whole number of loops into the duration */
  seamless: boolean;
  // stills
  img: 'png' | 'jpeg' | 'webp';
  scale: number;
  transparent: boolean;
  // gif
  gifWidth: number;
  gifFps: number;
  gifColors: number;
  // sequence
  seqFps: number;
}
```

### 3.2 The "look" — `BASE_STYLE`

14 groups. Note that **every group has an `on` switch except `card`, `bg`, `fx`, `camera`** (those are always active).

```ts
export interface StyleTree {
  card: {
    radius: number;        // 0 – 0.5
    border: number;        // rim light, 0 – 1
    aspect: 'auto' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '16:9' | '8:5';
    back: 'mirror' | 'solid';
    backColor: string;
    brightness: number;    // 0.3 – 1.6
    opacity: number;       // 0 – 1
    tint: string;
    tintA: number;         // 0 – 1
  };
  shadow: { on: boolean; alpha: number; soft: number; offset: number; color: string };
  shade:  { on: boolean; amount: number; glare: number; sweep: boolean };
  blur:   { on: boolean; depth: number; focus: number; edge: number };
  cardGlass: { on: boolean; width: number; refraction: number; dispersion: number };
  glass: {
    on: boolean;
    mode: 'all' | 'per';
    amount: number;
    top: number; bottom: number; left: number; right: number;
    width: number; refraction: number; stretch: number; bulge: number;
    curve: 'panel' | 'lens' | 'wave';
    dispersion: number; soften: number; feather: number; highlight: number;
  };
  lens: {
    on: boolean;
    mode: 'glass' | 'hole';
    shape: 'pill' | 'circle' | 'square';
    x: number; y: number; w: number; h: number;
    refraction: number; frost: number; dispersion: number; bevel: number;
    highlight: number; magnify: number; shadow: number;
    tint: string; tintA: number;
    motion: 'static' | 'drift' | 'sweep' | 'orbit';
  };
  bg: {
    mode: 'solid'|'linear'|'radial'|'mesh'|'aurora'|'grid'|'dots'|'holo'|'spotlight'|'plasma';
    c: string[];           // up to 4 colours
    cycles: number; scale: number; angle: number; amt: number;
    transparent: boolean;
  };
  fx: {
    grain: number; vignette: number; bloom: number; chroma: number;
    contrast: number; saturation: number; exposure: number;
  };
  camera: { fov: number; zoom: number; orbit: number; tilt: number; drift: number };
  title:  { on: boolean; text: string; color: string; size: number;
            weight: 400|600|700; font: string; y: number };
  labels: { on: boolean; tl: string; tr: string; bl: string; br: string;
            size: number; color: 'auto'|'#ffffff'|'#111111'; mark: boolean; font: string };
  logo:   { on: boolean; id: string; pos: 'tl'|'tr'|'center'|'bl'|'br';
            size: number; opacity: number };
  anim:   { on: boolean; kind: 'fade'|'rise'|'pop'|'type'|'slide'; speed: number };
}
```

### 3.3 The control schema — **the key design decision**

The original writes its ~90 style controls by hand with literal paths. **We don't.** We give the style tree the same declarative treatment the template parameters already get. One schema drives default values, the UI, the ranges, the conditional visibility, and the reset buttons.

```ts
/** A single control in the inspector. This is DATA, not code. */
export type ControlDef =
  | RangeControl | SegmentedControl | SelectControl
  | ToggleControl | ColorControl | TextControl | HeaderControl;

interface BaseControl {
  /** Dotted path into ProjectState, e.g. 'style.glass.width' or 'params.gap' */
  path: string;
  label: string;
  /** Show this control only when this returns true */
  showIf?: (state: ProjectState) => boolean;
  hint?: string;
}

export interface RangeControl extends BaseControl {
  type: 'range';
  min: number; max: number; step: number;
  def: number;
  /** How to display it: '%', '×', '°', ' turns', or a custom formatter */
  format?: 'percent' | 'multiplier' | 'degrees' | 'turns' | 'seconds' | 'none';
  /** Show this text at exactly 0 (e.g. 'off', 'auto') */
  zeroLabel?: string;
}

export interface SegmentedControl extends BaseControl {
  type: 'segment';
  options: { value: string; label: string }[];
  def: string;
}

export interface SelectControl extends BaseControl {
  type: 'select';
  options: { value: string; label: string }[];
  def: string;
}

export interface ToggleControl extends BaseControl {
  type: 'toggle';
  def: boolean;
}

export interface ColorControl extends BaseControl {
  type: 'color';
  def: string;   // '#rrggbb'
}

export interface TextControl extends BaseControl {
  type: 'text';
  def: string;
  placeholder?: string;
}

/** Not a control — a section sub-heading inside a panel */
export interface HeaderControl { type: 'header'; label: string; showIf?: (s: ProjectState) => boolean }

/** A titled, collapsible group of controls */
export interface ControlSection {
  id: string;                    // e.g. 'v-glass' — accordion state key
  title: string;
  subtitle?: string;
  /** Path to an on/off switch for the whole section (optional) */
  togglePath?: string;
  controls: ControlDef[];
}
```

**Then the style sections are just data:**

```ts
// ui/panels/styleSections.ts
export const STYLE_SECTIONS: ControlSection[] = [
  {
    id: 'v-bg', title: 'Background',
    controls: [
      { type: 'select', path: 'style.bg.mode', label: 'Type',
        options: BG_MODE_OPTIONS, def: 'solid' },
      { type: 'header', label: 'Palette' },
      { type: 'segment', path: 'style.bg.cycles', label: 'Motion',
        options: [{value:'1',label:'1×'},{value:'2',label:'2×'},{value:'3',label:'3×'},{value:'4',label:'4×'}],
        def: '1',
        showIf: s => ['mesh','aurora','holo','plasma'].includes(s.style.bg.mode) },
      { type: 'range', path: 'style.bg.scale', label: 'Scale',
        min: 0.3, max: 3, step: 0.01, def: 1, format: 'none',
        showIf: s => ['radial','mesh','grid','dots','plasma'].includes(s.style.bg.mode) },
      { type: 'toggle', path: 'style.bg.transparent', label: 'Transparent', def: false },
    ],
  },
  {
    id: 'v-glass', title: 'Liquid glass', togglePath: 'style.glass.on',
    controls: [
      { type: 'segment', path: 'style.glass.mode', label: 'Edges', def: 'per',
        options: [{value:'all',label:'All'},{value:'per',label:'Per edge'}] },
      { type: 'range', path: 'style.glass.amount', label: 'Amount', min:0, max:1, step:.01, def:1,
        format:'percent', showIf: s => s.style.glass.mode === 'all' },
      { type: 'range', path: 'style.glass.top', label: 'Top', min:0, max:1, step:.01, def:0,
        zeroLabel: 'off', showIf: s => s.style.glass.mode === 'per' },
      // … bottom / left / right, then the shared controls
      { type: 'range', path: 'style.glass.dispersion', label: 'Dispersion',
        min:0, max:1.5, step:.01, def:.6, format:'percent' },
    ],
  },
  // … 12 more sections
];
```

**And one component renders them all:**

```tsx
export function ControlRenderer({ def }: { def: ControlDef }) {
  const value = useProject(s => getPath(s, def.path));
  const set   = useProject(s => s.set);
  const commit = useProject(s => s.commit);

  if (def.showIf && !def.showIf(useProject.getState())) return null;

  switch (def.type) {
    case 'range':   return <Slider {...def} value={value} onChange={set} onCommit={commit} />;
    case 'segment': return <Segmented {...def} value={value} onChange={v => { set(def.path, v); commit(); }} />;
    case 'select':  return <Select {...def} … />;
    case 'toggle':  return <Toggle {...def} … />;
    case 'color':   return <ColorInput {...def} … />;
    case 'text':    return <TextInput {...def} … />;
    case 'header':  return <div className="control-header">{def.label}</div>;
  }
}
```

**Why this is worth the effort:** adding an effect control becomes *one line of data*. Conditional visibility, defaults, ranges, formatting, "modified" markers and reset all come from the same place. It also means the template parameter system and the style system share one code path — which is exactly the unification the original never made.

### 3.4 `templates/types.ts` — a template

```ts
export interface Template {
  id: string;
  name: string;
  cat: CategoryId;
  desc?: string;
  isNew?: boolean;

  /** default card count */
  n: number;
  /** card width ÷ height */
  aspect: number;
  /** the frame shape this was designed for */
  frame: Aspect;
  /** field of view in degrees (default 30) */
  fov?: number;
  /** card height in world units (default 0.8) */
  cardH?: number;

  /** continuous templates: seconds per loop */
  dur?: number;
  /** stepped templates: hand off cards one at a time */
  step?: boolean;
  perCard?: number;
  /** card count is fixed — hide the Cards slider */
  fixedN?: boolean;

  /** texture resolution multiplier */
  resBoost?: number;

  /** the look this template wants, layered over the default */
  style?: DeepPartial<StyleTree>;

  /** THIS template's controls */
  params?: ControlDef[];

  /** fixed parameter values, applied last */
  mods?: Record<string, ParamValue>;

  /** optional: multiply/derive the card slots. Returns extras for `env`. */
  fill?: (params: P, env: Env) => { count?: number; [k: string]: unknown };

  /** optional: the camera for this template */
  camera?: (params: P, env: Env) => { eye: Vec3; target: Vec3 };

  /** ★ THE ANIMATION. Where is card `i` at loop phase env.p? */
  layout: (i: number, params: P, env: Env) => CardPose;
}

/** Everything `layout` can see */
export interface Env {
  /** loop phase 0→1, wrapping. EVERYTHING must be periodic in this. */
  p: number;
  /** card count */
  n: number;
  /** screen aspect */
  asp: number;
  /** card width / height in world units */
  w: number; h: number;
  /** how far the view extends */
  vx: number; vy: number;
  /** deterministic per-card random: rnd(cardIndex, salt) */
  rnd: (i: number, k?: number) => number;
  /** the active easing curve */
  ez: (t: number) => number;
  /** hold fraction for stepped motion */
  hold: number;
  /** anything fill() returned */
  [key: string]: unknown;
}

/** Where one card sits */
export interface CardPose {
  x?: number; y?: number; z?: number;
  rx?: number; ry?: number; rz?: number;
  s?: number;          // scale
  o?: number;          // opacity
  blur?: number;
  b?: number;          // brightness
  glare?: number;
  zBias?: number;      // breaks ties in back-to-front sorting
  bend?: number;
  aspect?: number;
  /** override which media item this card shows */
  img?: number;
  /** OR provide a full transform matrix instead of x/y/z/rx/ry/rz */
  m?: Float32Array;
}
```

```ts
/** A control that is part of a template's parameters */
type P = Record<string, ParamValue>;
```

### 3.5 `engine/timing.ts` — loop and clip maths

```ts
/** One loop of this template at speed 1, in seconds */
export function loopLength(state: ProjectState): number {
  const t = byId(state.templateId);
  const base = t.step
    ? (t.perCard ?? 1.4) * (t.fixedN ? t.n : (state.params.count as number ?? t.n))
    : (t.dur ?? 10);
  const speed = Math.max(0.05, (state.params.speed as number) || 1);
  return base / speed;
}

export interface ClipInfo {
  /** one template loop */
  loop: number;
  /** total length of the preview/export clip */
  clip: number;
  /** multiply time by this so whole loops fit — 1 when seamless is off */
  rate: number;
  loops: number;
}

export function clipInfo(state: ProjectState): ClipInfo {
  const loop = loopLength(state);
  const clip = Math.max(0.5, state.export.duration || loop);
  if (!state.export.seamless) return { loop, clip, rate: 1, loops: clip / loop };
  const loops = Math.max(1, Math.round(clip / loop));
  return { loop, clip, rate: (loops * loop) / clip, loops };
}

export const clipLength = (s: ProjectState) => clipInfo(s).clip;
```

### 3.6 `state/store.ts` — the store, and the set/commit rule

**This is the second most important file in the project.** The two-method split is what makes undo feel right.

```ts
import { create } from 'zustand';

interface ProjectStore {
  state: ProjectState;
  /** Continuous change — during a drag. Does NOT push undo. */
  set: (path: string, value: unknown) => void;
  /** End of a gesture. Pushes exactly ONE undo snapshot. */
  commit: () => void;
  /** Structural change: rebuild panels too */
  rebuild?: () => void;
  undo: () => void;
  redo: () => void;
  /** Replace the whole state (undo, open project, new project) */
  replace: (state: ProjectState) => void;
  /** Marks the canvas dirty — the render loop picks it up */
  dirty: boolean;
  markDirty: () => void;
}
```

**The rule, stated as an invariant:**

| Event | Call | Why |
|---|---|---|
| Slider `pointermove` | `set()` | 200 calls during a drag must not create 200 undo steps |
| Slider `pointerup` | `commit()` | One drag = one undo step |
| Colour/text `oninput` | `set()` | Live preview while typing |
| Colour/text `onchange` | `commit()` | One colour pick = one undo step |
| Button / segment / toggle click | `set()` then `commit()` | A click is one gesture |
| Arrow key on a focused slider | `set()` … then `commit()` | Treat the key sequence as one gesture if held |

Never call `commit()` from `set()`. This one line is the difference between undo that feels professional and undo that feels broken.

**Rendering flow:**

```
set()  →  state changes  →  markDirty()  →  rAF loop sees dirty  →  buildFrame + render
                                    └→ debounced save (400ms localStorage, 1200ms IndexedDB)
commit()  →  set()  +  history.push()
```

React never re-renders the canvas. The canvas has its own loop.

### 3.7 `state/history.ts`

```ts
export class History {
  private stack: string[] = [];
  private index = -1;
  private locked = false;

  push(state: ProjectState) {
    if (this.locked) return;
    // Media reduced to IDs — a snapshot is a few KB even with 50 images
    const snap = JSON.stringify({ ...state, media: { ...state.media,
      images: state.media.images.map(m => m.id) } });
    if (this.stack[this.index] === snap) return;        // no duplicates
    this.stack = this.stack.slice(0, this.index + 1);   // clear redo tail
    this.stack.push(snap);
    if (this.stack.length > 80) this.stack.shift();     // cap depth
    this.index = this.stack.length - 1;
  }

  step(delta: number, current: ProjectState): ProjectState | null {
    const j = this.index + delta;
    if (j < 0 || j >= this.stack.length) return null;
    this.index = j;
    const s = JSON.parse(this.stack[j]);
    // Re-resolve media IDs against what exists *now*
    s.media.images = s.media.images
      .map((id: string) => current.media.images.find(m => m.id === id))
      .filter(Boolean);
    return s;
  }
}
```

While `undo()` is applying a snapshot, set `locked = true` so the resulting `set()` side-effects can't push a new snapshot onto the stack.

---

## 4. The engine–renderer contract

**Freeze this interface before writing any rendering code.** Everything else can evolve around it.

```ts
/** engine/buildFrame.ts — THE OUTPUT. Pure. Same input = same output, always. */
export interface FrameDescriptor {
  W: number;
  H: number;

  /** background: mode, colours, phase — or null when transparent */
  bg: BackgroundDesc | null;

  /** camera */
  camera: { fov: number; eye: Vec3; target: Vec3 };

  /** one per visible card, ALREADY sorted back-to-front by the engine */
  cards: CardDesc[];

  /** global drop shadow settings */
  shadow: { on: boolean; alpha: number; soft: number; offset: number; color: string } | null;

  /** only for the one special 'flare' template */
  flare: FlareDesc | null;

  /** every post-processing value in one flat block */
  post: { labels: CanvasImageSource | null; seed: number; u: Record<string, number> };
}

export interface CardDesc {
  model: Float32Array;        // 4×4 matrix
  x: number; y: number; z: number;
  width: number; height: number;
  radius: number;
  opacity: number;
  blur: number;               // 0–1 depth-of-field
  brightness: number;
  glare: number;
  glarePhase: number;
  bend: number;
  crumple: number;
  thickness: number;
  /** the 4 textures: sharp + 3 blur levels */
  textures: FaceTextures;
  tint: string; tintAmount: number;
  backMode: 'mirror' | 'solid'; backColor: string;
  rimLight: number;
  cardGlass: { width: number; refraction: number; dispersion: number };
  shade: { amount: number };
}
```

**Three rules:**

1. **The engine touches no WebGL.** Not one `gl.` call. It returns plain data.
2. **The renderer touches no project state.** It receives a descriptor and draws it.
3. **The descriptor is the only language between them.** Change it deliberately, in one place.

**This buys you:** deterministic export (the exporter just asks for `t = 0, 1/60, 2/60…`), unit tests that don't need a GPU, and the ability to rewrite the renderer in WebGPU later without touching a line of motion maths.

### The render pass graph

```
render(desc):
  1. sync any changed video textures
  2. bind the "scene" framebuffer
  3. clear to transparent
  4. draw fullscreen background          (skip if bg.transparent)
  5. enable premultiplied-alpha blending
  6. for each card, back to front:
        draw shadow  →  draw thick edges  →  draw face
     (OR: draw the one fullscreen flare program)
  7. build the mip chain of the scene    ← this is where "blur" comes from
  8. bind the output (the canvas)
  9. draw fullscreen post pass:  glass → lens → aberration → blur → bloom →
     exposure → contrast → saturation → vignette → grain → text → screen
```

---

## 5. Component breakdown

### 5.1 The screen

```tsx
export default function App() {
  return (
    <div className="app">
      <Header />
      <div className="body">
        <Rail />
        <LeftPanel />
        <Stage>            {/* toolbar + canvas + timeline */}
          <Toolbar />
          <StageCanvas />
          <Timeline />
        </Stage>
        <RightPanel />
      </div>
      <Overlays />         {/* toast, drop zone, modal */}
    </div>
  );
}
```

Grid, taken directly from the original's CSS:

```css
.app  { display: grid; grid-template-rows: 52px 1fr; gap: 8px; padding: 8px; height: 100vh; }
.body { display: grid; grid-template-columns: 64px 292px minmax(0,1fr) 316px; gap: 8px; min-height: 0; }
```

### 5.2 Panels

| Component | Renders | Reads |
|---|---|---|
| `Rail` | 4 nav buttons: Motion, Media, Text, Project | `ui.rail` |
| `LeftPanel` | Swaps by rail: TemplateBrowser/ControlsPanel · MediaPanel · TextPanel · ProjectPanel | `ui.rail`, `ui.leftTab` |
| `RightPanel` | Two permanent tabs: VisualPanel · ExportPanel | `ui.rightTab` |
| `VisualPanel` | `STYLE_SECTIONS` rendered through `ControlRenderer` | `state.style` |
| `TemplateBrowser` | Search, categories, thumbnail grid | `state.templateId` |
| `ControlsPanel` | The active template's `params` schema, grouped | `state.params` |
| `MediaPanel` | Media grid + drag reorder + order controls | `state.media` |
| `TextPanel` | Title / labels / logo sections | `state.style.title/labels/logo` |
| `ExportPanel` | All export settings + social presets | `state.export` |

**UI-only state** (not part of the project, never saved into the project file) lives in a separate small store: which rail tab, which panel tab, search text, which sections are expanded, hover state.

### 5.3 The canvas component

```tsx
export function StageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const renderer = new Renderer(canvasRef.current!);   // create ONCE
    let raf = 0, last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const store = useProject.getState();
      if (store.dirty) {
        const state = store.state;
        const clock = useClock.getState();            // playhead, separate store
        if (clock.playing) clock.advance(dt);

        const desc = buildFrame(state, clock.t, width, height);
        renderer.render(desc);
        store.clearDirty();
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); renderer.dispose(); };
  }, []);

  return <canvas ref={canvasRef} />;
}
```

**Three rules for this component:**
1. It never re-renders in React terms — no state in it, ever.
2. The `Renderer` is created once and disposed on unmount.
3. It handles `webglcontextlost` (prevent default, show "restoring…") and `webglcontextrestored` (recreate every program, buffer and texture, then mark dirty). **The original doesn't do this and it's a real bug.**

### 5.4 The playhead store (separate from project state)

```ts
useClock: { t: number; playing: boolean; advance(dt): void; seek(t): void; toggle(): void }
```

Keep time **out of** `ProjectState`. It isn't project data, it must never be saved, and it must never appear in an undo snapshot.

---

## 6. The control library

Eight components. Every control in the entire app is one of these.

| Component | Behaviour requirements |
|---|---|
| **`Slider`** | Custom-drawn (fill + knob + value label), `role="slider"`. Pointer capture during drag. **Shift+drag = 15% sensitivity for fine control.** Arrow keys ±step, Shift+arrow ×10. **Double-click to type an exact value.** Calls `onChange` while dragging, `onCommit` on release. |
| **`Segmented`** | Row of buttons, active gets `.on`. One click = `set` + `commit`. |
| **`Select`** | Native `<select>`, styled. `onChange` = `set` + `commit`. Coerces to number when the current value is numeric. |
| **`Toggle`** | `role="switch"`, animates. One click = `set` + `commit`. |
| **`ColorInput`** | Native colour picker + hex text field. `onInput` = `set`, `onChange` = `commit`. |
| **`TextInput`** | `onInput` = `set`, `onChange` = `commit`. |
| **`Section`** | Collapsible panel with title, optional subtitle, optional on/off switch in the header, optional reset button. Remembers open/closed in UI state, **not** in the DOM. |
| **`ControlRenderer`** | The schema → widget dispatcher (§3.3). |

**"Modified" marker:** a control whose value differs from its schema default gets a visual indicator, and a section containing any modified control gets a `.mod` class. Both come from comparing `state` against the schema — free, because we have a schema.

**Scroll preservation:** when a panel genuinely must rebuild (tab switch), preserve `scrollTop` of both side panels. In React this is mostly unnecessary — components stay mounted — but keep the behaviour for panel swaps.

---

## 7. The roadmap

**Each milestone ends with something you can see working.** Don't start the next one until the current one's check passes.

---

### ▶ Milestone 0 — Project setup
*~half a day*

- [ ] Follow §1: install Node, create the Vite project, run `npm run dev`
- [ ] Install `zustand`, `fflate`, `vitest`
- [ ] Create the full folder skeleton from §2 (empty files are fine)
- [ ] Copy the colour variables, fonts and panel dimensions out of `Reference\...\css\app.css` into `styles/tokens.css`
- [ ] Run `npm run typecheck` — it must pass

**✅ Check:** `npm run dev` runs, the page loads, typecheck passes, folder tree exists.

---

### ▶ Milestone 1 — The screen, static
*2–4 days*

Build the whole interface **with no functionality** — placeholder content, correct dimensions and styling.

- [ ] `App.tsx` with the exact grid from §5.1
- [ ] `Header` — logo, project name field, save-status text, undo/redo, theme toggle, Export button, help
- [ ] `Rail` — 4 buttons that switch a `ui.rail` value
- [ ] `LeftPanel` / `RightPanel` — correct sizes, correct tab bars, correct scroll behaviour
- [ ] `Toolbar` — all 8 buttons in the right order
- [ ] `Timeline` — play button, track, playhead, time text (not wired yet)
- [ ] `Stage` — a grey rectangle where the canvas will go
- [ ] Light/dark themes, applied before first paint (a tiny inline script in `index.html`, as the original does)
- [ ] Modal + toast containers

**✅ Check:** Put a screenshot of the real AlignCanvas next to yours. They should be hard to tell apart at a glance.

---

### ▶ Milestone 2 — The canvas engine draws *something*
*1–2 weeks — the hardest single stretch*

- [ ] `render/Renderer.ts` — WebGL2 context, program compiler, framebuffer cache
- [ ] Shaders: `common`, `vertex/full`, `bg` (solid only to start)
- [ ] `engine/buildFrame.ts` returning a `FrameDescriptor` with one hardcoded card
- [ ] `engine/camera.ts` — perspective + lookAt, aspect-fit
- [ ] `render/Renderer.ts` — draw background, sort cards, draw one card
- [ ] `StageCanvas` with the rAF loop and dirty flag (§5.3)
- [ ] Handle context loss (§5.3 rule 3)

**✅ Check:** A single card floats in 3D on screen and renders at 60fps.

---

### ▶ Milestone 3 — Controls drive the canvas
*1 week*

- [ ] `state/types.ts`, `state/defaults.ts` with the full `StyleTree` (§3.2)
- [ ] `state/store.ts` with the `set` / `commit` split (§3.6) ★
- [ ] The 8 control components (§6), **starting with `Slider`** — get its Shift-drag and double-click behaviour right, you'll use it 150 times
- [ ] `ControlRenderer` (§3.3)
- [ ] `VisualPanel` sections for: **Cards, Camera, Effects** (the simplest three)
- [ ] Wire `card`, `camera`, `fx` groups to the renderer
- [ ] `engine/timing.ts` + play/pause + scrubbing

**✅ Check:** Drag the Zoom slider and the card moves. Drag Contrast and the picture changes. Pause, scrub, and time changes the frame.

---

### ▶ Milestone 4 — The first templates
*2 weeks*

- [ ] `templates/types.ts` (§3.4), `templates/kit.ts` (easing, matrices, `wrapFade`, param factories)
- [ ] `templates/params.ts` — `defaults()`, `controlGroups()`
- [ ] `state/history.ts` (§3.7) + undo/redo buttons + ⌘Z
- [ ] **Build 5 templates** across different families — one continuous carousel, one stepped stack, one ring, one grid, one with a custom `camera()`
- [ ] `TemplateBrowser` — search, category accordions with counts, thumbnail grid
- [ ] **Live thumbnails**: render each template at 320×256 into an offscreen canvas, 10ms per frame from a queue; hovering plays it
- [ ] Switching a template swaps `params` and `style` (respecting `keepStyle`)
- [ ] `ControlsPanel` — groups, per-group reset, modified markers

**✅ Check:** Browse, hover to preview, click to apply. Controls appear for that template. Undo works.

---

### ▶ Milestone 5 — The look (all 14 effect groups)
*3–4 weeks*

Work through the effects table in §4.4 of the audit, one group at a time, in this order — each builds on the last:

1. [ ] **`bg`** — all 10 modes, all palettes, transparency
2. [ ] **`shadow`** — soft rounded drop shadow
3. [ ] **`shade`** + **`card`** — rim light, back faces, tint, brightness, corners, thickness (`side` shader)
4. [ ] **`fx`** — exposure, contrast, saturation, vignette, grain, bloom, chromatic aberration (the whole post grade)
5. [ ] **`blur`** — depth of field via the 4-layer blur pyramid + edge blur via mip LOD
6. [ ] **`glass`** — the liquid-glass edge smear with **spectral dispersion** ★ the signature look
7. [ ] **`cardGlass`** — per-card rim refraction
8. [ ] **`lens`** — the floating glass / black-hole lens
9. [ ] **`camera` drift**, **`anim`** text/logo in-out envelope

At the same time, add every remaining style section to `STYLE_SECTIONS` so all ~90 controls exist.

**✅ Check:** The nine one-click style presets each produce a visibly different, attractive result. Liquid glass looks as good as the reference.

---

### ▶ Milestone 6 — Media
*1–1.5 weeks*

- [ ] `media/ingest.ts` — classify, downscale to 2400px, decode
- [ ] `media/store.ts` — IndexedDB (`media` + `projects` stores), by-reference storage
- [ ] `media/video.ts` — hidden looping holders, poster frames, exact seek
- [ ] `engine/media.ts` — assign items to cards, in-order and seeded-shuffle
- [ ] **Drag-and-drop anywhere on the window** + paste + file picker, with the drop overlay
- [ ] `MediaPanel` — grid, **HTML5 drag to reorder**, remove one, remove all, order mode, reshuffle
- [ ] Stock library (search, tags, multi-select)
- [ ] Texture cache with LRU eviction
- [ ] Garbage collection of unreferenced media (only if older than 24h)

**✅ Check:** Drop five photos from your desktop onto the page. They land on the cards. Drag them into a different order. The order changes.

---

### ▶ Milestone 7 — Time, saving and projects
*1.5–2 weeks*

- [ ] Duration control with **Auto = one loop**, and the seamless "runs at 1.04×" fitting
- [ ] Frame stepping (←/→, Shift = 10 frames), Home
- [ ] localStorage draft autosave at 400ms + IndexedDB project autosave at 1200ms
- [ ] `#saveState` indicator: Draft / Saving… / Saved / Not saved
- [ ] `ProjectPanel` — save, save as, list with thumbnails and relative times, rename, duplicate, delete, open, new
- [ ] Portable project files: save `.json` with media inlined, and open them back
- [ ] Schema migration (`migrate.ts`) so future changes don't break old projects
- [ ] `TextPanel` — title, corner labels, logo (logo uploads into IndexedDB)

**✅ Check:** Close the tab, reopen it — your work is exactly as you left it. Save two projects and switch between them.

---

### ▶ Milestone 8 — Export
*1–1.5 weeks*

- [ ] Bundle `mp4-muxer`, `webm-muxer`, `gifenc`, `fflate` locally (no CDN)
- [ ] `export/video.ts` — WebCodecs loop from §10 of the audit, with backpressure and keyframes every 2s
- [ ] `export/gif.ts`, `export/sequence.ts`, `export/still.ts` (+ clipboard)
- [ ] `prepareFrame()` — exact video seeking before each frame, `renderer.exact`
- [ ] `ExportPanel` — every setting, social presets, live summary line
- [ ] Progress modal with **bar, ETA, and a working Cancel** (AbortController)
- [ ] **No clamping, no export counter, no server call** (§3.2 of Part 2)

**✅ Check:** Export a 1080p 60fps MP4, a GIF and a PNG — with no account and no limit. The first frame matches the last when Seamless is on.

---

### ▶ Milestone 9 — Parity pass
*1 week*

Go through this list against the real app, side by side:

- [ ] All 13 keyboard shortcuts
- [ ] The 9-step guided tour
- [ ] Shortcuts modal (`?`)
- [ ] "Surprise me" (`R`) random look
- [ ] Guides (`G`) and social safe zones
- [ ] Fullscreen (`F`)
- [ ] Theme toggle (`T`) + system following
- [ ] Toasts, all of them
- [ ] All nine style presets, all ten palettes
- [ ] The stock library
- [ ] Brand kit (colours, fonts, logo)
- [ ] Every one of the ~90 style controls present, at the right range

**✅ Check:** The §6 "Definition of done" list from Part 2, all ten items.

---

### ▶ Milestone 10 — Harden it
*1 week*

- [ ] Performance: preview quality tiers, quantised texture sizes, time-sliced thumbnails, mip-chain blur
- [ ] GPU memory budget (cap textures; the original doesn't and can exhaust memory at 4K)
- [ ] Context-loss recovery, tested by toggling hardware acceleration
- [ ] Tests green (§8)
- [ ] `npm run build` produces a working bundle; test it as a plain static site
- [ ] Accessibility pass: focus states, ARIA on every control, keyboard reachable
- [ ] Run the `break-ui` stress test — long names, 80 images, 0 images, huge numbers, emoji

---

### ▶ Milestone 11 — Templates 21 → 166
*Several weeks, mechanical*

Now the pipeline is proven, port the rest in batches of ~20:

| Batch | Count | Notes |
|---|---|---|
| Remaining core | ~63 | transitions, carousel, ring, stack, 3d, glass |
| `-x` file | 36 | gallery, kinetic, sculpture |
| `-y` file | 22 | signature + stragglers |
| choreo a–j | 40 | the hardest — hand-written physical motion |
| **Total** | **166** | |

Each batch: port the template data, verify `layout()` periodicity (§8), check its parameter groups render, confirm the loop is seamless.

**Keep `flare-duo` isolated** behind its own interface so its special case can't leak into six files the way it does in the original.

---

### ▶ Phase 2 — Extensions (after parity)

| Feature | What's needed |
|---|---|
| **Layer panel** | Visibility toggles, rename, lock; `MediaItem` gains `visible: boolean` and `buildFrame` skips hidden items |
| **Click-to-select a card** | GPU picking — render a small offscreen pass writing card IDs, read the pixel under the cursor |
| **Manual z-order** | Override the depth sort with an explicit order field |
| **Canvas pan/zoom** | Viewport transform in `layout()`, separate from `camera.zoom` |
| **Keyframe timeline** | Per-track keyframe diamonds; an evaluator that produces `state` at time `t` before calling `buildFrame` — **still a pure function of time, so export stays frame-perfect** |

Keyframes are the largest Phase 2 item. Do them last, and keep the purity invariant: `evaluateAt(state, t) → state`, then `buildFrame(evaluateAt(state, t), t)`. Both stages stay pure.

---

## 8. Testing strategy

The (state, time) → frame architecture makes this unusually easy. You can test all the hard logic **without a GPU**.

### 8.1 Unit tests — no browser needed

```ts
// engine/timing.test.ts
it('fits whole loops when seamless is on', () => {
  const state = makeState({ export: { ...defaults, duration: 5, seamless: true } });
  const { loop, rate, loops } = clipInfo(state);
  expect(loops * loop / rate).toBeCloseTo(5);      // the loops fill exactly 5s
});

// templates/periodicity.test.ts — ★ runs against EVERY template
it.each(ALL_TEMPLATES)('$id returns the same pose at phase 0 and 1', (t) => {
  const params = defaults(t);
  const env = makeEnv({ p: 0, ...params });
  const envEnd = makeEnv({ p: 1 - 1e-9, ...params });
  expectClose(t.layout(0, params, env), t.layout(0, params, envEnd));
});
```

**That periodicity test is the single highest-value test in the project.** It runs over all 166 templates and catches the exact class of bug that makes loops visibly jump.

### 8.2 What to test

| Layer | Test | Needs a GPU? |
|---|---|---|
| Timing maths | loop/clip/seamless/rate | No |
| **Template periodicity** | pose at phase 0 ≈ phase 1, for every template | No |
| Parameter defaults | `defaults(t)` returns every declared key | No |
| Migration | an old save upgrades without losing data | No |
| History | one drag = one snapshot; media re-resolved by id | No |
| Store invariant | `set()` never pushes history; `commit()` always does | No |
| `buildFrame` purity | same input twice → deeply equal output | No |
| Descriptor shape | every card has its 4 textures, matrices are 16 floats | No |
| WebGL smoke test | context creates, renders one frame without error | Yes (headless) |
| Export | 10-frame MP4 has the right duration | Yes (headless) |

### 8.3 Visual regression (optional but powerful)

Export frame 30 of a fixed project as a PNG, and compare it to a stored baseline with a small tolerance. Now you know a shader change didn't quietly break liquid glass.

---

## 9. Risks and how to handle them

| Risk | Why it matters | How to handle |
|---|---|---|
| **The shaders are the hard part** | `shaders.js` is 508 lines of dense GLSL; dispersion and the lens especially | Port them **verbatim first** (they're self-contained), verify each visually, refactor only after it works. Don't rewrite working shader code while porting |
| **166 templates is a mountain** | Each is hand-written maths | Ship 20 first (decided). The periodicity test makes batching safe. Reorder so the hardest (choreo) come last |
| **Losing the purity invariant** | It's what makes export correct and testing possible | Code review rule: no `performance.now()`, no unseeded random, no accumulated state in `engine/` |
| **The style inspector grows back into spaghetti** | The original's biggest weakness | §3.3: everything is schema data. If you ever write a literal path inside a component, stop |
| **Undo granularity drifts** | One drag = many undo steps feels broken | Test the invariant (§8.2). Never call `commit()` from `set()` |
| **GPU memory at 4K** | 160 textures × 4 images × 4K can exhaust memory | Quantise texture sizes to a ladder; cap the cache; budget total VRAM |
| **Video export drifts** | Videos are the one non-deterministic input | Always `prepareFrame()` + seek-and-wait + the `exact` flag, before every frame |
| **CDN dependencies** | Original loads 4 libraries at runtime | Bundle them (installed in Milestone 0) |
| **Scope creep into keyframes/layers** | Easy to start before parity | They're explicitly Phase 2. Parity first (decided) |
| **Copying excluded code by accident** | Auth/billing gates are woven into the controls | Part 2 §3 is the removal checklist — walk it at Milestone 9 |

---

## 10. One-page summary

```
WHAT      A faithful rebuild of the AlignCanvas editor: React + TypeScript + Vite,
          WebGL2 rendering, no backend, no auth, no billing, no AI, no tracking.

CORE IDEA One frame = pure function of (settings, time).
          Protect this above everything else.

SIX FILES state/types.ts     the project shape
          state/store.ts     set() vs commit() — undo granularity
          engine/buildFrame  (settings, time) → frame descriptor
          templates/types    template + parameter schema
          render/Renderer    WebGL, knows nothing about the project
          ui/ControlRenderer schema → widget

ORDER     Setup → screen → canvas → controls → templates → effects →
          media → time/saving → export → parity → harden → 146 templates → Phase 2

V1 DONE   Ten things a stranger can do without instruction (Part 2 §6)
```

---

**Previous:** [Part 1 — Architecture Audit](./01-ARCHITECTURE-AUDIT.md) · [Part 2 — Scope Definition](./02-SCOPE.md)
