# 04 — 3D: choosing the technique + making real-time 3D look expensive

## 1. Pick the technique (hard decision tree)

| Need | Technique | Level |
|---|---|---|
| Static "expensive" object in the layout | PNG cutout + shadow + parallax | A |
| Rotation tied to scroll/drag, look matters most | Frame sequence from a turntable video | B |
| Object moves by itself forever (hero) | Looping video | B |
| User freely rotates / configures / camera flies around in real time | glTF + three.js | C |

A frame sequence from a good AI video usually LOOKS better than real-time 3D of a mediocre free
model. Real-time 3D wins only when interaction (free rotate, configure, cursor response) is the point.
If the concept needs 3D and there's no good model → fall back to frame sequence and say so.

## 2. Model intake (do this before writing any scene code)

0. **Getting the model (user is a beginner — spell it out):** suggest 2–3 concrete model links that fit the
   concept (Sketchfab search: Downloadable filter on; prefer < 500k triangles — shown on the model page).
   Tell the user: log in (free) → open the model → **Download 3D Model** → pick **glTF / GLB** →
   put the .glb (or the unzipped folder) into `assets/models/` → write "done". Say the licence shown in
   the download window in plain words (CC0 = free, CC-BY = credit in footer, NoDerivs/NonCommercial = portfolio only).
1. Put the model in `assets/models/`. Check the licence (CC-BY → credit in footer; "no commercial"
   → portfolio only). Car/brand logos: fine for demo/portfolio, not for a third party's commercial site.
2. Inspect: write a small node script with `@gltf-transform/core` (or `npx @gltf-transform/cli inspect`)
   to list meshes, materials, triangle count, texture sizes. Report to the user in plain words.
3. Red flags: > 1.5M triangles, textures > 4k, missing normals, one merged mesh when you need parts,
   materials with metalness 1 + roughness 0 everywhere (looks black without env), baked lighting
   in the base colour (looks flat and dirty).
4. Optimise: `npx @gltf-transform/cli optimize in.glb assets/models/model.glb --compress draco --texture-compress webp --texture-size 2048`
   Draco-compressed files need `DRACOLoader` with a decoder path from the same three version CDN.
5. Log the scene graph (mesh + material names) once, so you can target paint/glass/tyres by name.

## 3. The "looks expensive" renderer baseline (vanilla three.js)

```js
renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;   // product/white scenes; ACESFilmic for dark/moody
renderer.toneMappingExposure = 1.0;                // tune 0.8–1.4 while looking at screenshots
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Environment = 80% of the look. Never ship a model lit only by Ambient/Directional lights.
const pmrem = new THREE.PMREMGenerator(renderer);
const hdr = await new RGBELoader().loadAsync('assets/hdri/studio.hdr'); // HDRLoader in newest three
scene.environment = pmrem.fromEquirectangular(hdr).texture;
scene.environmentIntensity = 1.0; // 0.6–2.0
```
- Base-colour / emissive textures must be `SRGBColorSpace`; normal/roughness/metalness stay linear.
- HDRI: Poly Haven (CC0) studio HDRIs — e.g. "studio_small_09", "photo_studio_loft_hall",
  "brown_photostudio_02". Download 2k .hdr into `assets/hdri/`.
- Add ONE key DirectionalLight for crisp shadows; the HDRI does the rest.

## 4. Light scene (white studio) — extra rules

- Background colour = floor colour (e.g. #F2F2EF); `scene.fog = new THREE.Fog(bg, near, far)`
  so the floor melts into the backdrop (infinite cyclorama look).
- Floor: large plane with `ShadowMaterial({ opacity: 0.25–0.4 })` + a soft baked contact-shadow
  texture under the object (radial blur PNG). Optional subtle reflection (MeshReflectorMaterial
  equivalents are heavy — fake with a flipped, faded copy only if needed).
- Tone mapping `NeutralToneMapping`, exposure 1.1–1.3; bright studio HDRI.
- Dark object on light ground reads best. White object on white → change the ground colour
  or add a strong rim/shadow.

## 5. Material fixes (named meshes)

| Part | Material |
|---|---|
| Car paint | `MeshPhysicalMaterial` metalness 0.5–0.9, roughness 0.25–0.4, clearcoat 1, clearcoatRoughness 0.03–0.1 |
| Chrome | metalness 1, roughness 0.05–0.15 (needs env!) |
| Glass | transparent, opacity 0.25–0.4, roughness 0, metalness 0 — avoid `transmission` unless needed (expensive) |
| Tyres / rubber | metalness 0, roughness 0.85–0.95, near-black #111 |
| Plastics | metalness 0, roughness 0.4–0.6 |

## 6. "The model looks dark / muddy / cheap" — checklist in this order

1. `scene.environment` set? (No env = dark metal.)
2. `outputColorSpace = SRGBColorSpace` and base-colour textures in sRGB?
3. Tone mapping + exposure (try Neutral at 1.2).
4. Metalness too high with nothing to reflect → lower metalness or brighter HDRI.
5. Baked dark AO/lighting in textures → lighten base colour or replace material.
6. Camera: 30–40° FOV for product (wide FOV distorts); 3/4 front view at slight low angle.
7. Still bad → the model is the problem: switch to frame sequence (render or AI video) and tell the user.

## 7. Motion & performance

- Camera moves: GSAP timelines on `camera.position` + a `target` vector, `lookAt` each frame,
  scrubbed by ScrollTrigger. Ease with `power2.inOut`. No OrbitControls during scroll scenes.
- Loops: scripted GSAP keyframes, never physics (see `03-mechanics.md`).
- Pause rendering when the canvas is off-screen (IntersectionObserver).
- Render at DPR ≤ 2, cap to 1.5 on mobile; test on a mid laptop. Target 60fps; intro must not drop frames
  → compile shaders before the intro starts (`renderer.compile(scene, camera)`), then play.
- Fallback: if WebGL fails, show a poster image — never an empty stage.
