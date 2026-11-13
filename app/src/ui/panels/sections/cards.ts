import type { ControlSection } from '../../../state/controls';

export const cardSection: ControlSection = {
  id: 'v-cards',
  title: 'Cards',
  subtitle: 'Shape and finish',
  controls: [
    {
      type: 'select',
      path: 'style.card.aspect',
      label: 'Aspect',
      def: 'auto',
      options: [
        { value: 'auto', label: 'Template default' },
        { value: '1:1', label: '1 : 1' },
        { value: '4:5', label: '4 : 5' },
        { value: '3:4', label: '3 : 4' },
        { value: '2:3', label: '2 : 3' },
        { value: '9:16', label: '9 : 16' },
        { value: '16:9', label: '16 : 9' },
        { value: '8:5', label: '8 : 5' },
      ],
    },
    { type: 'range', path: 'style.card.radius', label: 'Corners', min: 0, max: .5, step: .005, def: .06, format: 'percent' },
    { type: 'range', path: 'style.card.border', label: 'Rim light', min: 0, max: 1, step: .01, def: 0, format: 'percent' },
    { type: 'range', path: 'style.card.brightness', label: 'Brightness', min: .3, max: 1.6, step: .01, def: 1, format: 'percent' },
    { type: 'range', path: 'style.card.opacity', label: 'Opacity', min: 0, max: 1, step: .01, def: 1, format: 'percent' },
    {
      type: 'segment',
      path: 'style.card.back',
      label: 'Back side',
      def: 'mirror',
      options: [
        { value: 'mirror', label: 'Mirrored' },
        { value: 'solid', label: 'Solid' },
      ],
    },
    { type: 'color', path: 'style.card.backColor', label: 'Back colour', def: '#1a1a1d' },
    { type: 'color', path: 'style.card.tint', label: 'Tint', def: '#ffffff' },
    { type: 'range', path: 'style.card.tintA', label: 'Tint amount', min: 0, max: 1, step: .01, def: 0, format: 'percent' },
  ],
};

export const shadowSection: ControlSection = {
  id: 'v-shadow',
  title: 'Shadow',
  subtitle: 'Drop shadow',
  togglePath: 'style.shadow.on',
  controls: [
    { type: 'range', path: 'style.shadow.alpha', label: 'Opacity', min: 0, max: 1, step: .01, def: .28, format: 'percent' },
    { type: 'range', path: 'style.shadow.soft', label: 'Softness', min: .02, max: .6, step: .01, def: .16, format: 'percent' },
    { type: 'range', path: 'style.shadow.offset', label: 'Offset', min: 0, max: .4, step: .005, def: .05, format: 'percent' },
    { type: 'color', path: 'style.shadow.color', label: 'Colour', def: '#000000' },
  ],
};

export const shadeSection: ControlSection = {
  id: 'v-shade',
  title: 'Shade',
  subtitle: 'Edge shading and glare',
  togglePath: 'style.shade.on',
  controls: [
    { type: 'range', path: 'style.shade.amount', label: 'Shading', min: 0, max: 1, step: .01, def: .3, format: 'percent' },
    { type: 'range', path: 'style.shade.glare', label: 'Glare', min: 0, max: 2, step: .01, def: 1, format: 'percent' },
    { type: 'toggle', path: 'style.shade.sweep', label: 'Glare sweep', def: false },
  ],
};

export const blurSection: ControlSection = {
  id: 'v-blur',
  title: 'Blur',
  subtitle: 'Depth of field and edge blur',
  togglePath: 'style.blur.on',
  controls: [
    { type: 'range', path: 'style.blur.depth', label: 'Depth blur', min: 0, max: 1.5, step: .01, def: .25, format: 'percent' },
    { type: 'range', path: 'style.blur.focus', label: 'Focus', min: -3, max: 3, step: .01, def: 0, format: 'none' },
    { type: 'range', path: 'style.blur.edge', label: 'Edge blur', min: 0, max: 1, step: .01, def: 0, format: 'percent' },
  ],
};