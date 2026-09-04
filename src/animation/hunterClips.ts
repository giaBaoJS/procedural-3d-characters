/**
 * Clips for the armoured hunter.
 *
 * Sign conventions, derived from the rig rather than assumed: a limb hanging at (0,-1,0)
 * rotated about +X by theta lands at (0,-cos, -sin), so a NEGATIVE x-rotation swings a
 * limb FORWARD and a positive one swings it back. Knees bend backward, so shin x is
 * positive. Rotating about +Z moves a limb toward +X, so the left arm opens outward on a
 * negative z and the right arm on a positive z.
 *
 * Combat clips are additive: they are authored against the rest pose and then reduced to
 * deltas, so firing while running layers onto the run instead of overwriting the legs.
 */
import { AnimationClip, AnimationUtils, KeyframeTrack } from "three";
import { makeClipFactory, rot, vec, type RigRest, type RotKey } from "./kit";

const HIP_Y = 0.95;

const REST: RigRest = {
  hipHeight: HIP_Y,
  rootJoint: "hips",
  squashJoint: "spine",
  rot: {
    hips: [0, 0, 0],
    spine: [0, 0, 0],
    chest: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    shoulderL: [0, 0, -8],
    armL: [0, 0, 0],
    forearmL: [0, 0, 0],
    shoulderR: [0, 0, 8],
    armR: [0, 0, 0],
    forearmR: [0, 0, 0],
    thighL: [0, 0, 0],
    shinL: [0, 0, 0],
    footL: [0, 0, 0],
    thighR: [0, 0, 0],
    shinR: [0, 0, 0],
    footR: [0, 0, 0],
  },
};

const clip = makeClipFactory(REST);
const hipY = (keys: Array<[number, number]>) =>
  vec("hips.position", keys.map(([t, y]) => [t, 0, HIP_Y + y, 0] as [number, number, number, number]));
const squash = (keys: Array<[number, number, number, number]>) => vec("spine.scale", keys);

export interface HunterClip {
  clip: AnimationClip;
  loop: boolean;
  /** Additive clips layer on top of whatever locomotion is playing. */
  additive: boolean;
  /** Seconds at which the effect layer should fire something. */
  beats?: number[];
}

