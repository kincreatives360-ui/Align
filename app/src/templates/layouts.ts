import type { CardPose, Env, P } from './types';
import {
  rel,
  stepU,
  stepSpeed,
  wrapFade,
  stripFill,
  laneFill,
  M,
  T,
  RX,
  RY,
  RZ,
  ab,
  sgn,
  lerp,
  num,
  str,
  TAU,
  wrap,
  tiltPt,
} from './kit';

/** Classic horizontal carousel - continuous motion. */
export function carouselLayout(i: number, _P: P, env: Env): CardPose {
  const n = env.n;
  const spread = Math.min(n, 7);
  const offset = i - (spread - 1) / 2;
  const phase = (env.p + i / Math.max(1, n)) % 1;
  const x = (offset + Math.sin(phase * Math.PI * 2) * 0.35) * (env.w + 0.12);
  return {
    x,
    y: Math.sin(phase * Math.PI * 2 + i) * 0.05,
    z: -Math.abs(offset) * 0.12,
    ry: offset * -0.18,
  };
}

/** Stepped stack - cards flip one at a time. */
export function stackShuffleLayout(i: number, P: P, env: Env): CardPose {
  const n = env.n;
  const u = stepU(env.p, n, env.hold, env.ez);
  const r = rel(i, u, n);
  const j1 = (env.rnd(i, 3) - 0.5) * num(P.scatter);
  const j2 = (env.rnd(i, 4) - 0.5) * num(P.scatter);
  
  const slot = (rr: number) => ({
    x: rr * env.w * 0.07 * num(P.spread, 1) + j1 * env.w * 0.15,
    y: rr * env.h * 0.04 * num(P.spread, 1) + j2 * env.h * 0.1,
    z: -rr * num(P.deckDepth, 0.22),
    s: 1 - rr * num(P.shrink, 0.05),
    b: 1 - rr * num(P.deckShade, 0.1),
    rz: rr * num(P.fanAngle) * 0.06 + j2 * 0.25,
    blur: rr * num(P.deckBlur) * 0.15,
  });
  
  if (r > n - 1) {
    const q = n - r;
    const s0 = slot(0);
    const s1 = slot(n - 1);
    const w = Math.sin(q * Math.PI);
    return {
      x: lerp(s0.x, s1.x, q) + w * env.w * num(P.throwX, 1.05),
      y: lerp(s0.y, s1.y, q) + w * env.h * 0.5 * num(P.throwLift),
      z: lerp(s0.z, s1.z, q),
      s: lerp(s0.s, s1.s, q),
      rz: lerp(s0.rz, s1.rz, q) + w * num(P.throwSpin, 0.12),
      b: lerp(1, s1.b, q),
      blur: lerp(s0.blur, s1.blur, q),
      zBias: q < 0.5 ? 2 : 0,
      o: lerp(1, clamp01(5.5 - (n - 1)), Math.sin(q * Math.PI)),
    };
  }
  
  return { ...slot(r), o: clamp01(5.5 - r) };
}

/** Ring layout - cards orbit in a circle. */
export function ringLayout(i: number, _P: P, env: Env): CardPose {
  const n = env.n;
  const angle = (i / n) * TAU + env.p * TAU;
  const radius = env.w * 0.8 + 0.5;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const ry = angle + Math.PI / 2;
  
  const y = Math.sin(env.p * TAU * 2 + i) * 0.1;
  
  return { x, y, z, ry, s: 1, o: 1 };
}

/** Grid layout - cards in a responsive grid. */
export function gridLayout(i: number, _P: P, env: Env): CardPose {
  const n = env.n;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  
  const spacing = 1.2;
  const x = (col - (cols - 1) / 2) * spacing * (env.w + 0.1);
  const y = (row - (rows - 1) / 2) * spacing * (env.h + 0.1) * -1;
  
  const breath = Math.sin(env.p * TAU + i * 0.5) * 0.05;
  const ry = Math.sin(env.p * TAU * 0.5 + i) * 0.1;
  
  return {
    x: x + breath,
    y: y + breath,
    z: breath * 0.5,
    ry,
    s: 1 + breath * 0.1,
    o: 1,
  };
}

/** Perspective layout - custom camera for dramatic 3D. */
export function perspectiveLayout(i: number, _P: P, env: Env): CardPose {
  const n = env.n;
  const spread = Math.min(n, 7);
  const offset = i - (spread - 1) / 2;
  const phase = (env.p + i / Math.max(1, n)) % 1;
  
  const x = offset * (env.w + 0.2);
  const y = Math.sin(phase * Math.PI * 2 + i) * 0.1;
  const z = -Math.abs(offset) * 0.3 + Math.sin(phase * Math.PI * 2) * 0.2;
  const ry = offset * -0.25;
  const rx = Math.sin(phase * Math.PI * 2) * 0.2;
  
  return { x, y, z, rx, ry, s: 1, o: 1 };
}

/** Custom camera for perspective template. */
export function perspectiveCamera(_P: P, _env: Env): { eye: [number, number, number]; target: [number, number, number] } {
  return { eye: [0, 1.5, 3], target: [0, 0, 0] };
}

/** Ring radius helper. */
export function ringR(P: P, _E: Env): number {
  return 1.2 * num(P.radius, 1);
}

/** Carousel radius follows card width, spacing, and the template's radius control. */
export function carouselR(P: P, E: Env): number {
  return Math.max(1.5, E.n * E.w * (1 + num(P.gap, 0.2)) / TAU) * num(P.radius, 1);
}

/** Glass Carousel - continuous ring with glass edges. */
export function glassCarouselLayout(i: number, P: P, E: Env): CardPose {
  const R = carouselR(P, E);
  const a = (i / E.n - E.p) * TAU;
  const c = Math.cos(a);
  
  const m = M(RY(-a), T(0, 0, -R));
  return {
    m: M(
      T(
        m[12] * (num(P.ellipse, 1) - 1),
        num(P.rimWave) * Math.sin(2 * a) + num(P.bob) * Math.sin(TAU * (2 * E.p + i * 0.37)),
        0
      ),
      m
    ),
    bend: -num(P.curve, 1) / R,
    s: 1 + num(P.pop) * Math.max(0, c) ** 4,
    b: 1 - num(P.sideShade) * (1 - c) * 0.5,
    blur: num(P.sideBlur) * (1 - c) * 0.5,
  };
}

