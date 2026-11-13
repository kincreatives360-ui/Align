// Choreography, batch C (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p. The photos are the only objects: orbits,
// cubes, wheels and spiral arms are implied by how the cards move and where they sit.
import { TAU, clamp01, sstep, wrap, ease, lerp } from './math.js';
import { ab, M, T, RX, RY, RZ, S, frame3, stepU } from './kit.js';

const PI = Math.PI;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};
// quintic smootherstep: zero velocity and zero acceleration at both ends, for long silky eases
const sm5 = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const clampAbs = (v, m) => Math.max(-m, Math.min(m, v));
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// curvature vector of a sampled path (points a step h apart): where the path is turning, scaled by 1/radius
function curvature(p0, p1, p2, h){
  const v = [(p2[0] - p0[0]) / (2 * h), (p2[1] - p0[1]) / (2 * h), (p2[2] - p0[2]) / (2 * h)];
  const a = [(p2[0] - 2 * p1[0] + p0[0]) / (h * h), (p2[1] - 2 * p1[1] + p0[1]) / (h * h), (p2[2] - 2 * p1[2] + p0[2]) / (h * h)];
  const vv = dot(v, v) || 1e-9, t = norm(v), at = dot(a, t);
  return {t, k: [(a[0] - at * t[0]) / vv, (a[1] - at * t[1]) / vv, (a[2] - at * t[2]) / vv]};
}
// camera raised by `tilt` radians and swung round by `yaw`, looking at the target
const orbitCam = (E, tilt, yaw = 0, dist = 1, ty = 0) => ({eye: [Math.sin(yaw) * Math.cos(tilt) * E.D * dist, ty + Math.sin(tilt) * E.D * dist, Math.cos(yaw) * Math.cos(tilt) * E.D * dist], target: [0, ty, 0]});

/* ---------- Roulette spin profile ---------- */
// share of a spin covered by time q: velocity q^1.2 (1-q)^2.6 — a quick, soft start and a long, long glide to rest,
// with zero speed at both ends so spins never start or stop with a jolt
const SPIN = (() => { const N = 1024, c = [0]; let s = 0;
  for (let k = 1; k <= N; k++){ const q = (k - .5) / N; s += Math.pow(q, 1.2) * Math.pow(1 - q, 2.6); c.push(s); }
  return c.map(v => v / s); })();
const spinShare = q => { const x = clamp01(q) * 1024, k = Math.min(1023, Math.floor(x)); return lerp(SPIN[k], SPIN[k + 1], x - k); };

