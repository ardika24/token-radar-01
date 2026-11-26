import { buildModel, isRankable } from "./model.ts";
import type { Snapshot, SnapshotProtocol, Model } from "./model.ts";
import { ALPHA_W, BLEND, GROWTH_W, SAFE_W, scoreProtocol } from "./score.ts";
import type { Scored } from "./score.ts";

export const MODEL_VERSION = "radar-3";
export const EARLY_ROWS = 180;
export const LIVE_ROWS = 40;
export const MAX_IMPLIED = 100000000000000;

export interface BoardRow {
  rank: number;
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
  token_status: string;
  watchlisted: boolean;
  age_days: number | null;
  implied_value_usd: number;
  odds: number;
  edge: number;
  ci_low: number;
  ci_high: number;
  verdict: string;
  verdict_why: string;
  score: { alpha: number; safety: number; total: number };
  signals: Record<string, number | null>;
  risk_flags: Array<{ id: string; label: string; status: string; detail: string }>;
  farm_steps: string[];
  model: Record<string, number>;
  counts: { pass: number; warn: number; fail: number };
}

export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  ratio: number | null;
  symbol: string | null;
  market: MarketToken | null;
}

export interface MarketToken {
  symbol?: string;
  chain?: string;
  pair?: string;
  price_usd?: number | null;
  liquidity_usd?: number;
  fdv_usd?: number | null;
  vol_5m?: number;
  vol_1h?: number;
  vol_6h?: number;
  vol_24h?: number;
  buys_24h?: number;
  sells_24h?: number;
  change_5m?: number;
  change_1h?: number;
  change_24h?: number;
  fetched_at?: string;
  stale?: boolean;
}

export interface Market {
  as_of?: string;
  source?: string;
  tokens?: Record<string, MarketToken>;
}

export interface Radar {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  mode: "cached" | "live";
  market_as_of: string | null;
  weights: unknown;
  method: string[];
  anchors: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  category_baseline: Array<{ category: string; n: number; multiple: number; growth_med: number | null }>;
  integrity: {
    protocols: number;
    watchlist: number;
    ranked: number;
    anchors: number;
    missing_change: number;
    missing_listed: number;
    thin_categories: number;
    live_tracked: number;
    farmable: number;
  };
  rows: BoardRow[];
  live: LiveRow[];
}

const METHOD: string[] = [
  "implied_value_usd = tvl_usd * launch_multiple * growth_adj * tenure_adj",
  "launch_multiple = median mcap/TVL of the snapshot's live-token peers in the same category, shrunk to the field median with a prior of 6 peers, clamped 0.03..2.5",
  "growth_adj = 1 + 0.35 * clamp(change_7d, -40, 80) / 100, a missing change read as 0",
  "tenure_adj = 0.92 + 0.08 * min(days since DefiLlama listing, 720) / 720, a missing date read as 540",
  "token_odds = share of the category's tracked protocols that already carry a token, shrunk to the field rate with a prior of 8 peers",
  "valuation_band = +/-30% for categories with 12+ tracked protocols, +/-42% for thin categories",
  "verdict = FARM when radar >= 68 and implied >= 0.45x TVL; WATCH at radar >= 55 and 0.25x TVL; otherwise SKIP",
  "alpha = 0.35 relative inflow + 0.25 absolute inflow + 0.15 scale + 0.15 tenure + 0.10 chain breadth",
  "safety = 0.30 liquidity floor + 0.25 seven-day drawdown + 0.20 flow anomaly + 0.15 listing provenance + 0.10 category risk",
  "score = 0.55 * alpha + 0.45 * safety, in 1..100: a ranking aid, never the value claim",
];

