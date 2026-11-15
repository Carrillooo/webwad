# 06 — REFERENCES (how to look, what to take)

## 1. Strength of inputs (use the strongest available)

**Live site URL** > screen recording / preview video (`tools/refvideo.mjs`) > site screenshot > Pinterest/Dribbble image >
generated mockup image > words.

Only a live site or a recording shows MOTION. Images show look. Words show intent.
Best combo: 1–2 live sites for structure & motion + 3–6 images for look & mood.

## 2. Where to find them — `refs/library.md` FIRST

When the user gave no refs, pick ONLY from `refs/library.md` (curated award-winning sites, grouped
by niche, each tagged with techniques and light/dark). Do not pick sites from memory: memory pulls
the same famous studio sites every time (Lusion, Active Theory, Igloo…), which makes every project
look alike.

Selection rules:
1. **2 sites from the user's niche** (or the closest niche group) + **1 site from a DIFFERENT niche**
   that has the chosen mechanic/technique tag. Same-niche refs give layout & tone; the cross-niche
   ref gives the motion idea.
2. Match light/dark to the concept. Never pick a dark ref for a light concept or vice versa.
3. Not used in the last 3 entries of `../everen-history.md`.
4. Agency/studio showcase sites (their own portfolio) are refs ONLY for agency/portfolio projects.
5. If a URL is dead or redirects to a parked page → pick the next one, note it in `brief.md` Log.
6. Write in `brief.md` WHY each ref was chosen (one line: niche match / technique / light-dark).

**Trend library** — `refs/library-trends.md`: getlayers.ai + motionsites.ai (the AI "motion sites"
from Reels — the look buyers want). They are preview VIDEOS: study with
`node tools/refvideo.mjs <video-or-page-url> <name>` (frames + contact sheets in `refs/videos/`).
Use max ONE trend ref per project, for technique/motion only (rules at the top of that file),
always together with 1–2 refs from `library.md`.

Extra sources when neither library has anything fitting: awwwards.com/websites/<category>/,
godly.website, siteinspire.com, land-book.com; mood images: pinterest.com.

## 3. Studying a live site (P2)

For each URL in `refs/sites.txt` (one per line) run:
`node tools/shoot.mjs <url> refs/sites/<name>`
It saves screenshots at scroll 0/15/30/45/60/75/90/100 %, a mobile screenshot, and `report.json`
(detected libraries: GSAP, ScrollTrigger, Lenis, three.js, etc., fonts in use, colours of the
main elements). Look at `sheet.jpg` (all shots in one image); single shots only for details. Then write for each site:
- What happens on load, on scroll, on cursor (from screenshots + library report + any recording
  the user provides).
- Layout skeleton: grid, how big the type is relative to viewport, where the object sits.
- The ONE move worth taking from it.

## 4. Images (P2)

Images go into `refs/images/`. Look at every image. Discard ones that contradict the chosen
concept. Keep 3–6. For each kept image write what exactly you take (palette / type / composition
/ treatment of the object). Images of the PRODUCT (e.g. model renders) are not design references —
they're asset references. Don't extract layout from them.

## 5. Extract (goes into `brief.md`)

Hard facts: LIGHT/DARK · 4–6 hex · density · header treatment · display type (size relative to
viewport, weight, case) · how the object sits (full-bleed / cutout / framed / 3D).
Then the **3 signature moves** — concrete, e.g. "headline at 22vw sits BEHIND the car",
"sections stack like cards", "cursor x-ray lens on the product".

## 6. Rules

- Contradicting refs (light vs dark, calm vs loud) → ask the user which one leads. Never average.
- Palette and type come from the BRAND and the same-niche refs — never from the cross-niche ref
  (the cross-niche ref gives only its motion/technique). Never copy a ref's intro/loader.
- Mix, don't clone: take max ONE move per source site, combine 2–3 sources + the concept's own
  mechanic. Never copy a site's copy, logo, exact layout or assets.
- Refs serve the concept from P1 — not the other way round. If refs pull away from the concept,
  say so and let the user decide.
