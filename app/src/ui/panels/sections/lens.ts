import type { ControlSection } from '../../../state/controls';

export const lensSection: ControlSection = {
  id: 'v-lens',
  title: 'Liquid lens',
  subtitle: 'One magnifying shape over the whole frame',
  togglePath: 'style.lens.on',
  controls: [
    {
      type: 'segment',
      path: 'style.lens.mode',
      label: 'Mode',
      def: 'glass',
      options: [
        { value: 'glass', label: 'Glass' },
        { value: 'hole', label: 'Cut out' },
      ],
    },
    {
      type: 'segment',
      path: 'style.lens.shape',
      label: 'Shape',
      def: 'pill',
      options: [
        { value: 'pill', label: 'Pill' },
        { value: 'circle', label: 'Circle' },
        { value: 'square', label: 'Squircle' },
      ],
    },
    { type: 'range', path: 'style.lens.x', label: 'Position X', min: 0, max: 1, step: .005, def: .5, format: 'percent' },
    { type: 'range', path: 'style.lens.y', label: 'Position Y', min: 0, max: 1, step: .005, def: .5, format: 'percent' },
    { type: 'range', path: 'style.lens.w', label: 'Width', min: .05, max: 1.6, step: .005, def: .62, format: 'percent' },
    { type: 'range', path: 'style.lens.h', label: 'Height', min: .05, max: 1, step: .005, def: .3, format: 'percent', showIf: s => s.style.lens.mode === 'glass' && s.style.lens.shape !== 'circle' },
    { type: 'range', path: 'style.lens.refraction', label: 'Refraction', min: 0, max: 1.5, step: .01, def: .55, format: 'percent' },
    { type: 'range', path: 'style.lens.frost', label: 'Frost', min: 0, max: 1, step: .01, def: 0, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
    { type: 'range', path: 'style.lens.dispersion', label: 'Dispersion', min: 0, max: 1.5, step: .01, def: .55, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
    { type: 'range', path: 'style.lens.bevel', label: 'Bevel', min: .05, max: 1, step: .01, def: .05, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
    { type: 'range', path: 'style.lens.magnify', label: 'Magnify', min: -.3, max: .4, step: .005, def: .03, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
    { type: 'range', path: 'style.lens.highlight', label: 'Highlight', min: 0, max: 1.5, step: .01, def: .85, format: 'percent' },
    { type: 'range', path: 'style.lens.shadow', label: 'Shadow', min: 0, max: 1.5, step: .01, def: .55, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
    { type: 'color', path: 'style.lens.tint', label: 'Tint', showIf: s => s.style.lens.mode === 'glass', def: '#ffffff' },
    { type: 'range', path: 'style.lens.tintA', label: 'Tint amount', min: 0, max: 1, step: .01, def: 0, format: 'percent', showIf: s => s.style.lens.mode === 'glass' },
  ],
};