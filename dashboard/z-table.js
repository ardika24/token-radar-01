(function () {
  "use strict";

  var App = {};
  var RC = null;

  App.byId = function (id) { return document.getElementById(id); };

  App.h = function (tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  };

  App.clear = function (node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  };

  App.bind = function () {
    RC = window.RC;
    App.D = RC && RC.data;
    App.RC = RC;
    App.thead = App.byId("thead");
    App.tbody = App.byId("tbody");
    App.tabsEl = App.byId("tabs");
    App.emptyEl = App.byId("empty");
    App.noteEl = App.byId("note");
    App.stripEl = App.byId("strip");
    App.statusEl = App.byId("status");
    App.drawer = App.byId("drawer");
    App.scrim = App.byId("scrim");
    App.dbody = App.byId("dbody");
    App.dname = App.byId("dname");
    App.dsub = App.byId("dsub");
    App.dclose = App.byId("dclose");
    App.openSlug = null;
    App.lastFocus = null;
  };

  App.COLS = [
    { k: "rank", label: "#", cls: "n" },
    { k: "name", label: "protocol" },
    { k: "chains", label: "chains", cls: "col-cat" },
    { k: "category", label: "sector", cls: "col-cat" },
    { k: "tvl_usd", label: "tvl", cls: "n col-tvl" },
    { k: "change_7d", label: "7d", cls: "n col-chg" },
    { k: "age_days", label: "age", cls: "n col-age" },
    { k: "alpha", label: "\u03b1", cls: "n col-alpha" },
    { k: "safety", label: "safe", cls: "n col-safe" },
    { k: "score", label: "score", cls: "n col-score" },
    { k: "odds", label: "odds", cls: "n col-odds" },
    { k: "edge", label: "x/tvl", cls: "n col-edge" },
    { k: "implied_value_usd", label: "implied value", cls: "n" }
  ];

  App.LIVE_COLS = [
    { k: "rank", label: "#", cls: "n" },
    { k: "name", label: "protocol" },
    { k: "chains", label: "chains", cls: "col-cat" },
    { k: "category", label: "sector", cls: "col-cat" },
    { k: "tvl_usd", label: "tvl", cls: "n col-tvl" },
    { k: "change_7d", label: "7d", cls: "n col-chg" },
    { k: "age_days", label: "age", cls: "n col-age" },
    { k: "alpha", label: "\u03b1", cls: "n col-alpha" },
    { k: "safety", label: "safe", cls: "n col-safe" },
    { k: "score", label: "score", cls: "n col-score" },
    { k: "odds", label: "odds", cls: "n col-odds" },
    { k: "edge", label: "x/tvl", cls: "n col-edge" },
    { k: "mcap_usd", label: "market cap", cls: "n" }
  ];

  App.val = function (r, k) {
    if (k === "alpha") return r.score.alpha;
    if (k === "safety") return r.score.safety;
    if (k === "score") return r.score.total;
    if (k === "odds") return r.odds;
    if (k === "edge") return r.edge;
    if (k === "chains") return r.chains.length;
    if (k === "name") return String(r.name).toLowerCase();
    return r[k];
  };

  App.sortRows = function (rows) {
    var k = RC.st.sortKey;
    var d = RC.st.sortDir;
    var out = rows.slice();
    out.sort(function (a, b) {
      var va = App.val(a, k);
      var vb = App.val(b, k);
      if (typeof va === "string" || typeof vb === "string") {
        var sa = String(va === null || va === undefined ? "" : va);
        var sb = String(vb === null || vb === undefined ? "" : vb);
        if (sa === sb) return a.rank - b.rank;
        return (sa < sb ? -1 : 1) * d;
      }
      var fa = RC.fin(va);
      var fb = RC.fin(vb);
      if (!fa && !fb) return a.rank - b.rank;
      if (!fa) return 1;
      if (!fb) return -1;
      if (va === vb) return a.rank - b.rank;
      return (va < vb ? -1 : 1) * d;
    });
    return out;
  };

  App.renderHead = function (cols, live) {
    App.clear(App.thead);
    var tr = App.h("tr", "");
    cols.forEach(function (c) {
      var th = App.h("th", c.cls || "", c.label);
      th.scope = "col";
      if (!live && c.k !== "chains") {
        th.tabIndex = 0;
        th.setAttribute("role", "button");
        if (RC.st.sortKey === c.k) {
          th.appendChild(App.h("span", "arrow", RC.st.sortDir === 1 ? "\u25b2" : "\u25bc"));
        }
        var go = function () {
          if (RC.st.sortKey === c.k) RC.st.sortDir = -RC.st.sortDir;
          else {
            RC.st.sortKey = c.k;
            RC.st.sortDir = c.k === "rank" || c.k === "name" || c.k === "category" ? 1 : -1;
          }
          App.render();
        };
        th.addEventListener("click", go);
        th.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); }
        });
      }
      tr.appendChild(th);
    });
    App.thead.appendChild(tr);
  };

  window.App = App;
})();
