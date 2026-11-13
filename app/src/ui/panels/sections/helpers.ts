import type { BgMode, ProjectState } from '../../../state/types';

/**
 * Shared predicates for the look inspector's conditional controls.
 *
 * `showIf` receives the whole project, so these narrow it down to the one
 * field a group of controls actually depends on.
 */

/** True while the background is exactly this mode. */
export const bgIs =
  (mode: BgMode) =>
  (s: ProjectState): boolean =>
    s.style.bg.mode === mode;

/** True while the background is one of these modes. */
export const bgIn =
  (list: BgMode[]) =>
  (s: ProjectState): boolean =>
    list.includes(s.style.bg.mode);

/** True while the background is gradiental (linear/radial). */
export const bgIsGradiental = bgIn(['linear', 'radial']);

/** True while the background is animated (mesh/aurora/plasma). */
export const bgIsAnimated = bgIn(['mesh', 'aurora', 'plasma']);

/** True while the background uses scaled modes (radial/mesh/grid/dots/plasma). */
export const bgIsScaled = bgIn(['radial', 'mesh', 'grid', 'dots', 'plasma']);

/** Modes that show a second colour stop (c.1). */
export const bgUsesSecondColour: (s: ProjectState) => boolean = (s) => {
  switch (s.style.bg.mode) {
    case 'linear':
    case 'radial':
    case 'mesh':
    case 'aurora':
    case 'spotlight':
      return true;
    case 'plasma':
    case 'grid':
    case 'dots':
    case 'holo':
      return false;
    default:
      return false;
  }
};

/** Modes that show a third colour stop (c.2). */
export const bgUsesThirdColour: (s: ProjectState) => boolean = (s) => {
  switch (s.style.bg.mode) {
    case 'mesh':
    case 'aurora':
    case 'plasma':
    case 'grid':
    case 'dots':
      return true;
    default:
      return false;
  }
};

/** Modes that show a fourth colour stop (c.3). */
export const bgUsesFourthColour: (s: ProjectState) => boolean = (s) => {
  return s.style.bg.mode === 'mesh' || s.style.bg.mode === 'aurora';
};