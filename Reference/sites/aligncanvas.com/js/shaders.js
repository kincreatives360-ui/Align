// GLSL for every pass: background, card shadows, cards, the Flare Duo transition, and the post pass
// (liquid-glass edges, glass lens, bloom, grade, grain, labels).

export const VS_FULL = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }`;

const COMMON = `
float sdRoundBox(vec2 p, vec2 b, float r){
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., 2., 1.) / 3.) * 6. - 3.) - 1., 0., 1.); }
// glass dispersion: a tap at wavelength d (-1 violet .. 1 red) adds its colour weighted by spec(d); dividing
// by the summed weights per channel keeps white white, so only edges split into a smooth spectrum; the small
// negative lobe (as in real colour-matching curves) keeps the fringe saturated
vec3 spec(float d){ vec3 e = (vec3(d) - vec3(.6, 0., -.6)) / vec3(.4, .33, .4), g = exp(-e * e) + vec3(.3, 0., 0.) * exp(-(d + 1.) * (d + 1.) * 10.); return g * 1.6 - (g.r + g.g + g.b) * .2; }
// interleaved gradient noise: per-pixel tap jitter that reads as smooth instead of banding
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(.06711056, .00583715)))); }
`;

/* ---------- background ---------- */
export const FS_BG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform int uMode;
uniform vec3 uC0, uC1, uC2, uC3;
uniform float uPhase, uCycles, uScale, uAngle, uAmt;
out vec4 o;
${COMMON}
const float TAU = 6.2831853;
// periodic so every background loops seamlessly with the animation
float wave(vec2 p, float a){ return sin(p.x * 1.7 + cos(a) * 1.3 + sin(p.y * 2.1 + a)) * .5 + .5; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  vec2 p = (uv - .5) * vec2(asp, 1.);
  float A = TAU * uPhase * uCycles;
  vec3 c = uC0;
  if (uMode == 1){ vec2 d = vec2(cos(uAngle), sin(uAngle)); c = mix(uC0, uC1, smoothstep(-.7, .7, dot(p, d))); }
  else if (uMode == 2){ float r = length(p - vec2(0., .55)); c = mix(uC1, uC0, smoothstep(0., 1.15 * uScale, r)); }
  else if (uMode == 3){
    vec3 acc = uC0 * .6; float ws = .6;
    for (int k = 0; k < 3; k++){
      float fk = float(k);
      vec2 cpos = vec2(cos(A + fk * 2.1) * .45 * asp * .6, sin(A * (fk == 1. ? -1. : 1.) + fk * 1.7) * .35);
      float w = exp(-dot(p - cpos, p - cpos) / (.12 * uScale));
      acc += (k == 0 ? uC1 : k == 1 ? uC2 : uC3) * w * 1.6; ws += w * 1.6;
    }
    c = acc / ws;
  }
  else if (uMode == 4){
    c = uC0;
    for (int k = 0; k < 3; k++){
      float fk = float(k);
      float y = .15 + fk * .12 + .1 * sin(p.x * (2. + fk) + A + fk) + .05 * sin(p.x * 5. - A * 2. + fk * 3.);
      float band = exp(-pow((p.y - y) / (.09 + .05 * fk), 2.)) * (.6 + .4 * sin(p.x * 3. + A + fk));
      c += (k == 0 ? uC1 : k == 1 ? uC2 : uC3) * band * .8 * uAmt;
    }
    c = mix(c, c * .6, smoothstep(.2, -.6, p.y));
  }
  else if (uMode == 5 || uMode == 6){
    float cell = 48. * uScale * uRes.y / 1080.;
    vec2 g = gl_FragCoord.xy / cell + vec2(.5);
    vec2 fr = fract(g), dl = min(fr, 1. - fr) * cell;
    float lw = max(1., uRes.y / 1080.);
    float line = uMode == 5 ? 1. - smoothstep(0., lw, min(dl.x, dl.y)) : 0.;
    float dotm = uMode == 6 ? 1. - smoothstep(.07, .07 + 1.5 / cell, length(fr - .5)) : 0.;
    float fade = 1. - smoothstep(.2, .9, length(p));
    c = mix(uC0, uC1, max(line, dotm) * .55 * uAmt * (.35 + .65 * fade));
    c += uC2 * .18 * exp(-dot(p, p) * 2.5);
  }
  else if (uMode == 7){
    float h = .5 * sin(p.x * 2.4 + cos(A) * .8) + p.y * .7 + .12 * sin(p.y * 6. + A) + .1 * cos(A);
    vec3 holo = hue(fract(h)) * .5 + .5;
    c = mix(uC0, holo, .55 * uAmt);
  }
  else if (uMode == 8){
    float cone = exp(-pow(p.x / (.25 + (.55 - uv.y) * .5), 2.)) * smoothstep(-.2, 1., uv.y);
    c = uC0 + uC1 * cone * .7 * uAmt;
    c += uC1 * .25 * exp(-pow((uv.y - .18) / .1, 2.)) * exp(-p.x * p.x * 3.);
  }
  else if (uMode == 9){
    float v = wave(p * 3. * uScale, A) + wave(p.yx * 2.3 * uScale + 1.3, -A + 1.) + wave(p * 4.1 * uScale - 2., A * 2.);
    v /= 3.;
    c = mix(mix(uC0, uC1, smoothstep(.2, .55, v)), uC2, smoothstep(.55, .85, v));
  }
  c += (hash12(gl_FragCoord.xy) - .5) / 255.;
  o = vec4(c, 1.);
}`;

