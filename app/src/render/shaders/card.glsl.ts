import { COMMON } from './common.glsl';

// Bending: a card curls around a vertical axis (uBend, along its width) and/or a horizontal one
// (uBendY, along its height). z0 pushes the point along the bent surface's normal, for the back of
// a thick card and its edge walls.
const BEND = `
uniform float uBend, uBendY;
vec3 bendRot(vec3 v, float tx, float ty){
  v = vec3(v.x, v.y * cos(ty) + v.z * sin(ty), -v.y * sin(ty) + v.z * cos(ty));
  return vec3(v.x * cos(tx) + v.z * sin(tx), v.y, -v.x * sin(tx) + v.z * cos(tx));
}
vec3 bendP(vec2 lp, float z0, out float tx, out float ty){
  vec3 p = vec3(lp, 0.);
  tx = abs(uBend) > 1e-4 ? lp.x * uBend : 0.; ty = abs(uBendY) > 1e-4 ? lp.y * uBendY : 0.;
  if (abs(uBendY) > 1e-4){ p.y = sin(ty) / uBendY; p.z = (cos(ty) - 1.) / uBendY; }
  if (abs(uBend) > 1e-4){ float R = 1. / uBend + p.z; p.x = sin(tx) * R; p.z = cos(tx) * R - 1. / uBend; }
  return p + bendRot(vec3(0., 0., 1.), tx, ty) * z0;
}`;

// Crumple: the sheet wraps into a loose ball and folds along straight creases (triangle waves in a
// few seeded directions), like paper scrunched in a hand. 0 leaves the card flat.
const CRUMPLE = `
// Crumple: the sheet wraps into a loose ball and folds along straight creases (triangle waves in a
// few seeded directions), like paper scrunched in a hand. 0 leaves the card flat.
vec3 crumple(vec2 lp, vec3 p){
  float R = max(uSize.x, uSize.y) * .5, k = uCrumple; vec2 q = lp / R;
  float z = 0.; vec2 dxy = vec2(0.);
  for (int i = 0; i < 7; i++){
    float a = uCrSeed * 7.13 + float(i) * 2.39996, f = 1.2 + float(i) * .62; vec2 d = vec2(cos(a), sin(a));
    float tri = abs(fract(dot(q, d) * f + fract(uCrSeed * (3.7 + float(i) * 1.3))) - .5) * 2. - .5;
    z += tri / f; dxy += d * tri / f;
  }
  float ball = 1.3 * smoothstep(0., 1., k);
  if (ball > 1e-3){ vec2 g = q * ball; float rb = R / ball; p = vec3(rb * sin(g.x) * cos(g.y), rb * sin(g.y), rb * (cos(g.x) * cos(g.y) - 1.)); }
  return p * (1. - .1 * k) + vec3(dxy * R * k * .2, z * R * k * .55);
}
`;

export const VS_CARD = `#version 300 es
in vec2 aUV;
uniform mat4 uModel, uVP;
uniform vec2 uSize, uExpand;
uniform float uOff, uCrumple, uCrSeed;
out vec2 vUV, vLocal;
out vec3 vN, vW;
${BEND}
${CRUMPLE}
void main(){
  vec2 s = uSize + uExpand * 2.;
  vec2 lp = (aUV - .5) * s;
  float tx, ty;
  vec3 p = bendP(lp, uOff, tx, ty), n = bendRot(vec3(0., 0., 1.), tx, ty);
  if (uCrumple > 0.) p = crumple(lp, p);
  vec4 w = uModel * vec4(p, 1.);
  vW = w.xyz; vN = mat3(uModel) * n;
  vUV = vec2(aUV.x, 1. - aUV.y);
  vLocal = lp;
  gl_Position = uVP * w;
}
`;