export function buildRadar(snapshot: Snapshot, market?: Market | null): { rows: BoardRow[]; radar: Radar; early: number; live: number } {
  const model: Model = buildModel(snapshot.protocols);
  const index = new Map<string, SnapshotProtocol>();
  for (const p of snapshot.protocols) index.set(p.slug, p);

  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }

  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored: Scored[] = [];
  for (const p of chosen.values()) scored.push(scoreProtocol(p, snapshot.as_of, model, snapshot.floor_usd));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));

  const rows: BoardRow[] = [];
  for (let i = 0; i < scored.length; i++) rows.push({ rank: i + 1, watchlisted: false, ...scored[i]! });
  const wl = new Set<string>(snapshot.watchlist);
  for (const r of rows) r.watchlisted = wl.has(r.slug);

  const liveSrc = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS);

  const live: LiveRow[] = [];
  for (const p of liveSrc) {
    live.push({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      ratio: p.mcap_usd !== null && p.tvl_usd > 0 ? Math.round((p.mcap_usd / p.tvl_usd) * 1000) / 1000 : null,
      symbol: p.symbol,
      market: market?.tokens?.[p.slug] ?? null,
    });
  }

  const cats: Array<{ category: string; n: number; multiple: number; growth_med: number | null }> = [];
  for (const entry of model.by_category) {
    if (entry[1].n >= 3) {
      cats.push({ category: entry[0], n: entry[1].n, multiple: Math.round(entry[1].multiple * 1000) / 1000, growth_med: entry[1].growth_med });
    }
  }

  const radar: Radar = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    mode: market ? "live" : "cached",
    market_as_of: market?.as_of ?? null,
    weights: { alpha: ALPHA_W, safety: SAFE_W, blend: BLEND, growth: GROWTH_W },
    method: METHOD,
    anchors: model.anchors,
    watchlist_size: snapshot.watchlist.length,
    board_size: rows.length,
    early_size: rows.length - snapshot.watchlist.length,
    live_size: live.length,
    category_baseline: cats,
    integrity: {
      protocols: snapshot.protocols.length,
      watchlist: snapshot.watchlist.length,
      ranked: rows.length,
      anchors: model.anchors,
      missing_change: snapshot.protocols.filter((p) => p.change_7d === null).length,
      missing_listed: snapshot.protocols.filter((p) => p.listed_at === null).length,
      thin_categories: [...model.by_category.values()].filter((c) => c.n > 0 && c.n < 6).length,
      live_tracked: snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0).length,
      farmable: rows.filter((r) => r.verdict === "FARM").length,
    },
    rows,
    live,
  };

  return { rows, radar, early: radar.early_size, live: live.length };
}

export function boardIssue(rows: BoardRow[], snapshot: Snapshot): string | null {
  if (rows.length < 100 || rows.length > 4000) return "board holds " + rows.length + " rows, not 100..4000";
  const slugs = new Set<string>();
  for (const p of snapshot.protocols) slugs.add(p.slug);
  const seen = new Set<string>();
  let expected = 1;
  let prev = Number.POSITIVE_INFINITY;
  for (const r of rows) {
    if (!slugs.has(r.slug)) return "row names an invented slug: " + r.slug;
    if (seen.has(r.slug)) return "slug twice: " + r.slug;
    seen.add(r.slug);
    if ((r.rank | 0) !== r.rank || r.rank !== expected) return "rank " + r.rank + " where " + expected + " was due";
    expected++;
    if (!Number.isInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return "no positive whole implied value: " + r.slug;
    if (r.implied_value_usd > MAX_IMPLIED) return "implied value over the cap: " + r.slug;
    if (r.implied_value_usd > prev) return "implied value rises as rank ascends: " + r.slug;
    prev = r.implied_value_usd;
    if (typeof r.name !== "string" || r.name.trim() === "") return "no name: " + r.slug;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return "farm steps outside 3..12: " + r.slug;
    for (const step of r.farm_steps) {
      if (step.trim().length < 20 || step.trim().length > 600) return "farm step outside 20..600 characters: " + r.slug;
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return "watchlist slug missing: " + slug;
  }
  return null;
}

export function dataScript(radar: Radar): string {
  const json = JSON.stringify(radar)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return "window.RADAR = " + json + ";\n";
}
