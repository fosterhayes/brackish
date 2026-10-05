# hellobrackish.com

The website for Brackish LLC. Plain HTML and CSS, no build step, hosted on Vercel.

## Pages

| File | URL |
| --- | --- |
| `index.html` | `/` |
| `services.html` | `/services` |
| `work.html` | `/work` |
| `about.html` | `/about` |
| `contact.html` | `/contact` |
| `404.html` | shown for missing pages |

`vercel.json` turns on clean URLs, so `/services` serves `services.html`.

## Settings to fill in

Open `assets/site.js` and set:

- `bookingUrl`: your Cal.com or Calendly link. Until it is set, "Book a free call" buttons go to the contact page.
- `formEndpoint`: your Formspree form URL. Until it is set, the contact form opens the visitor's email app with their message filled in.

## Still to add


## Brand

Colors, fonts and logo rules live in the Brackish brand guide. Fonts are self-hosted in `assets/fonts` under the SIL Open Font License.

## Proposal pages

Each prospect gets a private page at `/p/<slug>`, for example `/p/habitat-351bhb`. The page has four steps: what I found, build your package, review and accept, and pay the deposit.

- **Add a prospect:** copy `p/data/habitat-351bhb.json` to `p/data/<new-slug>.json` and edit it, then copy `p/proposal.html` to `p/<new-slug>.html`. Put concept images in `p/img/`. Use a random suffix in the slug so it can't be guessed. (If you change `p/proposal.html`, copy it over each prospect's page too.)
- **Prices** live in `data/prices.json`. Proposal pages and the deposit checkout both read from it. A proposal can override an item's price with `"price"`.
- **Acceptance** is sent to Formspree with the signer's name, title, email, package, totals and timestamp.
- **Deposits** go through Stripe Checkout via `api/checkout.js`, which recalculates the amount on the server. It needs the `STRIPE_SECRET_KEY` environment variable in Vercel. Without it, the page tells the client you'll email an invoice instead.
- Proposal pages are hidden from search engines (`noindex` header, `robots.txt`).

### Deposit payment options
Proposal pages show the payment options listed in `data/payment.json` (Venmo, Cash App, Zelle, check). Leave a value empty to hide that option. When a client clicks "I've sent the deposit," you get a Formspree email naming the method they used. The Stripe checkout code in `api/checkout.js` stays in the repo but isn't used right now.