/** Glass Carousel camera. */
export function glassCarouselCamera(P: P, E: Env): { eye: [number, number, number]; target: [number, number, number] } {
  const R = carouselR(P, E);
  return { eye: [0, num(P.camH), R * 0.12], target: [0, 0, -R] };
}

/** Orb Marquee - horizontal strip with glass. */
export function orbMarqueeLayout(i: number, P: P, E: Env): CardPose {
  const r = rel(i, E.p * E.n, E.m);
  const x = r * E.w * (1 + num(P.gap));
  const e = clamp01(ab(x) / E.vx);
  const g = Math.max(0, 1 - ab(x) / (E.w * (1 + num(P.gap)) * 1.5));
  
  return {
    x,
    y: -num(P.arc) * 0.15 * x * x + num(P.wave) * E.h * 0.5 * Math.sin(r * TAU / 4),
    z: -num(P.dish) * 0.15 * x * x,
    ry: Math.atan(0.3 * num(P.dish) * x),
    rz: Math.atan(-0.3 * num(P.arc) * x) - num(P.roll) * x / (E.h * 0.5),
    s: (1 - num(P.sizeVar) * E.rnd(i % E.n, 5)) * (1 + num(P.pop) * g * g),
    o: wrapFade(r, E.m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
  };
}

/** Fill for Orb Marquee. */
export function orbMarqueeFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap)));
}

/** CoverFlow - classic album wall. */
export function coverflowLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = rel(i, u, E.m);
  const a = Math.min(1, ab(r));
  const b2 = Math.max(0, ab(r) - 1);
  const tw = Math.sin(Math.PI * (u - Math.floor(u)));
  
  return {
    x: sgn(r) * (E.w * num(P.sideOffset, 0.66) * a + E.w * num(P.gap) * b2),
    y: num(P.hop) * tw * (1 - a) * E.h * 0.2,
    z: -a * num(P.sideDepth, 0.9) - b2 * num(P.stackDepth, 0.05),
    ry: -sgn(r) * a * num(P.angle, 0.95) + num(P.lean) * tw * 0.4,
    s: lerp(1, num(P.sideScale, 1), a),
    o: wrapFade(r, E.m),
    b: 1 - num(P.sideShade) * a,
    blur: num(P.sideBlur) * a,
  };
}

/** CoverFlow fill. */
export function coverflowFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * Math.max(0.05, num(P.gap)));
}

/** Feed - vertical glass feed. */
export function feedLayout(i: number, P: P, E: Env): CardPose {
  const r = rel(i, E.p * E.n, E.m);
  const y = -r * E.h * (1 + num(P.gap));
  const c = 0.15 * num(P.drum);
  const e = clamp01(ab(y) / E.vy);
  const g = Math.max(0, 1 - ab(y) / (E.h * (1 + num(P.gap)) * 1.5));
  
  return {
    m: M(
      RX(-num(P.lieBack)),
      T(
        num(P.snake) * E.w * 0.4 * Math.sin(r * TAU / 4),
        y,
        -c * y * y - num(P.scatterZ) * E.rnd(i % E.n, 6)
      ),
      RX(Math.atan(-2 * c * y))
    ),
    s: 1 + num(P.pop) * g * g,
    o: wrapFade(r, E.m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
  };
}

/** Feed fill. */
export function feedFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vy / Math.max(0.3, Math.cos(num(P.lieBack))), E.h * (1 + num(P.gap)));
}

/** Liquid Lens - glass sweep over a row. */
export function liquidLensLayout(i: number, P: P, E: Env): CardPose {
  const r = rel(i, E.p * E.n, E.m);
  const x = r * E.w * (1 + num(P.gap));
  const k = i % E.n;
  const e = clamp01(ab(x) / E.vx);
  const g = Math.max(0, 1 - ab(x) / (E.w * (1 + num(P.gap)) * 1.5));
  
  return {
    x,
    y: -num(P.arc) * 0.15 * x * x + num(P.wave) * E.h * 0.4 * Math.sin(r * TAU / 4),
    rz: Math.atan(-0.3 * num(P.arc) * x),
    ry: -num(P.edgeTurn) * 0.8 * Math.max(-1, Math.min(1, x / E.asp)),
    s: (1 - num(P.sizeVar) * E.rnd(k, 5)) * (1 + num(P.pop) * g * g) * (1 + num(P.breathe) * 0.12 * Math.sin(TAU * (2 * E.p + k * 0.37))),
    o: wrapFade(r, E.m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
  };
}

/** Liquid Lens fill. */
export function liquidLensFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap)));
}

/** Spiral Collection - twisting ring. */
export function spiralLayout(i: number, P: P, E: Env): CardPose {
  const R = 0.9 * num(P.radius, 1);
  const ph = E.p * TAU;
  const a = (i / E.n) * TAU + ph * Math.round(num(P.ringTurns, 1));
  
  const pitch = (i / E.n) * TAU * num(P.twist, 1.5) + ph * Math.round(num(P.curlRate, 2));
  
  const m = M(
    RX(num(P.lean, 0.32) + Math.sin(ph) * 0.12 * num(P.tumble, 1)),
    RY(Math.cos(ph) * 0.3 * num(P.tumble, 1)),
    T(R * Math.cos(a), R * num(P.ellipse, 1) * Math.sin(a), 0),
    RZ(a),
    RX(pitch)
  );
  
  return {
    m,
    bend: num(P.curve, 1.6) * 1.4,
    b: 1 - num(P.backShade) * clamp01(0.5 - m[14] / (2 * R)),
    o: 1 - num(P.edgeFade) * (1 - ab(m[10])),
  };
}

/** Cylinder - turning wall of curved panels. */
export function cylinderLayout(i: number, P: P, E: Env): CardPose {
  const R = ringR(P, E);
  const a = (i / E.n) * TAU - E.p * TAU + num(P.surge) * 0.6 * Math.sin(E.p * TAU);
  const c = Math.cos(a);
  const cam = str(P.facing) === 'cam';
  
  return {
    x: R * Math.sin(a) * num(P.ellipse, 1),
    y: num(P.rimWave) * E.h * 0.25 * Math.sin(2 * a),
    z: R * c,
    ry: cam ? 0 : a,
    bend: cam ? 0 : 1 / R,
    s: 1 + num(P.pop) * Math.max(0, c) ** 4,
    b: 1 - num(P.backShade, 0.45) + num(P.backShade, 0.45) * Math.max(0, c),
    o: 1 - num(P.backFade) * Math.max(0, -c),
  };
}

