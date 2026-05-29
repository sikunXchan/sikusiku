import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// クマアイコンのSVG（紫グラデ背景 + クリーム色のクマの顔）。maskable対応で余白多め。
function svg(size, maskable) {
  const pad = maskable ? size * 0.14 : 0; // maskable はセーフゾーン確保
  const c = size / 2;
  const r = (size / 2 - pad);
  const headR = r * 0.62;
  const earR = r * 0.26;
  const earOff = headR * 0.78;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8a7bff"/>
      <stop offset="1" stop-color="#5a4cd0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bg)"/>
  <g>
    <circle cx="${c - earOff}" cy="${c - earOff * 0.7}" r="${earR}" fill="#caa978"/>
    <circle cx="${c + earOff}" cy="${c - earOff * 0.7}" r="${earR}" fill="#caa978"/>
    <circle cx="${c}" cy="${c}" r="${headR}" fill="#f3e0c0"/>
    <ellipse cx="${c}" cy="${c + headR * 0.28}" rx="${headR * 0.5}" ry="${headR * 0.36}" fill="#fff1da"/>
    <circle cx="${c - headR * 0.34}" cy="${c - headR * 0.12}" r="${headR * 0.1}" fill="#1a1a1a"/>
    <circle cx="${c + headR * 0.34}" cy="${c - headR * 0.12}" r="${headR * 0.1}" fill="#1a1a1a"/>
    <circle cx="${c}" cy="${c + headR * 0.12}" r="${headR * 0.11}" fill="#1a1a1a"/>
  </g>
</svg>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
const targets = [
  ['public/pwa-192x192.png', 192, false],
  ['public/pwa-512x512.png', 512, false],
  ['public/maskable-512x512.png', 512, true],
  ['public/apple-touch-icon.png', 180, false],
  ['public/favicon.png', 64, false],
];
for (const [path, size, maskable] of targets) {
  const markup = svg(size, maskable);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;padding:0}</style>${markup}`);
  const el = await page.$('svg');
  const buf = await el.screenshot({ omitBackground: true });
  writeFileSync(path, buf);
  console.log('wrote', path, size);
}
await browser.close();
