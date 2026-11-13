# Align — a production rebuild of the AlignCanvas editor

This folder contains everything needed to understand the original app and rebuild it as a real application.

---

## 📖 Start here — read in this order

| # | Document | What it answers |
|---|---|---|
| **1** | [docs/01-ARCHITECTURE-AUDIT.md](docs/01-ARCHITECTURE-AUDIT.md) | *How does the original work under the hood?* — canvas, templates, effects, parameters, layers, timeline, saving, export |
| **2** | [docs/02-SCOPE.md](docs/02-SCOPE.md) | *What are we building, and what are we not?* — everything excluded (auth, billing, cloud, analytics, AI) listed precisely |
| **3** | [docs/03-BLUEPRINT.md](docs/03-BLUEPRINT.md) | *How do I actually build it?* — the commands, the folder layout, the data structures, and a milestone-by-milestone roadmap |

### Supporting evidence (the deep dives)

The three documents above are written to be readable. These four are the forensic detail they're drawn from — every claim is backed by a file and line reference.

| File | Covers |
|---|---|
| [Audit/01-orchestration.md](Audit/01-orchestration.md) | Boot sequence, state flow, undo, persistence, export flow, full exclusion list |
| [Audit/02-templates.md](Audit/02-templates.md) | Template schema, the declarative parameter system, choreography, seamless looping, migrations |
| [Audit/03-rendering.md](Audit/03-rendering.md) | WebGL pipeline, all 6 shaders, every effect explained, media textures, export encoding, performance |
| [Audit/04-ui.md](Audit/04-ui.md) | Layout, panels, every inspector control with ranges, timeline, interactions, shortcuts |

---

## The original, for reference

```
Reference/
├─ sites/aligncanvas.com/
│   ├─ create.html          the page shell
│   ├─ css/app.css          all the interface styling  ← copy design tokens from here
│   ├─ js/                  ~40 source files (see the audit for the module map)
│   └─ media/               10 bundled stock photos + library thumbnails
└─ archive-manifest.json    what was captured, and from where
```

Read this code freely to understand how something works. Don't copy the excluded files (auth, billing, cloud, analytics) — [Part 2 §3](docs/02-SCOPE.md) lists exactly which they are.

---

## Decisions already made

| | |
|---|---|
| **Stack** | React + TypeScript + Vite |
| **Drawing** | Plain WebGL2 — React never touches the canvas |
| **Layers & timeline** | Faithful parity first; real layers and keyframes in Phase 2 |
| **Templates** | ~20 first, then the remaining ~146 in batches |
| **Backend** | None — static hosting only |
| **Removed** | Auth, billing, plan limits, cloud sync, analytics, tracking |
| **AI** | Nothing to remove — the original has none (verified by search) |
| **Plan limits** | Everything unlocked — 4K, 120fps, all templates, unlimited exports |

---

## First concrete step

Open **[docs/03-BLUEPRINT.md §1](docs/03-BLUEPRINT.md)** and follow *"Getting started — the exact commands"*. You'll install Node.js and VS Code, create the project, and have a live dev server running in about 15 minutes.

Then work through **Milestone 0** onward. Each milestone ends with a check you can actually see.

---

## The one idea to remember

> **One frame = a pure function of (your settings, a time value).**

Same settings + same time → the same picture, every time. This single property is what gives the app frame-perfect export, a preview that matches the final file, and testable motion logic. Nearly every design decision in the blueprint exists to protect it.
