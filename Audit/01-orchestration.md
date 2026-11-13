# 01 — App Orchestration, State Flow & Persistence

**Target:** captured copy of AlignCanvas (`Reference\sites\aligncanvas.com`)
**Files read in full:** `js/main.js` (926 lines), `js/state.js`, `js/store.js`, `js/cloud.js`, `js/analytics.js`, `js/config.js`
**Supporting files consulted:** `js/ui.js`, `js/export.js`, `js/media.js`, `js/engine.js`, `js/account.js`, `js/auth-ui.js`, `js/tour.js`, `js/brand.js`, `js/renderer.js`, `js/templates.js`, `js/faces.js`, `create.html`

---

## 0. Architecture at a glance

```
create.html
 ├─ inline <head> script: pre-paint theme from localStorage 'ac-theme'
 ├─ <script type="module" src="js/main.js">        ← entry point
 ├─ <script> window.va = Vercel Insights bootstrap  ← EXCLUDE
 ├─ <script defer src="_vercel/insights/script.js"> ← EXCLUDE
 └─ <script type="module" src="js/analytics.js">    ← EXCLUDE (PostHog + GA4 + consent card)

main.js  ── class App (the single orchestrator, exposed as window.alignCanvas)
   │        owns: state, renderer, history, playhead, media maps, projects, UI prefs
   ├─ state.js      state schema, save/load/upgrade (localStorage), History
   ├─ store.js      IndexedDB (media + projects), onChange pub/sub
   ├─ ui.js         h()/setPath/getPath + leftPanel()/rightPanel() bound controls
   ├─ engine.js     buildFrame(app,T,W,H) → frame descriptor (pulls app.state)
   ├─ renderer.js   WebGL2 Renderer.render(desc) — stateless w.r.t. project state
   ├─ templates.js  TEMPLATES, byId, defaults, duration, MOD_GROUPS
   ├─ media.js      decode/upload/video clock/library manifest helpers
   ├─ export.js     exportVideo/Gif/Sequence/Image/copyImage/download (WebCodecs + CDN libs)
   ├─ tour.js       first-visit tour
   ├─ brand.js      brand kit (localStorage 'ac-brand' + IDB blobs)
   ├─ account.js    Supabase auth + plan              ← EXCLUDE
   ├─ auth-ui.js    sign-in window                    ← EXCLUDE
   ├─ cloud.js      Supabase project sync             ← EXCLUDE
   └─ analytics.js  PostHog + GA4 + consent card      ← EXCLUDE
```

There is **no event bus and no framework**. Communication is:
* **Direct method calls** — UI controls call methods on the `app` object they are handed (`app.set`, `app.commit`, `app.rebuild`).
* **Pull model for rendering** — `buildFrame(app, T, W, H)` reads `app.state`, `app.renderer`, `app.images` directly each frame; the renderer never holds project state.
* **Two tiny pub/subs (both excludable):** `store.js onChange` (only consumer: `cloud.js watch`) and `account.js onAccount` (only consumers: auth UI, `main.js updateAccount`).

---

## 1. Boot sequence (in order)

### 1a. Before any module runs (`create.html`)

1. **Inline head script (line 5)** paints the theme before CSS:

```js
try{document.documentElement.dataset.theme=localStorage.getItem('ac-theme')||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){document.documentElement.dataset.theme='dark'}
```

2. `<script type="module" src="js/main.js">` (line 100) — modules are deferred, so DOM is ready.
3. Vercel Insights bootstrap + `_vercel/insights/script.js` (lines 101–102) — **exclude**.
4. `<script type="module" src="js/analytics.js">` (line 103) — at module top level it runs `loadGA()`, `load()` (PostHog) and shows the consent card — **exclude**.

### 1b. `main.js` module evaluation (top level)

```js
const app = new App();
window.alignCanvas = app;
app.start().catch(e => { /* injects a fixed-position error banner */ });
```

### 1c. `new App()` — constructor (main.js:46–62)

| # | Step | Code |
|---|------|------|
| 1 | Grab canvas | `this.canvas = $('canvas')` |
| 2 | **Renderer init** (throws if no WebGL2) | `this.renderer = new Renderer(this.canvas)` |
| 3 | **State load/upgrade** | `this.state = load() \|\| newState()` — localStorage `aligncanvas-v1` → `upgrade()` |
| 4 | Media drawable maps | `this.images = new Map(); this.logos … this.posters … this.thumbUrls … this.urls` |
| 5 | Current project id | `localStorage.getItem('ac-project')` → `this.projectId` |
| 6 | Project list / save state | `this.projList = null; this.projThumbs = new Map(); this.saveState = ''` |
| 7 | UI prefs | `localStorage.getItem('ac-cats')` → collapsed categories |
| 8 | History | `this.history = new History()` |
| 9 | Clock / flags | `this.playing = true; this.T = 0; this.last = performance.now(); this.dirty = true; this.exporting = false` |
| 10 | Thumbnail queue | `this.thumbs = new Map(); this.thumbQueue = []` |

### 1d. `await app.start()` (main.js:63–101)

