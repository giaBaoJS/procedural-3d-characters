/**
 * Shared keyframe authoring helpers.
 *
 * Clips are written as degree keyframes and compiled to real THREE tracks. Every clip is
 * padded to the rig's full joint set before it is returned: a clip that only moves the
 * arms still emits rest tracks for the legs, otherwise crossfading into it would leave
 * the previous clip's leg pose stuck in place.
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

export const d2r = (deg: number) => (deg * Math.PI) / 180;

export type RotKey = [t: number, x: number, y: number, z: number];
export type VecKey = [t: number, x: number, y: number, z: number];

export function rot(node: string, keys: RotKey[]): QuaternionKeyframeTrack {
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

export function vec(path: string, keys: VecKey[], smooth = true): VectorKeyframeTrack {
  const track = new VectorKeyframeTrack(
    path,
    keys.map((k) => k[0]),
    keys.flatMap(([, x, y, z]) => [x, y, z])
  );
  if (smooth) track.setInterpolation(InterpolateSmooth);
  return track;
}

export interface RigRest {
  /** Rest rotation per joint, in degrees. */
  rot: Record<string, [number, number, number]>;
  /** Absolute rest position of the root joint's position track. */
  hipHeight: number;
  /** Name of the joint carrying the root position track. */
  rootJoint: string;
  /** Joint whose scale carries squash and stretch, if the rig uses one. */
  squashJoint?: string;
}

export function makeClipFactory(rest: RigRest) {
  const joints = Object.keys(rest.rot);
  return function clip(name: string, duration: number, tracks: KeyframeTrack[]): AnimationClip {
    const named = new Set(tracks.map((t) => t.name));
    const padded = [...tracks];
    for (const joint of joints) {
      if (named.has(`${joint}.quaternion`)) continue;
      const [x, y, z] = rest.rot[joint];
      padded.push(rot(joint, [[0, x, y, z], [duration, x, y, z]]));
    }
    const posPath = `${rest.rootJoint}.position`;
    if (!named.has(posPath)) {
      padded.push(vec(posPath, [[0, 0, rest.hipHeight, 0], [duration, 0, rest.hipHeight, 0]]));
    }
    if (rest.squashJoint && !named.has(`${rest.squashJoint}.scale`)) {
      padded.push(vec(`${rest.squashJoint}.scale`, [[0, 1, 1, 1], [duration, 1, 1, 1]]));
    }
    return new AnimationClip(name, duration, padded);
  };
}