/* ---------- cards ---------- */
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
export const VS_CARD = `#version 300 es
in vec2 aUV;
uniform mat4 uModel, uVP;
uniform vec2 uSize, uExpand;
uniform float uOff, uCrumple, uCrSeed;
out vec2 vUV, vLocal;
out vec3 vN, vW;
${BEND}
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
}`;
// The edge walls of a thick card: aUV.x runs 0..128 round the rounded-rect outline (each side 24
// steps, then 8 round its corner), aUV.y 0..1 from the front face to the back.
export const VS_SIDE = `#version 300 es
in vec2 aUV;
uniform mat4 uModel, uVP;
uniform vec2 uSize;
uniform float uRadius, uThick;
out vec3 vN, vW;
${BEND}
void main(){
  vec2 h = uSize * .5; float r = min(uRadius, min(h.x, h.y)); vec2 c = h - r;
  float k = floor(aUV.x / 32.), g = mod(k, 4.), j = aUV.x - k * 32.;
  vec2 lp, n2;
  if (j < 24.){
    float t = j / 24.;
    if (g == 0.){ lp = vec2(h.x, mix(-c.y, c.y, t)); n2 = vec2(1., 0.); }
    else if (g == 1.){ lp = vec2(mix(c.x, -c.x, t), h.y); n2 = vec2(0., 1.); }
    else if (g == 2.){ lp = vec2(-h.x, mix(c.y, -c.y, t)); n2 = vec2(-1., 0.); }
    else { lp = vec2(mix(-c.x, c.x, t), -h.y); n2 = vec2(0., -1.); }
  } else {
    float a = (g + (j - 24.) / 8.) * 1.5707963;
    n2 = vec2(cos(a), sin(a));
    lp = vec2(g == 0. || g == 3. ? c.x : -c.x, g < 2. ? c.y : -c.y) + r * n2;
  }
  float tx, ty;
  vec3 p = bendP(lp, -aUV.y * uThick, tx, ty);
  vec4 w = uModel * vec4(p, 1.);
  vW = w.xyz; vN = mat3(uModel) * bendRot(vec3(n2, 0.), tx, ty);
  gl_Position = uVP * w;
}`;
export const FS_SIDE = `#version 300 es
precision highp float;
in vec3 vN, vW;
uniform vec3 uCam, uEdgeCol;
uniform float uOpacity, uBright;
out vec4 o;
void main(){
  vec3 N = normalize(vN), V = normalize(uCam - vW);
  // lit from the camera and a little from above, so the walls read as solid
  float f = abs(dot(N, V)), top = clamp(N.y, 0., 1.);
  vec3 col = uEdgeCol * (.5 + .38 * f + .18 * top) * uBright;
  o = vec4(col * uOpacity, uOpacity);
}`;
export const FS_SHADOW = `#version 300 es
precision highp float;
in vec2 vUV, vLocal; in vec3 vN, vW;
uniform vec2 uSize; uniform float uRadius, uSoft, uAlpha; uniform vec3 uColor;
out vec4 o;
${COMMON}
void main(){
  float d = sdRoundBox(vLocal, uSize * .5, uRadius);
  float a = uAlpha * (1. - smoothstep(-uSoft, uSoft, d));
  o = vec4(uColor * a, a);
}`;

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
}`;

/* ---------- Flare Duo (ported from the original transition) ---------- */
export const FS_FLARE = `#version 300 es
precision highp float;
uniform vec2 uRes, uC, uH;
uniform float uR, uW, uDir, uShadow, uBorder, uEdgeSh, uChroma, uBlurSp, uRim, uNewTop;
uniform float uAmpO, uSpO, uBlurO, uRimO;
uniform float uAmpN, uSpN, uBlurN, uRimN;
uniform sampler2D uTexA0, uTexA1, uTexA2, uTexA3, uTexB0, uTexB1, uTexB2, uTexB3;
uniform vec3 uLv;
out vec4 o;
${COMMON}
float rbox(vec2 p, vec2 b, float r){ r = min(r, min(b.x, b.y)); vec2 q = abs(p) - b + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }
float lineX(){ return -uH.x + uW * 2. * uH.x; }
float horn(float d, float w){ float k = max(1. - d / w, 0.); return k * k * k; }
float hornSlope(float d, float w){ float k = max(1. - d / w, 0.); return 3. * k * k / w; }
float profO(float sx, float L){ return (sx < L && uNewTop > .5) ? 0. : horn(max(sx - L, 0.), uSpO * 6. * uH.x); }
float profN(float sx, float L){ return (sx > L && uNewTop < .5) ? 0. : horn(max(L - sx, 0.), uSpN * 6. * uH.x); }
float hyO(float sx, float L){ return uH.y * (1. + uAmpO * profO(sx, L)); }
float hyN(float sx, float L){ return uH.y * (1. + uAmpN * profN(sx, L)); }
float shapeSdf(float qx, float ay, float h, float slope, float r){
  float qy = (ay - h) / sqrt(1. + slope * slope);
  vec2 qq = vec2(qx, qy) + r;
  return length(max(qq, 0.)) + min(max(qq.x, qq.y), 0.) - r;
}
float sdfO(vec2 q){
  float sx = q.x * uDir, L = lineX();
  if (L >= uH.x - .5) return 1e5;
  float slope = sx > L ? uH.y * uAmpO * hornSlope(sx - L, uSpO * 6. * uH.x) : 0.;
  float Lc = L - (uNewTop > .5 ? uR + uRim + 4. : 0.);
  float r = mix(uR, min(uR, uSpO * 2. * uH.x * .6), profO(sx, L) * step(.001, uAmpO));
  return shapeSdf(max(Lc - sx, sx - uH.x), abs(q.y), hyO(sx, L), slope, min(r, (uH.x - Lc) * .5));
}
float sdfN(vec2 q){
  float sx = q.x * uDir, L = lineX();
  if (L <= -uH.x + .5) return 1e5;
  float slope = sx < L ? uH.y * uAmpN * hornSlope(L - sx, uSpN * 6. * uH.x) : 0.;
  float Lc = L + (uNewTop < .5 ? uR + uRim + 4. : 0.);
  float r = mix(uR, min(uR, uSpN * 2. * uH.x * .6), profN(sx, L) * step(.001, uAmpN));
  return shapeSdf(max(-uH.x - sx, sx - Lc), abs(q.y), hyN(sx, L), slope, min(r, (Lc + uH.x) * .5));
}
// colour split as a jittered spectrum of taps (see spec in COMMON), so it never shows stepped copies
vec3 split(sampler2D t, vec2 uv, float ca){
  if (abs(ca) * uH.x < .25) return texture(t, uv).rgb;
  vec3 acc = vec3(0.), ws = vec3(0.); float j = ign(gl_FragCoord.xy);
  for (int i = 0; i < 6; i++){ float d = (float(i) + j) / 6. * 2. - 1.; vec3 w = spec(d); acc += texture(t, uv + vec2(ca * d, 0.)).rgb * w; ws += w; }
  return max(acc / ws, 0.);
}
#define BLUR(T0, T1, T2, T3) { \\
  if (b < .3) return texture(T0, uv).rgb; \\
  float ca = uChroma * b * uDir / (2. * uH.x); \\
  if (b <= uLv.x) return mix(texture(T0, uv).rgb, split(T1, uv, ca), b / uLv.x); \\
  if (b <= uLv.y) return mix(split(T1, uv, ca), split(T2, uv, ca), (b - uLv.x) / (uLv.y - uLv.x)); \\
  return mix(split(T2, uv, ca), split(T3, uv, ca), clamp((b - uLv.y) / (uLv.z - uLv.y), 0., 1.)); }
