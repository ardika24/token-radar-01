# ardika24/token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ardika24/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ardika24/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A pre-token protocol radar built from one sealed DeFiLlama snapshot: 220 protocols ranked by what a token launch would be worth, not by who announced a points program loudest. The board renders from local files, with no network call at read time, so the same numbers appear in the screenshot, the dossier and the browser.

## Run it

```sh
node main.ts --input input --output out
python3 -m http.server 8080 --directory out
# open http://127.0.0.1:8080/dashboard/
```

Node 22.18 or newer, no dependencies to install.

## What the board reads

- **Implied value** = TVL x peer multiple x 7d growth adj x tenure adj. The peer multiple is the median mcap/TVL of the snapshot's live-token protocols in the same category, shrunk to the field median with a prior of 6 peers and clamped 0.03..2.5. Missing growth reads as 0; a missing listing date reads as 540 days.
- **Alpha** = 0.35 relative inflow + 0.25 absolute inflow + 0.15 scale + 0.15 tenure + 0.10 chain breadth. Momentum is the bid for the protocol before a token exists.
- **Safety** = 0.30 liquidity floor + 0.25 seven-day drawdown + 0.20 flow anomaly + 0.15 listing provenance + 0.10 category risk. Every signal is a deterministic function of fields in the snapshot, with fixed breakpoints; no model is called and no score is hand-set.
- **Radar score** = 0.55 alpha + 0.45 safety, 1..100. It is a ranking aid, never the value claim.
- **Token odds** = the share of the category's tracked protocols that already trade a token, shrunk to the field rate with a prior of 8 peers. It is a base rate, not a prediction.
- **Valuation band** = +/-30% around the implied value for categories with 12+ tracked protocols, +/-42% for thin categories.
- **Verdict** = FARM when radar >= 68, implied >= 0.45x TVL and at least 20% of category peers trade a token; WATCH at radar >= 55 and 0.25x TVL; otherwise SKIP. The verdict is a rule, so it can be checked against the numbers in the drawer.

## What it does

- Tabs: Board (220 ranked), Fresh (young pairs), Momentum (strong inflow), Safer (liquidity floor), Watchlist (yours), Live tokens (40 already-trading anchors kept apart).
- Filters: chain, sector, minimum TVL, maximum age; live search over name, slug, category and chain.
- Sorting on every numeric column, including α, safety, score, odds and implied/TVL.
- Detail drawer: score breakdown with weights, buy/sell and flow signals, token odds, valuation band, verdict and why, a 10-step costed farm plan, explorer/chart links, copy id, watchlist star and alert threshold.
- Status line says CACHED SNAPSHOT or LIVE SNAPSHOT; the page never fetches by itself.
- Responsive from 1440px to 390px; no horizontal page scroll.

## Files

- `main.ts` — reads the snapshot, builds the board, writes `board.json`, `data.js`, copies `dashboard/` and `screenshots/`, then writes `dossier.json`.
- `lib/model.ts` — parses the snapshot and fits the peer multiples and token base rates.
- `lib/score.ts` — alpha, safety, verdict and farm-plan calls.
- `lib/plans.ts` — the costed steps.
- `lib/board.ts` — row assembly, the 100..4000-row gate, integrity strip.
- `dashboard/` — the static terminal.
- `screenshots/` — 1440x900 board, 1440x900 detail, 820x900 filtered.

The numbers are a model's claim about a launch, not make.fun's and not a promise that a token will exist. Four of 758 protocols carry no 7d change and 113 carry no listing date; those are read at the stated defaults and counted in the integrity strip, not hidden.

---

<sub>Entered on [make.fun](https://make.fun/?ref=ardika24&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
