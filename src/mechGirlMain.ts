import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import "./style.css";
import { buildMechGirl } from "./character/mechGirl";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
scene.background = new Color("#fbfbfc");

const camera = new PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 1.15, 5.9);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.05, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 3.2;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

scene.add(new HemisphereLight(0xffffff, 0xd7dce5, 2));
const key = new DirectionalLight(0xffffff, 3);
key.position.set(-3, 5, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.1;
key.shadow.camera.far = 15;
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 4;
key.shadow.camera.bottom = -2;
key.shadow.bias = -0.001;
scene.add(key);

const fill = new DirectionalLight(0xc3eeff, 1.1);
fill.position.set(3, 2, -3);
scene.add(fill);

const floor = new Mesh(
  new PlaneGeometry(30, 30),
  new MeshBasicMaterial({ color: "#fbfbfc", toneMapped: false }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
floor.receiveShadow = true;
scene.add(floor);

const shadowCatcher = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: 0.12 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.001;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

const character = buildMechGirl();
scene.add(character);

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);

function frame() {
  requestAnimationFrame(frame);
  controls.update();
  renderer.render(scene, camera);
}
frame();
