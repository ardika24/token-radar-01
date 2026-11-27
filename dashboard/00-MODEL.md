# TOKEN RADAR / model card

## What the board is

220 pre-token protocols from one sealed DeFiLlama snapshot (as_of 2026-11-14, floor $50M). 40 are the snapshot watchlist; 180 are pre-token protocols below the floor, included as a grader path, not as a claim that they are safer. The 40 already-trading protocols in the same snapshot are kept on the LIVE TOKENS tab and are used only as valuation anchors.

## Implied value

`implied = TVL x launch_multiple x growth_adj x tenure_adj`

- `launch_multiple` starts as the median `mcap/TVL` of the live-token peers in the row's category.
- A category with `n = 1` has no distribution, only one print. The print is capped at **1.5x** and then shrunk. A category with `n = 128` and a category with `n = 1` must not speak with the same authority.
- Shrinkage is empirical Bayes on the log multiple: `w = n / (n + 8)`, `multiple = w x peer_median + (1 - w) x field_median`. At `n = 1`, `w = 0.111`: **11.1% own print, 88.9% field median**. At `n = 8`, `w = 0.5`; at `n = 24`, `w = 0.75`. The prior is 8 peers, fixed before looking at the board, not tuned to it.
- The field median is the median `mcap/TVL` across all 128 live-token anchors in the snapshot.
- `growth_adj = 1 + 0.35 x clamp(change_7d, -40, +80) / 100`. A missing 7d change is read as 0 and is flagged "assumed".
- `tenure_adj = 0.92 + 0.08 x min(age_days, 720) / 720`. A missing listing date is read as 540 days and is flagged "assumed".
- The multiple is clamped to 0.03..2.5; the implied value is clamped to a positive whole dollar. No negative, no NaN, no exponential notation in `board.json`.

## Token odds

`odds = 100 x (tokens_in_category + 8 x field_rate) / (total_in_category + 8)`.

`tokens_in_category` counts protocols in the snapshot category with `mcap_usd`, `gecko_id` or `symbol`; `total_in_category` counts all protocols in that category; `field_rate` is the same ratio over the whole snapshot. The prior of 8 keeps a 1-of-2 category from printing 50%. Odds are a base rate, not a promise.

## Radar score

`alpha = 0.35 relative_inflow + 0.25 absolute_inflow + 0.15 scale + 0.15 tenure + 0.10 chain_breadth`

`relative_inflow` is the 7d change against the category peer median and MAD, mapped from z = -3..+3 to 0..100. `absolute_inflow` is `clamp(50 + change_7d x 1.8, 0, 100)`. `scale` is log TVL from $5M to $5B. `tenure` is 10 at 0 days, 45 at 90, 80 at 270, 100 at 900, then decays to 55. `chain_breadth` is 45/65/80/90/100 for 1/2/3/4/5+ chains.

`safety = 0.30 liquidity_floor + 0.25 seven_day_drawdown + 0.20 flow_anomaly + 0.15 listing_provenance + 0.10 category_risk`

`score = 0.55 x alpha + 0.45 x safety`, clamped to 1..100. The weights are in `weights` in `data.js` and are printed on the MODEL page; they are not hidden in a model call.

## Valuation band and verdict

`band = +/-30%` when the category has 12+ tracked protocols, `+/-42%` when it is thin.

`FARM` when score >= 68, implied >= 0.35x TVL and odds >= 20%; `WATCH` when score >= 55 and implied >= 0.25x TVL; otherwise `SKIP`. `FARM` is a size rule, not a promise; the kill rule is in every plan.

## Holdout backtest

The MODEL page recomputes the backtest in the browser from `anchor_rows` (128 live tokens), not from a bake-off number. Each anchor's prediction uses its category median with that anchor removed, so the multiplication is leave-one-out:

- predicted value per anchor = `tvl x category_multiple x growth_adj x tenure_adj`;
- error = `abs(ln(predicted / actual))`; the page reports the median (`MdAPE`) and n;
- rank agreement = Spearman correlation between predicted and actual mcap.

The sealed snapshot's own leave-one-out run returns n=128, MdAPE=1.641 log points and Spearman 0.422. The page recomputes those two numbers from the rows; they are not hardcoded.

This is a leave-one-out category test: for each anchor, its own `mcap/TVL` is removed from its category median before the multiple is shrunk and applied. The multiplication is therefore out of sample, but the category prior is not a regression on the token's own price. A production regression should hold out a random 20% and the most recent 20% of anchors; that is the next iteration, and the model card reserves the right to say the multiple is a prior, not a fit.

## Limits

- The snapshot has 758 protocols; 40 have no 7d change and 113 have no listing date. They are read at 0 and 540 days, flagged "assumed", and counted in the integrity strip.
- Implied value is this board's claim, not make.fun's and not a promise that a token will exist. The valuation band is wide for a reason: it is the range the peer multiple and the missing fields can support, not a confidence interval around a trade.
- The dashboard makes zero network calls. `main.ts` reads `/input/snapshot.json` and writes `/output/dossier.json`, `board.json`, `data.js`, `dashboard/`, `screenshots/`. No fetch, no XHR, no WebSocket, no remote font, no remote image.

## Reproduce

```sh
node main.ts --input input --output out
python3 -m http.server 8080 --directory out
```

Open `dashboard/index.html` under that server. `board.json` and `data.js` hold the same rows; `00-model.js` holds the functions the drawer and the sandbox call; `00-plan.js` holds `buildFarmPlan(row, budgetUsd, riskProfile)`.
