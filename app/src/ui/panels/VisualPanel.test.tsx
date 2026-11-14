import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { newProject } from '../../state/defaults';
import { useProject } from '../../state/store';
import { VisualPanel } from './VisualPanel';

describe('VisualPanel presets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const state = newProject();
    state.style.title.text = 'My exhibition';
    state.style.labels.tl = 'Private collection';
    state.style.logo.id = 'brand-mark';
    useProject.setState({ state });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('changes appearance without replacing title, label, or logo content', () => {
    render(<VisualPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Clean' }));

    const { style } = useProject.getState().state;
    expect(style.title.text).toBe('My exhibition');
    expect(style.labels.tl).toBe('Private collection');
    expect(style.logo.id).toBe('brand-mark');
    expect(style.bg.mode).toBe('solid');
  });
});
