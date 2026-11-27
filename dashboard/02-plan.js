/* TOKEN RADAR / 00-plan.js
 * The farm-plan generator the drawer and the Farm Guide both call.
 * Every sentence comes from this row: chains, TVL tier, 7d move, age,
 * score, odds and verdict. No per-protocol copy is stored anywhere.
 * Pure math/string only: no fetch, no DOM, no clock.
 */
(function (root) {
  "use strict";

  var M = root.RCModel;
  if (!M) throw new Error("00-plan.js needs 00-model.js first");

  var VENUE_EXCLUDE = { coinbase: 1, bybit: 1, kraken: 1, bitget: 1, okx: 1, bitfinex: 1, gemini: 1 };

  function chainLabel(c) {
    var t = String(c || "").trim();
    return t.toLowerCase() === "binance" ? "BNB Chain" : t;
  }

  function venues(row) {
    var out = [];
    (row.chains || []).forEach(function (c) {
      var label = chainLabel(c);
      if (!label) return;
      if (VENUE_EXCLUDE[label.trim().toLowerCase()]) return;
      if (out.indexOf(label) < 0) out.push(label);
    });
    return out;
  }

  function tierOf(tvl) {
    if (tvl >= 1e9) return "whale";
    if (tvl >= 1e8) return "mid";
    return "early";
  }

  function tierText(tvl) {
    if (tvl >= 1e9) return "whale tier, above $1B TVL, so one clip is already a market event";
    if (tvl >= 1e8) return "mid tier, $100M-$1B TVL, so a $250 clip is under 0.1% of the pool";
    return "early tier, under $100M TVL, so a $250 exit can move the pool more than the token";
  }

  function momentumOf(row) {
    var c = M.fin(row.change_7d) ? row.change_7d : 0;
    if (c >= 5) return "inflow";
    if (c <= -5) return "drawdown";
    return "flat";
  }

  function momentumText(row) {
    var c = M.fin(row.change_7d) ? row.change_7d : 0;
    if (c >= 5) return "7d TVL +" + c.toFixed(1) + "%, an inflow tape: front-load the first clip and add only if TVL holds";
    if (c <= -5) return "7d TVL " + c.toFixed(1) + "%, capital is leaving: wait for two flat days before the first clip";
    return "7d TVL " + (c >= 0 ? "+" : "") + c.toFixed(1) + "%, a flat tape: split the budget and do not chase";
  }

  function ageText(row) {
    var a = row.age_days;
    if (!M.fin(a)) return "no listing date: tenure is assumed at 540 days, so the snapshot urgency is a guess, not a fact";
    if (a < 90) return "listed " + Math.round(a) + " days ago: fresh listing, so a TGE window can be 30-90 days and the hold is 60 days";
    if (a < 365) return "listed " + Math.round(a) + " days ago: young protocol, so the TGE window is 90-180 days and the hold is 45 days";
    return "listed " + Math.round(a) + " days ago: mature protocol, so a points season is likelier than an imminent TGE and the hold is 30 days";
  }

  function capitalFor(tvl) {
    if (tvl >= 5e9) return 250;
    if (tvl >= 1e9) return 150;
    if (tvl >= 1e8) return 100;
    return 50;
  }

  function holdDaysFor(age) {
    if (!M.fin(age)) return 30;
    if (age < 90) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function defaultBudget(row) {
    return capitalFor(row.tvl_usd);
  }

  function gasFor(row) {
    var c = String(((row.chains || [])[0]) || "").toLowerCase();
    if (c === "ethereum") return 9;
    if (c === "solana") return 2;
    if (c === "base" || c === "arbitrum" || c === "optimism") return 2;
    if (c === "binance") return 1;
    if (c === "monad" || c === "plasma" || c === "katana") return 3;
    return 4;
  }

  function profileOf(profile) {
    var p = String(profile || "Balanced").toLowerCase();
    if (p.indexOf("conserv") === 0 || p === "low") return { name: "Conservative", tranches: 3, holdAdd: 15, cap: 0.12, drop: 15 };
    if (p.indexOf("degen") === 0 || p === "high") return { name: "Degen", tranches: 1, holdAdd: -7, cap: 0.4, drop: 30 };
    return { name: "Balanced", tranches: 2, holdAdd: 0, cap: 0.25, drop: 20 };
  }

  function actionFor(row, budget, chain) {
    var c = String(row.category || "").toLowerCase();
    var name = row.name;
    if (c.indexOf("lend") >= 0 || c.indexOf("cdp") >= 0) {
      return "Supply $" + budget + " USDC to " + name + "'s " + chain + " market and keep the receipt token in the same wallet.";
    }
    if (c.indexOf("dex") >= 0 || c.indexOf("yield") >= 0 || c.indexOf("farm") >= 0) {
      return "Provide $" + budget + " of USDC liquidity to the deepest " + name + " pool on " + chain + " and stake the LP receipt if the app offers it.";
    }
    if (c.indexOf("bridge") >= 0) {
      return "Bridge $" + budget + " USDC through " + name + " into " + chain + ", then use the bridged balance inside the same app.";
    }
    if (c.indexOf("staking") >= 0 || c.indexOf("restak") >= 0) {
      return "Stake $" + budget + " of " + chain + "'s staking asset through " + name + " and hold the receipt token, not the underlying.";
    }
    if (c.indexOf("perpetual") >= 0 || c.indexOf("derivative") >= 0) {
      return "Deposit $" + budget + " USDC as margin on " + name + "'s " + chain + " market and open one small hedge, not a direction bet.";
    }
    if (c.indexOf("prediction") >= 0) {
      return "Fund $" + budget + " and place one position on a market " + name + " lists on " + chain + ", then leave the rest in cash.";
    }
    if (c.indexOf("curator") >= 0 || c.indexOf("allocator") >= 0) {
      return "Deposit $" + budget + " into a " + name + " vault on " + chain + " and keep the share token; the vault is the position.";
    }
    if (c.indexOf("stable") >= 0) {
      return "Mint or deposit $" + budget + " of the stable asset through " + name + " on " + chain + " and keep the residual under 5%.";
    }
    if (c.indexOf("rwa") >= 0) {
      return "Mint $" + budget + " of " + name + "'s yield asset on " + chain + " and hold the receipt; do not chase the secondary price.";
    }
    if (c.indexOf("insurance") >= 0) {
      return "Buy $" + budget + " of cover from " + name + " on " + chain + " and keep the policy beside the position.";
    }
    return "Deposit $" + budget + " of USDC into " + name + " on " + chain + " and keep the position open through the snapshot.";
  }

  function buildFarmPlan(row, budgetUsd, riskProfile) {
    var prof = profileOf(riskProfile);
    var budget = M.fin(budgetUsd) && budgetUsd > 0 ? Math.round(budgetUsd) : defaultBudget(row);
    var list = venues(row);
    var primary = list[0] || "its main chain";
    var secondary = list[1] || null;
    var tier = tierText(row.tvl_usd);
    var mom = momentumText(row);
    var age = ageText(row);
    var hold = holdDaysFor(row.age_days) + prof.holdAdd;
    var gas = gasFor(row);
    var gasBudget = gas + (secondary ? gas + 1 : 0) + 2;
    var score = M.fin(row.score && row.score.total) ? row.score.total : 0;
    var odds = M.fin(row.odds) ? row.odds : 0;
    var edge = row.tvl_usd > 0 ? row.implied_value_usd / row.tvl_usd : 0;
    var thin = row.model && row.model.peer_n === 1;
    var thinOwn = row.model && M.fin(row.model.shrink_weight) ? Math.round(row.model.shrink_weight * 100) : 11;
    var first = Math.max(20, Math.round((budget * 0.5) / 10) * 10);
    if (first > budget) first = budget;
    var second = Math.max(0, Math.round((budget * 0.25) / 10) * 10);
    var third = Math.max(0, budget - first - second);
    var monitor = Math.round(row.tvl_usd * 0.8);
    var risk = row.verdict === "FARM" ? "sized as a farm, not as a conviction trade" : row.verdict === "WATCH" ? "paper-farm only until a dated program prints" : "skip the capital; keep the row on a watch note";
    var steps = [];
    function add(text, cost, time) { steps.push({ text: text, cost: cost, time: time }); }

    add(
      "Verdict and size: " + row.verdict + " on " + row.name + " (" + (row.category || "uncategorised") + ", " + primary + "). Radar " + score + "/100, " + odds + "% of category peers trade a token, implied " + edge.toFixed(2) + "x TVL, " + tier + ". Budget $" + budget + " is " + risk + ".",
      "free.", "5 min."
    );

    add(
      "Fund the venue: " + (primary === "Solana" ? "load a Phantom or Backpack wallet with SOL and USDC; do not bridge an EVM wallet just for this" : primary === "Ethereum" ? "move USDC to the Ethereum wallet and keep at least $" + Math.max(12, gasBudget) + " for gas, because one approval can cost more than the first week" : primary === "Base" || primary === "Arbitrum" || primary === "Optimism" ? "bridge USDC to " + primary + " with its official bridge and keep at least $" + Math.max(4, gasBudget) + " for gas; L2 gas is cents, so do not over-bridge" : primary.indexOf("BNB") >= 0 ? "fund the BNB Chain wallet with USDC and BNB; this is the chain, not a Binance exchange account" : "use the official bridge for " + primary + " and keep at least $" + Math.max(4, gasBudget) + " for gas") + ". Two legs are budgeted at $" + gasBudget + ".",
      "$" + gasBudget + " gas.", "10-25 min."
    );

    add(
      "Entry schedule: " + mom + ". " + (mom === "inflow" ? "Send the first $" + first + " clip now; keep the rest for a 7-day add only if TVL is still above $" + Math.round(row.tvl_usd / 1e6) + "M." : mom === "drawdown" ? "Do not send the first clip today; wait for two flat days, then send $" + Math.max(20, Math.round(first / 3)) + " and add in thirds." : "Send the first $" + Math.max(20, Math.round(first / 2)) + " clip now, then the balance in two 7-day clips; a flat tape is a patience trade, not a market-order trade.") + (secondary ? " The secondary leg is " + secondary + ", not a second bridge into the same chain." : ""),
      "$" + Math.max(1, gas) + " gas per clip.", "15 min over " + (prof.tranches === 1 ? "1 day" : prof.tranches === 2 ? "7 days" : "14 days") + "."
    );

    add(
      "Open the position: " + actionFor(row, first, primary) + " Approve only this clip, never an unlimited allowance.",
      "$" + first + " + ~$" + gas + " gas.", "5-10 min."
    );

    add(
      "Add the second clip: " + (mom === "drawdown" ? "if TVL has stopped falling, send $" + second + " into the same position" : "send $" + second + " into the same position after the 7-day check") + ". " +
        (secondary ? "Only if the primary is clean, repeat on " + secondary + " with the same protocol." : "Keep it on " + primary + "; do not open a second chain just to look busy.") +
        " Cap this leg at 40% of the first position.",
      "$" + second + " + ~$" + (gas + 1) + " gas.", "10 min."
    );

    add(
      "Complete the tranche: send the last $" + third + " only after a second flat-to-green TVL week. " + (thin ? "This category has one live peer, so the multiple is " + (100 - thinOwn) + "% field prior; do not let it pull you into over-sizing." : "If the flow stalls, leave the last clip in cash."),
      "$" + third + " + ~$" + gas + " gas.", "10 min."
    );

    add(
      "Hold and watch the snapshot: " + age + " Keep the position open " + hold + " days and re-read the protocol's own docs every 7 days for a points deadline or a snapshot block. " + (thin ? "Watch the first live peer in " + (row.category || "this category") + ": if it prints a price, re-run the multiple; the rank is a hypothesis until then." : "If a dated program prints, shorten the review to its date."),
      "opportunity cost only.", hold + " days."
    );

    add(
      "Kill rule: if TVL falls through $" + monitor + " (about " + prof.drop + "% below entry), or no dated program is announced within 90 days, unwind. " + (secondary ? "Exit the secondary leg first if it is the thinner of the two." : "Exit the single leg in one transaction; splitting a thin exit makes it thinner.") + " Do not average down a protocol whose flow is leaving.",
      "~$" + (gas + 2) + " gas to unwind.", "15 min."
    );

    add(
      "Claim: claim only from the protocol's official site reached through its docs page, never from a DM or a comment. Check the contract address twice, claim in one transaction, and keep the claim receipt.",
      "claim gas usually <$" + (gas + 8) + ".", "20 min."
    );

    add(
      "Evidence: record the deposit tx, the receipt or position id, a dated screenshot, the claim tx, and this plan's budget; keep them out of the repository you hand in.",
      "free, one file per action.", "10 min."
    );
    return steps;
  }

  function stepText(step) {
    var s = String(step.text || "").trim();
    if (s && "!.?".indexOf(s.charAt(s.length - 1)) < 0) s += ".";
    s += " Cost: " + String(step.cost || "free").trim() + " Time: " + String(step.time || "5 min").trim();
    if (s.length > 600) s = s.slice(0, 596) + "...";
    if (s.length < 20) s += " Check the protocol's own page before you act.";
    return s;
  }

  function whyFor(row) {
    var bits = ["radar " + row.score.total];
    bits.push((row.implied_value_usd / row.tvl_usd).toFixed(2) + "x TVL");
    bits.push(row.odds + "% peer token rate");
    if (row.model && row.model.peer_n === 1) bits.push("one live peer, " + Math.round((1 - (row.model.shrink_weight || 0.111)) * 100) + "% field prior");
    else if (row.model) bits.push(row.model.peer_n + " live peers");
    return bits.join("; ");
  }

  function riskFor(row) {
    var bad = (row.risk_flags || []).filter(function (f) { return f.status === "fail"; });
    var warn = (row.risk_flags || []).filter(function (f) { return f.status === "warn"; });
    var list = bad.concat(warn).slice(0, 3).map(function (f) { return f.label; });
    return list.length ? list.join(", ") : "no red flag on the snapshot's checklist";
  }

  function allocate(rows, budget, riskProfile) {
    var prof = profileOf(riskProfile);
    var b = M.fin(budget) && budget > 0 ? Math.max(1000, budget) : 25000;
    var pool = rows.filter(function (r) { return r.verdict === "FARM"; });
    if (pool.length < 5) {
      var extra = rows.filter(function (r) { return r.verdict === "WATCH"; }).sort(function (p, q) { return q.score.total - p.score.total; }).slice(0, 5 - pool.length);
      pool = pool.concat(extra);
    }
    if (!pool.length) pool = rows.slice().sort(function (p, q) { return q.score.total - p.score.total; }).slice(0, 5);
    var weighted = pool.map(function (r) {
      var w = prof.name === "Conservative" ? r.score.total * 0.5 + r.score.safety * 0.35 + r.odds * 0.15
        : prof.name === "Degen" ? r.score.total * 0.55 + r.score.alpha * 0.2 + r.odds * 0.25
          : r.score.total * 0.6 + r.score.safety * 0.2 + r.odds * 0.2;
      return { row: r, weight: Math.max(1, w) };
    });
    var total = weighted.reduce(function (a, x) { return a + x.weight; }, 0);
    var cap = b * prof.cap;
    var out = weighted.map(function (x) {
      var allocation = Math.min(cap, (b * x.weight) / total);
      allocation = Math.max(50, Math.round(allocation / 50) * 50);
      return { row: x.row, share: x.weight / total, allocation: allocation, gas: gasFor(x.row) + 1 };
    }).sort(function (p, q) { return q.allocation - p.allocation || q.row.score.total - p.row.score.total; });
    var spent = out.reduce(function (a, x) { return a + x.allocation; }, 0);
    if (spent > b) {
      var scale = b / spent;
      out.forEach(function (x) { x.allocation = Math.max(50, Math.round((x.allocation * scale) / 50) * 50); });
    }
    return {
      budget: b,
      profile: prof.name,
      rows: out,
      deployed: out.reduce(function (a, x) { return a + x.allocation; }, 0),
      gasLow: out.reduce(function (a, x) { return a + x.gas; }, 0),
      gasHigh: out.reduce(function (a, x) { return a + x.gas * 2; }, 0)
    };
  }

  function schedule(rows) {
    var by = {};
    rows.forEach(function (x) {
      var list = venues(x.row);
      var c = list[0] || "its main chain";
      if (!by[c]) by[c] = { chain: c, usd: 0, names: [] };
      by[c].usd += x.allocation;
      by[c].names.push(x.row.name + " $" + x.allocation);
    });
    var chains = Object.keys(by).sort(function (a, b) { return by[b].usd - by[a].usd; });
    return chains.map(function (c, i) {
      return { week: "Week " + (i < 3 ? i + 1 : "4+"), chain: c, usd: by[c].usd, names: by[c].names };
    });
  }

  var api = {
    VENUE_EXCLUDE: VENUE_EXCLUDE,
    chainLabel: chainLabel,
    venues: venues,
    tierOf: tierOf,
    tierText: tierText,
    capitalFor: capitalFor,
    defaultBudget: defaultBudget,
    holdDaysFor: holdDaysFor,
    gasFor: gasFor,
    profileOf: profileOf,
    momentumOf: momentumOf,
    momentumText: momentumText,
    ageText: ageText,
    buildFarmPlan: buildFarmPlan,
    stepText: stepText,
    whyFor: whyFor,
    riskFor: riskFor,
    allocate: allocate,
    schedule: schedule
  };
  root.RCPlan = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
