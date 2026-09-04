# Procedural 3D characters in Three.js

Two rigged, animated characters with full effect layers, built entirely in TypeScript.
No `.glb`, no `.fbx`, no texture files, no loaders — the geometry, the skeletons, every
animation keyframe and every particle is generated in code at runtime.

| | | |
| --- | --- | --- |
| **Mochi** (`/`) | a cute mascot | 9 clips, sparkles, paw trails, shockwaves |
| **Vector** (`/hunter.html`) | an armoured hunter | 10 clips, keyboard locomotion, 8 effect systems |

Vector is an original design in the visual idiom of 90s armoured-hero action games, not a
reproduction of any existing character.

## Vector controls

`W A S D` move (camera-relative) · `Shift` run · `L` dash · `Space` jump ·
`J` fire, hold to charge · `K` sabre

```bash
npm install
npm run dev       # http://localhost:5173
npm run build
```

## What is in here

| Area | File | What it does |
| --- | --- | --- |
| Keyframe kit | `src/animation/kit.ts` | Degree-keyframe helpers and the clip padder both rigs share |
| Mascot rig | `src/character/mascot.ts` | ~60k triangles from primitives, 23 named pivots |
| Mascot clips | `src/animation/clips.ts` | Nine hand-authored clips |
| Mascot effects | `src/vfx/index.ts` | Sparkles, speed-driven paw trails, gravity shrapnel, shockwaves |
| Hunter rig | `src/character/hunter.ts` | 84 armour parts on a 20-joint skeleton, open-fronted helmet shell |
| Hunter clips | `src/animation/hunterClips.ts` | Locomotion set plus **additive** combat layers |
| Hunter effects | `src/vfx/hunterFx.ts` | Particle pool, dash afterimages, charge orb, plasma shots, rings, sabre |
| Locomotion | `src/hunter/locomotion.ts` | Input, physics, facing, and the animation state machine |

## Design notes

**The rig is hierarchical, not skinned.** Named `Object3D` pivots carry no geometry of
their own, and the meshes hang off them. For a rounded mascot this reads better than
skinning — there are no weight artefacts where the limbs meet the body — and it makes
the exploded view fall out for free.

**Every clip writes every joint.** A clip that only moves the arms still emits rest-pose
tracks for the legs and tail. Without that padding, crossfading from a clip that posed
the tail into one that ignores it would leave the tail stuck wherever it was.

**Joint angles were measured, not guessed.** `tools/probe.mjs` sweeps a joint through its
range and reports where the paw actually lands in world space. That is how the arm rest
angle and the wave angle were chosen: the first attempt raised the paw to a point that
turned out to sit *inside* the head volume, so no arm raise was visible at all.

**Squash and stretch does the heavy lifting.** Almost all of the character in the motion
comes from the `spine.scale` curve in each clip, not from the joint rotations.

**Combat clips are additive.** Firing while running must not overwrite the legs, so the
shoot, charge and sabre clips are authored against the rest pose, reduced to deltas with
`AnimationUtils.makeClipAdditive`, and played on a second action in
`AdditiveAnimationBlendMode` over whatever locomotion is running.

**Sign conventions came from the rig, not from intuition.** A limb hanging at `(0,-1,0)`
rotated about `+X` by theta lands at `(0,-cos,-sin)`, so a *negative* x-rotation swings a
limb forward. That is written at the top of `hunterClips.ts` because guessing it wrong
produced a walk cycle that moonwalked.

## Tools

Everything renders headless, so changes can be checked without opening a browser.

```bash
node tools/shot.mjs '[{"name":"idle","wait":1500}]'   # screenshots, plus console errors
node tools/probe.mjs                                  # measure where a joint puts the paw
node tools/gif.mjs "Bounce" 1.0 16 bounce             # frame-by-frame clip dump
python3 tools/sheet.py idle bounce wave               # tile captures into a contact sheet
```

A dev-only `window.__mochi` handle exposes the mascot, mixer and actions for probing.

## Licence

MIT.
