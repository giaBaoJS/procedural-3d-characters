import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  Object3D,
  RedFormat,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const palette = {
  skin: "#f4d2bf",
  hair: "#202c48",
  hairLight: "#344b6b",
  hairAccent: "#70d7d2",
  eye: "#177f91",
  eyeDark: "#14344c",
  white: "#f3f5f5",
  navy: "#263956",
  navyDeep: "#18263c",
  blue: "#6c9bb8",
  gold: "#d8b46b",
  coral: "#d97878",
  glow: "#82e6df",
};

const ramp = new DataTexture(new Uint8Array([72, 152, 224, 255]), 4, 1, RedFormat);
ramp.magFilter = NearestFilter;
ramp.minFilter = NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

const mat = (color: string) => new MeshToonMaterial({ color, gradientMap: ramp });
const skinMat = mat(palette.skin);
const hairMat = mat(palette.hair);
const hairLightMat = mat(palette.hairLight);
const hairAccentMat = mat(palette.hairAccent);
const eyeMat = mat(palette.eye);
const eyeDarkMat = mat(palette.eyeDark);
const whiteMat = mat(palette.white);
const navyMat = mat(palette.navy);
const deepMat = mat(palette.navyDeep);
const blueMat = mat(palette.blue);
const goldMat = mat(palette.gold);
const coralMat = mat(palette.coral);
const glowMat = mat(palette.glow);
const highlightMat = new MeshToonMaterial({ color: "#ffffff", gradientMap: ramp });

const sphere = new SphereGeometry(1, 24, 18);

function add(
  parent: Object3D,
  geometry: BufferGeometry,
  material: MeshToonMaterial,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function ball(
  parent: Object3D,
  material: MeshToonMaterial,
  position: [number, number, number],
  scale: [number, number, number],
): Mesh {
  return add(parent, sphere, material, position, scale);
}

function plate(
  parent: Object3D,
  material: MeshToonMaterial,
  position: [number, number, number],
  size: [number, number, number],
  radius = 0.025,
  rotation: [number, number, number] = [0, 0, 0],
): Mesh {
  const maxRadius = Math.min(size[0], size[1], size[2]) * 0.48;
  return add(
    parent,
    new RoundedBoxGeometry(...size, 3, Math.min(radius, maxRadius)),
    material,
    position,
    [1, 1, 1],
    rotation,
  );
}

function link(
  parent: Object3D,
  start: Vector3,
  end: Vector3,
  radius: number,
  material: MeshToonMaterial,
  radialSegments = 12,
): Mesh {
  const delta = end.clone().sub(start);
  const mesh = add(
    parent,
    new CapsuleGeometry(radius, Math.max(0.01, delta.length() - 2 * radius), 4, radialSegments),
    material,
    [0, 0, 0],
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

function strand(
  parent: Object3D,
  root: Vector3,
  tip: Vector3,
  radius: number,
  material: MeshToonMaterial,
  sides = 6,
): Mesh {
  const axis = tip.clone().sub(root);
  const mesh = add(
    parent,
    new ConeGeometry(radius, axis.length(), sides, 1),
    material,
    [0, 0, 0],
  );
  mesh.position.copy(root).add(tip).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), axis.normalize());
  return mesh;
}

function vec(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z);
}

