// Ranking model. Per-skill numbers come from the agent annotations (src/data/analysis.json); a rotation simulator
// (sim.ts) then plays each character for HORIZON turns, so cooldowns, chakra income, stacking and "needs" chains matter.
// Skills without an annotation fall back to the regex reader in heuristic.ts.
import type { Character } from './data';
import analysisRaw from '../data/analysis.json';
import { analyzeSkill } from './heuristic';
import { HORIZON, STATS, annotationTags, cleanAnnotation, simulateCharacter, type Annotation, type Stat } from './sim';

export { HORIZON };

export type Category = Stat | 'efficiency';
export const CATEGORIES: Category[] = ['damage', 'control', 'defense', 'sustain', 'utility', 'efficiency'];

export type Weights = Record<Category, number>;
export const DEFAULT_WEIGHTS: Weights = { damage: 25, control: 20, defense: 20, sustain: 8, utility: 12, efficiency: 15 };

export const PRESETS: { key: 'balanced' | 'aggro' | 'control' | 'survival' | 'efficient'; weights: Weights }[] = [
  { key: 'balanced', weights: DEFAULT_WEIGHTS },
  { key: 'aggro', weights: { damage: 45, control: 15, defense: 5, sustain: 0, utility: 10, efficiency: 25 } },
  { key: 'control', weights: { damage: 10, control: 50, defense: 10, sustain: 0, utility: 20, efficiency: 10 } },
  { key: 'survival', weights: { damage: 10, control: 10, defense: 40, sustain: 30, utility: 5, efficiency: 5 } },
  { key: 'efficient', weights: { damage: 15, control: 15, defense: 10, sustain: 5, utility: 5, efficiency: 50 } },
];

const analysis = analysisRaw as unknown as Record<string, Partial<Annotation> & { id: string; skill: string }>;

export interface SkillView {
  name: string;
  image: string;
  tags: string[];
  note: string;
  source: 'agent' | 'heuristic';
  annotation: Annotation;
}

export interface CharacterRaw {
  id: string;
  skills: SkillView[];
  raw: Record<Category, number>;
  rotation: number[]; // skill indexes by turn, -1 = rest
  balanced: Record<Stat, number>; // stat totals of the balanced rotation
  coverage: number; // share of skills annotated by the agents
}

/** Build an annotation from the old regex reader (fallback only). */
function heuristicAnnotation(c: Character, i: number): Annotation {
  const s = c.skills[i];
  const h = analyzeSkill(s);
  return cleanAnnotation({
    id: c.id, skill: s.name, passive: /^passive/i.test(s.name),
    dmg: h.rawDamage, dmgTargets: 1, dmgTurns: 1, dmgKind: h.rawDamage ? 'normal' : 'none',
    ctrl: h.control / 2.5, def: h.defense * 7.5, heal: h.sustain * 10, chakra: h.utility / 2,
    reliability: 0.8, note: '', source: 'heuristic',
  });
}

function annotate(c: Character): Annotation[] {
  return c.skills.map((s, i) => {
    const a = analysis[`${c.id}::${s.name}`];
    return a ? cleanAnnotation({ ...a, source: 'agent' }) : heuristicAnnotation(c, i);
  });
}

let cache: CharacterRaw[] | null = null;
export function rawAll(chars: Character[]): CharacterRaw[] {
  if (cache) return cache;
  cache = chars.map((c) => {
    const ann = annotate(c);
    const sim = simulateCharacter(c, ann);
    const raw = { ...sim.perStat, efficiency: sim.efficiency } as Record<Category, number>;
    return {
      id: c.id,
      skills: c.skills.map((s, i) => ({
        name: s.name, image: s.image, annotation: ann[i], tags: annotationTags(ann[i]), note: ann[i].note, source: ann[i].source ?? 'agent',
      })),
      raw,
      rotation: sim.rotation,
      balanced: Object.fromEntries(STATS.map((st, k) => [st, sim.balanced[k]])) as Record<Stat, number>,
      coverage: ann.filter((a) => a.source === 'agent').length / Math.max(1, ann.length),
    };
  });
  return cache;
}

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';
export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D'];

export interface RankedCharacter extends CharacterRaw {
  scores: Record<Category, number>; // 0-100
  total: number; // 0-100
  rank: number;
  tier: Tier;
}

function percentile(values: number[], p: number) {
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * (v.length - 1)))] ?? 0;
}

/** Normalise each category to 0-100 (capped at the 95th percentile so a single outlier doesn't flatten everyone). */
export function rankAll(chars: Character[], weights: Weights): RankedCharacter[] {
  const raws = rawAll(chars);
  const cap = {} as Record<Category, number>;
  for (const k of CATEGORIES) {
    const p95 = percentile(raws.map((r) => r.raw[k]), 0.95);
    cap[k] = p95 > 0 ? p95 : Math.max(...raws.map((r) => r.raw[k]), 1);
  }
  const wSum = CATEGORIES.reduce((a, k) => a + weights[k], 0) || 1;
  const list = raws.map((r) => {
    const scores = {} as Record<Category, number>;
    for (const k of CATEGORIES) scores[k] = Math.min(r.raw[k] / cap[k], 1) * 100;
    const total = CATEGORIES.reduce((a, k) => a + scores[k] * weights[k], 0) / wSum;
    return { ...r, scores, total, rank: 0, tier: 'C' as Tier };
  });
  list.sort((a, b) => b.total - a.total);
  const n = list.length;
  list.forEach((r, i) => {
    r.rank = i + 1;
    const p = i / n;
    r.tier = p < 0.08 ? 'S' : p < 0.25 ? 'A' : p < 0.55 ? 'B' : p < 0.83 ? 'C' : 'D';
  });
  return list;
}

/** Spearman rank correlation, used to sanity-check the model against published win rates. */
export function spearman(a: number[], b: number[]) {
  const rank = (v: number[]) => {
    const idx = v.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length).fill(0);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a), rb = rank(b);
  const n = a.length;
  const ma = ra.reduce((x, y) => x + y, 0) / n, mb = rb.reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db || 1);
}
