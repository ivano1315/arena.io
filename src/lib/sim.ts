// Rotation simulator. Given per-skill annotations (damage, control, ... per use) it plays a character for a fixed
// number of turns, respecting cooldowns, chakra income, "needs" chains and stacking skills, and returns the best
// total it can reach for each stat. A character acts once per turn, so having many skills never helps by itself.
import type { Character, Chakra } from './data';

export type Stat = 'damage' | 'control' | 'defense' | 'sustain' | 'utility';
export const STATS: Stat[] = ['damage', 'control', 'defense', 'sustain', 'utility'];

type StackStat = 'dmg' | 'ctrl' | 'def' | 'heal' | 'chakra';

export interface Annotation {
  id: string;
  skill: string;
  passive: boolean;
  dmg: number;
  dmgTargets: number;
  dmgTurns: number;
  dmgKind: 'normal' | 'piercing' | 'affliction' | 'none';
  ctrl: number;
  def: number;
  heal: number;
  chakra: number;
  util: number;
  span: number;
  stack: { stat: StackStat; perUse: number; target: string; maxUses: number } | null;
  needs: { skill: string; window: number | null } | null;
  reliability: number;
  note: string;
  source?: 'agent' | 'heuristic';
}

export const HORIZON = 8; // turns simulated
const CHAKRA_INCOME = 1; // chakra a character's share of the team earns each turn
const CHAKRA_CAP = 6;
const BEAM = 48;
const KIND = { normal: 1, piercing: 1.15, affliction: 1.3, none: 1 } as const;
const CHAKRA_VALUE = 6; // HP-equivalents of one chakra swing
const UTIL_VALUE = 10; // HP-equivalents of one util rating point
const num = (n: unknown, d = 0) => (typeof n === 'number' && Number.isFinite(n) ? n : d);

const chakraCost = (cost: Chakra[]) => cost.reduce((a, k) => a + (k === 'random' ? 1 : 1.2), 0);

interface Bonus { dmg: number; ctrl: number; def: number; heal: number; chakra: number }
const zeroBonus = (): Bonus => ({ dmg: 0, ctrl: 0, def: 0, heal: 0, chakra: 0 });

/** Contribution of one use of an active skill at turn t, per stat [damage, control, defense, sustain, utility]. */
function useValue(a: Annotation, b: Bonus, t: number): number[] {
  const left = HORIZON - t;
  const dTurns = Math.max(1, a.dmgTurns);
  const sTurns = Math.max(1, a.span);
  const fd = Math.min(dTurns, left) / dTurns;
  const fs = Math.min(sTurns, left) / sTurns;
  const r = a.reliability;
  const targets = Math.max(1, a.dmgTargets);
  return [
    (a.dmg + b.dmg) * targets * KIND[a.dmgKind] * fd * r,
    (a.ctrl + b.ctrl) * fs * r,
    (a.def + b.def) * fs * r,
    (a.heal + b.heal) * fs * r,
    ((a.chakra + b.chakra) * CHAKRA_VALUE + a.util * UTIL_VALUE) * fs * r,
  ];
}

/** Per-turn contribution of a passive (its numbers are already per-turn averages). */
function passiveValue(a: Annotation, b: Bonus, grown: number): number[] {
  const r = a.reliability;
  const targets = Math.max(1, a.dmgTargets);
  const g = a.stack && a.stack.target === a.skill ? grown : 0;
  const stat = (key: StackStat) => (a.stack && a.stack.target === a.skill && a.stack.stat === key ? g : 0);
  return [
    (a.dmg + b.dmg + stat('dmg')) * targets * KIND[a.dmgKind] * r,
    (a.ctrl + b.ctrl + stat('ctrl')) * r,
    (a.def + b.def + stat('def')) * r,
    (a.heal + b.heal + stat('heal')) * r,
    ((a.chakra + b.chakra + stat('chakra')) * CHAKRA_VALUE + a.util * UTIL_VALUE) * r,
  ];
}

