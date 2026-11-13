import { FullscreenIcon } from '../icons/FullscreenIcon';

/** Fullscreen the stage element. */
export function FullscreenButton() {
  const run = () => {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.requestFullscreen();
  };

  return (
    <button className="ib" title="Fullscreen (F)" aria-label="Fullscreen" onClick={run}>
      <FullscreenIcon />
    </button>
  );
}
