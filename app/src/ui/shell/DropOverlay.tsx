import { useDrop } from '../../state/dropStore';

/** The full-screen veil shown while dragging files over the window. */
export function DropOverlay() {
  const depth = useDrop(s => s.depth);
  const on = depth > 0;

  return (
    <div className={`drop${on ? ' on' : ''}`} id="drop" aria-hidden={!on}>
      Drop images or videos to use them on the cards
    </div>
  );
}
