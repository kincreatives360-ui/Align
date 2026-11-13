import type { Template } from '../types';
import type { StyleTree } from '../../state/types';
import type { P, Env, CardPose } from '../types';
import { TAU, ab, clamp01, rel, stripFill, wrapFade, num, str } from '../kit';
import { glassCarouselCamera, glassCarouselLayout, orbMarqueeLayout, orbMarqueeFill, coverflowLayout, coverflowFill, feedLayout, feedFill, sliderLayout, sliderFill, arcWheelLayout, sidestackLayout, elevatorLayout, elevatorFill, imageRepeaterLayout, imageRepeaterFill, meltRowLayout, meltRowFill, glassStreamLayout, glassStreamFill, elasticLayout, elasticFill, paperRollLayout, paperRollFill } from '../layouts';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';

const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({
  key, label, type: 'range', min, max, step, def, ...extra,
});
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);

const sideGlass = (width: number, refraction: number, extra: Partial<StyleTree['glass']> = {}) => ({
  glass: {
    on: true,
    mode: 'per' as const,
    top: 0,
    bottom: 0,
    left: 1,
    right: 1,
    width,
    refraction,
    curve: 'panel' as const,
    dispersion: 0.7,
    soften: 0.45,
    feather: 0,
    highlight: 0.32,
    bulge: 0.4,
    ...extra,
  },
});

const edgeGlass = (edges: { top?: number; bottom?: number; left?: number; right?: number }, width: number, refraction: number, bulge: number) => ({
  glass: {
    on: true,
    mode: 'per' as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width,
    refraction,
    curve: 'panel' as const,
    dispersion: 0.7,
    soften: 0.45,
    feather: 0,
    highlight: 0.32,
    bulge,
    ...edges,
  },
});

const sstep = (a: number, b: number, value: number) => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function pleatsFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx * 1.6 + E.w, E.w * Math.cos(num(P.fold, 0.62)) * num(P.spacing, 1));
}

function pleatsLayout(i: number, P: P, E: Env): CardPose {
  const fold = num(P.fold, 0.62);
  const breathe = num(P.breathe, 0.55);
  const th = fold * (1 - breathe * 0.5 * (1 - Math.cos(E.p * TAU * Math.round(num(P.breaths, 2)))));
  const r = rel(i, E.p * E.n, E.m);
  const s = r * E.w * Math.cos(th) * num(P.spacing, 1);
  const tc = th + num(P.ripple) * 0.45 * Math.sin(s * 1.6 - TAU * E.p * 2);
  let x = s, z = 0, a = 0;
  const curve = num(P.curve, 0.5);
  if (curve > 0.01) {
    const radius = 2.6 / curve;
    a = s / radius;
    x = radius * Math.sin(a);
    z = radius * (1 - Math.cos(a)) * 0.9;
  }
  const ex = ab(x) / E.asp;
  const odd = i % 2 !== 0;
  return {
    x,
    y: (odd ? 1 : -1) * num(P.jog) * E.h * 0.06,
    z: z - 0.25,
    ry: -a + (odd ? -tc : tc),
    b: (odd ? 1 - num(P.foldShade, 0.16) : 1) * (1 - num(P.sideDim) * sstep(0.4, 1.2, ex)),
    blur: num(P.sideBlur) * 0.7 * sstep(0.5, 1.3, ex),
    o: wrapFade(r, E.m),
  };
}

function crossfireFill(P: P, E: Env): { m: number; count: number } {
  const base = stripFill(E, Math.hypot(E.vx, E.vy) * 1.5, E.w * (1 + num(P.gap, 0.08)));
  return { m: base.m, count: (str(P.lanes, '4') === '2' ? 2 : 4) * base.m };
}

function crossfireLayout(i: number, P: P, E: Env): CardPose {
  const lane = Math.floor(i / E.m);
  const j = i % E.m;
  const dir = lane % 2 ? -1 : 1;
  const a = dir * num(P.angle, 20) * Math.PI / 180;
  const offset = lane < 2 ? 0 : (lane % 2 ? num(P.laneOff, 0.95) : -num(P.laneOff, 0.95));
  const r = rel(j, dir * E.p * E.n, E.m);
  const d = r * E.w * (1 + num(P.gap, 0.08));
  const z = -lane * num(P.depth, 0.8) * 0.5 - num(P.arc, 0.35) * d * d * 0.12;
  const pr = offset + num(P.ripple) * 0.18 * Math.sin(d * 2.2 - TAU * E.p * 2);
  const ln = lane / 3;
  return {
    x: d * Math.cos(a) - pr * Math.sin(a),
    y: d * Math.sin(a) + pr * Math.cos(a),
    z,
    rz: a,
    ry: -num(P.arc, 0.35) * d * 0.25 + num(P.lean) * dir * 0.5,
    b: 1 - num(P.laneDim) * ln,
    blur: num(P.laneBlur) * ln * 0.6,
    o: wrapFade(r, E.m),
    img: j + lane * 3,
  };
}

function silkFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx * 1.3 + E.w, E.w * (1 + num(P.gap, 0.02)));
}

function silkLayout(i: number, P: P, E: Env): CardPose {
  const r = rel(i, E.p * E.n, E.m);
  const x = r * E.w * (1 + num(P.gap, 0.02));
  const k = num(P.freq, 1.35);
  const ph = x * k - E.p * TAU * Math.round(num(P.waves, 2));
  const amplitude = num(P.amp, 0.8);
  const flutter = num(P.flutter) * Math.sin(2 * ph + 1);
  const sheen = num(P.sheen, 0.14);
  return {
    x,
    y: Math.sin(ph) * 0.3 * amplitude + flutter * 0.12,
    z: Math.cos(ph) * num(P.depthW, 0.5) * amplitude - 0.2,
    ry: Math.atan(Math.sin(ph) * k * 0.5 * amplitude),
    rx: Math.sin(ph) * num(P.roll, 0.75) + flutter * 0.35,
    bend: Math.cos(ph) * k * k * 0.5 * amplitude * num(P.curl, 0.8),
    b: 1 - sheen + sheen * Math.cos(ph),
    blur: num(P.troughBlur) * (1 - Math.cos(ph)) * 0.3,
    o: wrapFade(r, E.m),
  };
}

