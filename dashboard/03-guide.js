/* TOKEN RADAR / 03-guide.js - the Farm Guide page. Reads RCPlan and RC.data only. */
(function () {
  "use strict";

  var App = window.App;
  var RC = window.RC;
  var D = RC.data;
  var built = false;

  function h(tag, cls, text) { return App.h(tag, cls || "", text === undefined ? "" : text); }
  function usd(x) { return RC.usd(x); }

  function build() {
    var root = App.byId("guide");
    if (!root) return;
    App.clear(root);

    var sum = h("div", "gsum", "");
    sum.id = "gsum";

    var head = h("div", "phead", "");
    var title = h("div", "ptitle", "");
    title.appendChild(h("span", "kicker", "FARM GUIDE / PORTFOLIO"));
    title.appendChild(h("h2", "", "Fund the record, not the promise."));
    title.appendChild(h("p", "hint", "Size every pre-token position from the same ledger the board uses: TVL, 7d flow, tenure, category peers. One rule for every protocol, no favourite."));
    head.appendChild(title);
    head.appendChild(sum);
    root.appendChild(head);

    var controls = h("div", "gcontrols", "");
    var bctl = h("div", "gctl", "");
    bctl.appendChild(h("span", "tag", "BUDGET USD / PRESET OR TYPE"));
    var presets = h("div", "presets", "");
    presets.id = "gpresets";
    [[1000, "1,000"], [5000, "5,000"], [25000, "25,000"], [100000, "100,000"]].forEach(function (p) {
      var b = h("button", "", p[1]);
      b.type = "button";
      b.setAttribute("data-b", String(p[0]));
      if (p[0] === 25000) b.className = "on";
      presets.appendChild(b);
    });
    var num = document.createElement("input");
    num.type = "number";
    num.id = "gbudget";
    num.min = "1000";
    num.max = "1000000";
    num.step = "500";
    num.value = "25000";
    num.inputMode = "numeric";
    bctl.appendChild(presets);
    bctl.appendChild(num);
    controls.appendChild(bctl);

    var rctl = h("div", "gctl", "");
    rctl.appendChild(h("span", "tag", "RISK PROFILE / ALLOCATION RULE"));
    var seg = h("div", "seg gseg", "");
    ["Conservative", "Balanced", "Degen"].forEach(function (name) {
      var b = h("button", name === "Balanced" ? "on" : "", name);
      b.type = "button";
      b.setAttribute("data-r", name);
      seg.appendChild(b);
    });
    rctl.appendChild(seg);
    rctl.appendChild(h("p", "hint", "cap, clips and the drawdown that kills the position move with this switch."));
    controls.appendChild(rctl);
    root.appendChild(controls);

    var stats = h("div", "gstats", "");
    stats.id = "gstats";
    root.appendChild(stats);

    var tableWrap = h("div", "gtablewrap", "");
    tableWrap.appendChild(h("div", "gcap", "PRIORITY QUEUE / FARMABLE ROWS"));
    var table = h("table", "gtable", "");
    var thead = document.createElement("thead");
    var htr = document.createElement("tr");
    ["#", "protocol", "radar", "odds", "verdict", "allocation", "why", "main risk", ""].forEach(function (label) {
      htr.appendChild(h("th", "", label));
    });
    thead.appendChild(htr);
    var tbody = document.createElement("tbody");
    tbody.id = "gbody";
    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    var play = h("aside", "gplay", "");
    play.id = "gplay";
    var wrap = h("div", "gwrap", "");
    wrap.appendChild(tableWrap);
    wrap.appendChild(play);
    root.appendChild(wrap);

    var foot = h("div", "gfoot", "");
    foot.id = "gfoot";
    var checks = h("div", "checkgrid", "");
    [
      ["Anti-sybil", "one wallet per human; no funded-fresh-wallet rings; keep the source of funds legible."],
      ["Liquidity / contract", "read the withdrawal queue, the largest LP token holders and the admin key before sizing; cap at what you can exit in one day."],
      ["Snapshot monitor", "the docs page and the protocol's own announcement are the only sources; never a DM, a comment or a lookalike domain."],
      ["Tax and records", "the deposit tx is the cost basis; the claim tx is income; keep both, and date the screenshot."]
    ].forEach(function (it) {
      var d = h("div", "check", "");
      d.appendChild(h("b", "", it[0]));
      d.appendChild(h("span", "", it[1]));
      checks.appendChild(d);
    });
    foot.appendChild(checks);
    tableWrap.appendChild(foot);

    presets.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-b]");
      if (!b) return;
      RC.st.guideBudget = Number(b.getAttribute("data-b"));
      App.renderGuide();
    });
    seg.addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-r]");
      if (!b) return;
      RC.st.guideRisk = b.getAttribute("data-r");
      App.renderGuide();
    });
    num.addEventListener("input", function () {
      var v = Number(this.value);
      if (RC.fin(v) && v >= 1000) RC.st.guideBudget = Math.round(v / 500) * 500;
      App.renderGuide();
    });
    built = true;
    update();
  }

  function update() {
    var root = App.byId("guide");
    if (!root || !built) return;
    var budget = RC.st.guideBudget || 25000;
    var risk = RC.st.guideRisk || "Balanced";
    var alloc = RCPlan.lastAlloc = RCPlan.allocate(D.rows, budget, risk);
    if (!RC.st.guideOpen && alloc.rows.length) RC.st.guideOpen = alloc.rows[0].row.slug;
    var active = null;
    for (var i = 0; i < alloc.rows.length; i++) {
      if (alloc.rows[i].row.slug === RC.st.guideOpen) active = alloc.rows[i];
    }
    if (!active && alloc.rows.length) active = alloc.rows[0];

    var num = App.byId("gbudget");
    if (num && document.activeElement !== num) num.value = String(alloc.budget);
    var presets = root.querySelectorAll("#gpresets button");
    for (var p = 0; p < presets.length; p++) {
      presets[p].className = Number(presets[p].getAttribute("data-b")) === alloc.budget ? "on" : "";
    }
    var risks = root.querySelectorAll(".gseg button");
    for (var r = 0; r < risks.length; r++) {
      risks[r].className = risks[r].getAttribute("data-r") === alloc.profile ? "on" : "";
    }

    var sum = App.byId("gsum");
    App.clear(sum);
    var undeployed = Math.max(0, alloc.budget - alloc.deployed);
    [
      ["deployed", usd(alloc.deployed), alloc.deployed / alloc.budget],
      ["gas band", "$" + alloc.gasLow + "-$" + alloc.gasHigh, 0.18],
      ["positions", String(alloc.rows.length), alloc.rows.length / 8],
      ["undeployed", usd(undeployed), undeployed / alloc.budget]
    ].forEach(function (b) {
      var c = h("div", "gcell", "");
      c.appendChild(h("div", "k", b[0]));
      c.appendChild(h("div", "v", b[1]));
      var bar = h("i", "gbar", "");
      bar.style.width = Math.max(0, Math.min(100, b[2] * 100)) + "%";
      c.appendChild(bar);
      sum.appendChild(c);
    });

    var stats = App.byId("gstats");
    App.clear(stats);
    RCPlan.schedule(alloc.rows).forEach(function (w) {
      var line = h("div", "gweek", "");
      line.appendChild(h("b", "", w.week + " / " + w.chain));
      line.appendChild(document.createTextNode("  " + usd(w.usd) + "  " + w.names.slice(0, 3).join("  ·  ")));
      stats.appendChild(line);
    });

    var gb = App.byId("gbody");
    if (!gb) return;
    App.clear(gb);
    alloc.rows.slice(0, 14).forEach(function (x, i) {
      var row = x.row;
      var tr = h("tr", active && active.row.slug === row.slug ? "sel" : "", "");
      tr.appendChild(h("td", "rk n", i + 1));
      var nm = h("td", "pl", "");
      nm.appendChild(h("span", "name", row.name));
      nm.appendChild(h("span", "slug", row.slug + " · " + ((row.chains && row.chains[0]) || "-")));
      tr.appendChild(nm);
      tr.appendChild(h("td", "n", row.score.total));
      tr.appendChild(h("td", "n", row.odds + "%"));
      var v = h("td", "", "");
      v.appendChild(h("span", "verdict " + String(row.verdict).toLowerCase(), row.verdict));
      tr.appendChild(v);
      tr.appendChild(h("td", "n strong", usd(x.allocation)));
      tr.appendChild(h("td", "why", RCPlan.whyFor(row)));
      tr.appendChild(h("td", "risk", RCPlan.riskFor(row)));
      var td = h("td", "", "");
      var btn = h("button", "btn mini", "10-step");
      btn.type = "button";
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        RC.st.guideOpen = row.slug;
        App.renderGuide();
      });
      td.appendChild(btn);
      tr.appendChild(td);
      tr.addEventListener("click", function () {
        RC.st.guideOpen = row.slug;
        App.renderGuide();
      });
      gb.appendChild(tr);
    });

    var gp = App.byId("gplay");
    App.clear(gp);
    if (!active) return;
    var head2 = h("div", "gplayhead", "");
    head2.appendChild(h("span", "kicker", "FULL 10-STEP PLAYBOOK / " + active.row.verdict));
    head2.appendChild(h("h3", "", active.row.name));
    head2.appendChild(h("p", "hint", active.row.slug + " · " + (active.row.category || "uncategorised") + " · " + (active.row.chains || []).slice(0, 3).join(", ") + " · allocation " + usd(active.allocation) + " of " + usd(alloc.budget)));
    gp.appendChild(head2);
    var ol = h("ol", "plan", "");
    RCPlan.buildFarmPlan(active.row, active.allocation, alloc.profile).forEach(function (step) {
      var li = h("li", "", step.text);
      li.appendChild(h("span", "stepmeta", "  " + step.cost + "  /  " + step.time));
      ol.appendChild(li);
    });
    gp.appendChild(ol);
    gp.appendChild(h("p", "hint", "Every step is re-priced from this row, this allocation and this risk profile. " + RCPlan.riskFor(active.row) + "."));
  }

  App.renderGuide = function () {
    if (!built) build();
    else update();
  };
})();
