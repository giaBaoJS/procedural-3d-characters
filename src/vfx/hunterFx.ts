/**
 * Effect layer for the hunter. One additive pass covers eight systems:
 *
 *   Particles    a single ring-buffer pool shared by jets, dust, sparks and charge motes
 *   Afterimages  frozen ghost copies of the whole rig, spawned while dashing
 *   ChargeOrb    a growing core at the muzzle with motes spiralling inward
 *   Shots        pooled plasma projectiles that travel, expire and detonate
 *   Rings        expanding ground shockwaves
 *   Sabre        a blade that grows on activation, with a ribbon trail behind the tip
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
  MeshBasicMaterial,
  Object3D,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";

const POOL = 900;
const tmpA = new Vector3();
const tmpB = new Vector3();

/* ---------------------------------------------------------------- particles */

/** One ring-buffer of additive motes. Every spray effect in the scene draws from it. */
class Particles {
  readonly points: Points;
  private readonly pos: BufferAttribute;
  private readonly col: BufferAttribute;
  private readonly siz: BufferAttribute;
  private readonly alp: BufferAttribute;
  private readonly vel = new Float32Array(POOL * 3);
  private readonly life = new Float32Array(POOL);
  private readonly maxLife = new Float32Array(POOL);
  private readonly drag = new Float32Array(POOL);
  private readonly gravity = new Float32Array(POOL);
  private readonly baseSize = new Float32Array(POOL);
  private cursor = 0;

  constructor() {
    const geo = new BufferGeometry();
    this.pos = new BufferAttribute(new Float32Array(POOL * 3), 3).setUsage(DynamicDrawUsage) as BufferAttribute;
    this.col = new BufferAttribute(new Float32Array(POOL * 3), 3).setUsage(DynamicDrawUsage) as BufferAttribute;
    this.siz = new BufferAttribute(new Float32Array(POOL), 1).setUsage(DynamicDrawUsage) as BufferAttribute;
    this.alp = new BufferAttribute(new Float32Array(POOL), 1).setUsage(DynamicDrawUsage) as BufferAttribute;
    geo.setAttribute("position", this.pos);
    geo.setAttribute("aColor", this.col);
    geo.setAttribute("aSize", this.siz);
    geo.setAttribute("aAlpha", this.alp);

    this.points = new Points(
      geo,
      new ShaderMaterial({
        transparent: true, depthWrite: false, blending: AdditiveBlending,
        uniforms: { uScale: { value: 450 } },
        vertexShader: /* glsl */ `
          attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
          uniform float uScale;
          varying vec3 vColor; varying float vAlpha;
          void main() {
            vColor = aColor; vAlpha = aAlpha;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vColor; varying float vAlpha;
          void main() {
            if (vAlpha <= 0.002) discard;
            float d = length(gl_PointCoord - 0.5);
            float core = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(vColor * (0.55 + core), core * core * vAlpha);
          }`,
      })
    );
    this.points.frustumCulled = false;
  }

  emit(p: Vector3, v: Vector3, color: Color, size: number, life: number, drag = 1.6, gravity = 0) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % POOL;
    this.pos.setXYZ(i, p.x, p.y, p.z);
    this.col.setXYZ(i, color.r, color.g, color.b);
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life;
    this.drag[i] = drag; this.gravity[i] = gravity;
    this.baseSize[i] = size;
    this.siz.setX(i, size);
    this.alp.setX(i, 1);
  }

  setScale(scale: number) {
    (this.points.material as ShaderMaterial).uniforms.uScale.value = scale;
  }

  update(dt: number) {
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.alp.setX(i, 0);
        continue;
      }
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= d;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.gravity[i] * dt;
      this.vel[i * 3 + 2] *= d;
      let y = this.pos.getY(i) + this.vel[i * 3 + 1] * dt;
      if (y < 0.008) { y = 0.008; this.vel[i * 3 + 1] *= -0.25; }
      this.pos.setXYZ(i, this.pos.getX(i) + this.vel[i * 3] * dt, y, this.pos.getZ(i) + this.vel[i * 3 + 2] * dt);
      const t = this.life[i] / this.maxLife[i];
      this.alp.setX(i, t * t);
      this.siz.setX(i, this.baseSize[i] * (0.4 + 0.6 * t));
    }
    this.pos.needsUpdate = true;
    this.col.needsUpdate = true;
    this.siz.needsUpdate = true;
    this.alp.needsUpdate = true;
  }
}

/* -------------------------------------------------------------- afterimages */

/** Frozen copies of the whole rig. Spawned while dashing, then faded out. */
class Afterimages {
  readonly group = new Group();
  private readonly ghosts: { nodes: Object3D[]; material: MeshBasicMaterial; life: number }[] = [];
  private readonly source: Object3D[] = [];
  private cursor = 0;

