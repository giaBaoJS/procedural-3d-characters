/**
 * Keyboard-driven locomotion and the animation state machine that follows from it.
 *
 * Movement is camera-relative: the character walks away from the viewer on W regardless
 * of how the orbit camera has been swung around. Locomotion clips drive the whole body
 * and crossfade between each other; combat clips are additive and layer on top, so
 * firing while running does not overwrite the legs.
 */
import {
  AdditiveAnimationBlendMode,
  AnimationAction,
  AnimationMixer,
  LoopOnce,
  LoopRepeat,
  Object3D,
  Vector3,
} from "three";
import type { HunterClip } from "../animation/hunterClips";
import type { HunterFx } from "../vfx/hunterFx";

const WALK_SPEED = 1.7;
const RUN_SPEED = 4.0;
const DASH_SPEED = 9.0;
const ACCEL = 14;
const FRICTION = 11;
const GRAVITY = 15.5;
const JUMP_VELOCITY = 5.6;
const DASH_TIME = 0.34;
const DASH_COOLDOWN = 0.16;
const CHARGE_TIME = 1.15;

export type LocoState = "idle" | "walk" | "run" | "dash" | "jump" | "fall" | "land";

export class Locomotion {
  readonly velocity = new Vector3();
  readonly facing = new Vector3(0, 0, 1);
  state: LocoState = "idle";
  grounded = true;
  charge = 0;

  private readonly root: Object3D;
  private readonly mixer: AnimationMixer;
  private readonly clips: Record<string, HunterClip>;
  private readonly fx: HunterFx;
  private readonly footL: Object3D;
  private readonly footR: Object3D;

  private readonly actions = new Map<string, AnimationAction>();
  private base: AnimationAction;
  private baseKey = "idle";
  private overlay: AnimationAction | null = null;

  private readonly keys = new Set<string>();
  private dashTimer = 0;
  private dashCooldown = 0;
  private landTimer = 0;
  private charging = false;
  private slashTimer = 0;
  private lastBeatTime = 0;

  private readonly move = new Vector3();
  private readonly camForward = new Vector3();
  private readonly camRight = new Vector3();
  private readonly scratch = new Vector3();

  constructor(opts: {
    root: Object3D;
    mixer: AnimationMixer;
    clips: Record<string, HunterClip>;
    fx: HunterFx;
    footL: Object3D;
    footR: Object3D;
  }) {
    this.root = opts.root;
    this.mixer = opts.mixer;
    this.clips = opts.clips;
    this.fx = opts.fx;
    this.footL = opts.footL;
    this.footR = opts.footR;

    for (const [name, def] of Object.entries(this.clips)) {
      const action = this.mixer.clipAction(def.clip);
      action.setLoop(def.loop ? LoopRepeat : LoopOnce, Infinity);
      if (def.additive) {
        action.blendMode = AdditiveAnimationBlendMode;
        action.setEffectiveWeight(0);
      }
      if (!def.loop) action.clampWhenFinished = true;
      this.actions.set(name, action);
    }

    this.base = this.actions.get("idle")!;
    this.base.play();
    this.bindInput();
  }

