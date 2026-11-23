// Turns the raw scraped files in /raw into the JSON the app imports from src/data.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawChars = path.join(root, 'raw', 'chars');
const rawMeta = path.join(root, 'raw', 'meta');
const out = path.join(root, 'src', 'data');
fs.mkdirSync(out, { recursive: true });

// Verified against the site's own balance text ("1 bloodline and 1 random chakra").
const CHAKRA = {
  'oXjj5c8': 'ninjutsu',
  'vQPPFNB': 'taijutsu',
  'U4UQ3nb': 'bloodline',
  'SJuy2eN': 'genjutsu',
  'nyuJ6Jb': 'random',
};
const chakraOf = (src) => CHAKRA[(src.match(/imgur\.com\/(\w+)\./) || [])[1]] || 'random';

const chars = fs
  .readdirSync(rawChars)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(rawChars, f), 'utf8')));

const characters = chars
  .map((c) => {
    const isS = /\(S\)\s*$/.test(c.name);
    const unlockMatch = (c.unlock || '').match(/^(Mission|No requirements)\s*:?\s*(.*)$/s);
    const skills = c.skills.map((s) => ({
      name: s.name,
      image: s.image,
      description: s.description,
      cooldown: /^\d+$/.test(s.cooldown) ? Number(s.cooldown) : 0,
      cost: s.energy.map(chakraOf),
      classes: (s.classes || '').replace(/\./g, '').split(',').map((x) => x.replace('*', '').trim()).filter(Boolean),
    }));
    const costTypes = [...new Set(skills.flatMap((s) => s.cost))].filter((t) => t !== 'random');
    return {
      id: c.slug,
      name: c.name,
      baseName: c.name.replace(/\s*\(S\)\s*$/, ''),
      shippuden: isS,
      portrait: c.portrait,
      description: c.description,
      unlock: unlockMatch
        ? { type: unlockMatch[1] === 'Mission' ? 'mission' : 'free', detail: unlockMatch[2].trim() }
        : { type: 'free', detail: '' },
      chakra: costTypes,
      classes: [...new Set(skills.flatMap((s) => s.classes))],
      skills,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

// ---- balance data -------------------------------------------------------
const balRaw = JSON.parse(fs.readFileSync(path.join(rawMeta, 'balance.json'), 'utf8')).items;
const newsRaw = JSON.parse(fs.readFileSync(path.join(rawMeta, 'news2.json'), 'utf8')).items;

const nameIndex = new Map(); // skill name -> character ids
for (const c of characters) for (const s of c.skills) {
  const k = s.name.toLowerCase();
  if (!nameIndex.has(k)) nameIndex.set(k, new Set());
  nameIndex.get(k).add(c.id);
}

const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));
let unmatched = 0;
const updates = balRaw.map((u) => {
  const meta = newsRaw.find((n) => n.slug === u.slug);
  const entries = [];
  for (const card of u.cards) {
    const votes = new Map();
    for (const s of card.skills) for (const id of nameIndex.get((s.name || '').toLowerCase()) || []) votes.set(id, (votes.get(id) || 0) + 1);
    const best = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!best) { unmatched++; continue; }
    const m = (card.stats || '').match(/([\d,]+)\s*\(([\d.]+)%\)\s*Wins\s*([\d,]+)\s*\(([\d.]+)%\)\s*Matches/);
    entries.push({
      characterId: best[0],
      type: (card.type || '').toLowerCase().replace(/s$/, ''), // nerf | boost | tweak
      wins: m ? num(m[1]) : null,
      winRate: m ? num(m[2]) : null,
      matches: m ? num(m[3]) : null,
      pickShare: m ? num(m[4]) : null,
      skills: card.skills.map((s) => ({ name: s.name, image: s.image, changes: s.changes })),
      note: card.note || '',
    });
  }
  return { slug: u.slug, title: meta?.title || u.title || u.slug, date: meta?.date || '', entries };
}).filter((u) => u.date);

const news = newsRaw.map((n) => ({
  slug: n.slug,
  title: n.title,
  date: n.date,
  time: n.time,
  body: n.body,
  images: n.images,
}));

fs.writeFileSync(path.join(out, 'characters.json'), JSON.stringify(characters));
fs.writeFileSync(path.join(out, 'updates.json'), JSON.stringify(updates));
fs.writeFileSync(path.join(out, 'news.json'), JSON.stringify(news));
console.log(`characters ${characters.length}, updates ${updates.length}, entries ${updates.reduce((a, u) => a + u.entries.length, 0)}, unmatched cards ${unmatched}`);
