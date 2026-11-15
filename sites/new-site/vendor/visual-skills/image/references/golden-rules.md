# Golden Rules

Universal principles. They work for **both** model families (Nano Banana and GPT Image 2.5).
For model specifics see [nano-banana.md](nano-banana.md), [gpt-image.md](gpt-image.md).

## 1. Start with a Verb

Tell the model the primary operation: "Create", "Generate", "Design", "Transform", "Convert", "Edit". This sets the intent before details.

## 2. Positive Framing

Describe what you WANT, not what you don't want. The model understands presence better than absence.

- ✅ "empty street" → ❌ "street with no cars"
- ✅ "clean background" → ❌ "no clutter"  
- ✅ "solo portrait" → ❌ "no other people"

## 3. Edit, Don't Re-roll

Image 80% correct? Request specific change:
- "Change lighting to sunset"
- "Make text neon blue"
- "Move chart to right third"

## 4. Natural Language

❌ Bad: "Cool car, neon, city, night, 8k"
✅ Good: "A cinematic wide shot of a futuristic sports car speeding through a rainy Tokyo street at night. Neon signs reflect off wet pavement and metallic chassis."

## 5. Be Specific

| Element | Vague | Specific |
|---------|-------|----------|
| Subject | "a woman" | "sophisticated elderly woman in vintage Chanel-style suit" |
| Material | "shiny" | "brushed steel with matte finish" |
| Color | "dark green" | "#0d3d2d deep emerald" |
| Position | "on the right" | "right third, bleeding off edge" |

## 6. Provide Context

Context helps model make logical decisions:
- "for Brazilian gourmet cookbook" → infers professional plating, shallow DOF
- "for executive strategy presentation" → infers corporate aesthetic
- "for children's educational app" → infers friendly, colorful style

## 7. Quote Text Exactly

Any text for rendering goes in quotes:
- "[HEADLINE TEXT]"
- Labels: "[Revenue Growth]", "[Net Income]"
- Specify weight: bold, thin, extra bold
- Specify position: "upper third", "centered"

## Prompt Template

```
Create a [TYPE] for [CONTEXT].

Background: [Description with hex colors]. [Atmospheric effects].

[HERO ELEMENT]:
[Detailed description - position, lighting, angle]

Typography:
Line 1: "[TEXT]" in [weight], [color], [size], [position]
Line 2: "[TEXT]" in [weight], [color], [size], [position]

[ADDITIONAL ELEMENTS]

Mood: [Emotional descriptor]
Format: [ASPECT RATIO]
```

> **Thinking Mode** (NB only), **`quality: low/medium/high/xhigh/max`** (GPT Image 2.5 only) — see the corresponding references.

## Cost Optimization (Batch Work)

- **Nano Banana:** run variants on `0.5K` Flash → pick → regenerate the winner at `2K`/`4K`.
- **GPT Image 2.5:** run on `quality: low` → pick → regenerate on `medium` or `high`.

In both cases: cheap exploration → expensive final.

## Conversational Refinement

After generation:
- "Change the headline color to #3b82f6"
- "Add subtle drop shadow to text"
- "Increase contrast, make it more dramatic"
- "Soften the background, add blur"

## Reference Images

Multi-image input: **NB up to 14**, **GPT Image 2.5 up to 16**. Index them with each image's role.

Use for:

**Fit into an existing design:**
```
[Attach design/layout image]
Create content following this exact layout and style.
Replace [ELEMENT] with [NEW CONTENT].
Keep colors, typography, composition.
```

**Face/character as reference:**
```
[Attach portrait]
Use this person's face. Keep features exactly the same.
Change: [expression/pose/setting]
```

**Product/object as reference:**
```
[Attach product photo]
Place this product in [NEW CONTEXT].
Match lighting and perspective.
```

**Style as reference:**
```
[Attach style reference]
Create [NEW CONTENT] in this exact visual style.
Match colors, textures, mood.
```

**Several references at once:**
```
[Attach Image 1 - face]
[Attach Image 2 - outfit]
[Attach Image 3 - background]
Combine: face from Image 1, outfit style from Image 2, setting from Image 3.
```

## World Knowledge Anchors

GPT Image 2.5 has deep knowledge of culture, eras and visual styles. Instead of describing every detail, give the model a cultural/era/genre anchor and it fills in the authentic details itself.

### Three types of anchors

**Era anchors** — a time and place marker that summons a whole visual world:
- "Bethel, NY, August 1969" → Woodstock aesthetic without describing tie-dye, mud, stages
- "Berlin, November 1989" → fall of the Wall, crowds, graffiti, euphoria
- "Tokyo, 1982" → neon Shinjuku, analog electronics, early cyberpunk

**Cultural anchors** — transfer the visual language of one cultural object onto another context:
- "{game_title} in {real_city}" → automatically applies the game's visual style to a real location (GTA style, Persona style, etc.)
- "Soviet constructivism poster about {modern_topic}" → Rodchenko/El Lissitzky style on a modern topic
- "Ukiyo-e print of {modern_scene}" → Japanese woodblock print with modern content

**Genre anchors** — a director/photographer/movement as a lens:
- "Peter Lindbergh influence" → strong B&W, minimal retouching, raw editorial
- "Wes Anderson palette" → symmetrical framing, pastel palette, centered composition
- "Studio Ghibli mood" → soft watercolor sky, green foliage, warm nostalgic light
- "Roger Deakins lighting" → natural light, deep shadows, cinematic volume

### Usage rules

1. **Use as HIGH-LEVEL steering** — the anchor sets mood and aesthetic, it doesn't replace the whole prompt
2. **Combine with concrete visual details** — the anchor establishes the world, details establish the specifics
3. **Don't stack several genre anchors** — pick one. "Peter Lindbergh + Wes Anderson" = mush
4. **Era/cultural anchors work better with GPT Image 2.5** (world knowledge). With Nano Banana the result is less predictable — NB relies more on explicit descriptions

### Examples

**Era anchor + concrete details:**
```
Create an editorial portrait set in Havana, 1957.

Subject: jazz musician leaning against pastel-colored colonial building,
holding trumpet loosely at his side. Linen suit, open collar.
Lighting: harsh Caribbean afternoon sun, deep shadows under awning.
Format: 3:4
```
> "Havana, 1957" summons: vintage American cars in the background, peeling plaster, wrought-iron balconies, tropical atmosphere — without having to describe them.

**Cultural anchor + new context:**
```
Create a scene of a quiet Kyoto temple garden, rendered in the visual style
of Studio Ghibli. Morning mist over moss-covered stones, a single monk
sweeping fallen maple leaves. Soft watercolor textures, warm nostalgic palette.
Format: 16:9
```
> "Studio Ghibli" sets the watercolor feel, warmth, nostalgia. The details (moss, maple, monk) set the specific scene.

**Genre anchor + specifics:**
```
Create a fashion editorial portrait with Peter Lindbergh influence.

Subject: model in oversized men's blazer, no makeup, wind-tousled hair.
Setting: empty winter beach, overcast sky.
Mood: raw, unpolished beauty
Format: 2:3
```
> "Peter Lindbergh influence" gives: powerful B&W (or desaturated), no retouching, raw emotional quality. The details (beach, blazer, wind) make the frame concrete.

---

*Author: Serge Shima ([t.me/aimastersme](https://t.me/aimastersme) · [sergeshima.com](https://sergeshima.com) · [aimasters.me](https://aimasters.me)) · License: CC BY 4.0 — attribution required · Source: [smixs/visual-skills](https://github.com/smixs/visual-skills)*