interface State {
  cd: number[];
  bud: number;
  last: number[];
  stacks: number[];
  bonus: Bonus[];
  total: number;
  vec: number[];
  spent: number;
  seq: number[]; // skill index used each turn, -1 = rest
  key: number;
}

export interface SimResult {
  total: number;
  vec: number[]; // damage, control, defense, sustain, utility
  spent: number;
  seq: number[];
}

function simulate(skills: { a: Annotation; cost: number; cooldown: number }[], weights: number[]): SimResult {
  const n = skills.length;
  const idxOf = new Map(skills.map((s, i) => [s.a.skill, i]));
  let beam: State[] = [{
    cd: new Array(n).fill(0), bud: 0, last: new Array(n).fill(-99), stacks: new Array(n).fill(0),
    bonus: skills.map(zeroBonus), total: 0, vec: [0, 0, 0, 0, 0], spent: 0, seq: [], key: 0,
  }];
  const dot = (v: number[]) => v.reduce((s, x, i) => s + x * weights[i], 0);

  for (let t = 0; t < HORIZON; t++) {
    const next: State[] = [];
    for (const s of beam) {
      const bud = Math.min(CHAKRA_CAP, s.bud + CHAKRA_INCOME);
      // passives pay out every turn without taking the action
      const vec = s.vec.slice();
      let gain = 0;
      skills.forEach((sk, i) => {
        if (!sk.a.passive) return;
        const pv = passiveValue(sk.a, s.bonus[i], sk.a.stack ? Math.min(t, sk.a.stack.maxUses) * sk.a.stack.perUse : 0);
        pv.forEach((x, k) => { vec[k] += x; });
        gain += dot(pv);
      });
      const base = s.total + gain;
      const advance = (cd: number[]) => cd.map((c) => Math.max(0, c - 1));

      // rest
      next.push({ ...s, cd: advance(s.cd), bud, vec, total: base, seq: [...s.seq, -1], key: base });

      skills.forEach((sk, i) => {
        if (sk.a.passive || s.cd[i] > 0 || bud + 1e-9 < sk.cost) return;
        const nd = sk.a.needs && idxOf.has(sk.a.needs.skill) ? idxOf.get(sk.a.needs.skill)! : -1;
        if (nd >= 0) {
          const lu = s.last[nd];
          if (lu < 0 || (sk.a.needs!.window != null && t - lu > sk.a.needs!.window!)) return;
        }
        const v = useValue(sk.a, s.bonus[i], t);
        const cvec = vec.map((x, k) => x + v[k]);
        const cd = s.cd.slice(); cd[i] = sk.cooldown + 1;
        const last = s.last.slice(); last[i] = t;
        const stacks = s.stacks.slice();
        const bonus = s.bonus.map((b) => ({ ...b }));
        let heur = 0;
        const st = sk.a.stack;
        if (st && stacks[i] < st.maxUses) {
          const tgt = idxOf.get(st.target) ?? i;
          bonus[tgt][st.stat] += st.perUse;
          stacks[i]++;
          const w = weights[{ dmg: 0, ctrl: 1, def: 2, heal: 3, chakra: 4 }[st.stat]];
          heur = st.perUse * w * Math.max(0, HORIZON - t - 1) * 0.35;
        }
        const total = base + dot(v);
        next.push({
          cd: advance(cd), bud: bud - sk.cost, last, stacks, bonus, total, vec: cvec,
          spent: s.spent + sk.cost, seq: [...s.seq, i], key: total + heur,
        });
      });
    }
    next.sort((x, y) => y.key - x.key);
    beam = next.slice(0, BEAM);
  }
  const best = beam.reduce((a, b) => (b.total > a.total ? b : a));
  return { total: best.total, vec: best.vec, spent: best.spent, seq: best.seq };
}

export interface CharacterSim {
  perStat: Record<Stat, number>; // best total per stat over HORIZON turns
  efficiency: number;
  rotation: number[]; // balanced rotation, skill indexes (-1 = rest)
  balanced: number[]; // stat totals of the balanced rotation
}