/** Cylinder camera. */
export function cylinderCamera(P: P, E: Env): { eye: [number, number, number]; target: [number, number, number] } {
  const R = ringR(P, E);
  return { eye: [0, R * num(P.tilt) * 2, R + E.D * 1.05], target: [0, 0, 0] };
}

/** Orbit - images orbit in depth. */
export function orbitLayout(i: number, P: P, E: Env): CardPose {
  const a0 = (i / E.n) * TAU + E.p * TAU;
  const a = a0 + num(P.surge) * Math.sin(a0);
  const c = Math.cos(a);
  
  return {
    x: num(P.rx, 1.9) * Math.sin(a),
    y: num(P.incline) * num(P.rz, 1.5) * 0.4 * c + num(P.bob) * 0.25 * Math.sin(3 * a),
    z: num(P.rz, 1.5) * c - 0.4,
    ry: str(P.facing) === 'out' ? a : 0,
    s: 1 + num(P.pop) * Math.max(0, c) ** 3,
    b: 1 - num(P.backShade) * (1 - c) * 0.5,
    o: 1 - num(P.backFade) * Math.max(0, -c),
  };
}

/** Orbit camera. */
export function orbitCamera(_P: P, E: Env): { eye: [number, number, number]; target: [number, number, number] } {
  return { eye: [0, 0, E.D + 0.6], target: [0, 0, 0] };
}

/** Fan - hand of cards. */
export function fanLayout(i: number, P: P, E: Env): CardPose {
  const c = (E.n - 1) / 2;
  const d = i - c;
  const e = c ? ab(d) / c : 0;
  const open = 0.5 - 0.5 * Math.cos(TAU * (Math.round(num(P.beats, 1)) * E.p - num(P.cascade) * 0.5 * i / E.n));
  const a = d * 0.24 * num(P.spread, 1) * (num(P.minOpen, 0.2) + (1 - num(P.minOpen, 0.2)) * open) + num(P.fanLean);
  const R = num(P.pivot, 1.9);
  
  return {
    x: Math.sin(a) * R,
    y: Math.cos(a) * R - R - 0.1,
    rz: -a,
    ry: d * num(P.cardTurn) * 0.15 * open,
    z: i * num(P.layering, 0.012),
    b: 1 - num(P.outerShade) * e,
    blur: num(P.outerBlur) * e,
  };
}

/** Masonry - columns drifting. */
export function masonryLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 3));
  const m = E.m;
  const mb = num(E.mb);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const odd = col % 2;
  
  const asp = [0.8, 1.25, 0.7, 1][(row % mb + col) % 4];
  const h = E.w / asp;
  
  let cum = 0, total0 = 0;
  for (let k = 0; k < mb; k++) {
    const hh = E.w / [0.8, 1.25, 0.7, 1][(k + col) % 4] * (1 + num(P.gap));
    if (k < row % mb) cum += hh;
    total0 += hh;
  }
  const total = total0 * m / mb;
  cum += Math.floor(row / mb) * total0;
  
  const dir = (odd && str(P.flow) !== 'same' ? -1 : 1) * (odd ? Math.round(num(P.oddSpeed, 1)) : 1);
  const y = wrap(cum + h / 2 + E.p * total0 * dir + col * num(P.colOffset) * E.w * 1.2, total) - total / 2;
  const x = (col - (cols - 1) / 2) * E.w * (1 + num(P.gap) * 1.5 + num(P.colSpace));
  const e = clamp01(ab(y) / E.vy);
  
  return {
    x,
    y,
    z: -num(P.barrel) * 0.25 * x * x - (odd ? num(P.colDepth) : 0),
    ry: Math.atan(0.5 * num(P.barrel) * x),
    w: E.w,
    h,
    aspect: asp,
    o: clamp01((total / 2 - ab(y)) / (h * num(P.edgeFade, 0.8))),
    blur: num(P.edgeBlur) * e * e,
    img: (row % mb) * cols + col,
  };
}

/** Masonry fill. */
export function masonryFill(P: P, E: Env): { m: number; mb: number; count: number } {
  const cols = Math.round(num(P.cols, 3));
  return laneFill(E, E.vy * (1 + num(P.colDepth) / E.D), E.w * 1.12 * (1 + num(P.gap)), cols);
}

/** Tilt Grid - endless tilted wall. */
export function tiltGridLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 6));
  const rows = E.m;
  const c = i % cols;
  const r = Math.floor(i / cols);
  const dir = str(P.flow) === 'alt' && c % 2 ? -1 : 1;
  
  const gx = E.w * (1 + num(P.gap));
  const gy = E.h * (1 + num(P.gap));
  const ur = wrap(r + E.p * num(E.mb) * dir, rows);
  
  const x = (c - (cols - 1) / 2) * gx + (r % 2) * num(P.brick) * gx * 0.5;
  const y = (ur - (rows - 1) / 2) * gy;
  const f = clamp01(0.5 + y / (E.vy * 3));
  
  const lift = num(P.centreLift) * 0.5 * Math.max(0, 1 - Math.hypot(x, y) / (gx * 2.5));
  
  return {
    m: M(RX(-num(P.tilt, 0.85)), RZ(num(P.gridTurn, 0.18)), T(x, y, lift), RX(num(P.faceCam) * num(P.tilt, 0.85))),
    o: clamp01(ur * 1.2) * clamp01((rows - ur) * 1.2 - 0.2),
    b: 1 - num(P.farShade) * f,
    blur: num(P.farBlur) * f * f,
    img: (r % num(E.mb)) * cols + c,
  };
}

/** Tilt Grid fill. */
export function tiltGridFill(P: P, E: Env): { m: number; count: number } {
  const cols = Math.round(num(P.cols, 6));
  return laneFill(E, E.vy / Math.max(0.25, Math.cos(num(P.tilt, 0.85))) + E.vx * Math.max(0.2, ab(Math.sin(num(P.gridTurn, 0.18)))), E.h * (1 + num(P.gap)), cols);
}

