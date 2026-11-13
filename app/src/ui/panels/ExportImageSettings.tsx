import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { Row } from '../controls/Row';

const FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
];

/** Long-edge pixel sizes for still exports, labelled like the reference. */
const SIZES = [
  { value: 1080, label: '1080' },
  { value: 1440, label: '1440' },
  { value: 2160, label: '4K' },
  { value: 3240, label: '6K' },
  { value: 4320, label: '8K' },
];

export function ExportImageSettings() {
  const img = useProject(s => s.state.export.img);
  const scale = useProject(s => s.state.export.scale);
  const transparent = useProject(s => s.state.export.transparent);

  const set = (path: string, value: unknown) => {
    useProject.getState().set(path, value);
    useProject.getState().commit();
  };

  return (
    <Section id="x-image" title="Still image" flat>
      <Row label="Format">
        <div className="sg">
          {FORMATS.map(f => (
            <button
              key={f.value}
              type="button"
              className={img === f.value ? 'on' : ''}
              onClick={() => set('export.img', f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Size">
        <select className="sel" value={scale} onChange={e => set('export.scale', Number(e.target.value))}>
          {SIZES.map(s => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Transparency">
        <div style={{ flex: 1 }} />
        <button
          type="button"
          role="switch"
          aria-checked={transparent}
          aria-label="Transparent background"
          className={`tg${transparent ? ' on' : ''}`}
          disabled={img === 'jpeg'}
          onClick={() => set('export.transparent', !transparent)}
        />
      </Row>
      <p className="hint">JPEG cannot store transparency, so it is disabled there.</p>
    </Section>
  );
}