```
start()
 1  theme: pickedTheme() || systemTheme(); documentElement.dataset.theme = theme
         + matchMedia('prefers-color-scheme').addEventListener('change', follow)
         + addEventListener('focus') + visibilitychange → re-follow theme
 2  fonts: await Promise.race([ FONTS_TO_LOAD.map(document.fonts.load), timeout 2500ms ])
 3  await Promise.all([
        this.migrate().then(() => this.restoreMedia()),   ← legacy data:URL → IndexedDB, then draw every media item
        loadPhotos(),                                     ← faces.js bundled photo set
        B.registerFonts()                                 ← brand-kit fonts
      ])
 4  C.watch(...)                                          ← EXCLUDE: cloud sync watcher
 5  if (this.projectId) S.getProject(id) → if gone: setProject(null)  (validate saved project)
 6  setTimeout(() => S.gc(S.mediaIds(this.state)), 5000)   ← garbage-collect orphaned media
 7  location.hash '#t=rubik' → applyTemplate(state, linked) ; history.replaceState clears hash
 8  initAccount().then(...)                               ← EXCLUDE: runs in background, never awaited
      onAccount → updateAccount() / refreshProjects()
      ?pro= / #pro checkout params → getPro()             ← EXCLUDE
 9  this.chrome()                                         ← build top bar, rail, toolbar, timeline; bind ALL global events
10  this.rebuild()                                        ← leftPanel(app) + rightPanel(app) + updateChrome()
11  this.layout()                                         ← size #wrap and the canvas (DPR-aware, quality preset)
12  track('editor_opened', {...})                         ← EXCLUDE
13  new ResizeObserver(() => this.layout()).observe($('view'))
14  this.history.push(this.state)                         ← seed undo stack
15  this.queueThumbs()                                    ← queue all template thumbnails
16  requestAnimationFrame(t => this.loop(t))               ← FIRST PAINT (render loop starts)
17  if (!localStorage 'ac-seen' && !tourSeen()) setTimeout(() => startTour(this), 900)   ← tour after layout settles
```

Failure of any step in `start()` is caught at line 926 and rendered as a red banner:
`AlignCanvas couldn't start: ${e.message}`.

---

## 2. State ownership & data flow

### 2.1 Ownership

**`App.state` (a plain object) is the single source of truth**, owned by the `App` instance (`window.alignCanvas`). It is created by `load()`/`newState()` and *replaced wholesale* only on undo, new project, open project, and open project-file:

```js
// main.js undo()
this.state = upgrade(s);
// main.js loadNamed()
this.state = s;
// main.js openProject()
s.theme = this.state.theme; this.state = s;
```

State shape (`state.js newState()`): `{ v:3, template, params, style, keepStyle, media:{set,order,seed,images[]}, frame:{aspect,preview,zone,social}, theme, export:{...} }`.

Everything else **mutates in place** through `app.set(path, v)`:

```js
// main.js:215
set(path, v){ setPath(this.state, path, v); this.changed(); }
```

`setPath`/`getPath` (ui.js:61–62) are dotted-path helpers, e.g. `'style.glass.width'`, `'params.count'`, `'export.res'`.

### 2.2 The three-way contract

| Actor | Receives | Calls |
|---|---|---|
| `ui.js` controls (`slider`, `seg`, `toggle`, `select`, `color`, `text`) | `app` | `app.set(path,v)`, `app.commit()`, `app.rebuild()`, `app.proNeeded()` (excl.), `app.runExport()` |
| `engine.js buildFrame(app, T, W, H)` | `app` (read-only pull) | reads `app.state`, `app.renderer`, `app.images` |
| `renderer.js Renderer` | frame `desc` only | `render(desc)`, `snapshot(desc, ctx2d)`, `face(item,key,aspect,res)`, `dropFaces(match)` |

`app.rebuild()` re-renders both panels while preserving scroll:

```js
// main.js:229
rebuild(){
  const keep = ['left','right'].map(id => $(id).scrollTop);
  leftPanel(this); rightPanel(this);
  ['left','right'].forEach((id,i) => $(id).scrollTop = keep[i]);
  this.updateChrome();
}
```

### 2.3 Change pipeline (the core invariant)

```
user gesture
  → app.set(path, v)                     [mutate state]
      → changed()  = dirty=true
                   + clearTimeout(saveT); saveT = setTimeout(save, 400)   ← localStorage autosave
                   + queueProjectSave()                                   ← IDB project autosave (1200ms)
  → (gesture ends) app.commit()
      → history.push(state)             [one snapshot per gesture]
      → changed()  (as above)
      → updateTimeline()
      → trackChanges()                  ← EXCLUDE (analytics diffing)
  → next rAF tick sees this.dirty → draw(this.T) → renderer.render(desc)
  → if panel structure changed → app.rebuild()  (some controls do this inline)
```

### 2.4 Data flow per user action

**(a) User drags a slider** (`ui.js slider()`)

```
pointerdown on .sl  → setPointerCapture, remember startV
pointermove         → setV(v) → app.set(path, v)      ← NO history push (many per drag)
                      → show() updates fill/knob/value label
                      → changed() → dirty + 400ms save + 1200ms project save
pointerup           → app.commit()                     ← ONE history snapshot for the whole drag
                      → updateTimeline(), trackChanges()
rAF                  → dirty → draw(T)
```
Keyboard (↑/↓ on focused slider) and double-click typed values also end with `app.commit()`. `color()`/`text()` use `oninput → app.set`, `onchange → app.commit()` — same pattern.

**(b) User switches template**

```
click tile in ui.js templateBrowser
  → app.selectTemplate(id)                    (main.js:235)
      → applyTemplate(state, id)              (state.js:75)  ← params = templateParams(t)
                                                    style  = templateStyle(t) unless state.keepStyle
                                                    (labels text, logo, anim carry over)
      → track(...)  ← EXCLUDE
      → this.T = 0; this.commit(); this.layout(); this.rebuild()
```
`keepStyle` ("Keep my look" toggle in Project ▸ Options) skips the style replacement.

**(c) User drops an image**