export const FS_CARD = `#version 300 es
precision highp float;
in vec2 vUV, vLocal; in vec3 vN, vW;
uniform sampler2D uT0, uT1, uT2, uT3;
uniform vec2 uSize;
uniform float uRadius, uOpacity, uBlur, uShade, uBorder, uGlare, uGlareP, uBackMix, uBright;
uniform float uGlassW, uGlassR, uGlassD;
uniform vec3 uCam, uBackCol, uTint; uniform float uTintA, uCrumple;
out vec4 o;
${COMMON}
vec3 lay(float lv, vec2 uv){
  if (lv <= 0.) return texture(uT0, uv).rgb;
  if (lv <= 1.) return mix(texture(uT0, uv).rgb, texture(uT1, uv).rgb, lv);
  if (lv <= 2.) return mix(texture(uT1, uv).rgb, texture(uT2, uv).rgb, lv - 1.);
  return mix(texture(uT2, uv).rgb, texture(uT3, uv).rgb, clamp(lv - 2., 0., 1.));
}
// lay() with the sharp layer's mip picked from the card's own gradients, so jittered glass taps don't blur it
vec3 layG(float lv, vec2 uv, vec2 gx, vec2 gy){ vec3 c0 = textureGrad(uT0, uv, gx, gy).rgb; return lv <= 0. ? c0 : lv <= 1. ? mix(c0, texture(uT1, uv).rgb, lv) : lay(lv, uv); }
float sd(vec2 q){ return sdRoundBox(q, uSize * .5, uRadius); }
void main(){
  float d = sd(vLocal);
  float aa = max(fwidth(d), 1e-5);
  float a = 1. - smoothstep(-aa * .8, aa * .8, d);
  if (a <= 0.) discard;
  vec2 uv = vUV;
  float lv = uBlur * 3.;
  vec3 col;
  if (uGlassW > 0.){
    // the card's edge is a bevelled slab of glass: bending climbs steeply toward the rim, and each tap
    // refracts one wavelength, so colour fans into a smooth spectrum along the edge normal; the centre stays clean
    vec2 hs = uSize * .5, gx = dFdx(uv), gy = dFdy(uv);
    float bw = uGlassW * min(hs.x, hs.y);
    float t = clamp(1. + d / bw, 0., 1.);
    float e = aa * 2.;
    vec2 n = normalize(vec2(sd(vLocal + vec2(e, 0.)) - sd(vLocal - vec2(e, 0.)), sd(vLocal + vec2(0., e)) - sd(vLocal - vec2(0., e))) + 1e-6);
    float bev = t * t * (.35 + .65 * t);
    vec2 off = -n * bev * uGlassR * bw / uSize; off.y = -off.y;
    vec2 D = off * uGlassD;
    float dpx = length(D * uSize) / aa, l2 = lv + t * t * 1.2;
    if (dpx > .5){
      int N = int(clamp(ceil(dpx * .4), 3., 10.)); float fN = float(N), j = ign(gl_FragCoord.xy);
      l2 += min(dpx / fN * .12, 1.);
      vec3 acc = vec3(0.), ws = vec3(0.);
      for (int i = 0; i < 10; i++){ if (i >= N) break; float dd = (float(i) + j) / fN * 2. - 1.; vec3 w = spec(dd); acc += layG(l2, uv + off + D * dd, gx, gy) * w; ws += w; }
      col = max(acc / ws, 0.);
    } else col = layG(l2, uv + off, gx, gy);
    // Fresnel-ish rim: a soft sheen rising toward the edge, brightest on the side facing the light
    col += pow(t, 4.) * (.06 + .2 * smoothstep(-.4, 1., dot(n, vec2(-.53, .85)))) * min(uGlassR, 1.) + t * t * t * .25 * uBorder;
  } else col = lay(lv, uv);
  if (!gl_FrontFacing) col = mix(uBackCol, col * .5, uBackMix);
  col = mix(col, uTint, uTintA);
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCam - vW);
  float f = clamp(dot(N, V), 0., 1.);
  col *= mix(1., .3 + .7 * f, uShade);
  if (uCrumple > 0.){
    // crumpled paper: light each facet from its own screen-space normal, so the creases read
    vec3 Nf = normalize(cross(dFdx(vW), dFdy(vW))); if (dot(Nf, V) < 0.) Nf = -Nf;
    vec3 Ld = normalize(vec3(-.45, .65, .62));
    float lit = .5 + .55 * max(dot(Nf, Ld), 0.) + .22 * pow(max(dot(reflect(-V, Nf), Ld), 0.), 10.);
    col *= mix(1., lit, clamp(uCrumple * 1.6, 0., 1.));
  }
  col *= uBright;
  float gx = (vUV.x + (1. - vUV.y) * .55) - uGlareP;
  col += uGlare * (exp(-gx * gx / .006) * .55 + exp(-gx * gx / .08) * .12);
  float rim = 1. - smoothstep(aa * .6, aa * 2.4, -d);
  col = mix(col, vec3(1.), rim * uBorder);
  float A = a * uOpacity;
  o = vec4(col * A, A);
}
`;