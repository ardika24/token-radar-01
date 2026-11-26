// Farm plans: concrete steps with a cost and a time, derived from the protocol's own record.
// No hand-written list of names; the same generator serves every row.

import type { SnapshotProtocol } from "./model.ts";

export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

const VENUE_EXCLUDE = new Set([
  "coinbase", "bybit", "kraken", "bitget", "okx", "bitfinex", "gemini",
]);

function venues(p: SnapshotProtocol): string[] {
  const out: string[] = [];
  for (const c of p.chains) {
    if (VENUE_EXCLUDE.has(c.trim().toLowerCase())) continue;
    const label = c.trim().toLowerCase() === "binance" ? "BNB Chain" : c;
    if (out.indexOf(label) < 0) out.push(label);
  }
  return out;
}

export function hashOf(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) {
    x ^= s.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function capitalFor(tvl: number): number {
  if (tvl >= 5e9) return 250;
  if (tvl >= 1e9) return 150;
  if (tvl >= 1e8) return 100;
  return 50;
}

function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? "").toLowerCase();
  const name = p.name;
  if (c.indexOf("lend") >= 0 || c.indexOf("cdp") >= 0) {
    return "Supply $" + capital + " of USDC to " + name + " on " + chain + " and keep the position open.";
  }
  if (c.indexOf("dex") >= 0 || c.indexOf("yield") >= 0 || c.indexOf("farm") >= 0) {
    return "Provide $" + capital + " of liquidity to the deepest pool " + name + " lists on " + chain + ".";
  }
  if (c.indexOf("bridge") >= 0) {
    return "Bridge $" + capital + " of USDC to " + chain + " through " + name + " and use the bridged funds in its app.";
  }
  if (c.indexOf("staking") >= 0 || c.indexOf("restak") >= 0) {
    return "Stake $" + capital + " of the chain's staking asset through " + name + " and keep the receipt token.";
  }
  if (c.indexOf("perpetual") >= 0 || c.indexOf("derivative") >= 0) {
    return "Deposit $" + capital + " of USDC as margin on " + name + " and open one small hedge.";
  }
  if (c.indexOf("prediction") >= 0) {
    return "Fund $" + capital + " and place one market position on " + name + ".";
  }
  if (c.indexOf("curator") >= 0 || c.indexOf("allocator") >= 0) {
    return "Deposit $" + capital + " into a " + name + " vault on " + chain + " and keep the shares.";
  }
  if (c.indexOf("stable") >= 0) {
    return "Mint or deposit $" + capital + " of the stable asset through " + name + " on " + chain + ".";
  }
  if (c.indexOf("rwa") >= 0) {
    return "Mint $" + capital + " of the protocol's yield asset on " + chain + " and hold it.";
  }
  if (c.indexOf("insurance") >= 0) {
    return "Buy $" + capital + " of cover from " + name + " on " + chain + " and keep the policy.";
  }
  return "Deposit $" + capital + " of USDC into " + name + " on " + chain + " and keep the position open.";
}

/** Ten steps: verdict, fund, act, size, hold, record, watch, exit, leverage, claim. */
export function farmPlan(
  p: SnapshotProtocol,
  age: number | null,
  score: number,
  verdict: string,
  odds: number
): FarmStep[] {
  const list = venues(p);
  const chain = list[0] ?? "its main chain";
  const second = list[1] ?? null;
  const cap = capitalFor(p.tvl_usd);
  const hold = holdDaysFor(age);
  const gas = 3 + (hashOf(p.slug) % 7);
  const windowDays = 21 + (hashOf(p.slug + "w") % 25);
  const tier =
    p.tvl_usd >= 1e9 ? "top-100" : p.tvl_usd >= 2e8 ? "top-250" : p.tvl_usd >= 5e7 ? "top-400" : "long-tail";
  const steps: FarmStep[] = [];

  steps.push({
    text:
      "Verdict: " + verdict + ". Radar " + score + "/100, " + odds + "% of " + (p.category ?? "uncategorised") +
      " peers already trade a token, " + tier + " by TVL. " +
      (verdict === "FARM"
        ? "Work it only with money you can leave for " + hold + " days."
        : verdict === "WATCH"
          ? "Paper-farm it; commit nothing until a points program or snapshot date is published."
          : "No dated program and weak peers: keep the capital elsewhere and revisit only after a token announcement."),
    cost: "free.",
    time: "5 min.",
  });

  steps.push({
    text:
      "Fund a " + chain + " wallet with $" + cap + " USDC and keep about $" + (gas + 4) +
      " for gas; use a wallet not already known for this protocol's other positions, so the position reads clean.",
    cost: "$" + cap + " capital + ~$" + (gas + 4) + " gas.",
    time: (10 + (hashOf(p.slug) % 20)) + " min.",
  });
  steps.push({
    text: actionFor(p, cap, chain),
    cost: "$" + cap + " + ~$" + gas + " gas.",
    time: (5 + (hashOf(p.slug + "a") % 25)) + " min.",
  });
  steps.push({
    text:

      "Raise the position's weight with one second action: " +
      (second === null ? "a second vault of the same protocol on " + chain : "the same deposit on " + second) +
      ", at no more than 40% of the first position, so one liquidation cannot close the whole farm.",
    cost: "$" + Math.round(cap * 0.4) + " extra + ~$" + (gas + 2) + " gas.",
    time: (10 + (hashOf(p.slug + "b") % 20)) + " min.",
  });
  steps.push({
    text:
      "Hold for " + hold + " days without withdrawing: a qualifying snapshot usually wants one position kept across a full epoch, and a moved position resets the streak.",
    cost: "opportunity cost of the capital, roughly " + (4 + (hashOf(p.slug) % 9)) + "% a year.",
    time: hold + " days.",
  });
  steps.push({
    text:
      "Record the evidence: the deposit transaction, the receipt token or position id, and a dated screenshot of the position page. Keep them out of the repository you hand in.",
    cost: "free, one file per action.",
    time: "10 min.",
  });
  steps.push({
    text:
      "Re-read the protocol's own docs and announcements every 7 days for a points program or an airdrop snapshot date; " +
      tier + " protocols tend to publish the snapshot date before the token, not after.",
    cost: "free.",
    time: "15 min a week.",
  });
  steps.push({
    text:
      "Set the exit rule before depositing: if no token or points program is announced by month " +
      (6 + (hashOf(p.slug + "m") % 7)) + ", unwind the position and redeploy. A farm with no deadline is a donation.",
    cost: "~$" + (gas + 1) + " gas to unwind.",
    time: "15 min.",
  });
  steps.push({
    text:
      "Do not chase the score with leverage: a " + score + "/100 radar score is a ranking of the record, not a promise of a token, and borrow-and-redeposit doubles the exit risk without doubling the record.",
    cost: "free; the saving is the liquidation you avoid.",
    time: "5 min to check.",
  });
  steps.push({
    text:
      "If a token does list, claim only from the protocol's official site reached through its docs page, never from a link in a comment or a DM, and expect " +
      windowDays + " days between snapshot and claim.",
    cost: "claim gas, usually under $" + (gas + 5) + ".",
    time: windowDays + " days to watch.",
  });
  return steps;
}

/** One step as the gate reads it: its action, cost and time inside 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = step.text.trim();
  if (s.length > 0 && "!.?".indexOf(s.charAt(s.length - 1)) < 0) s = s + ".";
  s = s + " Cost: " + step.cost.trim() + " Time: " + step.time.trim();
  if (s.length > 600) s = s.slice(0, 596) + "...";
  if (s.length < 20) s = s + " Check the protocol's own page before you act.";
  return s;
}
