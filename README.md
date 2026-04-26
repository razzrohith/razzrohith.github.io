# DealNest Static Deals Prototype

This repository now serves a Phase 1 static frontend prototype for an original premium deals-discovery community called DealNest. The homepage uses mock deal data, original SVG product art, client-side search/filtering, coupon interactions, and responsive marketplace UI.

## What Runs Where

- `index.html` is the DealNest homepage prototype.
- `assets/css/deals.css` contains the deals marketplace design system.
- `assets/js/deals-data.js` contains realistic fake deal, coupon, store, and community data.
- `assets/js/deals-app.js` renders deal cards and powers search, filters, sorting, save/vote actions, coupon copy feedback, and mobile navigation.
- `assets/img/deals/` contains original SVG product illustrations.
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
