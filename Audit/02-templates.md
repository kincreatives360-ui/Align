# Audit 02 — Template, Parameter & Choreography Systems

Source: captured copy at `Reference\sites\aligncanvas.com\js\`
Primary files: `templates.js`, `templates-x.js`, `templates-y.js`, `templates-z.js`, `choreo-a.js` … `choreo-j.js`, `kit.js`, `state.js`, `flare.js`, `engine.js`, `ui.js`, `main.js`, `renderer.js`

---

## 1. Template object schema and `kind`

### 1.1 The documented contract

The whole system is defined by the header comment of `templates.js:1–6`:

```js
// The template library. Each template places its cards in 3D for a loop phase p in [0,1), so every
// animation loops seamlessly. World units: the frame is 2 tall at z = 0; x spans ±aspect.
//
// layout(i, P, E) returns {x,y,z, rx,ry,rz, s, o, blur, b, glare, zBias, bend, aspect?, w?, h?} or {m: matrix, ...}
//   P = this template's parameters, E = {p, n, asp, w, h, D, rnd(i,k), ez, hold}
// camera(P, E) may return {eye, target}; a template's own field of view is `fov` (degrees).
```

`templates-x.js:1–2` and `templates-y.js:1–2` repeat the same contract verbatim ("Same contract as templates.js: layout(i, P, E) places card i for the loop phase E.p in [0,1), and every value is periodic in E.p"), as does `choreo-a.js:1` ("Same contract as templates.js").

### 1.2 Field inventory

| Field | Type | Meaning | Example |
|---|---|---|---|
| `id` | string | stable registry key used by `state.template` / `byId()` | `'revolving-door'` (choreo-a.js:37) |
| `name` | string | display name in the browser & Controls header | `'Flare Duo'` (templates.js:31) |
| `cat` | string | one of the 11 `CATEGORIES` keys | `'transitions'` |
| `kind` | `'flare'` \| absent | runtime mode switch (see §7); **only one non-default value exists** | `kind: 'flare'` (templates.js:31) |
| `n` | number | default card count → `params.count` default | `n: 8` |
| `set` | string | nominal media set; **always `'photos'`, never read at runtime** (engine hardcodes it, §3) | `set: 'photos'` |
| `aspect` | number | card aspect (w/h) used by `cardAspect()` (engine.js:20–24) | `aspect: 1.8` |
| `cardH` | number | card height in world units (default `.8`) | `cardH: .92` (choreo-a.js:37) |
| `frame` | string | design aspect; a mismatched preview aspect zooms out (`fit`, engine.js:125) | `frame: '5:4'` |
| `fov` | number (degrees) | template's own field of view, `baseFov = t.fov \|\| 30` (engine.js:118) | `fov: 38` |
| `dur` | number | loop duration in seconds for continuous templates | `dur: 12` (choreo-a.js:37) |
| `step` | `true` | stepped template: duration is per-card (§5) | `step: true` (templates.js:34) |
| `perCard` | number | seconds per card for `step` templates (default `1.4`) | `perCard: 1.8` (templates.js:34) |
| `fixedN` | `true` | card count fixed at `t.n`; hides the Cards slider | `controlGroups` filters `count` (templates.js:1121) |
| `resBoost` | number | texture-resolution multiplier | — |
| `isNew` | `true` | "New" badge in the browser (ui.js:198) | `NEW = {..., isNew: true}` in every split file |
| `desc` | string | tooltip/description under the Controls title | — |
| `style` | object | per-template look layered over `BASE_STYLE` (§6) | `style: {card: {back: 'solid', ...}}` (choreo-a.js:65) |
| `params` | array | **declarative control schema** (§4) | templates.js:37–41 |
| `mods` | object | literal param overrides merged last in `defaults()` | `Object.assign(P, t.mods \|\| {})` (templates.js:1115) |
| `fill(P, E)` | fn | may multiply/derive slots → returns extras assigned onto `E`, incl. `count` | choreo-a.js:45,79 |
| `camera(P, E)` | fn | returns `{eye, target}` (engine.js:123) | choreo-a.js:46–49 |
| `layout(i, P, E)` | fn | **the animation**; returns pose object or `{m: matrix, ...}` | choreo-a.js:50–61 |

### 1.3 The `E` environment object

Built in `engine.js:122`:

```js
const E = {p, n, asp: W / H, w, h, D, rnd: (i, k) => hash(i + 1, k + 7, seed), ez: ease[P.ease] || ease.inOutQuint, hold: P.hold ?? .5};
```

…and augmented before `fill` runs (engine.js:140–144):

```js
E.vy = (far + Math.abs(P.offY || 0)) / gs;
E.vx = (far * E.asp + Math.abs(P.offX || 0) + Math.abs(P.panX || 0)) / gs;
E.m = n;
if (t.fill){ const F = t.fill(P, E); Object.assign(E, F); N = F.count; }
```

- `E.p` = eased loop phase in `[0,1)` (`wrap(T2 / duration(t, P), 1)`, engine.js:111; direction flips it at engine.js:112).
- `E.vx/E.vy` = visible world extent (for `fill` helpers), `E.m` = pre-fill count, `E.rnd(i,k)` = seeded per-card random (seeded by `media.seed`), `E.ez/E.hold` = the active easing curve and hold fraction for stepped motion.
- Anything `fill()` returns (e.g. `{W, two, count}`) becomes extra `E.*` fields visible to `layout`.

### 1.4 `kind` values

Only two runtime cases exist across the entire codebase:

1. **absent / undefined** — every one of the 165 normal templates.
2. **`'flare'`** — exactly one template, `flare-duo` (templates.js:31).

Branch points (exhaustive):

| File:line | Code |
|---|---|
| `state.js:57` | `export function templateParams(t){ return t.kind === 'flare' ? flareDefaults(t.n) : defaults(t); }` |
| `templates.js:1133` | `if (t.kind === 'flare') return null;` (inside `duration()`) |
| `engine.js:27` | `const d = t.kind === 'flare' ? flareDuration(P, P.count) : duration(t, P);` |
| `engine.js:100` | `if (t.kind === 'flare'){ … return desc; }` (early-out of `buildFrame`) |
| `ui.js:235` | `if (t.kind === 'flare'){ … FLARE_PARAMS … }` (inspector bypass, §4) |
| `main.js:635` | `if (t.kind === 'flare'){ const P = s.params; return P.hold + P.antic + P.sweep * .42; }` (thumbnail timing) |

There is no `'grid'`, `'carousel'` or other kind — behavioral family is expressed by `cat` + `step` + `layout`, not by `kind`.

---

## 2. Registry, categories, counts, and the x/y/z split

### 2.1 Registry assembly

`templates.js:1059–1063`:

```js
  // the 36 gallery, kinetic and sculpture templates
  ...X_TEMPLATES,
  ...Y_TEMPLATES,
  ...Z_TEMPLATES,
];
```

Lookup (templates.js:1110):

```js
export const byId = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
```

(`|| TEMPLATES[0]` is the fallback used by `upgrade()` when a saved template id no longer exists — §8.)

### 2.2 Categories

`templates.js:9–12`:

```js
export const CATEGORIES = [
  ...Y_CATEGORIES, ['transitions', 'Transitions'], ['carousel', 'Carousel & Slider'], ['ring', 'Ring & Orbit'], ['stack', 'Stack & Grid'],
  ['3d', '3D Showcase'], ['glass', 'Liquid Glass'], ...X_CATEGORIES, ...Z_CATEGORIES,
];
```

The three split files each export their own category slice:

- `templates-x.js:7` — `export const X_CATEGORIES = [['gallery', 'Infinite Gallery'], ['kinetic', 'Kinetic'], ['sculpture', 'Sculpture']];`
- `templates-y.js:7` — `export const Y_CATEGORIES = [['signature', 'Signature']];`
- `templates-z.js:13` — `export const Z_CATEGORIES = [['choreo', 'Choreography']];`

### 2.3 File split

| File | Export | Contents | Count |
|---|---|---|---|
| `templates.js` | `TEMPLATES` (core) | Transitions 10, Carousel 13, Ring 15, Stack 16, 3D 10, Glass 4 | **68** |
| `templates-x.js` | `X_TEMPLATES` (`GALLERY` 12, `KINETIC` 13, `SCULPTURE` 11) | gallery / kinetic / sculpture | **36** |
| `templates-y.js` | `Y_TEMPLATES` (`SIGNATURE` 10 + 12 more) | Signature 10; plus carousel 3, ring 2, stack 4, kinetic 1, gallery 1, 3d 1 | **22** |
| `templates-z.js` | `Z_TEMPLATES` | eager concat of `CHOREO_A`…`CHOREO_J` | **40** |
| **Total** | | | **166** |

`templates-z.js` is **not** a lazy loader — it statically imports all ten batches (templates-z.js:2–11) and spreads them (templates-z.js:14):

```js
export const Z_TEMPLATES = [...CHOREO_A, ...CHOREO_B, ...CHOREO_C, ...CHOREO_D, ...CHOREO_E, ...CHOREO_F, ...CHOREO_G, ...CHOREO_H, ...CHOREO_I, ...CHOREO_J];
```

### 2.4 Counts by category (166 total)

| cat | count | source |
|---|---|---|
| `choreo` | 40 | choreo-a..j |
| `stack` | 20 | core 16 + y 4 |
| `ring` | 17 | core 15 + y 2 |
| `carousel` | 16 | core 13 + y 3 |
| `kinetic` | 14 | x 13 + y 1 |
| `gallery` | 13 | x 12 + y 1 |
| `sculpture` | 11 | x 11 |
| `3d` | 11 | core 10 + y 1 |
| `transitions` | 10 | core 10 (incl. `flare-duo`) |
| `signature` | 10 | y 10 |
| `glass` | 4 | core 4 |

The browser groups by `CATEGORIES` order and filters `TEMPLATES.filter(t => t.cat === ck …)` (ui.js:187–188); search matches `name + cat label + desc` (ui.js:188).

---

## 3. Media slots, cards, `media.set | order | seed`, and `kit.js`

### 3.1 State shape

`state.js:65`:

```js
media: {set: 'auto', order: 'in', seed: 1, images: []},
```

with the comment at state.js:63: `// images: your media in card order, images and videos alike: {id, kind: 'image'|'video', name, w, h, dur?}`.

