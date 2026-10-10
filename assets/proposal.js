(function () {
  var FORM_ENDPOINT = "https://formspree.io/f/mbgdrejr";
  var slug = (location.pathname.match(/\/p\/([a-z0-9-]+)/) || [])[1];
  var params = new URLSearchParams(location.search);
  var catalog = null, proposal = null, current = null, selected = {}, payment = {}, method = null;
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
  function postForm(data) {
    return fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error((j && j.errors && j.errors.map(function (x) { return x.message; }).join("; ")) || (j && j.error) || ("status " + r.status));
        });
      });
  }
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
    fetch("/p/data/" + slug + ".json").then(function (r) { if (!r.ok) throw 0; return r.json(); }),
    fetch("/data/payment.json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (res) {
    catalog = res[0]; proposal = res[1]; payment = res[2] || {};
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
    if (proposal.discount && proposal.discount.percent > 0) {
      var ban = el("div", { "class": "p-discount" });
      ban.appendChild(el("strong", {}, (proposal.discount.name || "Discount") + ": " + proposal.discount.percent + "% off"));
      if (proposal.discount.note) ban.appendChild(el("span", {}, proposal.discount.note));
      opts.parentNode.parentNode.insertBefore(ban, opts.parentNode);
    }
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
      var priceEl = el("span", { "class": "p-option-price" });
      var d = proposal.discount;
      if (d && d.percent > 0 && item.billing !== "monthly" && (!d.items || d.items.indexOf(p.id) > -1)) {
        priceEl.appendChild(el("s", { "class": "p-was" }, money(price)));
        priceEl.appendChild(document.createTextNode(" " + money(Math.round(price * (100 - d.percent)) / 100)));
      } else {
        priceEl.textContent = money(price) + (item.billing === "monthly" ? " / month" : "");
      }
      top.appendChild(priceEl);
      body.appendChild(top);
      if (p.locked) body.appendChild(el("span", { "class": "p-tag", id: "rec-" + p.id }, "Recommended · included"));
      body.appendChild(el("span", { "class": "p-option-note" }, p.note || item.summary));
      label.appendChild(box); label.appendChild(body);
      opts.appendChild(label);
    });

    renderMethods();
    accepted = !!store.get("accepted");
    update();
    var start = parseInt(params.get("step"), 10);
    if (params.get("paid") === "1") {
      accepted = true; store.set("accepted", true);
      if (!store.get("cardNotified")) {
        store.set("cardNotified", true);
        var signer = store.get("signer") || {}, n = new FormData();
        n.append("_subject", "Deposit PAID by card: " + proposal.org);
        n.append("type", "deposit-paid-card"); n.append("organization", proposal.org); n.append("proposal", slug);
        n.append("name", signer.name || ""); n.append("email", signer.email || "");
        n.append("stripe_session", params.get("session_id") || ""); n.append("paid_at", new Date().toISOString());
        postForm(n).catch(function () {});
      }
      store.set("sent", "Card");
    }
    if (store.get("sent")) { accepted = true; show(4, true); showSent(); }
    else show(start >= 1 && start <= 4 ? start : 1, true);
  }

  function renderMethods() {
    var memo = proposal.org + " deposit";
    $("p-pay-memo").textContent = memo;
    var clean = function (v) { return String(v || "").trim(); };
    var venmo = clean(payment.venmo).replace(/^@/, ""), cash = clean(payment.cashapp).replace(/^\$/, "");
    var list = [];
    if (venmo) list.push({ id: "Venmo", detail: "@" + venmo, href: "https://venmo.com/u/" + encodeURIComponent(venmo) });
    if (cash) list.push({ id: "Cash App", detail: "$" + cash, href: "https://cash.app/$" + encodeURIComponent(cash) });
    if (clean(payment.zelle)) list.push({ id: "Zelle", detail: "Send to " + clean(payment.zelle) + " from your bank's app" });
    if (clean(payment.checkPayableTo)) list.push({ id: "Check", detail: "Payable to " + clean(payment.checkPayableTo) + ". " + (clean(payment.checkMailTo) ? "Mail to " + clean(payment.checkMailTo) + "." : "I'll email you the mailing address.") });
    var box = $("p-methods");
    function addMethod(m, first) {
      var label = el("label", { "class": "p-method" + (m.card ? " p-method-card" : "") });
      var r = el("input", { type: "radio", name: "pay-method", value: m.id });
      r.addEventListener("change", function () {
        method = m.id;
        var b = $("sent-btn"); b.disabled = false;
        b.textContent = m.card ? "Pay " + money(current.deposit) + " securely" : "I've sent the deposit";
        var st = $("pay-status"); st.textContent = ""; st.className = "form-status";
      });
      var body = el("span", { "class": "p-method-body" });
      body.appendChild(el("strong", {}, m.label || m.id));
      var d = el("span", {}, m.detail + " ");
      if (m.href) d.appendChild(el("a", { href: m.href, target: "_blank", rel: "noopener" }, "Open " + m.id));
      body.appendChild(d);
      label.appendChild(r); label.appendChild(body);
      if (first && box.firstChild) box.insertBefore(label, box.firstChild); else box.appendChild(label);
    }
    list.forEach(function (m) { addMethod(m); });
    fetch("/api/checkout").then(function (r) { return r.ok ? r.json() : {}; }).then(function (j) {
      if (j && j.configured) addMethod({ id: "Card", label: "Card or bank account", card: true, detail: "Pay securely online through Stripe. You'll get an emailed receipt right away." }, true);
    }).catch(function () {});
  }

  function showSent() {
    $("p-paid").hidden = false; $("p-pay-ready").hidden = true; $("p-pay-locked").hidden = true;
    if (store.get("sent") === "Card") {
      var box = $("p-paid");
      box.querySelector(".eyebrow").textContent = "Deposit received";
      box.querySelector("h3").textContent = "You're on the calendar.";
      box.querySelector("p:not(.eyebrow)").textContent = "Thank you! Stripe has emailed your receipt. I'll be in touch within one business day to schedule our kickoff.";
    }
  }

  function linesInto(container, q) {
    container.textContent = "";
    q.lines.forEach(function (l) {
      var row = el("div", { "class": "p-row" + (l.discount ? " p-row-discount" : "") });
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
    if (store.get("sent")) showSent();
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
    postForm(data)
      .then(function () {
        accepted = true; store.set("accepted", true);
        store.set("signer", { name: f.name.value.trim(), email: f.email.value.trim() });
        status.textContent = ""; update(); show(4);
      })
      .catch(function (err) {
        status.textContent = "Something went wrong saving your acceptance. Please try again, or email foster@hellobrackish.com. (Details: " + ((err && err.message) || "network error") + ")";
        status.classList.add("err");
      })
      .finally(function () { btn.disabled = false; });
  });

  // deposit sent
  $("sent-btn").addEventListener("click", function () {
    if (!method) return;
    var btn = this, status = $("pay-status"), signer = store.get("signer") || {};
    if (method === "Card") {
      btn.disabled = true; status.className = "form-status"; status.textContent = "Opening secure checkout…";
      fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug, items: current.items, name: signer.name || "", email: signer.email || "" })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok && res.j.url) { location.href = res.j.url; return; }
          throw res.j || {};
        })
        .catch(function (err) {
          status.textContent = "Card payment isn't available right now. Please choose another option above, or email foster@hellobrackish.com." + (err && err.error ? " (ref: " + err.error + (err.stripeCode ? "/" + err.stripeCode : "") + ")" : "");
          status.classList.add("err"); btn.disabled = false;
        });
      return;
    }
    btn.disabled = true; status.className = "form-status"; status.textContent = "Letting Foster know…";
    var data = new FormData();
    data.append("_subject", "Deposit sent (" + method + "): " + proposal.org);
    data.append("type", "deposit-sent");
    data.append("organization", proposal.org);
    data.append("proposal", slug);
    data.append("method", method);
    data.append("deposit", money(current.deposit));
    data.append("name", signer.name || "");
    data.append("email", signer.email || "");
    if (signer.email) data.append("_replyto", signer.email);
    data.append("sent_at", new Date().toISOString());
    postForm(data)
      .then(function () { store.set("sent", method); showSent(); })
      .catch(function (err) {
        status.textContent = "That didn't go through. Please try again, or email foster@hellobrackish.com to let me know it's on the way. (Details: " + ((err && err.message) || "network error") + ")";
        status.classList.add("err"); btn.disabled = false;
      });
  });
})();
