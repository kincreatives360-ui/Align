// Common GLSL functions used by all shaders
export const COMMON = `
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

export const VS_FULL = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0., 1.); }
`;