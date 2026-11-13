import { COMMON } from './common.glsl';

export const VS_SHADOW = `#version 300 es
in vec2 aUV;
uniform mat4 uModel, uVP;
uniform vec2 uSize, uExpand;
uniform float uOff, uBend, uBendY;
out vec2 vUV, vLocal;
out vec3 vN, vW;
${COMMON}
float sdRoundBox(vec2 p, vec2 b, float r){
  r = min(r, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}
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
}
void main(){
  vec2 s = uSize + uExpand * 2.;
  vec2 lp = (aUV - .5) * s;
  float tx, ty;
  vec3 p = bendP(lp, uOff, tx, ty), n = bendRot(vec3(0., 0., 1.), tx, ty);
  vec4 w = uModel * vec4(p, 1.);
  vW = w.xyz; vN = mat3(uModel) * n;
  vUV = vec2(aUV.x, 1. - aUV.y);
  vLocal = lp;
  gl_Position = uVP * w;
}
`;

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
}
`;