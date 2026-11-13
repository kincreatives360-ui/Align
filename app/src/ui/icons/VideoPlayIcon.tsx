/**
 * The tiny solid play triangle used to mark video items. It carries its own
 * viewBox and no stroke, so it does not go through `IconBase`.
 */
export function VideoPlayIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 4v16l14-8z" fill="currentColor" />
    </svg>
  );
}
