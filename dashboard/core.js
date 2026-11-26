(function () {
  "use strict";

  var D = window.RADAR || null;
  var KW = "radar.watch.v2";
  var KA = "radar.alerts.v2";

  function fin(x) { return typeof x === "number" && isFinite(x); }

  function usd(x) {
    if (!fin(x)) return "-";
    var a = Math.abs(x);
    if (a >= 1e12) return "$" + (x / 1e12).toFixed(2) + "T";
    if (a >= 1e9) return "$" + (x / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (x / 1e6).toFixed(a >= 1e8 ? 0 : 1) + "M";
    if (a >= 1e3) return "$" + Math.round(x / 1e3) + "K";
    return "$" + Math.round(x);
  }

  function pct(x) {
    if (!fin(x)) return "-";
    var a = Math.abs(x);
    var s = a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a.toFixed(2);
    return (x > 0 ? "+" : x < 0 ? "-" : "") + s + "%";
  }

  function age(x) {
    if (!fin(x)) return "-";
    return x < 365 ? Math.round(x) + "d" : (x / 365).toFixed(1) + "y";
  }

  function int(x) { return fin(x) ? String(Math.round(x)) : "-"; }

  function ratio(x) {
    if (!fin(x)) return "-";
    return (Math.round(x * 10) / 10).toFixed(1) + "x";
  }

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v === null || v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var st = {
    q: "",
    chain: "",
    cat: "",
    tvl: 0,
    age: 0,
    tab: "board",
    sortKey: "rank",
    sortDir: 1,
    watch: new Set(Array.isArray(read(KW, [])) ? read(KW, []) : []),
    alerts: read(KA, {})
  };

  var TABS = [
    { id: "board", label: "Board", test: function () { return true; } },
    { id: "fresh", label: "Fresh", test: function (r) { return fin(r.age_days) && r.age_days <= 365; } },
    { id: "surge", label: "Momentum", test: function (r) { return r.score.alpha >= 70; } },
    { id: "safer", label: "Safer", test: function (r) { return r.score.safety >= 75 && r.tvl_usd >= 1e8; } },
    { id: "watch", label: "Watchlist", test: function (r) { return st.watch.has(r.slug); } },
    { id: "live", label: "Live tokens", test: function () { return true; } }
  ];

  function tabById(id) {
    for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
    return TABS[0];
  }

  function tabCount(id) {
    if (!D) return 0;
    if (id === "live") return D.live.length;
    var t = tabById(id);
    return D.rows.filter(t.test).length;
  }

  function matches(r) {
    if (st.chain && r.chains.indexOf(st.chain) < 0) return false;
    if (st.cat && (r.category || "uncategorised") !== st.cat) return false;
    if (st.tvl > 0 && !(fin(r.tvl_usd) && r.tvl_usd >= st.tvl)) return false;
    if (st.age > 0 && !(fin(r.age_days) && r.age_days <= st.age)) return false;
    if (st.q) {
      var h = (r.name + " " + r.slug + " " + (r.category || "") + " " + r.chains.join(" ") + " " + (r.symbol || "")).toLowerCase();
      if (h.indexOf(st.q) < 0) return false;
    }
    return true;
  }

  function visible() {
    if (!D) return [];
    var tab = tabById(st.tab);
    return window.App.sortRows(D.rows.filter(function (r) { return tab.test(r) && matches(r); }));
  }

  window.RC = {
    data: D,
    tabs: TABS,
    st: st,
    fin: fin,
    usd: usd,
    pct: pct,
    age: age,
    int: int,
    ratio: ratio,
    tabCount: tabCount,
    tabById: tabById,
    visible: visible,
    notify: function (msg) {
      var t = document.getElementById("toast");
      if (!t) return;
      t.textContent = msg;
      t.className = "toast on";
      window.clearTimeout(window.__toastT);
      window.__toastT = window.setTimeout(function () { t.className = "toast"; }, 1400);
    },
    toggleWatch: function (slug) {
      if (st.watch.has(slug)) st.watch.delete(slug);
      else st.watch.add(slug);
      write(KW, Array.from(st.watch));
      return st.watch.has(slug);
    },
    alertOf: function (slug) {
      var v = st.alerts[slug];
      return fin(v) ? v : null;
    },
    setAlert: function (slug, v) {
      if (!fin(v) || v <= 0) delete st.alerts[slug];
      else st.alerts[slug] = Math.min(100, Math.max(1, Math.round(v)));
      write(KA, st.alerts);
    }
  };
})();
