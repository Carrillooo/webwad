#!/usr/bin/env node
// Made By Everen — refvideo.mjs
// Study a reference that exists as a VIDEO: getlayers / motionsites previews, screen recordings.
// Accepts a direct video URL (.mp4/.webm/.mov/.gif), a local file, or a PAGE URL
// (e.g. https://motionsites.ai/?prompt=space-voyage) — then it finds the biggest video on the page.
// Output: refs/videos/<name>.<ext>, refs/videos/<name>/frame_0001.jpg…, sheet_01.jpg… (4x3 contact sheets)
//
// Usage: node tools/refvideo.mjs <url-or-file> <name> [--every=0.5]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const [src, name] = pos;
const EVERY = Number((args.find(a => a.startsWith('--every=')) || '--every=0.5').split('=')[1]);
if (!src || !name) { console.error('Usage: node tools/refvideo.mjs <url-or-file> <name> [--every=0.5]'); process.exit(1); }
if (spawnSync('ffmpeg', ['-version']).status !== 0) { console.error('ffmpeg not found — install it first.'); process.exit(1); }

const outDir = path.join('refs', 'videos', name);
fs.mkdirSync(outDir, { recursive: true });
const isMedia = s => /\.(mp4|webm|mov|m4v|gif)(\?|$)/i.test(s);

async function resolveFromPage(pageUrl) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const seen = new Set();
    page.on('response', r => { const u = r.url(); if (isMedia(u)) seen.add(u); });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(1000);
      const best = await page.evaluate(() => {
        const vids = [...document.querySelectorAll('video')].map(v => ({
          src: v.currentSrc || v.src || (v.querySelector('source') || {}).src || '',
          area: v.getBoundingClientRect().width * v.getBoundingClientRect().height,
        })).filter(v => /^https?:/.test(v.src));
        vids.sort((a, b) => b.area - a.area);
        return vids[0] ? vids[0].src : null;
      });
      if (best) return best;
    }
    return [...seen][0] || null;
  } finally { await browser.close(); }
}

let mediaUrl = src;
if (!fs.existsSync(src) && !isMedia(src)) {
  console.log('Looking for the preview video on the page…');
  mediaUrl = await resolveFromPage(src);
  if (!mediaUrl) { console.error('No video found on that page. Try the direct video URL, or use tools/shoot.mjs for live sites.'); process.exit(1); }
  console.log('Found:', mediaUrl);
}

const ext = (mediaUrl.match(/\.(mp4|webm|mov|m4v|gif)(\?|$)/i) || [, 'mp4'])[1].toLowerCase();
const file = path.join('refs', 'videos', `${name}.${ext}`);
if (fs.existsSync(mediaUrl)) fs.copyFileSync(mediaUrl, file);
else {
  const res = await fetch(mediaUrl);
  if (!res.ok) { console.error(`Download failed: ${res.status} ${mediaUrl}`); process.exit(1); }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

const fps = (1 / EVERY).toFixed(4);
const run = a => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...a], { stdio: 'inherit' }); if (r.status !== 0) process.exit(1); };
run(['-i', file, '-vf', `fps=${fps},scale=960:-2`, '-q:v', '4', path.join(outDir, 'frame_%04d.jpg')]);
run(['-i', file, '-vf', `fps=${fps},scale=480:-2,tile=4x3:padding=6:margin=6:color=white`, '-q:v', '4', path.join(outDir, 'sheet_%02d.jpg')]);

const frames = fs.readdirSync(outDir).filter(f => f.startsWith('frame_')).length;
const sheets = fs.readdirSync(outDir).filter(f => f.startsWith('sheet_')).length;
console.log(`Done: ${frames} frames (every ${EVERY}s), ${sheets} contact sheets → ${outDir}`);
console.log('Look at the sheets first (motion overview, left→right, top→bottom), then single frames for details.');