```
window 'drop' listener (chrome(), main.js:716)
  → e.preventDefault(); $('drop').classList.remove('on')
  → this.addMedia(e.dataTransfer.files)                 (main.js:488)
      for each file:
        kind = M.kindOf(file)                            (video/* or image/* + ext fallback)
        m = {id: uid(), kind, name}
        blob = kind==='image' ? await M.downscale(f) : f   ← 2400px cap, JPEG q.92
        await this.loadMedia(m, blob)                    ← decode → this.images.set(id, el) (+ thumbUrls)
        await S.putMedia({id, blob, kind, type, name, size})   ← IndexedDB 'media' store
             on failure: images fall back to m.src = dataURL (in the autosave), videos are session-only
        this.state.media.images.push(m)
      → mediaChanged() → commit() → rebuild() → queueThumbs() → toast
```
Same entry points: `#fileImgs.onchange` (line 710) and window `'paste'` (line 717).

**(d) User scrubs the playhead**

```
scrub.onpointerdown (main.js:704)
  → setPointerCapture; const was = this.playing; this.playing = false
  → go(ev): this.T = clamp01((clientX-left)/width) * clipLength(state) * .9999 ; dirty = true
  → pointermove → go(ev)
  → pointerup   → playing = was ; updateChrome()
rAF loop → dirty → draw(this.T) → updateTimeline() rewrites fill width + "0.42 / 3.20s"
```
Keyboard: `←/→` step 1/60 s (Shift = 10 frames), `Home` = 0, both set `playing=false` for arrows.

**(e) Export runs**

```
Export tab button → app.runExport(kind, progEl)         (main.js:854)
  gates (EXCLUDE in rebuild): sign-in, exportsLeft(), proTemplate, size/fps/anim/logo/video limits
  → modal: title + <div class="progress"><i> + label + Cancel(AbortController)
  → this.exporting = true; this.rebuild()
  → kind==='video' → X.exportVideo(app, {format,W,H,fps,quality,duration:len,onProgress,signal})
  → kind==='gif'   → X.exportGif(...)
  → kind==='sequence' → X.exportSequence(...)
  → kind==='image'/'copy' → X.exportImage / X.copyImage (no progress modal)
      per frame: await app.prepareFrame(T)   ← seek every video, wait 'seeked'
                 app.drawExport(T, W, H)     ← buildFrame + renderer.render at export size
                 VideoFrame → VideoEncoder → muxer
  → await useExport()                        ← EXCLUDE: POST /api/export (server counter)
  → X.download(blob, name) → toast "Exported … MB in …s"
  finally: exporting=false; releaseFrames(); closeModal(); layout(); rebuild(); dirty=true
```

---

## 3. History / undo-redo

`History` lives in `state.js:115–131`:

```js
export class History {
  constructor(){ this.stack = []; this.i = -1; this.lock = false; }
  push(state){
    if (this.lock) return;
    const snap = JSON.stringify({...state, media: {...state.media, images: state.media.images.map(m => m.id)}});
    if (this.stack[this.i] === snap) return;                    // dedupe identical snapshots
    this.stack = this.stack.slice(0, this.i + 1); this.stack.push(snap);   // truncate redo tail
    if (this.stack.length > 80) this.stack.shift();             // cap 80 entries
    this.i = this.stack.length - 1;
  }
  step(d, state){
    const j = this.i + d; if (j < 0 || j >= this.stack.length) return null;
    this.i = j; const s = JSON.parse(this.stack[j]);
    s.media.images = s.media.images.map(id => state.media.images.find(m => m.id === id)).filter(Boolean);
    return s;                                                   // re-hydrate media by id
  }
}
```

| Question | Answer |
|---|---|
| When are snapshots pushed? | **On commit, not per input event.** Only `App.commit()` pushes (plus the seed push in `start()` and a fresh stack in `loadNamed()`). A slider drag = exactly 1 snapshot (push on `pointerup`). Buttons/segments/toggles call `commit()` once per click. |
| Debounced? | Not by time — by *gesture boundary*. The 400 ms debounce is only the localStorage `save()`. |
| Media in snapshots? | **Reduced to ids**: `images: images.map(m => m.id)`. `step()` maps ids back against the *current* `state.media.images`. Blobs never enter history. |
| Lock | `undo()` sets `history.lock = true` around the state swap so `changed()`/rebuild side-effects can't push; reset after. |
| Undo implementation | `undo(d)` → `history.step(d)` → `upgrade(s)` (re-merges schema defaults) → keep current `theme` → `changed(); layout(); rebuild()`. Note it does **not** call `commit()`, so undo/redo doesn't pollute the stack. |
| UI wiring | `#undo`/`#redo` buttons in `chrome()`; `⌘/Ctrl+Z` and `⌘/Ctrl+Shift+Z` in `key()`; disabled state from `history.i` in `updateChrome()`. |

---

## 4. Persistence

### 4.1 localStorage keys

| Key | Owner | Contents |
|---|---|---|
| **`aligncanvas-v1`** | `state.js save()/load()` | Whole project state as JSON (media as descriptors only). Quota fallback re-saves without inline `media.images[].src` data-URLs: `save()` catch-block. |
| `ac-project` | `App.setProject(id)` | Id of the currently open saved project (null = draft). |
| `ac-cats` | `App.saveUi()` | Collapsed template categories. |
| `ac-theme` | `setTheme()` | Explicit theme choice; removal = "follow system". |
| `ac-seen`, `ac-tour` | `tour.js done()` | Tour seen flags. |
| `ac-brand` | `brand.js` | Brand kit: colors, head/body font names, logo id, font ids. |
| `ac-consent`, `ac-payments`, `ac-su-<uid>`, `ac-cloud-up-<uid>` | analytics / config / account / cloud | **EXCLUDE** (see §8). |

`upgrade(s)` (state.js:98) migrates old saves: unknown template → default template with fresh params/style; `v !== 3` → rebuild style from template but keep labels text; merges `params/frame/media/export` over `newState()` defaults; always writes `out.v = 3`.

### 4.2 IndexedDB (`store.js`)

```
DB 'aligncanvas', version 1
  store 'media'    {id, blob, kind:'image'|'video'|'logo'|'font', type, name, size, created, updated}   keyPath id
  store 'projects' {id, name, state, thumb: Blob, created, updated, rev[, cloud]}  keyPath id, index 'updated'
```