/** Slide Push - stepped with motion blur. */
export function slidePushLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = rel(i, u, E.m);
  const v = stepSpeed(E.p, E.n, E.hold, E.ez);
  const k = Math.min(1, ab(r));
  const tw = Math.sin(Math.PI * (u - Math.floor(u)));
  
  const L: any = {
    x: r * E.w * (1 + num(P.gap)),
    y: num(P.hop) * tw * E.h * 0.15,
    z: -num(P.sideZ) * k,
    ry: -sgn(r) * num(P.sideTurn) * k,
    rz: num(P.pushTilt) * tw * 0.15,
    s: 1 - num(P.shrink) * k,
    o: wrapFade(r, E.m),
    blur: Math.min(1, v * 0.08) * num(P.sideBlur, 0.6) + num(P.restBlur) * k,
    b: 1 - num(P.sideShade) * k,
  };
  
  if (num(P.stretch)) {
    L.w = E.w * (1 + num(P.stretch) * tw * 0.3);
    L.h = E.h * (1 - num(P.stretch) * tw * 0.08);
  }
  
  return L;
}

/** Slide Push fill. */
export function slidePushFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap, 0.08)));
}

/** Cube Turn - 4 faces. */
export function cubeTurnLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, 4, E.hold, E.ez);
  const a = (i - u) * TAU / 4;
  const vx = str(P.axis) === 'x';
  const hw = (vx ? E.h : E.w) / 2 * num(P.pivot, 1);
  const c = Math.cos(a);
  const tw = Math.sin(Math.PI * (u - Math.floor(u)));
  
  return {
    m: M(
      T(0, 0, -hw - num(P.push) * tw * 0.6),
      vx ? RY(num(P.tumble) * tw * 0.4) : RX(num(P.tumble) * tw * 0.4),
      vx ? RX(-a) : RY(a),
      T(0, 0, hw)
    ),
    o: c > -0.05 ? 1 : 0,
    b: 1 - num(P.sideShade, 0.45) + num(P.sideShade, 0.45) * Math.max(0, c),
    blur: num(P.sideBlur) * (1 - c) * 0.5,
  };
}

/** Cube Turn camera. */
export function cubeTurnCamera(P: P, E: Env): { eye: [number, number, number]; target: [number, number, number] } {
  return { eye: [0, num(P.camH, 0.55), E.D * num(P.camDist, 1.05)], target: [0, 0, 0] };
}

/** Card Flip - fold flip. */
export function cardFlipLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const k = Math.floor(u);
  const t = u - k;
  // Card INDICES, not relative offsets: `rel()` returns a distance like -0.6, which
  // never equals an integer card index, so the flip showed one card at best.
  const cur = ((k % E.n) + E.n) % E.n;
  const nxt = (((k + 1) % E.n) + E.n) % E.n;
  const sp = 1 + 2 * Math.round(num(P.extraSpins));
  
  let ang = 0, o = 0;
  if (i === cur) { ang = t * Math.PI * sp; o = t < 0.5 ? 1 : 0; }
  else if (i === nxt) { ang = t * Math.PI * sp - Math.PI; o = t >= 0.5 ? 1 : 0; }
  
  const w = Math.sin(t * Math.PI);
  
  return {
    m: M(
      T(num(P.sway) * w * E.w * 0.4, num(P.toss) * w * E.h * 0.3, w * num(P.lift, 0.45)),
      RZ(num(P.axisAngle)),
      str(P.axis) === 'x' ? RX(-ang) : RY(ang),
      RZ(-num(P.axisAngle))
    ),
    o,
    s: 1 - num(P.shrink) * w * 0.35,
    b: 1 - num(P.turnShade) * ab(Math.sin(ang)) * 0.6,
    blur: num(P.turnBlur) * w,
  };
}

/** Rise Up - next image rises. */
export function riseUpLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = wrap(i - u + 1, E.n) - 1;
  const d: any = { above: [0, 1], left: [-1, 0], right: [1, 0] }[str(P.from, 'below')] || [0, -1];
  const dx = d[0], dy = d[1];
  
  if (r > 0) {
    return {
      x: dx * r * num(P.entryDist, 2.4),
      y: dy * r * num(P.entryDist, 2.4),
      rx: -dy * r * num(P.entryTilt, 0.9),
      ry: dx * r * num(P.entryTilt, 0.9),
      z: -r * 0.4,
      s: 1 - num(P.entryShrink, 0.1) * r,
      o: r < 1 ? 1 : 0,
      blur: r * num(P.entryBlur, 0.5),
    };
  }
  
  return {
    x: dx * r * num(P.exitDrift, 0.6),
    y: dy * r * num(P.exitDrift, 0.6),
    z: r * num(P.exitDepth, 1.1),
    rx: -dy * r * num(P.exitTilt, 0.25),
    ry: dx * r * num(P.exitTilt, 0.25),
    o: clamp01(1 + r * 1.3),
    blur: -r * num(P.exitBlur, 0.6),
    b: 1 + r * num(P.exitDim, 0.3),
  };
}

/** Swap - front card swings out. */
export function swapLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const u = stepU(E.p, n, E.hold, E.ez);
  const r = wrap(i - u, n);
  
  const slot = (rr: number) => ({
    x: rr * E.w * 0.09 * num(P.spread, 1),
    y: rr * E.h * 0.035 * num(P.spread, 1),
    z: -rr * num(P.deckDepth, 0.22),
    s: 1 - rr * num(P.shrink, 0.05),
    b: 1 - rr * num(P.deckShade, 0.1),
    rz: rr * num(P.fanAngle) * 0.06,
    blur: rr * num(P.deckBlur) * 0.15,
  });
  
  if (r > n - 1) {
    const q = n - r;
    const s0 = slot(0);
    const s1 = slot(n - 1);
    const w = Math.sin(q * Math.PI);
    return {
      x: lerp(s0.x, s1.x, q) - w * E.w * num(P.swingX, 0.95),
      y: lerp(s0.y, s1.y, q) + w * E.h * 0.5 * num(P.swingLift),
      z: lerp(s0.z, s1.z, q),
      s: lerp(s0.s, s1.s, q),
      rz: lerp(s0.rz, s1.rz, q) - w * num(P.swingTurn, 0.18),
      ry: w * num(P.swingYaw),
      b: lerp(1, s1.b, q),
      blur: lerp(s0.blur, s1.blur, q),
      zBias: q < 0.5 ? 2 : 0,
    };
  }
  
  return { ...slot(r), o: r < 4.5 ? 1 : clamp01(5.5 - r) };
}

