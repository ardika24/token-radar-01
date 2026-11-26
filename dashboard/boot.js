(function () {
  "use strict";

  var App = window.App;
  var RC = window.RC;
  var D = RC.data;

  function med(xs) {
    var a = xs.filter(RC.fin).slice().sort(function (p, q) { return p - q; });
    if (a.length === 0) return null;
    var m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  function fillSelect(sel, values, allLabel) {
    while (sel.options.length > 1) sel.remove(1);
    values.forEach(function (v) {
      var o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      sel.appendChild(o);
    });
    if (RC.st[sel.id] === undefined) RC.st[sel.id] = "";
    sel.value = sel.id === "chain" ? RC.st.chain : RC.st.cat;
    var first = sel.options[0];
    if (first) first.textContent = allLabel;
  }

  App.renderTabs = function () {
    App.clear(App.tabsEl);
    RC.tabs.forEach(function (t) {
      var b = App.h("button", "tab", "");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", RC.st.tab === t.id ? "true" : "false");
      b.appendChild(document.createTextNode(t.label));
      b.appendChild(App.h("b", "", RC.tabCount(t.id)));
      b.addEventListener("click", function () {
        RC.st.tab = t.id;
        App.render();
      });
      App.tabsEl.appendChild(b);
    });
  };

  App.renderSelects = function () {
    var chains = {};
    D.rows.forEach(function (r) { r.chains.forEach(function (c) { chains[c] = 1; }); });
    var chainSel = App.byId("chain");
    if (chainSel.options.length <= 1) {
      Object.keys(chains).sort().forEach(function (c) {
        var o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        chainSel.appendChild(o);
      });
    }

    var cats = {};
    D.rows.forEach(function (r) { cats[r.category || "uncategorised"] = 1; });
    var catSel = App.byId("cat");
    if (catSel.options.length <= 1) {
      Object.keys(cats).sort().forEach(function (c) {
        var o = document.createElement("option");
        o.value = c;
        o.textContent = c;
        catSel.appendChild(o);
      });
    }
  };

  App.renderChrome = function () {
    var wl = {};
    D.rows.forEach(function (r) { wl[r.slug] = r; });
    var covered = D.rows.filter(function (r) { return r.watchlisted === true; }).length;
    var m7 = med(D.rows.map(function (r) { return r.change_7d; }));
    var ms = med(D.rows.map(function (r) { return r.score.total; }));

    App.stripEl.textContent = "";
    var bits = [
      ["board", String(D.board_size)],
      ["covered", covered + "/" + D.watchlist_size],
      ["anchors", String(D.anchors)],
      ["farmable", String(D.integrity.farmable)],
      ["thin cats", String(D.integrity.thin_categories)],
      ["median 7d", m7 === null ? "-" : RC.pct(m7)],
      ["median score", ms === null ? "-" : String(Math.round(ms))]
    ];
    bits.forEach(function (b) {
      var s = document.createElement("span");
      s.appendChild(document.createTextNode(b[0] + " "));
      s.appendChild(App.h("b", "", b[1]));
      App.stripEl.appendChild(s);
    });

    App.clear(App.statusEl);
    var dot = App.h("i", "dot" + (D.mode === "live" ? " live" : ""), "");
    App.statusEl.appendChild(dot);
    var label = D.mode === "live" ? "LIVE SNAPSHOT" : "CACHED SNAPSHOT";
    App.statusEl.appendChild(document.createTextNode(label + " \u00b7 " + D.as_of + " \u00b7 " + D.model_version));
    App.statusEl.title = D.mode === "live"
      ? "Built from a fresh fetch; the page itself makes no network calls."
      : "Built from the sealed snapshot in the repository. Run refresh.ts to fetch a new one.";
    App.byId("method").textContent = "model " + D.model_version + ": implied = TVL x peer mcap/TVL x 7d growth x tenure \u00b7 score = 0.55 alpha + 0.45 safety \u00b7 odds = share of category peers already trading";
  };

  App.render = function () {
    App.renderTabs();
    App.renderSelects();
    App.renderChrome();

    var isLive = RC.st.tab === "live";
    App.renderHead(isLive ? App.LIVE_COLS : App.COLS, isLive);

    var rows = isLive ? D.live : App.sortRows(RC.visible());
    var frag = document.createDocumentFragment();
    rows.forEach(function (r, i) {
      frag.appendChild(isLive ? App.liveRow(r, i) : App.boardRow(r));
    });
    App.clear(App.tbody);
    App.tbody.appendChild(frag);

    App.emptyEl.hidden = rows.length > 0;
    App.noteEl.textContent = isLive
      ? "showing " + rows.length + " protocols that already trade a token, by market cap \u00b7 kept apart from the board: the radar ranks only the pre-token side"
      : "showing " + rows.length + " of " + D.rows.length + " rows \u00b7 sorted by " + RC.st.sortKey + " " + (RC.st.sortDir === 1 ? "asc" : "desc") + " \u00b7 every figure derived from the sealed " + D.as_of + " snapshot \u00b7 no network at render time";
  };

  App.init = function () {
    App.bind();
    if (!RC || !D || !Array.isArray(D.rows) || D.rows.length === 0) {
      var msg = "No board data. data.js was not loaded or holds no rows. Build it with: node main.ts --input input/snapshot.json";
      App.clear(App.tbody);
      App.emptyEl.hidden = true;
      App.noteEl.textContent = msg;
      return;
    }

    RC.st.sortKey = "rank";
    RC.st.sortDir = 1;

    App.byId("q").addEventListener("input", function (ev) {
      RC.st.q = String(ev.target.value || "").trim().toLowerCase();
      App.render();
    });
    App.byId("chain").addEventListener("change", function (ev) {
      RC.st.chain = String(ev.target.value || "");
      App.render();
    });
    App.byId("cat").addEventListener("change", function (ev) {
      RC.st.cat = String(ev.target.value || "");
      App.render();
    });
    App.byId("tvl").addEventListener("change", function (ev) {
      RC.st.tvl = Number(ev.target.value) || 0;
      App.render();
    });
    App.byId("age").addEventListener("change", function (ev) {
      RC.st.age = Number(ev.target.value) || 0;
      App.render();
    });
    App.byId("reset").addEventListener("click", function () {
      RC.st.q = "";
      RC.st.chain = "";
      RC.st.cat = "";
      RC.st.tvl = 0;
      RC.st.age = 0;
      RC.st.tab = "board";
      RC.st.sortKey = "rank";
      RC.st.sortDir = 1;
      App.byId("q").value = "";
      App.byId("chain").value = "";
      App.byId("cat").value = "";
      App.byId("tvl").value = "0";
      App.byId("age").value = "0";
      App.render();
    });
    App.dclose.addEventListener("click", App.closeDrawer);
    App.scrim.addEventListener("click", App.closeDrawer);
    document.addEventListener("keydown", App.onEscape);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "/" && !App.openSlug && document.activeElement !== App.byId("q")) {
        ev.preventDefault();
        App.byId("q").focus();
      }
    });

    App.render();
  };
})();

if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", function () { window.App.init(); }); } else { window.App.init(); }
