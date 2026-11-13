import { beforeEach, describe, expect, it } from 'vitest';
import { useProject, _history } from './store';
import { newProject } from './defaults';

/**
 * The set/commit rule is the single most important behaviour in the app:
 * a hundred updates during one drag must become exactly one undo step.
 */
describe('store — set and commit', () => {
  beforeEach(() => {
    useProject.setState({ state: newProject(), canUndo: false, canRedo: false, rev: 0 });
    _history().seed(useProject.getState().state);
    useProject.setState({ canUndo: false, canRedo: false });
  });

  it('set() changes the value without pushing an undo step', () => {
    useProject.getState().set('style.fx.grain', 0.3);
    useProject.getState().set('style.fx.grain', 0.4);

    expect(useProject.getState().state.style.fx.grain).toBe(0.4);
    expect(useProject.getState().canUndo).toBe(false);
  });

  it('commit() pushes exactly one step for a whole drag', () => {
    for (let i = 1; i <= 100; i++) {
      useProject.getState().set('style.fx.grain', i / 1000);
    }
    useProject.getState().commit();

    expect(useProject.getState().canUndo).toBe(true);
    expect(useProject.getState().canRedo).toBe(false);
  });

  it('undo restores the value from before the drag', () => {
    useProject.getState().set('style.fx.grain', 0.5);
    useProject.getState().commit();

    useProject.getState().set('style.fx.grain', 0.9);
    useProject.getState().commit();

    useProject.getState().undo();
    expect(useProject.getState().state.style.fx.grain).toBe(0.5);

    useProject.getState().redo();
    expect(useProject.getState().state.style.fx.grain).toBe(0.9);
  });

  it('redo is cleared when a new change is committed', () => {
    useProject.getState().set('style.fx.grain', 0.5);
    useProject.getState().commit();
    useProject.getState().set('style.fx.grain', 0.9);
    useProject.getState().commit();

    useProject.getState().undo();
    expect(useProject.getState().canRedo).toBe(true);

    useProject.getState().set('style.fx.vignette', 0.7);
    useProject.getState().commit();
    expect(useProject.getState().canRedo).toBe(false);
  });

  it('never stores the playhead in project state', () => {
    const snapshot = JSON.stringify(useProject.getState().state);
    expect(snapshot).not.toContain('"t":');
  });

  it('marks the canvas dirty on every change', () => {
    useProject.getState().clearDirty();
    expect(useProject.getState().dirty).toBe(false);

    useProject.getState().set('style.fx.bloom', 0.5);
    expect(useProject.getState().dirty).toBe(true);
  });

  it('restores media removed in a later step, by resolving its id', () => {
    const image = { id: 'a', kind: 'image' as const, name: 'x.png', width: 1, height: 1 };

    // The item was registered when it first entered the project.
    useProject.getState().mutate(s => ({
      ...s,
      media: { ...s.media, images: [image] },
    }));
    useProject.getState().commit();

    useProject.getState().mutate(s => ({ ...s, media: { ...s.media, images: [] } }));
    useProject.getState().commit();

    expect(useProject.getState().state.media.images).toEqual([]);

    useProject.getState().undo();
    expect(useProject.getState().state.media.images.map(m => m.id)).toEqual(['a']);
  });
});
