import type { ControlDef } from '../state/controls';

/** Flare Duo - the glass card hand-off transition. */
export const flareParams: ControlDef[] = [
  { type: 'range', path: 'params.count', label: 'Cards', min: 2, max: 30, step: 1, def: 8 },
  { type: 'range', path: 'params.width', label: 'Card width', min: 0.4, max: 1, step: 0.005, def: 0.9, format: 'multiplier' },
  { type: 'range', path: 'params.speed', label: 'Speed', min: 0.25, max: 2.5, step: 0.01, def: 1, format: 'multiplier' },
  {
    type: 'segment',
    path: 'params.fdir',
    label: 'Direction',
    def: '1',
    options: [
      { value: '1', label: 'Left → right' },
      { value: '-1', label: 'Right → left' },
    ],
  },
  { type: 'header', label: 'Timing' },
  { type: 'range', path: 'params.hold', label: 'Still hold', min: 0, max: 4, step: 0.01, def: 0.27, format: 'seconds' },
  { type: 'range', path: 'params.antic', label: 'Wind-up', min: 0, max: 1, step: 0.01, def: 0.3, format: 'seconds' },
  { type: 'range', path: 'params.sweep', label: 'Sweep', min: 0.2, max: 2, step: 0.01, def: 0.633, format: 'seconds' },
  { type: 'range', path: 'params.settle', label: 'Settle', min: 0, max: 1.2, step: 0.01, def: 0.3, format: 'seconds' },
  {
    type: 'select',
    path: 'params.curve',
    label: 'Sweep curve',
    def: 'reference',
    options: [
      { value: 'reference', label: 'Reference (traced)' },
      { value: 'sine', label: 'Gentle' },
      { value: 'cubic', label: 'Smooth' },
      { value: 'quint', label: 'Snappy' },
      { value: 'expo', label: 'Expo' },
      { value: 'linear', label: 'Linear' },
    ],
  },
  { type: 'header', label: 'Flaring edge' },
  { type: 'range', path: 'params.peak', label: 'Peak height', min: 0, max: 1.2, step: 0.01, def: 0.55, format: 'percent' },
  { type: 'range', path: 'params.edge', label: 'Edge height', min: 0, max: 1, step: 0.01, def: 0.28, format: 'percent' },
  { type: 'range', path: 'params.spread', label: 'Flare width', min: 0.01, max: 0.3, step: 0.005, def: 0.095, format: 'percent' },
  { type: 'range', path: 'params.handoff', label: 'Hand-off', min: 0.02, max: 0.3, step: 0.01, def: 0.16, format: 'percent' },
  { type: 'range', path: 'params.pinch', label: 'Mid pinch', min: 0, max: 0.95, step: 0.01, def: 0.35, format: 'percent' },
  { type: 'range', path: 'params.rim', label: 'Glass rim', min: 0, max: 60, step: 1, def: 28, format: 'none' },
  { type: 'range', path: 'params.edgeShadow', label: 'Edge shadow', min: 0, max: 2, step: 0.05, def: 0.8, format: 'percent' },
  { type: 'header', label: 'Lens blur' },
  { type: 'range', path: 'params.fblur', label: 'Blur', min: 0, max: 96, step: 1, def: 95, format: 'none' },
  { type: 'range', path: 'params.blurSpread', label: 'Blur reach', min: 0.03, max: 0.6, step: 0.01, def: 0.13, format: 'percent' },
  { type: 'range', path: 'params.chroma', label: 'Colour split', min: 0, max: 1.5, step: 0.01, def: 0.5, format: 'percent' },
];