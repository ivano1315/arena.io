# Skill analysis task (Naruto-Arena Classic)

You are annotating character skills for a ranking model. Read the skill descriptions and convert each one into
**numbers**. Be consistent and conservative; use judgement, not guesswork about the wider game.

## Game rules you need (Naruto-Arena Classic)

- Teams of 3 vs 3. Each character uses **at most one skill per turn**. Games usually last ~8 turns.
- Skills cost chakra (types: taijutsu, bloodline, ninjutsu, genjutsu, random). A team earns about 1 chakra per living
  character per turn. `cooldown` = turns before the same skill can be used again (0 = none).
- Health is 100 per character. "Piercing" damage ignores damage reduction, "affliction" ignores defenses entirely
  (it also ignores invulnerability), "normal" is reduced by damage reduction / destructible defense.
- "Stun" stops skills from being used. "Invulnerable" = cannot be targeted by harmful skills.
- Skills can be "replaced by" or "require" other skills of the same character; read the whole kit of a character
  (all its skills are in the input) before annotating, because skills combo.
- Skill names starting with "Passive:" are passives (always on, never cost an action).

## Input

`input/chunk-N.json`: array of characters:
`{ "id", "name", "skills": [ { "name", "cost": ["ninjutsu","random"], "cooldown": 2, "classes": [..], "description" } ] }`

## Output

For **every** skill of every character write one object. Write results as JSON arrays into
`output/chunk-N-partK.json` (K = 1,2,3,... , at most ~40 skills per file so each write stays small).
Plain JSON only, no comments. Each object:

```json
{
  "id": "character id exactly as in the input",
  "skill": "skill name exactly as in the input",
  "passive": false,
  "dmg": 45,
  "dmgTargets": 1,
  "dmgTurns": 1,
  "dmgKind": "normal",
  "ctrl": 0,
  "def": 0,
  "heal": 0,
  "chakra": 0,
  "util": 0,
  "span": 1,
  "stack": null,
  "needs": null,
  "reliability": 1,
  "note": "short reason, max 14 words"
}
```

Field meanings (all numbers are **per single use of the skill**, assuming it works as described):

- `passive`: true for always-on passives. For passives, every number below is the **average per turn** while the
  passive is active across a typical game (not a one-off).
- `dmg`: total damage dealt to **one** target by this use, summed over all turns of the effect
  (e.g. "15 damage each turn for 3 turns" = 45). Include bonus damage that applies by default or whose condition is
  usually met; for conditional bonuses that are NOT usually met add roughly half. Health stolen counts as damage.
- `dmgTargets`: how many enemies are hit: 1, 2, or 3 (3 = all enemies). Random single enemy = 1.
- `dmgTurns`: number of turns the damage is spread over (1 = instant).
- `dmgKind`: "normal" | "piercing" | "affliction" | "none" (use the dominant kind; "none" when dmg is 0).
- `ctrl`: enemy "disabled turns" created: Σ over targets of (turns stunned × coverage). Coverage: 1.0 = all skills
  stunned, 0.6 = harmful or most skills, 0.4 = one class or one skill. "Cannot use skill X" ≈ 0.4 per turn.
  Extra chakra cost on enemies ≈ 0.3 per turn. Counters/reflects are NOT control (put them in `util`).
- `def`: protection for your team in **HP-equivalents prevented**: invulnerability ≈ 30 per turn per protected ally;
  damage reduction ≈ (points or %) × ~2 hits per turn × turns (a 50% DR on ~30 incoming damage ≈ 15 per hit);
  destructible defense = its full HP value; multiply by allies protected.
- `heal`: HP restored to your team in total (self-healing included, over time included).
- `chakra`: net chakra swing: +1 per chakra your team gains, +1.5 per chakra removed or stolen from enemies,
  -1 per chakra it makes the enemy team gain; reducing your own costs counts +0.5 per chakra saved per use.
- `util`: 0-3 rating for everything else: counters, reflects, invisibility, ignoring invulnerability/defenses,
  target manipulation, enabling or upgrading other skills of the kit, removing enemy buffs/defense.
  0 = nothing, 1 = minor, 2 = notable, 3 = game-changing. Mention the reason in `note`.
- `span`: the number of turns the non-damage effects (ctrl, def, heal, chakra, util) are spread over (1 = instant,
  3 = lasts three turns, 8 = permanent). Passives use 1.
- `stack`: `null`, or an object for **cumulative / snowballing** skills:
  `{"stat": "dmg"|"ctrl"|"def"|"heal"|"chakra", "perUse": number, "target": "skill name or self", "maxUses": number}`
  meaning: each use (or each trigger) of THIS skill permanently adds `perUse` to that stat of `target`
  (a skill name of the same character, or "self"), up to `maxUses` times (use 8 if unlimited). Example: "permanently
  increases the damage of Rasengan by 5 each time this is used" -> stat dmg, perUse 5, target "Rasengan".
  Passives that grow over time: use stat+perUse per turn with target "self" and target stat being that passive's own.
- `needs`: `null`, or `{"skill": "other skill name", "window": number|null}` if this skill can only be used after
  / while another skill of the same character is used or active. `window` = how many turns that enabling lasts
  (null = permanent once enabled).
- `reliability`: 0.4 - 1.0, chance the described value actually lands: 1.0 for unconditional; 0.8 for easily
  dodged/blocked single-target effects; 0.6 for effects that need a condition or an enemy action (counters
  that trigger only if the enemy uses a certain skill); 0.4 for very situational.
- `note`: max 14 words explaining non-obvious choices.

## Rules of thumb

- Use numbers from the text. If a skill only enables others, `dmg` etc. are 0 and put the value in `util` and `needs`
  / `stack` of the skills it empowers.
- Do not double count: a stun-and-damage skill has both `dmg` and `ctrl`.
- Round to whole numbers (one decimal at most for `ctrl`).
- Cooldown and cost are given in the input; do not output them.
- Every skill in the input MUST appear exactly once in the output, with the exact `id` and `skill` strings.
