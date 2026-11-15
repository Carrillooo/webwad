#!/usr/bin/env node
// Made By Everen — shoot.mjs
// Screenshots a site at several scroll positions (desktop + mobile) and writes report.json
// with detected libraries, fonts, key colours, console errors and failed requests.
//
// Usage:
//   node tools/shoot.mjs <url> <outDir> [--intro] [--wait=2500]
// Examples:
//   node tools/shoot.mjs https://example.com refs/sites/example
//   node tools/shoot.mjs http://localhost:5173 shots/round-1
//   node tools/shoot.mjs http://localhost:5173 shots/intro --intro
//
// Setup (once): npm i -D playwright && npx playwright install chromium

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const outDir = args.filter(a => !a.startsWith('--'))[1] || 'shots/latest';
const INTRO = args.includes('--intro');
const WAIT = Number((args.find(a => a.startsWith('--wait=')) || '--wait=2500').split('=')[1]);
if (!url) { console.error('Usage: node tools/shoot.mjs <url> <outDir> [--intro] [--wait=ms]'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const report = { url, date: new Date().toISOString(), consoleErrors: [], failedRequests: [], desktop: {}, mobile: {} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function watch(page, bucket) {
  page.on('console', m => { if (m.type() === 'error') bucket.consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', e => bucket.consoleErrors.push('pageerror: ' + String(e).slice(0, 300)));
  page.on('requestfailed', r => bucket.failedRequests.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 300)));
  page.on('response', r => { if (r.status() >= 400) bucket.failedRequests.push(`${r.status()} ${r.url()}`.slice(0, 300)); });
}

async function open(page) {
  try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); }
  catch { await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch(() => {}); }
}

// Scroll with real wheel events so smooth-scroll libraries (Lenis, Locomotive) react.
async function scrollToPct(page, pct) {
  const { max, cur } = await page.evaluate(() => ({
    max: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight,
    cur: scrollY,
  }));
  const target = Math.round(max * pct);
  let delta = target - cur, guard = 0;
  while (Math.abs(delta) > 40 && guard++ < 400) {
    await page.mouse.wheel(0, Math.sign(delta) * Math.min(Math.abs(delta), 300));
    await sleep(40);
    delta = target - (await page.evaluate(() => scrollY));
  }
  await sleep(900); // let scrubbed animations settle
}

async function inspect(page) {
  return page.evaluate(() => {
    const libs = [];
    const w = window;
    if (w.gsap) libs.push('GSAP ' + (w.gsap.version || ''));
    if (w.ScrollTrigger) libs.push('ScrollTrigger');
    if (w.Lenis || w.lenis || document.documentElement.classList.contains('lenis')) libs.push('Lenis');
    if (w.THREE) libs.push('three.js r' + (w.THREE.REVISION || ''));
    if (w.LocomotiveScroll) libs.push('Locomotive Scroll');
    if (w.Swiper) libs.push('Swiper');
    if (w.barba) libs.push('Barba.js');
    if (document.querySelector('canvas')) libs.push('canvas x' + document.querySelectorAll('canvas').length);
    if (document.querySelector('video')) libs.push('video x' + document.querySelectorAll('video').length);
    const srcs = [...document.scripts].map(s => s.src).filter(Boolean);
    for (const [re, name] of [[/gsap/i, 'GSAP (script)'], [/lenis/i, 'Lenis (script)'], [/three/i, 'three (script)'],
      [/webflow/i, 'Webflow'], [/framer/i, 'Framer'], [/_next\//, 'Next.js'], [/nuxt/i, 'Nuxt'], [/spline/i, 'Spline']]) {
      if (srcs.some(s => re.test(s)) && !libs.includes(name)) libs.push(name);
    }
    if (document.querySelector('script[type=importmap]')) libs.push('importmap: ' + document.querySelector('script[type=importmap]').textContent.replace(/\s+/g, ' ').slice(0, 200));
    const fonts = new Set();
    document.fonts.forEach(f => { if (f.status === 'loaded') fonts.add(`${f.family.replace(/"/g, '')} ${f.weight}`); });
    const cs = el => el ? getComputedStyle(el) : null;
    const pick = sel => { const el = document.querySelector(sel); const s = cs(el); return s ? {
      sel, text: (el.innerText || '').trim().slice(0, 60), font: s.fontFamily.slice(0, 80), size: s.fontSize,
      weight: s.fontWeight, color: s.color, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, textTransform: s.textTransform } : null; };
    return {
      title: document.title,
      libs, loadedFonts: [...fonts].slice(0, 20),
      bodyBackground: cs(document.body).backgroundColor, htmlBackground: cs(document.documentElement).backgroundColor,
      h1: pick('h1'), h2: pick('h2'), nav: pick('nav a, header a'), p: pick('p'),
      pageHeight: document.documentElement.scrollHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
}

const browser = await chromium.launch();
try {
  // ---------- Desktop ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  watch(page, report);

  if (INTRO) {
    const t0 = Date.now();
    page.goto(url, { waitUntil: 'commit', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('commit').catch(() => {});
    for (let i = 0; i < 16; i++) {
      await page.screenshot({ path: path.join(outDir, `intro-${String(i).padStart(2, '0')}-${Date.now() - t0}ms.png`) }).catch(() => {});
      await sleep(250);
    }
    await page.waitForLoadState('load').catch(() => {});
  } else {
    await open(page);
  }
  await sleep(WAIT);
  report.desktop = await inspect(page);

  const positions = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];
  const shots = [];
  for (const p of positions) {
    if (p > 0) await scrollToPct(page, p);
    const file = path.join(outDir, `desktop-${String(Math.round(p * 100)).padStart(3, '0')}.png`);
    await page.screenshot({ path: file });
    shots.push(path.basename(file));
  }
  report.desktop.screenshots = shots;
  await ctx.close();

  // ---------- Mobile ----------
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const m = await mctx.newPage();
  watch(m, report);
  await open(m);
  await sleep(WAIT);
  report.mobile = await inspect(m);
  const mshots = [];
  for (const p of [0, 0.35, 0.7]) {
    if (p > 0) await m.evaluate(pp => scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * pp), p);
    await sleep(900);
    const file = path.join(outDir, `mobile-${String(Math.round(p * 100)).padStart(3, '0')}.png`);
    await m.screenshot({ path: file });
    mshots.push(path.basename(file));
  }
  report.mobile.screenshots = mshots;
  await mctx.close();

  // ---------- Contact sheet: ONE image with every shot (look at this first — saves tokens) ----------
  const tile = (f, w) => `<figure><img src="data:image/png;base64,${fs.readFileSync(path.join(outDir, f)).toString('base64')}" style="width:${w}px"><figcaption>${f.replace('.png', '')}</figcaption></figure>`;
  const introShots = fs.readdirSync(outDir).filter(f => f.startsWith('intro-') && f.endsWith('.png')).sort();
  const html = `<html><body style="margin:0;padding:10px;background:#fff;font:12px sans-serif">
    ${introShots.length ? `<div style="display:grid;grid-template-columns:repeat(4,317px);gap:10px;margin-bottom:10px">${introShots.map(f => tile(f, 317)).join('')}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(2,640px);gap:10px">${shots.map(f => tile(f, 640)).join('')}</div>
    <div style="display:flex;gap:10px;margin-top:10px">${mshots.map(f => tile(f, 200)).join('')}</div>
    <style>figure{margin:0}figcaption{padding:2px 0;color:#555}img{display:block;border:1px solid #ddd}</style></body></html>`;
  const sctx = await browser.newContext({ viewport: { width: 1310, height: 800 } });
  const sp = await sctx.newPage();
  await sp.setContent(html, { waitUntil: 'load' });
  await sp.screenshot({ path: path.join(outDir, 'sheet.jpg'), fullPage: true, type: 'jpeg', quality: 80 });
  await sctx.close();
} finally {
  await browser.close();
}

report.consoleErrors = [...new Set(report.consoleErrors)];
report.failedRequests = [...new Set(report.failedRequests)];
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`Saved to ${outDir} — open sheet.jpg first (all shots in one image); single shots only if a detail is unclear.`);
console.log(`Libraries: ${(report.desktop.libs || []).join(', ') || 'none detected'}`);
console.log(`Console errors: ${report.consoleErrors.length} · Failed requests: ${report.failedRequests.length}` +
  (report.mobile.horizontalOverflow ? ' · ⚠ horizontal overflow on mobile' : ''));
