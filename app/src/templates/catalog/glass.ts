import type { Env, P, Template } from '../types';
import { ab, clamp01, FILL_X, FILL_Y, laneFill, num, rel, str, TAU, wrap, wrapFade } from '../kit';
import { liquidLensFill, liquidLensLayout } from '../layouts';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';

const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({
  key, label, type: 'range', min, max, step, def, ...extra,
});
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);

function lensGridFill(P: P, E: Env): Record<string, number> {
  return laneFill(E, E.vy, E.h * (1 + num(P.gap, 0.1)), Math.round(num(P.cols, 6)));
}

function lensGridLayout(i: number, P: P, E: Env) {
  const cols = Math.round(num(P.cols, 6));
  const rows = E.m;
  const c = i % cols;
  const r = Math.floor(i / cols);
  const flow = str(P.flow, 'up');
  const dir = flow === 'down' || (flow === 'alt' && c % 2) ? -1 : 1;
  const ur = wrap(r + E.p * E.mb * Math.round(num(P.laps, 1)) * dir, rows);
  const gx = E.w * (1 + num(P.gap, 0.1));
  const gy = E.h * (1 + num(P.gap, 0.1));
  const x = (c - (cols - 1) / 2) * gx + Math.sin(ur / rows * TAU * 2) * num(P.sway);
  const y = (ur - (rows - 1) / 2 + (c % 2) * num(P.colOff)) * gy;
  const d = Math.hypot(x, y);
  return {
    x,
    y,
    o: clamp01(ur * 1.5) * clamp01((rows - ur) * 1.5 - 0.3),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, 1 - d / 1.2), 2),
    b: 1 - num(P.dim) * clamp01(d / 2),
    blur: num(P.soft) * clamp01(d / 1.6 - 0.2),
    img: (r % E.mb) * cols + c,
  };
}

function magnifierLayout(i: number, P: P, E: Env) {
  const r = rel(i, E.p * E.n * Math.round(num(P.laps, 1)), E.m);
  const y = -r * E.h * (1 + num(P.gap, 0.08));
  const ay = ab(y);
  return {
    x: num(P.zig) * Math.cos(r * Math.PI) * E.w * 0.5 + Math.sin(r * 0.9 + E.p * TAU) * num(P.sway),
    y,
    z: -num(P.drum) * y * y * 0.4,
    rx: -Math.atan(0.8 * num(P.drum) * y),
    rz: num(P.lean),
    o: wrapFade(r, E.m),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, 1 - ay / (E.h * 1.2)), 2),
    b: 1 - num(P.dim) * clamp01(ay / 1.2),
    blur: num(P.soft) * clamp01(ay / 1.2 - 0.1),
  };
}

function prismFrameLayout(i: number, P: P, E: Env) {
  const r = rel(i, E.p * E.n * Math.round(num(P.laps, 1)), E.m);
  const x = r * E.w * (1 + num(P.gap, 0.12));
  const ax = ab(x);
  return {
    x,
    y: Math.sin(r * num(P.waveD, 0.9) + E.p * TAU * Math.round(num(P.waveN, 1))) * num(P.waveA, 0.12),
    z: -num(P.arc) * x * x * 0.3,
    ry: -Math.atan(0.6 * num(P.arc) * x),
    rz: -x * num(P.fan) * 0.3,
    o: wrapFade(r, E.m),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, 1 - ax / (E.w * 1.5)), 2),
    b: 1 - num(P.dim) * clamp01(ax / 2),
  };
}

const lensSliderStyle = {
  lens: {
    on: true,
    mode: 'glass' as const,
    shape: 'pill' as const,
    w: 1.05,
    h: 0.46,
    refraction: 0.55,
    dispersion: 0.6,
    bevel: 0.6,
    frost: 0,
    magnify: 0.02,
    highlight: 0.9,
    shadow: 0.45,
    motion: 'sweep' as const,
    tintA: 0.03,
  },
};

