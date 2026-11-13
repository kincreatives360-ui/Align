import type { ControlSection } from '../../../state/controls';

// Per-edge glass controls, in reference order.

const perEdge = (s: { style: { glass: { mode: string } } }) => s.style.glass.mode === 'per';

export const glassSection: ControlSection = {
  id: 'v-glass',
  title: 'Glass',
  subtitle: 'Liquid-glass edge distortion',
  togglePath: 'style.glass.on',
  controls: [
    {
      type: 'segment',
      path: 'style.glass.mode',
      label: 'Edges',
      def: 'per',
      options: [
        { value: 'all', label: 'All' },
        { value: 'per', label: 'Per edge' },
      ],
    },
    { type: 'range', path: 'style.glass.amount', label: 'Amount', min: 0, max: 1, step: 0.01, def: 0.6, format: 'percent', showIf: s => !perEdge(s) },
    { type: 'range', path: 'style.glass.top', label: 'Top', min: 0, max: 1, step: 0.01, def: 0.4, zeroLabel: 'off', showIf: perEdge },
    { type: 'range', path: 'style.glass.bottom', label: 'Bottom', min: 0, max: 1, step: 0.01, def: 0.4, zeroLabel: 'off', showIf: perEdge },
    { type: 'range', path: 'style.glass.left', label: 'Left', min: 0, max: 1, step: 0.01, def: 0.4, zeroLabel: 'off', showIf: perEdge },
    { type: 'range', path: 'style.glass.right', label: 'Right', min: 0, max: 1, step: 0.01, def: 0.4, zeroLabel: 'off', showIf: perEdge },
    { type: 'range', path: 'style.glass.width', label: 'Width', min: .03, max: .6, step: .01, def: .18, format: 'percent' },
    { type: 'range', path: 'style.glass.refraction', label: 'Smear', min: 0, max: 1.5, step: .01, def: .35, format: 'percent' },
    { type: 'range', path: 'style.glass.stretch', label: 'Stretch', min: 0, max: 6, step: .05, def: 0, format: 'percent' },
    { type: 'range', path: 'style.glass.bulge', label: 'Bulge', min: 0, max: 2, step: .01, def: .5, format: 'percent' },
    {
      type: 'segment',
      path: 'style.glass.curve',
      label: 'Curve',
      def: 'panel',
      options: [
        { value: 'panel', label: 'Panel' },
        { value: 'lens', label: 'Lens' },
        { value: 'wave', label: 'Wave' },
      ],
    },
    { type: 'range', path: 'style.glass.dispersion', label: 'Dispersion', min: 0, max: 1.5, step: .01, def: .6, format: 'percent' },
    { type: 'range', path: 'style.glass.soften', label: 'Soften', min: 0, max: 1, step: .01, def: .25, format: 'percent' },
    { type: 'range', path: 'style.glass.feather', label: 'Feather', min: 0, max: 1, step: .01, def: .35, format: 'percent' },
    { type: 'range', path: 'style.glass.highlight', label: 'Haze', min: 0, max: 1, step: .01, def: .45, format: 'percent' },
  ],
};

export const cardGlassSection: ControlSection = {
  id: 'v-cglass',
  title: 'Card glass',
  subtitle: "Refraction on each card's rim",
  togglePath: 'style.cardGlass.on',
  controls: [
    { type: 'range', path: 'style.cardGlass.width', label: 'Width', min: .02, max: 1, step: .01, def: .22, format: 'percent' },
    { type: 'range', path: 'style.cardGlass.refraction', label: 'Refraction', min: 0, max: 1.5, step: .01, def: .6, format: 'percent' },
    { type: 'range', path: 'style.cardGlass.dispersion', label: 'Dispersion', min: 0, max: 1.5, step: .01, def: .5, format: 'percent' },
  ],
};
