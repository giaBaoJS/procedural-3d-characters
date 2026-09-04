/**
 * Every clip is authored here as keyframes and compiled into real THREE.AnimationClip
 * objects, so the mixer handles blending and crossfades rather than the render loop.
 *
 * Each clip is padded to the full joint set before it is returned. A clip that only
 * cares about the arms still emits rest tracks for the legs and tail, otherwise
 * crossfading into it would leave whatever the previous clip left behind.
 */
import {
  AnimationClip,
  Euler,
  InterpolateSmooth,
  KeyframeTrack,
  Quaternion,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from "three";

const d2r = (deg: number) => (deg * Math.PI) / 180;

/** Rest pose in degrees, matching the base rotations baked into the rig. */
const REST_ROT: Record<string, [number, number, number]> = {
  hips: [0, 0, 0],
  spine: [0, 0, 0],
  chest: [0, 0, 0],
  neck: [0, 0, 0],
  head: [0, 0, 0],
  earL: [0, 0, 12.6],
  earR: [0, 0, -12.6],
  armL: [0, 0, 25],
  armR: [0, 0, -25],
  forearmL: [0, 0, 0],
  forearmR: [0, 0, 0],
  legL: [0, 0, 0],
  legR: [0, 0, 0],
  tail1: [0, 0, 0],
  tail2: [0, 0, 0],
  tail3: [0, 0, 0],
};

const HIP_Y = 0.34;
const JOINTS = Object.keys(REST_ROT);

type RotKey = [t: number, x: number, y: number, z: number];
type VecKey = [t: number, x: number, y: number, z: number];

function rot(node: string, keys: RotKey[]): QuaternionKeyframeTrack {
  const times: number[] = [];
  const values: number[] = [];
  const euler = new Euler();
  const quat = new Quaternion();
  for (const [t, x, y, z] of keys) {
    times.push(t);
    euler.set(d2r(x), d2r(y), d2r(z));
    quat.setFromEuler(euler);
    values.push(quat.x, quat.y, quat.z, quat.w);
  }
  return new QuaternionKeyframeTrack(`${node}.quaternion`, times, values);
}

function vec(path: string, keys: VecKey[], smooth = true): VectorKeyframeTrack {
  const times = keys.map((k) => k[0]);
  const values = keys.flatMap(([, x, y, z]) => [x, y, z]);
  const track = new VectorKeyframeTrack(path, times, values);
  if (smooth) track.setInterpolation(InterpolateSmooth);
  return track;
}

/** Hip height is absolute in the track, so offsets are added to the rig's rest height. */
const hipY = (keys: VecKey[]): VectorKeyframeTrack =>
  vec("hips.position", keys.map(([t, x, y, z]) => [t, x, HIP_Y + y, z] as VecKey));

/** Squash and stretch on the torso. Cuteness lives almost entirely in this curve. */
const squash = (keys: VecKey[]) => vec("spine.scale", keys);

const blink = (at: number[], duration: number): KeyframeTrack[] => {
  const times: number[] = [0];
  const shut: number[] = [1, 1, 1];
  for (const t of at) {
    times.push(t - 0.06, t, t + 0.08);
    shut.push(1, 1, 1, /* lid shut: squash Y, not X */ 1, 0.08, 1, 1, 1, 1);
  }
  times.push(duration);
  shut.push(1, 1, 1);
  return [
    vec("eyeL.scale", times.map((t, i) => [t, shut[i * 3], shut[i * 3 + 1], shut[i * 3 + 2]] as VecKey), false),
    vec("eyeR.scale", times.map((t, i) => [t, shut[i * 3], shut[i * 3 + 1], shut[i * 3 + 2]] as VecKey), false),
  ];
};

/** Fill in rest tracks for any joint the clip left untouched, then compile. */
function clip(name: string, duration: number, tracks: KeyframeTrack[]): AnimationClip {
  const named = new Set(tracks.map((t) => t.name));
  const padded = [...tracks];
  for (const joint of JOINTS) {
    if (!named.has(`${joint}.quaternion`)) {
      const [x, y, z] = REST_ROT[joint];
      padded.push(rot(joint, [[0, x, y, z], [duration, x, y, z]]));
    }
  }
  if (!named.has("hips.position")) padded.push(hipY([[0, 0, 0, 0], [duration, 0, 0, 0]]));
  if (!named.has("spine.scale")) padded.push(squash([[0, 1, 1, 1], [duration, 1, 1, 1]]));
  if (!named.has("eyeL.scale")) padded.push(...blink([], duration));
  return new AnimationClip(name, duration, padded);
}

export interface ClipDef {
  clip: AnimationClip;
  loop: boolean;
  /** Times, in seconds, where the effect layer should fire a burst. */
  beats?: number[];
}

export function buildClips(): Record<string, ClipDef> {
  const defs: Record<string, ClipDef> = {};

  // --- Idle: slow breath, an ear flick, a lazy tail, two blinks ------------
  {
    const d = 3.6;
    defs.idle = {
      loop: true,
      clip: clip("idle", d, [
        hipY([[0, 0, 0, 0], [0.9, 0, 0.012, 0], [1.8, 0, 0, 0], [2.7, 0, 0.012, 0], [d, 0, 0, 0]]),
        squash([[0, 1, 1, 1], [0.9, 1.012, 0.985, 1.012], [1.8, 1, 1, 1], [2.7, 1.012, 0.985, 1.012], [d, 1, 1, 1]]),
        rot("chest", [[0, 0, 0, 0], [1.8, 0, 2.5, 0], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [1.2, -3, -5, 1.5], [2.4, 2, 4, -1.5], [d, 0, 0, 0]]),
        rot("earL", [[0, 0, 0, 12.6], [1.5, 0, 0, 12.6], [1.62, -6, 0, 26], [1.78, 0, 0, 12.6], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [2.2, 0, 0, -12.6], [2.32, -6, 0, -26], [2.48, 0, 0, -12.6], [d, 0, 0, -12.6]]),
        rot("tail1", [[0, 0, 0, 0], [0.9, 0, 16, 6], [1.8, 0, 0, 0], [2.7, 0, -16, -6], [d, 0, 0, 0]]),
        rot("tail2", [[0, 0, 0, 0], [1.1, 0, 18, 0], [2.0, 0, 0, 0], [2.9, 0, -18, 0], [d, 0, 0, 0]]),
        rot("tail3", [[0, 0, 0, 0], [1.3, 0, 20, 0], [2.2, 0, 0, 0], [3.1, 0, -20, 0], [d, 0, 0, 0]]),
        rot("armL", [[0, 0, 0, 25], [1.8, 0, 0, 28], [d, 0, 0, 25]]),
        rot("armR", [[0, 0, 0, -25], [1.8, 0, 0, -28], [d, 0, 0, -25]]),
        ...blink([1.1, 2.9], d),
      ]),
    };
  }

  // --- Bounce: anticipation, launch, airborne stretch, landing squash -----
  {
    const d = 1.0;
    defs.bounce = {
      loop: true,
      beats: [0.62],
      clip: clip("bounce", d, [
        hipY([[0, 0, 0, 0], [0.16, 0, -0.06, 0], [0.34, 0, 0.26, 0], [0.5, 0, 0.3, 0], [0.62, 0, 0, 0], [0.72, 0, -0.05, 0], [d, 0, 0, 0]]),
        squash([[0, 1, 1, 1], [0.16, 1.16, 0.8, 1.16], [0.34, 0.9, 1.2, 0.9], [0.5, 0.95, 1.1, 0.95], [0.62, 1.18, 0.78, 1.18], [0.78, 0.98, 1.03, 0.98], [d, 1, 1, 1]]),
        rot("armL", [[0, 0, 0, 25], [0.16, 0, 0, 55], [0.4, 0, 0, -95], [0.62, 0, 0, 40], [d, 0, 0, 25]]),
        rot("armR", [[0, 0, 0, -25], [0.16, 0, 0, -55], [0.4, 0, 0, 95], [0.62, 0, 0, -40], [d, 0, 0, -25]]),
        rot("earL", [[0, 0, 0, 12.6], [0.2, -22, 0, 20], [0.42, 16, 0, 6], [0.66, -12, 0, 18], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [0.2, -22, 0, -20], [0.42, 16, 0, -6], [0.66, -12, 0, -18], [d, 0, 0, -12.6]]),
        rot("legL", [[0, 0, 0, 0], [0.16, 26, 0, 0], [0.4, -20, 0, 0], [0.62, 22, 0, 0], [d, 0, 0, 0]]),
        rot("legR", [[0, 0, 0, 0], [0.16, 26, 0, 0], [0.4, -20, 0, 0], [0.62, 22, 0, 0], [d, 0, 0, 0]]),
        rot("tail1", [[0, 0, 0, 0], [0.2, -26, 0, 0], [0.45, 24, 0, 0], [0.7, -14, 0, 0], [d, 0, 0, 0]]),
        rot("tail2", [[0, 0, 0, 0], [0.28, -22, 0, 0], [0.52, 22, 0, 0], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [0.16, 10, 0, 0], [0.4, -8, 0, 0], [0.62, 9, 0, 0], [d, 0, 0, 0]]),
      ]),
    };
  }

  // --- Wave -----------------------------------------------------------------
  {
    const d = 2.4;
    defs.wave = {
      loop: true,
      clip: clip("wave", d, [
        rot("armR", [[0, 0, 0, -25], [0.4, 0, 0, 88], [0.8, 0, 0, 88], [2.0, 0, 0, 88], [d, 0, 0, -25]]),
        rot("forearmR", [[0, 0, 0, 0], [0.4, 0, 0, 0], [0.75, 0, 0, 34], [1.1, 0, 0, -22], [1.45, 0, 0, 34], [1.8, 0, 0, -22], [2.1, 0, 0, 6], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [0.5, -6, 12, 6], [1.9, -6, 12, 6], [d, 0, 0, 0]]),
        rot("chest", [[0, 0, 0, 0], [0.5, 0, 10, 0], [1.9, 0, 10, 0], [d, 0, 0, 0]]),
        rot("earR", [[0, 0, 0, -12.6], [0.5, -14, 0, -22], [1.9, -14, 0, -22], [d, 0, 0, -12.6]]),
        rot("tail1", [[0, 0, 0, 0], [0.6, 0, 22, 0], [1.3, 0, -18, 0], [2.0, 0, 20, 0], [d, 0, 0, 0]]),
        hipY([[0, 0, 0, 0], [0.6, 0, 0.014, 0], [1.3, 0, 0, 0], [2.0, 0, 0.014, 0], [d, 0, 0, 0]]),
        ...blink([1.5], d),
      ]),
    };
  }

  // --- Spin: a full joyful twirl -------------------------------------------
  {
    const d = 1.5;
    defs.spin = {
      loop: true,
      beats: [0.1],
      clip: clip("spin", d, [
        rot("hips", [[0, 0, 0, 0], [0.15, 0, -30, 0], [1.25, 0, 330, 0], [d, 0, 360, 0]]),
        hipY([[0, 0, 0, 0], [0.15, 0, -0.05, 0], [0.6, 0, 0.1, 0], [1.1, 0, 0.1, 0], [1.35, 0, 0, 0], [d, 0, 0, 0]]),
        squash([[0, 1, 1, 1], [0.15, 1.14, 0.84, 1.14], [0.5, 0.94, 1.12, 0.94], [1.35, 1.1, 0.88, 1.1], [d, 1, 1, 1]]),
        rot("armL", [[0, 0, 0, 25], [0.3, 0, 0, -35], [1.15, 0, 0, -35], [d, 0, 0, 25]]),
        rot("armR", [[0, 0, 0, -25], [0.3, 0, 0, 35], [1.15, 0, 0, 35], [d, 0, 0, -25]]),
        rot("earL", [[0, 0, 0, 12.6], [0.4, -26, 0, 30], [1.1, -26, 0, 30], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [0.4, -26, 0, -30], [1.1, -26, 0, -30], [d, 0, 0, -12.6]]),
        rot("tail1", [[0, 0, 0, 0], [0.4, 0, 34, 10], [1.0, 0, -34, -10], [d, 0, 0, 0]]),
        rot("tail2", [[0, 0, 0, 0], [0.5, 0, 30, 0], [1.1, 0, -30, 0], [d, 0, 0, 0]]),
      ]),
    };
  }

  // --- Cheer: both arms up, two little hops --------------------------------
  {
    const d = 1.8;
    defs.cheer = {
      loop: true,
      beats: [0.35, 1.05],
      clip: clip("cheer", d, [
        hipY([[0, 0, 0, 0], [0.12, 0, -0.05, 0], [0.35, 0, 0.2, 0], [0.6, 0, 0, 0], [0.82, 0, -0.04, 0], [1.05, 0, 0.18, 0], [1.3, 0, 0, 0], [d, 0, 0, 0]]),
        squash([[0, 1, 1, 1], [0.12, 1.14, 0.84, 1.14], [0.35, 0.92, 1.14, 0.92], [0.6, 1.1, 0.9, 1.1], [0.82, 1.12, 0.86, 1.12], [1.05, 0.93, 1.13, 0.93], [1.3, 1.08, 0.93, 1.08], [d, 1, 1, 1]]),
        rot("armL", [[0, 0, 0, 25], [0.25, 0, 0, -88], [1.5, 0, 0, -88], [d, 0, 0, 25]]),
        rot("armR", [[0, 0, 0, -25], [0.25, 0, 0, 88], [1.5, 0, 0, 88], [d, 0, 0, -25]]),
        rot("forearmL", [[0, 0, 0, 0], [0.45, 0, 0, -20], [0.9, 0, 0, 14], [1.35, 0, 0, -20], [d, 0, 0, 0]]),
        rot("forearmR", [[0, 0, 0, 0], [0.45, 0, 0, 20], [0.9, 0, 0, -14], [1.35, 0, 0, 20], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [0.35, -14, 0, 0], [0.7, -4, 0, 0], [1.05, -14, 0, 0], [d, 0, 0, 0]]),
        rot("earL", [[0, 0, 0, 12.6], [0.4, -30, 0, 24], [0.75, -8, 0, 14], [1.1, -30, 0, 24], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [0.4, -30, 0, -24], [0.75, -8, 0, -14], [1.1, -30, 0, -24], [d, 0, 0, -12.6]]),
        rot("tail1", [[0, 0, 0, 0], [0.35, -30, 0, 0], [0.8, 10, 0, 0], [1.15, -30, 0, 0], [d, 0, 0, 0]]),
      ]),
    };
  }

  // --- Dance ---------------------------------------------------------------
  {
    const d = 2.4;
    const sway = (s: number): RotKey[] => [
      [0, 0, 0, 0], [0.3, 0, 0, s], [0.9, 0, 0, -s], [1.5, 0, 0, s], [2.1, 0, 0, -s], [d, 0, 0, 0],
    ];
    defs.dance = {
      loop: true,
      beats: [0.3, 0.9, 1.5, 2.1],
      clip: clip("dance", d, [
        rot("hips", sway(9)),
        rot("chest", [[0, 0, 0, 0], [0.3, 0, 14, -5], [0.9, 0, -14, 5], [1.5, 0, 14, -5], [2.1, 0, -14, 5], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [0.3, 6, -10, 8], [0.9, 6, 10, -8], [1.5, 6, -10, 8], [2.1, 6, 10, -8], [d, 0, 0, 0]]),
        hipY([[0, 0, 0, 0], [0.3, 0, 0.05, 0], [0.6, 0, 0, 0], [0.9, 0, 0.05, 0], [1.2, 0, 0, 0], [1.5, 0, 0.05, 0], [1.8, 0, 0, 0], [2.1, 0, 0.05, 0], [d, 0, 0, 0]]),
        squash([[0, 1, 1, 1], [0.3, 0.96, 1.06, 0.96], [0.6, 1.06, 0.94, 1.06], [0.9, 0.96, 1.06, 0.96], [1.2, 1.06, 0.94, 1.06], [1.5, 0.96, 1.06, 0.96], [1.8, 1.06, 0.94, 1.06], [2.1, 0.96, 1.06, 0.96], [d, 1, 1, 1]]),
        rot("armL", [[0, 0, 0, 25], [0.3, 0, 0, -85], [0.9, 0, 0, 45], [1.5, 0, 0, -85], [2.1, 0, 0, 45], [d, 0, 0, 25]]),
        rot("armR", [[0, 0, 0, -25], [0.3, 0, 0, -45], [0.9, 0, 0, 85], [1.5, 0, 0, -45], [2.1, 0, 0, 85], [d, 0, 0, -25]]),
        rot("earL", [[0, 0, 0, 12.6], [0.3, -20, 0, 26], [0.9, 8, 0, 6], [1.5, -20, 0, 26], [2.1, 8, 0, 6], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [0.3, 8, 0, -6], [0.9, -20, 0, -26], [1.5, 8, 0, -6], [2.1, -20, 0, -26], [d, 0, 0, -12.6]]),
        rot("tail1", sway(-22)),
        rot("tail2", sway(-20)),
        rot("tail3", sway(-18)),
      ]),
    };
  }

  // --- Sleep: curled, very slow breath -------------------------------------
  {
    const d = 6.0;
    defs.sleep = {
      loop: true,
      beats: [0, 2.0, 4.0],
      clip: clip("sleep", d, [
        hipY([[0, 0, -0.115, 0], [3.0, 0, -0.1, 0], [d, 0, -0.115, 0]]),
        squash([[0, 1.09, 0.93, 1.06], [3.0, 1.13, 0.97, 1.1], [d, 1.09, 0.93, 1.06]]),
        rot("hips", [[0, 0, 22, 0], [d, 0, 22, 0]]),
        rot("chest", [[0, 9, 0, 0], [d, 9, 0, 0]]),
        rot("head", [[0, 14, -18, -13], [3.0, 12, -18, -15], [d, 14, -18, -13]]),
        rot("earL", [[0, 30, 0, 34], [d, 30, 0, 34]]),
        rot("earR", [[0, 26, 0, -30], [d, 26, 0, -30]]),
        rot("armL", [[0, 0, 0, 80], [d, 0, 0, 80]]),
        rot("armR", [[0, 0, 0, -80], [d, 0, 0, -80]]),
        rot("legL", [[0, 46, 0, 0], [d, 46, 0, 0]]),
        rot("legR", [[0, 46, 0, 0], [d, 46, 0, 0]]),
        rot("tail1", [[0, 0, 44, 0], [2.5, 0, 52, 0], [d, 0, 44, 0]]),
        rot("tail2", [[0, 0, 40, 0], [2.5, 0, 46, 0], [d, 0, 40, 0]]),
        rot("tail3", [[0, 0, 36, 0], [2.5, 0, 42, 0], [d, 0, 36, 0]]),
        vec("eyeL.scale", [[0, 1, 0.08, 1], [d, 1, 0.08, 1]], false),
        vec("eyeR.scale", [[0, 1, 0.08, 1], [d, 1, 0.08, 1]], false),
      ]),
    };
  }

  // --- Look around ----------------------------------------------------------
  {
    const d = 4.0;
    defs.look = {
      loop: true,
      clip: clip("look", d, [
        rot("head", [[0, 0, 0, 0], [0.7, -4, -38, 4], [1.6, -4, -38, 4], [2.4, -2, 40, -4], [3.3, -2, 40, -4], [d, 0, 0, 0]]),
        rot("neck", [[0, 0, 0, 0], [0.7, 0, -12, 0], [2.4, 0, 12, 0], [d, 0, 0, 0]]),
        rot("chest", [[0, 0, 0, 0], [0.7, 0, -8, 0], [2.4, 0, 9, 0], [d, 0, 0, 0]]),
        rot("earL", [[0, 0, 0, 12.6], [0.7, -16, 0, 22], [2.4, 6, 0, 8], [d, 0, 0, 12.6]]),
        rot("earR", [[0, 0, 0, -12.6], [0.7, 6, 0, -8], [2.4, -16, 0, -22], [d, 0, 0, -12.6]]),
        rot("tail1", [[0, 0, 0, 0], [1.0, 0, 14, 0], [2.0, 0, -14, 0], [3.0, 0, 14, 0], [d, 0, 0, 0]]),
        hipY([[0, 0, 0, 0], [2.0, 0, 0.01, 0], [d, 0, 0, 0]]),
        ...blink([0.5, 2.1, 3.6], d),
      ]),
    };
  }

  // --- Shake: a quick shiver, ears and tail lagging behind ------------------
  {
    const d = 1.1;
    const shiver = (amp: number, phase = 0): RotKey[] =>
      Array.from({ length: 11 }, (_, i) => {
        const t = (i / 10) * d;
        const decay = 1 - i / 12;
        return [t, 0, Math.sin(i * 1.9 + phase) * amp * decay, 0] as RotKey;
      });
    defs.shake = {
      loop: true,
      beats: [0.15],
      clip: clip("shake", d, [
        rot("hips", shiver(13)),
        rot("chest", shiver(17, 0.7)),
        rot("head", shiver(24, 1.4)),
        rot("earL", shiver(30, 2.1).map(([t, , y]) => [t, y * 0.7, 0, 12.6 + y] as RotKey)),
        rot("earR", shiver(30, 2.1).map(([t, , y]) => [t, y * 0.7, 0, -12.6 + y] as RotKey)),
        rot("tail1", shiver(30, 2.6)),
        rot("tail2", shiver(28, 3.1)),
        rot("tail3", shiver(26, 3.6)),
        squash([[0, 1, 1, 1], [0.15, 1.1, 0.92, 1.06], [0.5, 0.97, 1.04, 0.98], [d, 1, 1, 1]]),
      ]),
    };
  }

  return defs;
}

export const CLIP_LABELS: Record<string, string> = {
  idle: "Idle",
  bounce: "Bounce",
  wave: "Wave",
  spin: "Spin",
  cheer: "Cheer",
  dance: "Dance",
  look: "Look Around",
  shake: "Shake",
  sleep: "Sleep",
};
