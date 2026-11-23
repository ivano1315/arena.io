// Merges the agents' annotations (analysis/output/*.json) into src/data/analysis.json and reports problems.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'analysis', 'output');
const chars = JSON.parse(fs.readFileSync(path.join(root, 'src', 'data', 'characters.json'), 'utf8'));

const expected = new Map();
for (const c of chars) for (const s of c.skills) expected.set(`${c.id}::${s.name}`, { c, s });

const merged = {};
const problems = { parseErrors: [], unknown: [], duplicates: [], missing: [], odd: [] };
const files = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.json')) : [];
for (const f of files) {
  let arr;
  try { arr = JSON.parse(fs.readFileSync(path.join(outDir, f), 'utf8')); } catch (e) { problems.parseErrors.push(`${f}: ${e.message}`); continue; }
  if (!Array.isArray(arr)) { problems.parseErrors.push(`${f}: not an array`); continue; }
  for (const a of arr) {
    const key = `${a.id}::${a.skill}`;
    if (!expected.has(key)) { problems.unknown.push(`${f}: ${key}`); continue; }
    if (merged[key]) { problems.duplicates.push(key); continue; }
    const { s } = expected.get(key);
    const nums = ['dmg', 'dmgTargets', 'dmgTurns', 'ctrl', 'def', 'heal', 'chakra', 'util', 'span', 'reliability'];
    for (const n of nums) if (a[n] != null && typeof a[n] !== 'number') problems.odd.push(`${key}: ${n}=${JSON.stringify(a[n])}`);
    if (a.dmg > 250) problems.odd.push(`${key}: dmg ${a.dmg}`);
    if (a.ctrl > 12) problems.odd.push(`${key}: ctrl ${a.ctrl}`);
    if (a.def > 400) problems.odd.push(`${key}: def ${a.def}`);
    if (a.heal > 250) problems.odd.push(`${key}: heal ${a.heal}`);
    if (a.stack && a.stack.target && a.stack.target !== 'self' && !chars.find((c) => c.id === a.id).skills.some((x) => x.name === a.stack.target)) problems.odd.push(`${key}: stack target "${a.stack.target}" not in kit`);
    if (a.needs && a.needs.skill && !chars.find((c) => c.id === a.id).skills.some((x) => x.name === a.needs.skill)) problems.odd.push(`${key}: needs "${a.needs.skill}" not in kit`);
    merged[key] = a;
    void s;
  }
}
for (const key of expected.keys()) if (!merged[key]) problems.missing.push(key);

// manual corrections on top of the agents' numbers
const overridesFile = path.join(root, 'analysis', 'overrides.json');
let overridden = 0;
if (fs.existsSync(overridesFile)) {
  const overrides = JSON.parse(fs.readFileSync(overridesFile, 'utf8'));
  for (const [key, patch] of Object.entries(overrides)) {
    if (key.startsWith('_')) continue;
    if (!merged[key]) { problems.unknown.push(`overrides: ${key}`); continue; }
    merged[key] = { ...merged[key], ...patch };
    overridden++;
  }
}

fs.writeFileSync(path.join(root, 'src', 'data', 'analysis.json'), JSON.stringify(merged));
console.log(`annotated ${Object.keys(merged).length} / ${expected.size} skills from ${files.length} files, ${overridden} manual overrides`);
for (const [k, v] of Object.entries(problems)) if (v.length) console.log(`${k}: ${v.length}\n  ` + v.slice(0, 12).join('\n  '));
