import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmpDir = path.join(root, '.build_tmp');
const tmpHtml = path.join(tmpDir, 'dev.html');
const tmpAssets = path.join(tmpDir, 'assets');
const outHtml = path.join(root, 'index.html');
const outAssets = path.join(root, 'assets');
const swPath = path.join(root, 'sw.js');

if (!fs.existsSync(tmpHtml)) {
  console.error('[postbuild] Missing .build_tmp/dev.html');
  process.exit(1);
}

// 1. Normalize root index.html so PWA manifest & icons always resolve cleanly from repo root (./), never ./assets/
let html = fs.readFileSync(tmpHtml, 'utf8');
html = html.replace(/href="\.\/assets\/manifest-[^"]+\.webmanifest"/g, 'href="./manifest.webmanifest"');
html = html.replace(/href="\.\/assets\/icon-192-[^"]+\.png"/g, 'href="./icons/icon-192.png"');
fs.writeFileSync(outHtml, html, 'utf8');

// 2. Replace root ./assets/ cleanly with freshly hashed JS & CSS bundles only
fs.rmSync(outAssets, { recursive: true, force: true });
fs.mkdirSync(outAssets, { recursive: true });
const builtFiles = [];
if (fs.existsSync(tmpAssets)) {
  for (const name of fs.readdirSync(tmpAssets)) {
    if (name.endsWith('.webmanifest') || name.startsWith('icon-')) continue;
    fs.copyFileSync(path.join(tmpAssets, name), path.join(outAssets, name));
    builtFiles.push(`./assets/${name}`);
  }
}

// 3. Inject exact built bundle paths + cache version hash into sw.js
if (fs.existsSync(swPath)) {
  const buildHash = builtFiles.map((f) => path.basename(f)).join('-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28) || 'v1';
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(
    /const CACHE_NAME = '[^']+';/,
    `const CACHE_NAME = 'narrow50-tower-${buildHash}';`
  );
  const assetsListStr = builtFiles.map((f) => `  '${f}',`).join('\n');
  sw = sw.replace(
    /const BUILT_ASSETS = \[[\s\S]*?\];/,
    `const BUILT_ASSETS = [\n${assetsListStr}\n];`
  );
  fs.writeFileSync(swPath, sw, 'utf8');
}

// 4. Remove temporary build folder
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`[postbuild] Published root index.html + ${builtFiles.length} bundle assets for GitHub Pages & PWA.`);
