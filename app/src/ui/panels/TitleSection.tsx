import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';
import { setPath } from '../../state/path';
import type { ValueControl } from '../../state/controls';

const CONTROLS: ValueControl[] = [
  { type: 'text', path: 'style.title.text', label: 'Text', def: '' },
  { type: 'range', path: 'style.title.size', label: 'Size', min: .3, max: 3, step: .01, def: 1, format: 'none' },
  { type: 'range', path: 'style.title.y', label: 'Position', min: .1, max: .9, step: .005, def: .5, format: 'percent' },
  { type: 'segment', path: 'style.title.weight', label: 'Weight', def: '600',
    options: [
      { value: '400', label: 'Regular' },
      { value: '600', label: 'Semibold' },
      { value: '700', label: 'Bold' },
    ] },
  { type: 'color', path: 'style.title.color', label: 'Colour', def: '#ffffff' },
  { type: 'select', path: 'style.title.font', label: 'Font', def: 'Inter',
    options: [
      { value: 'Inter', label: 'Inter' },
      { value: 'Georgia', label: 'Georgia' },
    ] },
];

export function TitleSection() {
  const on = useProject(s => s.state.style.title.on);

  return (
    <Section
      id="t-title"
      title="Title"
      flat
      toggleOn={on}
      onToggle={next => {
        useProject.getState().set('style.title.on', next);
        useProject.getState().commit();
      }}
      onReset={() => {
        useProject.getState().mutate(s => {
          let next = s;
          for (const c of CONTROLS) next = setPath(next, c.path, c.def);
          return setPath(next, 'style.title.on', false);
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