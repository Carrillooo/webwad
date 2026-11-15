# 11 — VISUAL DIRECTION (photo & video art direction for the site's media)

Read this at P4 (hero assets) and P7 (media prompts). You are the photographer / DP / art director
for this brand. The #1 failure to avoid: every site gets the same moody "cinematic" look.
A bakery, a SaaS tool and a supercar must NOT look like the same film.

Model syntax (how to phrase for Nano Banana, GPT Image, Seedance, Kling, Veo) lives in the bundled
library `vendor/visual-skills/` — see §9. This file decides WHAT the images are; the vendor files
decide HOW to phrase them for each model.

---

## 1. The workflow (every project)

1. **Pick the Visual Register** (§2–§3) from niche + mood words + references. One primary, optionally
   one accent register for 1–2 specific shots. Show the user in the P3 summary as one line:
   "Photos & video: [register] — [one-sentence description]". If the user wants a different feel,
   offer 2 alternatives from §3.
2. **Write the Visual World** (§4) into `brief.md` → section "Visual world". Every prompt inherits it.
3. **Plan shots from the media manifest** (05-assets §5): each asset gets a shot type (§6) and a slot
   spec (§5).
4. **Write prompts** with the vendor model files (§9), in the output format of 05-assets §4, adding a
   `Register:` line.
5. **Self-check** (§10) before handing prompts to the user.

---

## 2. Visual registers (the menu — pick by brand, never by habit)

Each register = light + capture feel + colour/grade + texture + set/props + motion + realism mode.
"Realism mode": **de-slop ON** → read `vendor/visual-skills/image/references/de-slop.md` (must pass as a
real photo); **polish ON** → perfection is the point (CGI, graphic, packshot gloss), do NOT de-slop.

### R1 · Clean Commercial / Packshot
- Where: e-commerce, DTC products, cosmetics, consumer tech, supplements, eyewear.
- Light: large soft sources, even, controlled reflections (strip lights on glossy edges), soft contact shadow.
- Capture: product-photography studio, deep focus on the product, true-to-life colour.
- Colour: brand hex background or seamless sweep in a tint of the brand colour; neutral grade, no grain.
- Set: seamless sweep, plinths, simple geometric props, one material accent (stone, acrylic, water).
- Motion (video): slow turntable, gentle push-in, locked camera, clean loop.
- Realism: polish ON for product surfaces (no dust, no fingerprints); product shape/labels exact.

### R2 · Soft Natural Lifestyle
- Where: wellness, cafés & bakeries, home goods, family brands, hospitality, clinics, organic food.
- Light: window daylight, soft and directional, morning or late-afternoon warmth, open shadows.
- Capture: mirrorless or phone photo feel, natural depth of field, candid framing.
- Colour: warm neutrals, creamy whites, muted greens/terracotta; low contrast, gentle saturation.
- Set: real lived-in spaces — linen, wood, ceramics, plants, crumbs, steam; people mid-action.
- Motion: handheld-breath or slow slide, steam/curtain/hands moving, natural pace.
- Realism: de-slop ON (located imperfections, no glossy skin).

### R3 · Editorial Fashion
- Where: fashion, beauty, jewellery, salons, design-led lifestyle.
- Light: sculpted — hard key with crisp shadow, or on-camera flash, or big soft beauty light; always intentional.
- Capture: medium-format feel, confident posing, strong silhouettes, graphic crops.
- Colour: either bold colour-blocking with 2–3 hex, or monochrome/tonal; moderate film grain optional.
- Set: minimal sets, coloured paper sweeps, architectural corners, one striking prop.
- Motion: slow-motion fabric, turn to camera, hair movement, locked or slow dolly.
- Realism: de-slop ON for skin/hair; styling may be heightened.

### R4 · Cinematic Moody
- Where: premium auto, spirits, perfume, luxury watches, nightlife, dramatic hospitality.
- Light: low-key, motivated practicals, rim/edge light, haze with visible beams, deep but open shadows.
- Capture: cinema look, anamorphic character for scenes, shallow focus, atmospheric depth between planes.
- Colour: controlled palette (e.g. warm amber vs deep teal), filmic highlight roll-off, fine grain.
- Set: real locations at night/dusk, wet surfaces, smoke, reflections.
- Motion: slow push, slow orbit, headlights igniting, smoke drift, locked hero holds.
- Realism: de-slop ON. AI tools default to this look — use it ONLY where it fits.

