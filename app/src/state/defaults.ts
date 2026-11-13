import type { StyleTree, ProjectState, FrameState, ExportSettings, MediaState } from './types';
import { SCHEMA_VERSION } from './types';

/**
 * The neutral starting "look". Every template layers its own preferences on
 * top of this, so it has to be a tasteful all-off default: no effect should
 * be visibly active until someone asks for it.
 */
export const BASE_STYLE: StyleTree = {
  card: {
    radius: .06,
    border: 0,
    aspect: 'auto',
    back: 'mirror',
    backColor: '#1a1a1d',
    brightness: 1,
    opacity: 1,
    tint: '#ffffff',
    tintA: 0,
  },
  shadow: { on: false, alpha: .28, soft: .16, offset: .05, color: '#000000' },
  shade: { on: false, amount: .3, glare: 1, sweep: false },
  blur: { on: false, depth: .25, focus: 0, edge: 0 },
  cardGlass: { on: false, width: .22, refraction: .6, dispersion: .5 },
  glass: { on: false, mode: 'per', amount: 1, top: 0, bottom: 0, left: 1, right: 1, width: .27, refraction: .55, curve: 'panel', dispersion: .6, soften: .45, feather: 0, highlight: .3, bulge: .35, stretch: 0 },
  lens: {
    on: false,
    mode: 'glass',
    shape: 'pill',
    x: .5,
    y: .5,
    w: .62,
    h: .3,
    refraction: .55,
    frost: 0,
    dispersion: .55,
    bevel: .05,
    highlight: .85,
    magnify: .03,
    shadow: .55,
    tint: '#ffffff',
    tintA: .04,
    motion: 'static',
  },
  bg: {
    mode: 'solid',
    c: ['#f4f4f4', '#e6e8ee', '#dfe4ff', '#ffe3ee'],
    cycles: 1,
    scale: 1,
    angle: 34,
    amt: 1,
    transparent: false,
  },
  fx: {
    grain: 0,
    vignette: 0,
    bloom: 0,
    chroma: 0,
    contrast: 1,
    saturation: 1,
    exposure: 1,
  },
  camera: { fov: 30, zoom: 1, orbit: 0, tilt: 0, drift: 0 },
  title: {
    on: false,
    text: 'Collection',
    color: '#ffffff',
    size: 1,
    weight: 400,
    font: 'Inter',
    y: .5,
  },
  labels: {
    on: false,
    tl: 'AlignCanvas',
    tr: 'Selected work',
    bl: '2026',
    br: 'Made with AlignCanvas',
    size: 1,
    color: 'auto',
    mark: true,
    font: '',
  },
  logo: { on: false, id: '', pos: 'br', size: .14, opacity: 1 },
  anim: { on: false, kind: 'rise', speed: 1 },
};

export const DEFAULT_FRAME: FrameState = {
  aspect: '5:4',
  preview: 'auto',
  zone: '',
  zoneShow: false,
};

export const DEFAULT_EXPORT: ExportSettings = {
  kind: 'video',
  format: 'mp4',
  res: 1080,
  fps: 60,
  quality: 'high',
  duration: 0,
  seamless: true,
  img: 'png',
  scale: 2160,
  transparent: false,
  gifWidth: 640,
  gifFps: 25,
  gifColors: 256,
  seqFps: 30,
};

export const DEFAULT_MEDIA: MediaState = {
  order: 'in',
  seed: 1,
  images: [],
};

/** A brand-new, empty project. */
export function newProject(): ProjectState {
  return {
    v: SCHEMA_VERSION,
    name: 'Untitled project',
    templateId: 'carousel-classic',
    params: {},
    style: structuredClone(BASE_STYLE),
    keepStyle: false,
    media: structuredClone(DEFAULT_MEDIA),
    frame: { ...DEFAULT_FRAME },
    export: { ...DEFAULT_EXPORT },
    theme: 'dark',
  };
}