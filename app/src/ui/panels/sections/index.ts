import type { ControlSection } from '../../../state/controls';
import { backgroundSection } from './background';
import { glassSection, cardGlassSection } from './glass';
import { lensSection } from './lens';
import { cardSection, shadowSection, shadeSection, blurSection } from './cards';
import { cameraSection } from './camera';
import { effectsSection } from './effects';
import { titleSection, labelsSection, logoSection, animSection } from './text';
import { flareParams } from './flare';

/**
 * The whole look inspector, as data, in display order.
 *
 * Every group in `StyleTree` gets a section here. `showIf` handles the
 * conditional controls, so a section that only applies to certain background
 * modes simply omits them — no branching anywhere in the components.
 */
export const STYLE_SECTIONS: ControlSection[] = [
  backgroundSection,
  cardSection,
  shadowSection,
  shadeSection,
  blurSection,
  glassSection,
  cardGlassSection,
  lensSection,
  cameraSection,
  effectsSection,
  titleSection,
  labelsSection,
  logoSection,
  animSection,
];

/** Template-specific parameter sections. */
export const TEMPLATE_PARAM_SECTIONS: Record<string, { def: any; sections: ControlSection[] }> = {
  'flare-duo': {
    def: {
      params: {
        count: 8,
        width: 0.9,
        speed: 1,
        fdir: '1',
        hold: 0.27,
        antic: 0.3,
        sweep: 0.633,
        settle: 0.3,
        curve: 'reference',
        peak: 0.55,
        edge: 0.28,
        spread: 0.095,
        handoff: 0.16,
        pinch: 0.35,
        rim: 28,
        edgeShadow: 0.8,
        fblur: 95,
        blurSpread: 0.13,
        chroma: 0.5,
      },
    },
    sections: [
      {
        id: 'p-flare',
        title: 'Flare Duo',
        controls: flareParams,
      },
    ],
  },
};
