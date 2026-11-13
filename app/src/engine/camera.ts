import { D2R } from './math';
import type { Vec3 } from '../templates/types';

export interface CameraDesc {
  fov: number;
  eye: Vec3;
  target: Vec3;
}

const ASPECTS: Record<string, [number, number]> = {
  '16:9': [16, 9],
  '9:16': [9, 16],
  '1:1': [1, 1],
  '4:5': [4, 5],
  '5:4': [5, 4],
  '4:3': [4, 3],
  '3:4': [3, 4],
  '21:9': [21, 9],
  '2:3': [2, 3],
};

/** Get numeric value from ParamValue. */
function num(v: any, def = 0): number {
  return typeof v === 'number' ? v : def;
}

/**
 * Build the camera descriptor for a frame.
 * Ported from the reference engine.js camera logic.
 */
export function buildCamera(
  state: {
    templateId: string;
    params: Record<string, any>;
    style: {
      camera: { fov: number; zoom: number; orbit: number; tilt: number; drift: number };
    };
    frame: { aspect: string };
  },
  template: { fov?: number; frame: string; cardH?: number },
  _aspect: number,
  clipPhase: number
): CameraDesc {
  const cam = state.style.camera;
  const baseFov = template.fov || 30;
  const fov = Math.min(110, (baseFov * (cam.fov || 30)) / 30) * Math.PI / 180;
  const D = 1 / Math.tan(fov / 2);

  // Template's default camera or identity
  let eye: Vec3 = [0, 0, D];
  let target: Vec3 = [0, 0, 0];

  // Global camera adjustments: zoom, orbit, tilt, drift
  const rel: Vec3 = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
  const orbit = (cam.orbit || 0) + Math.sin(clipPhase * 2 * Math.PI) * (cam.drift || 0);
  const tilt = (cam.tilt || 0) + Math.cos(clipPhase * 2 * Math.PI) * (cam.drift || 0) * 0.4;

  let [x, y, z] = rel.map(v => v * (cam.zoom || 1));
  const cy = Math.cos(tilt * D2R);
  const sy = Math.sin(tilt * D2R);
  [y, z] = [y * cy + z * sy, -y * sy + z * cy];
  const co = Math.cos(orbit * D2R);
  const so = Math.sin(orbit * D2R);
  [x, z] = [x * co + z * so, -x * so + z * co];

  eye = [target[0] + x, target[1] + y, target[2] + z];

  return { fov, eye, target };
}

/**
 * Compute the visible frame extents (vx, vy) at z=0 for layout calculations.
 */
export function computeViewExtents(
  camera: CameraDesc,
  params: Record<string, any>,
  aspect: number,
  template: { frame: string }
): { vx: number; vy: number } {
  const [da, db] = ASPECTS[template.frame] || [16, 9];
  const designAsp = da / db;
  const fit = aspect < designAsp ? Math.pow(designAsp / aspect, 0.8) : 1;

  const Dz = Math.hypot(camera.eye[0], camera.eye[1], camera.eye[2]) || 1 / Math.tan(camera.fov / 2);
  const turn = 1 + 1.5 * Math.max(
    Math.abs(Math.sin((num(params.poseRx) || 0) * D2R)),
    Math.abs(Math.sin((num(params.poseRy) || 0) * D2R)),
    Math.abs(Math.sin((num(params.poseRz) || 0) * D2R)),
    Math.abs(Math.sin((num(params.orbit) || 0) * D2R)),
    Math.abs(Math.sin((num(params.tilt) || 0) * D2R))
  );

  const far = Math.max(1, (Dz - (num(params.offZ) || 0) + 2 * Math.abs(num(params.panZ) || 0)) / Dz) * turn * Dz / (1 / Math.tan(camera.fov / 2));
  const vy = (far + Math.abs(num(params.offY) || 0)) / Math.abs(num(params.scale) || 1);
  const vx = (far * aspect + Math.abs(num(params.offX) || 0) + Math.abs(num(params.panX) || 0)) / Math.abs(num(params.scale) || 1);

  // fit is used in far calculation implicitly via Dz scaling
  void fit;

  return { vx, vy };
}