  constructor(root: Object3D, color: Color, count = 4) {
    root.traverse((o) => this.source.push(o));
    for (let i = 0; i < count; i++) {
      const clone = root.clone(true);
      const material = new MeshBasicMaterial({
        color, transparent: true, opacity: 0, blending: AdditiveBlending,
        depthWrite: false, side: DoubleSide,
      });
      const nodes: Object3D[] = [];
      clone.traverse((o) => {
        nodes.push(o);
        if (o instanceof Mesh) {
          o.material = material;
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      clone.visible = false;
      this.group.add(clone);
      this.ghosts.push({ nodes, material, life: 0 });
    }
  }

  spawn() {
    const g = this.ghosts[this.cursor];
    this.cursor = (this.cursor + 1) % this.ghosts.length;
    // Clone traversal order matches the source, so transforms zip across one-to-one.
    const n = Math.min(g.nodes.length, this.source.length);
    for (let i = 0; i < n; i++) {
      g.nodes[i].position.copy(this.source[i].position);
      g.nodes[i].quaternion.copy(this.source[i].quaternion);
      g.nodes[i].scale.copy(this.source[i].scale);
    }
    g.nodes[0].visible = true;
    g.life = 1;
  }

  update(dt: number, intensity: number) {
    for (const g of this.ghosts) {
      if (g.life <= 0) continue;
      g.life = Math.max(0, g.life - dt * 4.2);
      g.material.opacity = g.life * g.life * 0.11 * intensity;
      if (g.life <= 0) g.nodes[0].visible = false;
    }
  }
}

/* ------------------------------------------------------------------- shots */

interface Shot {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  charged: boolean;
}

/* ------------------------------------------------------------------- rings */

function makeRing(color: Color) {
  const material = new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
    uniforms: { uFade: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */ `
      varying float vR;
      void main() { vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFade; uniform vec3 uColor; varying float vR;
      void main() {
        float t = (vR - 0.3) / 0.1;
        float edge = smoothstep(0.0, 0.4, t) * (1.0 - smoothstep(0.6, 1.0, t));
        gl_FragColor = vec4(uColor, edge * uFade);
      }`,
  });
  const mesh = new Mesh(new RingGeometry(0.3, 0.4, 80), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.visible = false;
  return { mesh, material, life: 0, duration: 0.6, size: 1 };
}

/* ------------------------------------------------------------------- layer */

export interface HunterFxAnchors {
  muzzle: Object3D;
  thrusterL: Object3D;
  thrusterR: Object3D;
  backpackL: Object3D;
  backpackR: Object3D;
  saber: Object3D;
}

export class HunterFx {
  readonly group = new Group();
  intensity = 1;

  private readonly particles = new Particles();
  private readonly afterimages: Afterimages;
  private readonly anchors: HunterFxAnchors;
  private readonly rings: ReturnType<typeof makeRing>[] = [];
  private readonly shots: Shot[] = [];
  private ringCursor = 0;

  private readonly chargeOrb: Mesh;
  private readonly chargeMat: ShaderMaterial;
  private readonly saberBlade: Mesh;
  private readonly saberMat: MeshBasicMaterial;

  private dashClock = 0;
  private jetClock = 0;
  private chargeClock = 0;
  /** 0..1 while the buster is spinning up. */
  charge = 0;
  saberActive = 0;

  private readonly cyan = new Color("#7fe6ff");
  private readonly blue = new Color("#4aa8ff");
  private readonly gold = new Color("#ffd166");
  private readonly white = new Color("#dff6ff");
  private readonly dust = new Color("#8fa6c8");

  constructor(root: Object3D, anchors: HunterFxAnchors) {
    this.anchors = anchors;
    this.afterimages = new Afterimages(root, this.blue);
    this.group.add(this.particles.points, this.afterimages.group);

    for (let i = 0; i < 5; i++) {
      const r = makeRing(this.cyan);
      this.rings.push(r);
      this.group.add(r.mesh);
    }

    this.chargeMat = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uColor: { value: this.cyan }, uFade: { value: 0 } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade; varying vec3 vN;
        void main() {
          // brighter at the rim than face-on, so the orb reads as plasma not a solid ball
          float rim = pow(1.0 - abs(vN.z), 1.6);
          gl_FragColor = vec4(uColor, (0.32 + rim) * uFade);
        }`,
    });
    this.chargeOrb = new Mesh(new SphereGeometry(1, 24, 18), this.chargeMat);
    this.chargeOrb.visible = false;
    this.group.add(this.chargeOrb);

    this.saberMat = new MeshBasicMaterial({
      color: this.cyan, transparent: true, opacity: 0,
      blending: AdditiveBlending, depthWrite: false,
    });
    this.saberBlade = new Mesh(new SphereGeometry(1, 16, 12), this.saberMat);
    this.saberBlade.visible = false;
    this.group.add(this.saberBlade);

    for (let i = 0; i < 14; i++) {
      const mat = new MeshBasicMaterial({
        color: this.cyan, transparent: true, opacity: 0.95,
        blending: AdditiveBlending, depthWrite: false,
      });
      const mesh = new Mesh(new SphereGeometry(1, 14, 10), mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.shots.push({ mesh, velocity: new Vector3(), life: 0, charged: false });
    }
  }

  attachTo(scene: Scene) {
    scene.add(this.group);
  }

  // ---- emitters -----------------------------------------------------------

  /** Boost plumes from the heels and backpack; call every frame while dashing. */
  dashJets(dt: number, facing: Vector3) {
    if (this.intensity <= 0) return;
    this.dashClock += dt;
    while (this.dashClock > 0.06) {
      this.dashClock -= 0.06;
      this.afterimages.spawn();
    }
    this.jetClock += dt;
    while (this.jetClock > 0.022) {
      this.jetClock -= 0.022;
      for (const a of [this.anchors.thrusterL, this.anchors.thrusterR, this.anchors.backpackL, this.anchors.backpackR]) {
        a.getWorldPosition(tmpA);
        tmpB.copy(facing).multiplyScalar(-(5 + Math.random() * 4));
        tmpB.x += (Math.random() - 0.5) * 1.4;
        tmpB.y += (Math.random() - 0.3) * 1.4;
        tmpB.z += (Math.random() - 0.5) * 1.4;
        this.particles.emit(tmpA, tmpB, Math.random() < 0.4 ? this.white : this.cyan,
          0.018 + Math.random() * 0.026, 0.18 + Math.random() * 0.14, 3.8);
      }
    }
  }

  /** A short jet burst, used on jump take-off. */
  thrusterKick(strength = 1) {
    for (const a of [this.anchors.thrusterL, this.anchors.thrusterR]) {
      a.getWorldPosition(tmpA);
      for (let i = 0; i < 14; i++) {
        tmpB.set((Math.random() - 0.5) * 2.2, -3 - Math.random() * 3.5, (Math.random() - 0.5) * 2.2)
          .multiplyScalar(strength);
        this.particles.emit(tmpA, tmpB, i % 3 === 0 ? this.white : this.cyan,
          0.022 + Math.random() * 0.03, 0.22 + Math.random() * 0.2, 3.0);
      }
    }
  }

  footPuff(at: Vector3) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      tmpB.set(Math.cos(a) * (0.5 + Math.random()), 0.4 + Math.random() * 0.7, Math.sin(a) * (0.5 + Math.random()));
      this.particles.emit(at, tmpB, this.dust, 0.02 + Math.random() * 0.03, 0.3 + Math.random() * 0.25, 2.4, 1.2);
    }
  }

  land(at: Vector3, force: number) {
    this.ring(at, 0.55 + force * 1.9, 0.55);
    for (let i = 0; i < 26 + force * 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (1.2 + Math.random() * 2.4) * (0.5 + force);
      tmpB.set(Math.cos(a) * s, 0.5 + Math.random() * 1.6, Math.sin(a) * s);
      this.particles.emit(at, tmpB, Math.random() < 0.3 ? this.cyan : this.dust,
        0.024 + Math.random() * 0.04, 0.35 + Math.random() * 0.3, 2.2, 3.2);
    }
  }

  ring(at: Vector3, size: number, duration: number) {
    if (this.intensity <= 0) return;
    const r = this.rings[this.ringCursor];
    this.ringCursor = (this.ringCursor + 1) % this.rings.length;
    r.mesh.position.set(at.x, 0.014, at.z);
    r.mesh.visible = true;
    r.life = 0;
    r.duration = duration;
    r.size = size;
  }

  /** Feed 0..1 each frame while the fire button is held. */
  setCharge(value: number, dt: number) {
    this.charge = value;
    if (value <= 0.02) {
      this.chargeOrb.visible = false;
      return;
    }
    this.anchors.muzzle.getWorldPosition(tmpA);
    this.chargeOrb.visible = true;
    this.chargeOrb.position.copy(tmpA);
    const pulse = 1 + Math.sin(performance.now() * 0.02) * 0.07 * value;
    this.chargeOrb.scale.setScalar((0.045 + value * 0.15) * pulse);
    this.chargeMat.uniforms.uFade.value = (0.25 + value * 0.75) * this.intensity;
    this.chargeMat.uniforms.uColor.value = value > 0.85 ? this.gold : this.cyan;

    // motes spiral inward toward the muzzle while the shot spins up
    this.chargeClock += dt;
    while (this.chargeClock > 0.02) {
      this.chargeClock -= 0.02;
      const a = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 0.3;
      tmpB.set(tmpA.x + Math.cos(a) * r, tmpA.y + (Math.random() - 0.5) * 0.5, tmpA.z + Math.sin(a) * r);
      const toward = new Vector3().subVectors(tmpA, tmpB).multiplyScalar(3.4 + value * 3);
      this.particles.emit(tmpB, toward, value > 0.85 ? this.gold : this.cyan,
        0.016 + Math.random() * 0.022, 0.2, 0.2);
    }
  }

  fire(direction: Vector3, charged: boolean) {
    this.anchors.muzzle.getWorldPosition(tmpA);
    const shot = this.shots.find((s) => s.life <= 0);
    if (shot) {
      shot.mesh.visible = true;
      shot.mesh.position.copy(tmpA);
      shot.mesh.scale.setScalar(charged ? 0.16 : 0.062);
      (shot.mesh.material as MeshBasicMaterial).color.copy(charged ? this.gold : this.cyan);
      shot.velocity.copy(direction).multiplyScalar(charged ? 13 : 17);
      shot.life = 1.5;
      shot.charged = charged;
    }
    // muzzle flash
    for (let i = 0; i < (charged ? 40 : 16); i++) {
      tmpB.copy(direction).multiplyScalar(2.5 + Math.random() * 5);
      tmpB.x += (Math.random() - 0.5) * 2.4;
      tmpB.y += (Math.random() - 0.5) * 2.4;
      tmpB.z += (Math.random() - 0.5) * 2.4;
      this.particles.emit(tmpA, tmpB, charged ? this.gold : this.white,
        0.02 + Math.random() * 0.04, 0.16 + Math.random() * 0.14, 4.5);
    }
    this.chargeOrb.visible = false;
  }

  sabre(active: boolean) {
    this.saberActive = active ? 1 : 0;
  }

  private impact(at: Vector3, charged: boolean) {
    this.ring(at, charged ? 2.2 : 1.0, 0.42);
    const n = charged ? 60 : 24;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      const s = (2 + Math.random() * 4) * (charged ? 1.6 : 1);
      tmpB.set(Math.sin(p) * Math.cos(a) * s, Math.abs(Math.cos(p)) * s * 0.7, Math.sin(p) * Math.sin(a) * s);
      this.particles.emit(at, tmpB, charged ? this.gold : this.cyan,
        0.022 + Math.random() * 0.05, 0.28 + Math.random() * 0.3, 2.6, 4.0);
    }
  }

  // ---- frame --------------------------------------------------------------

  update(dt: number, viewportScale: number) {
    this.particles.setScale(viewportScale);
    this.particles.update(dt);
    this.afterimages.update(dt, this.intensity);

    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.life += dt;
      const t = r.life / r.duration;
      if (t >= 1) { r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar((0.35 + t * 1.35) * r.size);
      r.material.uniforms.uFade.value = Math.pow(1 - t, 2.1) * 0.9 * this.intensity;
    }

    for (const s of this.shots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      s.mesh.position.addScaledVector(s.velocity, dt);
      // trail
      this.particles.emit(s.mesh.position, tmpB.set(0, 0, 0), s.charged ? this.gold : this.cyan,
        s.charged ? 0.07 : 0.032, 0.16, 0.5);
      if (s.life <= 0 || s.mesh.position.y < 0.05) {
        this.impact(s.mesh.position, s.charged);
        s.life = 0;
        s.mesh.visible = false;
      }
    }

    if (this.saberActive > 0) {
      this.anchors.saber.getWorldPosition(tmpA);
      this.saberBlade.visible = true;
      this.saberBlade.position.copy(tmpA);
      this.anchors.saber.getWorldQuaternion(this.saberBlade.quaternion);
      this.saberBlade.scale.set(0.042, 0.5, 0.042);
      this.saberBlade.translateY(-0.46);
      this.saberMat.opacity = 0.95 * this.intensity;
      // sparks shed off the blade tip
      this.saberBlade.getWorldPosition(tmpA);
      for (let i = 0; i < 3; i++) {
        tmpB.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
        this.particles.emit(tmpA, tmpB, this.cyan, 0.02 + Math.random() * 0.03, 0.18, 3.0);
      }
    } else {
      this.saberBlade.visible = false;
    }
  }
}
