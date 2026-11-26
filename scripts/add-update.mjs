// Adds freshly collected patches (raw/new/balance-*.json + news-*.json) to raw/meta/ (newest first).
// Usage: node scripts/add-update.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirNew = path.join(root, 'raw', 'new');
const meta = path.join(root, 'raw', 'meta');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const balance = readJson(path.join(meta, 'balance.json'));
const news = readJson(path.join(meta, 'news2.json'));
let added = 0;

for (const f of fs.readdirSync(dirNew).filter((x) => x.startsWith('balance-') && x.endsWith('.json'))) {
  const { item } = readJson(path.join(dirNew, f));
  if (balance.items.some((b) => b.slug === item.slug)) { console.log('already have', item.slug); continue; }
  balance.items.unshift(item);
  added++;
}
for (const f of fs.readdirSync(dirNew).filter((x) => x.startsWith('news-') && x.endsWith('.json'))) {
  const { item } = readJson(path.join(dirNew, f));
  if (news.items.some((n) => n.slug === item.slug)) continue;
  news.items.unshift(item);
}
// keep order newest first by date
const t = (d) => Date.parse(d) || 0;
news.items.sort((a, b) => t(b.date) - t(a.date));
fs.writeFileSync(path.join(meta, 'balance.json'), JSON.stringify(balance));
fs.writeFileSync(path.join(meta, 'news2.json'), JSON.stringify(news));
console.log(`patches added: ${added}; total ${balance.items.length}`);
