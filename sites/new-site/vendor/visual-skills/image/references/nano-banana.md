# Nano Banana — Specific Rules

Three tiers. "Thinking" models — they understand intent, physics, composition.

| Tier | Model ID | Role |
|-----|----------|------|
| **NB2 Lite** | `gemini-3.1-flash-lite-image` | Fastest and cheapest ($0.034, ~4 sec), 1K only. Drafts, bulk batches |
| **NB2** (Flash) | `gemini-3.1-flash-image` | Default workhorse: Pro features (text, 4K, grounding, consistency) at Flash speed |
| **NBP** (Pro) | `gemini-3-pro-image` | Top tier: complex multi-layer scenes, maximum reasoning and control |

## Prompt Style

Natural language, 1-2 paragraphs. Structure is flexible, but order helps:
**Subject + Action + Location/context + Composition + Style**

```
A cinematic wide shot of a futuristic sports car speeding through a rainy
Tokyo street at night. Neon signs reflect off wet pavement and metallic
chassis. Format: 16:9.
```

## What NOT to specify

- Numeric lens parameters: **50mm, 85mm, f/2.8, ISO 400** — NB ignores them. Use descriptions: «shallow depth of field», «wide-angle distortion».
- Tag soup: «cool, modern, 4k, cinematic» — write a coherent sentence instead.

## Unique Capabilities

### Image Grounding (NB2 only)
NB2 searches the web for real images before generating. Architecturally accurate specific locations, correct animal/plant species.

```
Generate a cinematic, golden-hour photograph of [SPECIFIC REAL PLACE].
Ensure the architectural details, the spire, the surrounding square, and
the landscape are accurate to reality.
```

**Works for:** buildings, bridges, squares, animal species, plant species, insects.
**Doesn't work for:** specific people.

### Extreme Aspect Ratios (NB2 only)

1:8, 8:1, 1:4, 4:1 — for banners, scrolls, comic strips.

```
Create a 4-panel horizontal comic strip (aspect ratio 4:1).
The story follows [CHARACTER] doing [ACTION] that ends with a twist.
Use a vibrant comic book style. Keep character design consistent.
```

Standard: 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9.

### Thinking Mode

On by default; can't be disabled on NBP (the model draws up to 2 "thought images" in the backend; they aren't billed as images, but thinking tokens are paid). NB2 has a `thinking_level: minimal | high` lever (default `minimal`) — raise it to `high` for:
- Muddled results that need reasoning
- Complex infographics with spatial logic
- Grounding + spatial reasoning at the same time

### Multi-Reference (limits by tier)

| | NB2 Lite | NB2 | NBP |
|---|---|---|---|
| High-fidelity objects | up to 14 | up to 10 | up to 6 |
| Character-consistency refs | no | up to 4 | up to 5 |
| Style refs | no | no | up to 3 |

```
[Image 1: face]
[Image 2: outfit]
[Image 3: background]
Combine: face from Image 1, outfit style from Image 2, setting from Image 3.
Match lighting and perspective.
```

### JSON for complex scenes (5+ elements)

```json
{
  "subject": {"description": "main subject", "expression": "emotion/pose"},
  "photography": {"angle": "eye-level", "shot_type": "waist-up", "aspect_ratio": "16:9"},
  "background": {"setting": "location", "lighting": "soft natural"}
}
```

## Editing in Nano Banana

Conversational, no masks:

```
Remove [OBJECT] from this image.
Fill with [LOGICAL REPLACEMENT] matching surroundings.
Keep [PRESERVED ELEMENTS] exactly the same.
```

After generation, refine iteratively:
- «Make it warmer»
- «Increase contrast»
- «Soften background, add blur»
- «Change headline color to #3b82f6»

The Interactions API keeps session context — up to 3 consecutive edits stack without losing the original. "Edit, don't re-roll" rule: if the image is 80% right, ask for a targeted change, not a new generation.

## Text Rendering

- SOTA across 100+ languages.
- You can name fonts: «Century Gothic 12px», «Brush Script», «Impact», «Heavy blocky sans-serif».
- Multiple languages in one frame works.
- Hack: for complex text — first ask the model to **write the text**, then in a separate prompt «insert this text into the image».

## Resolution / Cost

| Resolution | Use |
|------------|---------------|
| 0.5K | Cheapest, batches and A/B variants |
| 1K | Default |
| 2K | Final selection |
| 4K | Print, hero assets |

**Workflow:** run variants at `0.5K` flash (or NB2 Lite at 1K) → select → regenerate the winner at `2K`/`4K`.

In the API, `image_size` must use a capital K (`1K`, `2K`, `4K`) — `1k` is rejected. `512px` exists only on NB2; Lite is 1K only. Without a size, the model matches the input, otherwise 1:1.

## Keyframes for Video

Nano Banana is the image layer before the motion layer. Lock everything critical in the image BEFORE animation: identity, composition, aspect ratio, visible text, product state. The video model amplifies any ambiguity in the still.

- **Character sheet / hero frame.** Approve one reference frame of the character; all later video prompts point to it.
- **Target aspect ratio from the start.** If the campaign needs a vertical clip, generate 9:16 rather than cropping after animation (a silent failure point).
- **Handoff to the video model is a motion brief, not a recap.** Camera movement, subject movement, background movement, duration, framing lock, forbidden changes. The video prompt doesn't re-describe what's already in the frame.
- Any downstream model: Veo 3.1, Kling 3.0, Seedance 2.0/2.5, Gemini Omni Flash (Google's native pairing, 10-sec clips). Image batch → review gate → only approved stills go to video.

## Known Failures

- Hands and faces still drift (fingers, joints, likeness drift) — explicit anatomy instructions + refs + regenerations. There are reports that NBP holds faces worse than NB2.
- Small text gets blurry at 1K — for dense text use 2K+ or GPT Image 2.
- Infographics may contain factually wrong data — always check numbers; grounding helps but doesn't guarantee accuracy.
- Tendency toward overcooked HDR / oversaturation — ask for «natural contrast, no HDR look».
- A SynthID watermark is on all generations (invisible); on Vertex, C2PA is added too.

## When to switch NB2 → NBP

- NB2 can't handle a complex multi-layer prompt.
- You need the maximum number of references split by role (6 objects + 5 character + 3 style).
- Photoreal with very fine work on materials and light.
- NBP is slower and more expensive; on faces it sometimes loses to NB2 — for a portrait series, test both first.

---

*Author: Serge Shima ([t.me/aimastersme](https://t.me/aimastersme) · [sergeshima.com](https://sergeshima.com) · [aimasters.me](https://aimasters.me)) · License: CC BY 4.0 — attribution required · Source: [smixs/visual-skills](https://github.com/smixs/visual-skills)*
