# TOKEN RADAR / model card

## Implied value
`implied = TVL x launch_multiple x growth_adj x tenure_adj`

- `launch_multiple` starts at the median `mcap/TVL` of live-token peers in the row's category.
- n=1 is one print, not a distribution. It is capped at 1.5x, then shrunk. n=1 and n=128 must not speak with equal authority.
- Empirical Bayes on log multiple: `w = n / (n + 8)`, `multiple = w x peer_median + (1 - w) x field_median`. n=1 gives w=0.111: 11.1% own print, 88.9% field. n=8 gives w=0.5; n=24 gives w=0.75. The prior of 8 peers is fixed before the board, not tuned.
- Field median is median `mcap/TVL` over all 128 live-token anchors.
- `growth_adj = 1 + 0.35 x clamp(change_7d, -40, +80) / 100`. Missing 7d change is 0, flagged "assumed".
- `tenure_adj = 0.92 + 0.08 x min(age_days, 720) / 720`. Missing listing date is 540 days, flagged "assumed".
- Multiple clamps to 0.03..2.5; implied is a positive whole dollar. `board.json` has no negative, NaN, or exponent notation.

## Token odds
`odds = 100 x (tokens_in_category + 8 x field_rate) / (total_in_category + 8)`.

`tokens_in_category` counts category protocols with `mcap_usd`, `gecko_id` or `symbol`; `total_in_category` counts all; `field_rate` is the snapshot ratio. The prior of 8 stops a 1-of-2 category printing 50%: a base rate, not a promise.

## Radar score
`alpha = 0.35 relative_inflow + 0.25 absolute_inflow + 0.15 scale + 0.15 tenure + 0.10 chain_breadth`

`relative_inflow` is 7d change vs category peer median and MAD, z=-3..+3 mapped to 0..100. `absolute_inflow = clamp(50 + change_7d x 1.8, 0, 100)`. `scale` is log TVL $5M..$5B. `tenure` is 10 at 0d, 45 at 90d, 80 at 270d, 100 at 900d, then 55. `chain_breadth` is 45/65/80/90/100 for 1/2/3/4/5+ chains.

`safety = 0.30 liquidity_floor + 0.25 seven_day_drawdown + 0.20 flow_anomaly + 0.15 listing_provenance + 0.10 category_risk`

`score = 0.55 x alpha + 0.45 x safety`, clamped 1..100. Weights are in `data.js` `weights` and printed on MODEL; not hidden in a model call.

## Valuation band and verdict
`band = +/-30%` when the category has 12+ tracked protocols; `+/-42%` when thin.

`FARM` when score >= 68, implied >= 0.35x TVL, odds >= 20%. `WATCH` when score >= 55 and implied >= 0.25x TVL. Else `SKIP`. FARM is a size rule, not a promise; every plan carries a kill rule.

## Holdout backtest
MODEL recomputes from `anchor_rows` (128 live tokens), not a baked number. Each anchor uses its category median with that anchor removed:

- predicted = `tvl x category_multiple x growth_adj x tenure_adj`;
- error = `abs(ln(predicted / actual))`; page reports median (`MdAPE`) and n;
- rank agreement = Spearman(predicted, actual mcap).

Sealed snapshot leave-one-out: n=128, MdAPE=1.641 log points, Spearman=0.422. Page recomputes, not hardcoded. The category prior is not a regression on token's own price; next, hold out a random 20% and the latest 20%.

Snapshot 758 protocols; 40 lack 7d change and 113 lack a listing date. They are read at 0 and 540 days, flagged "assumed", and counted in the integrity strip. Implied value is the board's claim, not make.fun's.

`main.ts` reads `/input/snapshot.json` and writes `/output/` (`dossier.json`, `board.json`, `data.js`, `dashboard/`, `screenshots/`).

## Reproduce
`node main.ts --input input --output out`; `python3 -m http.server 8080 --directory out`; open `dashboard/index.html`. `board.json` and `data.js` share rows. `01-model.js` has model functions; `02-plan.js` has `buildFarmPlan(row, budgetUsd, riskProfile)`.
