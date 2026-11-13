import { COMMON } from './common.glsl';

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
}
`;