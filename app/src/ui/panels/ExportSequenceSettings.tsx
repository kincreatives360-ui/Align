import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { Row } from '../controls/Row';

const FPS = [24, 30, 60];

export function ExportSequenceSettings() {
  const fps = useProject(s => s.state.export.seqFps);

  return (
    <Section id="x-sequence" title="Image sequence" flat>
      <Row label="Frame rate">
        <select
          className="sel"
          value={fps}
          onChange={e => {
            useProject.getState().set('export.seqFps', Number(e.target.value));
            useProject.getState().commit();
          }}
        >
          {FPS.map(f => (
            <option key={f} value={f}>
              {f} fps
            </option>
          ))}
        </select>
      </Row>
      <p className="hint">
        Downloads as a ZIP of numbered PNGs — for editing in another programme.
      </p>
    </Section>
  );
}
