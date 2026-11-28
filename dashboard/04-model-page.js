/* TOKEN RADAR / 04-model-page.js - MODEL & SANDBOX. All math from RCModel. */
(function () {
  "use strict";

  var App = window.App;
  var RC = window.RC;
  var D = RC.data;
  var built = false;
  var S = { slug: null, tvl: 0, change: 0, age: 540, mult: 0.2, n: 0, rate: 50, chains: 1 };

  function $(id) { return App.byId(id); }
  function h(tag, cls, text) { return App.h(tag, cls || "", text === undefined ? "" : text); }
  function usd(x) { return RC.usd(x); }
  function val(id) { var e = $(id); return e ? Number(e.value) : 0; }

  function findRow(slug) {
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) return D.rows[i];
    return null;
  }

  function loadRow(row) {
    if (!row) return;
    S.slug = row.slug;
    S.tvl = row.tvl_usd;
    S.change = RC.fin(row.change_7d) ? row.change_7d : 0;
    S.age = RC.fin(row.age_days) ? row.age_days : 540;
    S.mult = RC.fin(row.model.peer_raw_multiple) ? row.model.peer_raw_multiple : row.model.launch_multiple;
    S.n = RC.fin(row.model.peer_n) ? row.model.peer_n : 0;
    S.rate = RC.fin(row.odds) ? row.odds : 0;
    S.chains = (row.chains || []).length;
    $("s_tvl").value = String(Math.log10(Math.max(1, S.tvl)));
    $("s_chg").value = String(S.change);
    $("s_age").value = String(S.age);
    $("s_mult").value = String(S.mult);
    $("s_n").value = String(S.n);
    $("s_rate").value = String(S.rate);
    $("s_chains").value = String(S.chains);
    $("n_tvl").value = String(Math.round(S.tvl));
    $("mproto").value = row.slug;
    calc();
  }

  function calc() {
    S.tvl = Math.pow(10, val("s_tvl"));
    S.change = val("s_chg");
    S.age = val("s_age");
    S.mult = val("s_mult");
    S.n = Math.round(val("s_n"));
    S.rate = val("s_rate");
    S.chains = Math.round(val("s_chains"));

    $("o_tvl").textContent = "$" + usd(S.tvl);
    $("o_chg").textContent = (S.change >= 0 ? "+" : "") + S.change.toFixed(1) + "%";
    $("o_age").textContent = Math.round(S.age) + "d";
    $("o_mult").textContent = S.mult.toFixed(2) + "x";
    $("o_n").textContent = String(S.n);
    $("o_rate").textContent = Math.round(S.rate) + "%";
    $("o_chains").textContent = String(S.chains);

    var m = window.RCModel;
    var row = findRow(S.slug);
    var shr = m.shrinkPeerMultiple(S.mult, S.n, D.global_multiple, D.shrink_k);
    var implied = m.impliedValue(S.tvl, shr.multiple, S.change, S.age);
    var edge = S.tvl > 0 ? implied / S.tvl : 0;
    var band = m.valuationBand(implied, S.n >= 2 ? 12 : 2);
    var signals = {
      relative_z: m.clamp(S.change / 12, -3, 3),
      inflow_pct: S.change,
      scale: m.logScale(S.tvl, 5e6, 5e9),
      tenure: m.tenScore(S.age),
      breadth: m.breadthScore(S.chains),
      liquidity: m.floorScore(S.tvl),
      drawdown: m.ddScore(S.change),
      anomaly: 70,
      provenance: m.provScore(S.age),
      category_risk: m.CAT_RISK[m.catKey(row ? row.category : null)] || 65
    };
    var ap = m.alphaParts({ signals: signals, tvl_usd: S.tvl, age_days: S.age, chains: [] });
    var sp = m.safetyParts({ signals: signals, tvl_usd: S.tvl, change_7d: S.change, age_days: S.age, category: row ? row.category : null });
    var alpha = 0, safety = 0;
    ap.forEach(function (p) { alpha += p[1] * p[2]; });
    sp.forEach(function (p) { safety += p[1] * p[2]; });
    alpha = Math.round(alpha);
    safety = Math.round(safety);
    var total = m.clamp(Math.round(0.55 * alpha + 0.45 * safety), 1, 100);
    var verdict = m.verdictFor(total, edge, S.rate);

    $("mimplied").textContent = usd(implied);
    $("mverdict").textContent = verdict;
    $("mverdict").className = "v " + String(verdict).toLowerCase();
    $("mband").textContent = usd(band.low) + " - " + usd(band.high) + " (" + Math.round(band.pct * 100) + "%)";
    $("medge").textContent = edge.toFixed(2) + "x";
    $("mweight").textContent = (shr.weight * 100).toFixed(1) + "%";
    $("mshrunk").textContent = shr.multiple.toFixed(3) + "x";
    $("malpha").textContent = String(alpha);
    $("msafety").textContent = String(safety);
    $("mscore").textContent = String(total);
    $("modds").textContent = Math.round(S.rate) + "%";
    $("mthin").textContent = shr.thin ? "THIN n=" + S.n : "n=" + S.n;

    var body = $("mbreak");
    if (body) {
      App.clear(body);
      ap.concat(sp).forEach(function (p) {
        var tr = document.createElement("tr");
        tr.appendChild(h("td", "", p[0]));
        tr.appendChild(h("td", "n", RC.fin(p[1]) ? p[1].toFixed(0) : "-"));
        tr.appendChild(h("td", "n", Math.round(p[2] * 100) + "%"));
        body.appendChild(tr);
      });
    }
    chart(implied);
    params(shr, band);
    cats();
  }

  function chart(implied) {
    var svg = $("mchart");
    if (!svg) return;
    var ax = 50, ay = 220, w = 520, h = 180, minL = 5, maxL = 11.5;
    var marks = "";
    (D.anchor_rows || []).forEach(function (a) {
      var x = ax + ((Math.log10(Math.max(1, a.pred_value)) - minL) / (maxL - minL)) * w;
      var y = ay - ((Math.log10(Math.max(1, a.mcap_usd)) - minL) / (maxL - minL)) * h;
      marks += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.3" fill="#6ee7f5" opacity=".65"/>';
    });
    var px = ax + ((Math.log10(Math.max(1, implied)) - minL) / (maxL - minL)) * w;
    var py = ay - ((Math.log10(Math.max(1, implied)) - minL) / (maxL - minL)) * h;
    var grid = '<line x1="' + ax + '" y1="' + ay + '" x2="' + (ax + w) + '" y2="' + ay + '" stroke="#2a3442"/>' +
      '<line x1="' + ax + '" y1="' + ay + '" x2="' + ax + '" y2="' + (ay - h) + '" stroke="#2a3442"/>' +
      '<line x1="' + ax + '" y1="' + (ay - h) + '" x2="' + (ax + w) + '" y2="' + ay + '" stroke="#1d2532" stroke-dasharray="4 5"/>' +
      '<text x="' + ax + '" y="' + (ay + 16) + '" fill="#7d8a99" font-size="9">predicted 1e5</text>' +
      '<text x="' + (ax + w - 36) + '" y="' + (ay + 16) + '" fill="#7d8a99" font-size="9">1e11</text>' +
      '<text x="2" y="' + (ay - h + 8) + '" fill="#7d8a99" font-size="9">actual 1e11</text>' +
      '<text x="2" y="' + (ay - 2) + '" fill="#7d8a99" font-size="9">1e5</text>';
    svg.innerHTML = grid + marks + '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="4" fill="#fbbf24" stroke="#0b0e13" stroke-width="1"/>';
  }

  function params(shr, band) {
    var t = $("mparams");
    if (!t) return;
    var m = window.RCModel;
    var met = D.anchor_metrics && D.anchor_metrics.mdape !== undefined
      ? D.anchor_metrics
      : m.holdoutMetrics(D.anchor_rows || []);
    var rows = [
      ["anchors (live tokens)", String(D.anchors)],
      ["calibration n", String(met.n)],
      ["field median mcap/TVL", D.global_multiple.toFixed(3) + "x"],
      ["shrink prior k", String(D.shrink_k)],
      ["weight n=1", (1 / (1 + D.shrink_k) * 100).toFixed(1) + "%"],
      ["weight n=8", (8 / (8 + D.shrink_k) * 100).toFixed(1) + "%"],
      ["thin-cat cap", "1.5x peer median"],
      ["selected peer n", String(S.n)],
      ["shrunk multiple", shr.multiple.toFixed(3) + "x"],
      ["calibration MdAPE", met.mdape === null ? "-" : Number(met.mdape).toFixed(3)],
      ["Spearman rank", met.spearman === null ? "-" : Number(met.spearman).toFixed(3)],
      ["FARM gate", "score >= 68 / edge >= 0.35x / odds >= 20%"],
      ["alpha weights", "rel .35 / abs .25 / scale .15 / tenure .15 / breadth .10"],
      ["safety weights", "floor .30 / dd .25 / anomaly .20 / prov .15 / cat .10"],
      ["valuation band", Math.round(band.pct * 100) + "%"]
    ];
    t.textContent = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.appendChild(h("td", "", r[0]));
      tr.appendChild(h("td", "n", r[1]));
      t.appendChild(tr);
    });
  }

  function cats() {
    var t = $("mcats");
    if (!t) return;
    t.textContent = "";
    (D.category_baseline || []).slice(0, 18).forEach(function (c) {
      var tr = document.createElement("tr");
      if (c.thin) tr.className = "thin";
      tr.appendChild(h("td", "", c.category));
      tr.appendChild(h("td", "n", String(c.n)));
      tr.appendChild(h("td", "n", Number(c.raw_multiple).toFixed(2) + "x"));
      tr.appendChild(h("td", "n", Number(c.multiple).toFixed(2) + "x"));
      tr.appendChild(h("td", "n", Math.round(c.weight * 100) + "%"));
      tr.appendChild(h("td", "n", Math.round(c.token_rate * 100) + "%"));
      t.appendChild(tr);
    });
  }

  function bind() {
    ["s_tvl", "s_chg", "s_age", "s_mult", "s_n", "s_rate", "s_chains"].forEach(function (id) {
      $(id).addEventListener("input", calc);
    });
    $("n_tvl").addEventListener("input", function () {
      var v = Number(this.value);
      if (RC.fin(v) && v > 0) {
        $("s_tvl").value = String(Math.log10(v));
        calc();
      }
    });
    $("mproto").addEventListener("change", function () {
      var row = findRow(this.value);
      if (row) loadRow(row);
    });
    var root = $("modelpage");
    root.querySelectorAll("button[data-slug]").forEach(function (b) {
      b.addEventListener("click", function () {
        var row = findRow(this.getAttribute("data-slug"));
        if (row) loadRow(row);
      });
    });
    D.rows.forEach(function (r) {
      var o = document.createElement("option");
      o.value = r.slug;
      o.textContent = r.name;
      $("mproto").appendChild(o);
    });
    built = true;
  }

  App.renderModelPage = function () {
    if (!built) bind();
    var row = findRow(S.slug);
    if (!row) loadRow(D.rows[0]);
    else calc();
  };
})();
