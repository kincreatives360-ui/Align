import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { Row } from '../controls/Row';

export function ExportGifSettings() {
  const width = useProject(s => s.state.export.gifWidth);
  const fps = useProject(s => s.state.export.gifFps);
  const colors = useProject(s => s.state.export.gifColors);

  const set = (path: string, value: unknown) => {
    useProject.getState().set(path, value);
    useProject.getState().commit();
  };

  return (
    <Section id="x-gif" title="GIF" flat>
      <Row label="Width">
        <select className="sel" value={width} onChange={e => set('export.gifWidth', Number(e.target.value))}>
          <option value={320}>320 px</option>
          <option value={480}>480 px</option>
          <option value={640}>640 px</option>
          <option value={800}>800 px</option>
          <option value={1080}>1080 px</option>
        </select>
      </Row>

      <Row label="Frame rate">
        <select className="sel" value={fps} onChange={e => set('export.gifFps', Number(e.target.value))}>
          <option value={15}>15 fps</option>
          <option value={20}>20 fps</option>
          <option value={25}>25 fps</option>
          <option value={50}>50 fps</option>
        </select>
      </Row>

      <Row label="Colours">
        <select className="sel" value={colors} onChange={e => set('export.gifColors', Number(e.target.value))}>
          <option value={64}>64</option>
          <option value={128}>128</option>
          <option value={256}>256</option>
        </select>
      </Row>
      <p className="hint">Fewer colours makes a smaller file.</p>
    </Section>
  );
}