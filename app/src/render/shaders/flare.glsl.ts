import { COMMON } from './common.glsl';

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
}
`;