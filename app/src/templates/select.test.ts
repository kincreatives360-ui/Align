import { describe, expect, it } from 'vitest';
import { BASE_STYLE, newProject } from '../state/defaults';
import type { Template } from './types';
import { applyTemplate } from './select';

const template = (style?: Template['style']): Template => ({
  id: 'test-template',
  name: 'Test template',
  cat: 'signature',
  n: 4,
  aspect: 1.5,
  frame: '16:9',
  style,
  layout: () => ({}),
});

describe('applyTemplate', () => {
  it('resets params, preserves unrelated project state, and applies style over BASE_STYLE', () => {
    const state = {
      ...newProject(),
      name: 'My project',
      params: { count: 12, gap: 0.4 },
      style: { ...newProject().style, card: { ...newProject().style.card, radius: 0.9 } },
      media: { ...newProject().media, seed: 7 },
      frame: { ...newProject().frame, aspect: '1:1' as const },
      export: { ...newProject().export, fps: 24 },
      theme: 'light' as const,
    };

    const result = applyTemplate(state, template({
      card: { radius: 0.2 },
      bg: { mode: 'mesh' },
    }));

    expect(result.templateId).toBe('test-template');
    expect(result.params).toEqual({});
    expect(result.name).toBe(state.name);
    expect(result.media).toEqual(state.media);
    expect(result.frame).toEqual(state.frame);
    expect(result.export).toEqual(state.export);
    expect(result.theme).toBe(state.theme);
    expect(result.style.card.radius).toBe(0.2);
    expect(result.style.card.tint).toBe(BASE_STYLE.card.tint);
    expect(result.style.bg.mode).toBe('mesh');
    expect(result.style.bg.c).toEqual(BASE_STYLE.bg.c);
  });

  it('preserves the current style when keepStyle is enabled', () => {
    const state = {
      ...newProject(),
      keepStyle: true,
      style: { ...newProject().style, card: { ...newProject().style.card, radius: 0.83 } },
    };

    const result = applyTemplate(state, template({ card: { radius: 0.2 } }));

    expect(result.style).toBe(state.style);
    expect(result.style.card.radius).toBe(0.83);
    expect(result.params).toEqual({});
  });
});
