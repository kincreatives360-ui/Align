import { describe, expect, it } from 'vitest';
import { controlGroups } from './params';
import { adaptReferenceControls } from './referenceControls';
import type { Template } from './types';

describe('reference template controls', () => {
  it('adapts grouped ranges, segmented option maps, and ungrouped controls', () => {
    const controls = adaptReferenceControls([
      { group: 'Layout' },
      {
        key: 'gap',
        label: 'Gap',
        type: 'range',
        min: 0,
        max: 1.5,
        step: 0.01,
        def: 0.3,
        unit: 'rem',
        off: true,
        hint: 'Space between cards',
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'seg',
        options: { forward: 'Forward', reverse: 'Reverse' },
        def: 'reverse',
      },
      {
        key: 'orphan',
        label: 'Orphan',
        type: 'range',
        min: -2,
        max: 2,
        step: 0.5,
        def: 0,
      },
      {
        key: 'ease',
        label: 'Easing',
        type: 'select',
        options: { smooth: 'Smooth', linear: 'Linear' },
        def: 'smooth',
      },
      { key: 'counter', label: 'Counter', type: 'toggle', def: false },
    ]);

    expect(controls).toEqual([
      { type: 'header', label: 'Layout' },
      {
        type: 'range',
        path: 'params.gap',
        label: 'Gap',
        min: 0,
        max: 1.5,
        step: 0.01,
        def: 0.3,
        unit: 'rem',
        zeroLabel: 'off',
        hint: 'Space between cards',
      },
      {
        type: 'segment',
        path: 'params.direction',
        label: 'Direction',
        options: [
          { value: 'forward', label: 'Forward' },
          { value: 'reverse', label: 'Reverse' },
        ],
        def: 'reverse',
      },
      {
        type: 'range',
        path: 'params.orphan',
        label: 'Orphan',
        min: -2,
        max: 2,
        step: 0.5,
        def: 0,
      },
      {
        type: 'select',
        path: 'params.ease',
        label: 'Easing',
        options: [
          { value: 'smooth', label: 'Smooth' },
          { value: 'linear', label: 'Linear' },
        ],
        def: 'smooth',
      },
      { type: 'toggle', path: 'params.counter', label: 'Counter', def: false },
    ]);
  });

  it('keeps explicit source group order and the existing auto-groups for app controls', () => {
    const template = {
      id: 'reference',
      name: 'Reference',
      cat: 'choreo',
      n: 4,
      aspect: 1,
      frame: '1:1',
      params: adaptReferenceControls([
        { group: 'Motion' },
        { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 1, step: 0.1, def: 0 },
        { group: 'Layout' },
        { key: 'speed', label: 'Flow', type: 'seg', options: { slow: 'Slow' }, def: 'slow' },
      ]),
      layout: () => ({}),
    } as Template;

    expect(controlGroups(template).map(group => [group.title, group.controls.map(c => c.label)])).toEqual([
      ['Motion', ['Speed', 'Cards']],
      ['Motion', ['Gap']],
      ['Layout', ['Flow']],
    ]);

    const appTemplate = {
      ...template,
      params: [
        { type: 'range', path: 'params.gap', label: 'Gap', min: 0, max: 1, step: 0.1, def: 0 },
        { type: 'range', path: 'params.bend', label: 'Bend', min: 0, max: 1, step: 0.1, def: 0 },
      ],
    } as Template;

    expect(controlGroups(appTemplate).map(group => group.title)).toEqual([
      'Motion',
      'Layout',
      'Bend',
    ]);
  });
});
