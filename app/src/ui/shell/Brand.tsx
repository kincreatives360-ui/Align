/**
 * The wordmark. Both logos ship in `public/brand`; the stylesheet shows only
 * the one matching the active theme (`.lt` / `.dk`).
 */
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Align home">
      <img className="logo lt" src="/brand/logo-on-light.svg" alt="Align" />
      <img className="logo dk" src="/brand/logo-on-dark.svg" alt="" />
      <span className="beta">Beta</span>
    </a>
  );
}
