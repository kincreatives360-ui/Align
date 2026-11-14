/**
 * The project data model.
 *
 * This file is the contract for the whole app: templates, engine, renderer and
 * UI all speak in these shapes. Nothing here imports anything else except
 * small helper types.
 */
import type { SocialPresetKey } from './config';

/** Bumped whenever the persisted shape changes. See `migrate.ts`. */
export const SCHEMA_VERSION = 2 as const;

/** Values a template parameter or a control can hold. */
export type ParamValue = number | string | boolean;

/** Frame shapes the canvas can be set to. */
export type Aspect =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '5:4'
  | '4:3'
  | '3:4'
  | '21:9'
  | '2:3';

export type ThemeSetting = 'light' | 'dark' | 'system';

/** Your images and videos, in card order. The array order IS the layer order. */
export interface MediaState {
  /** How images are assigned to cards. */
  order: 'in' | 'shuffle';
  /** Drives the shuffle and all per-card randomness. */
  seed: number;
  /** Which procedural media set to use ('auto' = use uploaded images). */
  set: 'auto' | 'logos' | 'wordmarks' | 'gradients' | 'scenery' | 'ui' | 'posters' | 'cards' | 'shapes' | 'photos';
  /** Index in this array = card number. */
  images: MediaItem[];
}

export interface MediaItem {
  /** Stable id — this is all a history snapshot stores. */
  id: string;
  kind: 'image' | 'video';
  name: string;
  width: number;
  height: number;
  /** Videos only, in seconds. */
  duration?: number;
  /** Stock library only — a path, never copied into storage. */
  libraryPath?: string;
}

export interface FrameState {
  aspect: Aspect;
  /** Preview quality hint for the renderer. */
  preview: 'draft' | 'auto' | 'max';
  /** Which safe-zone overlay to draw. Never exported. */
  zone: '' | 'reels' | 'story' | 'feed';
  /** Whether the overlay is shown at all. */
  zoneShow: boolean;
  /** Active social preset key. */
  social: SocialPresetKey | '';
}

/** Still / video / sequence export settings. */
export interface ExportSettings {
  kind: 'video' | 'gif' | 'image' | 'sequence';
  format: 'mp4' | 'webm';
  /** Long edge in pixels: 480 | 720 | 1080 | 1440 | 2160 */
  res: number;
  fps: number;
  quality: 'low' | 'medium' | 'high' | 'max';
  /** 0 means "auto" = exactly one template loop. */
  duration: number;
  /** Fit a whole number of loops into the duration. */
  seamless: boolean;
  // stills
  img: 'png' | 'jpeg' | 'webp';
  scale: number;
  transparent: boolean;
  // gif
  gifWidth: number;
  gifFps: number;
  gifColors: number;
  // image sequence
  seqFps: number;
}

/* ------------------------------------------------------------------ */
/* The "look"                                                         */
/* ------------------------------------------------------------------ */

export type GlassMode = 'all' | 'per';
export type GlassCurve = 'panel' | 'lens' | 'wave';
export type LensMode = 'glass' | 'hole';
export type LensShape = 'pill' | 'circle' | 'square';
export type LensMotion = 'static' | 'drift' | 'sweep' | 'orbit';
export type BgMode =
  | 'solid'
  | 'linear'
  | 'radial'
  | 'mesh'
  | 'aurora'
  | 'grid'
  | 'dots'
  | 'holo'
  | 'spotlight'
  | 'plasma';
export type CardAspect = 'auto' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16' | '16:9' | '8:5';
export type TitleAnim = 'fade' | 'rise' | 'pop' | 'type' | 'slide';
export type LogoPos = 'tl' | 'tr' | 'center' | 'bl' | 'br';

export interface StyleTree {
  card: {
    radius: number;
    border: number;
    aspect: CardAspect;
    back: 'mirror' | 'solid';
    backColor: string;
    brightness: number;
    opacity: number;
    tint: string;
    tintA: number;
  };
  shadow: { on: boolean; alpha: number; soft: number; offset: number; color: string };
  shade: { on: boolean; amount: number; glare: number; sweep: boolean };
  blur: { on: boolean; depth: number; focus: number; edge: number };
  cardGlass: { on: boolean; width: number; refraction: number; dispersion: number };
  glass: {
    on: boolean;
    mode: GlassMode;
    amount: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
    width: number;
    refraction: number;
    stretch: number;
    bulge: number;
    curve: GlassCurve;
    dispersion: number;
    soften: number;
    feather: number;
    highlight: number;
  };
  lens: {
    on: boolean;
    mode: LensMode;
    shape: LensShape;
    x: number;
    y: number;
    w: number;
    h: number;
    refraction: number;
    frost: number;
    dispersion: number;
    bevel: number;
    highlight: number;
    magnify: number;
    shadow: number;
    tint: string;
    tintA: number;
    motion: LensMotion;
  };
  bg: {
    mode: BgMode;
    /** Up to 4 colours, `#rrggbb`. */
    c: string[];
    cycles: number;
    scale: number;
    angle: number;
    amt: number;
    transparent: boolean;
  };
  fx: {
    grain: number;
    vignette: number;
    bloom: number;
    chroma: number;
    contrast: number;
    saturation: number;
    exposure: number;
  };
  camera: { fov: number; zoom: number; orbit: number; tilt: number; drift: number };
  title: {
    on: boolean;
    text: string;
    color: string;
    size: number;
    weight: 400 | 600 | 700;
    font: string;
    y: number;
  };
  labels: {
    on: boolean;
    tl: string;
    tr: string;
    bl: string;
    br: string;
    size: number;
    color: 'auto' | '#ffffff' | '#111111';
    mark: boolean;
    font: string;
  };
  logo: { on: boolean; id: string; pos: LogoPos; size: number; opacity: number };
  anim: { on: boolean; kind: TitleAnim; speed: number; at: number; dur: number };
}

