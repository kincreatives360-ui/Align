import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';
import { setPath } from '../../state/path';
import type { ValueControl } from '../../state/controls';

const CONTROLS: ValueControl[] = [
  { type: 'text', path: 'style.labels.tl', label: 'Top left', def: '' },
  { type: 'toggle', path: 'style.labels.mark', label: 'Logo mark', def: false },
  { type: 'text', path: 'style.labels.tr', label: 'Top right', def: '' },
  { type: 'text', path: 'style.labels.bl', label: 'Bottom left', def: '' },
  { type: 'text', path: 'style.labels.br', label: 'Bottom right', def: '' },
  { type: 'range', path: 'style.labels.size', label: 'Size', min: .5, max: 2.5, step: .01, def: 1, format: 'none' },
  { type: 'segment', path: 'style.labels.color', label: 'Colour', def: 'auto',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: '#ffffff', label: 'White' },
      { value: '#111111', label: 'Black' },
    ] },
];

export function LabelsSection() {
  const on = useProject(s => s.state.style.labels.on);

  return (
    <Section
      id="t-labels"
      title="Corner labels"
      flat
      toggleOn={on}
      onToggle={next => {
        useProject.getState().set('style.labels.on', next);
        useProject.getState().commit();
      }}
      onReset={() => {
        useProject.getState().mutate(s => {
          let next = s;
          for (const c of CONTROLS) next = setPath(next, c.path, c.def);
          return setPath(next, 'style.labels.on', false);
        });
        useProject.getState().commit();
      }}
    >
      {CONTROLS.map((c, i) => (
        <ControlRenderer key={i} def={c} />
      ))}
    </Section>
  );
}