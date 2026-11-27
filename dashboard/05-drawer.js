(function () {
  "use strict";

  var App = window.App;
  var RC = window.RC;
  var D = RC.data;
  var esc = function () {};

  function row(k, v, cls) {
    var tr = document.createElement("tr");
    var a = document.createElement("td");
    a.className = "k";
    a.textContent = k;
    var b = document.createElement("td");
    b.className = "v " + (cls || "");
    b.textContent = v;
    tr.appendChild(a);
    tr.appendChild(b);
    return tr;
  }

  function sig(k, vSRC, w) {
    var tr = document.createElement("tr");
    var a = document.createElement("td");
    a.className = "k";
    a.textContent = k;
    var b = document.createElement("td");
    b.className = "v";
    b.textContent = vSRC;
    var c = document.createElement("td");
    c.className = "w";
    c.textContent = w;
    tr.appendChild(a);
    tr.appendChild(b);
    tr.appendChild(c);
    return tr;
  }

  function section(title) {
    var h3 = document.createElement("h3");
    h3.textContent = title;
    return h3;
  }

  function cell(k, v) {
    var d = App.h("div", "cell", "");
    d.appendChild(App.h("div", "k", k));
    d.appendChild(App.h("div", "v", v));
    return d;
  }

  App.openDrawer = function (slug) {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === slug) r = D.rows[i];
    if (!r) return;

    App.openSlug = slug;
    App.lastFocus = document.activeElement;
    App.dname.textContent = r.name;
    App.dsub.textContent = r.slug + " \u00b7 " + (r.category || "uncategorised") + " \u00b7 " + r.chains.join(", ");

    App.clear(App.dbody);

    var big = App.h("div", "big", "");
    var left = App.h("div", "", "");
    left.appendChild(App.h("div", "k", "implied token value"));
    left.appendChild(App.h("div", "v", RC.usd(r.implied_value_usd)));
    var right = App.h("div", "", "");
    right.style.textAlign = "right";
    right.appendChild(App.h("div", "k", "radar score"));
    right.appendChild(App.h("div", "v", r.score.total + " / 100"));
    right.appendChild(App.h("div", "verdict " + r.verdict.toLowerCase(), r.verdict));
    big.appendChild(left);
    big.appendChild(right);
    App.dbody.appendChild(big);

    var thin = r.model.thin === true;
    var shrink = App.h("div", "shrinkline " + (thin ? "thin" : "full"), "");
    shrink.appendChild(App.h("b", "", thin ? "THIN CATEGORY SHRUNK" : "CATEGORY MULTIPLE"));
    shrink.appendChild(App.h("span", "", "  n=" + r.model.peer_n + " live peers  \u00b7  " + Math.round(r.model.shrink_weight * 100) + "% own / " + (100 - Math.round(r.model.shrink_weight * 100)) + "% field  \u00b7  raw " + r.model.peer_raw_multiple.toFixed(2) + "x" + (thin ? " (capped 1.5x)" : "") + " \u2192 " + r.model.launch_multiple.toFixed(2) + "x"));
    App.dbody.appendChild(shrink);

    var g = App.h("div", "grid2", "");
    g.appendChild(cell("tvl", RC.usd(r.tvl_usd)));
    g.appendChild(cell("7d tvl change", RC.pct(r.change_7d)));
    g.appendChild(cell("listed", r.listed_at || "not recorded"));
    g.appendChild(cell("tenure", r.age_days === null ? "assumed" : RC.age(r.age_days)));
    g.appendChild(cell("launch multiple", "raw " + r.model.peer_raw_multiple.toFixed(2) + "x \u2192 " + r.model.launch_multiple.toFixed(2) + "x"));
    g.appendChild(cell("category peers", r.model.peer_n + " live"));
    g.appendChild(cell("token odds", r.odds + "% of category peers"));
    g.appendChild(cell("implied / tvl", r.edge.toFixed(2) + "x"));
    g.appendChild(cell("valuation band", RC.usd(r.ci_low) + " \u2013 " + RC.usd(r.ci_high)));
    g.appendChild(cell("verdict", r.verdict + " \u00b7 " + r.verdict_why));
    App.dbody.appendChild(g);

    App.dbody.appendChild(section("risk checklist"));
    r.risk_flags.forEach(function (f) {
      var d = App.h("div", "flag " + f.status, "");
      var s = App.h("span", "s", f.status === "pass" ? "\u2713" : f.status === "warn" ? "!" : "\u2715");
      var txt = App.h("span", "d", "");
      txt.appendChild(App.h("b", "", f.label));
      txt.appendChild(App.h("span", "", " \u00b7 " + f.detail));
      d.appendChild(s);
      d.appendChild(txt);
      App.dbody.appendChild(d);
    });

    var planBudget = RC.fin(RC.st.guideBudget) && RC.st.guideBudget > 0 ? RC.st.guideBudget : RCPlan.defaultBudget(r);
    var planProfile = RC.st.guideRisk || "Balanced";
    App.dbody.appendChild(section("farm plan \u00b7 " + RC.usd(planBudget) + " \u00b7 " + planProfile));
    var planOl = document.createElement("ol");
    planOl.className = "plan";
    RCPlan.buildFarmPlan(r, planBudget, planProfile).forEach(function (s) {
      var li = document.createElement("li");
      li.textContent = s.text + "  " + s.cost + " / " + s.time;
      planOl.appendChild(li);
    });
    App.dbody.appendChild(planOl);

    App.dbody.appendChild(section("score breakdown"));
    var t = App.h("table", "sig", "");
    var tb = document.createElement("tbody");
    tb.appendChild(sig("alpha", String(r.score.alpha), "55%"));
    tb.appendChild(sig("relative inflow (z)", String(r.signals.relative_z), "35%"));
    tb.appendChild(sig("absolute inflow", RC.pct(r.signals.inflow_pct), "25%"));
    tb.appendChild(sig("scale", String(r.signals.scale), "15%"));
    tb.appendChild(sig("tenure", String(r.signals.tenure), "15%"));
    tb.appendChild(sig("chain breadth", String(r.signals.breadth), "10%"));
    tb.appendChild(sig("safety", String(r.score.safety), "45%"));
    tb.appendChild(sig("liquidity floor", String(r.signals.liquidity), "30%"));
    tb.appendChild(sig("seven-day drawdown", String(r.signals.drawdown), "25%"));
    tb.appendChild(sig("flow anomaly", String(r.signals.anomaly), "20%"));
    tb.appendChild(sig("listing provenance", String(r.signals.provenance), "15%"));
    tb.appendChild(sig("category risk", String(r.signals.category_risk), "10%"));
    t.appendChild(tb);
    App.dbody.appendChild(t);

    App.dbody.appendChild(section("act"));
    var wrap = App.h("div", "row2", "");
    var watchBtn = App.h("button", "btn mini", RC.st.watch.has(r.slug) ? "unwatch" : "watch");
    watchBtn.type = "button";
    watchBtn.addEventListener("click", function () {
      var on = RC.toggleWatch(r.slug);
      watchBtn.textContent = on ? "unwatch" : "watch";
      RC.notify(on ? "Watching " + r.name : "Removed " + r.name);
      App.render();
    });

    var lbl = App.h("span", "tag", "alert at");
    var input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "100";
    input.value = String(RC.alertOf(r.slug) === null ? 70 : RC.alertOf(r.slug));
    var arm = App.h("button", "btn mini", "arm");
    arm.type = "button";
    arm.addEventListener("click", function () {
      RC.setAlert(r.slug, Number(input.value));
      RC.notify("Alert armed at " + RC.alertOf(r.slug) + " for " + r.name);
      App.render();
    });

    wrap.appendChild(watchBtn);
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    wrap.appendChild(arm);
    App.dbody.appendChild(wrap);

    var links = App.h("div", "links", "");
    var a1 = App.h("a", "link", "DefiLlama page");
    a1.href = "https://defillama.com/protocol/" + encodeURIComponent(r.slug);
    a1.target = "_blank";
    a1.rel = "noopener noreferrer";
    var a2 = App.h("a", "link", "TVL chart");
    a2.href = "https://defillama.com/chart/protocol/" + encodeURIComponent(r.slug);
    a2.target = "_blank";
    a2.rel = "noopener noreferrer";
    var cp = App.h("button", "link", "copy id");
    cp.type = "button";
    cp.addEventListener("click", function () {
      App.copy(r.slug);
    });
    if (r.gecko_id) {
      var a3 = App.h("a", "link", "CoinGecko");
      a3.href = "https://www.coingecko.com/en/coins/" + encodeURIComponent(r.gecko_id);
      a3.target = "_blank";
      a3.rel = "noopener noreferrer";
      links.appendChild(a3);
    }
    links.appendChild(a1);
    links.appendChild(a2);
    links.appendChild(cp);
    App.dbody.appendChild(links);

    App.drawer.classList.add("open");
    App.drawer.setAttribute("aria-hidden", "false");
    App.scrim.hidden = false;
    document.documentElement.style.overflow = "hidden";
    if (App.dclose) App.dclose.focus();
  };

  App.closeDrawer = function () {
    App.drawer.classList.remove("open");
    App.drawer.setAttribute("aria-hidden", "true");
    App.scrim.hidden = true;
    document.documentElement.style.overflow = "";
    App.openSlug = null;
    if (App.lastFocus && App.lastFocus.focus) App.lastFocus.focus();
    App.render();
  };

  App.copy = function (text) {
    var done = function () { RC.notify("Copied " + text); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
    } else {
      fallback(text, done);
    }
  };

  function fallback(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  App.onEscape = function (ev) {
    if (ev.key === "Escape" && App.openSlug) {
      ev.preventDefault();
      App.closeDrawer();
    }
  };
})();
