# Razz Rohith Temporary Game Lounge

This repository currently serves a premium temporary maintenance page with playable games while the main portfolio is being rebuilt. The public pages share a motion system with glass UI, scroll reveals, responsive layouts, and interactive game previews.

## What Runs Where

- `index.html` is the static game lounge.
- `assets/css/game-shell.css` contains the shared premium UI system.
- `assets/js/site-motion.js` powers scroll progress, reveal animations, magnetic buttons, and tilt effects.
- `snake/` is a local, serverless Snake game.
- `sequence-play.html` launches the hosted Sequence multiplayer server.
- `ludo-play.html` launches the hosted Ludo multiplayer server.
- `maintenance.html`, `game.html`, and `site/index.html` are polished compatibility redirects into the active experience.
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
