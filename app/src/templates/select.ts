import { BASE_STYLE } from '../state/defaults';
import type { ProjectState, StyleTree } from '../state/types';
import type { DeepPartial, Template } from './types';

function styleWithDefaults(style?: DeepPartial<StyleTree>): StyleTree {
  const result = structuredClone(BASE_STYLE);
  if (!style) return result;

  for (const [group, values] of Object.entries(style)) {
    if (!values || typeof values !== 'object' || !(group in result)) continue;
    Object.assign(result[group as keyof StyleTree], values);
  }

  return result;
}

/** Select a template while preserving project content and resetting its controls. */
export function applyTemplate(state: ProjectState, template: Template): ProjectState {
  return {
    ...state,
    templateId: template.id,
    params: {},
    style: state.keepStyle ? state.style : styleWithDefaults(template.style),
  };
}
