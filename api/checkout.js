// POST /api/checkout
// Creates a Stripe Checkout session for a proposal's 50% deposit.
// The amount is always recalculated here from data/prices.json and the
// proposal file, so nothing the browser sends can change the price.
// Requires the STRIPE_SECRET_KEY environment variable in Vercel.
const fs = require("fs");
const path = require("path");
const { quote } = require("../assets/pricing.js");

const SLUG = /^[a-z0-9-]{4,60}$/;

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), ...parts), "utf8"));
}

module.exports = async function handler(req, res) {
  const key = (process.env.STRIPE_SECRET_KEY || "").trim();
  if (req.method === "GET") {
    // Status check only: never reveals the key itself.
    const mode = key.startsWith("sk_test_") ? "test" : key.startsWith("sk_live_") ? "live" : key.startsWith("rk_") ? "restricted" : key ? "unrecognized" : "missing";
    return res.status(200).json({ configured: !!key, keyType: mode });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, GET");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!key) return res.status(503).json({ error: "payments_not_configured" });

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { slug, items, email } = body;
  if (!SLUG.test(slug || "") || !Array.isArray(items)) return res.status(400).json({ error: "bad_request" });

  let catalog, proposal;
  try {
    catalog = readJson("data", "prices.json");
    proposal = readJson("p", "data", slug + ".json");
  } catch (e) {
    return res.status(404).json({ error: "proposal_not_found" });
  }

  const q = quote(catalog, proposal, items.filter((i) => typeof i === "string"));
  const cents = Math.round(q.deposit * 100);
  if (!(cents >= 5000)) return res.status(400).json({ error: "nothing_to_charge" });

  const origin = `https://${req.headers["x-forwarded-host"] || req.headers.host}`;
  const summary = q.lines.map((l) => `${l.name} $${l.price}`).join("; ").slice(0, 480);
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/p/${slug}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/p/${slug}?step=4`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": `50% project deposit: ${proposal.org}`.slice(0, 250),
    "line_items[0][price_data][product_data][description]": summary || "Brackish project deposit",
    "payment_intent_data[description]": `Brackish deposit for ${proposal.org}`.slice(0, 250),
    "metadata[proposal]": slug,
    "metadata[organization]": proposal.org.slice(0, 450),
    "metadata[project_total]": String(q.once),
    "metadata[items]": q.items.join(",").slice(0, 450)
  });
  if (email && /^\S+@\S+\.\S+$/.test(email)) form.set("customer_email", email);

  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    const data = await r.json();
    if (!r.ok || !data.url) {
      console.error("Stripe error", r.status, data && data.error && data.error.message);
      return res.status(502).json({ error: "stripe_error", stripeStatus: r.status, stripeCode: (data && data.error && (data.error.code || data.error.type)) || null });
    }
    return res.status(200).json({ url: data.url });
  } catch (e) {
    console.error("Stripe request failed", e && e.message);
    return res.status(502).json({ error: "stripe_unreachable" });
  }
};
