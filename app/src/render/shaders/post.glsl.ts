import { COMMON } from './common.glsl';

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
}
`;