### 3.2 Card count and slots

- `params.count` (label "Cards", `COMMON_PARAMS`, templates.js:1070) drives the number of cards unless `t.fixedN` — engine.js:110:

  ```js
  const n = t.fixedN ? t.n : Math.max(1, Math.round(P.count));
  ```

  `controlGroups` drops the Cards slider for fixed templates (templates.js:1121: `COMMON_PARAMS.filter(p => !(p.key === 'count' && t.fixedN))`).

- **`fill(P, E)` can multiply slots** beyond `count` — engine.js:144 assigns the returned `count` as the card total `N`, and other returned keys become `E.*`:
  ```js
  // choreo-a.js:45 — revolving door: 2 cards per wing, both sides
  fill: (P, E) => { const W = Math.round(P.wings), two = P.sides !== 'one'; return {W, two, count: W * (two ? 2 : 1)}; },
  // choreo-a.js:79 — ribbon: front + back photo for every card
  fill: (P, E) => ({count: E.n * (P.backs === 'plain' ? 1 : 2)}),
  ```
- A layout return may select the image slot with `img:` (choreo-a.js:60: `return {m, bend: back ? -k : k, b: …, blur: …, img: i};`) — the back cards of the ribbon reuse `img: i % n`.

### 3.3 Item resolution: `mediaItems` / `orderFor` / `itemFor` (engine.js:40–61)

