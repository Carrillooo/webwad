# 09 — SHIP & FILM

## 1. Deploy (pick the simplest for the user)

- **Vercel / Cloudflare Pages / Netlify** — free. Static HTML: drag-and-drop the folder in the
  dashboard, or `npx vercel` / `npx wrangler pages deploy .`.
- Before deploy: remove `refs/`, `shots/`, `target/` from the published folder (or add them to
  `.vercelignore` / deploy only `index.html style.css main.js assets/`).
- Check the live URL with `tools/shoot.mjs` once more (assets paths are case-sensitive online!).

## 2. Filming it for Reels / TikTok (the site is also content)

Tell the user:
- Record the screen at 60fps (OBS / macOS screen recording / Windows Game Bar), browser in
  fullscreen (F11), cursor visible, zoom 100%.
- Or film the monitor with a phone in a dark room for the "real screen" look — lock exposure.
- Hook in the first 1–2 seconds: start ON the signature moment (intro / reveal), not on a loading screen.
- Scroll slowly and evenly (trackpad or smooth mouse), pause 1s on each key frame.
- 9:16: record the browser at ~1080×1920 window or crop the centre; check nothing important is at the edges.
- Show the "how" in a second clip: the prompt / the folder / before-after — that's what sells the method.
