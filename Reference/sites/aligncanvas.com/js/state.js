// Project state: the look (style), the chosen template and its parameters, media, frame and export settings.
import { byId, defaults } from './templates.js';
import { flareDefaults } from './flare.js';

export const DEFAULT_ASPECT = '5:4';
export const BASE_STYLE = {
  card: {radius: .06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0},
  // shadow and shade start off; turn them on per project
  shadow: {on: false, alpha: .28, soft: .16, offset: .05, color: '#000000'},
  shade: {on: false, amount: .3, glare: 1, sweep: false},
  blur: {on: false, depth: .25, focus: 0, edge: 0},
  cardGlass: {on: false, width: .22, refraction: .6, dispersion: .5},
  glass: {on: false, mode: 'per', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: .27, refraction: .55, curve: 'panel', dispersion: .6, soften: .45, feather: 0, highlight: .3, bulge: .35, stretch: 0},
  lens: {on: false, mode: 'glass', shape: 'pill', x: .5, y: .5, w: .62, h: .3, refraction: .55, frost: 0, dispersion: .55, bevel: .5, highlight: .85, magnify: .03, shadow: .55, tint: '#ffffff', tintA: .04, motion: 'static'},
  bg: {mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: .6, amt: 1, transparent: false},
  fx: {grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1, exposure: 1},
  camera: {fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0},
  title: {on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: .5},
  labels: {on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: ''},
  // your logo (from the brand kit): its image lives in IndexedDB under id, like uploaded media
  logo: {on: false, id: '', pos: 'br', size: .14, opacity: 1},
  // animate the title, corner labels and logo in at the start of the clip and out at its end, so loops stay seamless
  anim: {on: false, kind: 'rise', speed: 1},
};

// one-click looks, layered over whatever the template set up
export const STYLE_PRESETS = {
  clean:   {name: 'Clean', s: {glass: {on: false}, lens: {on: false}, cardGlass: {on: false}, fx: {grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1}}},
  liquid:  {name: 'Liquid glass', s: {glass: {on: true, mode: 'per', top: 0, bottom: 0, left: 1, right: 1, width: .27, refraction: .55, curve: 'panel', dispersion: .6, soften: .45, highlight: .3, bulge: .35}}},
  prism:   {name: 'Prism', s: {glass: {on: true, mode: 'all', amount: .8, width: .2, refraction: .7, curve: 'lens', dispersion: 1, soften: .25, highlight: .2, bulge: .2}, fx: {chroma: .3}}},
  frosted: {name: 'Liquid lens', s: {lens: {on: true, mode: 'glass', shape: 'pill', w: .62, h: .3, frost: 0, refraction: .55, dispersion: .55, motion: 'sweep', tintA: .04}}},
  noir:    {name: 'Noir', s: {bg: {mode: 'radial', c: ['#060607', '#1c1c20', '#000000', '#000000']}, fx: {grain: .45, vignette: .55, contrast: 1.15, saturation: 0, bloom: .1}}},
  holo:    {name: 'Holographic', s: {bg: {mode: 'holo', c: ['#f2f2f6', '#ffffff', '#ffffff', '#ffffff'], amt: .9}, cardGlass: {on: true, width: .3, refraction: .7, dispersion: 1}, fx: {bloom: .3}}},
  dreamy:  {name: 'Dreamy', s: {bg: {mode: 'mesh', c: ['#fbf7ff', '#ffd6e7', '#cfe6ff', '#ffe9c7'], scale: 1.4}, blur: {on: true, depth: .45}, fx: {bloom: .45, grain: .15, saturation: 1.05}}},
  film:    {name: 'Film', s: {fx: {grain: .6, vignette: .5, contrast: 1.08, chroma: .3, saturation: .9}}},
  neon:    {name: 'Neon night', s: {bg: {mode: 'aurora', c: ['#05050a', '#ff2bd6', '#3b5bff', '#2fe3c0'], amt: 1.2}, fx: {bloom: .7, contrast: 1.1, saturation: 1.2}}},
};

