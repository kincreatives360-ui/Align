import type { ControlSection } from '../../../state/controls';

export const cameraSection: ControlSection = {
  id: 'v-cam',
  title: 'Camera',
  subtitle: 'Perspective and movement',
  controls: [
    { type: 'range', path: 'style.camera.fov', label: 'Perspective', min: 10, max: 75, step: .5, def: 30, format: 'degrees' },
    { type: 'range', path: 'style.camera.zoom', label: 'Zoom', min: .4, max: 2.5, step: .01, def: 1, format: 'multiplier' },
    { type: 'range', path: 'style.camera.orbit', label: 'Orbit', min: -1.5, max: 1.5, step: .01, def: 0, format: 'degrees' },
    { type: 'range', path: 'style.camera.tilt', label: 'Tilt', min: -1, max: 1, step: .01, def: 0, format: 'degrees' },
    { type: 'range', path: 'style.camera.drift', label: 'Drift', min: 0, max: .6, step: .01, def: 0, format: 'percent' },
  ],
};