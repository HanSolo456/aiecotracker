/**
 * After `next build` with output: 'standalone', copies the standalone server
 * plus required static assets into src-tauri/next-server for Tauri bundling.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');
const out = path.join(root, 'src-tauri', 'next-server');

if (!existsSync(standalone)) {
  console.error('[prepare-tauri-resources] Missing .next/standalone. Run `next build` first.');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const ent of readdirSync(out, { withFileTypes: true })) {
  if (ent.name === '.gitkeep') continue;
  rmSync(path.join(out, ent.name), { recursive: true, force: true });
}
cpSync(standalone, out, { recursive: true });

const pub = path.join(root, 'public');
if (existsSync(pub)) {
  cpSync(pub, path.join(out, 'public'), { recursive: true });
}

const staticSrc = path.join(root, '.next', 'static');
const staticDest = path.join(out, '.next', 'static');
mkdirSync(path.dirname(staticDest), { recursive: true });
if (existsSync(staticSrc)) {
  cpSync(staticSrc, staticDest, { recursive: true });
} else {
  console.warn('[prepare-tauri-resources] No .next/static found; UI assets may be missing.');
}

console.log('[prepare-tauri-resources] Wrote', out);
