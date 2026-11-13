import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';
import { setPath } from '../../state/path';
import type { ValueControl } from '../../state/controls';

const CONTROLS: ValueControl[] = [
  {
    type: 'segment',
    path: 'style.anim.kind',
    label: 'Style',
    def: 'rise',
    options: [
      { value: 'fade', label: 'Fade' },
      { value: 'rise', label: 'Rise' },
      { value: 'pop', label: 'Pop' },
      { value: 'type', label: 'Typewriter' },
      { value: 'slide', label: 'Slide' },
    ],
  },
  { type: 'range', path: 'style.anim.speed', label: 'Speed', min: 0.3, max: 3, step: 0.05, def: 1, format: 'multiplier' },
];

export function AnimSection() {
  const on = useProject(s => s.state.style.anim.on);

  return (
    <Section
      id="t-anim"
      title="Animation"
      subtitle="Entrance animation for text/logo"
      flat
      toggleOn={on}
      onToggle={next => {
        useProject.getState().set('style.anim.on', next);
        useProject.getState().commit();
      }}
      onReset={() => {
        useProject.getState().mutate(s => {
          let next = s;
          for (const c of CONTROLS) next = setPath(next, c.path, c.def);
          return setPath(next, 'style.anim.on', false);
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