```js
export function mediaItems(app, t){
  const st = app.state, imgs = st.media.images.filter(m => app.images.get(m.id));
  if (imgs.length) return imgs.map(m => { … return {kind: vid ? 'video' : 'image', img: el, key: 'img:' + m.id + (vid ? '#v' : '')}; });
  // only the bundled photos are used as built-in media
  const set = 'photos';
  …
}
function orderFor(st, n){
  const idx = Array.from({length: n}, (_, i) => i);
  if (st.media.order === 'scatter'){ const R = mulberry(st.media.seed || 1); for (let i = n - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } }
  return idx;
}
const itemFor = (items, order, i) => items[order[i % order.length] % items.length];
```

Key points:

- **Priority**: user uploads/library first; the bundled `MEDIA_SETS.photos` is fallback only.
- **`media.order`** = `'in'` (default) | `'scatter'`; **`media.seed`** = Fisher–Yates seed (ui.js:281–282 exposes "Order" seg + a "Reshuffle" button that does `app.set('media.seed', (st.media.seed || 1) + 1)`).
- The same seed also feeds `E.rnd(i,k)` (engine.js:121–122) — one seed drives both shuffle and per-card randomness.
- **`t.set` and `media.set` are effectively dead fields**: `media.set: 'auto'` is never read, and `mediaItems` hardcodes `const set = 'photos'` (with `if (set === 'mixed')` dead branch at engine.js:48). Every template still declares `set: 'photos'` for documentation only.

### 3.4 `kit.js` — shared layout & fill helpers

Exported utilities used by all four template files (kit.js:4–47):

| Group | Symbols |
|---|---|
| stepped motion | `rel(i,u,n)` (wrapped card distance), `stepU(p,n,hold,ez)`, `stepSpeed(p,n,hold,ez)` |
| fades | `wrapFade(r,n)` — `clamp01((n/2 - ab(r)) * 1.5)` fades cards that wrap around the loop seam (kit.js:15) |
| slot filling | `fillSlots`, `stripFill(E,v,pitch)`, `laneFill(E,v,pitch,lanes)`, `FILL_X(P,E)`, `FILL_Y(P,E)` — compute how many copies a strip needs to cover the visible extent |
| matrices | `M, T, RX, RY, RZ, S, aim, frame3, tiltPt, fibo` |
| shared param factories | `P_HOLD`, `P_EASE`, `P_GAP(def)`, `P_TILT(def,label)`, `P_RADIUS(def)`, `P_CURVE(def)`, `P_COLS(def,max)`, `P_SPREAD(def)` |

