import type { ProjectState } from './types';

/**
 * A single control in an inspector — **data, not code**.
 *
 * The original writes its ~90 style controls by hand with literal paths. One
 * schema instead drives the default value, the widget, the range, the
 * conditional visibility, the "modified" marker and the reset button, so
 * adding a control is one line.
 */
export type ControlDef =
  | RangeControl
  | SegmentedControl
  | SelectControl
  | ToggleControl
  | ColorControl
  | TextControl
  | HeaderControl;

interface BaseControl {
  /** Dotted path into `ProjectState`, e.g. `'style.glass.width'`. */
  path: string;
  label: string;
  /** Render nothing unless this returns true. */
  showIf?: (state: ProjectState) => boolean;
  hint?: string;
}

export interface RangeControl extends BaseControl {
  type: 'range';
  min: number;
  max: number;
  step: number;
  def: number;
  /** How the number is shown next to the slider. */
  format?: 'percent' | 'multiplier' | 'degrees' | 'turns' | 'seconds' | 'cycles' | 'none';
  /** Text shown instead of `0` at exactly zero. */
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
  /** `#rrggbb` */
  def: string;
}

export interface TextControl extends BaseControl {
  type: 'text';
  def: string;
  placeholder?: string;
}

/** Not a control — a small sub-heading inside a panel body. */
export interface HeaderControl {
  type: 'header';
  label: string;
  showIf?: (state: ProjectState) => boolean;
}

/** Any control that actually has a path and a default value. */
export type ValueControl = Exclude<ControlDef, HeaderControl>;

/** A titled, collapsible group of controls. */
export interface ControlSection {
  /** Accordion key — also the UI-state key for open/closed. */
  id: string;
  title: string;
  subtitle?: string;
  /** Path to the on/off switch for the whole section, if it has one. */
  togglePath?: string;
  controls: ControlDef[];
}

/** Does this control differ from its declared default? */
export function isModified(def: ControlDef, state: ProjectState): boolean {
  if (def.type === 'header') return false;
  const value = readPath(state, def.path);
  if (value === undefined) return false;
  return value !== def.def;
}

/** True when any control in the section has been moved off its default. */
export function sectionModified(section: ControlSection, state: ProjectState): boolean {
  return section.controls.some(c => isModified(c, state));
}

function readPath(state: ProjectState, path: string): unknown {
  let cur: unknown = state;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}
