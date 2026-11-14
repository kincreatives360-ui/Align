import type { StyleTree } from '../state/types';

/** One-click style presets — layered over the template's look. */
export const STYLE_PRESETS: Record<string, { name: string; s: StyleTree }> = {
  clean: {
    name: 'Clean',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  liquid: {
    name: 'Liquid glass',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: true, mode: 'per', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  prism: {
    name: 'Prism',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: true, mode: 'all', amount: 0.8, top: 0, bottom: 0, left: 1, right: 1, width: 0.2, refraction: 0.7, stretch: 0, bulge: 0.2, curve: 'lens', dispersion: 1, soften: 0.25, feather: 0.1, highlight: 0.2 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0, chroma: 0.3, contrast: 1, saturation: 1, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  frosted: {
    name: 'Liquid lens',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: true, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'sweep' },
      bg: { mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  noir: {
    name: 'Noir',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'radial', c: ['#060607', '#1c1c20', '#000000', '#000000'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0.45, vignette: 0.55, contrast: 1.15, chroma: 0, bloom: 0.1, saturation: 0, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  holo: {
    name: 'Holographic',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: true, width: 0.3, refraction: 0.7, dispersion: 1 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'holo', c: ['#f2f2f6', '#ffffff', '#ffffff', '#ffffff'], cycles: 1, scale: 1, angle: 34, amt: 0.9, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0.3, chroma: 0, contrast: 1, saturation: 1, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  dreamy: {
    name: 'Dreamy',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: true, depth: 0.45, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'mesh', c: ['#fbf7ff', '#ffd6e7', '#cfe6ff', '#ffe9c7'], cycles: 1, scale: 1.4, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0.15, vignette: 0, bloom: 0.45, chroma: 0, contrast: 1, saturation: 1.05, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  film: {
    name: 'Film',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'solid', c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'], cycles: 1, scale: 1, angle: 34, amt: 1, transparent: false },
      fx: { grain: 0.6, vignette: 0.5, bloom: 0, chroma: 0.3, contrast: 1.08, saturation: 0.9, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
  neon: {
    name: 'Neon night',
    s: {
      card: { radius: 0.06, border: 0, aspect: 'auto', back: 'mirror', backColor: '#1a1a1d', brightness: 1, opacity: 1, tint: '#ffffff', tintA: 0 },
      shadow: { on: false, alpha: 0.28, soft: 0.16, offset: 0.05, color: '#000000' },
      shade: { on: false, amount: 0.3, glare: 1, sweep: false },
      blur: { on: false, depth: 0.25, focus: 0, edge: 0 },
      cardGlass: { on: false, width: 0.22, refraction: 0.6, dispersion: 0.5 },
      glass: { on: false, mode: 'all', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: 0.27, refraction: 0.55, stretch: 0, bulge: 0.35, curve: 'panel', dispersion: 0.6, soften: 0.45, feather: 0, highlight: 0.3 },
      lens: { on: false, mode: 'glass', shape: 'pill', x: 0.5, y: 0.5, w: 0.62, h: 0.3, refraction: 0.55, frost: 0, dispersion: 0.55, bevel: 0.05, highlight: 0.85, magnify: 0.03, shadow: 0.55, tint: '#ffffff', tintA: 0.04, motion: 'static' },
      bg: { mode: 'aurora', c: ['#05050a', '#ff2bd6', '#3b5bff', '#2fe3c0'], cycles: 1, scale: 1, angle: 34, amt: 1.2, transparent: false },
      fx: { grain: 0, vignette: 0, bloom: 0.7, chroma: 0, contrast: 1.1, saturation: 1.2, exposure: 1 },
      camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
      title: { on: false, text: 'Collection', color: '#ffffff', size: 1, weight: 400, font: 'Inter', y: 0.5 },
      labels: { on: false, tl: 'AlignCanvas', tr: 'Selected work', bl: '2026', br: 'Made with AlignCanvas', size: 1, color: 'auto', mark: true, font: '' },
      logo: { on: false, id: '', pos: 'br', size: 0.14, opacity: 1 },
      anim: { on: false, kind: 'rise', speed: 1, at: 0, dur: 1 },
    },
  },
};

/** Background color palettes — 10 curated 4-color sets. */
export const BG_PALETTES: string[][] = [
  ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'],
  ['#0b0b0d', '#1d1f26', '#2a2d38', '#14151a'],
  ['#fbf7ff', '#ffd6e7', '#cfe6ff', '#ffe9c7'],
  ['#05050a', '#ff2bd6', '#3b5bff', '#2fe3c0'],
  ['#f2f0ea', '#e7dfd1', '#ff6a1a', '#ffffff'],
  ['#0b1d17', '#1fbf8f', '#2fe39b', '#0e2a20'],
  ['#101827', '#38bdf8', '#7c5cff', '#1b263b'],
  ['#ff4d2e', '#ff8a3d', '#ffd23f', '#ffffff'],
  ['#eef1ff', '#2f5bff', '#9ab0ff', '#ffffff'],
  ['#1a1022', '#ff8a3d', '#ff3d6e', '#2a1b37'],
];

/** Preview background for a preset (used in the preset grid). */
export function presetBg(key: string): string {
  const preset = STYLE_PRESETS[key];
  if (!preset) return '#f4f4f4';

  const bg = preset.s.bg;
  if (!bg) return '#f4f4f4';

  const colors = bg.c || ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'];
  const mode = bg.mode || 'solid';

  if (mode === 'solid') return colors[0];
  if (mode === 'linear' || mode === 'radial') return `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  if (mode === 'mesh' || mode === 'aurora') return `linear-gradient(135deg, ${colors[0]}, ${colors[1]}, ${colors[2]})`;

  return colors[0];
}

/** Ordered list of preset keys for UI display. */
export const PRESET_KEYS = Object.keys(STYLE_PRESETS);