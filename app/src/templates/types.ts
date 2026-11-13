import type { Aspect, ParamValue, StyleTree } from '../state/types';
import type { ControlDef } from '../state/controls';

export type CategoryId =
  | 'classic'
  | 'stack'
  | 'ring'
  | 'grid'
  | 'glass'
  | 'blur'
  | 'bold'
  | 'minimal'
  | 'transitions'
  | 'carousel';

export interface CategoryInfo {
  id: CategoryId;
  label: string;
}

/** Everything a template's layout function can see. */
export interface Env {
  /** Loop phase 0→1, wrapping. Everything must be periodic in this. */
  p: number;
  n: number;
  /** Screen aspect (width ÷ height). */
  asp: number;
  /** Card width / height in world units. */
  w: number;
  h: number;
  /** How far the view extends. */
  vx: number;
  vy: number;
  /** Deterministic per-card random. */
  rnd: (i: number, k?: number) => number;
  /** The active easing curve. */
  ez: (t: number) => number;
  /** Hold fraction for stepped motion. */
  hold: number;
  /** Distance to view plane. */
  D: number;
  /** Number of media blocks (for fill). */
  mb: number;
  /** Total cards after fill. */
  m: number;
  [key: string]: unknown;
}

/** Where one card sits at a given moment. */
export interface CardPose {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number;
  o?: number;
  blur?: number;
  b?: number;
  glare?: number;
  zBias?: number;
  bend?: number;
  aspect?: number;
  /** Override which media item this card shows. */
  img?: number;
  /** Or supply a full transform matrix instead of x/y/z/rx/ry/rz. */
  m?: Float32Array;
  /** For wave displacement */
  h?: number;
  w?: number;
  /** For crumple */
  crumple?: number;
  crSeed?: number;
  /** For glare phase */
  glareP?: number;
  /** For bend axis */
  bendY?: number;
}

export type P = Record<string, ParamValue>;

/** A recipe that turns (card index, params, phase) into a pose. */
export interface Template {
  id: string;
  name: string;
  cat: CategoryId;
  desc?: string;
  isNew?: boolean;

  /** Default card count. */
  n: number;
  /** Card width ÷ height. */
  aspect: number;
  /** The frame shape this was designed for. */
  frame: Aspect;
  /** Field of view in degrees. */
  fov?: number;
  /** Card height in world units. */
  cardH?: number;

  /** Continuous templates: seconds per loop. */
  dur?: number;
  /** Stepped templates hand cards off one at a time. */
  step?: boolean;
  perCard?: number;
  /** Card count is fixed — hide the Cards slider. */
  fixedN?: boolean;

  /** Texture resolution multiplier. */
  resBoost?: number;

  /** The look this template wants, layered over the default. */
  style?: DeepPartial<StyleTree>;

  /** This template's own controls. */
  params?: ControlDef[];

  /** Fixed parameter values, applied last. */
  mods?: Record<string, ParamValue>;

  /** Multiply or derive the card slots. */
  fill?: (params: P, env: Env) => Record<string, unknown>;

  /** The camera for this template. */
  camera?: (params: P, env: Env) => { eye: Vec3; target: Vec3 };

  /** Special template kind (e.g., 'flare') */
  kind?: string;

  /** ★ The animation: where is card `i` at loop phase `env.p`? */
  layout: (i: number, params: P, env: Env) => CardPose;
}

export type Vec3 = [number, number, number];

/** An object whose nested values may themselves be partial. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