export function buildMechGirl(): Group {
  const root = new Group();
  root.name = "mech-girl";

  // Legs, boots, and articulated knee armor.
  for (const side of [-1, 1]) {
    const hip = vec(side * 0.105, 0.99, 0);
    const knee = vec(side * 0.145, 0.54, 0.012);
    const ankle = vec(side * 0.16, 0.16, 0.015);
    link(root, hip, knee, 0.075, deepMat);
    link(root, knee, ankle, 0.061, navyMat);
    ball(root, blueMat, [side * 0.145, 0.535, 0.075], [0.09, 0.08, 0.075]);
    plate(root, whiteMat, [side * 0.16, 0.31, 0.07], [0.12, 0.2, 0.09], 0.025, [0, 0, -side * 0.05]);
    plate(root, goldMat, [side * 0.16, 0.2, 0.12], [0.1, 0.025, 0.025], 0.009);
    ball(root, deepMat, [side * 0.16, 0.105, 0.04], [0.09, 0.07, 0.15]);
    plate(root, navyMat, [side * 0.16, 0.065, 0.13], [0.15, 0.055, 0.24], 0.025);
    plate(root, goldMat, [side * 0.16, 0.102, 0.252], [0.075, 0.018, 0.012], 0.006);
  }

  // Pleated uniform skirt, waist band, and side armor.
  add(root, new CylinderGeometry(0.185, 0.29, 0.25, 16, 1), navyMat, [0, 0.97, 0]);
  add(root, new CylinderGeometry(0.292, 0.3, 0.035, 16, 1), whiteMat, [0, 0.85, 0]);
  add(root, new CylinderGeometry(0.19, 0.19, 0.055, 16, 1), goldMat, [0, 1.105, 0]);
  for (const side of [-1, 1]) {
    plate(root, blueMat, [side * 0.235, 0.94, 0.015], [0.1, 0.19, 0.09], 0.025, [0, 0, side * 0.16]);
    plate(root, goldMat, [side * 0.255, 0.94, 0.067], [0.035, 0.07, 0.014], 0.006);
  }

  // Fitted jacket, blouse front, collar, tie, and compact chest reactor.
  ball(root, navyMat, [0, 1.29, 0], [0.235, 0.25, 0.145]);
  plate(root, whiteMat, [0, 1.29, 0.13], [0.13, 0.3, 0.045], 0.02);
  plate(root, whiteMat, [-0.075, 1.475, 0.082], [0.13, 0.08, 0.08], 0.014, [0, 0, -0.3]);
  plate(root, whiteMat, [0.075, 1.475, 0.082], [0.13, 0.08, 0.08], 0.014, [0, 0, 0.3]);
  plate(root, coralMat, [0, 1.37, 0.166], [0.065, 0.16, 0.028], 0.01);
  plate(root, goldMat, [0, 1.31, 0.185], [0.025, 0.025, 0.012], 0.006);
  plate(root, blueMat, [-0.155, 1.3, 0.126], [0.055, 0.19, 0.045], 0.012, [0, 0, -0.14]);
  plate(root, blueMat, [0.155, 1.3, 0.126], [0.055, 0.19, 0.045], 0.012, [0, 0, 0.14]);
  add(root, new TorusGeometry(0.055, 0.012, 8, 24), goldMat, [0, 1.22, 0.16], [1, 1, 0.72]);
  ball(root, glowMat, [0, 1.22, 0.176], [0.031, 0.031, 0.018]);

  // Symmetric A-pose: upper and lower arms descend diagonally from the shoulders.
  for (const side of [-1, 1]) {
    const shoulder = vec(side * 0.205, 1.42, 0);
    const elbow = vec(side * 0.49, 1.2, 0);
    const wrist = vec(side * 0.79, 0.98, 0.015);
    link(root, shoulder, elbow, 0.066, whiteMat);
    link(root, elbow, wrist, 0.055, deepMat);
    ball(root, goldMat, [side * 0.49, 1.2, 0.03], [0.069, 0.068, 0.067]);
    plate(root, blueMat, [side * 0.29, 1.39, 0.005], [0.17, 0.15, 0.18], 0.04, [0, 0, side * 0.28]);
    plate(root, goldMat, [side * 0.29, 1.39, 0.101], [0.07, 0.025, 0.018], 0.008);
    plate(root, navyMat, [side * 0.67, 1.07, 0.03], [0.15, 0.1, 0.14], 0.025, [0, 0, side * 0.55]);
    link(root, wrist, vec(side * 0.87, 0.91, 0.035), 0.047, skinMat, 10);
    ball(root, skinMat, [side * 0.88, 0.9, 0.035], [0.062, 0.052, 0.04]);
    for (let finger = 0; finger < 3; finger++) {
      const x = side * (0.89 + finger * 0.016);
      link(root, vec(x, 0.89, 0.05), vec(x + side * 0.01, 0.84, 0.05), 0.009, skinMat, 7);
    }
  }

  // Neck and face.
  add(root, new CylinderGeometry(0.055, 0.06, 0.11, 12), skinMat, [0, 1.55, 0]);
  ball(root, skinMat, [0, 1.79, 0.005], [0.205, 0.245, 0.18]);
  for (const side of [-1, 1]) {
    ball(root, skinMat, [side * 0.199, 1.78, 0], [0.045, 0.068, 0.045]);
    ball(root, eyeDarkMat, [side * 0.078, 1.805, 0.171], [0.047, 0.066, 0.026]);
    ball(root, eyeMat, [side * 0.078, 1.805, 0.193], [0.031, 0.05, 0.015]);
    ball(root, highlightMat, [side * 0.068 - 0.009, 1.828, 0.207], [0.012, 0.017, 0.008]);
    ball(root, coralMat, [side * 0.13, 1.736, 0.145], [0.035, 0.015, 0.008]);
    strand(root, vec(side * 0.04, 1.87, 0.17), vec(side * 0.085, 1.889, 0.17), 0.018, hairMat, 4);
  }
  ball(root, coralMat, [0, 1.75, 0.178], [0.009, 0.01, 0.007]);
  const smile = new CatmullRomCurve3([
    vec(-0.028, 1.704, 0.169),
    vec(0, 1.697, 0.178),
    vec(0.028, 1.704, 0.169),
  ]);
  add(root, new TubeGeometry(smile, 8, 0.0035, 5, false), eyeDarkMat, [0, 0, 0]);

  // Angular, layered hair and long side locks frame the face.
  ball(root, hairMat, [0, 1.965, -0.02], [0.22, 0.135, 0.19]);
  ball(root, hairMat, [0, 1.83, -0.115], [0.205, 0.22, 0.11]);
  for (const side of [-1, 1]) {
    strand(root, vec(side * 0.13, 1.99, 0.01), vec(side * 0.19, 1.72, 0.14), 0.105, hairLightMat, 5);
    strand(root, vec(side * 0.17, 1.91, -0.035), vec(side * 0.24, 1.48, -0.015), 0.095, hairMat, 5);
    strand(root, vec(side * 0.19, 1.79, -0.025), vec(side * 0.2, 1.54, 0.005), 0.045, hairAccentMat, 5);
  }
  strand(root, vec(-0.13, 2.035, 0.035), vec(-0.15, 1.81, 0.18), 0.09, hairMat, 5);
  strand(root, vec(-0.045, 2.04, 0.07), vec(-0.055, 1.78, 0.19), 0.085, hairLightMat, 5);
  strand(root, vec(0.045, 2.04, 0.07), vec(0.035, 1.77, 0.19), 0.085, hairMat, 5);
  strand(root, vec(0.13, 2.02, 0.03), vec(0.13, 1.82, 0.18), 0.085, hairLightMat, 5);

  // A small luminous hair clip and matching ear-side comms.
  plate(root, goldMat, [0.174, 1.93, 0.125], [0.1, 0.04, 0.025], 0.009, [0, 0, -0.25]);
  plate(root, glowMat, [0.176, 1.93, 0.142], [0.048, 0.018, 0.012], 0.005, [0, 0, -0.25]);
  for (const side of [-1, 1]) {
    add(root, new CylinderGeometry(0.045, 0.045, 0.025, 12), navyMat, [side * 0.208, 1.77, -0.01], [1, 1, 1], [0, 0, Math.PI / 2]);
    ball(root, glowMat, [side * 0.229, 1.77, 0], [0.014, 0.025, 0.025]);
  }

  return root;
}
