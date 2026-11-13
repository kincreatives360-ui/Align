import { useProject } from '../../state/store';
import type { ProjectState } from '../../state/types';

/**
 * Read a slice of project state. Selectors are inline arrow functions, so a
 * component only re-renders when its own slice actually changes.
 */
export function useProjectState<T>(selector: (state: ProjectState) => T): T {
  return useProject(state => selector(state.state));
}

/** The store itself, for imperative reads in handlers and the render loop. */
export { useProject };