vec3 blurA(vec2 uv, float b) BLUR(uTexA0, uTexA1, uTexA2, uTexA3)
vec3 blurB(vec2 uv, float b) BLUR(uTexB0, uTexB1, uTexB2, uTexB3)
vec3 rimShade(vec3 c, float de, float on){
  float lum = dot(c, vec3(.299, .587, .114));
  float band = (1. - smoothstep(uRim - 1.2, uRim + 1.2, de)) * on;
  // light and dark content get different glass faces; blend them so a mid-tone never flips per pixel
  float hi = smoothstep(.4, .6, lum);
  vec3 face = mix(c * .55 + vec3(.2), c * .9, hi);
  face *= 1. - .25 * smoothstep(0., uRim, de) * mix(1., .2, hi);
  c = mix(c, face, band);
  c += (1. - smoothstep(0., 1.5, de)) * on * mix(.12, .03, hi);
  c *= 1. - on * .18 * (smoothstep(uRim - 1., uRim + 2., de) * exp(-max(de - uRim, 0.) / (uRim * 1.5)));
  return c;
}
vec4 over(vec4 dst, vec3 c, float a){ return vec4(c, 1.) * a + dst * (1. - a); }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 q = p - uC;
  vec2 so = vec2(0., uH.y * .07);
  float ds = min(sdfN(q - so), sdfO(q - so));
  vec4 col = vec4(0., 0., 0., uShadow * (1. - smoothstep(-uH.y * .12, uH.y * .38, ds)) * .45);
  float sx = q.x * uDir, L = lineX();
  float tx = (q.x + uH.x) / (2. * uH.x);
  float edgeS = uH.x * .05;
  float dO = sdfO(q);
  float aO = 1. - smoothstep(-1., 1., dO / max(fwidth(dO), 1e-3));
  vec3 cO = vec3(0.);
  if (aO > 0.){
    vec2 uvO = vec2(tx, .5 + q.y / (2. * hyO(sx, L)));
    cO = blurA(uvO, uBlurO * horn(max(sx - L, 0.), uBlurSp * 6. * uH.x));
    cO = rimShade(cO, max(sx - L, 0.), uRimO);
    if (uNewTop > .5 && sx > L) cO *= 1. - exp(-(sx - L) / edgeS) * .4 * uEdgeSh * uRimN;
    cO += uBorder * (1. - smoothstep(0., 2., abs(dO + 1.5)));
  }
  float dN = sdfN(q);
  float aN = 1. - smoothstep(-1., 1., dN / max(fwidth(dN), 1e-3));
  vec3 cN = vec3(0.);
  if (aN > 0.){
    vec2 uvN = vec2(tx, .5 + q.y / (2. * hyN(sx, L)));
    cN = blurB(uvN, uBlurN * horn(max(L - sx, 0.), uBlurSp * 6. * uH.x));
    cN = rimShade(cN, max(L - sx, 0.), uRimN);
    if (uNewTop < .5 && sx < L) cN *= 1. - exp(-(L - sx) / edgeS) * .4 * uEdgeSh * uRimO;
    cN += uBorder * (1. - smoothstep(0., 2., abs(dN + 1.5)));
  }
  if (uNewTop > .5){ col = over(col, cO, aO); col = over(col, cN, aN); }
  else             { col = over(col, cN, aN); col = over(col, cO, aO); }
  o = col;
}`;

/* ---------- post: liquid glass + finishing ---------- */
export const FS_POST = `#version 300 es
precision highp float;
uniform sampler2D uScene, uLabel;
uniform vec2 uRes;
uniform float uSeed, uAlphaOut, uLabelOn;
// edge glass: top, bottom, left, right strength; width is a fraction of the frame along each axis
uniform vec4 uEdge;
uniform float uEW, uER, uED, uES, uEF, uEH, uEB, uEX; uniform int uECurve; uniform vec3 uEdgeTint;
uniform float uLensOn; uniform int uLensMode;
uniform vec2 uLensC, uLensS; uniform float uLensR, uLensRef, uLensFrost, uLensDisp, uLensBevel, uLensHi, uLensMag, uLensShadow, uLensTintA;
uniform vec3 uLensTint;
uniform float uGrain, uVig, uBloom, uChroma, uContrast, uSat, uEdgeBlur, uExposure;
out vec4 o;
${COMMON}
float prof(float t, float along){
  if (uECurve == 1) return pow(t, 1.35);
  if (uECurve == 2) return t * t * (.72 + .28 * sin(along * 46. + t * 7.));
  return t * t * (3. - 2. * t) * t;
}
vec4 S(vec2 uv, float lod){ return textureLod(uScene, uv, lod); }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  // ---- edge glass: the image is smeared toward each rim in streaks along the rim's normal,
  // each colour by a different length, softening and clouding as it reaches the edge
  vec2 smear = vec2(0.), scale = vec2(1.), stretch = vec2(0.);
  float lod = 0., haze = 0.;
  if (dot(uEdge, vec4(1.)) > 0.){
    float W = max(uEW, 1e-3);
    vec4 dist = vec4(1. - uv.y, uv.y, uv.x, 1. - uv.x);
    vec2 dirs[4] = vec2[4](vec2(0., -1.), vec2(0., 1.), vec2(1., 0.), vec2(-1., 0.));
    for (int k = 0; k < 4; k++){
      float s = uEdge[k];
      if (s <= 0.) continue;
      float t0 = clamp(1. - dist[k] / W, 0., 1.), t = pow(t0, 1. + uEF * 2.5);
      float f = prof(t, k < 2 ? uv.x * asp : uv.y) * s;
      smear += dirs[k] * f * uER * W * 1.25;
      // crisp stretch: content at the inner edge of the band is pulled out across it
      stretch += dirs[k] * W * t0 * (uEX * f / (1. + uEX * f));
      if (k < 2) scale.x /= 1. + uEB * f; else scale.y /= 1. + uEB * f;
      lod += f * uES * 4.5;
      haze += f * f * uEH;
    }
  }
  vec2 uv0 = .5 + (uv - .5) * scale + stretch;
  vec2 sd2 = stretch * uED * .35;
  // ---- liquid lens: a slab of glass with a rounded rim, refracting with per-colour index of refraction
  vec2 offR = vec2(0.), offG = vec2(0.), offB = vec2(0.);
  float lensShade = 1.; vec3 lensAdd = vec3(0.); float lensTint = 0., lensMix = 0.;
  if (uLensOn > .5){
    vec2 p = (uv - uLensC) * vec2(asp, 1.);
    if (uLensMode == 1){
      float R = uLensS.x, r = length(p);
      float k = clamp(1. - r / (R * 2.2), 0., 1.);
      float ang = uLensRef * 4. * k * k;
      mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
      vec2 q = rot * p * (1. - .35 * k * k), d = q - p; d.x /= asp;
      offR = offG = offB = d;
      lod += uLensFrost * 4. * k;
      lensShade = smoothstep(R * .32, R * .55, r);
      lensAdd = vec3(1., .78, .55) * exp(-pow((r - R * .55) / (R * .06), 2.)) * uLensHi;
    } else {
      vec2 hs = uLensS;
      float rad = uLensR * min(hs.x, hs.y);
      float sd = sdRoundBox(p, hs, rad);
      float px = 1. / uRes.y;
      if (sd < px){
        float e = max(-sd, 0.), bw = max(uLensBevel * min(hs.x, hs.y), 1e-3), u = clamp(e / bw, 0., 1.), q = 1. - u;
        // circular bevel: flat on top, curving down to the rim
        float slope = min(q / sqrt(max(1. - q * q, .0025)), 14.);
        float h = 1.5 * px;
        vec2 n2 = normalize(vec2(sdRoundBox(p + vec2(h, 0.), hs, rad) - sdRoundBox(p - vec2(h, 0.), hs, rad), sdRoundBox(p + vec2(0., h), hs, rad) - sdRoundBox(p - vec2(0., h), hs, rad)) + 1e-6);
        vec3 N = normalize(vec3(n2 * slope, 1.));
        float T = uLensRef * bw * 1.6;
        // a real index spread is too faint to see, so the spectrum spans a fraction of the bend itself:
        // zero on the flat top, widest where the bevel bends most
        vec3 Rg = refract(vec3(0., 0., -1.), N, 1. / 1.5);
        vec2 bend = Rg.xy / max(-Rg.z, .2) * T;
        offG = bend - p * uLensMag; offR = offG + bend * .4 * uLensDisp; offB = offG - bend * .4 * uLensDisp;
        offR.x /= asp; offG.x /= asp; offB.x /= asp;
        lod += uLensFrost * 4.;
        float fres = pow(1. - N.z, 2.2);
        vec3 L = normalize(vec3(-.45, .7, .55));
        float spec = pow(max(dot(N, normalize(L + vec3(0., 0., 1.))), 0.), 80.);
        float rimTop = (1. - smoothstep(0., 1.6 * px, e)) * (.35 + .65 * smoothstep(-.2, .8, dot(n2, vec2(-.5, .85))));
        float rimIn = exp(-e / (bw * .12)) * .25;
        lensAdd = vec3(1.) * (spec * .9 + rimTop * .55 + rimIn * .3 + fres * .35 * smoothstep(-.6, .9, n2.y)) * uLensHi;
        lensTint = uLensTintA;
        lensMix = 1. - smoothstep(0., px, sd);
      } else {
        float ds = sdRoundBox(p - vec2(0., -.012), hs, rad);
        lensShade = 1. - uLensShadow * .16 * (1. - smoothstep(0., .07, ds));
      }
    }
  }
  vec2 ca = (uv - .5) * uChroma * .012;
  if (uEdgeBlur > 0.){ vec2 c = abs(uv - .5) * 2.; lod += uEdgeBlur * 6. * smoothstep(.45, 1., max(c.x, c.y)); }
  vec3 col; float alpha;
  // dispersion: each tap is one wavelength d, shifted along D (stretch, bulge, lens, chroma) and along the smear,
  // with a little extra blur so neighbouring taps overlap. Along a smear the taps are fixed and evenly spaced
  // (wavelengths shuffled by the golden ratio), since per-pixel jitter there reads as grain; a short spread
  // with no smear (lens, card stretch) keeps jittered taps
  vec2 D = (offR - offB) * .5 + sd2 + ca + (uv - .5) * (scale - 1.) * uED * .3, base = uv0 + offG;
  float sm = length(smear * uRes), dp = length(D * uRes);
  if (sm + dp > .75){
    bool smr = sm > .5;
    int N = smr ? 32 : int(clamp(ceil(dp * .75), 3., 16.));
    float fN = float(N), j = smr ? .5 : ign(gl_FragCoord.xy), j2 = hash12(gl_FragCoord.xy + 7.13);
    // each colour only sees about a third of the taps, so the blur covers that colour's tap spacing
    float l2 = lod + clamp(log2(max(sm * 3.2, dp * 2.) / fN), 0., 5.);
    vec3 acc = vec3(0.), ws = vec3(0.); float aa = 0., wa = 0.;
    for (int i = 0; i < 32; i++){
      if (i >= N) break;
      float fi = float(i), d = smr ? fract(fi * .618034 + .31) * 2. - 1. : (fi + j) / fN * 2. - 1.;
      float k = smr ? (fi + .5) / fN : fract(fi * .618034 + j2), w = 1. - k * .55;
      vec4 s = S(base + D * d + smear * (k * max(0., 1. + uED * .6 * d) + uED * .22 * d), l2);
      vec3 sw = spec(d) * w; acc += s.rgb * sw; ws += sw; aa += s.a * w; wa += w;
    }
    col = max(acc / ws, 0.); alpha = aa / wa;
  } else { vec4 g = S(base, lod); col = g.rgb; alpha = g.a; }
  col = mix(col, uEdgeTint, clamp(haze, 0., .85));
  col = mix(col, uLensTint, lensTint * lensMix) * lensShade + lensAdd * lensMix + (uLensMode == 1 ? lensAdd : vec3(0.));
  if (uBloom > 0.){
    vec3 b1 = textureLod(uScene, uv, 3.).rgb, b2 = textureLod(uScene, uv, 5.).rgb;
    col += (max(b1 - .55, 0.) * .7 + max(b2 - .45, 0.) * .9) * uBloom;
  }
  col *= uExposure;
  col = (col - .5) * uContrast + .5;
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat);
  vec2 vp = (uv - .5) * vec2(asp, 1.);
  col *= 1. - uVig * smoothstep(.3, 1.05, length(vp) / max(asp, 1.) * 1.35);
  col += (hash12(gl_FragCoord.xy + uSeed * 17.31) - .5) * uGrain * .16;
  if (uLabelOn > .5){ vec4 Lb = texture(uLabel, vec2(uv.x, 1. - uv.y)); col = col * (1. - Lb.a) + Lb.rgb; alpha = max(alpha, Lb.a); }
  o = uAlphaOut > .5 ? vec4(col, alpha) : vec4(col, 1.);
}`;
