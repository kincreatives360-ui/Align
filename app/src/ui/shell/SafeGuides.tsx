import { useUi } from '../../state/uiStore';

/**
 * The thirds grid. Purely a preview aid — it lives outside the canvas, so it
 * can never end up in an export.
 */
export function SafeGuides() {
  const on = useUi(s => s.guides);
  return <div className={`safe${on ? ' on' : ''}`} id="safe" aria-hidden="true" />;
}