/* ------------------------------------------------------------------ */
/* The project                                                         */
/* ------------------------------------------------------------------ */

export interface ProjectState {
  v: typeof SCHEMA_VERSION;
  name: string;
  templateId: string;
  /** Values for the active template's parameters, keyed by param key. */
  params: Record<string, ParamValue>;
  style: StyleTree;
  /** "Keep my look" when switching templates. */
  keepStyle: boolean;
  media: MediaState;
  frame: FrameState;
  export: ExportSettings;
  theme: ThemeSetting;
}

/* ------------------------------------------------------------------ */
/* Engine types                                                        */
/* ------------------------------------------------------------------ */

export interface FaceRef {
  key: string;    // media key
  aspect: number; // aspect ratio (width/height)
  res: number;    // texture resolution (pixels on long edge)
  kind: 'image' | 'video';
  img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
  tex?: WebGLTexture[];
}

/** Cached face entry with textures ready for rendering. */
export interface FaceEntry {
  tex: WebGLTexture[];
  w: number;
  h: number;
  face: FaceRef;
  info: any;
  used: number;
  k?: string;
  item?: FaceRef;
  ver?: number;
  vt?: number;
  blurT?: number;
  stale?: boolean;
}

export interface FrameBackground {
  mode: number;         // BG_MODES enum
  c: number[];      // up to 4 colours as [r,g,b,a] or just [r,g,b]
  phase: number;    // 0..1 animation phase
  cycles: number;   // motion multiplier
  scale: number;    // background scale
  angle: number;    // degrees (UI) / radians (engine converts ×D2R)
  amt: number;      // strength
  transparent: boolean;
}

export interface CameraDesc {
  fov: number;          // vertical FOV in radians
  eye: [number, number, number]; // world-space eye position
  target: [number, number, number]; // point camera looks at
  up?: [number, number, number]; // up vector
}

export interface CardDesc {
  m: Float32Array;        // model matrix (column-major)
  x: number; y: number; z: number; // world position
  rx: number; ry: number; rz: number; // rotation in radians
  sx: number; sy: number; // scale
  w: number; h: number; // pixel dimensions
  face: FaceRef;        // reference to media (converted to FaceEntry by renderer)
  radius: number;       // corner rounding
  opacity: number;      // 0..1
  blur: number;         // depth-of-field blur
  shade: number;        // edge shading amount 0..1
  border: number;       // rim light
  glare: number;        // glare intensity 0..1
  glareP: number;       // glare phase offset 0..2.8-.8
  backMix: number;      // 0=mirror, 1=solid back
  backCol: number[];    // [r,g,b]
  bright: number;       // card brightness multiplier
  tint: number[];       // [r,g,b]
  tintA: number;        // tint amount 0..1
  glassW: number;       // card glass width 0..1
  glassR: number;       // refraction 0..1.5
  glassD: number;       // dispersion 0..1.5
  crumple: number;      // crumple amount 0..1
  crSeed: number;       // crumple seed
  bend: number;         // bend amount
  bendY: number;        // bendY amount
  zBias: number;        // depth bias
  thick: number;        // card thickness
  edgeCol: number[];    // edge color
}

export interface ShadowDesc {
  on: boolean; alpha: number; soft: number; offset: number; color: number[];
}

export interface PostDesc {
  labels: boolean; seed: number;
  u: {
    uEdge: number[]; uEW: number; uER: number; uED: number; uES: number; uEF: number; uEH: number; uEB: number; uEX: number;
    uEdgeTint: number[]; uECurve: { i: number; }; uLensOn: number | { i: number }; uLensMode: number | { i: number };
    uLensC: [number, number]; uLensS: [number, number]; uLensR: number;
    uLensRef: number; uLensFrost: number; uLensDisp: number; uLensBevel: number; uLensHi: number; uLensMag: number;
    uLensShadow: number; uLensTint: number[]; uLensTintA: number;
    uGrain: number; uVig: number; uBloom: number; uChroma: number; uContrast: number; uSat: number; uEdgeBlur: number; uExposure: number;
    [key: string]: any;
  };
}

/** Complete frame descriptor for rendering. */
export interface FrameDescriptor {
  W: number;
  H: number;
  bg: FrameBackground | null;
  camera: CameraDesc;
  cards: CardDesc[];
  shadow: ShadowDesc | null;
  flare: any | null;
  post: PostDesc;
}