export const CHOREO_C = [
  // Atom: a centre photo with photos racing round tilted orbits. Orbit cards are curved strips that wrap along their
  // orbit (bent to its curvature, turned partly along it), so each orbit reads as a ring of curved screens. The whole
  // atom precesses and the camera drifts, so the rings keep crossing in depth.
  {...NEW, id: 'atom', name: 'Atom', n: 12, aspect: 1.5, cardH: .13, dur: 16, fov: 30,
    desc: 'Photos race along tilted orbits that cross around a glowing centre card.',
    params: [G('Layout'), whole('orbits', 'Orbits', 2, 4, 3), whole('perOrbit', 'Cards per orbit', 6, 24, 13), range('radius', 'Radius', .5, 1.2, .84),
      range('orbitTilt', 'Orbit tilt', .3, 1.5, 1.18), range('heroSize', 'Centre size', 1, 7, 4.2, .01, {unit: '×'}),
      G('Motion'), whole('laps', 'Laps', 1, 3, 1, {unit: '×'}), range('surge', 'Surge', 0, 1, .35, .01, {hint: 'cards ease through the turns and race across the front'}),
      whole('precess', 'Precess', 0, 2, 1, {unit: ' turns'}), seg('orbitDir', 'Direction', {same: 'Same', alt: 'Alternate'}, 'alt'), range('heroBreath', 'Centre breathe', 0, 1, .4),
      range('camDrift', 'Camera drift', 0, 1, .5),
      G('Look'), range('wrapAmt', 'Wrap', 0, 1, .7, .01, {hint: 'how far the cards turn along their orbit'}), range('curve', 'Curve', 0, 3, 1.8),
      range('depthScale', 'Depth scale', 0, 1, .55), range('depthShade', 'Depth shade', 0, .6, .28), off('farBlur', 'Far blur', 1)],
    fill: (P, E) => ({count: 1 + Math.round(P.orbits) * Math.round(P.perOrbit)}),
    camera: (P, E) => orbitCam(E, .1 + .1 * P.camDrift * Math.sin(TAU * E.p), .22 * P.camDrift * Math.sin(TAU * E.p + .8)),
    layout(i, P, E){
      const yaw = .22 * P.camDrift * Math.sin(TAU * E.p + .8), tilt = .1 + .1 * P.camDrift * Math.sin(TAU * E.p);
      if (i === 0) return {s: P.heroSize * (1 + .04 * P.heroBreath * Math.sin(TAU * 2 * E.p)), ry: yaw + .08 * P.heroBreath * Math.sin(TAU * E.p), rx: -tilt + .05 * P.heroBreath * Math.cos(TAU * E.p), img: 0};
      const no = Math.round(P.orbits), per = Math.round(P.perOrbit), e = i - 1, k = Math.floor(e / per), sl = e % per;
      const R = P.radius * (1 + .08 * (k - (no - 1) / 2)), beta = k * PI / no + TAU * Math.round(P.precess) * E.p + .25, dir = P.orbitDir === 'alt' && k % 2 ? -1 : 1;
      const ct = Math.cos(P.orbitTilt), st = Math.sin(P.orbitTilt), cb = Math.cos(beta), sb = Math.sin(beta);
      const at = f => { const cx = R * Math.cos(f), cy = R * Math.sin(f) * ct, cz = R * Math.sin(f) * st; return [cx * cb - cy * sb, cx * sb + cy * cb, cz]; };
      // phase along the orbit; surge slows the cards through the sides and speeds them across the front and back
      const ph = TAU * (dir * Math.round(P.laps) * E.p + sl / per + k * .5 / per), f = ph - P.surge * .45 * Math.sin(2 * ph);
      const pos = at(f), tan = norm(at(f + .01 * dir).map((v, q) => v - at(f - .01 * dir)[q])), rad = norm(pos);
      const cam = orbitCam(E, tilt, yaw).eye, toCam = norm([cam[0] - pos[0], cam[1] - pos[1], cam[2] - pos[2]]);
      // facing: the camera, turned toward the orbit's outward normal by Wrap (never so far the back could show)
      const Z = norm([toCam[0] + P.wrapAmt * rad[0], toCam[1] + P.wrapAmt * rad[1], toCam[2] + P.wrapAmt * rad[2]]);
      const zn = pos[2] / R, depth = clamp01(.5 - zn * .5), sc = 1 + P.depthScale * .5 * zn;
      return {m: M(frame3(pos[0], pos[1], pos[2], tan, Z), S(sc, sc, 1)), bend: clampAbs(P.curve * dot(Z, rad) / R / sc, 6),
        b: 1 - P.depthShade * depth, blur: P.farBlur * depth * .6, img: 1 + e % Math.max(1, E.n - 1)};
    }},

  // Tesseract: a cube of photos turns inside a larger cube; they swap sizes, passing through each other. Mid-pass both
  // cubes swell toward spheres (their faces bow outward with real curvature) and settle flat again as they part.
  {...NEW, id: 'tesseract', name: 'Tesseract', n: 12, aspect: 1, cardH: .6, dur: 16, fov: 30,
    desc: 'A cube of photos turns inside a larger cube, the two passing through each other.',
    params: [G('Layout'), range('outer', 'Outer size', .3, .8, .52), range('innerRatio', 'Inner size', .25, .65, .42, .01, {unit: '×'}), range('panel', 'Face fill', .5, 1, .86),
      range('skew', 'Cube offset', 0, 1, .55, .01, {hint: 'how differently the two cubes are tipped'}), range('camLift', 'Camera height', -.4, .8, .32),
      G('Motion'), whole('swaps', 'Swaps', 1, 2, 1, {unit: '×', hint: 'times per loop the cubes trade places and back'}), whole('turns', 'Turns', 1, 3, 1, {unit: '×'}),
      range('pause', 'Pause', 0, .7, .22), range('morph', 'Sphere morph', 0, 1, .55, .01, {hint: 'faces bow outward as the cubes pass through each other'}), range('camDrift', 'Camera drift', 0, 1, .5),
      G('Look'), range('pillow', 'Pillow', 0, .5, .04), range('ghost', 'Outer glass', 0, .8, .2, .01, {hint: 'the outer cube turns a little see-through'}), range('backFade', 'Far faces', 0, 1, .8), range('depthShade', 'Depth shade', 0, .6, .25)],
    camera: (P, E) => orbitCam(E, P.camLift + .06 * P.camDrift * Math.sin(TAU * E.p), .3 * P.camDrift * Math.sin(TAU * E.p)),
    layout(i, P, E){
      const cube = i < 6 ? 0 : 1, f = i % 6, u = stepU(E.p, 2 * Math.round(P.swaps), P.pause, t => t), lam = sm5(u - Math.floor(u)) + Math.floor(u);
      const mix = cube ? (1 - Math.cos(PI * lam)) / 2 : (1 + Math.cos(PI * lam)) / 2, pass = Math.sin(PI * mix);
      const big = P.outer, small = big * P.innerRatio, a = lerp(small, big, mix);
      // both cubes turn at a steady rate the whole loop; a slow nod keeps the motion from feeling mechanical
      const spin = TAU * Math.round(P.turns) * E.p, nod = .12 * Math.sin(TAU * E.p);
      const R = cube ? M(RY(-spin + .7), RZ(.55 * P.skew + nod), RX(-.4 * P.skew)) : M(RY(spin + .2), RX(.35 - nod));
      const FACE = [RY(0), RY(PI), RY(PI / 2), RY(-PI / 2), RX(-PI / 2), RX(PI / 2)];
      const swell = 1 + .12 * pass * P.morph, side = 2 * a * P.panel * swell, m = M(R, FACE[f], T(0, 0, a * (1 + .05 * pass * P.morph)));
      const cam = orbitCam(E, P.camLift + .06 * P.camDrift * Math.sin(TAU * E.p), .3 * P.camDrift * Math.sin(TAU * E.p)).eye;
      const fz = m[8] * (cam[0] - m[12]) + m[9] * (cam[1] - m[13]) + m[10] * (cam[2] - m[14]);
      const facing = sstep(-.2, .25, fz / Math.hypot(cam[0] - m[12], cam[1] - m[13], cam[2] - m[14]));
      const bow = (P.pillow + P.morph * .85 * pass) / a;
      return {m, w: side, h: side, bend: bow, bendY: bow, img: i, o: (1 - P.ghost * mix) * lerp(1 - P.backFade, 1, facing), b: 1 - P.depthShade * (1 - facing)};
    }},

  // Roulette: cards lie on a tilted wheel. Each spin: a soft wind-back, a quick but smooth launch, a long glide down
  // to rest and a gentle rock as it settles; the card that lands at the front lifts off the wheel and turns to face
  // you. Every spin advances the wheel by whole turns plus a share of slots, so the loop is a whole number of turns.
  {...NEW, id: 'roulette', name: 'Roulette', n: 12, aspect: .8, cardH: .34, dur: 15, fov: 30,
    desc: 'Photos ride a spinning wheel that slows, wobbles and lands on a winner.',
    params: [G('Layout'), range('radius', 'Radius', .5, 1.2, .78), range('wheelTilt', 'Wheel tilt', .4, 1.4, 1.02), range('camLift', 'Camera height', -.3, .6, .08),
      range('dish', 'Dish', 0, 1, .35, .01, {hint: 'cards lean up toward you like the sides of a bowl'}),
      G('Motion'), whole('spins', 'Spins', 1, 4, 3, {unit: '×', hint: 'landings per loop'}), whole('kick', 'Turns per spin', 1, 4, 1), range('windup', 'Wind-up', 0, 1, .5),
      range('wobble', 'Wobble', 0, 1, .6), range('rest', 'Rest', .2, .6, .36), range('liftAmt', 'Winner lift', 0, 1.5, 1),
      G('Look'), range('loserDim', 'Others dim', 0, .6, .28), range('spinBlur', 'Spin blur', 0, 1, .35)],
    camera: (P, E) => orbitCam(E, P.camLift, 0, 1, -.14),
    layout(i, P, E){
      const n = E.n, Sp = Math.round(P.spins), K = Math.round(P.kick), slot = TAU / n;
      const wheel = p => {
        const c = wrap(p, 1) * Sp, s = Math.floor(c), t = c - s, adv = Math.floor((s + 1) * n / Sp) - Math.floor(s * n / Sp);
        const base = s * K * TAU + Math.floor(s * n / Sp) * slot, q = clamp01((t - P.rest) / (1 - P.rest)), total = K * TAU + adv * slot;
        // wind-back and rock both start and end with zero speed, so they blend into the glide
        const wu = -P.windup * .035 * Math.sin(PI * clamp01(q / .24)) ** 2;
        const wq = clamp01((q - .72) / .28), rock = P.wobble * .4 * slot * Math.sin(TAU * wq) * Math.sin(PI * wq) ** 2 * (1 - wq) / total;
        return {ang: base + total * (spinShare(q) + wu + rock), t};
      };
      const W = wheel(E.p), rr = W.t / P.rest, env = rr < 1 ? sm5(rr / .35) * (1 - sm5((rr - .68) / .3)) : 0;
      const psi = i * slot - W.ang, d = Math.atan2(Math.sin(psi), Math.cos(psi)), sel = sm5(1 - ab(d) / (slot * .55)), lw = env * sel * P.liftAmt;
      const ct = Math.cos(P.wheelTilt), st = Math.sin(P.wheelTilt), tilt = v => [v[0], v[1] * ct - v[2] * st, v[1] * st + v[2] * ct];
      // each card lies on the wheel, leaning up by Dish toward the outside like the wall of a bowl
      const out = [Math.sin(psi), 0, Math.cos(psi)], dl = P.dish * .55;
      const pos = tilt([P.radius * out[0], 0, P.radius * out[2]]), X0 = tilt([Math.cos(psi), 0, -Math.sin(psi)]);
      const Z0 = tilt([-out[0] * Math.sin(dl), Math.cos(dl), -out[2] * Math.sin(dl)]);
      const X = [lerp(X0[0], 1, lw), lerp(X0[1], 0, lw), lerp(X0[2], 0, lw)], Z = [lerp(Z0[0], 0, lw), lerp(Z0[1], .1, lw), lerp(Z0[2], 1, lw)];
      const sp = ab(wheel(E.p + .002).ang - wheel(E.p - .002).ang) / .004 / ((Sp * K + 1) * TAU), sc = 1 + .45 * lw;
      return {m: M(T(pos[0], pos[1] + lw * .45, pos[2] + lw * .55), frame3(0, 0, 0, X, Z), S(sc, sc, 1)),
        b: 1 - P.loserDim * env * (1 - sel), blur: P.spinBlur * sstep(.4, 1.6, sp) * .5, zBias: lw * 3};
    }},

  // Echo Trail: one hero card follows a closed 3D curve; copies at earlier moments trail behind it, smaller and
  // fainter. Every card curves with the path (bent to its turn in depth) and banks into it. The hero flips edge-on to
  // change photo, and the echoes replay that flip as they pass the same spot.
  {...NEW, id: 'echo-trail', name: 'Echo Trail', n: 8, aspect: .8, cardH: .6, dur: 16, fov: 30,
    desc: 'A photo sweeps along a curve, leaving a fading trail of echoes behind it.',
    params: [G('Layout'), seg('path', 'Path', {eight: 'Figure 8', orbit: 'Orbit', knot: 'Knot'}, 'eight'), range('pathW', 'Width', .4, 1.4, .82), range('pathH', 'Height', .2, 1, .5),
      range('pathDepth', 'Depth', 0, 2, 1.1),
      G('Motion'), whole('laps', 'Laps', 1, 3, 2, {unit: '×'}), whole('echoes', 'Echoes', 3, 24, 14), range('lag', 'Echo spacing', .004, .04, .01),
      range('flip', 'Flip time', .1, .6, .34, .01, {hint: 'how long the photo change takes'}), range('lean', 'Lean', 0, 1, .55),
      G('Look'), range('curl', 'Curve', 0, 2, 1, .01, {hint: 'cards bend with the turns of the path'}), range('echoFade', 'Echo fade', .3, 3, 1.4), range('shrink', 'Echo shrink', 0, .8, .4), range('echoBlur', 'Echo blur', 0, 1, .3)],
    fill: (P, E) => ({count: Math.round(P.echoes) + 1}),
    layout(i, P, E){
      const m = Math.round(P.echoes), j = i, n = E.n, tau = wrap(E.p - j * P.lag, 1), L = Math.round(P.laps), path = P.path;
      const nw = Math.min(1, Math.sqrt(E.asp / 1.25));
      const at = tt => { const s = TAU * L * tt;
        if (path === 'orbit') return [nw * P.pathW * Math.sin(s), P.pathH * .35 * Math.sin(2 * s), P.pathDepth * Math.cos(s)];
        if (path === 'knot') return [nw * P.pathW * Math.sin(2 * s), P.pathH * Math.sin(3 * s), P.pathDepth * .7 * Math.cos(s)];
        return [nw * P.pathW * Math.sin(s), P.pathH * Math.sin(2 * s), P.pathDepth * .5 * Math.cos(s)]; };
      const h = .0025, p1 = at(tau), {t, k} = curvature(at(tau - h), p1, at(tau + h), h);
      // photo changes: n per loop, each through an edge-on flip centred on the change
      const fpos = tau * n + .5, kk = Math.round(fpos), dd = fpos - kk, half = P.flip / 2;
      let ry = 0;
      if (ab(dd) < half){ const ang = PI * sm5((dd + half) / (2 * half)); ry = ang > PI / 2 ? ang - PI : ang; }
      const age = j / m, sc = 1 - P.shrink * age;
      // bend toward the centre of the turn in depth: edges fold back when the path swings round behind
      const bend = clampAbs(-P.curl * k[2] * .8, 2.4) / sc * Math.cos(ry);
      return {x: p1[0], y: p1[1], z: p1[2], ry: ry + P.lean * .5 * t[0], rz: -P.lean * .3 * t[1], bend, img: wrap(Math.floor(fpos), n),
        s: sc, o: Math.pow(1 - j / (m + 1), P.echoFade), blur: P.echoBlur * age * .7, b: 1 - .18 * age, zBias: -j * .05};
    }},

  // Galaxy: curved photo panels stand in the spiral arms like screens set along a winding road, each bent to the
  // arm's curve and turned toward you. The arms are logarithmic spirals and the panels sit at equal steps of log-radius,
  // each sized to its own step, so the arm is self-similar: every panel has the same clear gap to its neighbours from
  // the rim to the core, and none ever covers another. They flow inward as the galaxy turns, the core winding tighter
  // so the centre turns faster than the rim.
  {...NEW, id: 'galaxy', name: 'Galaxy', n: 12, aspect: 1.3, cardH: .23, dur: 30, fov: 30,
    desc: 'Tiny photos swirl in the spiral arms of a galaxy, the centre turning faster than the rim.',
    params: [G('Layout'), seg('arms', 'Arms', {2: 'Two', 3: 'Three', 4: 'Four'}, '2'), whole('perArm', 'Cards per arm', 8, 30, 14), range('galSize', 'Size', .6, 1.8, 1.25),
      range('wind', 'Wind', .3, 3, 2), range('cardFill', 'Card size', .4, .9, .8, .01, {hint: 'share of each step along the arm a photo fills; the rest is gap'}), range('warp', 'Disc warp', 0, 1, .3), range('galTilt', 'Camera tilt', 0, 1.2, .9),
      G('Motion'), whole('turns', 'Turns', 1, 3, 1, {unit: '×'}), whole('flow', 'Inflow', 1, 3, 1, {unit: '×', hint: 'times each card falls from rim to core per loop'}), range('coreSpin', 'Core spin', 0, 1, .5, .01, {hint: 'the core winds tighter, so it turns faster than the rim'}),
      G('Look'), range('curve', 'Curve', 0, 2, 1, .01, {hint: 'cards bend along the arm'}), range('lookUp', 'Face camera', 0, 1, .6),
      range('rimFade', 'Rim fade', 0, 1, .5), off('farBlur', 'Far blur', 1)],
    fill: (P, E) => { const a = +P.arms; return {count: a * Math.min(Math.round(P.perArm), Math.floor(120 / a))}; },
    camera: (P, E) => orbitCam(E, P.galTilt, 0, 1),
    layout(i, P, E){
      const A = +P.arms, per = Math.min(Math.round(P.perArm), Math.floor(120 / A)), arm = i % A, kq = Math.floor(i / A);
      const LM = Math.log(10), dl = LM / per, rMax = P.galSize * Math.min(1, Math.sqrt(E.asp / 1.25)), base = arm * TAU / A + TAU * Math.round(P.turns) * E.p;
      // slot position along the arm (0 at the rim, per at the core), whole slots per loop so it is seamless
      const u = wrap(kq + per * Math.round(P.flow) * E.p, per), l0 = Math.min(u, per - .02) * dl;
      const thAt = l => base + P.wind * (l + P.coreSpin * l * l / (2 * LM));
      const at = l => { const r = rMax * Math.exp(-l), th = thAt(l); return [r * Math.cos(th), 0, r * Math.sin(th)]; };
      const h = dl * .05, p = at(l0), {t, k} = curvature(at(l0 - h), p, at(l0 + h), h), r = rMax * Math.exp(-l0);
      // one step along the arm, and the gap to the next turn of the arms outward; the photo fits inside both
      const wE = P.wind * (1 + P.coreSpin * l0 / LM), step = r * dl * Math.sqrt(1 + wE * wE), across = r * (Math.exp(TAU / (A * wE)) - 1);
      const cw = Math.min(P.cardFill * step, across * .55 * E.w / E.h), sc = cw / E.w;
      const y = P.warp * .12 * r * Math.sin(2 * (thAt(l0) - base) + 1), cam = orbitCam(E, P.galTilt).eye;
      // stand each panel along the arm, its face turned to the camera's side (it swaps sides only when edge-on)
      const nrm = [-t[2], 0, t[0]], cx = cam[0] - p[0], cz = cam[2] - p[2], ch = Math.hypot(cx, cz) || 1, fd = (nrm[0] * cx + nrm[2] * cz) / ch, sg = fd < 0 ? -1 : 1;
      const Z = [nrm[0] * sg, 0, nrm[2] * sg], ry = Math.atan2(Z[0], Z[2]), rx = -P.lookUp * Math.atan2(cam[1] - y, ch);
      const bend = clampAbs(-P.curve * (k[0] * Z[0] + k[2] * Z[2]) * sc, 1.6 / E.w) * sstep(.04, .3, ab(fd));
      const o = sstep(0, .3 + 1.6 * P.rimFade, u) * (1 - sstep(per - 2.6, per - .3, u));
      return {m: M(T(p[0], y, p[2]), RY(ry), RX(rx), S(sc, sc, 1)), bend, o, img: i % E.n,
        blur: P.farBlur * clamp01(-p[2] / rMax * .5 + .5) * .6, b: .9 + .1 * (1 - l0 / LM)};
    }},
];