/** Zoom Blur - rush toward camera. */
export function zoomBlurLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = wrap(i - u + 1, E.n) - 1;
  
  if (r <= 0) {
    return {
      s: 1 - r * num(P.exitZoom, 0.7),
      z: -r * num(P.exitPush),
      rz: -r * num(P.exitTwist),
      o: clamp01(1 + r * num(P.exitFade, 1.4)),
      blur: clamp01(-r * num(P.exitBlur, 1.2)),
      zBias: 1,
    };
  }
  
  return {
    s: 1 - r * num(P.entryZoom, 0.3),
    rz: r * num(P.entryTwist),
    o: clamp01(1 - r * num(P.entryFade, 1.2)),
    blur: clamp01(r * num(P.entryBlur, 1)),
  };
}

/** Slider - classic stepped. */
export function sliderLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = rel(i, u, E.m);
  const k = Math.min(1, ab(r));
  const ac = Math.min(ab(r), 3);
  
  return {
    x: r * E.w * (1 + num(P.gap)) * (1 - (1 - num(P.sideScale, 0.82)) * 0.5),
    y: num(P.lift) * E.h * 0.12 * (1 - k) - num(P.slideArc) * E.h * 0.12 * ac * ac,
    z: -num(P.sideZ) * k,
    ry: -sgn(r) * num(P.sideTurn) * k,
    rz: -sgn(r) * num(P.sideRoll) * 0.15 * k + Math.atan(-num(P.slideArc) * 0.25 * Math.max(-3, Math.min(3, r))),
    s: lerp(1, num(P.sideScale, 0.82), k) * (1 + num(P.pop) * (1 - k)),
    o: wrapFade(r, E.m),
    blur: k * num(P.sideBlur, 0.25),
    b: 1 - num(P.sideShade, 0.15) * k,
  };
}

/** Slider fill. */
export function sliderFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap)) * (1 - (1 - num(P.sideScale, 0.82)) * 0.5));
}

/** Arc Wheel - rolling along rim. */
export function arcWheelLayout(i: number, P: P, E: Env): CardPose {
  const R = 3.2 * num(P.radius, 1.2);
  const step = E.w * (1 + num(P.gap)) / R;
  const r = rel(i, E.p * E.n, E.n);
  const a = r * step;
  const f = Math.min(1, ab(a) / 1.2);
  
  const y = R * Math.cos(a) - R + num(P.rimY, 0.35) + num(P.bob) * E.h * 0.12 * Math.sin(TAU * (2 * E.p + i * 0.37));
  
  return {
    m: M(RX(-num(P.tiltBack)), T(R * Math.sin(a), y, 0), RZ(-a * (1 - num(P.upright)))),
    s: 1 + num(P.crest) * Math.max(0, 1 - ab(a) / step),
    o: clamp01((num(P.visArc, 1.9) - ab(a)) * 3) * wrapFade(r, E.n),
    b: 1 - num(P.sideShade) * f,
    blur: num(P.sideBlur) * f,
  };
}

/** Sidestack - deck fanned in depth. */
export function sidestackLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const u = stepU(E.p, n, E.hold, E.ez);
  const r = rel(i, u, n);
  
  if (r > n - 1) {
    const q = n - r;
    return {
      x: -E.w * num(P.deckX, 0.5) - q * E.w * num(P.exitDist, 1.1),
      z: q * num(P.exitNear, 0.6),
      ry: -num(P.deckAngle, 0.55) - q * num(P.exitTurn, 0.4),
      o: 1 - q,
      zBias: 3,
    };
  }
  
  const o = r > n - 2 ? clamp01((n - 1 - r) * 2) : 1;
  
  return {
    x: -E.w * num(P.deckX, 0.5) + r * E.w * 0.34 * num(P.spread, 1),
    y: r * E.h * 0.1 * num(P.deckRise),
    z: -r * num(P.deckDepth, 0.45),
    ry: -num(P.deckAngle, 0.55),
    o: o * clamp01(5.5 - r),
    b: 1 - r * num(P.deckShade, 0.1),
    blur: r * num(P.deckBlur) * 0.15,
  };
}

/** Elevator - slanted columns. */
export function elevatorLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.max(1, Math.round(num(P.cols, 3)));
  const m = E.m;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const odd = col % 2;
  
  const dir = (odd && str(P.flow) !== 'same' ? -1 : 1) * (odd ? Math.round(num(P.oddSpeed, 1)) : 1);
  const r = rel(row, E.p * num(E.mb) * dir, m);
  
  const x = (col - (cols - 1) / 2) * E.w * (1 + num(P.gap) + num(P.colSpace));
  const y = (r + odd * num(P.colOffset)) * E.h * (1 + num(P.gap));
  const c = Math.cos(num(P.slant, -0.14));
  const s = Math.sin(num(P.slant, -0.14));
  const e = clamp01(ab(y) / E.vy);
  
  return {
    x: x * c - y * s,
    y: x * s + y * c,
    z: odd ? -num(P.colDepth) : 0,
    rz: num(P.slant, -0.14),
    o: wrapFade(r, m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
    img: (row % num(E.mb)) * cols + col,
  };
}

/** Elevator fill. */
export function elevatorFill(P: P, E: Env): { m: number; count: number } {
  const cols = Math.max(1, Math.round(num(P.cols, 3)));
  return laneFill(E, (E.vy + E.vx * ab(Math.sin(num(P.slant, -0.14)))) * (1 + num(P.colDepth) / E.D), E.h * (1 + num(P.gap)), cols);
}