export function buildHunterClips(): Record<string, HunterClip> {
  const out: Record<string, HunterClip> = {};

  // ---- idle ---------------------------------------------------------------
  {
    const d = 3.2;
    out.idle = {
      loop: true, additive: false,
      clip: clip("idle", d, [
        hipY([[0, 0], [0.8, 0.012], [1.6, 0], [2.4, 0.012], [d, 0]]),
        rot("hips", [[0, 0, 0, 0], [1.6, 0, 3, 1], [d, 0, 0, 0]]),
        rot("chest", [[0, 0, 0, 0], [0.8, 1.5, -2, 0], [2.4, 1.5, 2, 0], [d, 0, 0, 0]]),
        rot("head", [[0, 0, 0, 0], [1.0, -2, -7, 0], [2.2, -1, 6, 0], [d, 0, 0, 0]]),
        rot("shoulderL", [[0, 0, 0, -8], [1.6, 0, 0, -10], [d, 0, 0, -8]]),
        rot("shoulderR", [[0, 0, 0, 8], [1.6, 0, 0, 10], [d, 0, 0, 8]]),
        rot("armR", [[0, -6, 0, 0], [1.6, -9, 0, 0], [d, -6, 0, 0]]),
        rot("forearmR", [[0, -8, 0, 0], [d, -8, 0, 0]]),
        rot("forearmL", [[0, -6, 0, 0], [1.6, -9, 0, 0], [d, -6, 0, 0]]),
      ]),
    };
  }

  // ---- walk ---------------------------------------------------------------
  {
    const d = 1.0;
    out.walk = {
      loop: true, additive: false,
      beats: [0.02, 0.52], // foot contacts
      clip: clip("walk", d, [
        hipY([[0, -0.012], [0.25, 0.016], [0.5, -0.012], [0.75, 0.016], [d, -0.012]]),
        rot("hips", [[0, 0, 5, 2], [0.25, 0, 0, 0], [0.5, 0, -5, -2], [0.75, 0, 0, 0], [d, 0, 5, 2]]),
        rot("chest", [[0, 0, -6, 0], [0.5, 0, 6, 0], [d, 0, -6, 0]]),
        rot("thighL", [[0, -30, 0, 0], [0.25, -2, 0, 0], [0.5, 25, 0, 0], [0.75, -16, 0, 0], [d, -30, 0, 0]]),
        rot("shinL", [[0, 12, 0, 0], [0.25, 22, 0, 0], [0.5, 8, 0, 0], [0.75, 58, 0, 0], [d, 12, 0, 0]]),
        rot("footL", [[0, 10, 0, 0], [0.25, 0, 0, 0], [0.5, -14, 0, 0], [0.75, 6, 0, 0], [d, 10, 0, 0]]),
        rot("thighR", [[0, 25, 0, 0], [0.25, -16, 0, 0], [0.5, -30, 0, 0], [0.75, -2, 0, 0], [d, 25, 0, 0]]),
        rot("shinR", [[0, 8, 0, 0], [0.25, 58, 0, 0], [0.5, 12, 0, 0], [0.75, 22, 0, 0], [d, 8, 0, 0]]),
        rot("footR", [[0, -14, 0, 0], [0.25, 6, 0, 0], [0.5, 10, 0, 0], [0.75, 0, 0, 0], [d, -14, 0, 0]]),
        rot("armL", [[0, 18, 0, 0], [0.25, 0, 0, 0], [0.5, -18, 0, 0], [0.75, 0, 0, 0], [d, 18, 0, 0]]),
        rot("armR", [[0, -16, 0, 0], [0.25, 0, 0, 0], [0.5, 16, 0, 0], [0.75, 0, 0, 0], [d, -16, 0, 0]]),
        rot("forearmL", [[0, -14, 0, 0], [d, -14, 0, 0]]),
        rot("forearmR", [[0, -12, 0, 0], [d, -12, 0, 0]]),
      ]),
    };
  }

  // ---- run ----------------------------------------------------------------
  {
    const d = 0.62;
    out.run = {
      loop: true, additive: false,
      beats: [0.02, 0.33],
      clip: clip("run", d, [
        hipY([[0, -0.03], [0.15, 0.03], [0.31, -0.03], [0.46, 0.03], [d, -0.03]]),
        rot("hips", [[0, -6, 8, 3], [0.31, -6, -8, -3], [d, -6, 8, 3]]),
        rot("chest", [[0, -14, -9, 0], [0.31, -14, 9, 0], [d, -14, -9, 0]]),
        rot("head", [[0, 16, 0, 0], [d, 16, 0, 0]]),
        rot("thighL", [[0, -46, 0, 0], [0.15, -6, 0, 0], [0.31, 30, 0, 0], [0.46, -26, 0, 0], [d, -46, 0, 0]]),
        rot("shinL", [[0, 26, 0, 0], [0.15, 16, 0, 0], [0.31, 18, 0, 0], [0.46, 88, 0, 0], [d, 26, 0, 0]]),
        rot("footL", [[0, 12, 0, 0], [0.31, -20, 0, 0], [d, 12, 0, 0]]),
        rot("thighR", [[0, 30, 0, 0], [0.15, -26, 0, 0], [0.31, -46, 0, 0], [0.46, -6, 0, 0], [d, 30, 0, 0]]),
        rot("shinR", [[0, 18, 0, 0], [0.15, 88, 0, 0], [0.31, 26, 0, 0], [0.46, 16, 0, 0], [d, 18, 0, 0]]),
        rot("footR", [[0, -20, 0, 0], [0.31, 12, 0, 0], [d, -20, 0, 0]]),
        rot("armL", [[0, 42, 0, -10], [0.31, -40, 0, -6], [d, 42, 0, -10]]),
        rot("armR", [[0, -38, 0, 10], [0.31, 40, 0, 6], [d, -38, 0, 10]]),
        rot("forearmL", [[0, -62, 0, 0], [0.31, -48, 0, 0], [d, -62, 0, 0]]),
        rot("forearmR", [[0, -50, 0, 0], [0.31, -64, 0, 0], [d, -50, 0, 0]]),
      ]),
    };
  }

  // ---- dash: a low boosted glide, legs split, arms swept back --------------
  {
    const d = 0.5;
    out.dash = {
      loop: true, additive: false,
      clip: clip("dash", d, [
        hipY([[0, -0.14], [0.25, -0.115], [d, -0.14]]),
        rot("hips", [[0, -12, 0, 0], [d, -12, 0, 0]]),
        rot("chest", [[0, -26, 0, 0], [0.25, -23, 0, 0], [d, -26, 0, 0]]),
        rot("head", [[0, 34, 0, 0], [d, 34, 0, 0]]),
        rot("thighL", [[0, -52, 0, 0], [0.25, -46, 0, 0], [d, -52, 0, 0]]),
        rot("shinL", [[0, 30, 0, 0], [0.25, 24, 0, 0], [d, 30, 0, 0]]),
        rot("footL", [[0, 16, 0, 0], [d, 16, 0, 0]]),
        rot("thighR", [[0, 26, 0, 0], [0.25, 32, 0, 0], [d, 26, 0, 0]]),
        rot("shinR", [[0, 46, 0, 0], [0.25, 40, 0, 0], [d, 46, 0, 0]]),
        rot("footR", [[0, -26, 0, 0], [d, -26, 0, 0]]),
        rot("armL", [[0, 46, 0, -16], [0.25, 42, 0, -16], [d, 46, 0, -16]]),
        rot("armR", [[0, 40, 0, 16], [0.25, 36, 0, 16], [d, 40, 0, 16]]),
        rot("forearmL", [[0, -34, 0, 0], [d, -34, 0, 0]]),
        rot("forearmR", [[0, -28, 0, 0], [d, -28, 0, 0]]),
      ]),
    };
  }

  // ---- airborne -----------------------------------------------------------
  {
    const d = 0.5;
    out.jump = {
      loop: false, additive: false,
      clip: clip("jump", d, [
        hipY([[0, -0.06], [0.18, 0.02], [d, 0.01]]),
        squash([[0, 1.06, 0.92, 1.06], [0.18, 0.96, 1.08, 0.96], [d, 1, 1, 1]]),
        rot("chest", [[0, -18, 0, 0], [0.25, -6, 0, 0], [d, -8, 0, 0]]),
        rot("thighL", [[0, -30, 0, 0], [0.25, -54, 0, 0], [d, -46, 0, 0]]),
        rot("shinL", [[0, 44, 0, 0], [0.25, 76, 0, 0], [d, 66, 0, 0]]),
        rot("thighR", [[0, -22, 0, 0], [0.25, -18, 0, 0], [d, -8, 0, 0]]),
        rot("shinR", [[0, 34, 0, 0], [0.25, 26, 0, 0], [d, 20, 0, 0]]),
        rot("armL", [[0, 30, 0, -18], [0.25, -34, 0, -28], [d, -26, 0, -26]]),
        rot("armR", [[0, 26, 0, 18], [0.25, -20, 0, 26], [d, -16, 0, 24]]),
        rot("forearmL", [[0, -40, 0, 0], [d, -54, 0, 0]]),
        rot("forearmR", [[0, -34, 0, 0], [d, -46, 0, 0]]),
      ]),
    };

    out.fall = {
      loop: true, additive: false,
      clip: clip("fall", 0.8, [
        hipY([[0, 0.01], [0.4, 0.0], [0.8, 0.01]]),
        rot("chest", [[0, -4, 0, 0], [0.4, -1, 0, 0], [0.8, -4, 0, 0]]),
        rot("thighL", [[0, -30, 0, 0], [0.4, -24, 0, 0], [0.8, -30, 0, 0]]),
        rot("shinL", [[0, 34, 0, 0], [0.4, 28, 0, 0], [0.8, 34, 0, 0]]),
        rot("thighR", [[0, -8, 0, 0], [0.4, -14, 0, 0], [0.8, -8, 0, 0]]),
        rot("shinR", [[0, 16, 0, 0], [0.4, 22, 0, 0], [0.8, 16, 0, 0]]),
        rot("armL", [[0, -30, 0, -30], [0.4, -24, 0, -26], [0.8, -30, 0, -30]]),
        rot("armR", [[0, -22, 0, 28], [0.4, -16, 0, 24], [0.8, -22, 0, 28]]),
        rot("forearmL", [[0, -50, 0, 0], [0.8, -50, 0, 0]]),
        rot("forearmR", [[0, -42, 0, 0], [0.8, -42, 0, 0]]),
      ]),
    };

    out.land = {
      loop: false, additive: false,
      beats: [0.0],
      clip: clip("land", 0.42, [
        hipY([[0, -0.05], [0.08, -0.19], [0.24, -0.05], [0.42, 0]]),
        squash([[0, 0.96, 1.08, 0.96], [0.08, 1.12, 0.86, 1.12], [0.24, 0.99, 1.02, 0.99], [0.42, 1, 1, 1]]),
        rot("chest", [[0, -6, 0, 0], [0.08, -24, 0, 0], [0.24, -8, 0, 0], [0.42, 0, 0, 0]]),
        rot("thighL", [[0, -26, 0, 0], [0.08, -44, 0, 0], [0.24, -14, 0, 0], [0.42, 0, 0, 0]]),
        rot("shinL", [[0, 30, 0, 0], [0.08, 66, 0, 0], [0.24, 22, 0, 0], [0.42, 0, 0, 0]]),
        rot("thighR", [[0, -14, 0, 0], [0.08, -40, 0, 0], [0.24, -12, 0, 0], [0.42, 0, 0, 0]]),
        rot("shinR", [[0, 20, 0, 0], [0.08, 62, 0, 0], [0.24, 20, 0, 0], [0.42, 0, 0, 0]]),
        rot("armL", [[0, -28, 0, -26], [0.08, 34, 0, -34], [0.24, 6, 0, -12], [0.42, 0, 0, -8]]),
        rot("armR", [[0, -20, 0, 24], [0.08, 30, 0, 30], [0.24, 4, 0, 12], [0.42, 0, 0, 8]]),
      ]),
    };
  }

  // ---- additive combat layers ---------------------------------------------
  const additive = (name: string, duration: number, tracks: KeyframeTrack[], beats?: number[], loop = false) => {
    const base = clip(name, duration, tracks);
    // Frame 0 is authored as the rest pose, so reducing against it leaves pure deltas.
    AnimationUtils.makeClipAdditive(base);
    return { clip: base, loop, additive: true, beats };
  };

  const aim: RotKey[] = [[0, 0, 0, 8], [0.07, -86, 0, 26], [0.13, -78, 0, 26], [0.3, -84, 0, 24], [0.42, 0, 0, 8]];
  out.shoot = additive("shoot", 0.42, [
    rot("armR", aim),
    rot("forearmR", [[0, 0, 0, 0], [0.07, -6, 0, 0], [0.13, 14, 0, 0], [0.3, -2, 0, 0], [0.42, 0, 0, 0]]),
    rot("chest", [[0, 0, 0, 0], [0.07, 2, -14, 0], [0.13, 4, -18, 0], [0.3, 1, -12, 0], [0.42, 0, 0, 0]]),
    rot("shoulderR", [[0, 0, 0, 8], [0.07, 0, -12, 12], [0.3, 0, -10, 12], [0.42, 0, 0, 8]]),
    rot("head", [[0, 0, 0, 0], [0.1, 0, -12, 0], [0.3, 0, -10, 0], [0.42, 0, 0, 0]]),
  ], [0.08]);

  out.charge = additive("charge", 1.0, [
    rot("armR", [[0, 0, 0, 8], [0.22, -80, 0, 24], [0.6, -83, 0, 24], [1.0, -80, 0, 24]]),
    rot("forearmR", [[0, 0, 0, 0], [0.22, -8, 0, 0], [0.6, -4, 0, 0], [1.0, -8, 0, 0]]),
    rot("chest", [[0, 0, 0, 0], [0.22, 3, -16, 0], [0.6, 5, -18, 0], [1.0, 3, -16, 0]]),
    rot("shoulderR", [[0, 0, 0, 8], [0.22, 0, -12, 12], [1.0, 0, -12, 12]]),
    rot("armL", [[0, 0, 0, 0], [0.22, -18, 0, -14], [1.0, -18, 0, -14]]),
    rot("head", [[0, 0, 0, 0], [0.22, 0, -12, 0], [1.0, 0, -12, 0]]),
  ], undefined, true);

  out.slash = additive("slash", 0.62, [
    rot("armL", [[0, 0, 0, -8], [0.1, -44, 0, -96], [0.24, -22, 0, 46], [0.4, -10, 0, 30], [0.62, 0, 0, -8]]),
    rot("forearmL", [[0, 0, 0, 0], [0.1, -40, 0, 0], [0.24, -14, 0, 0], [0.62, 0, 0, 0]]),
    rot("chest", [[0, 0, 0, 0], [0.1, 0, 26, 0], [0.24, 0, -22, 0], [0.4, 0, -12, 0], [0.62, 0, 0, 0]]),
    rot("hips", [[0, 0, 0, 0], [0.1, 0, 14, 0], [0.24, 0, -12, 0], [0.62, 0, 0, 0]]),
    rot("head", [[0, 0, 0, 0], [0.1, 0, 16, 0], [0.24, 0, -14, 0], [0.62, 0, 0, 0]]),
  ], [0.14]);

  return out;
}

export const HUNTER_CLIP_LABELS: Record<string, string> = {
  idle: "Idle", walk: "Walk", run: "Run", dash: "Dash",
  jump: "Jump", fall: "Fall", land: "Land",
  shoot: "Shoot", charge: "Charge", slash: "Sabre",
};
