import { ageDays, catKey, clamp, logScale } from "./model.ts";
import type { Model, SnapshotProtocol } from "./model.ts";
import { farmPlan, stepText } from "./plans.ts";

export interface RiskFlag {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface Signals {
  relative_z: number;
  inflow_pct: number;
  scale: number;
  tenure: number;
  breadth: number;
  liquidity: number;
  drawdown: number;
  anomaly: number;
  provenance: number;
  category_risk: number;
  peer_growth_med: number | null;
  peer_growth_mad: number | null;
}

export interface Scored {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: "pre-token";
  age_days: number | null;
  implied_value_usd: number;
  odds: number;
  edge: number;
  ci_low: number;
  ci_high: number;
  verdict: "FARM" | "WATCH" | "SKIP";
  verdict_why: string;
  score: { alpha: number; safety: number; total: number };
  signals: Signals;
  risk_flags: RiskFlag[];
  farm_steps: string[];
  model: {
    launch_multiple: number;
    peer_multiple: number;
    peer_n: number;
    growth_adj: number;
    tenure_adj: number;
    growth_pct: number;
  };
  counts: { pass: number; warn: number; fail: number };
}

export const ALPHA_W = { relative: 0.35, absolute: 0.25, scale: 0.15, tenure: 0.15, breadth: 0.1 };
export const SAFE_W = { floor: 0.3, drawdown: 0.25, anomaly: 0.2, provenance: 0.15, category: 0.1 };
export const BLEND = { alpha: 0.55, safety: 0.45 };
export const GROWTH_W = 0.35;

const CAT_RISK: Record<string, number> = {
  cex: 20,
  "canonical bridge": 55,
  bridge: 58,
  "liquid restaking": 55,
  "liquid staking": 52,
  "restaked btc": 50,
  "leveraged farming": 45,
  "yield aggregator": 68,
  "basis trading": 70,
  dexs: 80,
  dex: 80,
  lending: 82,
  cdp: 78,
  rwa: 76,
  "prediction market": 72,
  perpetuals: 74,
  derivatives: 72,
  stablecoin: 84,
  insurance: 80,
  curator: 70,
  allocator: 70,
  farm: 72,
  staking: 60,
};

function tenScore(age: number | null): number {
  if (age === null) return 45;
  if (age < 90) return clamp((age / 90) * 45, 10, 45);
  if (age < 270) return 45 + ((age - 90) / 180) * 35;
  if (age < 900) return 80 + ((age - 270) / 630) * 20;
  return clamp(100 - ((age - 900) / 900) * 45, 55, 100);
}

function breadthScore(n: number): number {
  if (n <= 1) return 45;
  if (n === 2) return 65;
  if (n === 3) return 80;
  if (n === 4) return 90;
  return 100;
}

function floorScore(tvl: number): number {
  if (tvl >= 2e9) return 100;
  if (tvl >= 5e8) return 92;
  if (tvl >= 2e8) return 85;
  if (tvl >= 1e8) return 78;
  if (tvl >= 5e7) return 70;
  if (tvl >= 2e7) return 55;
  if (tvl >= 1e7) return 42;
  return 28;
}

function ddScore(c: number | null): number {
  if (c === null) return 60;
  if (c >= 10) return 100;
  if (c >= 0) return 92;
  if (c >= -10) return 80;
  if (c >= -20) return 65;
  if (c >= -30) return 48;
  if (c >= -45) return 28;
  return 10;
}

function anomalyScore(c: number | null, med: number | null, m: number | null): number {
  if (c === null || med === null) return 70;
  const sigma = Math.max(5, 1.4826 * (m ?? 0));
  const dev = Math.abs(c - med);
  if (c > 250) return 35;
  if (dev > 6 * sigma) return 20;
  if (dev > 4 * sigma) return 45;
  if (dev > 2.5 * sigma) return 75;
  return 100;
}

function provScore(age: number | null): number {
  if (age === null) return 45;
  if (age < 90) return 52;
  if (age < 365) return 72;
  if (age < 1095) return 88;
  return 100;
}

function fl(id: string, label: string, status: "pass" | "warn" | "fail", detail: string): RiskFlag {
  return { id, label, status, detail };
}

export function scoreProtocol(p: SnapshotProtocol, asOf: string, model: Model, floor: number): Scored {
  const stat = model.by_category.get(catKey(p.category));
  const peerMed = stat?.growth_med ?? model.global_growth_med;
  const peerMad = stat?.growth_mad ?? model.global_growth_mad;
  const change = p.change_7d;
  const age = ageDays(asOf, p.listed_at);

  const sigma = Math.max(2, 1.4826 * (peerMad ?? 0));
  const z = change === null || peerMed === null ? 0 : clamp((change - peerMed) / sigma, -3, 3);
  const relative = ((z + 3) / 6) * 100;
  const absolute = change === null ? 50 : clamp(50 + change * 1.8, 0, 100);
  const scale = logScale(p.tvl_usd, 5e6, 5e9);
  const tenure = tenScore(age);
  const breadth = breadthScore(p.chains.length);

  const alpha = Math.round(
    ALPHA_W.relative * relative +
      ALPHA_W.absolute * absolute +
      ALPHA_W.scale * scale +
      ALPHA_W.tenure * tenure +
      ALPHA_W.breadth * breadth
  );

  const liquidity = floorScore(p.tvl_usd);
  const drawdown = ddScore(change);
  const anomaly = anomalyScore(change, peerMed, peerMad);
  const provenance = provScore(age);
  const category = CAT_RISK[catKey(p.category)] ?? 65;

  const safety = Math.round(
    SAFE_W.floor * liquidity +
      SAFE_W.drawdown * drawdown +
      SAFE_W.anomaly * anomaly +
      SAFE_W.provenance * provenance +
      SAFE_W.category * category
  );

  const total = clamp(Math.round(BLEND.alpha * alpha + BLEND.safety * safety), 1, 100);

  const odds = Math.round(clamp((stat?.token_rate ?? model.global_token_rate) * 100, 1, 99));

  const flags: RiskFlag[] = [];
  if (p.tvl_usd >= floor) {
    flags.push(fl("liquidity", "Liquidity floor", "pass", "TVL is at or above the $" + floor / 1e6 + "M floor: an exit has a venue."));
  } else {
    flags.push(fl("liquidity", "Liquidity floor", "fail", "TVL is below the watchlist floor: thinner exit, less likely a real venue."));
  }
  if (change === null) {
    flags.push(fl("drawdown", "7-day drawdown", "warn", "No seven-day change reported: drawdown assumed, not measured."));
  } else if (change <= -30) {
    flags.push(fl("drawdown", "7-day drawdown", "fail", "TVL fell " + change.toFixed(1) + "% in seven days: capital leaving before the token."));
  } else if (change <= -15) {
    flags.push(fl("drawdown", "7-day drawdown", "warn", "TVL fell " + change.toFixed(1) + "% in seven days: watch the next epoch."));
  } else {
    flags.push(fl("drawdown", "7-day drawdown", "pass", "Seven-day change " + change.toFixed(1) + "%: no exit in progress."));
  }
  if (anomaly < 50) {
    flags.push(fl("anomaly", "Flow anomaly", "fail", "Seven-day change far outside its peer spread: a squeeze, not organic flow."));
  } else if (anomaly < 80) {
    flags.push(fl("anomaly", "Flow anomaly", "warn", "Seven-day change wide against peers: size the position down."));
  } else {
    flags.push(fl("anomaly", "Flow anomaly", "pass", "Seven-day change sits inside its peer spread."));
  }
  if (age === null) {
    flags.push(fl("provenance", "Listing provenance", "warn", "No listing date recorded: tenure assumed at 540 days."));
  } else if (age < 90) {
    flags.push(fl("provenance", "Listing provenance", "warn", "Listed " + age + " days ago: too new for a track record."));
  } else {
    flags.push(fl("provenance", "Listing provenance", "pass", "Listed " + age + " days ago: a record long enough to read."));
  }
  if (p.chains.length < 2) {
    flags.push(fl("chains", "Chain breadth", "warn", "One chain only: launch and farm depend on one venue."));
  } else {
    flags.push(fl("chains", "Chain breadth", "pass", "Tracked on " + p.chains.length + " chains."));
  }
  if ((stat?.n ?? 0) >= 6) {
    flags.push(fl("anchor", "Valuation anchor", "pass", (stat?.n ?? 0) + " live-token peers set this row's multiple."));
  } else {
    flags.push(fl("anchor", "Valuation anchor", "warn", "Thin peer set: the multiple leans on the field's median."));
  }
  flags.push(fl("token", "Token record", "pass", "DefiLlama records no token: a record, not proof."));
  if (odds >= 50) {
    flags.push(fl("odds", "Token odds", "pass", odds + "% of this category's tracked peers already trade a token."));
  } else if (odds >= 20) {
    flags.push(fl("odds", "Token odds", "warn", odds + "% of this category's peers trade a token: a launch is plausible, not established."));
  } else {
    flags.push(fl("odds", "Token odds", "fail", "Only " + odds + "% of this category's peers trade a token: the launch is speculative."));
  }

  const peerMultiple = stat === undefined ? model.global_multiple : stat.multiple;
  const multiple = clamp(peerMultiple, 0.03, 2.5);
  const growthPct = clamp(change ?? 0, -40, 80);
  const growthAdj = 1 + (growthPct / 100) * GROWTH_W;
  const tenureAdj = 0.92 + (0.08 * Math.min(age ?? 540, 720)) / 720;
  const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthAdj * tenureAdj));
  const edge = Math.round((implied / p.tvl_usd) * 1000) / 1000;
  const band = (stat?.total ?? 0) >= 12 ? 0.3 : 0.42;
  const ci_low = Math.max(1, Math.round(implied * (1 - band)));
  const ci_high = Math.round(implied * (1 + band));
  const verdict: "FARM" | "WATCH" | "SKIP" = total < 55 || edge < 0.25 ? "SKIP" : total < 68 || edge < 0.45 || odds < 20 ? "WATCH" : "FARM";
  const verdict_why = "radar " + total + ", " + edge.toFixed(2) + "x TVL, " + odds + "% peer token rate";
  const farm_steps = farmPlan(p, age, total, verdict, odds).map(stepText);

  let pass = 0;
  let warn = 0;
  let fail = 0;
  for (const f of flags) {
    if (f.status === "pass") pass++;
    else if (f.status === "warn") warn++;
    else fail++;
  }

  const signals: Signals = {
    relative_z: Math.round(z * 100) / 100,
    inflow_pct: change ?? 0,
    scale: Math.round(scale),
    tenure: Math.round(tenure),
    breadth: Math.round(breadth),
    liquidity,
    drawdown,
    anomaly,
    provenance,
    category_risk: category,
    peer_growth_med: peerMed,
    peer_growth_mad: peerMad,
  };

  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: "pre-token",
    age_days: age,
    implied_value_usd: implied,
    odds,
    edge,
    ci_low,
    ci_high,
    verdict,
    verdict_why,
    score: { alpha, safety, total },
    signals,
    risk_flags: flags,
    farm_steps,
    model: {
      launch_multiple: Math.round(multiple * 1000) / 1000,
      peer_multiple: Math.round(peerMultiple * 1000) / 1000,
      peer_n: stat?.n ?? 0,
      growth_adj: Math.round(growthAdj * 1000) / 1000,
      tenure_adj: Math.round(tenureAdj * 1000) / 1000,
      growth_pct: growthPct,
    },
    counts: { pass, warn, fail },
  };
}
