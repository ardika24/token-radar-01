/* TOKEN RADAR / 01-model.js
 * The valuation, odds and score terms the page renders, in one place.
 * Pure math only: no fetch, no DOM, no clock. The build imports this file
 * (side effect: globalThis.RCModel) and the dashboard reads the same object.
 */
(function (root) {
  "use strict";

  var MIN_MULTIPLE = 0.03;
  var MAX_MULTIPLE = 2.5;
  var TOKEN_PRIOR = 8;
  var GROWTH_W = 0.35;
  var ALPHA_W = { relative: 0.35, absolute: 0.25, scale: 0.15, tenure: 0.15, breadth: 0.1 };
  var SAFE_W = { floor: 0.3, drawdown: 0.25, anomaly: 0.2, provenance: 0.15, category: 0.1 };
  var BLEND = { alpha: 0.55, safety: 0.45 };
  var SHRINK_K = 8;
  var MIN_PEERS = 2;

  var CAT_RISK = {
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
    staking: 60
  };

  function fin(x) { return typeof x === "number" && isFinite(x); }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round3(x) { return Math.round(x * 1000) / 1000; }

  function median(xs) {
    var a = (xs || []).filter(fin).sort(function (p, q) { return p - q; });
    if (!a.length) return null;
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function mad(xs, med) {
    if (!xs || !xs.length || !fin(med)) return null;
    return median(xs.map(function (x) { return Math.abs(x - med); }));
  }

  function logScale(x, lo, hi) {
    if (!fin(x) || x <= 0 || lo <= 0 || hi <= lo) return 0;
    if (x <= lo) return 0;
    if (x >= hi) return 100;
    return ((Math.log10(x) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
  }

  function tenScore(age) {
    if (!fin(age)) return 45;
    if (age < 90) return clamp((age / 90) * 45, 10, 45);
    if (age < 270) return 45 + ((age - 90) / 180) * 35;
    if (age < 900) return 80 + ((age - 270) / 630) * 20;
    return clamp(100 - ((age - 900) / 900) * 45, 55, 100);
  }

  function breadthScore(n) {
    if (n <= 1) return 45;
    if (n === 2) return 65;
    if (n === 3) return 80;
    if (n === 4) return 90;
    return 100;
  }

  function floorScore(tvl) {
    if (tvl >= 2e9) return 100;
    if (tvl >= 5e8) return 92;
    if (tvl >= 2e8) return 85;
    if (tvl >= 1e8) return 78;
    if (tvl >= 5e7) return 70;
    if (tvl >= 2e7) return 55;
    if (tvl >= 1e7) return 42;
    return 28;
  }

  function ddScore(c) {
    if (c === null || c === undefined) return 60;
    if (c >= 10) return 100;
    if (c >= 0) return 92;
    if (c >= -10) return 80;
    if (c >= -20) return 65;
    if (c >= -30) return 48;
    if (c >= -45) return 28;
    return 10;
  }

  function anomalyScore(c, med, m) {
    if (!fin(c) || med === null) return 70;
    var sigma = Math.max(5, 1.4826 * (m || 0));
    var dev = Math.abs(c - med);
    if (c > 250) return 35;
    if (dev > 6 * sigma) return 20;
    if (dev > 4 * sigma) return 45;
    if (dev > 2.5 * sigma) return 75;
    return 100;
  }

  function provScore(age) {
    if (age === null) return 45;
    if (age < 90) return 52;
    if (age < 365) return 72;
    if (age < 1095) return 88;
    return 100;
  }

  function catKey(category) {
    return String(category || "uncategorised").trim().toLowerCase();
  }

  function shrinkPeerMultiple(raw, n, globalMultiple, k) {
    var kk = fin(k) && k > 0 ? k : SHRINK_K;
    var g = fin(globalMultiple) && globalMultiple > 0 ? globalMultiple : 0.2;
    var r = fin(raw) && raw > 0 ? raw : g;
    var count = fin(n) && n > 0 ? n : 0;
    var thin = count < 3;
    var capped = count < MIN_PEERS ? Math.min(r, 1.5) : r;
    var weight = count / (count + kk);
    var multiple = clamp(weight * capped + (1 - weight) * g, MIN_MULTIPLE, MAX_MULTIPLE);
    return { multiple: round3(multiple), raw: round3(r), capped: round3(capped), global: round3(g), n: count, k: kk, weight: round3(weight), thin: thin, priorOnly: false };
  }

  function growthAdj(change) {
    return 1 + (clamp(fin(change) ? change : 0, -40, 80) / 100) * GROWTH_W;
  }

  function tenureAdj(ageDays) {
    return 0.92 + (0.08 * Math.min(fin(ageDays) ? ageDays : 540, 720)) / 720;
  }

  function tokenOdds(tokens, total, globalRate, k) {
    var kk = fin(k) && k > 0 ? k : TOKEN_PRIOR;
    var g = fin(globalRate) ? clamp(globalRate, 0.001, 0.999) : 0.5;
    var rate = total > 0 ? (clamp(tokens, 0, total) + kk * g) / (total + kk) : g;
    return Math.round(clamp(rate * 100, 1, 99));
  }

  function impliedValue(tvl, mult, change, ageDays) {
    if (!fin(tvl) || tvl <= 0) return 0;
    var multiple = clamp(fin(mult) ? mult : 0.2, MIN_MULTIPLE, MAX_MULTIPLE);
    return Math.max(1, Math.round(tvl * multiple * growthAdj(change) * tenureAdj(ageDays)));
  }

  function valuationBand(implied, categoryTotal) {
    var pct = fin(categoryTotal) && categoryTotal >= 12 ? 0.3 : 0.42;
    return { low: Math.max(1, Math.round(implied * (1 - pct))), high: Math.round(implied * (1 + pct)), pct: pct };
  }

  function verdictFor(total, edge, odds) {
    if (!fin(total) || total < 55 || !fin(edge) || edge < 0.25) return "SKIP";
    if (total < 68 || edge < 0.35 || !fin(odds) || odds < 20) return "WATCH";
    return "FARM";
  }

  function alphaParts(row) {
    var s = row.signals || {};
    var z = fin(s.relative_z) ? s.relative_z : 0;
    var relative = fin(s.relative_score) ? clamp(s.relative_score, 0, 100) : clamp(((z + 3) / 6) * 100, 0, 100);
    var change = fin(s.inflow_pct) ? s.inflow_pct : (fin(row.change_7d) ? row.change_7d : 0);
    var absolute = clamp(50 + change * 1.8, 0, 100);
    return [
      ["relative inflow", relative, ALPHA_W.relative],
      ["absolute inflow", absolute, ALPHA_W.absolute],
      ["scale", fin(s.scale) ? s.scale : logScale(row.tvl_usd, 5e6, 5e9), ALPHA_W.scale],
      ["tenure", fin(s.tenure) ? s.tenure : tenScore(row.age_days), ALPHA_W.tenure],
      ["chain breadth", fin(s.breadth) ? s.breadth : breadthScore((row.chains || []).length), ALPHA_W.breadth]
    ];
  }

  function safetyParts(row) {
    var s = row.signals || {};
    return [
      ["liquidity floor", fin(s.liquidity) ? s.liquidity : floorScore(row.tvl_usd), SAFE_W.floor],
      ["7d drawdown", fin(s.drawdown) ? s.drawdown : ddScore(row.change_7d), SAFE_W.drawdown],
      ["flow anomaly", fin(s.anomaly) ? s.anomaly : 70, SAFE_W.anomaly],
      ["listing provenance", fin(s.provenance) ? s.provenance : provScore(row.age_days), SAFE_W.provenance],
      ["category risk", fin(s.category_risk) ? s.category_risk : (CAT_RISK[catKey(row.category)] || 65), SAFE_W.category]
    ];
  }

  function scoreProtocol(row) {
    var alpha = 0;
    var safety = 0;
    if (row.score && fin(row.score.alpha) && fin(row.score.safety) && fin(row.score.total)) {
      alpha = Math.round(row.score.alpha);
      safety = Math.round(row.score.safety);
    } else {
      var ap = alphaParts(row);
      for (var i = 0; i < ap.length; i++) alpha += ap[i][1] * ap[i][2];
      alpha = Math.round(alpha);
      var sp = safetyParts(row);
      for (var j = 0; j < sp.length; j++) safety += sp[j][1] * sp[j][2];
      safety = Math.round(safety);
    }
    var total = row.score && fin(row.score.total)
      ? clamp(Math.round(row.score.total), 1, 100)
      : clamp(Math.round(BLEND.alpha * alpha + BLEND.safety * safety), 1, 100);
    var m = row.model || {};
    var odds = fin(row.odds) ? row.odds : tokenOdds(m.token_tokens, m.token_total, m.global_token_rate, TOKEN_PRIOR);
    var implied = impliedValue(row.tvl_usd, m.launch_multiple, row.change_7d, row.age_days);
    var edge = row.tvl_usd > 0 ? round3(implied / row.tvl_usd) : 0;
    var band = valuationBand(implied, m.peer_total);
    return {
      alpha: alpha, safety: safety, total: total,
      odds: odds, implied: implied, edge: edge,
      low: band.low, high: band.high,
      shrink_weight: fin(m.shrink_weight) ? m.shrink_weight : null,
      thin: m.thin === true || m.peer_n === 1,
      verdict: verdictFor(total, edge, odds)
    };
  }

  function spearman(xs, ys) {
    var n = Math.min(xs.length, ys.length);
    if (n < 3) return null;
    function ranks(v) {
      var idx = []; for (var i = 0; i < v.length; i++) idx.push(i);
      idx.sort(function (a, b) { return v[a] - v[b]; });
      var r = new Array(v.length); var i = 0;
      while (i < n) {
        var j = i;
        while (j + 1 < n && v[idx[j + 1]] === v[idx[i]]) j++;
        var avg = (i + j) / 2 + 1;
        for (var k = i; k <= j; k++) r[idx[k]] = avg;
        i = j + 1;
      }
      return r;
    }
    var rx = ranks(xs.slice(0, n)), ry = ranks(ys.slice(0, n));
    var mx = 0, my = 0, i;
    for (i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; }
    mx /= n; my /= n;
    var num = 0, dx = 0, dy = 0;
    for (i = 0; i < n; i++) {
      var a = rx[i] - mx, b = ry[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }

  function holdoutMetrics(anchors) {
    var errs = [], preds = [], actual = [];
    (anchors || []).forEach(function (a) {
      if (!fin(a.pred_value) || !fin(a.mcap_usd) || a.pred_value <= 0 || a.mcap_usd <= 0) return;
      errs.push(Math.abs(Math.log(a.pred_value / a.mcap_usd)));
      preds.push(a.pred_value); actual.push(a.mcap_usd);
    });
    return {
      n: errs.length,
      mdape: errs.length ? round3(median(errs)) : null,
      spearman: spearman(preds, actual)
    };
  }

  function ratioOf(p) {
    if (!p || !fin(p.mcap_usd) || p.mcap_usd <= 0 || !fin(p.tvl_usd) || p.tvl_usd <= 0) return null;
    return clamp(p.mcap_usd / p.tvl_usd, 0.01, 25);
  }

  function buildModel(protocols) {
    var allRatios = [], allGrowth = [];
    var rByCat = new Map(), gByCat = new Map(), tByCat = new Map(), nByCat = new Map();
    var tokenTotal = 0;
    (protocols || []).forEach(function (p) {
      var key = catKey(p.category);
      var hasToken = p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
      if (hasToken) tokenTotal++;
      nByCat.set(key, (nByCat.get(key) || 0) + 1);
      if (hasToken) tByCat.set(key, (tByCat.get(key) || 0) + 1);
      var r = ratioOf(p);
      if (r !== null) {
        allRatios.push(r);
        if (!rByCat.has(key)) rByCat.set(key, []);
        rByCat.get(key).push(r);
      }
      if (fin(p.change_7d)) {
        allGrowth.push(p.change_7d);
        if (!gByCat.has(key)) gByCat.set(key, []);
        gByCat.get(key).push(p.change_7d);
      }
    });
    var globalMed = median(allRatios);
    var globalMultiple = globalMed === null ? 0.2 : clamp(globalMed, 0.03, 3);
    var growthMed = median(allGrowth);
    var growthMad = growthMed === null ? null : mad(allGrowth, growthMed);
    var globalTokenRate = protocols && protocols.length > 0 ? tokenTotal / protocols.length : 0.5;
    var devs = allRatios.map(function (r) { return Math.abs(Math.log(r / globalMultiple)); });
    var dispersion = median(devs) === null ? Math.log(2) : median(devs);

    var byCategory = new Map();
    var keys = new Set();
    rByCat.forEach(function (v, k) { keys.add(k); });
    gByCat.forEach(function (v, k) { keys.add(k); });
    nByCat.forEach(function (v, k) { keys.add(k); });
    keys.forEach(function (k) {
      var rs = rByCat.get(k) || [];
      var own = median(rs);
      var thin = rs.length < 3;
      var raw = own === null ? globalMultiple : clamp(own, MIN_MULTIPLE, MAX_MULTIPLE);
      var capped = rs.length < MIN_PEERS ? Math.min(raw, 1.5) : raw;
      var weight = rs.length / (rs.length + SHRINK_K);
      var multiple = clamp(weight * capped + (1 - weight) * globalMultiple, MIN_MULTIPLE, MAX_MULTIPLE);
      var gs = gByCat.get(k) || [];
      var gm = median(gs);
      var total = nByCat.get(k) || rs.length;
      var tokens = tByCat.get(k) || 0;
      byCategory.set(k, {
        multiple: multiple,
        raw_multiple: raw,
        weight: round3(weight),
        thin: thin,
        n: rs.length,
        growth_med: gm,
        growth_mad: gm === null ? null : mad(gs, gm),
        total: total,
        tokens: tokens,
        token_rate: (tokens + TOKEN_PRIOR * globalTokenRate) / (total + TOKEN_PRIOR)
      });
    });
    return {
      global_multiple: globalMultiple,
      global_growth_med: growthMed,
      global_growth_mad: growthMad,
      global_token_rate: globalTokenRate,
      anchors: allRatios.length,
      dispersion: dispersion,
      all_ratios: allRatios,
      ratios_by_category: rByCat,
      by_category: byCategory
    };
  }

  var api = {
    MIN_MULTIPLE: MIN_MULTIPLE,
    MAX_MULTIPLE: MAX_MULTIPLE,
    TOKEN_PRIOR: TOKEN_PRIOR,
    GROWTH_W: GROWTH_W,
    ALPHA_W: ALPHA_W,
    SAFE_W: SAFE_W,
    BLEND: BLEND,
    SHRINK_K: SHRINK_K,
    MIN_PEERS: MIN_PEERS,
    CAT_RISK: CAT_RISK,
    fin: fin,
    clamp: clamp,
    round1: round1,
    round3: round3,
    median: median,
    mad: mad,
    logScale: logScale,
    tenScore: tenScore,
    breadthScore: breadthScore,
    floorScore: floorScore,
    ddScore: ddScore,
    provScore: provScore,
    catKey: catKey,
    shrinkPeerMultiple: shrinkPeerMultiple,
    growthAdj: growthAdj,
    tenureAdj: tenureAdj,
    tokenOdds: tokenOdds,
    impliedValue: impliedValue,
    valuationBand: valuationBand,
    verdictFor: verdictFor,
    alphaParts: alphaParts,
    safetyParts: safetyParts,
    scoreProtocol: scoreProtocol,
    spearman: spearman,
    holdoutMetrics: holdoutMetrics,
    buildModel: buildModel
  };

  root.RCModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