export function simulateCharacter(c: Character, ann: Annotation[]): CharacterSim {
  const skills = c.skills.map((s, i) => ({ a: ann[i], cost: chakraCost(s.cost), cooldown: s.cooldown }));
  const perStat = {} as Record<Stat, number>;
  STATS.forEach((st, k) => {
    const w = [0, 0, 0, 0, 0]; w[k] = 1;
    perStat[st] = simulate(skills, w).total;
  });
  const balancedW = [1, 25, 1, 1, 1];
  const bal = simulate(skills, balancedW);
  return {
    perStat,
    efficiency: bal.total / (bal.spent + 2),
    rotation: bal.seq,
    balanced: bal.vec,
  };
}

/** Compact, translatable chips describing an annotation. Format "key|a|b|c". */
export function annotationTags(a: Annotation): string[] {
  const t: string[] = [];
  if (a.passive) t.push('passive');
  if (a.dmg > 0) {
    t.push(`dmg|${Math.round(a.dmg)}`);
    if (a.dmgTargets > 1) t.push(`aoe|${a.dmgTargets}`);
    if (a.dmgTurns > 1) t.push(`dot|${Math.round(a.dmg / a.dmgTurns)}|${a.dmgTurns}`);
    if (a.dmgKind === 'piercing' || a.dmgKind === 'affliction') t.push(`kind|${a.dmgKind}`);
  }
  if (a.ctrl > 0) t.push(`ctrl|${a.ctrl.toFixed(1)}`);
  if (a.def > 0) t.push(`def|${Math.round(a.def)}`);
  if (a.heal > 0) t.push(`heal|${Math.round(a.heal)}`);
  if (a.chakra) t.push(`chakra|${a.chakra > 0 ? '+' : ''}${a.chakra}`);
  if (a.util > 0) t.push(`util|${a.util}`);
  if (a.stack) t.push(`stack|${a.stack.perUse}|${a.stack.stat}|${a.stack.target}`);
  if (a.needs) t.push(`needs|${a.needs.skill}`);
  if (a.reliability < 1) t.push(`rel|${Math.round(a.reliability * 100)}`);
  return t;
}

export function cleanAnnotation(raw: Partial<Annotation> & { id: string; skill: string }): Annotation {
  const stack = raw.stack && typeof raw.stack === 'object' && raw.stack.perUse
    ? {
        stat: (['dmg', 'ctrl', 'def', 'heal', 'chakra'] as const).includes(raw.stack.stat as StackStat) ? raw.stack.stat : 'dmg',
        perUse: num(raw.stack.perUse),
        target: raw.stack.target && raw.stack.target !== 'self' ? String(raw.stack.target) : raw.skill,
        maxUses: Math.max(1, num(raw.stack.maxUses, 8)),
      }
    : null;
  const needs = raw.needs && typeof raw.needs === 'object' && raw.needs.skill
    ? { skill: String(raw.needs.skill), window: raw.needs.window == null ? null : num(raw.needs.window, 1) }
    : null;
  return {
    id: raw.id, skill: raw.skill,
    passive: !!raw.passive,
    dmg: Math.max(0, num(raw.dmg)), dmgTargets: Math.min(3, Math.max(1, num(raw.dmgTargets, 1))),
    dmgTurns: Math.max(1, num(raw.dmgTurns, 1)),
    dmgKind: (['normal', 'piercing', 'affliction', 'none'] as const).includes(raw.dmgKind as never) ? raw.dmgKind! : 'normal',
    ctrl: Math.max(0, num(raw.ctrl)), def: Math.max(0, num(raw.def)), heal: Math.max(0, num(raw.heal)),
    chakra: num(raw.chakra), util: Math.min(3, Math.max(0, num(raw.util))), span: Math.max(1, num(raw.span, 1)),
    stack, needs,
    reliability: Math.min(1, Math.max(0.3, num(raw.reliability, 1))),
    note: String(raw.note ?? ''),
    source: raw.source ?? 'agent',
  };
}
