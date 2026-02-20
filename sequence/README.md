# Sequence - Multiplayer Board Game

A real-time browser-based implementation of the classic Sequence board game using Node.js, Express, and Socket.io.

## Features

- 2–12 players
- Team mode (up to 10 teams)
- Private rooms with 6-character codes
- Full rules: Two-eyed jacks (wild), one-eyed jacks (remove opponent chip), dead cards
- Wild corner spaces
- Sequence detection and locking
- Responsive UI for desktop and mobile

## Quick Start

1. Install dependencies:
   ```bash
   cd sequence
   npm install
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:3000`

4. To play with friends, share your public IP or use a tunneling service (see Deployment below).

## How to Play

- **Create Room:** Click "Create Room" → get a room code.
- **Join Room:** Enter the room code and click "Join".
- In the lobby:
  - Select a team (if playing solo) or coordinate with friends.
  - Click "Ready" when you're ready to start.
  - Host clicks "Start Game" when everyone is ready.
- During gameplay:
  - Click a card in your hand to select it.
  - If it's a normal card, valid board positions (two possible spots) will highlight. Click one to place your chip.
  - Two-eyed Jack (♥/♦) is wild: place on any empty cell.
  - One-eyed Jack (♠/♣) removes an opponent chip (click the chip to remove).
  - Complete a sequence of 5 connected chips to win.
- Win conditions:
  - 2–3 players/teams: first to 2 sequences wins.
  - 4+ players/teams: first to 1 sequence wins.

## Game Rules Summary

- Board: 10x10 grid, each non-Jack card appears twice. Corners are wild (act as any color but cannot be occupied).
- Cards per player: 2→7, 3–4→6, 5–6→5, 8–9→4, 10–12→3.
- Jacks: Two-eyed are wild, one-eyed remove opponent chips.
- Dead cards: If both matching board spaces are occupied, the card is dead and may be discarded without placing.
- Sequences: Any 5 connected chips horizontally, vertically, or diagonally. Once counted, chips are locked and cannot be removed.

## Deployment

For friends to join, the server must be reachable from the internet.

### Option 1: Railway / Render / Heroku

- Push this repository to your hosting provider.
- Set build command: `npm install`
- Set start command: `npm start`
- Set environment port if required (`PORT` is used automatically).
- Deploy. Share `https://your-app-name.onrender.com` (or similar).

### Option 2: VPS / Dedicated Server

```bash
git clone <your-repo>
cd <repo>/sequence
npm install
npm start
# Use PM2 or systemd to keep it running
```

Make sure port 3000 is open.

### Option 3: Local testing with ngrok

```bash
ngrok http 3000
```
Share the ngrok URL.

## Project Structure

```
sequence/
├── server.js          # Express + Socket.io server
├── package.json
└── public/
    ├── index.html     # Main UI
    ├── style.css      # Styles
    └── client.js      # Frontend logic
```

## Environment Variables

- `PORT` - server port (default: 3000)

## Notes

- The server stores game state in memory. Restarting the server clears all rooms.
- No authentication; room codes are the only barrier.
- No AI bots; human players only.

## Future Enhancements

- Spectator mode
- Chat
- Reconnect support
- AI bots
- Persistent storage for match history

Enjoy playing Sequence!