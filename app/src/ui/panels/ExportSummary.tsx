import { useProject } from '../../state/store';
import { clipInfo } from '../../engine/timing';

/** The plain-language recap above the Export button. */
export function ExportSummary() {
  const settings = useProject(s => s.state.export);
  const state = useProject(s => s.state);

  const { clip } = clipInfo(state);
  const seconds = settings.duration || clip;

  const size = `${settings.res}p`;
  const line =
    settings.kind === 'video'
      ? `${settings.format.toUpperCase()} · ${size} · ${settings.fps} fps · ${seconds.toFixed(1)}s`
      : settings.kind === 'gif'
        ? `${settings.gifWidth} px · ${settings.gifFps} fps · ${seconds.toFixed(1)}s`
        : settings.kind === 'image'
          ? `${settings.img.toUpperCase()} · ${size}`
          : `PNG · ${settings.seqFps} fps · ${seconds.toFixed(1)}s`;

  return <div className="summary">{line}</div>;
}
