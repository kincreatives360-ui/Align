import { useProject } from '../../state/store';
import { BASE_STYLE } from '../../state/defaults';
import { toast } from '../../state/toastStore';
import { SparkleIcon } from '../icons/SparkleIcon';
import type { BgMode, ProjectState } from '../../state/types';

const BG_MODES: BgMode[] = [
  'linear',
  'radial',
  'mesh',
  'aurora',
  'grid',
  'dots',
  'holo',
  'spotlight',
  'plasma',
];

const PALETTES: string[][] = [
  ['#0b0b0d', '#1b1035', '#3b1d5e'],
  ['#041018', '#0b3a4a', '#12808f'],
  ['#16060a', '#4a1220', '#a03040'],
  ['#0d0d12', '#2a2a3a', '#5a5a7a'],
  ['#001a12', '#0b4a34', '#16a86a'],
  ['#1a0f00', '#5a3200', '#c98a1e'],
];

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

/**
 * "Surprise me" — a randomised look. Template shuffling joins this once the
 * catalogue exists; for now it varies the background and the finishing pass.
 */
export function SurpriseButton() {
  const shuffle = () => {
    useProject.getState().mutate((s): ProjectState => {
      const palette = pick(PALETTES);
      return {
        ...s,
        style: {
          ...s.style,
          bg: {
            ...s.style.bg,
            mode: pick(BG_MODES),
            c: [...palette, '#ffffff'],
            cycles: 1 + Math.floor(Math.random() * 3),
            scale: 0.7 + Math.random() * 1.2,
            transparent: false,
          },
          fx: {
            ...s.style.fx,
            grain: BASE_STYLE.fx.grain + Math.random() * 0.08,
            vignette: 0.15 + Math.random() * 0.3,
            bloom: Math.random() * 0.35,
            chroma: Math.random() * 0.25,
            saturation: 1 + Math.random() * 0.2,
          },
          camera: {
            ...s.style.camera,
            orbit: (Math.random() - 0.5) * 12,
            tilt: (Math.random() - 0.5) * 8,
          },
        },
      };
    });
    useProject.getState().commit();
    toast('New look');
  };

  return (
    <button
      className="ib surprise"
      id="surprise"
      title="Surprise me (R)"
      aria-label="Surprise me"
      onClick={shuffle}
    >
      <SparkleIcon />
    </button>
  );
}
