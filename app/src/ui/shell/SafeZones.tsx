import { useProjectState } from '../hooks/useProject';

/**
 * Social safe-zone shading (Reels, Story, profile grid). Never exported —
 * the percentages come from the stylesheet's `--z*` custom properties.
 */
export function SafeZones() {
  const zone = useProjectState(s => s.frame.zone);
  const show = useProjectState(s => s.frame.zoneShow);

  const cls = ['zones', show && zone ? 'on' : '', zone ? `z-${zone}` : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} id="zones" aria-hidden="true">
      <i className="zt" />
      <i className="zb" />
      <i className="zl" />
      <i className="zr" />
    </div>
  );
}