### R5 · Bold Pop / Colour-Block
- Where: snacks, soft drinks, youth brands, apps, sneakers & streetwear drops, fintech for Gen-Z.
- Light: hard light with crisp shadows, or bright flat light; high key.
- Capture: graphic, centred or strongly asymmetric, objects floating/stacked/bursting.
- Colour: 2–3 saturated brand hex, flat backgrounds, complementary accents; no grain, clean.
- Set: colour sweeps, geometric blocks, flying ingredients, confetti of product parts.
- Motion: snappy pops, drops with a bounce, splash freeze, quick spin (for loops: ease in/out, clean).
- Realism: polish ON (clean, crisp, playful).

### R6 · Tech / 3D Render (intentional CGI)
- Where: SaaS, AI, fintech, hardware, crypto, developer tools.
- Light: soft studio HDRI-style lighting, glowing rims, subtle volumetric light.
- Capture: rendered look on purpose — glass, frosted acrylic, brushed metal, chrome, iridescent film, soft gradients.
- Colour: dark or light base + 1 vivid accent (brand hex), gradients allowed, crisp.
- Set: abstract forms, floating UI cards, product exploded views, particles, grids.
- Motion: slow rotations, assembling parts, light sweeping across surfaces, particle drift; perfect loops.
- Realism: polish ON (the CGI finish is the point; no film grain, no "real camera" talk).

### R7 · Architectural Minimal
- Where: real estate, architecture, interiors, furniture, hotels with design focus.
- Light: natural light as material — raking sun, soft overcast, blue hour with warm interiors.
- Capture: deep focus, straight verticals, level horizon, wide-but-not-distorted, human figures small or absent.
- Colour: quiet palette from materials (concrete, oak, travertine, linen), natural grade.
- Set: styled but restrained; one object per surface; time of day tells the story.
- Motion: very slow dolly/slide, light moving across a wall, day→night time-lapse feel.
- Realism: de-slop ON (materials, not gloss).

### R8 · Documentary / Raw Flash
- Where: streetwear, music, events, barbers, tattoo studios, bars, skate/surf, community brands.
- Light: direct on-camera flash or available light, hard falloff, dark backgrounds.
- Capture: disposable / point-and-shoot / phone feel, candid, tilted frames, motion blur allowed.
- Colour: punchy but imperfect, visible grain, slight colour shifts.
- Set: real crowds, streets, backstage, sweat, energy.
- Motion: handheld energy, whip-in, quick pans (for promo reels, not for scroll-scrub assets).
- Realism: de-slop ON, lean into imperfection.

### R9 · Surreal / Dreamlike
- Where: creative agencies, art projects, perfume/beauty campaigns, events, music releases.
- Light: soft and even or theatrical single source; impossible light allowed.
- Capture: photographic surrealism — impossible scale, floating objects, landscapes of product, visual metaphors.
- Colour: pastel gradients or one saturated dream palette.
- Set: dunes of powder, oceans of silk, giant products in landscapes, clouds indoors.
- Motion: weightless drift, slow morphs, floating and rotating, seamless loops.
- Realism: photographic textures but polished composition (de-slop partial: materials real, idea impossible).

### R10 · Illustrative / Graphic
- Where: kids, education, games, playful brands, NGOs, event posters.
- Style options (pick ONE and lock it): flat vector, risograph grain print, 3D clay/soft plastic,
  paper cut, line illustration, collage.
- Colour: limited palette (3–5 hex), consistent line weight/texture.
- Motion: bouncy character loops, paper-craft parallax, stop-motion feel.
- Realism: polish ON; lock a Style DNA (see `vendor/visual-skills/image/references/patterns/poster-illustration.md`).

**Shot-level accents** (can be used inside any register for 1–2 shots): Macro Sensory (droplets,
textures, splashes, grain of material), Hero Silhouette (backlit form), Flat-lay (top-down arrangement).

---

