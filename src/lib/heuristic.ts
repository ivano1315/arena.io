// Regex reader of skill descriptions. Only used as a fallback for skills the agents did not annotate.
import type { Skill, Chakra } from './data';

export interface SkillAnalysis {
  name: string;
  image: string;
  damage: number; // points
  control: number;
  defense: number;
  sustain: number;
  utility: number;
  power: number; // sum of the five above, cooldown-adjusted
  costWeight: number;
  cooldown: number;
  efficiency: number; // power per chakra
  rawDamage: number; // approximate damage number, for display
  tags: string[]; // keys such as "stun" or "dr:15", translated in the UI
}

const num = (s: string | undefined, d = 1) => (s === undefined || s === '' ? d : Number(s));
const cdFactor = (cd: number) => 1 / (1 + 0.12 * cd);
const CH = '(?:random|taijutsu|bloodline|ninjutsu|genjutsu)';

function durationAfter(text: string, from: number, span = 90, fallback = 1, cap = 4) {
  const w = text.slice(from, from + span);
  const m = w.match(/for (\d+) turns?/i);
  if (m) return Math.min(Number(m[1]), cap);
  if (/permanent/i.test(w)) return cap;
  return fallback;
}

const hasAoe = (t: string) => /all enem|each enem|every enem/i.test(t) && !/one enem|one random enem|an enem/i.test(t);

