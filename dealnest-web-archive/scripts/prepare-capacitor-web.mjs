import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'www');

const copyEntries = [
  'assets',
  'ludo',
  'sequence',
  'snake',
  'admin.html',
  'alerts.html',
  'categories.html',
  'category.html',
  'community.html',
  'coupons.html',
  'dashboard.html',
  'deal.html',
  'games.html',
  'index.html',
  'login.html',
  'post-deal.html',
  'redirect.html',
  'robots.txt',
  'saved.html',
  'search.html',
  'sequence-play.html',
  'sitemap.xml',
  'store.html',
  'stores.html',
  'thread.html',
  'CNAME',
  '.nojekyll'
];

const ignoredNames = new Set([
  '.DS_Store',
  'node_modules',
  '.git',
  'android',
  'ios',
  'www',
  '.cache',
  'dist',
  'build'
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function removeDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (ignoredNames.has(path.basename(src))) return;
    ensureDir(dest);
    for (const entry of fs.readdirSync(src)) {
      if (ignoredNames.has(entry)) continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

removeDir(outDir);
ensureDir(outDir);

for (const entry of copyEntries) {
  copyRecursive(path.join(root, entry), path.join(outDir, entry));
}

console.log(`Prepared Capacitor web bundle in ${path.relative(root, outDir) || outDir}`);