`templates-x.js`/`templates-y.js` re-declare tiny local factories (`range`, `whole`, `off`, `grp`/`G`, `seg`) that produce the same `{key,label,type,min,max,step,def}` descriptor objects (templates-x.js:10–16).

---

## 4. CRITICAL: params are a declarative schema driving the inspector

**Answer: yes — `defaults(t)`/`flareDefaults(n)` consume a declarative `params[]` schema, and the inspector renders controls purely from that schema.** There is no hand-written per-template UI code anywhere.

### 4.1 The schema

A `params[]` entry is either a group header `{group: 'Layout'}` or a control descriptor:

```js
{key, label, type, min, max, step, def, unit?, hint?, off?, percent?, auto?, options?, rebuild?}
```

Real template example (`templates.js:37–41`, Prism Slider):

```js
params: [{group: 'Layout'}, P_GAP(.06), {key: 'prismDepth', label: 'Prism depth', type: 'range', min: .3, max: 2.5, step: .01, def: 1, unit: '×'},
  {key: 'axisTilt', label: 'Axis tilt', type: 'range', min: -.6, max: .6, step: .01, def: 0}, …
  {group: 'Motion'}, {key: 'lean', label: 'Lean in turn', type: 'range', min: -1, max: 1, step: .01, def: 0}, …
  {group: 'Look'}, {key: 'reach', label: 'Visible faces', type: 'range', min: -.5, max: 1, step: .01, def: .05}, …
```

`def` is the single source of truth: it seeds `defaults(t)`, and the Controls panel resets against it.

### 4.2 `defaults(t)` (templates.js:1111–1117)

```js
export function defaults(t){
  const P = {count: t.n, speed: 1, dir: '1', hold: .5, ease: 'inOutQuint'};
  MOD_GROUPS.forEach(g => g.params.forEach(p => { if (p.key) P[p.key] = p.def; }));
  (t.params || []).forEach(p => { if (p.key) P[p.key] = p.def; });
  Object.assign(P, t.mods || {});
  return P;
}
```

Precedence: base → **every modifier group** → **the template's own params** → literal `t.mods`. Note defaults are built from *descriptors*, not hardcoded values.

And the dispatch point (`state.js:57`):

```js
export function templateParams(t){ return t.kind === 'flare' ? flareDefaults(t.n) : defaults(t); }
```

`flareDefaults` is the same idea over `FLARE_PARAMS` (flare.js:61–65):

```js
export function flareDefaults(n){
  const P = {count: n};
  FLARE_PARAMS.forEach(p => { if (p.key && p.def !== undefined) P[p.key] = p.def; });
  return P;
}
```

### 4.3 The schema-driven inspector (`ui.js`)

`paramControl(app, p)` (ui.js:213–227) is a pure `p.type` dispatch — **the only control renderer in the app**:

```js
function paramControl(app, p){
  const path = 'params.' + p.key;
  if (p.type === 'range'){ … const r = slider(app, p.label, path, {min: p.min, max: p.max, step: p.step, fmt}); if (p.hint) r.title = p.hint; return r; }
  if (p.type === 'seg') return seg(app, p.label, path, p.options, {rebuild: p.rebuild});
  if (p.type === 'select') return select(app, p.label, path, p.options);
  if (p.type === 'toggle') return toggle(app, p.label, path, {rebuild: true});
  if (p.type === 'color') return color(app, p.label, path);
}
```

Value formatting is also schema-driven (`p.off → 'off'`, `p.auto → 'auto'`, `p.percent → %`, `p.unit` of `'°' | '×' | ' turns' | 's'`, ui.js:216–218).

`controlsPanel` (ui.js:240–250) iterates `controlGroups(t, P)` and maps `g.params.map(p => p.group ? h('div', …p.group) : paramControl(app, p))`; each group gets a reset button that restores `D = defaults(t)` keys (ui.js:243–245). Pro templates short-circuit before any controls render (ui.js:234).

### 4.4 Control types inventory

| `type` | widget | descriptor extras |
|---|---|---|
| `range` | slider (double-click to type, Shift-drag fine, ui.js:253) | `min, max, step, def, unit, hint, off` (shows `off` at 0), `percent`, `auto` (shows `auto` at 0) |
| `seg` | segmented buttons | `options: {value: label}`, `rebuild` |
| `select` | dropdown | `options` |
| `toggle` | on/off button | `def: false` (always `rebuild: true`) |
| `color` | color input | `def: '#…'` |
| (header) | `{group: 'Layout'}` sub-heading | — |

