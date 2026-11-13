import { useProject } from '../../state/store';
import { Section } from '../controls/Section';
import { Row } from '../controls/Row';

const RESOLUTIONS = [480, 720, 1080, 1440, 2160];
const FPS = [24, 30, 60, 120];
const QUALITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];
const FORMATS = [
  { value: 'mp4', label: 'MP4' },
  { value: 'webm', label: 'WebM' },
];

export function ExportVideoSettings() {
  const res = useProject(s => s.state.export.res);
  const fps = useProject(s => s.state.export.fps);
  const quality = useProject(s => s.state.export.quality);
  const format = useProject(s => s.state.export.format);
  const duration = useProject(s => s.state.export.duration);
  const seamless = useProject(s => s.state.export.seamless);

  const set = (path: string, value: unknown) => {
    useProject.getState().set(path, value);
    useProject.getState().commit();
  };

  return (
    <Section id="x-video" title="Video" flat>
      <Row label="Format">
        <div className="sg">
          {FORMATS.map(f => (
            <button
              key={f.value}
              type="button"
              className={format === f.value ? 'on' : ''}
              onClick={() => set('export.format', f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Resolution">
        <select className="sel" value={res} onChange={e => set('export.res', Number(e.target.value))}>
          {RESOLUTIONS.map(r => (
            <option key={r} value={r}>
              {r >= 2160 ? `4K · ${r}p` : `${r}p`}
            </option>
          ))}
        </select>
      </Row>

      <Row label="Frame rate">
        <select className="sel" value={fps} onChange={e => set('export.fps', Number(e.target.value))}>
          {FPS.map(f => (
            <option key={f} value={f}>
              {f} fps
            </option>
          ))}
        </select>
      </Row>

      <Row label="Quality">
        <div className="sg">
          {QUALITIES.map(q => (
            <button
              key={q.value}
              type="button"
              className={quality === q.value ? 'on' : ''}
              onClick={() => set('export.quality', q.value)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label="Length">
        <select
          className="sel"
          value={duration}
          onChange={e => set('export.duration', Number(e.target.value))}
        >
          <option value={0}>One loop</option>
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
        </select>
      </Row>

      <Row label="Seamless">
        <div style={{ flex: 1 }} />
        <button
          type="button"
          role="switch"
          aria-checked={seamless}
          aria-label="Seamless loop"
          className={`tg${seamless ? ' on' : ''}`}
          onClick={() => set('export.seamless', !seamless)}
        />
      </Row>
      <p className="hint">Fit a whole number of loops into the length so it repeats cleanly.</p>
    </Section>
  );
}