export const GLASS_TEMPLATES: Template[] = [
  {
    id: 'lens-slider', name: 'Liquid Lens', cat: 'glass', n: 14, aspect: 0.8, cardH: 0.9, dur: 20, frame: '5:4',
    desc: 'A drop of real glass gliding over a row of images.',
    style: lensSliderStyle,
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), range('arc', 'Arc', -1, 1, 0), range('edgeTurn', 'Edge turn', -1, 1, 0), off('sizeVar', 'Size rhythm', 0.6),
      group('Motion'), off('wave', 'Wave', 1), off('breathe', 'Breathe', 1),
      group('Look'), off('pop', 'Centre scale', 0.5), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: liquidLensFill,
    layout: liquidLensLayout,
  },
  {
    id: 'lens-grid', name: 'Lens Grid', cat: 'glass', n: 24, aspect: 0.8, cardH: 0.5, dur: 20, frame: '5:4',
    desc: 'A round glass lens orbits over a drifting wall of photos.',
    style: { lens: { on: true, mode: 'glass', shape: 'circle', w: 0.7, refraction: 0.6, dispersion: 0.6, bevel: 0.5, frost: 0, magnify: 0.05, highlight: 0.9, shadow: 0.45, motion: 'orbit', tintA: 0.03 } },
    params: params([
      group('Layout'), range('cols', 'Columns', 1, 8, 6, 1), range('gap', 'Gap', 0, 0.8, 0.1), off('colOff', 'Column offset', 0.5),
      group('Motion'), segment('flow', 'Flow', { up: 'Up', down: 'Down', alt: 'Alternate' }, 'up'), range('laps', 'Scroll speed', 1, 3, 1, 1, { unit: '\u00d7' }), off('sway', 'Sway', 0.4),
      group('Look'), off('pop', 'Centre pop', 0.4), off('dim', 'Edge dim', 1), off('soft', 'Edge blur', 1),
    ]),
    fill: lensGridFill,
    layout: lensGridLayout,
  },
  {
    id: 'magnifier', name: 'Magnifier', cat: 'glass', n: 9, aspect: 0.8, cardH: 0.9, dur: 20, frame: '9:16',
    desc: 'A vertical feed scrolling under a still drop of glass.',
    style: { lens: { on: true, mode: 'glass', shape: 'circle', w: 0.5, refraction: 0.7, dispersion: 0.7, bevel: 0.65, frost: 0, magnify: 0.12, highlight: 0.9, shadow: 0.5, motion: 'static', tintA: 0.03 } },
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.08), off('zig', 'Weave', 0.5, { hint: 'cards step left and right as they pass' }), range('lean', 'Lean', -0.5, 0.5, 0), off('drum', 'Drum curve', 1),
      group('Motion'), range('laps', 'Scroll speed', 1, 3, 1, 1, { unit: '\u00d7' }), off('sway', 'Sway', 0.3),
      group('Look'), off('pop', 'Centre pop', 0.5), off('dim', 'Edge dim', 1), off('soft', 'Edge blur', 1),
    ]),
    fill: FILL_Y,
    layout: magnifierLayout,
  },
  {
    id: 'prism-frame', name: 'Prism Frame', cat: 'glass', n: 12, aspect: 0.8, cardH: 0.9, dur: 24, frame: '5:4',
    desc: 'Photos glide through a frame of glass on all four sides.',
    style: { glass: { on: true, mode: 'per', top: 1, bottom: 1, left: 1, right: 1, width: 0.16, refraction: 0.9, curve: 'lens', dispersion: 1, bulge: 0.2, highlight: 0.2 } },
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.12), off('arc', 'Curve', 1), range('fan', 'Fan', -0.5, 0.5, 0),
      group('Motion'), range('laps', 'Scroll speed', 1, 3, 1, 1, { unit: '\u00d7' }), range('waveA', 'Wave height', 0, 0.5, 0.12), range('waveD', 'Wave density', 0.2, 2, 0.9), range('waveN', 'Wave cycles', 1, 3, 1, 1, { unit: '\u00d7' }),
      group('Look'), off('pop', 'Centre pop', 0.5), off('dim', 'Edge dim', 1),
    ]),
    fill: FILL_X,
    layout: prismFrameLayout,
  },
];
