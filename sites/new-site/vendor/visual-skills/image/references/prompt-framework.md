# Prompt Framework

A universal checklist for building a prompt. Applies to **both** model families. For the differences, see:
- [nano-banana.md](nano-banana.md) — NB specifics (grounding, extreme ratios, thinking mode, JSON)
- [gpt-image.md](gpt-image.md) — GPT Image 2.5 (5-slot template, anti-slop, quality settings)
- [models.md](models.md) — which model to pick when

## Task Types (Skills)

Identify the task type — it sets the prompt strategy:

| Type | When to use | Key elements |
|------|-------------------|-------------------|
| **Photorealistic** | Photos of people, products, scenes | Lighting, materials, atmosphere |
| **Illustration** | Stickers, icons, art | Style, outlines, palette |
| **Product/Commercial** | Product photography | Surface, reflections, composition |
| **Minimalist** | Negative space | What to remove matters more than what to add |
| **Sequential** | Comics, storyboards | Panels, transitions, narrative |
| **Editing** | Changing an existing image | Specific instructions on what to change |
| **Style Transfer** | Transferring a style | Reference + new content |
| **Composite** | Combining elements | Coherence, lighting, scale |
| **Text Rendering** | Text in the image | Exact quotes, position, weight |

## Universal Elements (Checklist)

Go through the list — not everything needs to be specified, but it's worth checking:

**Required:**
- **Subject** - who/what is the focus
- **Context** - what it's for (defines the style)

**As needed:**
- **Action** - what is happening
- **Environment** - where it happens
- **Camera** - shot size (close-up, wide shot, etc.)
- **Lighting** - type of light
- **Mood** - emotion of the scene
- **Materials** - surface textures
- **Palette** - colors (hex is better)
- **Format** - aspect ratio

> ⚠️ **Lens parameters** (50mm, 85mm, f/2.8, ISO):
> - **Nano Banana** — ignores numbers, describe it instead ("shallow depth of field")
> - **GPT Image 2.5** — accepts "50mm feel" as a high-level look, but not as an exact physical simulation

## Detail Modes

**Concise** - one sentence, for fast iterations:
```
Minimalist poster: white background, single red apple, centered, dramatic shadow.
```

**Standard** - 1-2 paragraphs, a balance of control and flexibility:
```
Create a product shot for premium headphones marketing.

Matte black headphones on dark slate surface. Single spotlight from upper left creates dramatic shadow. Background gradient from #1a1a1a to pure black.

Format: 16:9
```

**Verbose** - maximum detail for complex scenes:
```
Create a cinematic wide shot for sci-fi film concept art.

Setting: Abandoned space station observation deck. Massive curved window spans entire wall, revealing dying red giant star filling half the frame. Station interior in deep shadow except where crimson light bleeds through.

Subject: Lone astronaut in weathered EVA suit, helmet off, sitting on debris pile. Back to camera, facing the star. Pose suggests exhaustion and acceptance.

Atmosphere: Dust particles float in zero-g, catching red light. Abandoned equipment scattered - coffee cup frozen mid-float, papers suspended. Frost crystals on interior surfaces where life support failed.

Mood: Melancholic beauty, end of an era
Lighting: Volumetric god rays from star through window
Format: 2.39:1 cinemascope
```

## Output Structure

When creating a prompt, output:

**1. Prompt** - ready to use

**2. Parameters** - if non-standard:
- Aspect ratio (if not 1:1)
- Resolution (if 2K/4K is needed)

**3. Exclusions** - what to exclude (optional):
> Phrase it positively! NBP understands "clean background" better than "no clutter"

**4. Assumptions** - what was filled in if the user didn't specify

## Quick Decision Tree

```
What are we creating?
├── Photo of a real object/person → Photorealistic
├── Drawing/art → Illustration  
├── Product for sale → Product/Commercial
├── Lots of empty space → Minimalist
├── Multiple frames/story → Sequential
├── Changing an existing photo → Editing
├── "Like in this picture" → Style Transfer
├── Assembling from several elements → Composite
└── Text is the main element → Text Rendering
```

> Image grounding (looking up real places on the web) and extreme ratios (1:8, 8:1, 4:1) — Nano Banana only. See [nano-banana.md](nano-banana.md).

## Examples by Type

### Photorealistic
```
Portrait of a weathered fisherman, 60s, deep wrinkles and sun-damaged skin.
Early morning golden hour on wooden dock.
Holding fresh catch, genuine smile of satisfaction.
Background: misty harbor, fishing boats soft focus.
Mood: authentic, documentary style
```

### Product/Commercial
```
Product shot: luxury watch on raw concrete slab.
Single hard light from upper right, creating defined shadow.
Watch face at 10:10 position, metal bracelet draped naturally.
Background: gradient gray, vignette edges.
Style: high-end catalog, editorial
Format: 4:5
```

### Minimalist
```
Single origami crane, red paper, centered.
Pure white infinite background.
Soft diffused light, barely visible shadow.
Extreme negative space - crane occupies <10% of frame.
Format: 1:1
```

### Text Rendering
```
Motivational poster for gym.

Background: dark textured concrete, subtle vignette.

Text:
"DISCIPLINE" in extra bold, white, centered upper third
"beats talent" in thin weight, #808080, centered below

Small icon: minimal dumbbell silhouette, bottom center
Format: 9:16 (stories)
```

