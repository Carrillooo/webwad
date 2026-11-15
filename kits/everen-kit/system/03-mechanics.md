# 03 — MECHANICS CATALOG (the building blocks of the "wow")

A menu, not a checklist. One signature mechanic per site, max one secondary.
Levels: **A** = GSAP/CSS, reliable first try · **B** = simple code + prepared assets (video,
frames, cutouts) · **C** = real WebGL/three.js, needs iterations and good assets.
Rule: if a B-level video fake gives the same visual as a C-level shader, choose B.

Every mechanic below lists: what it looks like → how to build it → assets → pitfalls.

---

## INTROS

All intros live in `10-intros.md` (emblem fill, glint, split reveal, light-on, product entrance,
material wipe, wordmark, shape-mask zoom, signature gesture, no intro). Pick from there.
A percentage counter is NOT an intro type here.

---

## SCROLL

### Frame-sequence scroll (B) — the Apple-style "video that scrubs with scroll"
Build: `<canvas>` pinned with ScrollTrigger (`pin: true, scrub: 0.5`), frames preloaded as
`Image()` objects, draw `frames[Math.round(progress*(n-1))]` in a rAF, cover-fit math,
DPR capped at 2. 90–150 WebP frames at 1920w desktop; serve a half-count set at 1080w on mobile.
Assets: AI video → ffmpeg → frames (`tools/frames.sh`). Pitfalls: don't use `<video>.currentTime`
scrubbing (janky, keyframe-dependent); preload the first 10 frames before showing.

### Frame-sequence orbit (B) — "360° rotation" without a 3D model
Same frames, driven by drag (pointer delta → frame index, with inertia) or by scroll.
Assets: a turntable video (camera static, object rotates 360°, seamless). 60–120 frames.
Pitfall: first and last frame must match for seamless looping — check and trim.

### Sticky card stack (A)
Sections pin at top; the next one slides over; the covered one scales to 0.9 and darkens
(overlay opacity 0 → 0.55). ScrollTrigger per section, `pin: true, pinSpacing: false`.

### Pinned horizontal gallery (A)
Section pinned; inner track translates `x` by `-(trackWidth - viewport)` with scrub.
Add per-item parallax (image inside moves at 0.85 speed) for depth.

### Scroll-as-time (A/B)
Scroll progress drives a narrative: day→night colour grade, year counter, route drawn on a map
(SVG `stroke-dashoffset`), or a frame sequence.

### Split-text reveals (A)
Headlines split into lines/words/chars (write the splitter by hand or use GSAP SplitText),
masked lines slide up `yPercent: 110 → 0`, `expo.out`, stagger 0.04–0.08.
Use on headlines only, not on every paragraph.

### Draw-on-scroll SVG (A)
Line illustration / route / signature draws itself (`stroke-dashoffset`) with scrub.

---

## CURSOR

### Trail-reveal mask (B in 2D canvas / C in WebGL) — the "Kimi" effect
Top layer visible only where the cursor has recently been; the trail fades over ~0.5–0.9s.
Build (2D, reliable): canvas over the base image. Each frame: draw the REVEAL image into an
offscreen canvas; build a mask canvas where you stamp soft radial gradients along the pointer
path (interpolate between pointer samples so fast moves leave no gaps), fade the mask each frame
(`fillRect` with `rgba(0,0,0,0.08)` using `destination-out`); composite reveal with the mask using
`globalCompositeOperation = 'destination-in'`. Add noise to the stamp edge for a liquid feel.
WebGL version (C): same logic in a fragment shader with a trail texture — only if 2D is too slow.
Idle state: when the cursor rests, run an auto "sweep" path so the effect is visible on video
and on touch devices.
Assets: two perfectly aligned images (base + reveal) — same framing, same size. Generate the
reveal from the base via image-to-image with "same framing, same pose".

### Clip-path lens / spotlight (A)
Circle mask follows the cursor revealing an alternative image (x-ray, night version, sketch).
`clip-path: circle(r at x y)` driven by `gsap.quickTo`.

### Cursor tilt / depth parallax (A / C)
A: layered PNG cutouts move at different depths with the cursor (`quickTo`, max ±12px).
C: single photo + depth map in a small WebGL shader (UV offset by depth × pointer) — "2.5D portrait".
Depth map via Depth Anything (see `05-assets.md`).

### Image trail (A)
Images spawn along the cursor path and fade/scale out. Throttle by distance, not time.

### Before/after slider (A)
Draggable divider over two aligned images. Good for clinics, renovation, retouching.

---

## 3D / REAL-TIME (C) — read `04-3d-render.md` first

### Model hero with scroll camera
glTF model, studio HDRI, camera path keyed to scroll (GSAP timeline on camera position/target
with scrub). 3–5 camera "stations" matching sections (front 3/4 → side → wheel close-up → rear).

### Drag-to-rotate viewer
OrbitControls limited (no zoom/pan, polar angle clamped), auto-rotate when idle, damping on.

### Colour configurator
Swap material `color` on named meshes (find mesh names first — log the scene graph).
Only if the model has separated paint material.

### Exploded view
Requires a model with separate parts. Parts translate along their own axes with scroll.
If the model is one merged mesh → fake it with a frame-sequence video instead (B).

### Particles to shape
Sample points from a mesh surface (MeshSurfaceSampler), animate from random positions to
the surface. Heaviest option — only if the concept depends on it.

### Scripted bounce / loop (e.g. car "bounce mode")
NEVER physics for loops. GSAP timeline with `repeat: -1`, keyframes where end state = start state:
body y: 0 → -0.06 → 0 with `sine.inOut`, wheels stay planted, slight pitch on rebound, shadow
scales with height. Tie tempo to a BPM if the video will be filmed to music (e.g. 90 BPM → 0.667s).

---

## TRANSITIONS

### Portal (A)
A rectangle in the centre grows (clip-path inset) to reveal the next section/page.

### Chequered / pixel dissolve (A)
Grid of cells flipping from one colour to the next section's ground, staggered from an edge.

### Video transition overlay (B)
Short generated video (smoke, light burst, ink) played full-screen with `mix-blend-mode: screen`
at the seam, then fades.

---

## LOOPS & UI

### Looping hero video (B)
`<video autoplay muted loop playsinline poster>`; loop point checked (first frame = last frame).
### Scripted UI demo loop (A)
Types a prompt → loading → result → resets. For SaaS/AI products.
### Marquee (A)
Only one per site, only with real content (not fake client logos).
