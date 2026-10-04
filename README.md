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

- Headshot: save as `assets/foster.jpg` and swap it into the marked spot in `about.html`.

## Brand

Colors, fonts and logo rules live in the Brackish brand guide. Fonts are self-hosted in `assets/fonts` under the SIL Open Font License.
