import { hexToRgb, D2R } from './math';
import type { FrameBackground } from '../state/types';

/** Background descriptor. */
export function bgDesc(style: any, phase: number): FrameBackground {
  const b = style.bg;
  const BG_MODES: Record<string, number> = {
    solid: 0, linear: 1, radial: 2, mesh: 3, aurora: 4,
    grid: 5, dots: 6, holo: 7, spotlight: 8, plasma: 9,
  };
  return {
    mode: BG_MODES[b.mode] ?? 0,
    c: b.c.map(hexToRgb),
    phase,
    cycles: Math.max(1, Math.round(b.cycles || 1)),
    scale: b.scale ?? 1,
    angle: (b.angle ?? 34) * D2R,
    amt: b.amt ?? 1,
    transparent: !!b.transparent,
  };
}