import charactersRaw from '../data/characters.json';
import updatesRaw from '../data/updates.json';
import newsRaw from '../data/news.json';

export type Chakra = 'taijutsu' | 'bloodline' | 'ninjutsu' | 'genjutsu' | 'random';
export const CHAKRA_ORDER: Chakra[] = ['taijutsu', 'bloodline', 'ninjutsu', 'genjutsu', 'random'];
export const CHAKRA_LABEL: Record<Chakra, string> = {
  taijutsu: 'Taijutsu',
  bloodline: 'Bloodline',
  ninjutsu: 'Ninjutsu',
  genjutsu: 'Genjutsu',
  random: 'Random',
};

export interface Skill {
  name: string;
  image: string;
  description: string;
  cooldown: number;
  cost: Chakra[];
  classes: string[];
}

export interface Character {
  id: string;
  name: string;
  baseName: string;
  shippuden: boolean;
  portrait: string;
  description: string;
  unlock: { type: 'mission' | 'free'; detail: string };
  chakra: Chakra[];
  classes: string[];
  skills: Skill[];
}

export type ChangeType = 'nerf' | 'boost' | 'tweak';

export interface UpdateEntry {
  characterId: string;
  type: ChangeType;
  wins: number | null;
  winRate: number | null;
  matches: number | null;
  pickShare: number | null;
  skills: { name: string; image: string; changes: string[] }[];
  note: string;
}

export interface Update {
  slug: string;
  title: string;
  date: string;
  entries: UpdateEntry[];
}

export interface NewsPost {
  slug: string;
  title: string;
  date: string;
  time: string;
  body: string;
  images: string[];
}

export const characters = charactersRaw as Character[];
export const updates = updatesRaw as Update[]; // newest first
export const news = newsRaw as NewsPost[];

export const characterById = new Map(characters.map((c) => [c.id, c]));

export const totalSkills = characters.reduce((n, c) => n + c.skills.length, 0);

export interface HistoryItem extends UpdateEntry {
  update: Update;
}

/** Every balance entry for a character, newest first. */
export function historyOf(id: string): HistoryItem[] {
  const out: HistoryItem[] = [];
  for (const u of updates) for (const e of u.entries) if (e.characterId === id) out.push({ ...e, update: u });
  return out;
}

/** Latest win-rate snapshot per character (as published with the newest update that touched them). */
export function latestStats() {
  const seen = new Map<string, HistoryItem>();
  for (const u of updates)
    for (const e of u.entries)
      if (!seen.has(e.characterId) && e.winRate != null && e.matches != null) seen.set(e.characterId, { ...e, update: u });
  return [...seen.values()];
}

/** Keyword heuristics used by the Team Builder. They read the skill text, so treat them as hints. */
export const TRAITS: { key: string; label: string; test: RegExp; hint: string }[] = [
  { key: 'stun', label: 'Stun / Control', test: /\bstun/i, hint: 'Stops enemy skills from being used.' },
  { key: 'invuln', label: 'Invulnerability', test: /invulnerab/i, hint: 'Can make a teammate untouchable for a turn.' },
  { key: 'heal', label: 'Healing', test: /\b(heal|restores?|recovers?)\b[^.]*\b(health|hp)|healed for|heals?\b/i, hint: 'Recovers health for the team.' },
  { key: 'dr', label: 'Damage reduction', test: /damage reduction|reduces? (all )?(incoming )?damage|reduce.*damage/i, hint: 'Softens incoming damage.' },
  { key: 'drain', label: 'Chakra drain', test: /(remov|steal|drain|destroy)\w*[^.]*chakra|chakra[^.]*(remov|stolen|steal|drain)/i, hint: 'Takes away enemy chakra.' },
  { key: 'affliction', label: 'Affliction damage', test: /affliction/i, hint: 'Damage that ignores defenses.' },
  { key: 'piercing', label: 'Piercing damage', test: /piercing/i, hint: 'Damage that ignores damage reduction.' },
  { key: 'aoe', label: 'Hits all enemies', test: /all enem(y|ies)|every enemy/i, hint: 'Multi-target pressure.' },
  { key: 'counter', label: 'Counter / Reflect', test: /\b(counter|reflect)/i, hint: 'Punishes enemy skills.' },
  { key: 'ignoreInv', label: 'Ignores invulnerability', test: /ignores? invulnerab/i, hint: 'Breaks through invulnerable targets.' },
];

export function traitsOf(chars: Character[]) {
  const result = new Map<string, number>();
  for (const t of TRAITS) {
    let n = 0;
    for (const c of chars) if (c.skills.some((s) => t.test.test(s.description))) n++;
    result.set(t.key, n);
  }
  return result;
}

export function chakraNeeds(chars: Character[]) {
  const total: Record<Chakra, number> = { taijutsu: 0, bloodline: 0, ninjutsu: 0, genjutsu: 0, random: 0 };
  for (const c of chars) for (const s of c.skills) for (const k of s.cost) total[k]++;
  return total;
}
