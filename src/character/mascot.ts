/**
 * The mascot is built entirely from generated geometry — no mesh files, no loaders.
 *
 * Two structures come out of `buildMascot`: a hierarchy of named pivots that the
 * animation clips bind to by name, and a flat list of parts that the explode view
 * pushes outward. Pivots carry no geometry of their own so a clip can rotate a
 * joint without dragging its mesh's own offset into the rotation.
 */
import {
  BufferGeometry,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { PALETTE } from "../palette";

export interface MascotPart {
  mesh: Mesh;
  home: Vector3;
  /** Direction the part travels in the exploded view. */
  burst: Vector3;
}

export interface Mascot {
  root: Group;
  pivots: Record<string, Object3D>;
  parts: MascotPart[];
  /** World-space anchors the effect layer attaches emitters to. */
  anchors: { handL: Object3D; handR: Object3D; bell: Object3D; head: Object3D };
}

const fur = (color: Color, roughness = 0.72) =>
  new MeshStandardMaterial({ color, roughness, metalness: 0.0 });

/** A sphere pushed wider towards its base, which reads as a soft pear rather than a ball. */
function pearGeometry(pear: number, segments = 48): BufferGeometry {
  const geo = new SphereGeometry(1, segments, Math.round(segments * 0.75));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const widen = 1 + pear * (0.5 - y * 0.5);
    pos.setX(i, pos.getX(i) * widen);
    pos.setZ(i, pos.getZ(i) * widen);
  }
  geo.computeVertexNormals();
  return geo;
}

