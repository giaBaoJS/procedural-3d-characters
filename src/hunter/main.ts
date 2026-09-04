import {
  ACESFilmicToneMapping, AnimationMixer, Clock, Color, DirectionalLight, DoubleSide,
  HemisphereLight, Mesh, PCFSoftShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry,
  PointLight, Scene, ShaderMaterial, ShadowMaterial, SRGBColorSpace, Vector2, Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import "../style.css";
import { buildHunter } from "../character/hunter";
import { buildHunterClips } from "../animation/hunterClips";
import { HunterFx } from "../vfx/hunterFx";
import { Locomotion } from "./locomotion";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
scene.background = new Color("#080d18");

const camera = new PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 120);
camera.position.set(3.0, 2.0, 4.2);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.5;

const pmrem = new PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
scene.environmentIntensity = 0.5;

scene.add(new HemisphereLight(0x9ec4ff, 0x0d1424, 0.5));
const key = new DirectionalLight(0xffffff, 2.0);
key.position.set(4, 6, 4);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { near: 0.5, far: 30, left: -6, right: 6, top: 6, bottom: -6 });
key.shadow.bias = -0.0013;
key.shadow.radius = 3;
scene.add(key);
const rim = new DirectionalLight(0x4fc0ff, 1.5);
rim.position.set(-4, 2.4, -4);
scene.add(rim);
const warm = new PointLight(0xff9a5c, 3, 16, 2);
warm.position.set(-3, 1.4, 3);
scene.add(warm);

const grid = new Mesh(
  new PlaneGeometry(60, 60),
  new ShaderMaterial({
    side: DoubleSide, transparent: true,
    uniforms: { uColor: { value: new Color("#2f5a94") } },
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader: `
      uniform vec3 uColor; varying vec2 vUv;
      void main() {
        vec2 g = abs(fract((vUv - 0.5) * 60.0) - 0.5);
        float line = 1.0 - smoothstep(0.0, 0.03, min(g.x, g.y));
        float fade = 1.0 - smoothstep(0.03, 0.36, distance(vUv, vec2(0.5)) * 2.0);
        gl_FragColor = vec4(uColor, line * fade * 0.6 + fade * 0.1);
      }`,
  })
);
grid.rotation.x = -Math.PI / 2;
scene.add(grid);

const shadowPlane = new Mesh(new PlaneGeometry(30, 30), new ShadowMaterial({ opacity: 0.42 }));
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = 0.002;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

const hunter = buildHunter();
scene.add(hunter.root);

const fx = new HunterFx(hunter.root, hunter.anchors);
scene.add(fx.group);

const mixer = new AnimationMixer(hunter.root);
const clips = buildHunterClips();
const loco = new Locomotion({
  root: hunter.root, mixer, clips, fx,
  footL: hunter.pivots.footL, footR: hunter.pivots.footR,
});

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

let tris = 0;
hunter.root.traverse((o) => {
  if (o instanceof Mesh) {
    const g = o.geometry;
    tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  }
});

const panel = document.createElement("aside");
panel.className = "panel";
panel.innerHTML = `
  <header><h1>Vector</h1><p class="sub">Armoured hunter — geometry, rig, every keyframe and
  the whole effect layer are TypeScript. Nothing is fetched.</p></header>
  <section>
    <div class="label-row"><span>State</span><span class="current" id="state">idle</span></div>
    <div class="keys">
      <div><kbd>W A S D</kbd><span>move</span></div>
      <div><kbd>Shift</kbd><span>run</span></div>
      <div><kbd>L</kbd><span>dash</span></div>
      <div><kbd>Space</kbd><span>jump</span></div>
      <div><kbd>J</kbd><span>fire · hold to charge</span></div>
      <div><kbd>K</kbd><span>sabre</span></div>
    </div>
    <div class="charge-wrap"><div class="charge" id="charge"></div></div>
  </section>
  <section>
    <label class="slider">Effects <input type="range" id="intensity" min="0" max="150" value="100"></label>
  </section>
  <footer><span id="stats">${Math.round(tris).toLocaleString()} tris · ${hunter.parts.length} parts · ${Object.keys(clips).length} clips</span><a href="/">← Mochi</a></footer>`;
document.body.appendChild(panel);

const stateEl = panel.querySelector<HTMLElement>("#state")!;
const chargeEl = panel.querySelector<HTMLElement>("#charge")!;
panel.querySelector<HTMLInputElement>("#intensity")!.oninput = (e) => {
  fx.intensity = Number((e.target as HTMLInputElement).value) / 100;
};

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__vector = { hunter, mixer, loco, fx, camera, controls };
}

const clock = new Clock();
const followTarget = new Vector3();
const followDelta = new Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  loco.update(dt, camera.position);
  mixer.update(dt);

  // Camera trails the hunter: the orbit target and the camera move by the same delta,
  // so the user keeps full control of the orbit while the subject drifts.
  followTarget.set(hunter.root.position.x, hunter.root.position.y + 0.95, hunter.root.position.z);
  followDelta.subVectors(followTarget, controls.target).multiplyScalar(Math.min(1, dt * 5));
  controls.target.add(followDelta);
  camera.position.add(followDelta);

  key.position.set(hunter.root.position.x + 4, 6, hunter.root.position.z + 4);
  key.target.position.copy(hunter.root.position);
  key.target.updateMatrixWorld();

  controls.update();
  fx.update(dt, innerHeight * renderer.getPixelRatio() * 0.5);
  composer.render();

  stateEl.textContent = loco.state;
  chargeEl.style.width = `${loco.charge * 100}%`;
}
frame();