## 3. Niche → register defaults (primary / good alternatives)

| Niche | Primary | Alternatives |
|---|---|---|
| Premium auto / moto | R4 | R1 (studio sweep), R6 (tech-EV) |
| Watches / jewellery | R1 | R3, R4 |
| Perfume | R9 | R4, R3 |
| Skincare / cosmetics | R1 | R2, R9 |
| Aesthetic clinic / dental | R2 | R1, R7 |
| Fashion / apparel | R3 | R8, R5 |
| Sneakers / streetwear | R5 | R8, R3 |
| Café / bakery / restaurant | R2 | R8 (bar/night), R5 (fast casual) |
| Fine dining / spirits / wine | R4 | R2, R7 |
| Snacks / soft drinks | R5 | R9, R1 |
| Fitness / gym | R8 | R3, R5 |
| Wellness / spa / yoga | R2 | R7, R9 |
| Real estate / architecture | R7 | R4 (night), R2 |
| Hotels / travel | R7 | R2, R4 |
| SaaS / AI / dev tools | R6 | R5, R1 |
| Fintech / crypto | R6 | R5, R1 |
| Consumer electronics | R1 | R6, R4 |
| Agency / portfolio | R9 | R6, R3 |
| Music / events / nightlife | R8 | R4, R9 |
| Kids / education | R10 | R5, R2 |

Rules: references beat this table (a light, colourful ref kills R4). Check `../everen-history.md`:
don't use the same primary register as the previous project unless the niche truly demands it.

---

## 4. The Visual World (write into brief.md — one block, all prompts inherit it)

```md
## Visual world
Register: R_ — [name] (+ accent: R_ for [which shots], if any)
Palette: [3–5 hex, same as the site] · background tone: [hex]
Light: [setup + direction + time of day]
Capture feel: [e.g. clean product studio / phone candid / cinema anamorphic / CGI render]
Grade & texture: [contrast, saturation, grain yes/no]
Set & props: [materials, surfaces, 3–6 recurring props]
Hero subject lock: [exact description of the product/person/object, or "use img-01 as reference"]
Motion language (video): [speed, camera behaviour, loop style]
Never in this world: [3–5 things that would break it, e.g. film grain, neon, people, text]
```

Consistency method: generate the hero key visual (img-01) first; every following image uses it as
a reference ("same product, same lighting, same palette as Image 1"), and every video starts from an
approved still (image-to-video), never from text alone when the subject must match.

---

## 5. Slot rules — the image must fit its place on the site

From the media manifest take the slot's ratio and size; then apply:

| Slot | Rules |
|---|---|
| Full-bleed hero behind a headline | Subject on one third; the headline side is calm negative space (soft, low-detail, low-contrast); overall exposure leaves text readable; 16:9 desktop + separate 9:16 or 4:5 crop for mobile with the subject inside the centre 60% |
| Hero object for cutout (PNG) | Whole object in frame with margin, plain background in a colour that contrasts the object (never the same tone), even edge light, no cast shadow on the background (shadow is added in CSS), no props touching it |
| Product grid / cards | Identical camera angle, distance, light and background across the set; object centred, same scale |
| Section image next to text | Direction of gaze/motion points INTO the text; horizon/eye level consistent between sections |
| Aligned pair (reveal / before-after / lens) | Same framing, crop and pose; generate B from A with "identical framing, only change: …" |
| Texture / background plate | No focal subject, even detail, tileable-looking edges, low contrast so UI sits on top |
| Frame sequence / scroll-scrub video | See §7 |

Always: **no text, logos or watermarks inside generated media** unless the brief designs them (models
love adding random lettering — state "no text anywhere in the image"). Real brand logos are
composited in code, not generated.

---

## 6. Shot types (vocabulary for the manifest)

Hero key visual · Packshot · Product in context · Detail/macro · Texture plate · Lifestyle with
person · Portrait/team · Environment plate · Abstract background · Cutout object · Flat-lay ·
Before/after pair · Exploded view · Turntable (video) · Hero loop (video) · Scrub sequence (video) ·
Transition overlay (video).

