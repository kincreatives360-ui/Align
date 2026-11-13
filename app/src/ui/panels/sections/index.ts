import type { ControlSection } from '../../../state/controls';
import { backgroundSection } from './background';
import { glassSection, cardGlassSection } from './glass';
import { lensSection } from './lens';
import { cardSection, shadowSection, shadeSection, blurSection } from './cards';
import { cameraSection } from './camera';
import { effectsSection } from './effects';
import { titleSection, labelsSection, logoSection, animSection } from './text';
import { flareParams } from '../../../templates/flareParams';

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
export const TEMPLATE_PARAM_SECTIONS: Record<string, { sections: ControlSection[] }> = {
  'flare-duo': {
    sections: [
      {
        id: 'p-flare',
        title: 'Flare Duo',
        controls: flareParams,
      },
    ],
  },
};
