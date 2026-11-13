# Part 2 — Scope Definition

**What this document is:** the firm boundary between what we're building and what we're not. It exists so that "should we add X?" always has one unambiguous answer.

**Your stated direction:**
> "Use React + TypeScript + Vite. Ensure you build the same interface and everything, without Auth, AI or billing."

---

## 1. The one-line scope

> **A pixel-faithful rebuild of the AlignCanvas editor interface and its entire local editing engine — canvas, templates, effects, parameters, inspectors, media, timeline, undo, saving and export — with every account, payment, cloud and tracking system removed, and all plan limits lifted.**

Everything the app does **on your own computer**, we build. Everything that required **their server or your money**, we delete.

---

## 2. What we are building ✅

### 2.1 The editing canvas
- WebGL2 preview canvas, sized to fit, with high-DPI support
- Floating toolbar: play/pause, restart, fullscreen, aspect ratio, background colour, guides, reset look
- Floating timeline scrubber with playhead and time readout
- Rule-of-thirds guides and social safe-zone overlays (never exported)
- Fullscreen preview mode
- Preview quality tiers (Draft / Auto / Max)
- Light and dark themes, following the system by default

### 2.2 The template system
- The template browser: search, collapsible categories with counts, thumbnail grid
- **~20 templates at first**, spanning every category, then the remaining ~146 in mechanical batches
- **Live animated thumbnails** — hovering a template plays its preview inside the thumbnail
- Controls tab showing the selected template's parameters, grouped, with per-group reset and "modified" markers
- Seamless loop timing (including the "motion runs at 1.04× so 3 loops fit exactly" behaviour)

