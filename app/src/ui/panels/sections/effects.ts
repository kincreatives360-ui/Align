import type { ControlSection } from '../../../state/controls';

export const effectsSection: ControlSection = {
  id: 'v-fx',
  title: 'Effects',
  subtitle: 'Finishing touches',
  controls: [
    { type: 'range', path: 'style.fx.grain', label: 'Grain', min: 0, max: 1, step: 0.01, def: 0, format: 'percent' },
    { type: 'range', path: 'style.fx.vignette', label: 'Vignette', min: 0, max: 1.5, step: 0.01, def: 0, format: 'percent' },
    { type: 'range', path: 'style.fx.bloom', label: 'Bloom', min: 0, max: 1.5, step: 0.01, def: 0, format: 'percent' },
    { type: 'range', path: 'style.fx.chroma', label: 'Chromatic', min: 0, max: 1.5, step: 0.01, def: 0, format: 'percent' },
    { type: 'range', path: 'style.fx.contrast', label: 'Contrast', min: .5, max: 1.6, step: 0.01, def: 1, format: 'percent' },
    { type: 'range', path: 'style.fx.saturation', label: 'Saturation', min: 0, max: 2, step: 0.01, def: 1, format: 'percent' },
    { type: 'range', path: 'style.fx.exposure', label: 'Exposure', min: .4, max: 1.8, step: 0.01, def: 1, format: 'percent' },
  ],
};