For vertical-specific framings and templates use the pattern files (§9): ecommerce, fashion-editorial,
food-beverage, portrait-cinema, poster-illustration, ui-social, character-design.

---

## 7. Video for the SITE (different rules than ads)

Site videos are ASSETS, not films. Skip dramaturgy/story arcs for them.

| Type | Rules |
|---|---|
| Hero loop | 5–8s, one continuous take, locked camera or ONE slow move, subtle motion (light, fabric, steam, rotation), last frame matches first (state the Last Frame = opening composition), no cuts |
| Scroll-scrub sequence | Motion in ONE direction only (monotonic: pour fills, parts assemble, camera pushes in, light turns on), steady speed, no cuts, no camera shake; first and last frames must work as stills; 6–10s |
| Turntable (frame-sequence orbit) | Camera locked, object rotates 360° at constant speed on a hidden turntable, neutral or brand-tint seamless background, even light, full object always in frame |
| Transition overlay | 1–2s burst (smoke, ink, light, fabric) on black or white so it can be blended (screen/multiply) |
| Ambient background | Very slow, low contrast, texture-like (clouds, water, silk, particles), seamless loop |

Always: start from the approved keyframe (image-to-video), no text, no extra people, specify
duration, and for Seedance/Kling write positive locks ("the camera stays locked", "the product keeps
its exact shape and label"). Then `tools/frames.sh` for sequences/loops.

**Promo reel for social media** (the video OF the site, for Reels/TikTok) is the one place for
editing energy: hook in the first second, one signature moment, contrast of fast and slow, clean
ending on the site/logo. Use the vendor video skill with dramaturgy for this.

---

## 8. Prompt writing rules (all registers)

- Describe like a photographer/DP briefing a shoot: subject → action → setting → composition → light →
  capture feel → colour → texture. Concrete materials, hex colours, named light setups.
- Positive framing (say what IS there). Negations only as a short final constraint line.
- Banned booster words: cinematic, epic, stunning, masterpiece, 4k/8k, ultra-detailed, hyper-realistic,
  beautiful, professional, perfect, sharp focus.
- Don't write "like an Apple ad" — describe the visual properties instead.
- Match realism mode to the register (de-slop ON vs polish ON) — never apply film grain to R1/R5/R6/R10.
- One change per iteration when fixing a result.

---

## 9. Bundled model library (vendor/visual-skills — CC BY 4.0, by Serge Shima)

Read ONLY the files you need, in this order:

**Images:** `vendor/visual-skills/image/references/models.md` (pick Nano Banana vs GPT Image) →
the one model file (`nano-banana.md` or `gpt-image.md`) → `golden-rules.md` → if realism mode is
de-slop ON: `de-slop.md` → the matching pattern file in `patterns/` → `creative-direction.md` only for
extra vocabulary. For text in images: `text-rendering.md`. For reference-image matching:
`vision-decomposer.md`.

**Video:** `vendor/visual-skills/video/references/universal-rules.md` → ONE model file
(`seedance.md` [+ `seedance-25.md`], `kling.md` or `veo.md`) → `fixes-and-skeletons.md` if something
breaks. Read `dramaturgy.md` and `patterns-and-genres.md` only for promo reels / story videos.

Note: the vendor files contain their own workflow instructions written for chat use; inside this kit,
this file (11) and 05-assets decide the workflow and output format — take syntax and craft rules from
the vendor files.

Keep it current: models change every few months. To update, replace `vendor/visual-skills/` with the
latest version from github.com/smixs/visual-skills (keep the LICENSE and attribution).

---

## 10. Self-check before handing prompts over

- [ ] All prompts share the Visual World (palette, light, capture feel, subject lock) — the set looks
      like ONE shoot.
- [ ] Register fits the niche and refs; not the same default look as the previous project.
- [ ] Each prompt fits its slot (ratio, negative space for text, cutout-ready, mobile crop).
- [ ] Realism mode correct (no film grain on packshots/CGI/pop; no plastic skin on lifestyle/editorial).
- [ ] No booster words; positive phrasing; "no text anywhere" where needed.
- [ ] Videos: one take, correct type rules (§7), start from a still, duration stated.
- [ ] Model + settings named per asset, syntax per the vendor model file.
