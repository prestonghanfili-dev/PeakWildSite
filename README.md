# Peak Wild Supplements — website

A fast, SEO-friendly static site that replaces the Manus-built peakwildshop.com.
Plain HTML/CSS/JS — no build step, no framework. Just upload the folder.

```
PeakWildSite/
├── index.html          Home
├── shop/index.html     Shop (11 products, filters, add-to-cart)
├── science/index.html  The Science (17 PubMed-linked studies)
├── game/index.html     Peak Catch (the arcade game, self-contained)
└── assets/  css/ js/ img/
```

## Local preview
Serve the folder (browsers block cross-folder links over file://):
```
python -m http.server 8080 --directory .
```
Then open http://localhost:8080

## ⚠️ Two things to do before it can take orders

**1. Turn OFF your Shopify store password.**
The Add-to-Cart flow sends shoppers to Shopify's secure checkout at
`peakwild.myshopify.com`. That domain is currently password-protected, so
checkout will fail until you make it public:
Shopify admin → **Online Store → Preferences → scroll to “Password protection” → uncheck it.**
(Your store already sells this way through Shopify — this just lets the checkout URL open.)

**2. Create the `WILD10` discount code** (10% off) in Shopify admin → Discounts,
so the Peak Catch game reward works at checkout.

## How checkout works (no API keys)
`assets/js/cart.js` keeps a cart in the browser's localStorage and, at checkout,
builds a single Shopify cart permalink:
`https://peakwild.myshopify.com/cart/<variantId>:<qty>,<variantId>:<qty>`
Shopify handles the cart + payment on its own secure checkout. If JavaScript ever
fails, each product button still works as a direct single-item checkout link.

Product variant IDs live in the `href` of each `.buy` button — pulled from your
live Shopify data. If you add/remove products, update those buttons in
`shop/index.html` (and the featured five in `index.html`).

## Deploy
See the launch notes in chat. Short version: drag this folder onto
**Netlify Drop** (app.netlify.com/drop) or connect it to Netlify/Vercel/Cloudflare
Pages, test everything on the temporary URL, then point the **peakwildshop.com**
DNS at the host. Keep the old Manus site up until the new one is confirmed working.