### 2.3 The parameter & inspector system
- The declarative parameter schema (the app's best idea) — **reimplemented in TypeScript as a typed schema**
- All five control types: slider, segmented buttons, dropdown, toggle, colour
- **All ~90 style controls** across all 14 look groups, at parity
- Conditional control sets (background mode, glass mode, lens mode/shape, fixed card counts)
- Control refinements: Shift-drag for fine control, arrow keys, double-click to type an exact value
- Nine one-click style presets (Clean, Liquid glass, Prism, Liquid lens, Noir, Holographic, Dreamy, Film, Neon night)
- Ten background colour palettes

### 2.4 The effects & rendering engine
- The complete two-pass pipeline
- All 6 shader programs
- **All 14 look groups:** card, shadow, shade, blur, cardGlass, glass (liquid glass), lens, bg, fx, camera, title, labels, logo, anim
- All **10 background modes**: solid, linear, radial, mesh, aurora, grid, dots, holo, spotlight, plasma
- **Spectral dispersion** — the signature rainbow-edge look, done properly
- Depth-of-field blur, edge blur, bloom, grain, vignette, chromatic aberration, contrast, saturation, exposure
- Card thickness, bending, back faces, rim light, glare sweep
- Transparent background output for PNG/WebP

### 2.5 Media (the "layer" system, at parity)
- Add images and videos by file picker, **drag-and-drop**, and **paste**
- Automatic downscaling of large images (2400px cap) to keep projects small
- Media grid with thumbnails, **drag to reorder**, remove individual, remove all
- Order modes: in sequence / shuffle, plus a Reshuffle button
- Stock photo library with search, tag filters and multi-select
- Video support: auto-looping, poster thumbnails, exact frame seeking
- **Projects share media by reference** — no duplicated storage

### 2.6 The timeline (at parity)
- Loop scrubber with playhead, fill, and time readout
- Play/pause, drag-to-scrub, frame stepping
- Duration control with Auto = one loop, and seamless-loop fitting
- **No keyframes** (see §4 — deferred deliberately)

### 2.7 State, undo and persistence
- **Gesture-level undo/redo** — one drag = one undo step, 80 deep
- Automatic draft saving (400 ms debounce)
- **Multi-project manager**: save, save as, rename, duplicate, delete, open, list with thumbnails and relative times
- Project autosave with live status indicator (Draft / Saving… / Saved / Not saved)
- Portable project files (`.json` with media inlined) — save and open
- Automatic cleanup of unused media
- Schema versioning so old projects upgrade cleanly

### 2.8 Export
- **MP4** and **WebM** video (WebCodecs)
- **GIF**
- **PNG image sequence** (zipped)
- **PNG / JPEG / WebP** stills, plus copy-to-clipboard
- Resolution 480→4320, frame rate up to 120fps, four quality levels
- Social aspect presets (Reels/TikTok/Shorts, Story, Feed, Square, LinkedIn/X, YouTube, Dribbble)
- Progress bar with ETA and **Cancel**
- **No limits of any kind** — every resolution, frame rate and format unlocked

### 2.9 Interface furniture
- Header: project name, save status, undo/redo, theme switch, Export button, help
- Four rail destinations: Motion, Media, Text, Project
- Text panel: title, corner labels, logo
- Shortcuts modal and **the 9-step guided tour**
- Toasts, drop overlay, modals
- All 13 keyboard shortcuts

---

## 3. What we are deleting ❌

These are being removed **entirely, not stubbed**. No "sign in" button, no disabled checkout, no plan badges, no ghost of a system that isn't there.

### 3.1 Authentication & accounts — **OUT**

| Remove | Detail |
|---|---|
| Whole modules | `account.js` (166 lines), `auth-ui.js` (152 lines), `css/auth.css` |
| Functions | `initAccount`, `onAccount`, `currentUser`, `signInWithPassword`, `signUp`, `sendPasswordReset`, `setNewPassword`, `sendSignInLink`, `signInWithGoogle`, `signOut`, `refreshPlan`, `onRecovery`, and ~20 more |
| Backend | Supabase auth (email, one-time codes, Google OAuth), `profiles` table |
| DOM | The `Sign in` button in the header, the entire `.au` sign-in window, Terms/Privacy links |
| Config | `SUPABASE_URL`, `SUPABASE_KEY`, `GOOGLE_SIGN_IN` |
| Storage keys | `ac-consent`, `ac-su-<uid>`, all Supabase `sb-*` session keys |

### 3.2 Billing, payments and plan limits — **OUT**

| Remove | Detail |
|---|---|
| Config values | `PAYMENTS`, `PAYMENTS_LAUNCHED`, `?payments=preview`, `BETA_FREE_UNTIL`, `FREE_MAX=1080`, `FREE_IMG_MAX=1440`, `FREE_FPS=30`, `FREE_EXPORTS=5`, `PRO_CATS=['signature']` |
| Functions | `useExport()`, `exportsLeft()`, `limited()`, `canExportSize()`, `canExportStill()`, `canUseFps()`, `proTemplate()`, `startCheckout()`, `openBilling()`, `stripePage()`, `needsPro()`, `proNeeded()`, `getPro()` |
| Server endpoints | `POST /api/export` (the export counter), `POST /api/checkout`, `POST /api/portal` |
| UI | Every crown badge, `.badge.pro`, `.pro-card`, `.free-left`, the Stripe plan picker, the "5 exports left" banner, value-clamping in the export panel |
| Logic | The entire gate chain at the top of the export function |
| Templates | **No template is locked.** All Signature templates are free |

**The user-visible consequence — everything is simply unlocked:**

| Was gated | Now |
|---|---|
| 4K export | Free, unlimited |
| 60 / 120 fps | Free, unlimited |
| Image sequences | Available |
| Signature templates | Available |
| Videos on cards | Available |
| Brand kit | Available |
| Logo and text animation | Available |
| Social presets | Available |
| 5 exports total, ever | **Unlimited** |

### 3.3 Cloud sync — **OUT**

| Remove | Detail |
|---|---|
| Whole module | `cloud.js` — `push`, `list`, `pull`, `remove`, `watch` |
| Backend | Supabase `cloud_projects` table, `media` storage bucket |
| UI | `.cloudb` buttons, the "In the cloud" project section, cloud toggles |
| Vestigial | The `rev` and `cloud` project fields (they existed only for conflict resolution) |

Projects live in your browser's IndexedDB and can be exported as portable files. That's the whole storage story.

### 3.4 Analytics and tracking — **OUT**

| Remove | Detail |
|---|---|
| Whole module | `analytics.js` — PostHog + Google Analytics + consent card |
| Services | PostHog project `phc_pfXVZ…`, GA4 `G-TRFGQME47X`, Vercel Insights (`window.va`, `_vercel/insights/`) |
| Functions | `track()` (~40 call sites), `identify()`, `forget()`, `consent()`, `loadGA()`, `gaEvent()`, `perf()` telemetry, `trackChanges()` state-diffing |
| DOM | The cookie/consent card `.ac-consent` |

Nothing about your work leaves your computer. No events, no page views, no error reporting, no performance telemetry.

### 3.5 AI features — **NOTHING TO REMOVE (verified)**

I grepped every `.js` and `.html` file for `ai`, `openai`, `gpt`, `generate`, `prompt`, `claude`, `anthropic`, `llm`, `assistant`, `machine learning`.

**There are no AI features in this application.** The only three hits were:
- `window.claude?.use('downloads')` — an optional shim for saving files when running inside a Claude artifact. Not an AI feature; it's an environment adapter.
- An analytics event literally named `pro_prompt` (a marketing upsell string).
- `gl.generateMipmap` and a local variable named `ai` (aspect index).

**So: no AI to exclude.** The app has never had any. It's a deterministic graphics tool.

### 3.6 Server components — **NONE NEEDED**

The reference app's *server* did exactly four things: serve static files, count exports, run Stripe, and hold Supabase auth. Rendering, encoding and saving all happened locally.

**Our rebuild needs no backend at all.** A static file host (or even opening the built folder directly) is sufficient. This is a genuine architectural advantage, not a compromise.

---

## 4. Deliberately deferred — Phase 2 ⏸️

Not "no", but "not yet". Each is a defined future phase, not an accident.

### 4.1 A real layer system
The original has no layer stack — the ordered media list *is* the layer list (§7 of the audit). Per your decision, we ship at parity first, then add in Phase 2:

- Layer panel with visibility (eye) toggles
- Click a card on the canvas to select it (requires GPU picking — render an ID into a small offscreen buffer)
- Manual z-order control
- Per-layer lock/hide
- Rename layers

### 4.2 Keyframed timeline
The original's timeline is a loop scrubber only — nothing stores a value *at a time*. Adding keyframes means:

- Per-layer tracks with keyframe diamonds
- A keyframe interpolation model (linear/bezier, easing per key)
- Restructuring `buildFrame` from "pure function of time" to "pure function of (state, time)" where state includes evaluated keyframes — **still pure, so export stays correct**

This is a genuine feature addition, not parity. It's the largest single piece of Phase 2 work.

### 4.3 Canvas pan and zoom
The original has no pan/zoom — the preview is always fit to the viewport, and `F` gives fullscreen. Adding viewport panning is straightforward but is not parity.

### 4.4 Not in scope for any phase
- Multi-user / real-time collaboration
- Server-side rendering or a rendering API
- Mobile/tablet editing (the original is desktop-first; we'll keep it usable but not optimise for touch editing)
- Plugin/extension system
- Any form of AI generation or editing

---

## 5. Decisions locked in

| Question | Decision |
|---|---|
| Technology | **React + TypeScript + Vite** |
| Rendering | **Plain WebGL2**, framework-free — React never touches the canvas |
| Layers & timeline | **Faithful parity first**, real layer system in Phase 2, keyframes after that |
| Templates | **~20 first**, remaining ~146 in batches |
| Backend | **None.** Static hosting only |
| Auth / billing / cloud / analytics | **Removed entirely** |
| AI | Nothing exists to remove |
| Plan limits | **Everything unlocked** |
| Visual interface | **Same layout, same panels, same controls, same styling** |

---

## 6. Definition of done (Version 1)

A stranger can open the app and, without instruction:

1. See a template animating immediately on load
2. Drag five photos from their desktop onto the page and watch them land on the cards
3. Switch template, browse categories, hover to preview, and land on one they like
4. Drag at least ten different sliders and see the canvas respond smoothly at 60fps
5. Change the background, turn on liquid glass, add a title
6. Scrub the timeline and press space to pause
7. Reorder their images by dragging
8. Undo a mistake with ⌘Z and redo it
9. Export a 1080p MP4 with no account, no paywall, no export counter
10. Close the tab, come back later, and find their work exactly as they left it

If all ten hold, the scope is met.

---

**Previous:** [Part 1 — Architecture Audit](./01-ARCHITECTURE-AUDIT.md) · **Next:** [Part 3 — Implementation Blueprint](./03-BLUEPRINT.md)
