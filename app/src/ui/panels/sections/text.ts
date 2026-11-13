import type { ControlSection } from '../../../state/controls';

export const titleSection: ControlSection = {
  id: 'v-title',
  title: 'Title',
  subtitle: 'Centred text over the cards',
  togglePath: 'style.title.on',
  controls: [
    { type: 'text', path: 'style.title.text', label: 'Text', def: 'Collection', placeholder: 'Enter title' },
    { type: 'color', path: 'style.title.color', label: 'Color', def: '#ffffff' },
    { type: 'range', path: 'style.title.size', label: 'Size', min: 0.2, max: 3, step: 0.01, def: 1, format: 'multiplier' },
    {
      type: 'segment',
      path: 'style.title.weight',
      label: 'Weight',
      def: '400',
      options: [
        { value: '400', label: 'Regular' },
        { value: '600', label: 'Medium' },
        { value: '700', label: 'Bold' },
      ],
    },
    { type: 'text', path: 'style.title.font', label: 'Font', def: 'Inter', placeholder: 'Font family' },
    { type: 'range', path: 'style.title.y', label: 'Position Y', min: 0, max: 1, step: 0.01, def: 0.5, format: 'percent' },
  ],
};

export const labelsSection: ControlSection = {
  id: 'v-labels',
  title: 'Labels',
  subtitle: 'Corner labels',
  togglePath: 'style.labels.on',
  controls: [
    { type: 'text', path: 'style.labels.tl', label: 'Top left', def: 'AlignCanvas' },
    { type: 'text', path: 'style.labels.tr', label: 'Top right', def: 'Selected work' },
    { type: 'text', path: 'style.labels.bl', label: 'Bottom left', def: '2026' },
    { type: 'text', path: 'style.labels.br', label: 'Bottom right', def: 'Made with AlignCanvas' },
    { type: 'range', path: 'style.labels.size', label: 'Size', min: 0.3, max: 2, step: 0.01, def: 1, format: 'multiplier' },
    {
      type: 'segment',
      path: 'style.labels.color',
      label: 'Color',
      def: 'auto',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: '#ffffff', label: 'White' },
        { value: '#111111', label: 'Black' },
      ],
    },
    { type: 'toggle', path: 'style.labels.mark', label: 'Marker', def: true },
    { type: 'text', path: 'style.labels.font', label: 'Font', def: '', placeholder: 'Font family' },
  ],
};

export const logoSection: ControlSection = {
  id: 'v-logo',
  title: 'Logo',
  subtitle: 'Brand mark',
  togglePath: 'style.logo.on',
  controls: [
    { type: 'text', path: 'style.logo.id', label: 'Logo ID', def: '', placeholder: 'Upload a logo first' },
    {
      type: 'segment',
      path: 'style.logo.pos',
      label: 'Position',
      def: 'br',
      options: [
        { value: 'tl', label: 'Top left' },
        { value: 'tr', label: 'Top right' },
        { value: 'center', label: 'Center' },
        { value: 'bl', label: 'Bottom left' },
        { value: 'br', label: 'Bottom right' },
      ],
    },
    { type: 'range', path: 'style.logo.size', label: 'Size', min: 0.05, max: 0.5, step: 0.01, def: 0.14, format: 'percent' },
    { type: 'range', path: 'style.logo.opacity', label: 'Opacity', min: 0, max: 1, step: 0.01, def: 1, format: 'percent' },
  ],
};

export const animSection: ControlSection = {
  id: 'v-anim',
  title: 'Animation',
  subtitle: 'Entrance animation for text/logo',
  togglePath: 'style.anim.on',
  controls: [
    {
      type: 'segment',
      path: 'style.anim.kind',
      label: 'Style',
      def: 'rise',
      options: [
        { value: 'fade', label: 'Fade' },
        { value: 'rise', label: 'Rise' },
        { value: 'pop', label: 'Pop' },
        { value: 'type', label: 'Typewriter' },
        { value: 'slide', label: 'Slide' },
      ],
    },
    { type: 'range', path: 'style.anim.speed', label: 'Speed', min: 0.3, max: 3, step: 0.05, def: 1, format: 'multiplier' },
  ],
};