export function analyzeSkill(s: Skill): SkillAnalysis {
  const t = s.description;
  const tags: string[] = [];
  let damage = 0, control = 0, defense = 0, sustain = 0, utility = 0, rawDamage = 0;

  // --- damage -------------------------------------------------------------
  const dmgRe = /(\d+)\s+(?:points? of\s+)?((?:additional|extra|more)\s+)?(?:(?:permanent|unpierceable)\s+)?(?:(affliction|piercing|physical|chakra|mental|non-affliction)\s+)?damage(?!\s+reduction)/gi;
  for (const m of t.matchAll(dmgRe)) {
    let v = Number(m[1]);
    const after = t.slice(m.index! + m[0].length, m.index! + m[0].length + 45);
    const extra = !!m[2];
    const kind = (m[3] || '').toLowerCase();
    if (extra) v *= 0.6; // conditional bonus damage
    if (kind === 'piercing' || kind === 'affliction') v *= 1.25;
    v *= durationAfter(t, m.index! + m[0].length, 60, 1, 4) || 1;
    if (/all enem|each enem|every enem/i.test(after) || (!/one |random enem/i.test(after) && hasAoe(t))) v *= 2.5;
    rawDamage += v;
  }
  const steal = [...t.matchAll(/steal\w*\s+(\d+)\s+health/gi)].reduce((a, m) => a + Number(m[1]) * durationAfter(t, m.index! + m[0].length, 40), 0);
  if (steal) {
    rawDamage += steal * 0.7;
    sustain += steal / 20;
    tags.push(`drain:${steal}`);
  }
  damage = rawDamage / 10;
  if (rawDamage >= 1) tags.unshift(`dmg:${Math.round(rawDamage)}`);

  // --- control ------------------------------------------------------------
  let stunPts = 0;
  for (const m of t.matchAll(/stun/gi)) {
    const before = t.slice(Math.max(0, m.index! - 28), m.index!);
    if (/ignor|immune|cannot be|can't be|remov|end\w*|resist|unaffected|from stun/i.test(before)) continue;
    const after = t.slice(m.index!, m.index! + 90);
    const dur = durationAfter(t, m.index!, 90, 1, 4);
    const broad = /(all|their|his|her) (of )?(\w+ )?skills|all skills/i.test(after) && !/(physical|chakra|mental|melee|ranged|harmful|friendly|non-)/i.test(after.slice(0, 45));
    const scope = broad ? 3 : 2;
    let v = scope * dur;
    if (/all enem|each enem|every enem/i.test(after)) v *= 2.2;
    else if (/random/i.test(after.slice(0, 30))) v *= 0.8;
    stunPts += v;
  }
  stunPts = Math.min(stunPts, 12);
  if (stunPts) tags.push('stun');
  control += stunPts;
  if (/(cannot|can't|unable to) (use|be used)/i.test(t) && !/stun/i.test(t)) { control += 1.5; tags.push('disable'); }
  if (/(cost|costs)\s+(?:1|one|\d)\s+additional/i.test(t) || /additional (random )?chakra/i.test(t)) { control += 1.2; tags.push('costTax'); }

  // --- defense ------------------------------------------------------------
  for (const m of t.matchAll(/invulnerab\w*/gi)) {
    const before = t.slice(Math.max(0, m.index! - 70), m.index!);
    if (/ignor|break|through|remov/i.test(before.slice(-22))) continue;
    if (/enem(y|ies)[^.]{0,45}$/i.test(before) && !/(makes?|making)\s+(himself|herself|\w+)\s*$/i.test(before)) continue; // enemy becoming invulnerable
    if (!/(makes?|making|become|becomes|gains?|grants?|giving|renders?|protect)/i.test(before)) continue;
    let v = 4 * durationAfter(t, m.index!, 60, 1, 3);
    if (/all allies|his team|her team|allies/i.test(t.slice(Math.max(0, m.index! - 60), m.index! + 40))) v *= 1.5;
    defense += v;
    tags.push('invuln');
    break; // count it once per skill
  }
  for (const m of t.matchAll(/(\d+)%\s+(?:unpierceable\s+)?damage reduction/gi)) {
    defense += (Number(m[1]) / 15) * durationAfter(t, m.index!, 70, 1, 3);
    tags.push(`drp:${m[1]}`);
  }
  for (const m of t.matchAll(/(\d+)\s+points? of (?:unpierceable\s+)?damage reduction/gi)) {
    defense += (Number(m[1]) / 8) * durationAfter(t, m.index!, 70, 1, 3);
    tags.push(`dr:${m[1]}`);
  }
  for (const m of t.matchAll(/(\d+)\s+(?:points? of\s+)?(?:permanent\s+)?destructible defense/gi)) {
    let v = Number(m[1]) / 10;
    if (/allies|team/i.test(t.slice(Math.max(0, m.index! - 70), m.index!))) v *= 1.6;
    defense += v;
    tags.push(`shield:${m[1]}`);
  }

  // --- sustain ------------------------------------------------------------
  for (const m of t.matchAll(/(?:heal\w*|restor\w*|recover\w*|regain\w*)[^.]{0,50}?(\d+)\s*(?:points? of\s+)?(?:health|hp)/gi)) {
    if (/steal/i.test(m[0])) continue;
    let v = (Number(m[1]) / 10) * durationAfter(t, m.index! + m[0].length, 50, 1, 4);
    if (/all allies|his team|her team|allies/i.test(m[0])) v *= 1.5;
    sustain += v;
    tags.push(`heal:${m[1]}`);
  }

  // --- utility ------------------------------------------------------------
  const drainRe = new RegExp(`(?:steal|remov|drain|destroy|absorb)\\w*\\s+(?:up to\\s+)?(\\d+|all)?\\s*(?:${CH}(?:\\s*(?:,|or|and)\\s*${CH})*)?\\s*chakra(?!\\s+skills?)`, 'gi');
  for (const m of t.matchAll(drainRe)) {
    if (/remov\w*\s+(all\s+)?(harmful|chakra)/i.test(m[0]) && !/\d/.test(m[0])) continue;
    utility += 2 * (m[1] === 'all' ? 3 : num(m[1]));
    tags.push('chakraDrain');
  }
  const gainRe = new RegExp(`(?:gain\\w*|regain\\w*|receiv\\w*|restor\\w*)\\s+(\\d+)\\s+${CH}?\\s*chakra(?!\\s+skills?)`, 'gi');
  for (const m of t.matchAll(gainRe)) {
    utility += 2 * Number(m[1]);
    tags.push('chakraGain');
  }
  if (/\b(counter\w*|reflect\w*)\b/i.test(t)) { utility += 2; tags.push('counter'); }
  if (/ignores? invulnerab/i.test(t)) { utility += 1.5; tags.push('ignoresInvuln'); }
  if (/(cost|costs)\s+\d+\s+(less|fewer)/i.test(t)) { utility += 1; tags.push('costCut'); }

  // --- combine ------------------------------------------------------------
  const f = cdFactor(s.cooldown);
  const costWeight = s.cost.reduce((a, k: Chakra) => a + (k === 'random' ? 1 : 1.2), 0);
  const power = (damage + control + defense + sustain + utility) * f;
  return {
    name: s.name, image: s.image,
    damage, control, defense, sustain, utility,
    power, costWeight, cooldown: s.cooldown,
    efficiency: power / (costWeight + 0.6),
    rawDamage,
    tags: [...new Set(tags)],
  };
}

