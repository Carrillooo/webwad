# 10 — INTROS (the first 2 seconds decide if people keep watching)

The intro is part of the concept, not a loading screen. It must come FROM the brand:
its emblem, its product, its signature gesture, its material. Commercials for Nike, Porsche,
Chanel never open with "000 → 100" — they open with the swoosh, the crest, the bottle.

## 1. Hard rules

- **Banned by default:** big percentage counter ("000→100") in a corner, generic spinner, progress
  bar alone, "Loading…" text, the same intro as any of the last 3 projects (`../everen-history.md`).
- Percentage/loading UI is allowed ONLY for tech / IT / AI / gaming / data niches, only if the
  user agrees, and even then it must be designed into the brand (e.g. a boot sequence of the
  product's own UI, a chip "powering on"), not a floating number.
- Total length 1.2–2.5s. Skippable (scroll/click/key ends it). Never blocks longer than assets need.
- The intro must hand over INTO the hero (the emblem becomes the logo in the nav, the light becomes
  the hero lighting, the product lands in its hero position) — no hard cut to an unrelated page.
- Some sites are better with NO intro: hero appears with a staggered reveal (headline lines,
  then image, then nav). Choose this when the brand is calm/editorial or the hero itself is the show.

## 2. Intro types

| # | Type | What happens | Assets |
|---|---|---|---|
| I1 | **Emblem fill** | Emblem outline draws itself (SVG stroke), then fills with the brand colour / metal / liquid rising from the bottom | SVG emblem |
| I2 | **Emblem glint** | Emblem appears in dark, a light sweep (specular band) crosses it like on polished metal, then it fades/scales into the nav logo | SVG emblem (or PNG of chrome emblem) |
| I3 | **Split reveal** | Emblem/wordmark in centre; screen splits into two panels sliding apart (each carries half of the emblem), revealing the hero | SVG emblem |
| I4 | **Light-on** | Black → a light source switches on over the product, UI snaps in with the light | Hero image/video with a dark first frame |
| I5 | **Product entrance** | The product enters and lands: shoe drops and bounces once, bottle rises, car rolls in, watch rotates into place | Cutout PNG or short video |
| I6 | **Material wipe** | The screen is covered by the brand's material (leather, carbon, silk, liquid, smoke) that pulls away / dissolves | Short video or texture |
| I7 | **Wordmark slam / kinetic type** | Giant wordmark assembles letter by letter or scales from viewport-size to nav size | Font only |
| I8 | **Shape-mask zoom** | The page is revealed through the emblem's shape, which scales up until it fills the screen | SVG emblem |
| I9 | **Signature gesture** | The brand's ritual in 1–2s: can opening, match strike, needle drop, lighter flick | Short video |
| I10 | **No intro** | Staggered hero reveal only | — |

## 3. Picking by niche (start points — combine with the concept)

| Niche | Good intros |
|---|---|
| Sportswear / sneakers | I5 (shoe drops & settles), I8 (swoosh-shaped mask zoom), I7 |
| Supercar / tuning / premium auto | I2 (crest glint on carbon), I1 (crest fills with metal), I4 (headlights ignite), I3 |
| Luxury fashion / jewellery / perfume | I2, I6 (silk / liquid), I10 |
| Watches | I5 (watch rotates into place), I2 |
| Food / drink | I9 (can opens / pour), I6 (liquid wipe), I5 |
| Architecture / real estate | I4 (sunrise light-on), I8 (window-shaped mask), I10 |
| Beauty / clinic | I6 (cream/texture wipe), I10 |
| Tech / SaaS / AI | I7, branded boot sequence (allowed here), I10 |
| Agency / portfolio | I7, I3, I8 |
| Music / events | I9 (needle drop / beat hit), I7 synced to a beat |

## 4. Brand emblems

Ask the user for the logo as SVG (best) or transparent PNG. If they don't have one: for real brands,
the official press/brand page or Wikimedia Commons usually has an SVG — tell the user where to get it
and put it in `assets/brand/`. Real brand logos are fine for demos/portfolio pieces; for a
third party's commercial site, the brand owner must provide/approve them.
Never redraw a real brand's logo from memory — get the file.

## 5. Build notes

- SVG stroke draw: `stroke-dasharray` = path length, animate `stroke-dashoffset` → 0, then fill via
  `clip-path: inset(100% 0 0 0)` → `inset(0)` on a filled copy (liquid rise), `power2.inOut`.
- Glint: a skewed white/gradient band masked by the emblem shape (`mask-image` = emblem SVG),
  translate across in 0.6–0.9s, `power2.inOut`, `mix-blend-mode: overlay` or `screen`.
- Hand-off to nav: FLIP technique — measure the nav logo rect, animate the intro emblem's
  transform to it, then swap.
- Start only after `document.fonts.ready` + hero media decoded / 3D compiled, else the intro stutters.