export const CAROUSEL_TEMPLATES: Template[] = [
  {
    id: 'glass-carousel', name: 'Glass Carousel', cat: 'carousel', n: 12, aspect: 0.8, cardH: 1.3, dur: 30, frame: '5:4', resBoost: 2, fov: 58,
    desc: 'A ring of curved cards wrapped around the camera, melting into liquid-glass edges.',
    style: sideGlass(0.3, 0.8, { bulge: 0.8, dispersion: 0.95, highlight: 0.25 }),
    params: params([
      group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('gap', 'Gap', 0, 0.8, 0.2), range('curve', 'Card curve', 0, 2, 1), range('ellipse', 'Ellipse', 0.6, 1.6, 1, 0.01, { unit: '?' }),
      range('camH', 'Camera height', -1, 1, 0), group('Motion'), off('rimWave', 'Rim wave', 0.6), off('bob', 'Bob', 0.3),
      group('Look'), off('pop', 'Front scale', 0.4), off('sideShade', 'Side shade', 1), off('sideBlur', 'Side blur', 1),
    ]),
    camera: glassCarouselCamera,
    layout: glassCarouselLayout,
  },
  {
    id: 'orb-marquee', name: 'Orb Marquee', cat: 'carousel', n: 12, aspect: 1, cardH: 0.46, dur: 16, frame: '5:4',
    desc: 'A row of round images gliding through stretching glass.',
    style: {
      card: { radius: 0.5 },
      ...sideGlass(0.1, 0.12, { stretch: 2.6, bulge: 0.1, dispersion: 0.8, soften: 0.08, highlight: 0.12, curve: 'wave' }),
    },
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.3), range('arc', 'Arc', -1, 1, 0), off('dish', 'Depth curve', 1), off('sizeVar', 'Size rhythm', 0.6),
      group('Motion'), off('wave', 'Wave', 1), off('roll', 'Roll', 1),
      group('Look'), off('pop', 'Centre scale', 0.6), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: orbMarqueeFill,
    layout: orbMarqueeLayout,
  },
  {
    id: 'coverflow', name: 'Coverflow', cat: 'carousel', n: 11, aspect: 0.8, step: true, cardH: 1.15, perCard: 1.5, frame: '16:9',
    desc: 'The classic album-wall flip, softened by glass at the sides.',
    style: sideGlass(0.22, 0.55),
    params: params([
      group('Layout'), range('angle', 'Side angle', 0, 1.4, 0.95), range('gap', 'Gap', 0, 0.8, 0.3), range('sideOffset', 'Side offset', 0.3, 1.2, 0.66), range('sideDepth', 'Side depth', 0, 2.5, 0.9),
      range('stackDepth', 'Stack depth', 0, 0.4, 0.05), range('sideScale', 'Side scale', 0.6, 1.2, 1, 0.01, { unit: '?' }),
      group('Motion'), range('lean', 'Lean in move', -1, 1, 0), off('hop', 'Hop', 1),
      group('Look'), off('sideShade', 'Side shade', 0.8), off('sideBlur', 'Side blur', 1),
    ]),
    fill: coverflowFill,
    layout: coverflowLayout,
  },
  {
    id: 'feed', name: 'Glass Feed', cat: 'carousel', n: 9, aspect: 0.8, cardH: 0.95, dur: 18, frame: '9:16',
    desc: 'A vertical feed that melts into the top and bottom of the frame.',
    style: edgeGlass({ top: 1, bottom: 1 }, 0.22, 0.7, 0.3),
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.08), off('lieBack', 'Lay back', 1.1), off('drum', 'Drum curve', 1), off('scatterZ', 'Depth scatter', 1.5),
      group('Motion'), off('snake', 'Snake', 1),
      group('Look'), off('pop', 'Centre scale', 0.4), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: feedFill,
    layout: feedLayout,
  },
  {
    id: 'slider', name: 'Slider', cat: 'carousel', n: 9, aspect: 0.8, step: true, cardH: 1.15, perCard: 1.3, frame: '16:9',
    desc: 'A classic stepped slider with smaller, softer neighbours.',
    style: sideGlass(0.16, 0.5),
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), range('sideScale', 'Side scale', 0.5, 1, 0.82), off('sideZ', 'Side depth', 1.5), range('sideTurn', 'Side rotation', -1, 1, 0), range('lift', 'Active lift', -1, 1, 0),
      group('Motion'), range('slideArc', 'Slide arc', -1, 1, 0), range('sideRoll', 'Side roll', -1, 1, 0),
      group('Look'), off('pop', 'Active scale', 0.4), range('sideBlur', 'Side blur', 0, 1, 0.25), range('sideShade', 'Side shade', 0, 0.8, 0.15),
    ]),
    fill: sliderFill,
    layout: sliderLayout,
  },
  {
    id: 'arc-wheel', name: 'Arc Wheel', cat: 'carousel', n: 14, aspect: 0.8, cardH: 0.78, dur: 22, frame: '16:9',
    desc: 'Images roll along the rim of a giant wheel.',
    params: params([
      group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1.2), range('gap', 'Gap', 0, 0.8, 0.14), range('visArc', 'Visible arc', 0.3, 1.9, 1.9), range('rimY', 'Wheel height', -1, 1.5, 0.35), range('upright', 'Stay upright', 0, 1, 0, 0.01, { percent: true }),
      off('tiltBack', 'Tilt back', 1.2),
      group('Motion'), off('bob', 'Bob', 1), off('crest', 'Crest scale', 0.5),
      group('Look'), off('sideShade', 'Side shade', 0.8), off('sideBlur', 'Side blur', 1),
    ]),
    layout: arcWheelLayout,
  },
  {
    id: 'sidestack', name: 'Sidestack', cat: 'carousel', n: 7, aspect: 0.8, step: true, cardH: 1.2, perCard: 1.4, frame: '5:4',
    desc: 'A deck fanned in depth; the front card slides away to the left.',
    params: params([
      group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('deckAngle', 'Deck angle', -1, 1.4, 0.55), range('deckDepth', 'Deck depth', 0.1, 1, 0.45), range('deckX', 'Deck offset', -0.5, 1.2, 0.5), range('deckRise', 'Deck rise', -1, 1, 0),
      group('Motion'), range('exitDist', 'Exit distance', 0.5, 2.5, 1.1), range('exitTurn', 'Exit turn', -1, 1.5, 0.4), range('exitNear', 'Exit toward camera', 0, 1.5, 0.6),
      group('Look'), range('deckShade', 'Deck shade', 0, 0.2, 0.1, 0.005), off('deckBlur', 'Deck blur', 1),
    ]),
    layout: sidestackLayout,
  },
  {
    id: 'elevator', name: 'Elevator', cat: 'carousel', n: 18, aspect: 0.8, cardH: 0.82, dur: 24, frame: '16:9',
    desc: 'Slanted columns ride up and down past each other.',
    params: params([
      group('Layout'), range('cols', 'Columns', 1, 6, 3, 1), range('gap', 'Gap', 0, 0.8, 0.1), range('slant', 'Slant', -0.6, 0.6, -0.14), off('colSpace', 'Column spacing', 1), off('colOffset', 'Column offset', 1), off('colDepth', 'Column depth', 1.5),
      group('Motion'), segment('flow', 'Flow', { alt: 'Alternate', same: 'Same way' }, 'alt'), range('oddSpeed', 'Fast columns', 1, 3, 1, 1, { unit: '?', hint: 'whole cycles per loop, so it stays seamless' }),
      group('Look'), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: elevatorFill,
    layout: elevatorLayout,
  },
  {
    id: 'repeater', name: 'Image Repeater', cat: 'carousel', n: 24, aspect: 0.8, cardH: 0.55, dur: 26, frame: '16:9',
    desc: 'Rows of images scroll in alternating directions.',
    params: params([
      group('Layout'), range('rows', 'Rows', 1, 5, 3, 1), range('gap', 'Gap', 0, 0.8, 0.12), off('rowSpace', 'Row spacing', 1), off('rowOffset', 'Row offset', 1), off('rowDepth', 'Row depth', 1.5), range('slant', 'Slant', -0.5, 0.5, 0),
      group('Motion'), segment('flow', 'Flow', { alt: 'Alternate', same: 'Same way' }, 'alt'), range('altSpeed', 'Fast rows', 1, 3, 1, 1, { unit: '?', hint: 'whole cycles per loop, so it stays seamless' }),
      group('Look'), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: imageRepeaterFill,
    layout: imageRepeaterLayout,
  },
  {
    id: 'melt-row', name: 'Melt Row', cat: 'carousel', n: 12, aspect: 0.8, cardH: 1, dur: 22, frame: '16:9',
    desc: 'One row of images melting into deep glass at both sides.',
    style: sideGlass(0.34, 1, { bulge: 0.6, dispersion: 0.9 }),
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), off('dish', 'Curve away', 1), range('arc', 'Arc', -1, 1, 0), off('sizeVar', 'Size rhythm', 0.6),
      group('Motion'), off('wave', 'Wave', 1), off('bob', 'Bob', 1),
      group('Look'), off('pop', 'Centre scale', 0.5), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: meltRowFill,
    layout: meltRowLayout,
  },
  {
    id: 'glass-stream', name: 'Glass Stream', cat: 'carousel', n: 15, aspect: 0.8, cardH: 0.62, dur: 24, frame: '9:16',
    desc: 'Three columns stream in opposite directions through glass at the top and bottom.',
    style: edgeGlass({ top: 1, bottom: 1 }, 0.2, 0.75, 0.35),
    params: params([
      group('Layout'), range('cols', 'Columns', 1, 4, 3, 1), range('gap', 'Gap', 0, 0.8, 0.08), off('colSpace', 'Column spacing', 1), off('colOffset', 'Column offset', 1), range('colTurn', 'Column turn', -1, 1, 0),
      group('Motion'), segment('flow', 'Flow', { alt: 'Alternate', same: 'Same way' }, 'alt'), range('oddSpeed', 'Fast columns', 1, 3, 1, 1, { unit: '?', hint: 'whole cycles per loop, so it stays seamless' }),
      group('Look'), off('pop', 'Centre scale', 0.4), off('edgeShade', 'Edge shade', 0.8), off('edgeBlur', 'Edge blur', 1),
    ]),
    fill: glassStreamFill,
    layout: glassStreamLayout,
  },
  {
    id: 'elastic', name: 'Elastic Scroll', cat: 'carousel', n: 10, aspect: 0.8, step: true, cardH: 0.95, perCard: 1.3, frame: '5:4',
    desc: 'A row that stretches, bows and pulls back while it scrolls, then settles flat.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.12),
      group('Motion'), range('elastic', 'Elasticity', 0, 2, 1), range('lag', 'Ripple lag', 0, 0.012, 0.0035, 0.0005), range('sink', 'Push back', 0, 2, 0.7), range('swing', 'Swing', -1, 1, 0.25), range('bow', 'Bow', 0, 5, 2.4, 0.05), range('squeeze', 'Squeeze', 0, 0.4, 0.1), range('dip', 'Dip', -0.5, 0.5, 0),
      group('Look'), off('soft', 'Motion blur', 1), off('dim', 'Motion dim', 0.6),
    ]),
    fill: elasticFill,
    layout: elasticLayout,
  },
  {
    id: 'paper-roll', name: 'Paper Roll', cat: 'carousel', n: 24, aspect: 0.8, cardH: 0.5, dur: 26, frame: '5:4',
    desc: 'Columns of photos run like paper over rollers at the top and bottom.',
    params: params([
      group('Layout'), range('cols', 'Columns', 1, 5, 3, 1), range('gap', 'Gap', 0, 0.8, 0.08), range('colSp', 'Column spread', 0, 6, 2.5, 0.05), range('roll', 'Roller', 0.1, 0.8, 0.3), off('offR', 'Column offset', 1),
      group('Motion'), range('laps', 'Laps per loop', 1, 3, 1, 1, { unit: '?' }), segment('colDir', 'Columns run', { same: 'Same way', alt: 'Alternate' }, 'same'),
      group('Look'), off('curl', 'Wrap rollers', 1, { hint: 'cards bend round the rollers' }), range('dim', 'Back shade', 0, 1, 0.4), off('fadeBack', 'Back fade', 1),
    ]),
    mods: { poseRy: -24, poseRx: 6 },
    fill: paperRollFill,
    layout: paperRollLayout,
  },
  {
    id: 'pleats', name: 'Pleated Wall', cat: 'carousel', n: 16, aspect: 0.5, cardH: 1.05, dur: 34, frame: '5:4', isNew: true,
    desc: 'A panoramic wall of tall photos folded into pleats, curving round you as it glides past and breathes open.',
    params: params([
      group('Layout'), range('fold', 'Fold', 0, 1.2, 0.62), range('curve', 'Curve', 0, 1, 0.5), range('spacing', 'Spacing', 0.7, 1.6, 1, 0.01, { unit: '?' }), off('jog', 'Height jog', 1),
      group('Motion'), range('breathe', 'Breathe', 0, 1, 0.55), whole('breaths', 'Breaths', 1, 4, 2, { unit: '?', hint: 'whole breaths per loop, so it stays seamless' }), off('ripple', 'Ripple', 1),
      group('Look'), range('foldShade', 'Fold shade', 0, 0.6, 0.16), off('sideDim', 'Edge dim', 1), off('sideBlur', 'Edge blur', 1),
    ]),
    fill: pleatsFill,
    layout: pleatsLayout,
  },
  {
    id: 'crossfire', name: 'Crossfire', cat: 'carousel', n: 12, aspect: 0.8, cardH: 0.42, dur: 30, frame: '5:4', isNew: true,
    mods: { poseRx: 10 },
    desc: 'Four lanes of photos cross in an X at different depths and stream past each other in opposite directions.',
    params: params([
      group('Layout'), segment('lanes', 'Lanes', { '2': 'Two', '4': 'Four' }, '4'), range('gap', 'Gap', 0, 0.8, 0.08), range('angle', 'Angle', 0, 45, 20, 1, { unit: '?' }), range('laneOff', 'Lane spread', 0.4, 1.6, 0.95), range('depth', 'Depth', 0, 1.5, 0.8), range('arc', 'Curve', 0, 1, 0.35),
      group('Motion'), off('ripple', 'Ripple', 1), range('lean', 'Lean', -1, 1, 0),
      group('Look'), off('laneDim', 'Back dim', 0.7), off('laneBlur', 'Back blur', 1),
    ]),
    fill: crossfireFill,
    layout: crossfireLayout,
  },
  {
    id: 'silk', name: 'Silk Ribbon', cat: 'carousel', n: 14, aspect: 0.8, cardH: 0.5, dur: 24, frame: '5:4', isNew: true,
    mods: { poseRz: -12, offY: -0.22 },
    desc: 'A ribbon of photos ripples and rolls over like silk in the wind as it streams across the frame.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.02), range('freq', 'Frequency', 0.5, 3, 1.35),
      group('Motion'), range('amp', 'Wave', 0, 1, 0.8), whole('waves', 'Waves', 1, 4, 2, { unit: '?' }), range('depthW', 'Depth', 0, 1.2, 0.5), range('roll', 'Roll', 0, 1.5, 0.75), off('flutter', 'Flutter', 1), range('curl', 'Card curl', 0, 2, 0.8),
      group('Look'), range('sheen', 'Sheen', 0, 0.5, 0.14), off('troughBlur', 'Trough blur', 1),
    ]),
    fill: silkFill,
    layout: silkLayout,
  },
];