### 4.5 Where schemas come from

- `COMMON_PARAMS` (templates.js:1069–1073): `count`, `speed`, `dir` — added to every template's first group.
- `MOD_GROUPS` (templates.js:1078–1109): nine shared modifier groups — `bend, depth, shape, pose, tilt, disp, transform, easing, anim` — each a `params[]` array of the same descriptors, applied in `engine.js` on top of any template layout ("Surface-style modifier groups: they work on top of any template's own layout (applied in engine.js)", templates.js:1077).
- `FLARE_PARAMS` (flare.js:37–60): the flare-only schema.
- Factories: `deg`, `cyc` (`hint: 'whole cycles per loop, so it stays seamless'`), `off` (templates.js:1074–1076); `P_HOLD, P_EASE, P_GAP, P_TILT, P_RADIUS, P_CURVE, P_COLS, P_SPREAD` (kit.js:40–47); local `range/whole/turns/off/grp/seg` in each split file.

Group construction and conditional groups (`controlGroups`, templates.js:1119–1129):

```js
const own = (t.params || []).filter(p => p.key !== 'ease');
const groups = [{id: 'template', title: t.name, params: [...COMMON_PARAMS.filter(p => !(p.key === 'count' && t.fixedN)), ...own]}];
for (const g of MOD_GROUPS){
  let ps = g.params;
  if (g.id === 'easing') ps = t.step ? [P_HOLD, P_EASE] : P.motion === 'stepped' ? ps : ps.slice(0, 1).concat(t.params?.some(p => p.key === 'ease') ? [P_EASE] : []);
  if (g.id === 'anim' && !P.animIn) ps = ps.slice(0, 1);
  groups.push({...g, params: ps});
}
```

Even the *group membership* is data-driven and reactive to parameter values (stepped mode, `animIn`). `paramsFor(t)` (templates.js:1130) flattens the same structure for validation/thumbs.

---

## 5. The choreography system (choreo-a … choreo-j)

### 5.1 Exports and structure

Each batch file exports a single array; `templates-z.js` aggregates them (quoted in §2.3). Every template spreads a shared prologue (choreo-a.js:13, same in b–j):

```js
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};
```

| Batch | Export | Count | Example ids |
|---|---|---|---|
| A | `CHOREO_A` | 3 | `revolving-door`, `ribbon-spread`, `twist-tower` |
| B | `CHOREO_B` | 4 | `amphitheatre`, `clothesline`, `barrel-wave`, `magic-carpet` |
| C | `CHOREO_C` | 5 | `atom`, `tesseract`, `roulette`, `echo-trail`, `galaxy` |
| D | `CHOREO_D` | 4 | `tumble`, `double-doors`, `starburst`, `opening-crawl` |
| E | `CHOREO_E` | 2 | `flag`, `runway` |
| F | `CHOREO_F` | 7 | `proximity-wave`, `proximity-dock`, `proximity-ring`, `repel-field`, `flicker` |
| G | `CHOREO_G` | 4 | `sheet-slide`, `slide`, `pulse-grid`, `wrap` |
| H | `CHOREO_H` | 4 | `ring-wave`, `slalom`, `waterfall`, `gymnast-ribbon` |
| I | `CHOREO_I` | 4 | `sign`, `swatch-fan`, `spiral-deal`, `s-wall` |
| J | `CHOREO_J` | 3 | `sketch-path`, `immersive`, `stamp` |
| **Total** | | **40** | |

Briefs are external docs: `// see tools/choreo-briefs.md` (A–E) / `tools/choreo2-briefs.md` (F–J).

### 5.2 How templates reference choreography

**They don't cross-reference.** There is no `choreo:` field, no choreography component registry, and no lookup from a normal template into a batch. A choreo template is an ordinary template object with `cat: 'choreo'` whose `layout(i, P, E)` contains hand-written physical motion; the only "reference" is (a) the spread of `NEW` and (b) the static concat in `templates-z.js:14`. Motion helpers are local functions per file (choreo-a.js:16–33), e.g.:

```js
const win = (p, a, b, ez = ease.inOutCubic) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
const springIn = (t, k) => { … };                                   // springy settle with overshoot
const doorTurn = (p, W, pause) => { const t = p * W; return t - pause * Math.sin(TAU * t) / TAU; };
const ribbonH = (p, P) => { const st = P.spreadTime; return win(p, .02, .04 + .2 * st, …) - win(p, .96 - .16 * st, .985, …); };
const towerWind = (p, P) => (1 - win(p, .07, .24, ease.inOutSine)) + springIn(clamp01((p - .8) / .17), P.overTwist);
```

### 5.3 Animation expression

