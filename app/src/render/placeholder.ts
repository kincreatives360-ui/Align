/**
 * Placeholder face painting.
 *
 * Cards with no media yet show a numbered gradient. This is extracted from
 * faces.ts so it can be tested independently and reused by mediaSource.ts.
 */

export function paintPlaceholder(canvas: HTMLCanvasElement, index: number): void {
  const g = canvas.getContext('2d');
  if (!g) return;

  const w = canvas.width;
  const h = canvas.height;

  const hue = (index * 47 + 210) % 360;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue} 55% 54%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 26%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.font = `600 ${Math.round(Math.min(w, h) * 0.42)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(index + 1), w / 2, h / 2);
}