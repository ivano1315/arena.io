// Team synergy and counter-pick model. It reuses the per-skill numbers behind the ranking (rank.ts) plus a few
// text flags, and applies kit-level rules ("they stack defense, you pierce it"). It does not use match data.
import { characters, type Character, type Chakra } from './data';
import { DEFAULT_WEIGHTS, rankAll, type Category, type RankedCharacter, type Weights } from './rank';

export interface Features {
  id: string;
  ctrlTotal: number;
  defTotal: number;
  healTotal: number;
  dmgTotal: number;
  burst: number;
  pierceShare: number;
  dotTotal: number;
  invulnCount: number;
  avgCost: number;
  setupShare: number;
  stunImmune: boolean;
  uncounterable: boolean;
  ignoresInvuln: boolean;
  destroysDef: boolean;
  drainCount: number;
  counterCount: number;
  removesHarm: boolean;
  aoeCount: number;
  colors: Record<Exclude<Chakra, 'random'>, number>;
  /** How many chakra of the "random" kind the skills ask for (any type pays for them). */
  random: number;
}

const RE = {
  stunImmune: /(ignores?|immune to|cannot be|can't be|unaffected by)\s+(all\s+)?(stun|stuns|stunned)/i,
  uncounterable: /uncounterable|cannot be countered|can't be countered|cannot be reflected|ignores? (counters|reflect)/i,
  ignoresInvuln: /ignores? invulnerab/i,
  destroysDef: /destroy(s|ed)?[^.]{0,60}(destructible defense|damage reduction)|remov\w+[^.]{0,40}(destructible defense|damage reduction)/i,
  drain: /(steal|remov|drain|destroy|absorb)\w*\s+(\d+|all|one)?\s*(random|taijutsu|bloodline|ninjutsu|genjutsu)?(\s*(,|or|and)\s*(random|taijutsu|bloodline|ninjutsu|genjutsu))*\s*chakra(?!\s+skills?)/i,
  counter: /\bcounter(s|ed)?\b|reflect/i,
  removesHarm: /removes?\s+(all\s+)?(harmful|negative|affliction|stun)/i,
  invulnSelf: /(makes?|become|becomes|gains?|granting|grants?)[^.]{0,40}invulnerab/i,
};

function featuresOf(c: Character, r: RankedCharacter): Features {
  const act = r.skills.map((s, i) => ({ a: s.annotation, s: c.skills[i] })).filter((x) => !x.a.passive);
  const sum = (f: (x: (typeof act)[number]) => number) => act.reduce((t, x) => t + f(x), 0);
  const dmg = (x: (typeof act)[number]) => x.a.dmg * Math.max(1, x.a.dmgTargets);
  const dmgTotal = sum(dmg);
  const pierce = sum((x) => (x.a.dmgKind === 'piercing' || x.a.dmgKind === 'affliction' ? dmg(x) : 0));
  const text = (re: RegExp) => c.skills.filter((s) => re.test(s.description)).length;
  const colors = { taijutsu: 0, bloodline: 0, ninjutsu: 0, genjutsu: 0 } as Features['colors'];
  let random = 0;
  for (const s of c.skills) for (const k of s.cost) { if (k === 'random') random++; else colors[k]++; }
  return {
    random,
    id: c.id,
    ctrlTotal: sum((x) => x.a.ctrl),
    defTotal: sum((x) => x.a.def),
    healTotal: sum((x) => x.a.heal),
    dmgTotal,
    burst: Math.max(0, ...act.map(dmg)),
    pierceShare: dmgTotal ? pierce / dmgTotal : 0,
    dotTotal: sum((x) => (x.a.dmgTurns > 1 ? x.a.dmg : 0)),
    invulnCount: text(RE.invulnSelf),
    avgCost: act.length ? sum((x) => x.s.cost.reduce((t, k) => t + (k === 'random' ? 1 : 1.2), 0)) / act.length : 0,
    setupShare: act.length ? act.filter((x) => x.a.needs || x.a.stack).length / act.length : 0,
    stunImmune: text(RE.stunImmune) > 0,
    uncounterable: text(RE.uncounterable) > 0,
    ignoresInvuln: text(RE.ignoresInvuln) > 0,
    destroysDef: text(RE.destroysDef) > 0,
    drainCount: text(RE.drain),
    counterCount: text(RE.counter),
    removesHarm: text(RE.removesHarm) > 0,
    aoeCount: act.filter((x) => x.a.dmgTargets >= 3).length,
    colors,
  };
}

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------------------------------------------
// Counters

export type CounterReason = 'pierce' | 'invuln' | 'stunImmune' | 'outlast' | 'drain' | 'uncounterable' | 'setup' | 'stunlock' | 'burst';

const RULES: { key: CounterReason; w: number; threat: (e: Features) => number; answer: (c: Features) => number }[] = [
  { key: 'pierce', w: 1.0, threat: (e) => clamp(e.defTotal / 250), answer: (c) => clamp(Math.max(c.pierceShare, c.destroysDef ? 0.8 : 0) * (c.dmgTotal >= 60 ? 1 : 0.6)) },
  { key: 'invuln', w: 1.0, threat: (e) => clamp(e.invulnCount / 3), answer: (c) => (c.ignoresInvuln ? 1 : c.pierceShare > 0.3 ? 0.7 : 0) },
  { key: 'stunImmune', w: 1.2, threat: (e) => clamp(e.ctrlTotal / 8), answer: (c) => (c.stunImmune ? 1 : 0) },
  { key: 'outlast', w: 0.8, threat: (e) => clamp(e.dotTotal / 120), answer: (c) => clamp(c.healTotal / 120 + (c.removesHarm ? 0.5 : 0)) },
  { key: 'drain', w: 0.8, threat: (e) => clamp((e.avgCost - 0.8) / 1.2), answer: (c) => clamp(c.drainCount / 2) },
  { key: 'uncounterable', w: 0.8, threat: (e) => clamp(e.counterCount / 2), answer: (c) => (c.uncounterable ? 1 : c.aoeCount > 0 ? 0.5 : 0) },
  { key: 'setup', w: 0.9, threat: (e) => clamp(e.setupShare * 2.5), answer: (c) => clamp(c.ctrlTotal / 8 + c.burst / 80) },
  { key: 'stunlock', w: 0.7, threat: (e) => clamp(e.dmgTotal / 250), answer: (c) => clamp(c.ctrlTotal / 8) },
  { key: 'burst', w: 0.6, threat: (e) => 1 - clamp(e.defTotal / 150), answer: (c) => clamp(c.burst / 90) },
];
const RULE_W = RULES.reduce((a, r) => a + r.w, 0);

export interface CounterResult {
  id: string;
  score: number; // 0-100
  reasons: { key: CounterReason; weight: number }[];
}

export class Matchups {
  readonly features = new Map<string, Features>();
  readonly ranked: RankedCharacter[];
  readonly byId = new Map<string, RankedCharacter>();
  readonly chars = new Map<string, Character>();

  constructor(weights: Weights = DEFAULT_WEIGHTS) {
    this.ranked = rankAll(characters, weights);
    for (const r of this.ranked) this.byId.set(r.id, r);
    for (const c of characters) {
      this.chars.set(c.id, c);
      this.features.set(c.id, featuresOf(c, this.byId.get(c.id)!));
    }
  }

  /** How well `c` answers `e`'s kit (0-100) and why. */
  counter(cId: string, eId: string): CounterResult {
    const c = this.features.get(cId)!, e = this.features.get(eId)!;
    let sum = 0;
    const reasons: CounterResult['reasons'] = [];
    for (const r of RULES) {
      const v = r.w * r.threat(e) * r.answer(c);
      sum += v;
      if (v >= 0.12) reasons.push({ key: r.key, weight: v });
    }
    reasons.sort((a, b) => b.weight - a.weight);
    const power = this.byId.get(cId)!.total;
    const score = clamp((sum / RULE_W) * 3.2) * 80 + power * 0.2;
    return { id: cId, score, reasons: reasons.slice(0, 3) };
  }

  /** Best answers to a set of enemies (average over them). direction 'beats' flips it: who the picked ones answer. */
  counters(enemyIds: string[], direction: 'counter' | 'beats', limit = 16): CounterResult[] {
    const out: CounterResult[] = [];
    for (const c of characters) {
      if (enemyIds.includes(c.id)) continue;
      let score = 0;
      const agg = new Map<CounterReason, number>();
      for (const eid of enemyIds) {
        const r = direction === 'counter' ? this.counter(c.id, eid) : this.counter(eid, c.id);
        score += r.score;
        for (const x of r.reasons) agg.set(x.key, (agg.get(x.key) ?? 0) + x.weight);
      }
      out.push({
        id: c.id,
        score: score / enemyIds.length,
        reasons: [...agg.entries()].map(([key, weight]) => ({ key, weight })).sort((a, b) => b.weight - a.weight).slice(0, 3),
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  // -------------------------------------------------------------------------------------------------------------
  // Trios

  trio(ids: string[]): TrioResult {
    const members = ids.map((id) => this.byId.get(id)!);
    const power = members.reduce((a, m) => a + m.total, 0) / members.length;
    const cats: Exclude<Category, 'efficiency'>[] = ['damage', 'control', 'defense', 'sustain', 'utility'];
    const target = { damage: 2.4, control: 1.8, defense: 1.7, sustain: 0.9, utility: 1.5 };
    const wt = { damage: 1.3, control: 1.2, defense: 1.0, sustain: 0.5, utility: 0.8 };
    const cover = {} as Record<(typeof cats)[number], number>;
    let cw = 0, cs = 0;
    for (const k of cats) {
      const sumK = members.reduce((a, m) => a + m.scores[k], 0) / 100;
      cover[k] = clamp(sumK / target[k]) * 100;
      cs += wt[k] * cover[k]; cw += wt[k];
    }
    const coverage = cs / cw;

    // Chakra arrives at random across the four types, so a team whose skills ask for every type uses what it
    // draws, while a team that leans on one type starves. "Random" costs can be paid with anything, so they count
    // as an even demand over the four types. fit = 100 when demand is perfectly even, 0 when all on one type.
    const col = { taijutsu: 0, bloodline: 0, ninjutsu: 0, genjutsu: 0 };
    for (const id of ids) {
      const f = this.features.get(id)!;
      for (const k of Object.keys(col) as (keyof typeof col)[]) col[k] += f.colors[k] + f.random / 4;
    }
    const total = Object.values(col).reduce((a, b) => a + b, 0) || 1;
    const share = { taijutsu: col.taijutsu / total, bloodline: col.bloodline / total, ninjutsu: col.ninjutsu / total, genjutsu: col.genjutsu / total };
    const tvd = 0.5 * Object.values(share).reduce((a, p) => a + Math.abs(p - 0.25), 0); // 0 (even) .. 0.75 (one type)
    const fit = 100 * (1 - tvd / 0.75);

    return { ids, score: 0.45 * power + 0.4 * coverage + 0.15 * fit, power, coverage, fit, cover, colors: share };
  }

  /** Best trios containing `anchors` (0, 1 or 2 ids). */
  bestTrios(anchors: string[], limit = 10, pool = 70): TrioResult[] {
    const base = (id: string) => this.chars.get(id)!.baseName;
    const ok = (ids: string[]) => new Set(ids.map(base)).size === ids.length;
    const out: TrioResult[] = [];
    const push = (ids: string[]) => { if (ok(ids)) out.push(this.trio(ids)); };
    if (anchors.length >= 3) return [this.trio(anchors.slice(0, 3))];
    const candidates = anchors.length === 0 ? this.ranked.slice(0, pool).map((r) => r.id) : this.ranked.map((r) => r.id).filter((id) => !anchors.includes(id));
    if (anchors.length === 2) for (const c of candidates) push([...anchors, c]);
    else if (anchors.length === 1) for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) push([anchors[0], candidates[i], candidates[j]]);
    else for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) for (let k = j + 1; k < candidates.length; k++) push([candidates[i], candidates[j], candidates[k]]);
    out.sort((a, b) => b.score - a.score);
    // keep variety: don't show many trios that differ by a single member only
    const picked: TrioResult[] = [];
    const seenPair = new Map<string, number>();
    for (const t of out) {
      const free = t.ids.filter((id) => !anchors.includes(id));
      const key = free.slice().sort().join('+');
      const reuse = free.map((id) => seenPair.get(id) ?? 0);
      if (picked.length >= 3 && reuse.some((n) => n >= 3)) continue;
      picked.push(t);
      for (const id of free) seenPair.set(id, (seenPair.get(id) ?? 0) + 1);
      void key;
      if (picked.length >= limit) break;
    }
    return picked;
  }

  /** What each partner adds that the others lack. */
  gapsFilled(partnerId: string, others: string[]): Category[] {
    const p = this.byId.get(partnerId)!;
    const cats: Category[] = ['damage', 'control', 'defense', 'sustain', 'utility'];
    return cats.filter((k) => p.scores[k] >= 60 && others.every((o) => this.byId.get(o)!.scores[k] < 50));
  }
}

export interface TrioResult {
  ids: string[];
  score: number; // 0-100
  power: number;
  coverage: number;
  fit: number;
  cover: Record<'damage' | 'control' | 'defense' | 'sustain' | 'utility', number>;
  colors: Record<'taijutsu' | 'bloodline' | 'ninjutsu' | 'genjutsu', number>;
}

let cached: Matchups | null = null;
export function matchups() {
  if (!cached) cached = new Matchups(DEFAULT_WEIGHTS);
  return cached;
}
