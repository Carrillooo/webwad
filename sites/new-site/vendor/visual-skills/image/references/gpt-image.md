# GPT Image 2.5 — Specific Rules

Current OpenAI generation (September 2026). Two models, one API and one set of prompting rules:

| Model | Model ID | Role |
|--------|----------|------|
| **GPT Image 2.5 Flare** | `gpt-image-2.5-flare` | Default. Small model optimized for speed; higher quality than GPT Image 2 at ~50% lower latency |
| **GPT Image 2.5 Sunburst** | `gpt-image-2.5-sunburst` | Base model optimized for quality: precision edits, identity preservation, campaign creative, product photography |

Choosing: routine generation and high volume → Flare; complex multi-step edits, critical preservation of faces/products/labels → Sunburst. Working pattern: drafts on Flare, run final deliverables on Sunburst only where Flare fell short. GPT Image 2 and older are migration-only; don't use them in new prompts.

## Prompt Structure — 5 slots

GPT Image 2.5 responds best to prompts split into sections. For complex requests, write with labels, not a wall of text (official docs: «organize the prompt as scene, subject, details, and constraints, using labeled sections»). The format itself is flexible — a short prompt, a paragraph, a JSON-like structure or tags all work the same; pick whichever is easiest to read and update.

```
Scene: location, time of day, background, environment
Subject: primary focus — who or what is central
Important Details: materials, textures, lighting, camera angle, mood, composition
Use Case: editorial, product mockup, UI, poster, infographic
Constraints: what must NOT change/appear (no watermarks, preserve face, no extra text)
```

> «The fifth slot is where most mediocre prompts fail silently.» Without explicit constraints the model drifts.

### Minimal example

```
Scene: small Lisbon florist storefront at blue hour, wet cobblestones
Subject: woman in navy apron locking the front door, half-turned to camera
Important Details: warm interior glow spilling onto pavement, 50mm feel,
  soft contact shadows, brushed brass door handle, "Florista" hand-painted sign
Use Case: editorial photography
Constraints: no extra signage, no people in background, no text other than the sign
```

## Anti-Slop Rules

GPT Image 2.5 is especially sensitive to wording quality. Vague praise = worse results.

| ❌ Don't write | ✅ Write |
|-----------|---------|
| stunning, incredible, epic, gorgeous, masterpiece | overcast daylight, brushed aluminum, chipped paint, 50mm feel |
| «minimalist brutalist luxury photoreal» (style tags) | «cream background, heavy black sans-serif, asymmetrical type block, one hero object, generous negative space» |
| «like an Apple ad» | concrete visual facts |
| moody language that drowns out functional requirements | a direct statement: «image must contain a transit kiosk» |

## Quality Settings — five-step scale

`quality`: `low` · `medium` · `high` · `xhigh` · `max` (+ `auto`). This is a **new scale**, not a renaming of GPT Image 2's three old levels — don't carry settings over one-to-one.

| Setting | When |
|---------|-------|
| `low` | High-volume, previews, exploratory, latency-sensitive, draft |
| `medium` | **Default starting point** |
| `high` | Small/dense text, infographics, portraits, identity-sensitive edits, brand assets |
| `xhigh` | Fine textures, rich detailed scenes, print-ready assets |
| `max` | The model's maximum fidelity — only if `xhigh` didn't meet a specific requirement |

Official docs method: start at `medium`; not enough — step up; enough — try a step down for latency. Use `xhigh`/`max` only when they meet a specific unmet requirement within the latency budget. Change one parameter at a time: quality first, then rewrite the prompt.

## Sizes

- Max edge: ≤3840px
- Both sides: multiples of 16
- Aspect ratio: max 3:1 (long:short)
- Total pixels: 655 360 – 8 294 400
- `size: auto` or custom `WIDTHxHEIGHT`

**Common sizes (from official docs):**
- Portrait 1024×1536 · Landscape 1536×1024 · Square 1024×1024
- 2K: 2048×2048, 2048×1152
- 4K: 3840×2160 (landscape), 2160×3840 (portrait)

**`background`:** `auto` | `opaque` | `transparent` (for transparent — PNG or WebP; check for a real alpha channel, not a "painted" background).

> Extremes like 1:8 / 8:1 are NOT supported by GPT Image 2.5 (3:1 limit) — use Nano Banana.

## Text in Image

- Literal text in `"..."` or ALL CAPS.
- State **how many times** the text should appear («render the tagline exactly once»).
- Font, size, color, position — explicitly.
- Tricky words and brands: spell them letter by letter.
- Guard against junk: «**no extra text, no duplicate text, no watermarks**».
- For illegible small text: «**100 percent readable and physically believable**».
- Small/dense/multi-font → `quality: high` minimum; print-ready dense typography → `xhigh`.

## Editing — two-column logic

Endpoint: `images.edit` (OpenAI API) or `openai/gpt-image-2.5-flare/edit` · `openai/gpt-image-2.5-sunburst/edit` (fal/wavespeed providers). For edit-heavy pipelines, prefer Sunburst.

```
Change: [single concrete change]
Preserve: face, identity, pose, lighting, framing, background, geometry, text, layout
Constraints: no extra objects, no redesign, no drift
```

**Edit rules:**
- **One edit per iteration.** Don't try to change everything at once.
- **Repeat the preserve list every iteration.** «Same style as before» carries context, but on drift — restate critical constraints.
- **Surgical edits:** explicitly list what NOT to touch (saturation, contrast, layout, arrows, labels, camera angle).
- Input fidelity is always high — there's no separate parameter.
- Optional: a mask for targeted edits (see editing with a mask in the official docs).

