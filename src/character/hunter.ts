/**
 * "Vector" — an armoured hunter built the same way as the mascot: named pivots for the
 * skeleton, generated geometry hanging off them, nothing loaded from disk.
 *
 * The silhouette follows the hard-surface idiom of 90s action-game armour — crested
 * helmet, oversized pauldrons, an arm cannon — which suits primitive geometry far better
 * than an organic character would.
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const HUNTER_PALETTE = {
  armor: new Color("#2f6fd8"),
  armorLight: new Color("#6fa9f5"),
  armorDeep: new Color("#1d3f86"),
  suit: new Color("#233150"),
  trim: new Color("#ffcf3f"),
  metal: new Color("#8b97ad"),
  metalDark: new Color("#39415a"),
  jewel: new Color("#3ef2b0"),
  glow: new Color("#7fe6ff"),
  skin: new Color("#e8b391"),
};

export interface HunterPart {
  mesh: Mesh;
  home: Vector3;
  burst: Vector3;
}

export interface Hunter {
  root: Group;
  pivots: Record<string, Object3D>;
  parts: HunterPart[];
  anchors: {
    muzzle: Object3D;
    thrusterL: Object3D;
    thrusterR: Object3D;
    backpackL: Object3D;
    backpackR: Object3D;
    saber: Object3D;
    head: Object3D;
  };
  /** Emissive materials the effect layer pulses during charge. */
  glowMaterials: MeshStandardMaterial[];
}

const armorMat = (color: Color, metalness = 0.45, roughness = 0.3) =>
  new MeshStandardMaterial({ color, metalness, roughness });

const glowMat = (color: Color, intensity = 1.1) =>
  new MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.1,
  });

