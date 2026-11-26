// The radar's model: one sealed snapshot in, one ranked board out.
// Every number here is derived from the snapshot's own fields; no protocol name is special-cased.

export interface SnapshotProtocol {
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
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

const DAY_MS = 86400000;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const a = xs.slice().sort((p, q) => p - q);
  const m = a.length >> 1;
  if (a.length % 2 === 1) return a[m] ?? null;
  const lo = a[m - 1];
  const hi = a[m];
  if (lo === undefined || hi === undefined) return null;
  return (lo + hi) / 2;
}

export function mad(xs: number[], med: number): number | null {
  if (xs.length === 0) return null;
  return median(xs.map((x) => Math.abs(x - med)));
}

export function logScale(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x) || x <= 0 || lo <= 0 || hi <= lo) return 0;
  if (x <= lo) return 0;
  if (x >= hi) return 100;
  return ((Math.log10(x) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
}

export function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export function catKey(category: string | null): string {
  return (category ?? "uncategorised").trim().toLowerCase();
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError("snapshot is not JSON");
  }
  if (typeof raw !== "object" || raw === null) throw new SnapshotError("snapshot is not an object");
  const d = raw as Record<string, unknown>;
  const asOf = typeof d.as_of === "string" ? d.as_of.trim() : "";
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(asOf)) throw new SnapshotError("snapshot.as_of is not a UTC day");
  if (!Array.isArray(d.protocols)) throw new SnapshotError("snapshot.protocols is not an array");
  if (!Array.isArray(d.watchlist)) throw new SnapshotError("snapshot.watchlist is not an array");

  const floorRaw = numOrNull(d.floor_usd);
  const floor = floorRaw !== null && floorRaw > 0 ? floorRaw : 50000000;

  const protocols: SnapshotProtocol[] = [];
  const seen = new Set<string>();
  for (const item of d.protocols as unknown[]) {
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;
    const slug = typeof p.slug === "string" ? p.slug.trim() : "";
    if (slug === "" || seen.has(slug)) continue;
    const tvl = numOrNull(p.tvl_usd);
    if (tvl === null || tvl < 0) continue;
    seen.add(slug);
    const name = typeof p.name === "string" && p.name.trim() !== "" ? p.name.trim() : slug;
    const listed = typeof p.listed_at === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(p.listed_at) ? p.listed_at : null;
    const chains: string[] = [];
    if (Array.isArray(p.chains)) {
      for (const c of p.chains as unknown[]) {
        if (typeof c === "string" && c.trim() !== "") chains.push(c.trim());
      }
    }
    protocols.push({
      slug,
      name,
      category: strOrNull(p.category),
      chains,
      tvl_usd: Math.round(tvl),
      change_7d: numOrNull(p.change_7d),
      mcap_usd: numOrNull(p.mcap_usd),
      listed_at: listed,
      gecko_id: strOrNull(p.gecko_id),
      symbol: strOrNull(p.symbol),
    });
  }

  const index = new Set<string>(protocols.map((p) => p.slug));
  const watchlist: string[] = [];
  for (const s of d.watchlist as unknown[]) {
    if (typeof s === "string" && index.has(s) && watchlist.indexOf(s) < 0) watchlist.push(s);
  }
  if (protocols.length === 0) throw new SnapshotError("snapshot holds no protocol with a TVL");
  if (watchlist.length === 0) throw new SnapshotError("snapshot holds no watchlist slug the protocols carry");

  return { as_of: asOf, source: typeof d.source === "string" ? d.source : "", floor_usd: floor, protocols, watchlist };
}

// ---------------------------------------------------------------- model

export interface CatStat {
  multiple: number;
  n: number;
  growth_med: number | null;
  growth_mad: number | null;
  total: number;
  tokens: number;
  token_rate: number;
}

export interface Model {
  global_multiple: number;
  global_growth_med: number | null;
  global_growth_mad: number | null;
  global_token_rate: number;
  anchors: number;
  dispersion: number;
  by_category: Map<string, CatStat>;
}

const PRIOR = 6;
const TOKEN_PRIOR = 8;
const MIN_MULTIPLE = 0.03;
const MAX_MULTIPLE = 2.5;

function ratioOf(p: SnapshotProtocol): number | null {
  if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) return null;
  return clamp(p.mcap_usd / p.tvl_usd, 0.01, 25);
}

export function buildModel(protocols: SnapshotProtocol[]): Model {
  const allRatios: number[] = [];
  const allGrowth: number[] = [];
  const rByCat = new Map<string, number[]>();
  const gByCat = new Map<string, number[]>();
  const tByCat = new Map<string, number>();
  const nByCat = new Map<string, number>();
  let tokenTotal = 0;

  for (const p of protocols) {
    const key = catKey(p.category);
    const hasToken = p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
    if (hasToken) tokenTotal++;
    nByCat.set(key, (nByCat.get(key) ?? 0) + 1);
    if (hasToken) tByCat.set(key, (tByCat.get(key) ?? 0) + 1);

    const r = ratioOf(p);
    if (r !== null) {
      allRatios.push(r);
      const list = rByCat.get(key);
      if (list === undefined) rByCat.set(key, [r]);
      else list.push(r);
    }
    if (p.change_7d !== null) {
      allGrowth.push(p.change_7d);
      const list = gByCat.get(key);
      if (list === undefined) gByCat.set(key, [p.change_7d]);
      else list.push(p.change_7d);
    }
  }

  const globalMed = median(allRatios);
  const globalMultiple = globalMed === null ? 0.2 : clamp(globalMed, 0.03, 3);
  const growthMed = median(allGrowth);
  const growthMad = growthMed === null ? null : mad(allGrowth, growthMed);
  const globalTokenRate = protocols.length > 0 ? tokenTotal / protocols.length : 0.5;
  const devs = allRatios.map((r) => Math.abs(Math.log(r / globalMultiple)));
  const dispersion = median(devs) ?? Math.log(2);

  const by_category = new Map<string, CatStat>();
  const keys = new Set<string>();
  for (const k of rByCat.keys()) keys.add(k);
  for (const k of gByCat.keys()) keys.add(k);
  for (const k of nByCat.keys()) keys.add(k);

  for (const k of keys) {
    const rs = rByCat.get(k) ?? [];
    const own = median(rs);
    const multiple =
      own === null
        ? globalMultiple
        : clamp((rs.length * own + PRIOR * globalMultiple) / (rs.length + PRIOR), MIN_MULTIPLE, MAX_MULTIPLE);
    const gs = gByCat.get(k) ?? [];
    const gm = median(gs);
    const total = nByCat.get(k) ?? rs.length;
    const tokens = tByCat.get(k) ?? 0;
    by_category.set(k, {
      multiple,
      n: rs.length,
      growth_med: gm,
      growth_mad: gm === null ? null : mad(gs, gm),
      total,
      tokens,
      token_rate: (tokens + TOKEN_PRIOR * globalTokenRate) / (total + TOKEN_PRIOR),
    });
  }

  return {
    global_multiple: globalMultiple,
    global_growth_med: growthMed,
    global_growth_mad: growthMad,
    global_token_rate: globalTokenRate,
    anchors: allRatios.length,
    dispersion,
    by_category,
  };
}

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(asOf + "T00:00:00Z");
  const b = Date.parse(listedAt + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

const VERSIONED = / (V[0-9]+(\.[0-9]+)?|v[0-9]+(\.[0-9]+)?|[0-9]+\.[0-9]+)$/;

export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== "CEX" && !VERSIONED.test(p.name);
}