* Opened lazily and memoised (`open()` → `dbP`); `available()` probes availability (private mode).
* `tx(store, mode, fn)` wraps a transaction and awaits `oncomplete` for readwrite.
* **Pub/sub:** `onChange(fn)` / `emit(store, id, op)` on every `put`/`del` — *only consumer is `cloud.js watch()` → EXCLUDE*.
* `mediaIds(state)` = uploaded media ids + logo id (library picks are files on the site, not stored).
* `gc(keep)` deletes media referenced by: working copy, the `aligncanvas-v1` autosave, every saved project, and the brand kit — **and only if `created` is older than 24 h** (protects another tab's unsaved work). Called once 5 s after boot and after project delete.

### 4.3 Autosave cadence & `#saveState`

Two independent save paths:

| Path | Trigger | Debounce | Writer | Indicator |
|---|---|---|---|---|
| **localStorage snapshot** | every `changed()` | 400 ms (`saveT`) | `save(state)` → `aligncanvas-v1` | none (silent) |
| **IndexedDB project** (only when `projectId` set) | every `changed()` → `queueProjectSave()` | 1200 ms (`projT`) | `flushProject()` → `writeProject()` → `S.putProject` | `#saveState` |

```js
// main.js:336
queueProjectSave(){
  if (!this.projectId) return;
  this.showSaveState('saving'); clearTimeout(this.projT);
  this.projT = setTimeout(() => this.flushProject(), 1200);
}
// main.js:341 — single-flight, deferred during export
flushProject(){
  clearTimeout(this.projT);
  if (!this.projectId || this.saveState !== 'saving') return;
  if (this.exporting){ this.projT = setTimeout(() => this.flushProject(), 1500); return; }
  if (this.writing){ this.again = true; return this.writing; }
  this.writing = this.writeProject(this.projectId).then(
    () => this.showSaveState('saved'),
    e => { console.warn(e); this.showSaveState('error'); });
  await this.writing; this.writing = null;
  if (this.again){ this.again = false; this.showSaveState('saving'); return this.flushProject(); }
  if (this.ui.rail === 'project') this.refreshProjects();
}
```

`writeProject(id, name)` (main.js:327): loads-or-creates the record, deep-clones state (`JSON.parse(JSON.stringify(...))`), renders a 320-px JPEG thumbnail via `projectThumb()` → `this.snapshot(this.T, W, H, {opaque:true})`, then `S.putProject` (bumps `rev`, `updated`).

**`#saveState` indicator** (`showSaveState`, main.js:311):

```js
el.textContent = !named ? 'Draft' : st === 'saving' ? 'Saving…' : st === 'error' ? 'Not saved' : 'Saved';
el.title = !named ? 'Not saved as a project yet. Save it from the Project tab.' : ...;
el.className = 'savest' + (named ? ' named' : '') + (st === 'error' ? ' err' : '');
```

**Project name:** `<input id="projName">` in the top bar — `onchange → this.state.name = e.target.value; this.changed()`; `syncName()` writes the input from `state.name` after open/new/import.

### 4.4 Project file import/export (`.aligncanvas.json`)

* **Save:** `saveProject()` → if videos present, a modal explains they're omitted → `writeProjectFile()`:
  * deep-clone state; each non-library image becomes `{...m, src: dataURL}` from IndexedDB blob;
  * videos become metadata only `{id, kind:'video', name, dur, w, h}`;
  * `X.download(new Blob([JSON]), (state.name || 'aligncanvas-project').replace(...) + '.aligncanvas.json')`.
* **Open:** `#fileProj.onchange` → `openProject(file)`:
  `upgrade(JSON.parse(text))` → push data-URLs back into IDB (`S.putMedia`) → drop videos this browser no longer has (counts them) → `flushProject()` → `setProject(null)` (draft) → `restoreMedia()` → `commit/layout/rebuild/queueThumbs/syncName` → toast reporting missing videos.

### 4.5 Project manager & multi-project support

There is **no separate manager modal** — it's the left rail's **Project** tab (`ui.js projectPanel`):

* **Save project / Save as…** → `saveNamed()` / `saveAs()` → `askName()` modal → `createProject(name)` → `writeProject(null, name)` → `setProject(rec.id)` → `refreshProjects()`.
* **My projects** list from `S.listProjects()` — *state stripped for lightness*: `list.map(({state, ...p}) => ({...p, count: state?.media?.images?.length || 0}))`, sorted by `updated` desc. Each row: IDB-backed thumbnail blob URL (`projThumbs` map, revoked on refresh), relative time, item count, inline rename, duplicate, delete (confirm modal), cloud toggle (exclude).
* **Open:** `openNamed(id)` — if the current work is an unsaved draft with history > 1, a modal offers *Save it first / Open*. `loadNamed(id)` → `upgrade(rec.state)` → flush current → swap state → `setProject(id)` → `restoreMedia()` → **fresh `History`** → `save()` → rebuild.
* **New project** → confirm modal → `flushProject()` → `newState()` → `setProject(null)`.
* **Multi-project model:** every saved project is an independent IDB record holding its *full* state; media blobs live once in the `media` store and are shared by reference (`store.js` header: *"A project's state names its media by id only, so projects share blobs and a duplicate costs nothing"*). The *working copy* is either (a) a draft — persisted only to `aligncanvas-v1`, `projectId === null`, or (b) bound to one project id via `ac-project`, autosaved into it. `rev` and `updated` exist for cloud conflict resolution (last write wins) — vestigial if cloud is dropped.

---

## 5. Media pipeline end to end

```
                 ┌ #fileImgs.onchange ─────────────┐
 sources         │ window 'drop' (#drop overlay)   │→ App.addMedia(files)
                 │ window 'paste'                  │      │
                 └ library grid (media/library/    │      │
                    manifest.json) → addLibrary() ─┘      │
                                                          ▼
                                   per file: M.kindOf → uid() → M.downscale (images, 2400px)
                                                          ▼
                                   App.loadMedia(m, blob)
                                     ├ m.lib  → url = M.libUrl(m.lib)          (path ref, no copy)
                                     ├ m.src  → legacy data-URL
                                     └ else   → S.getMedia(id).blob → URL.createObjectURL (cached in this.urls)
                                                          ▼
                                     kind==='video' ? M.loadVideo(url) : M.loadImage(url)
                                       video: m.dur/w/h from metadata; poster = M.poster(v, 480)
                                              thumbUrls[id] = objectURL(poster blob)
                                              images.set(id, <video element>)  (hidden holder, muted, loop)
                                       image: m.w/h; images.set(id, <img>); thumbUrls[id] = lib thumb or url
                                                          ▼
                                   S.putMedia({id, blob, kind, type, name, size})   ← IndexedDB 'media'
                                       on failure: image → m.src = dataURL (lives in localStorage save)
                                                  video → lost++ (session only, toast warns)
                                                          ▼
                                   state.media.images.push(m)
                                   mediaChanged() → commit() → rebuild() → queueThumbs()
```

**Key functions**

| Concern | Function | Note |
|---|---|---|
| Kind detection | `M.kindOf(f)` | MIME first, extension fallback (`VIDEO_EXT`/`IMAGE_EXT`) |
| Downscale | `M.downscale(file, max=2400)` | Skips re-encode if < 2.5 MB already |
| Decode image | `M.loadImage(url)` | rejects empty/undecodable |
| Decode video | `M.loadVideo(url, timeout=15000)` | muted/playsInline/preload auto in a hidden 2×2 holder; maintains `_ver` frame counter via `requestVideoFrameCallback` + `seeked` |
| Poster | `M.poster(v, max=480)` | seeks to `min(0.5, dur*0.25)`, draws to canvas |
| Thumbnail (media grid) | `App.thumbUrls` | poster blob URL for video, lib thumb or source URL for image |
| Thumbnail (template tiles) | `App.thumbs` + `thumbTick(now)` | 320×256 canvases rendered by `renderer.snapshot` inside a **10 ms/frame budget** from the rAF loop; `queueThumbs()` invalidates all; hover animates through `thumbTime(t,s)` |
| Remove/reorder | `removeImage`, `moveImage`, `clearImages`, `forget(id)` | `forget` pauses+removes video, revokes blob URLs, `renderer.dropFaces('img:'+id)` |
| Still vs live | `stills()` | poster frames stand in for videos in thumbnails (`mediaChanged()` nulls the memo) |

**Video clock in preview:** `syncVideos()` runs every frame — plays videos when `playing && !document.hidden`, corrects drift > 0.2 s (wrap-aware), and when paused seeks to within 4 s ms of `M.videoTime(v, T) = ((T % d) + d) % d` (each video loops over its own length). `renderer.syncVideos(desc)` draws the current frame as texture (`_ver` bump).

**Mapping media onto template slots** (`engine.js`):

```js
// mediaItems(app, t) — engine.js:40
const st = app.state, imgs = st.media.images.filter(m => app.images.get(m.id));
if (imgs.length) return imgs.map(m => { const el = app.images.get(m.id), vid = el.tagName === 'VIDEO';
  return {kind: vid ? 'video':'image', img: el, key: 'img:' + m.id + (vid ? '#v' : '')}; });
const set = 'photos';                                   // ← built-in fallback when no user media
...
// orderFor(st, n) — engine.js:56
if (st.media.order === 'scatter'){ const R = mulberry(st.media.seed || 1); /* seeded Fisher-Yates */ }
// per card: const k = L.img ?? i % n, item = itemFor(items, order, k)   // cycles, wraps
// seed also feeds per-card randomness: E.rnd = (i,k) => hash(i+1, k+7, seed)   (engine.js:121)
```

* **`media.set: 'auto'` is dead code** — `mediaItems` hardcodes `const set = 'photos'`; the `set === 'mixed'` branch and `MIXED` list are unreachable. Nothing reads `state.media.set`.
* **`order: 'in'`** → identity order; **`'scatter'`** → seeded shuffle; `seed` incremented by the "Reshuffle" button (`app.set('media.seed', seed+1); app.commit()`).
* Library items are referenced by **path** (`m.lib`), never copied into IDB; `S.mediaIds` filters them out of gc.

---

## 6. Render / preview loop

**Single rAF loop**, started once in `start()` and re-armed unconditionally at the end of every tick:

```js
// main.js:612
loop(now){
  const dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
  if (!this.exporting){
    if (this.playing){ this.T += dt; this.dirty = true; }
    const len = clipLength(this.state);
    if (this.T >= len) this.T = this.T % len;      ← loops forever
    this.syncVideos();
    if (this.dirty){ this.draw(this.T); this.dirty = false; this.updateTimeline(); }
    this.thumbTick(now);                           ← budgeted template thumbnails
    this.perf(now, dt);                            ← EXCLUDE (fps telemetry)
  }
  requestAnimationFrame(t => this.loop(t));
}
```

* **Playhead:** `this.T` (seconds). Advances only when `this.playing`. Wraps with `% len` → **the preview always loops**.
* **Play/pause:** `togglePlay()` flips `this.playing` and calls `updateChrome()` (swaps play/pause icons in toolbar + timeline). The rAF loop never stops; pause just stops advancing `T` (dirty frames from edits still draw).
* **Restart:** toolbar button / sets `T = 0`. **Fullscreen:** `fullscreen()` on `#wrap`; `fullscreenchange` → `layout()`.
* **Draw path:** `draw(T)` → `buildFrame(this, T, W, H)` → `syncLabels(...)` → `renderer.render(desc)`. `layout()` sizes the canvas: DPR cap 2, quality preset `frame.preview` (draft .6×, auto dpr, max dpr×1.25) with pixel caps 900/2200/3000.

**Duration computation (`engine.js`):**

```js
export function loopLength(state){                 // one template loop at speed 1
  const t = byId(state.template), P = state.params;
  const d = t.kind === 'flare' ? flareDuration(P, P.count) : duration(t, P);
  return d / Math.max(.05, P.speed || 1);
}
export function clipInfo(state){
  const loop = loopLength(state), ex = state.export, clip = Math.max(.5, ex.duration || loop);
  if (!ex.seamless) return {loop, clip, rate: 1, loops: clip / loop};
  const loops = Math.max(1, Math.round(clip / loop));
  return {loop, clip, rate: loops * loop / clip, loops};   // motion time is scaled to fit whole loops
}
export const clipLength = state => clipInfo(state).clip;
```

| `export.duration` | Meaning |
|---|---|
| **`0` ("Auto", default)** | `ex.duration \|\| loop` → clip = **exactly one loop of the template** (whatever the template's `duration(t,P)` says: `t.step ? perCard × count : t.dur \|\| 10`, divided by `speed`). |
| **> 0 (set duration, 0.5–60 s)** | clip = that value. With **`seamless: true`** (default) `loops = round(clip/loop)` and `rate = loops*loop/clip` — `buildFrame` multiplies `T` by `rate` (line 98: `T = T * (opts.rate ?? clipInfo(st).rate)`), so a whole number of loops fits exactly and frame 1 ≈ frame N ("Motion runs at 1.04× so 3 loops fit exactly" hint in the export panel). With seamless off, `rate: 1` and the end won't match the start. |

`duration` slider UI (ui.js:583): `fmt: v => (v ? v : ci.loop).toFixed(1) + 's' + (v ? '' : ' · auto')` plus an **Auto** button that sets `export.duration = 0`.

---

## 7. Export flow end to end

1. **UI:** right panel **Export tab** (opened by top-bar `#exportTop`, key `E`, or the tab). Sections: Social presets (Pro-gated), Video (Output: resolution/format/fps/quality/seamless/animation/duration + summary + **Export video/GIF** button), Static (still format/size/transparent + **Export frame** / copy), Image sequence (Pro), Web embed (disabled "Coming soon").
2. **Settings collected** — none are passed in ad-hoc; `runExport` reads `this.state.export` (`kind, format, res, fps, quality, duration, seamless, img, scale, transparent, gifWidth, gifFps, gifColors, seqFps`) plus `state.frame.aspect` and `clipLength(state)`.
3. **Gate chain (all EXCLUDE in a rebuild):** not signed in → `signIn(() => runExport(...))`; `exportsLeft() <= 0` → "used your 5 free exports"; `proTemplate` (Signature); `sequence` Pro; `canExportSize(size)` ≤ 1080; `canExportStill` ≤ 1440; `canUseFps` ≤ 30; `anim.on` / `logo.on` / any video on free plan. Each fires `track('export_blocked', {reason})`.
4. **Progress:** modal with `<div class="progress"><i>` bar; `onProgress(f)` sets width % and `about Ns left` from `elapsed/f − elapsed`; Cancel = `AbortController.abort()` → `DOMException('…','AbortError')` caught and reported as "Export cancelled".
5. **Render:** `export.js` loads muxers from jsDelivr CDN (`mp4-muxer`, `webm-muxer`, `gifenc`, `fflate`) — **network dependency to vendor in a rebuild**. Video: WebCodecs `VideoEncoder` (codec probe list, `bitrateFor = W*H*fps*QUALITY[q]`), one `VideoFrame` per timestamp `i/fps`, `keyFrame` every 2 s, backpressure wait at `encodeQueueSize > 6`, progress every 4 frames. Stills use `app.snapshot()`; sequences zip PNGs (`frame_00000.png`).
6. **Download:** `X.download(blob, name)` → `window.claude?.use('downloads')` if running inside a Claude artifact (declined/too_large error codes), else a temporary `<a download>` click. Returns `'saved' | 'declined'`.
7. **"5 exports" free-plan counter — SERVER-SIDE, must be removed:**

```js
// account.js:46
export const exportsLeft = () => limited() ? Math.max(0, FREE_EXPORTS - (profile?.exports_used || 0)) : Infinity;
// account.js:48 — called before EVERY download (main.js:880 for stills/copy, main.js:910 for video/gif/sequence)
export async function useExport(){
  if (!limited()) return true;
  const { data } = await sb.auth.getSession(), token = data.session?.access_token;
  const r = await fetch('/api/export', {method:'POST', headers:{Authorization:`Bearer ${token}`}});
  ... 402 / ok:false → profile = {...profile, exports_used: FREE_EXPORTS}; return false;   // → "used up" modal
}
```

In a rebuild: delete `useExport`, `exportsLeft`, the `usedUp()`/`block()` gates, the export-then-counter ordering (`if (!await useExport()){ ... return usedUp(); }`), and the export panel's free-plan banner (`ui.js:575–578`) and value-clamping (`if (limited()){ ex.res = FREE_MAX; ex.fps = FREE_FPS; ex.scale = FREE_IMG_MAX }`, ui.js:569–573).

---

## 8. EXCLUSION LIST — everything to drop from a rebuild

### 8.1 Whole modules / files

| File | What it is |
|---|---|
| `js/account.js` (166 lines) | Supabase auth, session, profile/plan, `useExport`, checkout |
| `js/auth-ui.js` (152 lines) | Sign-in/up/reset/magic-link window + its live-engine art panel |
| `js/cloud.js` (98 lines) | `push/list/pull/remove/watch` — Supabase `cloud_projects` table + `media` Storage bucket |
| `js/analytics.js` (128 lines) | PostHog EU loader + GA4 (`G-TRFGQME47X`) + consent card `.ac-consent` |
| `css/auth.css` | Auth window styles (loaded dynamically by auth-ui.js) |
| `_vercel/insights/script.js` + `view.html` | Vercel Web Analytics |
| `js/config.js` | Entire file is auth/billing/limits (see 8.3) — keep nothing, or reduce to site constants |

### 8.2 Functions to delete

* **account.js:** `initAccount`, `onAccount`, `currentUser`, `supabase`, `displayName`, `avatarUrl`, `initials`, `inBeta`, `isLifetime`, `proUntil`, `isPro`, `limited`, `canExportSize`, `canExportStill`, `canUseFps`, `proTemplate`, `exportsLeft`, `useExport`, `loadProfile`, `signInWithPassword`, `signUp`, `sendPasswordReset`, `setNewPassword`, `sendSignInLink`, `signInWithGoogle`, `refreshPlan`, `stripePage`, `startCheckout`, `openBilling`, `signOut`, `friendly`, `seen`, `onRecovery`.
* **auth-ui.js:** `openAuth`, `art`, `field/busy/show` internals, the `onRecovery(...)` auto-open at line 152.
* **cloud.js:** `push`, `list`, `pull`, `remove`, `watch`, `ready`, `upKey/uploaded/remember`, `toDataURL`, `fail`, `pulling`, `timers`.
* **analytics.js:** `track`, `identify`, `forget`, `consent`, `loadGA`, `gaConsent`, `gaEvent`, `load`, `accept`, `decline`, `card`, `gtag`.
* **main.js (App methods):** `needsPro`, `proNeeded`, `getPro`, `accountMenu`, `updateAccount`, `avatar`, `signIn`, `styleLocked`, `trackChanges` (+ `flat`, `GROUP_OF`, `lastFlat`), `perf` (+ `pf`, `pfSent`), `toggleCloud`, `openCloud`, cloud branches inside `refreshProjects`/`deleteNamed`/`projectPanel`, the `initAccount().then(...)` block (start steps 4 and 8), every `track(...)` call (~40 sites), the whole gate chain at the top of `runExport`.
* **ui.js:** `proCard`, `proToggleEl`, `locked:`/`onLocked:` options on `seg`, `limited()` branches in `exportPanel` (clamping, free-left banner, Pro sequence button, Social section `pro:` flag), `currentUser()` hint in `projectPanel`, cloud row button (`.cloudb`) and `p-cloud` section.
* **ui.js controls that exist only for gating:** crown badges (`I.crown`), `.badge.pro`, `.pro-card`, `.free-left`.

### 8.3 Config values to delete (`config.js`)

| Export | Value / purpose |
|---|---|
| `SUPABASE_URL` | `https://jqrumbbdscezcbflftat.supabase.co` |
| `SUPABASE_KEY` | `sb_publishable_HDWmE5jBnxAD6K9P_F-VhA_1Yxz0FQW` |
| `GOOGLE_SIGN_IN` | `true` — Google OAuth button |
| `PAYMENTS_LAUNCHED` / `PAYMENTS` / `?payments=preview` | Stripe checkout switch + `ac-payments` key |
| `BETA_FREE_UNTIL` | `'2026-11-03T00:00:00Z'` launch-week exemption |
| `FREE_MAX` | `1080` |
| `FREE_IMG_MAX` | `1440` |
| `FREE_FPS` | `30` |
| `FREE_EXPORTS` | `5` |
| `PRO_CATS` | `['signature']` — Signature template tier |

### 8.4 Server endpoints & backend resources

* `POST /api/export` — export counter (called from `useExport`).
* `POST /api/checkout` — Stripe Checkout (`startCheckout`).
* `POST /api/portal` — Stripe billing portal (`openBilling`).
* Supabase: auth (email/OTP/Google OAuth), tables `profiles` (plan, exports_used, pro_until, lifetime) and `cloud_projects`, Storage bucket `media` (`<uid>/<mediaId>`), plus its `@supabase/supabase-js` CDN import.
* PostHog project key `phc_pfXVZQu2WJAEL8H52H4jds5qizCQGC23c2jekNEYyyvo` @ `eu.i.posthog.com`; GA4 id `G-TRFGQME47X`; `window.va` Vercel Insights.

### 8.5 Analytics call sites & telemetry (delete all)

`editor_opened, template_selected, images_added, library_added, look_applied, surprise_used, controls_changed, brand_applied, social_preset, logo_added, font_added, upload_blocked, project_new, project_saved, project_stored, project_opened, cloud_on, cloud_off, cloud_opened, pro_prompt, pro_clicked, export_started, export_completed, export_failed, export_cancelled, export_blocked, editor_performance, auth_opened, auth_error, signup_submitted, signed_up, signed_in, signed_out, signin_link_sent, google_clicked` + `identify()/forget()` + the `GA_EVENTS` set + `trackChanges()`'s flat-state diffing.

### 8.6 DOM / UI to remove

* `#account` button (top bar) and its `updateAccount`/`accountMenu` modal.
* Auth window root `.au` (+ `css/auth.css`), Terms/Privacy links in it.
* Consent card `.ac-consent` + `#ac-consent-css` + the `document.addEventListener('click', [data-consent])` hook.
* `.pro-card`, `.free-left`, crown badges, `Pro`/`Soon` badges on templates where they encode plan tiers, `.cloudb` cloud buttons, "In the cloud" project section, `Secure checkout by Stripe` plan picker modal.
* `create.html` script tags: Vercel insights bootstrap (lines 101–102) and `js/analytics.js` (line 103); JSON-LD/LD+json and any auth-related markup if present.

### 8.7 localStorage keys to stop writing

`ac-consent`, `ac-payments`, `ac-su-<uid>` (sign-up marker), `ac-cloud-up-<uid>` (uploaded set), Supabase's `sb-*` session keys. *(Keep: `aligncanvas-v1`, `ac-project`, `ac-cats`, `ac-theme`, `ac-seen`, `ac-tour`, `ac-brand`.)*

### 8.8 AI features — **none found (verified)**

Greps across all `.js`/`.html` for `ai|openai|gpt|generate|prompt|claude|anthropic|llm|assistant|machine learning` returned only:
* `export.js:110` — `window.claude?.use('downloads')`: an optional Claude-artifact download shim inside `X.download()`. **Not an AI feature**; keep or drop as an environment shim.
* `main.js:801` — `track('pro_prompt', …)` — the string "prompt" in an analytics event name for the Pro upsell.
* `gl.generateMipmap` / local vars named `ai` (aspect index).

There is **no AI generation, no prompts, no LLM calls** anywhere in the product. Nothing to exclude beyond the above.

### 8.9 Pro-gated *features* that need a decision (not exclusions per se)

These are real product features currently wrapped in `limited()` gates — decide whether to ship them unlocked or drop them:
`applySocial` (social presets + safe zones), `applyBrandKit` / `pickLogo` / `pickFont` (brand kit), `style.anim` (text/logo animation), `style.logo`, videos on cards (`addMedia`/`addLibrary` filter), Signature templates (`PRO_CATS`), image sequences, 1440p/4K + 60/120 fps export, brand kit section in Visual panel.

---

## 9. Shortcuts & global event wiring

### 9.1 Keyboard (`App.key`, main.js:741; bound in `chrome()` via `addEventListener('keydown', e => this.key(e))`)

Guard: `if (e.target.matches('input, textarea, select') && e.key !== 'Escape') return;` (panel-local inputs own their keys; sliders also handle their own arrows/dbl-click).

| Key | Action |
|---|---|
| `⌘/Ctrl+Z` | undo (−1) |
| `⌘/Ctrl+Shift+Z` | redo (+1) |
| `Space` | play / pause (`togglePlay`), `preventDefault` |
| `→` / `←` | step ±1 frame (1/60 s), Shift = 10 frames; pauses playback |
| `Home` | `T = 0` |
| `F` | fullscreen preview (`#wrap`) |
| `G` | toggle safe-zone guides `#safe` |
| `R` | `surprise()` — random style preset + bg mode/palette + camera/grain |
| `T` | toggle light/dark theme |
| `E` | open Export tab (`ui.rightTab = 'export'; rebuild()`) |
| `?` | shortcuts modal (`shortcuts()`, includes "Take the tour" → `startTour`) |
| `Escape` | close modal (`#modal` remove `.on`) |

Tour (`tour.js`) adds a capture-phase keydown listener while active: `←/→/Enter` navigate, `Escape` skips.

### 9.2 Global listeners bound in `chrome()` (main.js:664–720)

| Target | Event | Handler |
|---|---|---|
| `window` | `dragenter` | count depth; add `.on` to `#drop` when files are dragged |
| `window` | `dragleave` | decrement; remove `.on` at 0 |
| `window` | `dragover` | `preventDefault()` |
| `window` | `drop` | `preventDefault()`; `addMedia(e.dataTransfer.files)` |
| `window` | `paste` | clipboard files → `addMedia` |
| `window` | `keydown` | `App.key` |
| `document` | `fullscreenchange` | `layout()` |
| `document` | `visibilitychange` + `window focus` | theme re-follow (in `start()`) |
| `matchMedia('(prefers-color-scheme: light)')` | `change` | theme re-follow |
| `ResizeObserver(#view)` | resize | `layout()` |
| `#fileImgs` | `change` | `addMedia(files)` then reset `value` |
| `#fileProj` | `change` | `openProject(file)` then reset `value` |
| `#modal` | click (implicit) | closed only by explicit buttons / Escape |
| `analytics.js` (drop) | `document click` | `[data-consent]` reopens consent card |

### 9.3 Widget-level bindings set up in `chrome()`

`#undo`/`#redo`, `#theme` seg (light/dark), `#exportTop` (→ Export tab), `#help` (shortcuts modal), `#surprise`, `#projName` (change → `state.name`), rail buttons (`motion/media/text/project`), toolbar (play, restart `T=0`, fullscreen, aspect select, colour picker → `style.bg.c[0]`, guides `#safeBtn`, reset look), timeline (play button + scrub pointer capture), and the timeline display updated by `updateTimeline()`.

---

## 10. Rebuild notes (load-bearing quirks to preserve or fix)

1. **Save-on-idle vs commit-on-gesture** are separate: 400 ms localStorage debounce, 1200 ms project debounce, single-flight writer with `again` re-run flag, deferred while `exporting`.
2. **History stores media as ids** and re-resolves on `step()` — snapshots are ~KB even with 50 images.
3. **`upgrade()` on every load/undo/open** means the schema can evolve by bumping `v`.
4. **`buildFrame` pulls from `app`** — the same function serves preview, thumbnails (`{thumb:true}`, fake `app` object `{state, renderer, images}`), and export (`drawExport`, `resBoost 1.15`).
5. **rAF loop runs even when paused** (needed for hover thumbnails and video sync); `dirty` flag gates actual GL work.
6. Dead/vestigial code to *not* port: `state.media.set` (`'auto'`), the `MIXED`/`set==='mixed'` branch, `flareDuration` import in main.js line 7 (unused there), cloud fields `rev/cloud` if sync is dropped, the embed "Coming soon" section.
7. `window.alignCanvas = app` is used by the tour and by tooling — keep a debug handle.
