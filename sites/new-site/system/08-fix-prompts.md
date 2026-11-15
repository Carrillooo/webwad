# 08 — FIX PROMPTS (for the user to paste when something is off)

The user may paste any of these. When they do: re-read `brief.md`, diagnose first (say in one
line what's causing it), fix, re-run QA screenshots for the affected section, show the result.

| Symptom (user's words) | What you do |
|---|---|
| "Looks dead / boring / like a Word doc" | Raise type contrast: display 2× bigger, weight 800–900, text #0A0A0A; add the 3 signature moves back; check density vs refs; add one strong image moment per section |
| "Looks like every AI site" | Run the AI-tic scan from `07-qa.md`; replace template sections (feature grid, logo strip, testimonial carousel) with editorial layouts built on the concept |
| "Too dark / too empty" | Re-read refs; restore LIGHT/density/hex literally |
| "The 3D model is dark / muddy" | `04-3d-render.md` §6 in order; report which step fixed it |
| "Animation stutters / lags" | Profile: preload + compile before intro; only transform/opacity; reduce frames/DPR; pause off-screen canvases |
| "Intro is too long / annoying" | Cap intro at 2–2.5s total, allow skip on scroll/click |
| "Scroll feels heavy" | Lenis `lerp` 0.1 (or `duration` 1.0–1.2), fewer pinned sections, shorter scrub distances |
| "Mobile is broken" | Rebuild the section layout for 390px (not just scale down); swap heavy mechanics for their fallback (frame seq half count, no WebGL trail → auto sweep video) |
| "Text is bad" | Rewrite copy: headlines ≤ 6 words, specific to the brand, no clichés, one idea per section |
| "I want it more like [ref]" | Study the ref (06 §3), name the ONE move that's missing, implement only that |
| "Make it more premium" | Less, not more: remove one element per section, increase whitespace, slow easing (expo.out 1.2s), better image |

## Ready-to-paste lines for the user (copy from here)

```
Look at the site as a picky Awwwards juror. Take QA screenshots, list the 5 weakest things
(visual, not code), rank by impact, fix the top 3, show me before/after screenshots.
```
```
Compare the hero with the references in refs/. Name the 3 biggest differences and fix them.
```
```
The site looks too generic. Run the AI-cliché scan and redesign every section that feels like a template.
```
