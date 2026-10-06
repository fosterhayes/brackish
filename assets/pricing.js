// Shared pricing math for proposal pages (browser) and the deposit checkout (server).
// Works in both: attaches to window in the browser, exports in Node.
(function (root) {
  function priceFor(catalog, proposal, id) {
    var item = catalog.items[id];
    if (!item) return null;
    var override = null;
    (proposal.package || []).concat(proposal.addons || []).forEach(function (p) {
      if (p.id === id && typeof p.price === "number") override = p.price;
    });
    return {
      id: id,
      name: item.name,
      summary: item.summary,
      billing: item.billing,
      price: override !== null ? override : item.price
    };
  }

  // selected: array of item ids. Only ids offered in this proposal are counted.
  function quote(catalog, proposal, selected) {
    var offered = {};
    (proposal.package || []).forEach(function (p) { offered[p.id] = true; });
    (proposal.addons || []).forEach(function (p) { offered[p.id] = true; });
    (proposal.package || []).forEach(function (p) { if (p.locked) selected = selected.concat([p.id]); });

    var seen = {}, lines = [], monthly = [];
    selected.forEach(function (id) {
      if (seen[id] || !offered[id] || !catalog.items[id]) return;
      seen[id] = true;
      var line = priceFor(catalog, proposal, id);
      if (line.billing === "monthly") monthly.push(line); else lines.push(line);
    });

    var has = function (ids) { return ids.some(function (i) { return seen[i]; }); };
    Object.keys(catalog.fees || {}).forEach(function (k) {
      var f = catalog.fees[k];
      if (has(f.appliesWhenAny) && !has(f.waivedWhenAny || [])) {
        lines.push({ id: k, name: f.name, price: f.price, billing: "once" });
      }
    });
    (catalog.bundles || []).forEach(function (b) {
      if (b.requires.every(function (i) { return seen[i]; })) {
        lines.push({ id: "bundle", name: b.name, price: -b.discount, billing: "once" });
      }
    });

    // Optional per-proposal discount, e.g. {"name": "Founding partner discount", "percent": 50, "items": ["website-standard"]}
    var d = proposal.discount;
    if (d && d.percent > 0) {
      var base = lines.reduce(function (s, l) { return s + ((!d.items || d.items.indexOf(l.id) > -1) && l.price > 0 ? l.price : 0); }, 0);
      var off = Math.round(base * d.percent) / 100;
      if (off > 0) lines.push({ id: "discount", name: (d.name || "Discount") + " (" + d.percent + "% off)", price: -off, billing: "once", discount: true });
    }
    var once = lines.reduce(function (s, l) { return s + l.price; }, 0);
    var perMonth = monthly.reduce(function (s, l) { return s + l.price; }, 0);
    var deposit = Math.round(once * (catalog.depositRate || 0.5) * 100) / 100;
    var savings = lines.reduce(function (s, l) { return s + (l.discount ? -l.price : 0); }, 0);
    return { lines: lines, monthly: monthly, once: once, savings: savings, perMonth: perMonth, deposit: deposit, items: Object.keys(seen) };
  }

  var api = { quote: quote };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BrackishPricing = api;
})(this);
