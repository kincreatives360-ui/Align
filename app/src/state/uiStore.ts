import { create } from 'zustand';

/**
 * Everything that is *interface* state rather than *project* state.
 *
 * None of this is ever written into a project file, and none of it appears in
 * an undo snapshot.
 */
interface UiStore {
  /** Which left-hand rail button is active. */
  rail: 'motion' | 'media' | 'text' | 'project';
  /** Sub-tab inside the Motion rail section. */
  leftTab: 'templates' | 'controls';
  /** Which right-hand inspector tab is showing. */
  rightTab: 'visual' | 'export';
  /** Thirds grid over the canvas. Preview only, never exported. */
  guides: boolean;
  /** Template browser search box. */
  search: string;
  /** Category accordion open/closed, keyed by category id. */
  openCats: Record<string, boolean>;
  /** Control sections that the user has collapsed. */
  closedSections: Record<string, boolean>;

  setRail: (rail: UiStore['rail']) => void;
  setLeftTab: (tab: UiStore['leftTab']) => void;
  setRightTab: (tab: UiStore['rightTab']) => void;
  toggleGuides: () => void;
  setSearch: (q: string) => void;
  toggleCat: (id: string) => void;
  toggleSection: (id: string) => void;
}

export const useUi = create<UiStore>(set => ({
  rail: 'motion',
  leftTab: 'templates',
  rightTab: 'visual',
  guides: false,
  search: '',
  openCats: {},
  closedSections: {},

  setRail: rail => set({ rail }),
  setLeftTab: leftTab => set({ leftTab }),
  setRightTab: rightTab => set({ rightTab }),
  toggleGuides: () => set(s => ({ guides: !s.guides })),
  setSearch: search => set({ search }),
  toggleCat: id =>
    set(s => ({ openCats: { ...s.openCats, [id]: !s.openCats[id] } })),
  toggleSection: id =>
    set(s => ({ closedSections: { ...s.closedSections, [id]: !s.closedSections[id] } })),
}));

/** Sections are open unless the user has closed them. */
export const isSectionOpen = (id: string): boolean => !useUi.getState().closedSections[id];
