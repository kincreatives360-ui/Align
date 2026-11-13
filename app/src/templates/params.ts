import type { ParamValue } from '../state/types';
import type { ControlDef, ControlSection, RangeControl } from '../state/controls';
import type { Template } from './types';

/** Every template gets these two, whether it declares them or not. */
export const SPEED_CONTROL: RangeControl = {
  type: 'range',
  path: 'params.speed',
  label: 'Speed',
  min: 0.2,
  max: 3,
  step: 0.05,
  def: 1,
  format: 'multiplier',
};

export const COUNT_CONTROL: RangeControl = {
  type: 'range',
  path: 'params.count',
  label: 'Cards',
  min: 1,
  max: 24,
  step: 1,
  def: 6,
};

/**
 * Which sub-heading a template parameter belongs under, keyed by the part of
 * its name before the first `-`. Anything unlisted lands in "Fine-tune".
 */
const GROUPS: Record<string, string> = {
  speed: 'Motion',
  count: 'Motion',
  gap: 'Layout',
  spread: 'Layout',
  radius: 'Layout',
  rows: 'Layout',
  cols: 'Layout',
  camera: 'Camera',
  angle: 'Camera',
  tilt: 'Camera',
  depth: 'Depth',
  blur: 'Depth',
  bend: 'Bend',
  wave: 'Bend',
  stagger: 'Timing',
  hold: 'Timing',
};

const groupOf = (key: string) => GROUPS[key] ?? 'Fine-tune';

const lastSegment = (path: string) => path.split('.').pop() ?? path;

/** The starting values for a template's parameters. */
export function defaults(template: Template): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {};

  for (const control of [SPEED_CONTROL, COUNT_CONTROL, ...(template.params ?? [])]) {
    if (control.type === 'header') continue;
    out[lastSegment(control.path)] = control.def;
  }

  return { ...out, ...(template.mods ?? {}) };
}

/**
 * The active template's controls, split into collapsible groups:
 * the shared Motion pair first, then that template's own settings.
 */
export function controlGroups(template: Template): ControlSection[] {
  const shared: ControlDef[] = [SPEED_CONTROL];
  if (!template.fixedN) shared.push(COUNT_CONTROL);

  const sections: ControlSection[] = [
    { id: 'p-motion', title: 'Motion', controls: shared },
  ];

  const own = template.params ?? [];
  const buckets = new Map<string, ControlDef[]>();

  for (const control of own) {
    const key = control.type === 'header' ? '' : lastSegment(control.path);
    const group = key ? groupOf(key) : 'Fine-tune';
    const list = buckets.get(group) ?? [];
    list.push(control);
    buckets.set(group, list);
  }

  for (const [title, controls] of buckets) {
    sections.push({ id: `p-${title.toLowerCase().replace(/\s+/g, '-')}`, title, controls });
  }

  return sections;
}
