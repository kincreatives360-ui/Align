import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { ControlRenderer } from '../controls/ControlRenderer';
import { setPath } from '../../state/path';
import type { ValueControl } from '../../state/controls';

const POSITIONS = [
  { value: 'tl', label: 'Top left' },
  { value: 'tr', label: 'Top right' },
  { value: 'center', label: 'Centre' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'br', label: 'Bottom right' },
];

const CONTROLS: ValueControl[] = [
  { type: 'select', path: 'style.logo.pos', label: 'Position', def: 'br', options: POSITIONS },
  { type: 'range', path: 'style.logo.size', label: 'Size', min: .04, max: .6, step: .005, def: .14, format: 'percent' },
  { type: 'range', path: 'style.logo.opacity', label: 'Opacity', min: .1, max: 1, step: .01, def: 1, format: 'percent' },
];

export function LogoSection() {
  const on = useProject(s => s.state.style.logo.on);

  return (
    <Section
      id="t-logo"
      title="Logo"
      flat
      toggleOn={on}
      onToggle={next => {
        useProject.getState().set('style.logo.on', next);
        useProject.getState().commit();
      }}
      onReset={() => {
        useProject.getState().mutate(s => {
          let next = s;
          for (const c of CONTROLS) next = setPath(next, c.path, c.def);
          return setPath(next, 'style.logo.on', false);
        });
        useProject.getState().commit();
      }}
    >
      <p className="hint">Upload your logo from the Project panel.</p>
      {CONTROLS.map((c, i) => (
        <ControlRenderer key={i} def={c} />
      ))}
    </Section>
  );
}