export const BG_PALETTES = [
  ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], ['#0b0b0d', '#1d1f26', '#2a2d38', '#14151a'], ['#fbf7ff', '#ffd6e7', '#cfe6ff', '#ffe9c7'],
  ['#05050a', '#ff2bd6', '#3b5bff', '#2fe3c0'], ['#f2f0ea', '#e7dfd1', '#ff6a1a', '#ffffff'], ['#0b1d17', '#1fbf8f', '#2fe39b', '#0e2a20'],
  ['#101827', '#38bdf8', '#7c5cff', '#1b263b'], ['#ff4d2e', '#ff8a3d', '#ffd23f', '#ffffff'], ['#eef1ff', '#2f5bff', '#9ab0ff', '#ffffff'],
  ['#1a1022', '#ff8a3d', '#ff3d6e', '#2a1b37'],
];

const clone = o => JSON.parse(JSON.stringify(o));
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
export function templateParams(t){ return t.kind === 'flare' ? flareDefaults(t.n) : defaults(t); }

export function newState(){
  const t = byId('flare-duo');
  return {
    v: 3, template: t.id, params: templateParams(t), style: templateStyle(t), keepStyle: false,
    // images: your media in card order, images and videos alike: {id, kind: 'image'|'video', name, w, h, dur?}
    // plus lib (a path in media/library/) for library picks; uploads keep their blob in IndexedDB under id
    media: {set: 'auto', order: 'in', seed: 1, images: []},
    // one frame for every template; switching templates never changes it
    // zone: the social preset's safe-zone guide shown over the preview (never exported)
    frame: {aspect: DEFAULT_ASPECT, preview: 'auto', zone: '', social: ''},
    theme: (() => { try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (e){ return 'dark'; } })(),
    // duration 0 = one loop of the template; seamless fits whole loops into the duration
    export: {kind: 'video', format: 'mp4', res: 1080, fps: 60, quality: 'high', duration: 0, seamless: true, img: 'png', scale: 2160, transparent: false, gifWidth: 640, gifFps: 25, gifColors: 256, seqFps: 30},
  };
}
// switch template: its own parameters, and its look unless the user locked their style
export function applyTemplate(state, id){
  const t = byId(id);
  state.template = t.id;
  state.params = templateParams(t);
  // labels keep your text but follow the template's on/off
  // your logo and the text animation are yours, not the template's, so they carry over too
  if (!state.keepStyle){ const {labels, logo, anim} = state.style; state.style = templateStyle(t); state.style.labels = {...labels, on: state.style.labels.on}; state.style.logo = logo; state.style.anim = anim; }
}

/* ---------- persistence & history ---------- */
const KEY = 'aligncanvas-v1';
export function save(state){
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  // media lives in IndexedDB and the state only names it; if even that is too big, drop the inline
  // fallback images (kept only when IndexedDB isn't available) rather than the whole save
  catch (e){ try { localStorage.setItem(KEY, JSON.stringify({...state, media: {...state.media, images: state.media.images.filter(m => !m.src)}})); } catch (e2){} }
}
export function load(){
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return null;
    return upgrade(JSON.parse(raw));
  } catch (e){ return null; }
}
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
export class History {
  constructor(){ this.stack = []; this.i = -1; this.lock = false; }
  push(state){
    if (this.lock) return;
    const snap = JSON.stringify({...state, media: {...state.media, images: state.media.images.map(m => m.id)}});
    if (this.stack[this.i] === snap) return;
    this.stack = this.stack.slice(0, this.i + 1); this.stack.push(snap);
    if (this.stack.length > 80) this.stack.shift();
    this.i = this.stack.length - 1;
  }
  step(d, state){
    const j = this.i + d; if (j < 0 || j >= this.stack.length) return null;
    this.i = j; const s = JSON.parse(this.stack[j]);
    // images are kept out of the history; restore the current ones by id
    s.media.images = s.media.images.map(id => state.media.images.find(m => m.id === id)).filter(Boolean);
    return s;
  }
}
