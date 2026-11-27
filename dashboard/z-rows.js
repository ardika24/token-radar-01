(function () {
  "use strict";

  var App = window.App;
  var RC = window.RC;
  var D = RC.data;

  function td(cls, text) { return App.h("td", cls, text); }

  App.starCell = function (r) {
    var cell = App.h("td", "");
    var b = App.h("button", RC.st.watch.has(r.slug) ? "star on" : "star", "\u2605");
    b.type = "button";
    b.setAttribute("aria-pressed", RC.st.watch.has(r.slug) ? "true" : "false");
    b.setAttribute("aria-label", "Toggle watchlist for " + r.name);
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var on = RC.toggleWatch(r.slug);
      b.className = on ? "star on" : "star";
      b.setAttribute("aria-pressed", on ? "true" : "false");
      RC.notify(on ? "Watching " + r.name : "Removed " + r.name);
      App.render();
    });
    cell.appendChild(b);
    return cell;
  };

  App.boardRow = function (r) {
    var tr = App.h("tr", "");
    tr.dataset.slug = r.slug;
    tr.tabIndex = 0;
    if (App.openSlug === r.slug) tr.className = "sel";

    tr.appendChild(td("rk n", r.rank));

    var nm = App.h("td", "pl");
    var top = App.h("div", "nmrow");
    top.appendChild(App.starCell(r).firstChild);
    var nmText = App.h("span", "name", r.name);
    top.appendChild(nmText);
    nm.appendChild(top);
    nm.appendChild(App.h("span", "slug", r.slug));
    tr.appendChild(nm);

    var ch = App.h("td", "col-cat");
    ch.appendChild(App.h("span", "pill", r.chains[0] || "-"));
    if (r.chains.length > 1) ch.appendChild(App.h("span", "pill", "+" + (r.chains.length - 1)));
    tr.appendChild(ch);

    var ct = App.h("td", "col-cat");
    ct.appendChild(App.h("span", "pill cat", r.category || "uncategorised"));
    tr.appendChild(ct);

    tr.appendChild(td("n col-tvl", RC.usd(r.tvl_usd)));

    var chg = td("n col-chg", RC.pct(r.change_7d));
    chg.className += RC.fin(r.change_7d) ? (r.change_7d > 0 ? " up" : r.change_7d < 0 ? " down" : " flat") : " flat";
    tr.appendChild(chg);

    tr.appendChild(td("n col-age", RC.age(r.age_days)));
    tr.appendChild(td("n col-alpha", RC.int(r.score.alpha)));
    tr.appendChild(td("n col-safe", RC.int(r.score.safety)));

    var sc = App.h("td", "n col-score", "");
    var box = App.h("div", "sc", "");
    var bar = App.h("div", "bar", "");
    var fill = document.createElement("i");
    fill.style.width = Math.max(0, Math.min(100, r.score.total)) + "%";
    if (r.score.total < 45) fill.className = "bad";
    else if (r.score.total < 65) fill.className = "low";
    bar.appendChild(fill);
    box.appendChild(bar);
    var num = App.h("span", "", r.score.total);
    var alertAt = RC.alertOf(r.slug);
    if (alertAt !== null && r.score.total >= alertAt) {
      var al = App.h("span", "alert", "\u25b2");
      al.title = "At or above your alert of " + alertAt;
      num.appendChild(al);
    }
    box.appendChild(num);
    sc.appendChild(box);
    tr.appendChild(sc);
    tr.appendChild(td("n col-odds", r.odds + "%"));
    tr.appendChild(td("n col-edge", r.edge.toFixed(2) + "x"));

    tr.appendChild(td("n strong", RC.usd(r.implied_value_usd)));

    tr.addEventListener("click", function () { App.openDrawer(r.slug); });
    tr.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); App.openDrawer(r.slug); }
    });
    return tr;
  };

  App.liveRow = function (r, i) {
    var tr = App.h("tr", "live");
    tr.appendChild(td("rk n", i + 1));
    var nm = App.h("td", "pl");
    nm.appendChild(App.h("span", "name", r.name));
    nm.appendChild(App.h("span", "slug", r.slug));
    tr.appendChild(nm);
    var ch = App.h("td", "col-cat");
    ch.appendChild(App.h("span", "pill", r.chains[0] || "-"));
    if (r.chains.length > 1) ch.appendChild(App.h("span", "pill", "+" + (r.chains.length - 1)));
    tr.appendChild(ch);
    var ct = App.h("td", "col-cat");
    ct.appendChild(App.h("span", "pill cat", r.category || "uncategorised"));
    tr.appendChild(ct);
    tr.appendChild(td("n col-tvl", RC.usd(r.tvl_usd)));
    var chg = td("n col-chg", RC.pct(r.change_7d));
    chg.className += RC.fin(r.change_7d) ? (r.change_7d > 0 ? " up" : r.change_7d < 0 ? " down" : " flat") : " flat";
    tr.appendChild(chg);
    tr.appendChild(td("n col-age", "traded"));
    tr.appendChild(td("n col-alpha", "-"));
    tr.appendChild(td("n col-safe", "-"));
    tr.appendChild(td("n col-score", "-"));
    tr.appendChild(td("n col-odds", "-"));
    tr.appendChild(td("n col-edge", "-"));
    tr.appendChild(td("n strong", RC.usd(r.mcap_usd)));
    return tr;
  };
})();
