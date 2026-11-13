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
}
`;

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
}
`;