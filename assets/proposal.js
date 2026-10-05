(function () {
  var FORM_ENDPOINT = "https://formspree.io/f/mbgdrejr";
  var slug = (location.pathname.match(/\/p\/([a-z0-9-]+)/) || [])[1];
  var params = new URLSearchParams(location.search);
  var catalog = null, proposal = null, current = null, selected = {};
  var accepted = false;

  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) {
    var neg = n < 0; n = Math.abs(n);
    var s = "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
    return neg ? "−" + s : s;
  };
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem("brk-" + slug + "-" + k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem("brk-" + slug + "-" + k, JSON.stringify(v)); } catch (e) {} }
  };
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function fail() {
    $("p-headline").textContent = "Proposal not found";
    $("p-intro").textContent = "";
    $("p-error").hidden = false;
    document.querySelectorAll(".p-step, .p-steps").forEach(function (s) { s.hidden = true; });
  }

  if (!slug) return fail();

  Promise.all([
    fetch("/data/prices.json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    fetch("/p/data/" + slug + ".json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
  ]).then(function (res) {
    catalog = res[0]; proposal = res[1];
    render();
  }).catch(fail);

  function render() {
    document.title = "Proposal for " + proposal.org + " | Brackish";
    $("p-for").textContent = "Proposal for " + proposal.org;
    $("p-headline").textContent = proposal.headline;
    $("p-intro").textContent = proposal.intro;
    $("p-meta").textContent = "Prepared by Foster Hayes on " + proposal.preparedOn + " · Valid until " + proposal.validUntil;
    $("a-org").textContent = proposal.org;

    proposal.working.forEach(function (w) { $("p-working").appendChild(el("li", {}, w)); });
    proposal.findings.forEach(function (f) {
      var li = el("li");
      li.appendChild(el("b", {}, f.title + " "));
      li.appendChild(document.createTextNode(f.detail));
      $("p-findings").appendChild(li);
    });
    proposal.images.forEach(function (img) {
      var fig = el("figure", { "class": img.phone ? "p-fig p-fig-phone" : "p-fig" });
      fig.appendChild(el("img", { src: img.src, alt: img.alt, loading: "lazy" }));
      fig.appendChild(el("figcaption", {}, img.caption));
      $("p-gallery").appendChild(fig);
    });
    $("p-outcome").textContent = proposal.outcome;
    $("p-timeline").textContent = proposal.timeline;

    var tpl = $("agreement-template").content.cloneNode(true);
    tpl.querySelectorAll("[data-org]").forEach(function (n) { n.textContent = proposal.org; });
    $("p-agreement-text").appendChild(tpl);

    // options
    var saved = store.get("selected");
    proposal.package.forEach(function (p) { selected[p.id] = true; });
    proposal.addons.forEach(function (a) { selected[a.id] = !!(saved && saved.indexOf(a.id) > -1); });
    var opts = $("p-options");
    proposal.package.concat(proposal.addons).forEach(function (p) {
      var item = catalog.items[p.id]; if (!item) return;
      var price = typeof p.price === "number" ? p.price : item.price;
      var label = el("label", { "class": "p-option" + (p.locked ? " is-locked" : "") });
      var box = el("input", { type: "checkbox", value: p.id });
      box.checked = !!selected[p.id];
      if (p.locked) { box.disabled = true; box.setAttribute("aria-describedby", "rec-" + p.id); }
      box.addEventListener("change", function () { selected[p.id] = box.checked; store.set("selected", Object.keys(selected).filter(function (k) { return selected[k]; })); update(); });
      var body = el("span", { "class": "p-option-body" });
      var top = el("span", { "class": "p-option-top" });
      top.appendChild(el("strong", {}, item.name));
      top.appendChild(el("span", { "class": "p-option-price" }, money(price) + (item.billing === "monthly" ? " / month" : "")));
      body.appendChild(top);
      if (p.locked) body.appendChild(el("span", { "class": "p-tag", id: "rec-" + p.id }, "Recommended · included"));
      body.appendChild(el("span", { "class": "p-option-note" }, p.note || item.summary));
      label.appendChild(box); label.appendChild(body);
      opts.appendChild(label);
    });

    accepted = !!store.get("accepted");
    update();
    var start = parseInt(params.get("step"), 10);
    if (params.get("paid") === "1") { accepted = true; show(4); $("p-paid").hidden = false; $("p-pay-ready").hidden = true; $("p-pay-locked").hidden = true; }
    else show(start >= 1 && start <= 4 ? start : 1, true);
  }

  function linesInto(container, q) {
    container.textContent = "";
    q.lines.forEach(function (l) {
      var row = el("div", { "class": "p-row" });
      row.appendChild(el("span", {}, l.name)); row.appendChild(el("span", {}, money(l.price)));
      container.appendChild(row);
    });
    q.monthly.forEach(function (l) {
      var row = el("div", { "class": "p-row muted" });
      row.appendChild(el("span", {}, l.name)); row.appendChild(el("span", {}, money(l.price) + "/mo"));
      container.appendChild(row);
    });
  }

  function update() {
    current = BrackishPricing.quote(catalog, proposal, Object.keys(selected).filter(function (k) { return selected[k]; }));
    linesInto($("p-summary-lines"), current);
    linesInto($("p-review-lines"), current);
    $("p-once").textContent = $("p-review-once").textContent = money(current.once);
    $("p-deposit").textContent = $("p-review-deposit").textContent = money(current.deposit);
    $("p-monthly").textContent = $("p-review-monthly").textContent = money(current.perMonth) + " / month";
    $("p-monthly-row").hidden = $("p-review-monthly-row").hidden = current.perMonth === 0;
    $("p-pay-amount").textContent = money(current.deposit) + " deposit";
    $("p-pay-ready").hidden = !accepted; $("p-pay-locked").hidden = accepted;
  }

  function show(n, silent) {
    document.querySelectorAll(".p-step").forEach(function (s) { s.hidden = s.getAttribute("data-step") !== String(n); });
    document.querySelectorAll(".p-steps button").forEach(function (b) {
      var on = b.getAttribute("data-goto") === String(n);
      if (on) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (!silent) {
      var h = document.querySelector('.p-step[data-step="' + n + '"] h2');
      window.scrollTo({ top: document.querySelector(".p-steps").offsetTop - 8, behavior: "smooth" });
      if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
    }
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto]"); if (!t) return;
    show(parseInt(t.getAttribute("data-goto"), 10));
  });
  $("print-btn").addEventListener("click", function () { window.print(); });
  window.addEventListener("beforeprint", function () { document.querySelectorAll(".p-agreement").forEach(function (d) { d.open = true; }); });

  // accept
  $("accept-form").addEventListener("input", function () { var st = $("accept-status"); if (st.classList.contains("err")) { st.textContent = ""; st.className = "form-status"; } });
  $("accept-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, status = $("accept-status");
    status.className = "form-status";
    if (f.company_website.value) return;
    if (!f.name.value.trim() || !f.title.value.trim() || !/\S+@\S+\.\S+/.test(f.email.value) || !f.agree.checked) {
      status.textContent = "Please fill in your name, title and email, and check the box to agree.";
      status.classList.add("err"); return;
    }
    var btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    status.textContent = "Recording your acceptance…";
    var data = new FormData();
    data.append("_subject", "Proposal ACCEPTED: " + proposal.org);
    data.append("type", "proposal-acceptance");
    data.append("organization", proposal.org);
    data.append("proposal", slug);
    data.append("name", f.name.value.trim());
    data.append("title", f.title.value.trim());
    data.append("email", f.email.value.trim());
    data.append("_replyto", f.email.value.trim());
    data.append("package", current.lines.map(function (l) { return l.name + " " + money(l.price); }).concat(current.monthly.map(function (l) { return l.name + " " + money(l.price) + "/mo"; })).join("; "));
    data.append("project_total", money(current.once));
    data.append("monthly_total", money(current.perMonth));
    data.append("deposit", money(current.deposit));
    data.append("agreed_to_terms", "yes (typed name + checkbox)");
    data.append("accepted_at", new Date().toISOString());
    data.append("page", location.href);
    fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw 0; })
      .then(function () {
        accepted = true; store.set("accepted", true);
        store.set("signer", { name: f.name.value.trim(), email: f.email.value.trim() });
        status.textContent = ""; update(); show(4);
      })
      .catch(function () {
        status.textContent = "Something went wrong saving your acceptance. Please try again, or email foster@hellobrackish.com.";
        status.classList.add("err");
      })
      .finally(function () { btn.disabled = false; });
  });

  // pay
  $("pay-btn").addEventListener("click", function () {
    var btn = this, status = $("pay-status");
    var signer = store.get("signer") || {};
    btn.disabled = true; status.className = "form-status"; status.textContent = "Opening secure checkout…";
    fetch("/api/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: slug, items: current.items, name: signer.name || "", email: signer.email || "" })
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok && res.j.url) { location.href = res.j.url; return; }
        throw res.j;
      })
      .catch(function (err) {
        if (err && err.error) console.warn("Deposit checkout unavailable:", err);
        status.textContent = "Online payment isn't available right now. No problem: I'll email your deposit invoice within one business day." + (err && err.error ? " (ref: " + err.error + (err.stripeCode ? "/" + err.stripeCode : "") + ")" : "");
        status.classList.add("ok"); btn.disabled = false;
      });
  });
})();
