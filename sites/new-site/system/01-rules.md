# 01 — BUILD RULES (taste + discipline)

## 1. Stack — decide, don't vibe

| Site type | Stack |
|---|---|
| Landing / promo / portfolio, 1–5 pages, no CMS (80% of cases) | `index.html` + `style.css` + `main.js`, no framework, no build step. GSAP 3 + ScrollTrigger + Lenis from CDN |
| Needs real-time 3D (model you rotate, shaders, particles) | Same as above + three.js via import map (ES modules) |
| Blog / many pages / shop / login / real SEO | Next.js (App Router) or Astro; R3F only if 3D |

Default when unsure: plain HTML + GSAP + Lenis. Say the stack explicitly in `brief.md`.
Pin CDN versions (e.g. `gsap@3.13`, `lenis@1.3`, `three@0.18x`). Lenis must drive ScrollTrigger
(`lenis.on('scroll', ScrollTrigger.update)` + `gsap.ticker`).

## 2. Typography system (the #1 reason sites look cheap or premium)

Always specify with numbers:
- **Display:** family, weight (usually 700–900 or a real hairline 100–200 — never a mushy 300–400
  for headlines), size `clamp()` range, line-height (0.85–0.95 for display), tracking
  (-0.02 to -0.06em for large grotesques), case.
- **Body/UI:** family, 14–18px, weight 400–500, line-height 1.4–1.6.
- **Contrast rule:** display size ≥ 6× body size somewhere on the page. Award sites have a huge
  size range; AI sites keep everything medium.
