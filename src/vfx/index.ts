/**
 * The effect layer. Three systems share one additive pass:
 *
 *   Sparkles  ambient motes, animated entirely in the vertex shader so the CPU
 *             never touches them
 *   Trail     a ribbon behind each paw whose width follows the paw's live speed,
 *             rather than a constant-width streak
 *   Burst     transient shrapnel under real gravity plus an expanding ground ring,
 *             fired from clip beats
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Group,
  Mesh,
  Object3D,
  Points,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from "three";
import { PALETTE } from "../palette";

/* ------------------------------------------------------------------ sparkles */

const SPARKLE_COUNT = 220;

/** Ambient motes drifting up around the mascot. Position is a pure function of time. */
class Sparkles {
  readonly points: Points;
  private readonly material: ShaderMaterial;

  constructor() {
    const geo = new BufferGeometry();
    const seed = new Float32Array(SPARKLE_COUNT * 4); // angle, radius, height, speed
    const size = new Float32Array(SPARKLE_COUNT);
    const tint = new Float32Array(SPARKLE_COUNT * 3);
    const colors = [PALETTE.sparkA, PALETTE.sparkB, PALETTE.sparkC];

    for (let i = 0; i < SPARKLE_COUNT; i++) {
      seed[i * 4] = Math.random() * Math.PI * 2;
      seed[i * 4 + 1] = 0.42 + Math.random() * 0.75;
      seed[i * 4 + 2] = Math.random();
      seed[i * 4 + 3] = 0.1 + Math.random() * 0.22;
      size[i] = 0.009 + Math.random() * 0.032;
      const c = colors[i % colors.length];
      tint[i * 3] = c.r;
      tint[i * 3 + 1] = c.g;
      tint[i * 3 + 2] = c.b;
    }

    geo.setAttribute("position", new BufferAttribute(new Float32Array(SPARKLE_COUNT * 3), 3));
    geo.setAttribute("seed", new BufferAttribute(seed, 4));
    geo.setAttribute("size", new BufferAttribute(size, 1));
    geo.setAttribute("tint", new BufferAttribute(tint, 3));

    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 }, uGain: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute vec4 seed;
        attribute float size;
        attribute vec3 tint;
        uniform float uTime;
        uniform float uScale;
        varying vec3 vTint;
        varying float vFade;
        void main() {
          // each mote rises on its own loop, then wraps back to the floor
          float life = fract(seed.z + uTime * seed.w);
          float angle = seed.x + uTime * 0.32 + life * 1.4;
          float radius = seed.y * (0.72 + 0.28 * sin(life * 3.14159));
          vec3 pos = vec3(cos(angle) * radius, life * 1.65 - 0.08, sin(angle) * radius);
          // fade in off the floor, out at the top, and twinkle on the way
          vFade = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.55, 1.0, life));
          vFade *= 0.45 + 0.55 * sin(uTime * 5.0 + seed.x * 9.0) * 0.5 + 0.275;
          vTint = tint;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uGain;
        varying vec3 vTint;
        varying float vFade;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vTint * (0.6 + core), core * core * vFade * uGain);
        }`,
    });

    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  update(elapsed: number, height: number, gain: number) {
    this.material.uniforms.uTime.value = elapsed;
    this.material.uniforms.uScale.value = height;
    this.material.uniforms.uGain.value = gain;
  }
}

/* --------------------------------------------------------------------- trail */

const TRAIL_SAMPLES = 10;

/** A ribbon that only thickens when the paw it follows is actually moving fast. */
class Trail {
  readonly mesh: Mesh;
  private readonly history: Vector3[] = [];
  private readonly speeds: number[] = [];
  private readonly position: BufferAttribute;
  private readonly alpha: BufferAttribute;
  private readonly last = new Vector3();
  private readonly current = new Vector3();
  private readonly side = new Vector3();
  private readonly dir = new Vector3();
  private primed = false;
  private readonly anchor: Object3D;

  constructor(anchor: Object3D, color: Color) {
    this.anchor = anchor;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      this.history.push(new Vector3());
      this.speeds.push(0);
    }
    const geo = new BufferGeometry();
    this.position = new BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2 * 3), 3);
    this.alpha = new BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2), 1);
    this.position.setUsage(DynamicDrawUsage);
    this.alpha.setUsage(DynamicDrawUsage);
    geo.setAttribute("position", this.position);
    geo.setAttribute("aAlpha", this.alpha);

    const index: number[] = [];
    for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(index);

    this.mesh = new Mesh(
      geo,
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: { uColor: { value: color } },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying float vAlpha;
          void main() {
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() {
            if (vAlpha <= 0.001) discard;
            gl_FragColor = vec4(uColor, vAlpha);
          }`,
      })
    );
    this.mesh.frustumCulled = false;
  }

  update(dt: number, cameraPos: Vector3, gain: number) {
    this.anchor.getWorldPosition(this.current);
    if (!this.primed) {
      for (const p of this.history) p.copy(this.current);
      this.last.copy(this.current);
      this.primed = true;
    }

    const speed = dt > 0 ? this.current.distanceTo(this.last) / dt : 0;
    this.last.copy(this.current);

    // newest sample first; the rest shift back one slot
    for (let i = TRAIL_SAMPLES - 1; i > 0; i--) {
      this.history[i].copy(this.history[i - 1]);
      this.speeds[i] = this.speeds[i - 1];
    }
    this.history[0].copy(this.current);
    this.speeds[0] = speed;

    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      const p = this.history[i];
      const ahead = this.history[Math.max(0, i - 1)];
      const behind = this.history[Math.min(TRAIL_SAMPLES - 1, i + 1)];
      this.dir.subVectors(ahead, behind);
      if (this.dir.lengthSq() < 1e-10) this.dir.set(0, 1, 0);
      this.side.subVectors(p, cameraPos).cross(this.dir).normalize();

      const taper = 1 - i / TRAIL_SAMPLES;
      // Width tracks the speed recorded when this sample was laid down, past a
      // deadzone — an idling paw should leave nothing behind at all.
      const moving = Math.max(0, this.speeds[i] - 0.4);
      const width = Math.min(moving * 0.009, 0.017) * taper;
      this.position.setXYZ(i * 2, p.x + this.side.x * width, p.y + this.side.y * width, p.z + this.side.z * width);
      this.position.setXYZ(i * 2 + 1, p.x - this.side.x * width, p.y - this.side.y * width, p.z - this.side.z * width);

      const a = Math.min(moving * 0.3, 0.55) * taper * taper * gain;
      this.alpha.setX(i * 2, a);
      this.alpha.setX(i * 2 + 1, a);
    }
    this.position.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}

