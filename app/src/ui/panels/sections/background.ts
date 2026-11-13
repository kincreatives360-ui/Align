import type { ControlSection } from '../../../state/controls';
import {
  bgIn,
  bgIs,
  bgIsScaled,
  bgUsesFourthColour,
  bgUsesSecondColour,
  bgUsesThirdColour,
} from './helpers';

export const BG_MODE_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'linear', label: 'Linear' },
  { value: 'radial', label: 'Radial' },
  { value: 'mesh', label: 'Mesh' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'grid', label: 'Grid' },
  { value: 'dots', label: 'Dots' },
  { value: 'holo', label: 'Holo' },
  { value: 'spotlight', label: 'Spotlight' },
  { value: 'plasma', label: 'Plasma' },
];

/** Modes that show the Motion (cycles) slider. */
const MOTIONAL = bgIn(['mesh', 'aurora', 'holo', 'plasma']);
/** Modes that show the Intensity slider. */
const INTENSE = bgIn(['aurora', 'grid', 'dots', 'holo', 'spotlight']);

export const backgroundSection: ControlSection = {
  id: 'v-bg',
  title: 'Background',
  controls: [
    { type: 'select', path: 'style.bg.mode', label: 'Type', def: 'solid', options: BG_MODE_OPTIONS },
    { type: 'header', label: 'Palette' },
    { type: 'color', path: 'style.bg.c.0', label: 'Base', def: '#f4f4f4' },
    { type: 'color', path: 'style.bg.c.1', label: 'Colour 2', def: '#e6e8ee', showIf: bgUsesSecondColour },
    { type: 'color', path: 'style.bg.c.2', label: 'Colour 3', def: '#dfe4ff', showIf: bgUsesThirdColour },
    { type: 'color', path: 'style.bg.c.3', label: 'Colour 4', def: '#ffe3ee', showIf: bgUsesFourthColour },
    {
      type: 'range',
      path: 'style.bg.cycles',
      label: 'Motion',
      min: 1,
      max: 4,
      step: 1,
      def: 1,
      format: 'cycles',
      showIf: MOTIONAL,
    },
    {
      type: 'range',
      path: 'style.bg.scale',
      label: 'Scale',
      min: .3,
      max: 3,
      step: .01,
      def: 1,
      format: 'none',
      showIf: bgIsScaled,
    },
    {
      type: 'range',
      path: 'style.bg.amt',
      label: 'Intensity',
      min: 0,
      max: 2,
      step: .01,
      def: 1,
      format: 'none',
      showIf: INTENSE,
    },
    {
      type: 'range',
      path: 'style.bg.angle',
      label: 'Angle',
      min: 0,
      max: 360,
      step: 1,
      def: 34,
      format: 'degrees',
      showIf: bgIs('linear'),
    },
    { type: 'toggle', path: 'style.bg.transparent', label: 'Transparent', def: false },
  ],
};