The animation *is* the `layout(i, P, E)` function — a pure map from `(card index, parameters, loop phase)` to a pose. Two return forms:

1. **Euler form**: `{x, y, z, rx, ry, rz, s, o, blur, b, glare, zBias, bend, aspect?, w?, h?}` (templates.js:4).
2. **Matrix form**: `{m: M(T(...), RY(a), …), …}` built from `kit.js` `M/T/RX/RY/RZ/S` (e.g. choreo-a.js:57).

Representative choreography layout (choreo-a.js:50–61):

```js
layout(i, P, E){
  const W = E.W, wing = E.two ? i >> 1 : i, back = E.two && i % 2;
  const a = (wing + doorTurn(E.p, W, P.pause)) / W * TAU + P.rest * D2R, sp = doorSpeed(E.p, W, P.pause);
  const k = (P.wingCurve + P.flexW * .5 * (sp - 1)) / E.w, [ax, az] = edgeAnchor(k, E.w), r = P.hub + ax;
  const y = P.bob * .04 * Math.sin(TAU * E.p);
  const m = back ? M(T(0, y, 0), RY(a), T(r, 0, az - .003), RY(PI)) : M(T(0, y, 0), RY(a), T(r, 0, az + .003));
  const nz = (back ? -1 : 1) * Math.cos(a - P.camSide * .6), far = clamp01(Math.sin(a) * 1.2);
  return {m, bend: back ? -k : k, b: 1 - P.turnDim * Math.max(0, nz) * .75, blur: P.farBlur * far * .5, img: i};
}
```

The phase supplied to it is pre-processed by the engine (engine.js:111–115): `p = wrap(T2 / duration(t, P), 1)`, reversed for `P.dir === '-1'`, and for continuous templates optionally re-eased into stepped holds when `P.motion === 'stepped'`.

### 5.4 Loop duration & seamless looping

Duration (`templates.js:1131–1135`):

```js
// loop length in seconds at speed 1
export function duration(t, P){
  if (t.kind === 'flare') return null;
  return t.step ? (t.perCard || 1.4) * (t.fixedN ? t.n : P.count) : (t.dur || 10);
}
```

Loop/clip math (`engine.js:25–37`):

```js
export function loopLength(state){
  const t = byId(state.template), P = state.params;
  const d = t.kind === 'flare' ? flareDuration(P, P.count) : duration(t, P);
  return d / Math.max(.05, P.speed || 1);
}
export function clipInfo(state){
  const loop = loopLength(state), ex = state.export, clip = Math.max(.5, ex.duration || loop);
  if (!ex.seamless) return {loop, clip, rate: 1, loops: clip / loop};
  const loops = Math.max(1, Math.round(clip / loop));
  return {loop, clip, rate: loops * loop / clip, loops};
}
```

Seamlessness is achieved by four reinforcing mechanisms:

1. **Periodicity by construction** — `E.p ∈ [0,1)` wraps; the header contract requires "every value is periodic in E.p" (templates-x.js:2). `wrapFade` (kit.js:15) hides cards crossing the seam.
2. **Whole-cycle parameters** — `cyc()`/`turns()` factories constrain counts to integers with `hint: 'whole cycles per loop, so it stays seamless'` (templates.js:1075, templates-x.js:12–13).
3. **Clip fitting** — `clipInfo`'s `rate = loops * loop / clip` rescales time so a whole number of loops fits the chosen duration exactly (engine.js:98: `T = T * (opts.rate ?? clipInfo(st).rate)`).
4. **Text/logo animation** is likewise loop-aware (`state.js:22` comment: "animate … in at the start of the clip and out at its end, so loops stay seamless").

Stepped templates additionally use `stepU`/`rel` (kit.js:4–6) so cards hand off positions on eased holds rather than cutting.

---

## 6. `style` merge with `BASE_STYLE`

### 6.1 The mechanism

`state.js:47–57`:

```js
export function deepMerge(base, over){
  const out = clone(base);
  for (const k in over || {}){
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = clone(v);
  }
  return out;
}
export function templateStyle(t){ return deepMerge(BASE_STYLE, t.style || {}); }
```

- **Deep merge, not replace**: `t.style` over `BASE_STYLE` per leaf; arrays (e.g. `bg.c`) are replaced wholesale (`!Array.isArray` guard).
- `BASE_STYLE` (state.js:6–24) is the full look tree: `card, shadow, shade, blur, cardGlass, glass, lens, bg, fx, camera, title, labels, logo, anim` — with `shadow/shade/blur/cardGlass/glass/lens` all `on: false` by default and `bg: {mode: 'solid', c: ['#f4f4f4', …]}`.

### 6.2 Per-template style helpers (`templates.js:21–27`)