### Edit patterns

**Virtual try-on:** «Change garments only. Preserve exact face, body shape, pose, hair, expression, background, camera angle. Match lighting/shadows so outfit looks naturally worn.»

**Object removal:** «Remove [X]. Do not change anything else.»

**Lighting/weather swap:** «Change ONLY environmental conditions: lighting direction/quality, shadows, atmosphere, precipitation. Preserve identity, geometry, camera angle, object placement.»

**Interior swap:** «Swap [furniture]. Preserve camera angle, lighting, shadows, surrounding context. Photorealistic contact shadows.»

**Translate in place:** «Translate the text in the infographic to [lang]. Do not change any other aspect of the image.» — then check the translation and any words left in the source language.

**Sketch-to-render:** «Turn this drawing into a photorealistic image. Preserve the exact layout, proportions, and perspective. Choose realistic materials and lighting consistent with the sketch intent. Do not add new elements or text.»

## Multi-Image — up to 16 refs

Index with a **role**, not just a number (subject / style / clothing / background):
```
Image 1: base scene
Image 2: jacket reference (apply only the jacket fabric/cut to subject in Image 1)
Image 3: lighting reference (apply golden-hour quality from Image 3)
```

## Style Transfer

Don't write abstractly («minimalist», «editorial»). Name the reference's concrete visual properties: palette, edge treatment, silhouette, shadow handling, plane logic. Give the reference an explicit role: «use the palette and texture from the input image».

## World Knowledge

GPT Image 2.5 can infer context: «Bethel, NY, August 1969» → it will produce a Woodstock aesthetic. Use this: give a historical/cultural anchor instead of spelling out every detail — but check clothing, staging and surroundings for historical accuracy.

## Iteration Strategy

- Start from a **clean** base prompt.
- One change per round. «Make lighting warmer», «remove extra tree», «restore original background».
- On drift — list the invariants again.
- For long prompts — labeled sections, not one giant block.
- Character consistency across a series: create a character reference in one run, then reuse the image as input and **repeat the character's defining details in every prompt**.

## Check the Result (official docs checklist)

- Is the text accurate and legible? Are diagram labels and connections correct?
- Have identity, product shape, labels and reference details stayed intact?
- Did the edit change only what was requested?
- If transparency is needed — does the file have a real alpha channel, not a filled-in background?

## Use-Case Templates

### Photoreal Editorial
```
Scene: [location, time, weather]
Subject: [who, action, framing]
Important Details: [lens feel, light source, surface wear, imperfections, real texture]
Use Case: editorial photograph, looks like a real photo
Constraints: no glamorization, no heavy retouching, no studio gloss
```

### Product Mockup (Clean Background)
```
Scene: plain white opaque background
Subject: [product] centered
Important Details: crisp silhouette, no halos/fringing, light contact shadow,
  preserve label legibility exactly, preserve geometry
Use Case: product mockup
Constraints: no restyling, only background removal + light polish
```

### UI Mockup
```
Scene: [device frame, e.g. iPhone 15 Pro]
Subject: [screen/app name] — describe AS IF IT EXISTS, not concept art
Important Details: layout, hierarchy, real interface elements, exact copy in quotes,
  typography behavior, spacing, state
Use Case: shipped product screenshot
Constraints: no sketch language, no placeholder text, no Lorem Ipsum
Quality: high (for small UI text)
```

### Marketing Creative with Text
```
Scene: [environment]
Subject: [hero element]
Important Details: [composition, palette, mood]
Use Case: ad creative for [audience]
Text: "EXACT HEADLINE" in [font style], [color], [position], exactly once
      "exact subhead" in [font style], [color], [position]
Constraints: no extra text, no duplicate text, no watermarks, no unrelated logos
Quality: high
```

### Infographic / Diagram
```
Title: "[TITLE]"
Content flow: [step 1] → [step 2] → [step 3]
Visual format: [layout type — flowchart, pyramid, isometric, etc.]
Use Case: educational infographic for [audience]
Constraints: readable labels at all sizes, clear hierarchy, no clutter,
  no decorative noise, ample whitespace
Quality: high
Size: 1536×1024
```

### Logo (transparent)
```
Subject: [brand] logo — [defining shapes], flat design, minimal strokes,
  no gradients unless essential, legible at small and large sizes
Use Case: reusable brand mark
Constraints: single centered logo, generous padding, clean alpha edges,
  no solid backdrop, no scenery, no checkerboard, no watermark
Background: transparent · Format: png
```

## Migration from GPT Image 2 / 1.5 / 1

- Prompts, references and sizes carry over as-is — do the first run unchanged and compare.
- `quality` doesn't map 1:1: the scale is new. Decide what matters more — the same fidelity (old `medium` ≈ new `high`) or the same tier name at lower cost.
- Remove `input_fidelity` (it existed in 1.5/1) — it's always high.
- Starting point: Sunburst for quality → if it passes, try Flare for latency; or go straight to Flare if GPT Image 2 was already good enough.
- Check instruction following, identity/product preservation, text accuracy, unwanted changes, transparency; repeat requests to gauge consistency. For editing pipelines, test the whole chain of edits, not just individual steps.

---

*Author: Serge Shima ([t.me/aimastersme](https://t.me/aimastersme) · [sergeshima.com](https://sergeshima.com) · [aimasters.me](https://aimasters.me)) · License: CC BY 4.0 — attribution required · Source: [smixs/visual-skills](https://github.com/smixs/visual-skills)*