/** Image Repeater - rows of scrolling images. */
export function imageRepeaterLayout(i: number, P: P, E: Env): CardPose {
  const rows = Math.max(1, Math.round(num(P.rows, 3)));
  const m = E.m;
  const row = i % rows;
  const col = Math.floor(i / rows);
  const odd = row % 2;
  const mid = (rows - 1) / 2;
  
  const r = rel(col, E.p * num(E.mb) * (odd && str(P.flow) !== 'same' ? -1 : 1) * (odd ? Math.round(num(P.altSpeed, 1)) : 1), m);
  
  const x = (r + odd * num(P.rowOffset)) * E.w * (1 + num(P.gap));
  const y = (row - mid) * E.h * (1 + num(P.gap) * 1.2 + num(P.rowSpace));
  const c = Math.cos(num(P.slant));
  const s = Math.sin(num(P.slant));
  const e = clamp01(ab(x) / E.vx);
  
  return {
    x: x * c - y * s,
    y: x * s + y * c,
    z: -num(P.rowDepth) * ab(row - mid),
    rz: num(P.slant),
    o: wrapFade(r, m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
    img: (col % num(E.mb)) * rows + row,
  };
}

/** Image Repeater fill. */
export function imageRepeaterFill(P: P, E: Env): { m: number; count: number } {
  const rows = Math.max(1, Math.round(num(P.rows, 3)));
  return laneFill(E, (E.vx + E.vy * ab(Math.sin(num(P.slant)))) * (1 + num(P.rowDepth) * 2 / E.D), E.w * (1 + num(P.gap)), rows);
}

/** Melt Row - one row melting into glass. */
export function meltRowLayout(i: number, P: P, E: Env): CardPose {
  const r = rel(i, E.p * E.n, E.m);
  const x = r * E.w * (1 + num(P.gap));
  const k = i % E.n;
  const e = clamp01(ab(x) / E.vx);
  const g = Math.max(0, 1 - ab(x) / (E.w * (1 + num(P.gap)) * 1.5));
  
  return {
    x,
    y: -num(P.arc) * 0.15 * x * x + num(P.wave) * E.h * 0.4 * Math.sin(r * TAU / 4) + num(P.bob) * E.h * 0.1 * Math.sin(TAU * (2 * E.p + k * 0.37)),
    z: -num(P.dish) * 0.15 * x * x,
    ry: Math.atan(0.3 * num(P.dish) * x),
    rz: Math.atan(-0.3 * num(P.arc) * x),
    s: (1 - num(P.sizeVar) * E.rnd(k, 5)) * (1 + num(P.pop) * g * g),
    o: wrapFade(r, E.m),
    b: 1 - num(P.edgeShade) * e,
    blur: num(P.edgeBlur) * e * e,
  };
}

/** Melt Row fill. */
export function meltRowFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap)));
}

/** Glass Stream - three columns streaming. */
export function glassStreamLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 3));
  const m = E.m;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const odd = col % 2;
  const centre = (cols - 1) / 2;
  const r = rel(row, E.p * E.mb * (odd && str(P.flow) !== 'same' ? -1 : 1) * (odd ? Math.round(num(P.oddSpeed, 1)) : 1), m);
  const y = (r + odd * num(P.colOffset)) * E.h * (1 + num(P.gap));
  const edge = clamp01(ab(y) / E.vy);
  const centreScale = Math.max(0, 1 - ab(y) / (E.h * (1 + num(P.gap)) * 1.5));

  return {
    x: (col - centre) * E.w * (1 + num(P.gap) + num(P.colSpace)),
    y,
    ry: centre ? -num(P.colTurn) * 0.6 * (col - centre) / centre : 0,
    s: 1 + num(P.pop) * centreScale * centreScale,
    o: wrapFade(r, m),
    b: 1 - num(P.edgeShade) * edge,
    blur: num(P.edgeBlur) * edge * edge,
    img: (row % num(E.mb)) * cols + col,
  };
}

/** Glass Stream fill. */
export function glassStreamFill(P: P, E: Env): { m: number; mb: number; count: number } {
  const cols = Math.round(num(P.cols, 3));
  return laneFill(E, E.vy, E.h * (1 + num(P.gap)), cols);
}

/** Prism Slider - cards sit on faces of a turning prism. */
export function prismSliderLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const a0 = TAU / n;
  const apo = E.w * (1 + num(P.gap)) / (2 * Math.tan(Math.PI / n)) * num(P.prismDepth, 1);
  const u = stepU(E.p, n, E.hold, E.ez);
  const r = rel(i, u, n);
  const a = r * a0;
  const k = Math.min(1, Math.abs(r));
  const tw = Math.sin(Math.PI * (u - Math.floor(u)));
  
  return {
    m: M(
      T(r * E.w * num(P.sideSpread), tw * num(P.turnLift) * E.h * 0.25, 0),
      RX(num(P.axisTilt) + tw * num(P.lean) * 0.35),
      T(0, 0, -apo),
      RY(a),
      T(0, 0, apo)
    ),
    o: Math.max(0, Math.min(1, (Math.cos(a) + num(P.reach, 0.05)) * 6)),
    s: 1 + num(P.pop) * (1 - k),
    b: 1 - num(P.sideShade) * k * 0.6,
    blur: num(P.sideBlur) * k,
  };
}

/** Portal - fly through images one after another. */
export function portalLayout(i: number, P: P, E: Env): CardPose {
  const u = stepU(E.p, E.n, E.hold, E.ez);
  const r = wrap(i - u + 1, E.n) - 1;
  const c = r * num(P.curl);
  
  const o = r < 0 
    ? Math.max(0, Math.min(1, 1 + r * num(P.exitFade, 1.6)))
    : Math.max(0, Math.min(1, 1 - (r - num(P.queue, 2.2)) / 1.2));
  
  return {
    x: r * num(P.drift) * E.w * 0.5 + Math.sin(c) * r * 0.35,
    y: (1 - Math.cos(c)) * r * 0.35,
    z: -r * num(P.depth, 1.8),
    rz: r * num(P.twist),
    ry: r < 0 ? -r * num(P.exitTurn) : 0,
    s: r < 0 ? 1 - r * num(P.exitGrow) : 1,
    o,
    blur: Math.max(0, Math.min(1, Math.abs(r) * 0.45 * num(P.depthBlur, 1))),
    b: r < 0 ? 1 : 1 - Math.min(0.5, r * 0.15) * num(P.depthDim, 1),
  };
}

/** Ring - tilted ring of curved cards. */
export function ringLayout2(i: number, P: P, E: Env): CardPose {
  const R = Math.max(0.8, E.n * E.w * (1 + (num(P.gap, 0.1))) / TAU) * num(P.radius, 1);
  const a = i / E.n * TAU + E.p * TAU * Math.round(num(P.laps, 1));
  const c = Math.cos(a);
  const face = String(P.face || 'out');
  const wob = num(P.wob) * Math.sin(a * 2) * E.h;
  
  return {
    x: R * Math.sin(a),
    z: R * c * num(P.squash, 1),
    y: wob,
    ry: face === 'cam' ? 0 : face === 'in' ? a + Math.PI : a,
    bend: face === 'cam' ? 0 : (face === 'in' ? -num(P.curl, 1) : num(P.curl, 1)) / R,
    b: 1 - num(P.dim) * (1 - c) / 2,
    o: 1 - num(P.fadeBack) * (1 - c) / 2,
    s: 1 + num(P.pop) * Math.pow(Math.max(0, c), 4),
  };
}

