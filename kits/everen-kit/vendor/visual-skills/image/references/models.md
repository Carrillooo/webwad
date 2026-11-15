# Model Selection — Nano Banana vs GPT Image 2.5

The skill writes prompts for two model families. They think differently — the choice of model changes the prompt structure.

## TL;DR

| Task | Model |
|--------|--------|
| Real place/object (with grounding) | **Nano Banana** (NB2/NBP) |
| Complex scene with physics/composition | **Nano Banana Pro** |
| Long horizontal/vertical formats (1:8, 8:1, 4:1) | **Nano Banana** (only NB supports extremes) |
| Cheap mass generation | **Nano Banana 2 Lite** or **GPT Image 2.5 Flare** (`quality: low`) |
| Photorealism with fine typography/UI | **GPT Image 2.5** |
| Precise editing with preservation (try-on, swap, weather) | **GPT Image 2.5** (best identity preservation in editing) |
| Small dense text in frame | **GPT Image 2.5** (`quality: high`) |
| Brand print / posters with EXACT TEXT | **GPT Image 2.5** |
| Storyboards, comics (sequence) | **Nano Banana** (extreme ratios + thinking) |
| Storyboard with a typography focus | **GPT Image 2.5** |
| Style transfer without referenced images | **GPT Image 2.5** (concrete visual targets) |
| Render from 14+ references | **Nano Banana Pro** (up to 14) or **GPT Image 2.5** (up to 16) |

> GPT Image 2.5 contains two models: **Flare** (`gpt-image-2.5-flare`) — fast default, higher quality than GPT Image 2 at ~50% lower latency; **Sunburst** (`gpt-image-2.5-sunburst`) — the base model, for precision edits and campaign quality. Prompt rules are the same. GPT Image 2 — migration-only.

## Which wins when

### Nano Banana wins at
- **Image grounding.** NB2 searches real images on the web before generating — exact architecture of a specific temple, bridge, square; specific species of animals, plants. GPT Image 2.5 doesn't do this.
- **Extreme ratios.** 1:8, 8:1, 1:4, 4:1 — banners, scrolls, comic strips. GPT Image 2.5 maxes at 3:1.
- **«Thinking» mode.** Complex infographics with spatial logic.
- **Price/speed.** NB2 = $0.04/img.

### GPT Image 2.5 wins at
- **Identity preservation in edits.** Change clothing / weather / background — face, pose, geometry don't drift. Two-column logic (change / preserve) works like a contract.
- **Fine text in frame.** Small captions, legends, footnotes, multi-font layouts. Renders sharper on `quality: high`.
- **UI mocks and product screenshots.** Hierarchy, real interface elements, readable labels.
- **Structured 5-slot prompt.** Clear separation of Scene/Subject/Details/Use case/Constraints gives predictability.
- **`quality` lever.** low/medium/high/xhigh/max — a deliberate speed vs precision trade-off (new five-step scale; medium = default).
- **4K output.** Up to 3840×2160 / 2160×3840 out of the box.

### Where both models are equally good
- Photorealistic portraits.
- Product shots on a neutral background.
- Minimalist posters.
- Editorial photography.

## Prompt syntax differences

| Aspect | Nano Banana | GPT Image 2.5 |
|--------|-------------|-------------|
| Prompt style | Natural language, 1-2 paragraphs | 5-slot with section labels |
| Camera/lens | **Don't specify** numbers (50mm, f/2.8) — NB ignores them | «50mm feel» is OK, but as a high-level look |
| «Stunning/epic/masterpiece» | Ignored, harmless | **Anti-slop**: harmful, makes the result worse |
| Text in image | `"..."` in quotes, font + position | `"..."` or ALL CAPS + «no extra words / no duplicate text» |
| Negative framing | Use positive | Use positive + explicit preserve list |
| Complex scenes | JSON for 5+ elements | 5-slot template with sections |
| Edit | «Keep X same, change Y» | «Change: X / Preserve: Y / Constraints: Z» — repeat preserve every iteration |
| Multiple references | Up to 14, indexed | Up to 16, indexed with role («Image 1: base», «Image 2: jacket reference») |

## Cost (rough guide)

| Model | Price | Notes |
|--------|------|---------|
| Nano Banana 2 Lite | ~$0.034/img | 1K only, ~4 sec. Drafts and mass batches |
| Nano Banana 2 (Flash) | ~$0.04/img | Default for most tasks |
| Nano Banana Pro | ~$0.15/img | Complex scenes, up to 14 refs |
| GPT Image 2.5 (`low`) | ~$0.01/img (1K) | Latency-sensitive, previews, mass batches |
| GPT Image 2.5 (`medium`) | ~$0.024/img (1K) | Default for GPT Image |
| GPT Image 2.5 (`high`) | ~$0.09/img (1K) | Small text, brand-sensitive, photorealism |
| GPT Image 2.5 (`xhigh`) | ~$0.16/img (1K) | Fine textures, print-ready |
| GPT Image 2.5 (`max`) | ~$0.36/img (1K) | Maximum fidelity, only when specifically needed |

Flare and Sunburst prices are the same (provider guide for 1K; 2K/4K cost more). Each tier is cheaper than the same-named GPT Image 2 tier.

> The skill doesn't run generation itself — it outputs a prompt. Model/quality are noted next to the prompt as meta.

---

*Author: Serge Shima ([t.me/aimastersme](https://t.me/aimastersme) · [sergeshima.com](https://sergeshima.com) · [aimasters.me](https://aimasters.me)) · License: CC BY 4.0 — attribution required · Source: [smixs/visual-skills](https://github.com/smixs/visual-skills)*
