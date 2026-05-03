# Sequence Board Game

A real-time multiplayer implementation of the classic Sequence board game using Node.js, Express, and Socket.io.

## Features

- ✅ Full lobby system: create/join rooms, player list, host control
- ✅ Ready toggle and start button (host only, when all ready)
- ✅ Team selection (10 colors)
- ✅ Correct game rules:
  - 10×10 board with 4 wild corners
  - 104‑card deck (2×52 + 4 jokers)
  - Two‑eyed Jacks (♥J, ♦J): wild placement on any empty cell
  - One‑eyed Jacks (♠J, ♣J): remove opponent's chip
  - Normal cards match board picture (except corners)
  - Sequence detection (5 in a row; 9+ counts as 2)
  - Win condition: 2 sequences (or 1 sequence of 9+)
- ✅ Smooth turn management and card drawing
- ✅ Play again after win
- ✅ Mobile‑friendly responsive UI

## Quick Start

```bash
cd sequence
npm install
npm start
```

Open browser to `http://localhost:3000`.

## Controls

- **Create Room**: Host creates a room and shares the code
- **Join Room**: Enter room code and your name
- **Team**: Choose a team color (optional)
- **Ready**: Toggle when you're ready (host starts when all ready)
- **Card**: Click a card in your hand to select it
- **Board**: Click an empty cell to place the selected card (or one‑eyed jack target)
- **One‑Eyed Jack**: Select card, then click opponent's chip to remove it

## Deployment

### Render

Push to GitHub and create a Web Service on Render. It auto-detects via `render.yaml`.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

build & run:
```bash
docker build -t sequence .
docker run -p 3000:3000 sequence
```

### Manual (VPS, Raspberry Pi)

```bash
npm install -g pm2
pm2 start server.js --name "sequence"
pm2 save && pm2 startup
```

## Architecture

- **server.js**: Express + Socket.io, authoritative game state
- **public/index.html**: Single-page UI
- **public/client.js**: Socket client, renders board/hand
- **public/style.css**: Modern dark theme

## Game Rules Reference

- Each player gets 5–7 cards depending on player count (2:7, 3:6, 4:6, 5:5, 6:5, 7:4, 8:4)
- Corners are wild and can be claimed with any card
- Two‑eyed Jacks are wild and can be placed anywhere
- One‑eyed Jacks remove a single opponent chip (not from a completed sequence)
- A sequence is five or more chips of the same color in a row (horizontal, vertical, diagonal)
- Nine chips in a row counts as two sequences
- First team to complete two sequences wins

## License

MIT