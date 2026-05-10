#!/usr/bin/env node
/**
 * Copia metrics.json a ./public para que Vite lo sirva.
 * Uso:
 *   node scripts/setup.mjs <ruta-al-metrics.json>
 *   node scripts/setup.mjs                 # busca en ubicaciones comunes
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dest = path.join(projectRoot, 'public', 'metrics.json');

const explicit = process.argv[2];

const candidates = [
  explicit,
  path.join(projectRoot, 'metrics.json'),
  path.join(os.homedir(), 'Downloads', 'metrics.json'),
  path.join(os.homedir(), 'Desktop', 'metrics.json'),
].filter(Boolean);

const src = candidates.find((p) => p && fs.existsSync(p));

if (!src) {
  console.error('\n[setup] Could not find metrics.json.');
  console.error('Try: node scripts/setup.mjs /full/path/to/metrics.json\n');
  process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
const size = (fs.statSync(dest).size / 1024).toFixed(1);
console.log(`[setup] Copied ${src} -> ${dest} (${size} KB)`);
