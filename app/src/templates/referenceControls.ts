import type { ControlDef } from '../state/controls';

export interface ReferenceRangeControl {
  key: string;
  label: string;
  type: 'range';
  min: number;
  max: number;
  step: number;
  def: number;
  unit?: string;
  hint?: string;
  off?: boolean;
  auto?: boolean;
  percent?: boolean;
}

export interface ReferenceSegmentControl {
  key: string;
  label: string;
  type: 'seg';
  options: Record<string, string>;
  def: string;
  hint?: string;
}

export interface ReferenceSelectControl {
  key: string;
  label: string;
  type: 'select';
  options: Record<string, string>;
  def: string;
  hint?: string;
}

export interface ReferenceToggleControl {
  key: string;
  label: string;
  type: 'toggle';
  def: boolean;
  hint?: string;
}

export interface ReferenceGroupMarker {
  group: string;
}

export type ReferenceControl =
  | ReferenceRangeControl
  | ReferenceSegmentControl
  | ReferenceSelectControl
  | ReferenceToggleControl
  | ReferenceGroupMarker;

/** Convert the archived template schema to the app's typed control schema. */
export function adaptReferenceControls(controls: ReferenceControl[]): ControlDef[] {
  return controls.map(control => {
    if ('group' in control) {
      return { type: 'header', label: control.group };
    }

    if (control.type === 'toggle') {
      return {
        type: 'toggle',
        path: `params.${control.key}`,
        label: control.label,
        def: control.def,
        ...(control.hint === undefined ? {} : { hint: control.hint }),
      };
    }

    if (control.type === 'seg' || control.type === 'select') {
      return {
        type: control.type === 'seg' ? 'segment' : 'select',
        path: `params.${control.key}`,
        label: control.label,
        options: Object.entries(control.options).map(([value, label]) => ({ value, label })),
        def: control.def,
        ...(control.hint === undefined ? {} : { hint: control.hint }),
      };
    }

    return {
      type: 'range',
      path: `params.${control.key}`,
      label: control.label,
      min: control.min,
      max: control.max,
      step: control.step,
      def: control.def,
      ...(control.unit === undefined ? {} : { unit: control.unit }),
      ...(control.percent ? { format: 'percent' as const } : {}),
      ...(control.off ? { zeroLabel: 'off' } : control.auto ? { zeroLabel: 'auto' } : {}),
      ...(control.hint === undefined ? {} : { hint: control.hint }),
    };
  });
}