  private bindInput() {
    addEventListener("keydown", (e) => {
      // Space and the arrows scroll the page otherwise
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.onPress(k);
      this.keys.add(k);
    });
    addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === "j") this.release();
    });
    addEventListener("blur", () => this.keys.clear());
  }

  private onPress(k: string) {
    if (k === " ") this.jump();
    if (k === "l") this.startDash();
    if (k === "j") this.charging = true;
    if (k === "k") this.slash();
  }

  private held(...names: string[]) {
    return names.some((n) => this.keys.has(n));
  }

  private playOverlay(name: string) {
    const action = this.actions.get(name);
    if (!action) return;
    if (this.overlay && this.overlay !== action) this.overlay.stop();
    action.reset().setEffectiveWeight(1).play();
    this.overlay = action;
  }

  jump() {
    if (!this.grounded) return;
    this.velocity.y = JUMP_VELOCITY;
    this.grounded = false;
    this.fx.thrusterKick(1.2);
    this.setBase("jump", 0.06);
  }

  startDash() {
    if (this.dashCooldown > 0) return;
    this.dashTimer = DASH_TIME;
    this.dashCooldown = DASH_TIME + DASH_COOLDOWN;
    this.fx.ring(this.groundPoint(), 0.9, 0.4);
  }

  slash() {
    this.slashTimer = 0.62;
    this.fx.sabre(true);
    this.playOverlay("slash");
  }

  private release() {
    if (!this.charging) return;
    this.charging = false;
    const charged = this.charge >= 0.92;
    this.scratch.copy(this.facing).setY(0.06).normalize();
    this.fx.fire(this.scratch, charged);
    this.charge = 0;
    this.fx.setCharge(0, 0);
    this.playOverlay("shoot");
  }

  private groundPoint() {
    return this.scratch.set(this.root.position.x, 0.04, this.root.position.z).clone();
  }

  private setBase(key: string, fade = 0.16) {
    if (key === this.baseKey) return;
    const next = this.actions.get(key);
    if (!next) return;
    next.reset().setEffectiveWeight(1).play();
    this.base.crossFadeTo(next, fade, false);
    this.base = next;
    this.baseKey = key;
    this.lastBeatTime = 0;
  }

  /** Foot-contact beats in the walk and run clips kick up dust under the right foot. */
  private fireBeats(worldFoot: Vector3) {
    const def = this.clips[this.baseKey];
    if (!def?.beats?.length) return;
    const now = this.base.time;
    const prev = this.lastBeatTime;
    this.lastBeatTime = now;
    for (let i = 0; i < def.beats.length; i++) {
      const beat = def.beats[i];
      const crossed = prev <= now ? beat > prev && beat <= now : beat > prev || beat <= now;
      if (!crossed) continue;
      (i % 2 === 0 ? this.footL : this.footR).getWorldPosition(worldFoot);
      worldFoot.y = 0.03;
      this.fx.footPuff(worldFoot);
    }
  }

  update(dt: number, cameraPosition: Vector3) {
    // camera-relative input basis, flattened onto the ground plane
    this.camForward.subVectors(this.root.position, cameraPosition).setY(0);
    if (this.camForward.lengthSq() < 1e-6) this.camForward.set(0, 0, 1);
    this.camForward.normalize();
    this.camRight.set(this.camForward.z, 0, -this.camForward.x);

    this.move.set(0, 0, 0);
    if (this.held("w", "arrowup")) this.move.add(this.camForward);
    if (this.held("s", "arrowdown")) this.move.sub(this.camForward);
    if (this.held("d", "arrowright")) this.move.sub(this.camRight);
    if (this.held("a", "arrowleft")) this.move.add(this.camRight);
    const moving = this.move.lengthSq() > 1e-6;
    if (moving) this.move.normalize();

    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    const dashing = this.dashTimer > 0;
    if (dashing) {
      this.dashTimer -= dt;
      // a dash with no stick input drives straight ahead
      const dir = moving ? this.move : this.facing;
      this.velocity.x = dir.x * DASH_SPEED;
      this.velocity.z = dir.z * DASH_SPEED;
      this.fx.dashJets(dt, this.facing);
    } else {
      const target = this.held("shift") ? RUN_SPEED : WALK_SPEED;
      if (moving) {
        this.velocity.x += (this.move.x * target - this.velocity.x) * Math.min(1, ACCEL * dt);
        this.velocity.z += (this.move.z * target - this.velocity.z) * Math.min(1, ACCEL * dt);
      } else {
        const damp = Math.max(0, 1 - FRICTION * dt);
        this.velocity.x *= damp;
        this.velocity.z *= damp;
      }
    }

    if (moving || dashing) {
      const dir = moving ? this.move : this.facing;
      this.facing.lerp(dir, Math.min(1, dt * 14)).normalize();
      this.root.rotation.y = Math.atan2(this.facing.x, this.facing.z);
    }

    // vertical
    this.velocity.y -= GRAVITY * dt;
    this.root.position.addScaledVector(this.velocity, dt);
    if (this.root.position.y <= 0) {
      const impact = Math.min(1, -this.velocity.y / 9);
      this.root.position.y = 0;
      if (!this.grounded) {
        this.grounded = true;
        this.landTimer = 0.34;
        this.fx.land(this.groundPoint(), impact);
        this.setBase("land", 0.05);
      }
      this.velocity.y = 0;
    }

    // charge
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / CHARGE_TIME);
      this.fx.setCharge(this.charge, dt);
      const chargeAction = this.actions.get("charge");
      if (chargeAction && !chargeAction.isRunning()) chargeAction.reset().play();
      chargeAction?.setEffectiveWeight(Math.min(1, this.charge * 3));
    } else {
      const chargeAction = this.actions.get("charge");
      if (chargeAction && chargeAction.getEffectiveWeight() > 0) {
        chargeAction.setEffectiveWeight(Math.max(0, chargeAction.getEffectiveWeight() - dt * 5));
      }
    }

    if (this.slashTimer > 0) {
      this.slashTimer -= dt;
      if (this.slashTimer <= 0) this.fx.sabre(false);
    }

    // state selection
    this.landTimer = Math.max(0, this.landTimer - dt);
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    let next: LocoState;
    if (!this.grounded) next = this.velocity.y > 0 ? "jump" : "fall";
    else if (dashing) next = "dash";
    else if (this.landTimer > 0 && speed < 1.2) next = "land";
    else if (speed > RUN_SPEED * 0.62) next = "run";
    else if (speed > 0.22) next = "walk";
    else next = "idle";

    this.state = next;
    this.setBase(next, next === "dash" || next === "land" ? 0.07 : 0.16);
    this.fireBeats(this.scratch);
  }
}
