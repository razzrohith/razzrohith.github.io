# DealNest Static Deals Prototype

This repository now serves a static frontend prototype for an original premium deals-discovery community called DealNest. The site uses mock deal data, original SVG product art, client-side search/filtering, coupon interactions, responsive marketplace UI, motion effects, and multiple placeholder pages for future product flows.

## What Runs Where

- `index.html` is the DealNest homepage prototype.
- `deal.html` is the reusable deal detail page prototype.
- `categories.html`, `stores.html`, `coupons.html`, `community.html`, `search.html`, `saved.html`, `alerts.html`, `post-deal.html`, `login.html`, and `games.html` are static platform pages rendered from shared mock data.
- `assets/css/deals.css` contains the deals marketplace design system.
- `assets/js/deals-data.js` contains realistic fake deal, coupon, store, and community data.
- `assets/js/deals-app.js` renders deal cards and powers search, filters, sorting, save/vote actions, coupon copy feedback, and mobile navigation.
- `assets/js/deals-motion.js` adds reveal motion, count-up stats, and lightweight parallax.
- `assets/js/deals-pages.js` renders the secondary placeholder pages.
- `assets/js/deal-detail.js` renders the detail page from mock data and powers coupon copy, heat voting, save, share, report, comments preview, and related deals.
- `assets/img/deals/`, `assets/img/categories/`, `assets/img/stores/`, `assets/icons/`, and `assets/backgrounds/` contain original SVG product, interface, and background assets.
- `snake/`, `ludo/`, and `sequence-play.html` remain accessible as archived games.
- `assets/css/game-shell.css` and `assets/js/site-motion.js` still support archived game/launcher pages.
- `sequence/` and `ludo/` contain the Node/Socket.io multiplayer game implementations used by the hosted versions.

## Local Preview

From the repository root:

```powershell
python -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Multiplayer Servers

Ludo:

```powershell
cd ludo
npm install
npm start
```

Sequence:

```powershell
cd sequence
npm install
npm start
```

Sequence expects its database environment variables to be configured before the server can persist rooms.