## Parameterized Templates

The `{variable}` pattern for reusable prompts. The prompt structure stays stable — only what needs to change changes.

### Syntax

Variables are written as `{name, default="value"}`. If no value is given, the default is used. If there is no default, the variable is required.

### Template

```
Scene: {location, default="small Lisbon florist storefront at blue hour"}
Subject: {person, default="woman in navy apron"} {action, default="locking the front door"}
Important Details: {lighting}, {lens_feel, default="50mm feel"}, {key_texture}
Use Case: {use_case, default="editorial photography"}
Constraints: {constraints, default="no extra signage, no people in background"}
```

### How to use

1. **Replace only what changes** — everything else comes from the defaults
2. **The structure is stable** — slot order is the same for all variations, so the model gets a consistent format
3. **Batch generation** — ideal for series: product angles, character poses, locations in one style

### Usage examples

**Product shot series** (only the product and texture change):
```
Scene: {location, default="marble kitchen counter, morning light"}
Subject: {product} on {surface, default="raw linen cloth"}
Important Details: {lighting, default="soft window light from left"}, {lens_feel, default="85mm feel"}, {key_texture}
Use Case: {use_case, default="e-commerce hero shot"}
Constraints: {constraints, default="clean background, no props except surface"}
```

**Character pose series** (action and mood change):
```
Scene: {location, default="industrial loft studio"}
Subject: {person, default="man in black turtleneck"} {action}
Important Details: {lighting, default="single softbox, camera right"}, {lens_feel, default="50mm feel"}, {key_texture, default="fabric texture visible"}
Use Case: {use_case, default="fashion editorial"}
Constraints: {constraints, default="no visible logos, neutral expression"}
```

## Cinematic Verbose Mode

Standard verbose is 5-7 lines. **Cinematic verbose** is a level up, for when you need maximum detail: hero shots, key visuals, campaign centerpieces.

### When to use

- The final campaign visual, not an iteration
- A hero shot for a landing page or cover
- A key visual that will be scaled across all formats
- Portfolio work where every pixel matters

### Micro-detail checklist

Add on top of standard verbose — these are extra layers, not a replacement:

1. **Surface wear & aging** — "chipped paint on window frame, hairline scratches on metal surface, green patina on copper fittings, oxidation marks on iron hinges"
2. **Micro-textures** — "visible pores on skin, individual hair strands catching backlight, fabric weave pattern on linen shirt, grain of weathered wood"
3. **Atmospheric particles** — "dust motes suspended in light beam, steam wisps rising from coffee cup, pollen floating in golden hour air, fine rain droplets on glass surface"
4. **Specular behavior** — "specular highlights on metal edges of watch, caustic reflections dancing inside glass bottle, wet surface sheen on cobblestones after rain"
5. **Fabric & material drape** — "natural fabric folds at elbow crease, gravity pull on loose linen garment, weight distribution visible in heavy wool coat"
6. **Contact shadows** — "soft contact shadow where cup meets saucer, ambient occlusion in crevices of stone wall, dark line where book spine meets table"
7. **Environmental reflections** — "building reflections in wet pavement, sky gradient in chrome bumper surface, warm neon glow on skin from nearby sign"
8. **Motion cues** — "slight motion blur on trailing hair strand, frozen splash droplet from espresso pour, wind-displaced fabric edge of scarf"

### Before / After

**Standard Verbose:**
```
Create a cinematic portrait for coffee brand campaign.

Setting: Small Italian café, early morning. Espresso machine prominent in background.
Subject: Barista in white shirt, mid-pour, focused expression.
Atmosphere: Steam rising, warm tones, golden morning light through window.
Mood: Craftsmanship, ritual, quiet dedication
Lighting: Warm directional light from left window
Format: 4:5
```

**Cinematic Verbose:**
```
Create a cinematic portrait for coffee brand campaign.

Setting: Small Italian café, early morning. Brass-and-chrome La Marzocca espresso machine in background, oxidation marks on steam wand, hairline scratches on drip tray from years of use. Chipped paint on wooden window frame behind machine.

Subject: Barista in white linen shirt — fabric weave pattern visible, natural folds at rolled-up sleeves, gravity pull on loose collar. Mid-pour with focused expression, visible pores on forehead, individual eyebrow hairs catching backlight.

Atmosphere: Steam wisps rising from espresso cup, dust motes suspended in morning light beam cutting through window. Fine coffee grounds scattered on worn marble counter — soft contact shadow where cup meets saucer. Wet surface sheen on freshly wiped counter edge.

Details: Specular highlights on chrome portafilter handle. Caustic reflections dancing inside glass water carafe on shelf. Warm neon glow of "APERTO" sign reflecting on barista's forearm. Slight motion blur on trailing steam, frozen droplet mid-drip from group head.

Mood: Craftsmanship, ritual, quiet dedication
Lighting: Warm directional light from left window, volumetric through steam
Format: 4:5
```

---

*Author: Serge Shima ([t.me/aimastersme](https://t.me/aimastersme) · [sergeshima.com](https://sergeshima.com) · [aimasters.me](https://aimasters.me)) · License: CC BY 4.0 — attribution required · Source: [smixs/visual-skills](https://github.com/smixs/visual-skills)*