/** Double Ring - two rings turning against each other. */
export function doubleRingLayout(i: number, P: P, E: Env): CardPose {
  const half = Math.ceil(E.n / 2);
  const ring = i % 2;
  const k = Math.floor(i / 2);
  const R = 1.5 * num(P.radius, 1);
  const sg = ring ? -1 : 1;
  const face = String(P.face || 'out');
  
  const a = (k + ring * num(P.offs, 0)) / half * TAU + Math.round(ring ? num(P.botTurns, -1) : num(P.topTurns, 1)) * E.p * TAU;
  const c = Math.cos(a);
  const [x, y, z] = tiltPt(R * Math.sin(a), 0, R * c * num(P.squash, 1), sg * num(P.lean, 0), 0);
  
  return {
    x, z,
    y: y + sg * E.h * num(P.sep, 0.62),
    rx: sg * num(P.lean, 0),
    ry: face === 'cam' ? 0 : face === 'in' ? a + Math.PI : a,
    bend: face === 'cam' ? 0 : (face === 'in' ? -num(P.curl, 1) : num(P.curl, 1)) / R,
    b: 1 - num(P.dim) * (1 - c) / 2,
  };
}

/** Helix - spiral staircase of images. */
export function helixLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const cl = Math.round(num(P.climb, 0));
  const j = cl ? wrap(i + E.p * n * cl, n) : i;
  const f = (j - (n - 1) / 2) / Math.max(1, n - 1);
  const R = 1.25 * num(P.radius, 1) * (1 + num(P.taper, 0) * f * 1.5);
  const a = j * num(P.turns, 0.55) + E.p * TAU * Math.round(num(P.laps, 1));
  const y = (j - (n - 1) / 2) * num(P.pitch, 0.16);
  const c = Math.cos(a);
  
  return {
    x: R * Math.sin(a),
    z: R * c * num(P.squash, 1),
    y,
    ry: a,
    bend: num(P.curl, 1) / R,
    b: 1 - num(P.dim, 0.5) + num(P.dim, 0.5) * Math.max(0, c),
    o: (cl ? wrapFade(j - n / 2, n) : 1) * (1 - num(P.fadeBack) * Math.max(0, Math.min(1, -c))),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, c), 4),
  };
}

/** Sphere - images tiled over a turning globe. */
export function sphereLayout(i: number, P: P, E: Env): CardPose {
  const R = 1.35 * num(P.radius, 1) * (1 + num(P.breathe, 0) * Math.sin(E.p * TAU * 2));
  const y = 1 - 2 * (i + 0.5) / E.n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const ph = i * 2.39996 + E.p * TAU * Math.round(num(P.laps, 1)) * (num(P.counter, 0) && y < 0 ? -1 : 1);
  const [X, Y, Z] = tiltPt(Math.sin(ph) * r * R, y * R * num(P.flat, 1), Math.cos(ph) * r * R, num(P.axis, 0.25), 0);
  const cam = String(P.face || 'out') === 'cam';
  const k = Math.max(0, Math.min(1, Z / R * 0.5 + 0.6));
  
  return {
    x: X,
    y: Y,
    z: Z - 0.4,
    ry: cam ? 0 : ph,
    rx: cam ? 0 : -Math.asin(Math.max(-1, Math.min(1, y))) + num(P.axis, 0.25) * Math.cos(ph),
    b: 1 - 0.6 * num(P.dim, 1) * (1 - k),
    o: 1 - num(P.fadeBack) * (1 - k),
    s: 1 + num(P.pop) * Math.pow(k, 4),
  };
}

/** Ribbon Loop - twisted loop of cards. */
export function ribbonLoopLayout(i: number, P: P, E: Env): CardPose {
  const R = 0.62 * num(P.radius, 1);
  const th = (i / E.n + E.p * Math.round(num(P.laps, 1))) * TAU;
  const L = Math.round(num(P.lobes, 2));
  const sn = Math.sin(th);
  
  return {
    x: R * Math.cos(th) * num(P.wide, 0.95),
    y: Math.sin(th * L) * 0.32 * num(P.twist, 0.7),
    z: R * sn * num(P.deep, 0.7),
    ry: -th + Math.PI / 2,
    rz: sn * num(P.bank, 0.55) * num(P.twist, 0.7),
    rx: Math.cos(th * L) * 0.25 * num(P.twist, 0.7),
    bend: num(P.curl, 0),
    b: 1 - num(P.dim) * (1 - sn) / 2,
    s: 1 + num(P.pop) * Math.pow(Math.max(0, sn), 4),
  };
}

/** Tunnel - fly down a tunnel lined with images. */
export function tunnelLayout(i: number, P: P, E: Env): CardPose {
  const per = Math.round(num(P.per, 8));
  const rings = Math.max(1, Math.floor(E.n / per));
  const ring = Math.floor(i / per) % rings;
  const k = i % per;
  const t = wrap(ring / rings + E.p, 1);
  const a = k / per * TAU + ring * num(P.twistT, 0.4) + E.p * TAU * Math.round(num(P.roll, 0));
  const R = 1.35 * num(P.radius, 1);
  const q = 1 - t;
  const x = Math.cos(a) * R * E.asp * 0.85 * num(P.oval, 1) + num(P.snake, 0) * q * q * 3 * Math.sin(E.p * TAU);
  const y = Math.sin(a) * R;
  const z = -num(P.len, 12) + t * (num(P.len, 12) + 2.2);
  const o = Math.max(0, Math.min(1, t * 4)) * Math.max(0, Math.min(1, (1 - t) * 6)) * (1 - num(P.fog) * q);
  const b = 1 - num(P.dim) * q;
  
  if (String(P.face || 'cam') === 'wall') {
    return { m: M(T(x, y, z), RZ(a + Math.PI / 2), RX(-Math.PI / 2)), o, b };
  }
  return { x, y, z, rz: a + Math.PI / 2, o, b };
}

