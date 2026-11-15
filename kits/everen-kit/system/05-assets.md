# 05 — ASSETS PIPELINE (images, video, frames, 3D, depth)

Assets are the real bottleneck of award sites. Code is cheap; a great hero asset is the site.

## 1. Two moments for assets

- **P4 (before build): hero-critical only** — what the signature mechanic can't exist without.
- **P7 (after build): everything else** — written from the MEDIA MANIFEST so formats match the
  real layout (never write a 16:9 prompt for a slot that ended up 4:5).
Everything not produced yet gets a placeholder file with the exact final name and size
(`assets/img-03.jpg` as a neutral grey 4:5), so the layout is built at the right ratios.

## 2. Tools (user generates by hand, or you via MCP if connected and the user agrees)

| Asset | Tools | Notes |
|---|---|---|
| Photo / key visual | Nano Banana (Gemini), GPT Image, Higgsfield | generate #1 first, then use it as reference for consistency |
| Video (loop, turntable, scrub) | Seedance 2.0, Kling, Higgsfield | static camera for turntables; 5–10s |
| Cutout (no background) | Higgsfield remove background, remove.bg, Photoshop | ask for plain solid background in the generation prompt |
| 3D model from image | Higgsfield 3D, Meshy, Tripo | good for props; cars/products still look best from real models |
| Ready 3D models | Sketchfab (check licence), Poly Pizza, Fab | see `04-3d-render.md` §2 |
| Depth map (2.5D parallax) | Depth Anything V2 (free HF Space) | save as greyscale PNG, same size as photo |
| Normal map | compute from depth yourself (small python/numpy script: gradients → RGB) | |
| HDRI | Poly Haven (CC0) | 2k .hdr |
| Frames from video | `tools/frames.sh` (ffmpeg) | WebP, 90–150 frames desktop, half on mobile |

## 3. Recipes for mechanic-specific assets

**Turntable (for frame-sequence orbit):**
Video prompt skeleton: "[object] on a seamless [colour] studio floor, camera locked off, eye level
[or 15° above], the object rotates 360° on a hidden turntable at constant speed, soft top light +
large side softbox, gentle contact shadow, no camera movement, no background change, 10 seconds."
Then: check first vs last frame; trim to a seamless loop; `tools/frames.sh`.

**Aligned pair (for trail-reveal / lens / before-after):**
Generate the BASE image. Then image-to-image with the base as reference: "identical framing,
identical pose and crop, same lighting, only change: [helmet on / x-ray / night / tattoo]".
Verify alignment by overlaying at 50% opacity; nudge in an editor if needed.

**Scroll-scrub story (frame sequence):**
One continuous shot with ONE clear change (pour, assembly, light turning on, camera push-in).
Start and end frames must work as still images (they're what people see when not scrolling).

**Hero loop:** first frame = last frame; subtle motion only (light, fabric, smoke, rotation).

## 4. Media prompt output format (always this structure)

```
Visual prompts — [BRAND]
Works in: [services]. Generate #1 first; for the rest attach #1 as reference (if consistency needed).

---
Photo/Video #[N] — [short name]      (ID in code: img-0N / vid-0N)
Shot type: [from 11-visual-direction §6]   Register: [R_ from the Visual World]
Model: [specific model + settings for THIS shot, per vendor models.md]
Reference: [none / Photo #X — what to take from it]
Format: [ratio], [exact px for its slot], [JPG/PNG/WebP/MP4]
Duration: [video only — seconds + loop / no loop]
` ` `
[prompt]
` ` `
```
**Art direction and prompt craft live in `system/11-visual-direction.md`** — read it before
writing any photo/video prompt: Visual Register (10 looks, not one), Visual World block in
`brief.md`, slot rules, video-for-web rules, and the bundled model-syntax library.

## 5. Media manifest (end of P5 build — mandatory)

Table of EVERY asset referenced in code: ID · type · placement (section + role) · rendered ratio
and approx px · content direction · (video) duration + loop. No asset missing, no unused row.
Then in P7 write prompts from it in the format above.

## 6. File hygiene

```
assets/
  img/        img-01.webp ...
  video/      vid-01.mp4 (H.264, muted, ≤ 6 MB) + poster
  frames/     seq-01/0001.webp ...
  models/     model.glb (Draco)
  hdri/       studio.hdr
```
Compress: images WebP q80, ≤ 400 KB for full-bleed; videos ≤ 6 MB, 1080p, `-movflags +faststart`.