```js
// every template starts on the same plain #F4F4F4 background; colour is the user's choice in the Visual panel
const BG = () => ({});
// Surface-style glass rims: the image smears toward the edges with rainbow dispersion
const GLASS = (edges, o = {}) => ({glass: {on: true, mode: 'per', top: 0, bottom: 0, left: 0, right: 0, width: .28, refraction: .62, curve: 'panel', dispersion: .7, soften: .45, feather: 0, highlight: .32, bulge: .4, ...edges, ...o}});
const LR = (o) => GLASS({left: 1, right: 1}, o);
```

Usage: `style: {...BG(WARM), ...LR({width: .2, refraction: .7, bulge: .25})}` (templates.js:36). `BG()` returning `{}` is deliberate — templates contribute no background colour.

### 6.3 On template switch (`applyTemplate`, state.js:75–82)

```js
export function applyTemplate(state, id){
  const t = byId(id);
  state.template = t.id;
  state.params = templateParams(t);
  // labels keep your text but follow the template's on/off
  if (!state.keepStyle){ const {labels, logo, anim} = state.style; state.style = templateStyle(t); state.style.labels = {...labels, on: state.style.labels.on}; state.style.logo = logo; state.style.anim = anim; }
}
```

- **Params always reset** on switch; **style resets only when `keepStyle` is false**.
- User-owned overrides carried across: `labels` text (template controls only `on`), `logo`, `anim`. `STYLE_PRESETS` (state.js:27–37, e.g. `liquid`, `prism`, `noir`) layer one-click looks via the same `deepMerge` idea.

---

## 7. `kind: 'flare'` — the one special case

### 7.1 The template

`templates.js:31–33`:

```js
{id: 'flare-duo', name: 'Flare Duo', cat: 'transitions', kind: 'flare', n: 8, set: 'photos', aspect: 1.8, frame: '4:3',
  desc: 'The glass card hand-off: the old card is pushed off by a flaring edge.',
  style: {shadow: {on: true, alpha: .3}, labels: {on: true}}},
```

It has **no `layout`, no `params`, no `dur`** — everything lives in `flare.js`.

### 7.2 Its own schema and timing (`flare.js`)

```js
export const FLARE_PARAMS = [
  {key: 'count', label: 'Cards', type: 'range', min: 2, max: 30, step: 1},
  …
  {group: 'Timing'},
  {key: 'hold', … def: .27, unit: 's'}, {key: 'antic', …}, {key: 'sweep', …}, {key: 'settle', …},
  {key: 'curve', label: 'Sweep curve', type: 'select', options: {reference: 'Reference (traced)', sine: 'Gentle', cubic: 'Smooth', quint: 'Snappy', expo: 'Expo', linear: 'Linear'}, def: 'reference'},
  {group: 'Flaring edge'}, … {group: 'Lens blur'}, …
];
const segLen = P => P.hold + P.antic + P.sweep + P.settle;
export const flareDuration = (P, n) => Math.max(.01, segLen(P) * n);
```

Motion is **traced from a reference video**: `REF_PX` (flare.js:4–6) is 40 per-frame edge positions ("edge position per 60fps frame (px on a 1600-wide canvas, card spans 80..1520)"), smoothed by a `[1,4,6,4,1]` kernel and re-integrated into a normalized `REF` curve (flare.js:8–16), sampled with Catmull-Rom in `refCurve(u)` (flare.js:17–21) and selectable against `sine/cubic/quint/expo/linear`.

### 7.3 What `kind === 'flare'` changes

| Concern | Normal | Flare |
|---|---|---|
| Params | `defaults(t)` from `t.params` + `MOD_GROUPS` | `flareDefaults(t.n)` from `FLARE_PARAMS` (state.js:57) |
| Inspector | `controlGroups(t, P)` + `paramControl` | single "Motion" section iterating `FLARE_PARAMS` (ui.js:235–238) |
| Duration | `duration(t, P)` | `flareDuration(P, n) = segLen(P) * n`; `duration()` returns `null` (templates.js:1133) |
| Frame build | full card loop (`layout`, `camera`, modifiers) | early-out `buildFrame` producing `desc.flare = {a, b, u}` (engine.js:100–108), two faces + shader uniforms |
| Renderer | cards pipeline | dedicated `FS_FLARE` program (`renderer.js:20`, `drawFlare` at renderer.js:257; blur handling renderer.js:115) |
| Thumb timing | `duration * (t.step ? .32 : .12)` (main.js:636) | `P.hold + P.antic + P.sweep * .42` (main.js:635) |

`buildFrame`'s flare branch (engine.js:100–108):