- **Colour rule:** text on light ground is #0A0A0A–#1A1A1A, never mid-grey for primary text.
  Grey (#6B6B6B-ish) only for secondary lines.
- Max 2 families. The second one must be justified by the brand, not habit.
- Pull fonts from Google Fonts or Fontshare. Good starting pool (pick by mood, don't default):
  Condensed power — Oswald, Anton, Bebas Neue, Big Shoulders Display, Archivo (Expanded/Condensed).
  Grotesque — Inter Tight, Manrope, Space Grotesk, General Sans, Satoshi, Switzer, Clash Display.
  Editorial serif — Instrument Serif, Fraunces, Playfair Display, Cormorant, Gambarino, Zodiak.
  Wide luxury — Unbounded, Syne, Archivo Expanded, Clash Grotesk.

## 2b. UI surface styles (glassmorphism, neumorphism / soft UI, dark soft UI)

Popular and legitimate for SaaS, apps, fintech, smart devices, EV/auto-tech dashboards, crypto.
Use when: the niche is product/app-like, OR the refs show it, OR the user asks. Record in `brief.md`
("UI surface: glass / soft UI / flat"). One surface style per site; the hero may break it.

Do it with numbers, not the word (the word alone gives generic blurry white cards):
- **Glassmorphism:** only over something worth blurring (image, 3D, gradient, video) — glass on a flat
  background is pointless. `backdrop-filter: blur(16–28px) saturate(140%)`; fill rgba(255,255,255,.06–.14)
  on dark / rgba(255,255,255,.35–.55) on light; 1px border rgba(255,255,255,.12–.25) (brighter top edge);
  soft shadow 0 8–30px 60px rgba(0,0,0,.25–.45); optional 2–4% noise to kill banding; radius 16–28px.
  Provide a solid fallback when backdrop-filter is unsupported.
- **Neumorphism / soft UI** (like dark car-app dashboards): element colour = background colour (e.g.
  #2A2D32 on #2A2D32); depth from a light shadow top-left + dark shadow bottom-right
  (e.g. -6px -6px 14px rgba(255,255,255,.05), 8px 8px 18px rgba(0,0,0,.45)); pressed state = inset
  shadows. Low contrast by nature → keep ONE vivid accent (e.g. #1E90FF) for primary actions,
  active states and data, and keep text at readable contrast (≥ 4.5:1 for body).
- **Dark soft UI** (the mix): near-black graphite base, soft inner/outer shadows on controls, glass
  panels over the product render, one glowing accent.
- Pair with a hero render/photo of the product (R6 or R1 register in 11-visual-direction) —
  the surfaces frame the object, they are not the concept.
- Motion: soft springs on press (scale .97), glow on the accent, cards lifting 2–4px on hover —
  subtle, no magnetic buttons.

## 3. Hard bans (apply always, silently)

- No Space Mono. No monospace for nav/buttons/labels/body unless the art direction explicitly
  calls for it.
- No "eyebrow" micro-labels above headlines, no section index tags at frame edges
  ("SEC.02 / FLAVOURS", "EST. 2026"). Sections open with the headline itself.
- No pill-shaped chip rows / tag clusters under CTAs. Express specs through type scale and layout.
- No magnetic cursor-following buttons (unless requested — then max 1 element).
- No random gradient-blob / purple-glow hero, no emoji as icons. Glass / soft-UI surfaces are NOT banned —
  use them deliberately per §2b, not as decoration on every card.
- No "Trusted by" logo strip, no 3-card feature grid with icons, no testimonial carousel —
  unless the brief truly needs them; then design them, don't template them.
- No lorem ipsum. Write real, short, confident copy for the brand (headlines ≤ 6 words).
- Media-prompt words banned: cinematic, epic, stunning, masterpiece, 4k, beautiful, professional.
  Describe light, material, lens, composition instead.

A ban is lifted only by an explicit line in `brief.md` → "Allowed exceptions".

## 4. Reference fidelity (the anti-"dark-minimal" lock)

Models drift to dark, sparse, minimal layouts. When refs exist:
- Background: LIGHT or DARK — one word, from the refs, never assumed.
- 4–6 real hex codes sampled from the refs.
- Density: LOW / MEDIUM / HIGH (how many distinct elements per screen). Build that density.
- Header: filled / bordered / transparent — as the ref shows.
- 3 signature moves: the concrete techniques that make the ref feel special (how images sit,
  section geometry, how type and object interact).
Write all of it into `brief.md`. Then in build: do NOT drift darker, emptier or more minimal
than the refs, even if it "feels more premium".

If refs contradict each other (light vs dark, different moods), STOP and ask the user which
one leads. Averaging contradictory refs produces grey mush.

## 5. Light scenes (white studio, white product pages)

Light designs expose every flaw. Extra rules:
- Ground is never pure #FFFFFF flat: use #F4F4F2–#FAFAF8 with a soft floor gradient or a
  contact shadow so the object stands on something.
- The object needs contrast against white: dark object, or strong shadow, or a coloured
  element behind it. A white object on white needs a background colour change.
- Headline weight goes UP on light ground (800–900), and giant type behind/around the object
  carries the layout.
- 3D on light: see `04-3d-render.md` §4.

## 6. `brief.md` template (write exactly this structure)

```md
# BRIEF — [Brand]
Path: A/B/C/D   Stack: [...]   Language of copy: [...]

## Concept
Pitch: [one line]
Signature mechanic: [name from 03-mechanics] — [what the user does → what happens]
First 3 seconds: [what someone filming the screen sees]
Secondary (optional): [...]

## Art direction
Background: LIGHT|DARK   Density: LOW|MEDIUM|HIGH   Header: [...]
Palette: #... bg, #... text, #... accent, (#..., #...)
Display font: [family, weight, clamp(), line-height, tracking, case]
Body font: [family, size, weight]
Texture/visual language (max 3): [...]
Motion: [easing e.g. expo.out / power3.out], durations [...], what is scrubbed

## References → 3 signature moves
1. [move] (from [ref])
2. ...
3. ...

## Sections
1. Hero — [what's in frame, media IDs, placement, the mechanic]
2. ...
(4–7 sections total, each: content, what animates, media IDs + how they sit)

## Visual world
(template in system/11-visual-direction.md §4 — register, palette, light, capture feel, grade,
set & props, hero subject lock, motion language, never-list)

## Assets
Hero-critical (P4): [...]
Placeholders for P7: img-01 ..., vid-01 ...

## Allowed exceptions
[none]

## Log
[date] decisions, what changed and why
```

## 7. Self-review before calling anything done

After building: re-read `brief.md` and check the site against it line by line:
bans, palette hex, light/dark, density, type numbers, the 3 signature moves, the first 3 seconds.
Anything off → fix before reporting. Then run QA (`07-qa.md`).
