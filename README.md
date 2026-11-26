# arena.io

Fan-made companion for **Naruto-Arena Classic**, modelled on the layout of mlbb.io: character database, meta pulse,
team builder and balance history. Vite + React + TypeScript.

```
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Data

- `raw/chars/*.json` — one file per character (228): description, unlock mission, skills (cost, cooldown, classes).
  Collected from the login-gated character pages of naruto-arena.site.
- `raw/meta/` — the 12 most recent patches (balance cards with published win rate / match counts, and the news text).
- `npm run data` rebuilds `src/data/*.json` from `raw/` (`scripts/build-data.mjs`).

Chakra icons are 10x10 coloured squares on the source site and are mapped as: green = Taijutsu, red = Bloodline,
blue = Ninjutsu, white = Genjutsu, dark = Random. Checked against the site's own balance text.

## Ranking model

1. `analysis/SCHEMA.md` defines how each skill is turned into numbers (damage, damage per turn, control turns,
   protection, healing, chakra swing, stacking, requirements). Analyst agents annotate `analysis/input/chunk-N.json`
   into `analysis/output/`.
2. `npm run merge-analysis` validates those files and writes `src/data/analysis.json`.
3. `src/lib/sim.ts` plays every character for 8 turns (one skill per turn, cooldowns, chakra income, "needs" chains,
   stacking) and `src/lib/rank.ts` scales and weights the results. Skills without an annotation fall back to the
   regex reader in `src/lib/heuristic.ts`.

## Languages

English and Portuguese (BR). The toggle is in the top bar and the choice is remembered. UI strings live in
`src/lib/i18n.tsx`; skill text, bios and patch notes come from the game and stay in English.

## Caveats

- Win rates are the figures printed next to each balance change, so they describe a character at the time of that
  patch, not today.
- The Team Builder's "composition check" reads keywords in skill text. It is a hint, not a rules engine.
- Portraits and skill icons are hot-linked from the source site's image host.
- The site is not affiliated with Naruto-Arena. Ask its staff before publishing this publicly, since part of the data
  came from pages that require a login.