```js
if (t.kind === 'flare'){
  const n = Math.max(2, P.count), dur = flareDuration(P, n), p = wrap(T2 / dur, 1);
  desc.bg = bgDesc(style, p);
  const fs = flareState(P, n, T2), order = orderFor(st, n), rect = flareRect(P, W, H, aspect);
  …
  desc.flare = {a: R.face(A, A.key, aspect, res), b: R.face(B, B.key, aspect, res), u: flareUniforms(P, fs.m, W, H, rect, style, BLUR_FRACS)};
  desc.post = postDesc(style, p, T, opts.thumb);
  return desc;
}
```

It still honors `orderFor` (media order/seed) and `postDesc` (labels/lens/fx), so the shared style and media systems apply unchanged.

---

## 8. Versioning & migration

### 8.1 Version marker

- State version: `v: 3` in `newState()` (state.js:62).
- Storage key: `const KEY = 'aligncanvas-v1'` (state.js:85) — note the **localStorage key is `v1` while the state payload is `v: 3`**; they are independent (the key was never bumped).
- `save()` (state.js:86–91) falls back to stripping inline `media.images[].src` if quota is exceeded.
- **There are no per-template version fields** — templates carry no `v`, and migrations operate on the whole saved state.

### 8.2 `upgrade()` (state.js:98–114)

```js
export function upgrade(s){
  if (!s || !s.template) return null;
  const base = newState(), t = byId(s.template), fresh = s.v !== 3;
  // a template that no longer exists: keep the media and settings, start on the default template
  if (t.id !== s.template){ s = {...s, template: t.id, params: undefined, style: undefined}; }
  const out = {...base, ...s};
  // saves from before v3 used per-template colours, frames and (before v2) shadows: start their look fresh
  out.style = !fresh ? deepMerge(templateStyle(t), s.style || {}) : templateStyle(t);
  if (fresh && s.style?.labels) out.style.labels = {...out.style.labels, ...s.style.labels, on: out.style.labels.on};
  if (fresh) s.frame = {...(s.frame || {}), aspect: DEFAULT_ASPECT};
  out.v = 3;
  out.params = {...templateParams(t), ...(s.params || {})};
  out.media = {...base.media, ...(s.media || {})};
  out.frame = {...base.frame, ...(s.frame || {})};
  out.export = {...base.export, ...(s.export || {})};
  return out;
}
```

Migration rules:

1. **Unknown/missing template** → falls back via `byId()`'s `|| TEMPLATES[0]`, discarding saved `params`/`style` but keeping media/settings (state.js:102).
2. **Pre-v3 saves** (`fresh = s.v !== 3`) → style rebuilt from `templateStyle(t)` (per-template colours/frames/shadows from v1/v2 are dropped), labels text preserved but `on` forced from the fresh style, frame aspect reset to `DEFAULT_ASPECT = '5:4'`.
3. **Params are always merged over fresh defaults** (state.js:109) — this is what makes the declarative schema (§4) forward-compatible: **adding a new param with a `def` auto-migrates every old save**, because `templateParams(t)` regenerates the full key set and `s.params` only overrides what it knows.
4. `load()` wraps parsing in try/catch and returns `null` on any failure (state.js:92–97), so a corrupt save falls back to `newState()`.

---

## Summary of load-bearing facts

- 166 templates: core 68 + x 36 + y 22 + choreo 40; 11 categories; registry is a plain array concat with `byId` fallback to element 0.
- `kind` has exactly two states: absent and `'flare'` (one template, `flare-duo`), branching in 6 places across `state/templates/engine/ui/main`.
- Params are **fully declarative**: `params[]` descriptors drive `defaults()` *and* the inspector (`paramControl` dispatch on `type`: `range|seg|select|toggle|color`), with `MOD_GROUPS` supplying nine shared modifier groups.
- Choreography is not a referenced subsystem — choreo-a..j are ordinary templates (`cat: 'choreo'`, shared `NEW` spread) aggregated statically by `templates-z.js`; the animation is `layout(i, P, E)` pure functions periodic in `E.p`.
- Looping: `duration()` (stepped = `perCard × count`, else `dur ?? 10`), `loopLength` divides by `speed`, `clipInfo` rescales (`rate`) so whole loops fit; `wrapFade` + integer `cyc` params keep seams invisible.
- `style` = `deepMerge(BASE_STYLE, t.style)`; switching templates resets style unless `keepStyle`, preserving labels text/logo/anim.
- Media: user images first, then hardcoded `'photos'`; `media.order: 'scatter'` + `media.seed` drive both the Fisher–Yates shuffle and `E.rnd`; `t.set`/`media.set` are vestigial.
- Versioning: state `v: 3`, localStorage key `aligncanvas-v1`; `upgrade()` handles template removal, pre-v3 style reset, and merges saved params over fresh declarative defaults.
