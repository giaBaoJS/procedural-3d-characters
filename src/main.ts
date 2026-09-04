import {
  ACESFilmicToneMapping,
  AnimationAction,
  AnimationMixer,
  Clock,
  Color,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  LoopOnce,
  LoopRepeat,
  Mesh,
  PCFSoftShadowMap,
  PMREMGenerator,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import "./style.css";
import { PALETTE } from "./palette";
import { buildMascot } from "./character/mascot";
import { CLIP_LABELS, buildClips } from "./animation/clips";
import { EffectLayer } from "./vfx";
import { buildPanel } from "./ui/panel";

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFSoftShadowMap;

const scene = new Scene();
scene.background = new Color(PALETTE.bg);

const camera = new PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 60);
camera.position.set(1.5, 1.0, 2.75);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.55, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.2;
controls.maxDistance = 6;
controls.maxPolarAngle = Math.PI * 0.52;
controls.update();

// A room probe gives the fur soft indirect bounce that three point lights alone cannot.
const pmrem = new PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;
scene.environmentIntensity = 0.32;

scene.add(new HemisphereLight(0xcfe4ff, 0x1b2436, 0.42));

const key = new DirectionalLight(0xfff2e0, 1.45);
key.position.set(2.4, 4.0, 2.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 12;
key.shadow.camera.left = -2;
key.shadow.camera.right = 2;
key.shadow.camera.top = 2;
key.shadow.camera.bottom = -2;
key.shadow.bias = -0.0012;
key.shadow.radius = 3;
scene.add(key);

const rim = new DirectionalLight(0x7fe3c4, 0.55);
rim.position.set(-2.6, 1.7, -2.4);
scene.add(rim);

const fill = new PointLight(0xffb3c1, 1.8, 8, 2);
fill.position.set(-1.4, 0.7, 1.8);
scene.add(fill);

// ---- ground: a gradient disc, with shadows caught on a separate transparent plane
const groundGradient = new Mesh(
  new PlaneGeometry(22, 22),
  new ShaderMaterial({
    side: DoubleSide,
    transparent: true,
    uniforms: { uColor: { value: new Color(PALETTE.ground) } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5)) * 2.0;
        float a = 1.0 - smoothstep(0.02, 0.30, d);
        gl_FragColor = vec4(uColor, a * 0.95);
      }`,
  })
);
groundGradient.rotation.x = -Math.PI / 2;
scene.add(groundGradient);

const shadowCatcher = new Mesh(new PlaneGeometry(8, 8), new ShadowMaterial({ opacity: 0.34 }));
shadowCatcher.rotation.x = -Math.PI / 2;
shadowCatcher.position.y = 0.001;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

// ---- character + effects
const mascot = buildMascot();
scene.add(mascot.root);

// Counted once from the geometry: renderer.info would only report the final composer pass.
let triangleCount = 0;
mascot.root.traverse((o) => {
  if (o instanceof Mesh) {
    const g = o.geometry;
    triangleCount += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  }
});

const effects = new EffectLayer(mascot.anchors);
scene.add(effects.group);

// ---- post
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new Vector2(window.innerWidth, window.innerHeight),
  0.34, // strength — enough for the bell and sparkles, not enough to blow out the fur
  0.5,
  0.88 // threshold: only emissive surfaces and motes clear it, never lit fur
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- animation ------------------------------------------------------------
const clips = buildClips();
const mixer = new AnimationMixer(mascot.root);
const actions = new Map<string, AnimationAction>();
for (const [name, def] of Object.entries(clips)) {
  const action = mixer.clipAction(def.clip);
  action.setLoop(def.loop ? LoopRepeat : LoopOnce, Infinity);
  actions.set(name, action);
}

const ORDER = ["idle", "bounce", "wave", "spin", "cheer", "dance", "look", "shake", "sleep"];

let activeKey = "idle";
let active = actions.get("idle")!;
active.play();

/** Beat times already fired this loop, so a beat cannot double-fire in one pass. */
let lastBeatTime = 0;

function play(key: string) {
  if (key === activeKey) return;
  const next = actions.get(key);
  if (!next) return;
  next.reset().setEffectiveWeight(1).play();
  active.crossFadeTo(next, 0.28, false);
  active = next;
  activeKey = key;
  lastBeatTime = 0;
  panel.setActive(key);
}

const groundPoint = new Vector3();
function fireBeats(dt: number) {
  const def = clips[activeKey];
  if (!def?.beats?.length) return;
  const now = active.time;
  const prev = lastBeatTime;
  lastBeatTime = now;
  if (dt <= 0) return;

  for (const beat of def.beats) {
    // handle the wrap at the end of a looping clip as well as the plain case
    const crossed = prev <= now ? beat > prev && beat <= now : beat > prev || beat <= now;
    if (!crossed) continue;
    mascot.pivots.hips.getWorldPosition(groundPoint);
    groundPoint.y = 0.06;
    effects.fire(groundPoint, activeKey === "sleep" ? 0.35 : 1);
  }
}

// ---- explode --------------------------------------------------------------
let explodeTarget = 0;
let explode = 0;

// ---- panel ----------------------------------------------------------------
const panel = buildPanel(CLIP_LABELS, ORDER, {
  onClip: play,
  onExplode: (v) => (explodeTarget = v),
  onIntensity: (v) => (effects.intensity = v),
  onSpeed: (v) => (mixer.timeScale = Math.max(0.1, v)),
});
panel.setActive("idle");

// ---- loop -----------------------------------------------------------------
const clock = new Clock();
const stats = document.querySelector<HTMLSpanElement>("#stats")!;
let statTimer = 0;

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
}
window.addEventListener("resize", resize);

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  mixer.update(dt);
  fireBeats(dt);

  explode += (explodeTarget - explode) * Math.min(1, dt * 8);
  if (explode > 0.001 || explodeTarget > 0.001) {
    for (const part of mascot.parts) {
      part.mesh.position.copy(part.home).addScaledVector(part.burst, explode * 0.5);
    }
  }

  controls.update();
  effects.update(dt, elapsed, camera.position, window.innerHeight * renderer.getPixelRatio() * 0.5);
  composer.render();

  statTimer += dt;
  if (statTimer > 0.5) {
    statTimer = 0;
    stats.textContent = `${Math.round(triangleCount).toLocaleString()} tris · ${mascot.parts.length} parts · ${ORDER.length} clips`;
  }
}

// Dev-only handle: lets a headless probe read joint transforms without a rebuild.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__mochi = { mascot, actions, mixer };
}

resize();
frame();