/* --------------------------------------------------------------------- burst */

const SHARD_COUNT = 90;

/** Shrapnel plus a ground ring, both driven off one lifetime clock. */
class Burst {
  readonly group = new Group();
  private readonly points: Points;
  private readonly material: ShaderMaterial;
  private readonly ring: Mesh;
  private readonly ringMaterial: ShaderMaterial;
  private readonly velocity: Float32Array;
  private readonly origin = new Vector3();
  private life = 0;
  private duration = 0.9;

  constructor() {
    const geo = new BufferGeometry();
    const pos = new Float32Array(SHARD_COUNT * 3);
    const size = new Float32Array(SHARD_COUNT);
    const tint = new Float32Array(SHARD_COUNT * 3);
    this.velocity = new Float32Array(SHARD_COUNT * 3);
    const colors = [PALETTE.sparkA, PALETTE.sparkB, PALETTE.sparkC];
    for (let i = 0; i < SHARD_COUNT; i++) {
      size[i] = 0.012 + Math.random() * 0.036;
      const c = colors[i % colors.length];
      tint[i * 3] = c.r;
      tint[i * 3 + 1] = c.g;
      tint[i * 3 + 2] = c.b;
    }
    geo.setAttribute("position", new BufferAttribute(pos, 3).setUsage(DynamicDrawUsage));
    geo.setAttribute("size", new BufferAttribute(size, 1));
    geo.setAttribute("tint", new BufferAttribute(tint, 3));

    this.material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uFade: { value: 0 }, uScale: { value: 450 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 tint;
        uniform float uScale;
        varying vec3 vTint;
        void main() {
          vTint = tint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade;
        varying vec3 vTint;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vTint * (0.7 + core), core * core * uFade);
        }`,
    });
    this.points = new Points(geo, this.material);
    this.points.frustumCulled = false;

    this.ringMaterial = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      uniforms: { uFade: { value: 0 }, uColor: { value: PALETTE.sparkA } },
      vertexShader: /* glsl */ `
        varying float vR;
        void main() {
          vR = length(position.xy);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uFade; uniform vec3 uColor; varying float vR;
        void main() {
          float t = (vR - 0.26) / 0.08;
          float edge = smoothstep(0.0, 0.4, t) * (1.0 - smoothstep(0.6, 1.0, t));
          gl_FragColor = vec4(uColor, edge * uFade);
        }`,
    });
    this.ring = new Mesh(new RingGeometry(0.26, 0.34, 72), this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;

    this.group.add(this.points, this.ring);
    this.group.visible = false;
  }

  fire(at: Vector3, strength: number) {
    this.origin.copy(at);
    this.life = 0;
    this.duration = 0.75 + strength * 0.35;
    const pos = this.points.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < SHARD_COUNT; i++) {
      pos.setXYZ(i, at.x, at.y, at.z);
      // cosine-weighted upward hemisphere, so shards favour the sky but still spread
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.sqrt(Math.random()));
      const speed = (1.1 + Math.random() * 2.0) * strength;
      this.velocity[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      this.velocity[i * 3 + 1] = Math.cos(phi) * speed * 0.85 + 0.5;
      this.velocity[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
    }
    pos.needsUpdate = true;
    this.ring.position.set(at.x, 0.012, at.z);
    this.group.visible = true;
  }

  setScale(scale: number) {
    this.material.uniforms.uScale.value = scale;
  }

  update(dt: number) {
    if (!this.group.visible) return;
    this.life += dt;
    const t = this.life / this.duration;
    if (t >= 1) {
      this.group.visible = false;
      return;
    }

    const pos = this.points.geometry.attributes.position as BufferAttribute;
    for (let i = 0; i < SHARD_COUNT; i++) {
      this.velocity[i * 3 + 1] -= 7.4 * dt; // gravity
      const drag = 1 - 1.6 * dt;
      this.velocity[i * 3] *= drag;
      this.velocity[i * 3 + 2] *= drag;
      let y = pos.getY(i) + this.velocity[i * 3 + 1] * dt;
      if (y < 0.01) {
        y = 0.01;
        this.velocity[i * 3 + 1] *= -0.32; // a soft bounce off the floor
      }
      pos.setXYZ(i, pos.getX(i) + this.velocity[i * 3] * dt, y, pos.getZ(i) + this.velocity[i * 3 + 2] * dt);
    }
    pos.needsUpdate = true;
    this.material.uniforms.uFade.value = Math.pow(1 - t, 1.6);

    const spread = 0.5 + t * 1.5;
    this.ring.scale.setScalar(spread);
    this.ringMaterial.uniforms.uFade.value = Math.pow(1 - t, 2.2) * 0.85;
  }
}

/* --------------------------------------------------------------------- layer */

export class EffectLayer {
  readonly group = new Group();
  private readonly sparkles = new Sparkles();
  private readonly trails: Trail[];
  private readonly bursts: Burst[] = [];
  private next = 0;
  /** Global multiplier so the whole layer can be dialled down or off. */
  intensity = 1;

  constructor(anchors: { handL: Object3D; handR: Object3D }) {
    this.trails = [new Trail(anchors.handL, PALETTE.sparkA), new Trail(anchors.handR, PALETTE.sparkB)];
    for (let i = 0; i < 4; i++) this.bursts.push(new Burst());
    this.group.add(this.sparkles.points);
    for (const t of this.trails) this.group.add(t.mesh);
    for (const b of this.bursts) this.group.add(b.group);
  }

  fire(at: Vector3, strength = 1) {
    if (this.intensity <= 0) return;
    this.bursts[this.next].fire(at, strength);
    this.next = (this.next + 1) % this.bursts.length;
  }

  update(dt: number, elapsed: number, cameraPos: Vector3, viewportHeight: number) {
    this.sparkles.update(elapsed, viewportHeight, this.intensity);
    for (const t of this.trails) t.update(dt, cameraPos, this.intensity);
    for (const b of this.bursts) {
      b.setScale(viewportHeight);
      b.update(dt);
    }
  }
}
