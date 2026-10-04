/* ------------------------------------------------------------------
   Brackish site settings. Fill these in and the site updates itself.
   ------------------------------------------------------------------ */
var BRACKISH = {
  email: "foster@hellobrackish.com",
  // Booking link, e.g. "https://cal.com/hellobrackish/intro".
  // Leave empty and every "Book a call" button goes to the contact page instead.
  bookingUrl: "https://cal.com/brackish/start",
  // Form endpoint from Formspree (https://formspree.io), e.g. "https://formspree.io/f/abcdwxyz".
  // Leave empty and the form opens the visitor's email app with their message filled in.
  formEndpoint: "https://formspree.io/f/mbgdrejr"
};

(function () {
  // mobile menu
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // booking buttons
  document.querySelectorAll("[data-book]").forEach(function (a) {
    if (BRACKISH.bookingUrl) {
      a.href = BRACKISH.bookingUrl;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.href = "/contact";
    }
  });

  // email links
  document.querySelectorAll("[data-email]").forEach(function (a) {
    a.href = "mailto:" + BRACKISH.email;
    if (!a.textContent.trim()) a.textContent = BRACKISH.email;
  });

  // year
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // contact form
  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = document.getElementById("form-status");
  var params = new URLSearchParams(window.location.search);
  var svc = params.get("service");
  if (svc && form.service) form.service.value = svc;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (form.company_website && form.company_website.value) return; // spam trap
    var data = new FormData(form);
    status.className = "form-status";

    if (!BRACKISH.formEndpoint) {
      var body = "Name: " + data.get("name") +
        "\nOrganization: " + (data.get("organization") || "") +
        "\nInterested in: " + data.get("service") +
        "\n\n" + data.get("message");
      window.location.href = "mailto:" + BRACKISH.email +
        "?subject=" + encodeURIComponent("New project inquiry from " + data.get("name")) +
        "&body=" + encodeURIComponent(body);
      status.textContent = "Your email app should open with your message ready to send.";
      status.classList.add("ok");
      return;
    }

    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    status.textContent = "Sending…";
    fetch(BRACKISH.formEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("bad response");
        form.reset();
        status.textContent = "Thanks! Your message is on its way. Expect a reply within one business day.";
        status.classList.add("ok");
      })
      .catch(function () {
        status.textContent = "Something went wrong. Please email " + BRACKISH.email + " directly.";
        status.classList.add("err");
      })
      .finally(function () { btn.disabled = false; });
  });
})();