/** Wheel - images arranged like clock hours. */
export function wheelLayout(i: number, P: P, E: Env): CardPose {
  const R = 0.7 * num(P.radius, 1) * (1 + num(P.pulse) * Math.sin(E.p * TAU * 2));
  const a = i / E.n * TAU + E.p * TAU * Math.round(num(P.laps, 1));
  const c = Math.cos(a);
  const upright = str(P.upright, 'radial') === 'upright';

  return {
    m: M(RX(num(P.tilt, 0.35)), RY(num(P.yaw)), RZ(a), T(0, R, 0), RZ((upright ? -a : 0) + num(P.fan)), RX(num(P.lean))),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, c), 4),
    b: 1 - num(P.dim) * (1 - c) / 2,
  };
}

/** Saturn - hero with orbiting ring. */
export function saturnLayout(i: number, P: P, E: Env): CardPose {
  if (i === 0) {
    return { s: num(P.hero, 2.6), ry: Math.sin(E.p * TAU) * 0.15 * num(P.sway, 1), zBias: 0 };
  }
  const a = (i - 1) / (E.n - 1) * TAU + E.p * TAU * Math.round(num(P.laps, 1));
  const R = 1.7 * num(P.radius, 1);
  const [x, y, z] = tiltPt(Math.sin(a) * R * num(P.oval, 1), 0, Math.cos(a) * R, num(P.tilt, 0.42), 0);
  const face = String(P.face || 'cam') === 'out';
  
  return {
    x, y: y + num(P.rise, 0), z,
    ry: face ? a : 0,
    s: num(P.moon, 1),
    b: 1 - num(P.dim, 0.3) + num(P.dim, 0.3) * Math.max(0, Math.cos(a)),
  };
}

/** Elastic Scroll - row that stretches and bows. */
export function elasticLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const r0 = rel(i, stepU(E.p, n, E.hold, E.ez), E.m);
  const pd = E.p - Math.max(-3, Math.min(3, r0)) * num(P.lag, 0.0035) * num(P.elastic, 1);
  const r = rel(i, stepU(pd, n, E.hold, E.ez), E.m);
  const v = Math.max(0, Math.min(1, stepSpeed(pd, n, E.hold, E.ez) * (1 - E.hold) / 5 * num(P.elastic, 1)));
  
  return {
    x: r * E.w * (1 + num(P.gap, 0.12)),
    y: -v * num(P.dip, 0),
    z: -v * num(P.sink, 0.7),
    ry: -v * num(P.swing, 0.25),
    bend: v * num(P.bow, 2.4),
    s: 1 - v * num(P.squeeze, 0.1),
    blur: v * num(P.soft, 0),
    b: 1 - Math.min(1, v) * num(P.dim, 0),
    o: wrapFade(r, E.m),
  };
}

/** Paper Roll - columns running like paper over rollers. */
export function paperRollLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 3));
  const m = Math.ceil(E.n / cols);
  const col = i % cols;
  const row = Math.floor(i / cols);
  const dr = String(P.colDir || 'same') === 'alt' && col % 2 ? -1 : 1;
  const R = num(P.roll, 0.3);
  const L = m * E.h * (1 + num(P.gap, 0.08));
  const Y = Math.max(0.05, (L - TAU * R) / 4);
  let s = wrap(row / m + col * num(P.offR, 0) / m + E.p * Math.round(num(P.laps, 1)) * dr, 1) * L;
  let y, z, th, rl = 0;
  
  if (s < 2 * Y) { y = -Y + s; z = 0; th = 0; }
  else if ((s -= 2 * Y) < Math.PI * R) { th = s / R; y = Y + R * Math.sin(th); z = -R + R * Math.cos(th); rl = 1; }
  else if ((s -= Math.PI * R) < 2 * Y) { y = Y - s; z = -2 * R; th = Math.PI; }
  else { s -= 2 * Y; th = Math.PI + s / R; y = -Y + R * Math.sin(th); z = -R + R * Math.cos(th); rl = 1; }
  
  const c = Math.cos(th);
  return {
    x: (col - (cols - 1) / 2) * E.w * (1 + num(P.gap, 0.08) * num(P.colSp, 2.5)),
    y, z,
    rx: -th,
    bendY: rl * num(P.curl, 0) / R,
    b: 1 - num(P.dim, 0.4) + num(P.dim, 0.4) * Math.max(0, c),
    o: 1 - num(P.fadeBack) * Math.max(0, Math.min(1, -c)),
  };
}

/** Hero Strip - filmstrip of thumbnails growing into hero. */
export function heroStripLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n;
  const u = stepU(E.p, n, E.hold, E.ez);
  const k = Math.floor(u);
  const f = u - k;
  const cur = wrap(k, n);
  const nxt = wrap(k + 1, n);
  const e = i === cur ? 1 - f : i === nxt ? f : 0;
  const ts = num(P.thumb, 0.21);
  const top = String(P.stripPos || 'bottom') === 'top';
  const se = Math.sin(e * Math.PI);
  
  const tx = (i - (n - 1) / 2) * E.w * ts * (1 + num(P.gap, 0.15));
  const ty = top ? 0.96 - E.h * ts / 2 : -0.96 + E.h * ts / 2;
  
  return {
    x: lerp(tx, 0, e),
    y: lerp(ty, top ? -num(P.heroY, 0.14) : num(P.heroY, 0.14), e) + se * num(P.hop, 0),
    s: lerp(ts, num(P.heroSz, 1), e),
    z: se * num(P.arc, 0.2),
    ry: se * num(P.turn, 0),
    b: lerp(num(P.thumbB, 1), 1, e),
    zBias: i === nxt ? 6 : e * 5,
  };
}

/** Ring fill. */
export function ringFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Double Ring fill. */
export function doubleRingFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Helix fill. */
export function helixFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Sphere fill. */
export function sphereFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Ribbon Loop fill. */
export function ribbonLoopFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Tunnel fill. */
export function tunnelFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Wheel fill. */
export function wheelFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Saturn fill. */
export function saturnFill(_P: P, E: Env): { m: number; count: number } {
  return { m: 1, count: E.n };
}

/** Elastic fill. */
export function elasticFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * (1 + num(P.gap)));
}

/** Paper Roll fill. */
export function paperRollFill(P: P, E: Env): { m: number; count: number } {
  const cols = Math.round(num(P.cols, 3));
  const m = Math.ceil(E.n / cols);
  return { m, count: m * cols };
}

/** Hero Strip fill. */
export function heroStripFill(P: P, E: Env): { m: number; count: number } {
  return stripFill(E, E.vx, E.w * num(P.thumb, 0.21) * (1 + num(P.gap, 0.15)));
}

// Helper function
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}