function pivot(name: string, parent: Object3D, x: number, y: number, z: number): Object3D {
  const p = new Object3D();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

export function buildMascot(): Mascot {
  const root = new Group();
  root.name = "root";

  const parts: MascotPart[] = [];
  const attach = (
    parent: Object3D,
    geo: BufferGeometry,
    mat: MeshStandardMaterial,
    at: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
    burst?: [number, number, number]
  ) => {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    const dir = new Vector3(...(burst ?? at)).normalize();
    dir.y = Math.max(dir.y, -0.1); // keep exploded parts from sinking through the floor
    parts.push({ mesh, home: mesh.position.clone(), burst: dir.normalize() });
    return mesh;
  };

  // ---- skeleton -----------------------------------------------------------
  const hips = pivot("hips", root, 0, 0.34, 0);
  const spine = pivot("spine", hips, 0, 0.06, 0);
  const chest = pivot("chest", spine, 0, 0.1, 0);
  const neck = pivot("neck", chest, 0, 0.13, 0);
  const head = pivot("head", neck, 0, 0.12, 0);
  const earL = pivot("earL", head, -0.15, 0.2, -0.02);
  const earR = pivot("earR", head, 0.15, 0.2, -0.02);
  const eyeL = pivot("eyeL", head, -0.1, 0.035, 0.255);
  const eyeR = pivot("eyeR", head, 0.1, 0.035, 0.255);

  const armL = pivot("armL", chest, -0.2, 0.04, 0);
  const forearmL = pivot("forearmL", armL, -0.15, -0.09, 0);
  const handL = pivot("handL", forearmL, -0.13, -0.08, 0);
  const armR = pivot("armR", chest, 0.2, 0.04, 0);
  const forearmR = pivot("forearmR", armR, 0.15, -0.09, 0);
  const handR = pivot("handR", forearmR, 0.13, -0.08, 0);

  const legL = pivot("legL", hips, -0.13, -0.14, 0);
  const footL = pivot("footL", legL, 0, -0.13, 0.02);
  const legR = pivot("legR", hips, 0.13, -0.14, 0);
  const footR = pivot("footR", legR, 0, -0.13, 0.02);

  const tail1 = pivot("tail1", hips, 0, -0.02, -0.24);
  const tail2 = pivot("tail2", tail1, 0, 0.09, -0.09);
  const tail3 = pivot("tail3", tail2, 0, 0.09, -0.07);

  const bell = pivot("bell", chest, 0, 0.006, 0.295);

  // ---- geometry -----------------------------------------------------------
  const bodyMat = fur(PALETTE.furLight);
  const shadeMat = fur(PALETTE.furMid);
  const pawMat = fur(PALETTE.furShade, 0.66);
  const earMat = fur(PALETTE.innerEar, 0.58);
  const eyeMat = new MeshStandardMaterial({ color: PALETTE.eye, roughness: 0.18, metalness: 0.05 });
  const shineMat = new MeshStandardMaterial({
    color: PALETTE.eyeShine,
    roughness: 0.1,
    emissive: PALETTE.eyeShine,
    emissiveIntensity: 0.5,
  });
  const cheekMat = new MeshStandardMaterial({
    color: PALETTE.cheek,
    roughness: 0.85,
    transparent: true,
    opacity: 0.72,
  });
  const collarMat = new MeshStandardMaterial({
    color: PALETTE.collar,
    roughness: 0.4,
    emissive: PALETTE.collar,
    emissiveIntensity: 0.28,
  });
  const bellMat = new MeshStandardMaterial({
    color: PALETTE.bell,
    roughness: 0.28,
    metalness: 0.45,
    emissive: PALETTE.bell,
    emissiveIntensity: 0.55,
  });

  const pear = pearGeometry(0.22);
  const ball = new SphereGeometry(1, 40, 30);
  const limb = new CapsuleGeometry(1, 1.1, 6, 16);

  // torso + head
  attach(spine, pear, bodyMat, [0, 0.02, 0], [0.3, 0.29, 0.27], [0, 1, 0]);
  attach(spine, ball, shadeMat, [0, -0.02, 0.19], [0.17, 0.15, 0.1], [0, -0.4, 1]);
  attach(head, pear, bodyMat, [0, 0, 0], [0.29, 0.27, 0.27], [0, 1, 0]);

  // muzzle, nose, cheeks
  attach(head, ball, shadeMat, [0, -0.072, 0.245], [0.115, 0.082, 0.075], [0, -0.3, 1]);
  attach(head, ball, fur(PALETTE.nose, 0.4), [0, -0.042, 0.305], [0.034, 0.028, 0.03], [0, 0, 1]);
  attach(head, ball, cheekMat, [-0.178, -0.058, 0.222], [0.058, 0.04, 0.03], [-1, 0, 0.4]);
  attach(head, ball, cheekMat, [0.178, -0.058, 0.222], [0.058, 0.04, 0.03], [1, 0, 0.4]);

  // eyes live on their own pivots so a blink can squash them without moving the head
  attach(eyeL, ball, eyeMat, [0, 0, 0], [0.072, 0.088, 0.05], [-1, 0.2, 1]);
  attach(eyeR, ball, eyeMat, [0, 0, 0], [0.072, 0.088, 0.05], [1, 0.2, 1]);
  attach(eyeL, ball, shineMat, [-0.024, 0.032, 0.036], [0.024, 0.026, 0.014], [-1, 1, 1]);
  attach(eyeR, ball, shineMat, [0.019, 0.032, 0.036], [0.024, 0.026, 0.014], [1, 1, 1]);

  // ears: outer shell plus a smaller inner shell
  for (const [p, side] of [
    [earL, -1],
    [earR, 1],
  ] as const) {
    attach(p, ball, bodyMat, [0, 0, 0], [0.085, 0.13, 0.06], [side, 1, 0]);
    attach(p, ball, earMat, [0, -0.01, 0.03], [0.05, 0.085, 0.04], [side, 1, 0.4]);
    p.rotation.z = side * -0.22;
  }

  // limbs
  attach(armL, limb, bodyMat, [-0.075, -0.05, 0], [0.072, 0.095, 0.072], [-1, 0, 0]);
  attach(armR, limb, bodyMat, [0.075, -0.05, 0], [0.072, 0.095, 0.072], [1, 0, 0]);
  armL.rotation.z = 0.436; // +25 deg: paw hangs down and slightly out
  armR.rotation.z = -0.436;
  attach(handL, ball, pawMat, [0, 0, 0], [0.072, 0.066, 0.072], [-1, -0.4, 0.3]);
  attach(handR, ball, pawMat, [0, 0, 0], [0.072, 0.066, 0.072], [1, -0.4, 0.3]);

  attach(legL, limb, bodyMat, [0, -0.06, 0], [0.07, 0.055, 0.07], [-0.6, -1, 0]);
  attach(legR, limb, bodyMat, [0, -0.06, 0], [0.07, 0.055, 0.07], [0.6, -1, 0]);
  attach(footL, ball, pawMat, [0, 0, 0.02], [0.085, 0.055, 0.1], [-0.6, -1, 0.4]);
  attach(footR, ball, pawMat, [0, 0, 0.02], [0.085, 0.055, 0.1], [0.6, -1, 0.4]);

  // tail, tapering along the chain
  attach(tail1, ball, bodyMat, [0, 0.04, -0.03], [0.062, 0.062, 0.062], [0, 0.3, -1]);
  attach(tail2, ball, bodyMat, [0, 0.04, -0.03], [0.052, 0.052, 0.052], [0, 0.5, -1]);
  attach(tail3, ball, fur(PALETTE.furShade), [0, 0.04, -0.02], [0.045, 0.045, 0.045], [0, 0.7, -1]);

  // collar + bell
  const collar = new Mesh(new TorusGeometry(0.296, 0.024, 12, 48), collarMat);
  collar.rotation.x = Math.PI / 2;
  // local Y becomes world Z after the rotation, matching the torso's shallower depth
  collar.scale.set(1, 0.9, 1);
  collar.position.set(0, 0.02, 0);
  chest.add(collar);
  parts.push({ mesh: collar, home: collar.position.clone(), burst: new Vector3(0, 0.6, -1).normalize() });
  attach(bell, ball, bellMat, [0, -0.02, 0], [0.055, 0.055, 0.055], [0, -0.4, 1]);

  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return {
    root,
    pivots: {
      hips, spine, chest, neck, head, earL, earR, eyeL, eyeR,
      armL, forearmL, handL, armR, forearmR, handR,
      legL, footL, legR, footR, tail1, tail2, tail3, bell,
    },
    parts,
    anchors: { handL, handR, bell, head },
  };
}