function pivot(name: string, parent: Object3D, x: number, y: number, z: number): Object3D {
  const p = new Object3D();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

export function buildHunter(): Hunter {
  const root = new Group();
  root.name = "root";
  const parts: HunterPart[] = [];
  const glowMaterials: MeshStandardMaterial[] = [];

  const add = (
    parent: Object3D,
    geo: BufferGeometry,
    mat: MeshStandardMaterial,
    pos: [number, number, number],
    rot: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    burst?: [number, number, number]
  ) => {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(...pos);
    mesh.rotation.set(...rot);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    const dir = new Vector3(...(burst ?? pos));
    if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
    dir.normalize();
    dir.y = Math.max(dir.y, -0.1);
    parts.push({ mesh, home: mesh.position.clone(), burst: dir.normalize() });
    return mesh;
  };

  const plate = (w: number, h: number, d: number, r = 0.02) =>
    new RoundedBoxGeometry(w, h, d, 3, r);

  // ---- skeleton -----------------------------------------------------------
  const hips = pivot("hips", root, 0, 0.95, 0);
  const spine = pivot("spine", hips, 0, 0.12, 0);
  const chest = pivot("chest", spine, 0, 0.13, 0);
  const neck = pivot("neck", chest, 0, 0.22, 0);
  const head = pivot("head", neck, 0, 0.07, 0);

  const shoulderL = pivot("shoulderL", chest, -0.2, 0.14, 0);
  const armL = pivot("armL", shoulderL, -0.1, -0.03, 0);
  const forearmL = pivot("forearmL", armL, 0, -0.27, 0);
  const handL = pivot("handL", forearmL, 0, -0.24, 0);
  const shoulderR = pivot("shoulderR", chest, 0.2, 0.14, 0);
  const armR = pivot("armR", shoulderR, 0.1, -0.03, 0);
  const forearmR = pivot("forearmR", armR, 0, -0.27, 0);
  const handR = pivot("handR", forearmR, 0, -0.24, 0);
  const muzzle = pivot("muzzle", handR, 0, -0.14, 0);
  const saber = pivot("saber", handL, 0, -0.06, 0);

  const thighL = pivot("thighL", hips, -0.115, -0.07, 0);
  const shinL = pivot("shinL", thighL, 0, -0.36, 0);
  const footL = pivot("footL", shinL, 0, -0.36, 0);
  const thighR = pivot("thighR", hips, 0.115, -0.07, 0);
  const shinR = pivot("shinR", thighR, 0, -0.36, 0);
  const footR = pivot("footR", shinR, 0, -0.36, 0);
  const thrusterL = pivot("thrusterL", footL, 0, -0.03, -0.09);
  const thrusterR = pivot("thrusterR", footR, 0, -0.03, -0.09);

  const backpack = pivot("backpack", chest, 0, 0.05, -0.13);
  const backpackL = pivot("backpackL", backpack, -0.11, -0.02, -0.05);
  const backpackR = pivot("backpackR", backpack, 0.11, -0.02, -0.05);

  // ---- materials ----------------------------------------------------------
  const blue = armorMat(HUNTER_PALETTE.armor);
  const blueLight = armorMat(HUNTER_PALETTE.armorLight, 0.35, 0.34);
  const blueDeep = armorMat(HUNTER_PALETTE.armorDeep, 0.5, 0.28);
  const suit = armorMat(HUNTER_PALETTE.suit, 0.15, 0.62);
  const trim = armorMat(HUNTER_PALETTE.trim, 0.6, 0.26);
  const metal = armorMat(HUNTER_PALETTE.metal, 0.85, 0.24);
  const metalDark = armorMat(HUNTER_PALETTE.metalDark, 0.7, 0.36);
  const skin = armorMat(HUNTER_PALETTE.skin, 0.0, 0.68);

  const jewel = glowMat(HUNTER_PALETTE.jewel, 1.05);
  const eyeGlow = glowMat(new Color('#39c8f0'), 0.45);
  const vent = glowMat(HUNTER_PALETTE.glow, 0.5);
  const core = glowMat(HUNTER_PALETTE.glow, 0.7);
  glowMaterials.push(vent, core, jewel);

  // reusable primitives
  const ball = new SphereGeometry(1, 28, 20);
  const cyl = (rt: number, rb: number, h: number, seg = 20) => new CylinderGeometry(rt, rb, h, seg);

  // ---- torso --------------------------------------------------------------
  add(spine, plate(0.26, 0.16, 0.19, 0.05), suit, [0, 0.0, 0], [0, 0, 0], [1, 1, 1], [0, -1, 0]); // abdomen
  add(spine, plate(0.24, 0.05, 0.2, 0.02), metalDark, [0, -0.08, 0], [0, 0, 0], [1, 1, 1], [0, -1, 0]); // waist ring

  add(chest, plate(0.36, 0.26, 0.23, 0.06), blue, [0, 0.05, 0], [0, 0, 0], [1, 1, 1], [0, 1, -0.4]); // chest shell
  add(chest, plate(0.2, 0.14, 0.05, 0.03), blueLight, [0, 0.06, 0.11], [0, 0, 0], [1, 1, 1], [0, 0.5, 1]); // sternum plate
  // chest vents
  for (const x of [-0.075, 0.075]) {
    for (let i = 0; i < 3; i++) {
      add(chest, plate(0.05, 0.015, 0.028, 0.005), vent, [x, 0.092 - i * 0.028, 0.131], [0, 0, 0], [1, 1, 1], [x, 0.3, 1]);
    }
  }
  add(chest, new TorusGeometry(0.045, 0.012, 10, 24), trim, [0, -0.05, 0.115], [0, 0, 0], [1, 1, 1], [0, -0.4, 1]);
  add(chest, plate(0.3, 0.04, 0.2, 0.015), trim, [0, -0.075, 0], [0, 0, 0], [1, 1, 1], [0, -1, 0]); // chest lip

  // backpack / booster
  add(backpack, plate(0.28, 0.2, 0.11, 0.035), blueDeep, [0, 0, 0], [0, 0, 0], [1, 1, 1], [0, 0.4, -1]);
  for (const [p, sx] of [[backpackL, -1], [backpackR, 1]] as const) {
    add(p, cyl(0.045, 0.055, 0.14, 16), metalDark, [0, 0, 0], [0.32, 0, 0], [1, 1, 1], [sx, 0.2, -1]);
    add(p, new TorusGeometry(0.045, 0.011, 8, 20), trim, [0, -0.06, -0.02], [Math.PI / 2 + 0.32, 0, 0], [1, 1, 1], [sx, -0.4, -1]);
    add(p, cyl(0.036, 0.036, 0.02, 16), core, [0, -0.072, -0.025], [0.32, 0, 0], [1, 1, 1], [sx, -0.5, -1]);
  }

  // ---- head ---------------------------------------------------------------
  // A solid sphere helmet buried the face, so the shell is cut open at the front:
  // SphereGeometry's phi runs from +Z, so starting past it leaves a face window.
  const helmetShell = new SphereGeometry(1, 36, 24, Math.PI / 2 + 0.66, Math.PI * 2 - 1.32);
  const helmetMat = new MeshStandardMaterial({
    color: HUNTER_PALETTE.armor, metalness: 0.45, roughness: 0.3, side: DoubleSide,
  });

  add(head, ball, skin, [0, -0.006, 0.03], [0, 0, 0], [0.082, 0.094, 0.08], [0, 0.2, 1]);
  // eyes placed against the measured face surface, tilted outward
  for (const x of [-0.038, 0.038]) {
    add(head, ball, eyeGlow, [x, 0.016, 0.088], [0, 0, -x * 3.4], [0.024, 0.033, 0.014], [x, 0.3, 1]);
  }
  add(head, plate(0.03, 0.008, 0.012, 0.003), metalDark, [0, -0.048, 0.104], [0, 0, 0], [1, 1, 1], [0, -0.5, 1]);
  add(head, helmetShell, helmetMat, [0, 0.026, -0.014], [0, 0, 0], [0.132, 0.136, 0.132], [0, 1, -0.4]);
  add(head, plate(0.205, 0.062, 0.115, 0.022), blue, [0, 0.084, 0.055], [0.26, 0, 0], [1, 1, 1], [0, 0.9, 0.8]);
  add(head, plate(0.15, 0.055, 0.095, 0.022), blueDeep, [0, -0.09, 0.042], [-0.22, 0, 0], [1, 1, 1], [0, -1, 0.6]);
  add(head, ball, jewel, [0, 0.108, 0.06], [0, 0, 0], [0.031, 0.022, 0.018], [0, 1, 1]);
  add(head, new ConeGeometry(0.05, 0.23, 4), blue, [0, 0.14, -0.035], [Math.PI / 2 - 0.34, 0, Math.PI / 4], [1, 0.3, 1], [0, 1, 0]);
  add(head, plate(0.018, 0.03, 0.16, 0.006), trim, [0, 0.152, -0.03], [0.62, 0, 0], [1, 1, 1], [0, 1, 0]);
  for (const x of [-0.126, 0.126]) {
    add(head, cyl(0.05, 0.05, 0.038, 20), blueDeep, [x, 0.0, 0.004], [0, 0, Math.PI / 2], [1, 1, 1], [x, 0, 0]);
    add(head, cyl(0.026, 0.026, 0.048, 16), trim, [x * 1.14, 0.0, 0.004], [0, 0, Math.PI / 2], [1, 1, 1], [x, 0, 0]);
    add(head, cyl(0.013, 0.013, 0.054, 12), vent, [x * 1.22, 0.0, 0.004], [0, 0, Math.PI / 2], [1, 1, 1], [x, 0, 0]);
  }
  add(neck, cyl(0.042, 0.05, 0.07, 14), metalDark, [0, 0.02, 0], [0, 0, 0], [1, 1, 1], [0, 1, 0]);

  // ---- arms ---------------------------------------------------------------
  for (const [sh, ar, fa, side] of [
    [shoulderL, armL, forearmL, -1],
    [shoulderR, armR, forearmR, 1],
  ] as const) {
    // pauldron: the signature oversized shoulder
    add(sh, plate(0.2, 0.16, 0.21, 0.05), blue, [side * 0.055, 0.012, 0], [0, 0, side * -0.2], [1, 1, 1], [side, 0.5, 0]);
    add(sh, plate(0.13, 0.05, 0.17, 0.02), blueLight, [side * 0.088, 0.086, 0], [0, 0, side * -0.28], [1, 1, 1], [side, 1, 0]);
    add(sh, plate(0.05, 0.05, 0.09, 0.014), trim, [side * 0.138, -0.012, 0.055], [0, 0, side * -0.2], [1, 1, 1], [side, 0, 1]);
    add(sh, new TorusGeometry(0.06, 0.014, 8, 20), trim, [side * 0.095, -0.048, 0], [0, Math.PI / 2, 0], [1, 1, 1], [side, -0.3, 0]);
    // upper arm
    add(ar, new CapsuleGeometry(0.055, 0.16, 5, 14), suit, [0, -0.13, 0], [0, 0, 0], [1, 1, 1], [side, -0.4, 0]);
    // elbow guard
    add(fa, ball, blueDeep, [0, 0.01, 0], [0, 0, 0], [0.068, 0.06, 0.068], [side, 0, 0]);
  }
  // left forearm: gauntlet
  add(forearmL, plate(0.12, 0.2, 0.12, 0.035), blue, [0, -0.11, 0], [0, 0, 0], [1, 1, 1], [-1, -0.3, 0]);
  add(forearmL, new TorusGeometry(0.062, 0.014, 8, 20), trim, [0, -0.2, 0], [Math.PI / 2, 0, 0], [1, 1, 1], [-1, -0.6, 0]);
  add(handL, plate(0.085, 0.09, 0.075, 0.025), blueLight, [0, -0.03, 0], [0, 0, 0], [1, 1, 1], [-1, -0.5, 0.2]);

  // right forearm: arm cannon
  add(forearmR, cyl(0.086, 0.07, 0.2, 22), blue, [0, -0.11, 0], [0, 0, 0], [1, 1, 1], [1, -0.3, 0]);
  add(forearmR, cyl(0.098, 0.098, 0.03, 22), blueDeep, [0, -0.176, 0], [0, 0, 0], [1, 1, 1], [1, -0.4, 0]);
  add(handR, cyl(0.1, 0.088, 0.14, 22), blue, [0, -0.058, 0], [0, 0, 0], [1, 1, 1], [1, -0.5, 0]);
  add(handR, cyl(0.106, 0.106, 0.024, 22), blueDeep, [0, -0.124, 0], [0, 0, 0], [1, 1, 1], [1, -0.6, 0]);
  add(handR, new TorusGeometry(0.096, 0.013, 10, 26), trim, [0, -0.124, 0], [Math.PI / 2, 0, 0], [1, 1, 1], [1, -0.6, 0]);
  add(handR, cyl(0.072, 0.072, 0.034, 20), metalDark, [0, -0.132, 0], [0, 0, 0], [1, 1, 1], [1, -0.7, 0]); // recessed bore
  add(handR, cyl(0.052, 0.052, 0.012, 20), core, [0, -0.146, 0], [0, 0, 0], [1, 1, 1], [1, -0.7, 0]);

  // ---- legs ---------------------------------------------------------------
  add(hips, plate(0.28, 0.13, 0.2, 0.045), blue, [0, -0.04, 0], [0, 0, 0], [1, 1, 1], [0, -0.6, 0]);
  add(hips, plate(0.1, 0.11, 0.05, 0.02), trim, [0, -0.05, 0.105], [0, 0, 0], [1, 1, 1], [0, -0.4, 1]);
  // sabre hilt stowed on the left hip
  add(hips, cyl(0.022, 0.026, 0.13, 14), metal, [-0.15, -0.03, -0.055], [0.25, 0, 0.2], [1, 1, 1], [-1, 0, -0.5]);
  add(hips, new TorusGeometry(0.026, 0.008, 8, 16), trim, [-0.153, 0.03, -0.04], [Math.PI / 2 + 0.25, 0, 0.2], [1, 1, 1], [-1, 0.3, -0.5]);

  for (const [th, sn, ft, thr, side] of [
    [thighL, shinL, footL, thrusterL, -1],
    [thighR, shinR, footR, thrusterR, 1],
  ] as const) {
    add(th, new CapsuleGeometry(0.062, 0.2, 5, 14), suit, [0, -0.17, 0], [0, 0, 0], [1, 1, 1], [side, -1, 0]);
    add(th, plate(0.152, 0.21, 0.15, 0.042), blue, [0, -0.085, 0], [0, 0, 0], [1, 1, 1], [side, -0.3, 0]); // thigh guard
    add(th, plate(0.06, 0.05, 0.09, 0.014), trim, [side * 0.082, -0.045, 0.02], [0, 0, 0], [1, 1, 1], [side, 0, 0.5]);
    add(sn, ball, blueDeep, [0, 0.01, 0.01], [0, 0, 0], [0.072, 0.062, 0.072], [side, 0, 0.3]); // knee
    add(sn, plate(0.1, 0.06, 0.075, 0.02), trim, [0, 0.005, 0.062], [0, 0, 0], [1, 1, 1], [side, 0, 1]); // knee cap
    add(sn, new CapsuleGeometry(0.055, 0.18, 5, 14), suit, [0, -0.17, 0], [0, 0, 0], [1, 1, 1], [side, -1, 0]);
    // boot: the widest armour piece on the leg
    add(ft, plate(0.155, 0.2, 0.19, 0.045), blue, [0, 0.02, 0.005], [0, 0, 0], [1, 1, 1], [side, -0.6, 0]);
    add(ft, plate(0.17, 0.055, 0.24, 0.03), blueLight, [0, -0.075, 0.03], [0, 0, 0], [1, 1, 1], [side, -1, 0.4]); // sole
    add(ft, plate(0.09, 0.05, 0.05, 0.015), trim, [0, 0.06, 0.1], [0, 0, 0], [1, 1, 1], [side, 0.2, 1]);
    // heel thruster
    add(thr, cyl(0.05, 0.062, 0.07, 16), metalDark, [0, 0.02, 0], [0.5, 0, 0], [1, 1, 1], [side, -0.4, -1]);
    add(thr, cyl(0.042, 0.042, 0.016, 16), vent, [0, -0.012, -0.018], [0.5, 0, 0], [1, 1, 1], [side, -0.5, -1]);
  }

  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return {
    root,
    pivots: {
      hips, spine, chest, neck, head,
      shoulderL, armL, forearmL, handL,
      shoulderR, armR, forearmR, handR,
      thighL, shinL, footL, thighR, shinR, footR,
      backpack,
    },
    parts,
    anchors: { muzzle, thrusterL, thrusterR, backpackL, backpackR, saber, head },
    glowMaterials,
  };
}
