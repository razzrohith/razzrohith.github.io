const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from sequence/public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Game constants
const BOARD_SIZE = 10;
const CORNERS = [
  { r: 0, c: 0 },
  { r: 0, c: 9 },
  { r: 9, c: 0 },
  { r: 9, c: 9 }
];

// Suits and ranks for deck generation (standard 52 cards)
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CLASSIC_BOARD_LAYOUT = [
  [null, "6♣", "A♥", "K♠", "K♣", "9♥", "K♠", "6♣", "2♣", null],
  ["2♠", "A♦", "2♣", "8♣", "8♦", "10♠", "7♥", "8♥", "5♥", "10♣"],
  ["8♠", "7♠", "8♥", "Q♠", "6♦", "A♣", "2♥", "3♣", "9♣", "5♦"],
  ["Q♦", "9♣", "8♠", "7♠", "4♠", "Q♥", "5♠", "3♥", "10♦", "3♦"],
  ["5♦", "4♥", "3♦", "9♥", "6♠", "4♦", "7♦", "2♥", "3♣", "Q♥"],
  ["2♠", "4♠", "7♦", "6♥", "2♦", "6♦", "Q♠", "7♣", "4♥", "9♦"],
  ["4♣", "9♠", "4♦", "9♠", "10♣", "7♥", "A♠", "K♣", "9♦", "3♥"],
  ["8♦", "2♦", "A♣", "K♦", "4♣", "A♥", "3♠", "5♠", "Q♣", "10♠"],
  ["8♣", "3♠", "Q♦", "A♦", "10♥", "Q♣", "7♣", "5♣", "6♠", "K♦"],
  [null, "6♥", "K♥", "K♥", "5♥", "10♥", "5♣", "A♠", "10♦", null]
];

// SEQUEL5_BOARD_LAYOUT removed to ensure proper game rules (no Jacks or WC on board)

// Validate BOARD_LAYOUT shape
[CLASSIC_BOARD_LAYOUT].forEach((layout, index) => {
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (layout[r].length !== BOARD_SIZE) {
      throw new Error(`Layout ${index} Row ${r} has ${layout[r].length} columns, expected ${BOARD_SIZE}`);
    }
  }
});

// Card matching utilities
const isCorner = (r, c) => CORNERS.some(corner => corner.r === r && corner.c === c);
const isTwoEyedJack = (card) => card.rank === 'J' && (card.suit === '♥' || card.suit === '♦');
const isOneEyedJack = (card) => card.rank === 'J' && (card.suit === '♠' || card.suit === '♣');
const cardEquals = (c1, c2) => c1.rank === c2.rank && c1.suit === c2.suit;

// Shuffle array in place
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Create 104‑card deck (52 standard + 4 jokers)
function createDeck() {
  const deck = [];
  // Standard cards: each unique card appears exactly once (for 2‑4 players) or twice (for 5‑8) per official rules? Actually: The physical Sequence board has each card picture exactly once on board, and the deck contains 2 copies of each for 4 players? Let's check: Official rules say deck includes 2 full decks of 52 cards (104 cards). That means each of the 52 standard cards appears twice in the draw deck. Yes.
  for (let dup = 0; dup < 2; dup++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit, display: rank + suit });
      }
    }
  }
  shuffle(deck);
  return deck;
}

// Cards per player based on count (official Sequence rules)
// 2 players: 7 cards each; 3: 6; 4: 6; 5: 5; 6: 5; 7: 4; 8: 4; 9: 3? Official supports 2-12 but board only has 10x10, corners free; usually 2-8 players.
const CARD_DISTRIBUTION = {
  2: 7,
  3: 6,
  4: 6,
  5: 5,
  6: 5,
  7: 4,
  8: 4
};

function getCardsForPlayerCount(n) {
  if (CARD_DISTRIBUTION[n] === undefined) {
    throw new Error(`Unsupported player count: ${n}. Must be 2-8.`);
  }
  return CARD_DISTRIBUTION[n];
}

// DB connection
const connectDB = require('./db');
const Room = require('./models');
connectDB();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

async function createRoom(hostId, hostName, boardStyle = 'Classic Board') {
  const roomId = generateRoomCode();
  const room = new Room({
    id: roomId,
    hostId,
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    cardPositions: CLASSIC_BOARD_LAYOUT, // Always use standard Sequence board layout
    boardStyle: boardStyle,
    players: [],
    deck: [],
    discardPile: [],
    sequences: [],
    winner: null,
    turnIndex: 0,
    gameStarted: false,
    availableColors: ['#e63946', '#4cc9f0', '#06d6a0', '#ffd166', '#7209b7', '#f72585', '#3a0ca3']
  });
  await room.save();
  return room;
}

function getPlayerSocketIds(room) {
  return room.players.flatMap(p => p.socketIds || []);
}

async function broadcastToRoom(roomId, event, data, excludeSocketId = null) {
  const room = await Room.findOne({ id: roomId });
  if (!room) return;
  const targets = getPlayerSocketIds(room).filter(id => id !== excludeSocketId);
  io.to(targets).emit(event, data);
}

function serializeRoom(room) {
  return {
    id: room.id,
    hostId: room.hostId,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      ready: p.ready,
      cards: p.cards,
      isHost: p.id === room.hostId,
      connected: (p.socketIds && p.socketIds.length > 0)
    })),
    board: room.board.map(row => row.map(cell => cell ? { color: cell.color, locked: cell.locked } : null)),
    turnIndex: room.turnIndex,
    teamWinCounts: room.teamWinCounts || {},
    sequences: room.sequences,
    winner: room.winner,
    gameStarted: room.gameStarted,
    cardPositions: room.cardPositions,
    boardStyle: room.boardStyle || 'Classic Board',
    paused: room.paused || false,
    lastPlacedPos: room.lastPlacedPos || null
  };
}

function initializeGame(room) {
  // Reset board
  room.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  room.sequences = [];
  room.winner = null;
  room.gameStarted = true;
  // Reset players
  room.players.forEach(p => p.cards = []);
  // Create and shuffle deck
  room.deck = createDeck();
  shuffle(room.deck);
  room.discardPile = [];
  // Deal cards
  const n = room.players.length;
  const cardsPerPlayer = getCardsForPlayerCount(n);
  for (const p of room.players) {
    for (let i = 0; i < cardsPerPlayer; i++) {
      p.cards.push(room.deck.pop());
    }
    p.ready = false;
  }
  // First turn: random player (or host? random)
  room.turnIndex = Math.floor(Math.random() * room.players.length);
  // Broadcast initial state
  broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room));
}

function getCurrentPlayer(room) {
  return room.players[room.turnIndex];
}

function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.players.length;
}

function updateSequencesAndLocks(room) {
  // clear all locks
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (room.board[r][c]) room.board[r][c].locked = false;
    }
  }

  const teams = [...new Set(room.players.map(p => p.team).filter(Boolean))];
  const teamWinCounts = {};

  teams.forEach(team => {
    let sequences = 0;

    const processLine = (cells) => {
      let currentBlock = [];
      for (const cell of cells) {
        const { r, c } = cell;
        const isTeamChip = room.board[r][c] && room.board[r][c].color === team;
        if (isTeamChip || isCorner(r, c)) {
          currentBlock.push(cell);
        } else {
          if (currentBlock.length >= 5) {
            sequences += Math.floor((currentBlock.length - 1) / 4);
            currentBlock.forEach(bc => {
              if (room.board[bc.r][bc.c]) room.board[bc.r][bc.c].locked = true;
            });
          }
          currentBlock = [];
        }
      }
      if (currentBlock.length >= 5) {
        sequences += Math.floor((currentBlock.length - 1) / 4);
        currentBlock.forEach(bc => {
          if (room.board[bc.r][bc.c]) room.board[bc.r][bc.c].locked = true;
        });
      }
    };

    // Rows
    for (let r = 0; r < BOARD_SIZE; r++) {
      const line = [];
      for (let c = 0; c < BOARD_SIZE; c++) line.push({ r, c });
      processLine(line);
    }
    // Cols
    for (let c = 0; c < BOARD_SIZE; c++) {
      const line = [];
      for (let r = 0; r < BOARD_SIZE; r++) line.push({ r, c });
      processLine(line);
    }
    // Diagonals (top-left to bottom-right)
    for (let startR = 0; startR < BOARD_SIZE; startR++) {
      let r = startR, c = 0;
      const line = [];
      while (r < BOARD_SIZE && c < BOARD_SIZE) { line.push({ r, c }); r++; c++; }
      if (line.length >= 5) processLine(line);
    }
    for (let startC = 1; startC < BOARD_SIZE; startC++) {
      let r = 0, c = startC;
      const line = [];
      while (r < BOARD_SIZE && c < BOARD_SIZE) { line.push({ r, c }); r++; c++; }
      if (line.length >= 5) processLine(line);
    }
    // Diagonals (top-right to bottom-left)
    for (let startR = 0; startR < BOARD_SIZE; startR++) {
      let r = startR, c = BOARD_SIZE - 1;
      const line = [];
      while (r < BOARD_SIZE && c >= 0) { line.push({ r, c }); r++; c--; }
      if (line.length >= 5) processLine(line);
    }
    for (let startC = BOARD_SIZE - 2; startC >= 0; startC--) {
      let r = 0, c = startC;
      const line = [];
      while (r < BOARD_SIZE && c >= 0) { line.push({ r, c }); r++; c--; }
      if (line.length >= 5) processLine(line);
    }

    teamWinCounts[team] = sequences;
  });

  room.teamWinCounts = teamWinCounts;
  room.markModified('teamWinCounts');

  // Check win condition
  const uniqueTeamsCount = teams.length;
  // Official sequence rules: 2 teams need 2 sequences. 3 teams need 1 sequence.
  const sequencesNeededToWin = uniqueTeamsCount >= 3 ? 1 : 2;

  const winningTeam = Object.keys(teamWinCounts).find(t => teamWinCounts[t] >= sequencesNeededToWin);
  if (winningTeam && !room.winner) {
    room.winner = winningTeam;
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createRoom', async ({ name, boardType }) => {
    try {
      const room = await createRoom(socket.id, name || 'Host', boardType);
      if (!room.availableColors || room.availableColors.length === 0) {
        room.availableColors = ['#e63946', '#4cc9f0', '#06d6a0', '#ffd166', '#7209b7', '#f72585', '#3a0ca3'];
      }
      const myColor = room.availableColors.shift();

      room.players.push({
        id: socket.id,
        name: name || 'Host',
        team: myColor,
        ready: false,
        cards: [],
        socketIds: [socket.id]
      });
      room.markModified('availableColors');
      await room.save();
      socket.join(room.id);
      socket.emit('roomCreated', { roomId: room.id, room: serializeRoom(room) });
    } catch (error) {
      console.error(error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  socket.on('joinRoom', async ({ roomId, name }) => {
    try {
      const room = await Room.findOne({ id: roomId.toUpperCase() });
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (room.gameStarted) {
        const activeSockets = await io.in(room.id).fetchSockets();
        if (activeSockets.length === 0) {
          await Room.deleteOne({ id: room.id });
          socket.emit('error', { message: 'Game has expired. Please create a new room.' });
          return;
        }

        // Allow reconnecting to existing players
        const existing = room.players.find(p => (p.socketIds && p.socketIds.includes(socket.id)) || p.name === name);
        if (existing) {
          if (existing.socketIds) existing.socketIds.push(socket.id);
          else existing.socketIds = [socket.id];
          await room.save();
          socket.join(room.id);
          socket.emit('joinedRoom', { roomId: room.id, room: serializeRoom(room) });
          return;
        }
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      const existing = room.players.find(p => p.socketIds && p.socketIds.includes(socket.id));
      if (existing) {
        socket.emit('error', { message: 'Already in room' });
        return;
      }
      if (!room.availableColors || room.availableColors.length === 0) {
        room.availableColors = ['#e63946', '#4cc9f0', '#06d6a0', '#ffd166', '#7209b7', '#f72585', '#3a0ca3'];
      }
      const myColor = room.availableColors.shift();

      const player = {
        id: socket.id,
        name: name || `Player_${socket.id.substr(0, 4)}`,
        team: myColor,
        ready: false,
        cards: [],
        socketIds: [socket.id]
      };
      room.players.push(player);
      room.markModified('availableColors');
      await room.save();
      socket.join(room.id);
      socket.emit('joinedRoom', { roomId: room.id, room: serializeRoom(room) });
      await broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room), socket.id);
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });
  // ─── Rejoin a game in progress ───────────────────────────
  socket.on('rejoinRoom', async ({ roomId, name }) => {
    try {
      const room = await Room.findOne({ id: roomId.toUpperCase() });
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      const existing = room.players.find(p => p.name === name);
      if (!existing) {
        socket.emit('error', { message: 'Player not found in room – try joining as a new player' });
        return;
      }
      // Update socket ID
      existing.socketIds = existing.socketIds.filter(id => id !== socket.id);
      existing.socketIds.push(socket.id);
      // Unpause the game
      room.paused = false;
      room.markModified('players');
      await room.save();
      socket.join(room.id);
      // Use 'gameRejoined' so client goes to GAME screen, not lobby, with full hand
      socket.emit('gameRejoined', { roomId: room.id, room: serializeRoom(room) });
      await broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room));
    } catch (err) {
      console.error(err);
      socket.emit('error', { message: 'Failed to rejoin room' });
    }
  });


  socket.on('toggleReady', async (roomIdOrObj) => {
    const roomId = typeof roomIdOrObj === 'object' ? roomIdOrObj.roomId : roomIdOrObj;
    if (!roomId) return;
    const room = await Room.findOne({ id: roomId });
    if (!room) return;
    const player = room.players.find(p => p.socketIds && p.socketIds.includes(socket.id));
    if (!player) return;
    player.ready = !player.ready;
    await room.save();
    await broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
  });

  socket.on('startGame', async (roomIdOrObj) => {
    const roomId = typeof roomIdOrObj === 'object' ? roomIdOrObj.roomId : roomIdOrObj;
    if (!roomId) return;
    const room = await Room.findOne({ id: roomId });
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    const hostPlayer = room.players.find(p => p.id === room.hostId);
    if (!hostPlayer || !(hostPlayer.socketIds && hostPlayer.socketIds.includes(socket.id))) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players' });
      return;
    }
    if (!room.players.every(p => p.ready)) {
      socket.emit('error', { message: 'Not all players ready' });
      return;
    }
    initializeGame(room);
    await room.save();
    socket.emit('gameStarted', { roomId });
    await broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room)); // sync state instantly
  });

  socket.on('placeCard', async ({ roomId, card, boardPos }) => {
    const room = await Room.findOne({ id: roomId });
    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'Game not in progress' });
      return;
    }
    if (room.paused) {
      socket.emit('error', { message: 'Game is paused – waiting for a player to reconnect' });
      return;
    }
    const player = room.players.find(p => p.socketIds && p.socketIds.includes(socket.id));
    if (!player) {
      socket.emit('error', { message: 'Not in room' });
      return;
    }
    const currentPlayerIndex = room.players.findIndex(p => p.socketIds && p.socketIds.includes(socket.id));
    if (room.turnIndex !== currentPlayerIndex) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    // Validate card in hand
    const cardIndex = player.cards.findIndex(c => cardEquals(c, card));
    if (cardIndex === -1) {
      socket.emit('error', { message: 'Card not in hand' });
      return;
    }
    // Bounds check for boardPos
    if (boardPos.r < 0 || boardPos.r >= BOARD_SIZE || boardPos.c < 0 || boardPos.c >= BOARD_SIZE) {
      socket.emit('error', { message: 'Invalid board position' });
      return;
    }

    // Helper to draw a card & advance turn
    async function finishTurn(placedPos) {
      room.lastPlacedPos = placedPos;  // broadcast to ALL players so they all see the glow
      room.markModified('lastPlacedPos');
      if (room.deck.length === 0) {
        room.deck = [...room.discardPile];
        room.discardPile = [];
        shuffle(room.deck);
      }
      player.cards.push(room.deck.pop());
      nextTurn(room);
      updateSequencesAndLocks(room);
      room.markModified('board');
      room.markModified('players');
      room.markModified('deck');
      room.markModified('discardPile');
      room.markModified('sequences');
      await room.save();
      await broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
    }

    // ── Two-eyed Jack (♥ or ♦ J): place chip ANYWHERE unoccupied ────────────
    if (isTwoEyedJack(card)) {
      const cellCorner = isCorner(boardPos.r, boardPos.c);
      if (cellCorner) {
        // Corners are permanently wild – Jacks can't place there
        socket.emit('error', { message: 'Cannot place on a corner (already wild)' });
        return;
      }
      if (room.board[boardPos.r][boardPos.c]) {
        socket.emit('error', { message: 'Cell already occupied' });
        return;
      }
      room.board[boardPos.r][boardPos.c] = { color: player.team, locked: false };
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      updateSequencesAndLocks(room);
      if (room.winner) {
        const winnerPlayer = room.players.find(p => p.team === room.winner);
        await broadcastToRoom(roomId, 'gameOver', { winner: winnerPlayer ? winnerPlayer.name : 'Unknown' });
        await Room.deleteOne({ id: room.id });
        return;
      }
      await finishTurn(boardPos);
      return;
    }

    // ── One-eyed Jack (♠ or ♣ J): remove an OPPONENT's chip ─────────────────
    if (isOneEyedJack(card)) {
      const target = room.board[boardPos.r][boardPos.c];
      if (!target) {
        socket.emit('error', { message: 'No chip at that position to remove' });
        return;
      }
      if (target.locked) {
        socket.emit('error', { message: 'Cannot remove a chip that is part of a completed sequence' });
        return;
      }
      if (target.color === player.team) {
        socket.emit('error', { message: 'Cannot remove your own chip' });
        return;
      }
      room.board[boardPos.r][boardPos.c] = null;
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      await finishTurn(boardPos);
      return;
    }

    // ── Normal card placement ─────────────────────────────────────────────────
    const corner = isCorner(boardPos.r, boardPos.c);
    if (!corner) {
      const expected = room.cardPositions[boardPos.r][boardPos.c];
      if (!expected) {
        socket.emit('error', { message: 'No card picture at this position' });
        return;
      }
      const expectedCard = { rank: expected.slice(0, -1), suit: expected.slice(-1), display: expected };
      if (!cardEquals(card, expectedCard)) {
        socket.emit('error', { message: 'Card does not match board position' });
        return;
      }
    }
    if (room.board[boardPos.r][boardPos.c]) {
      socket.emit('error', { message: 'Cell already occupied' });
      return;
    }
    // ── Normal card placement ─────────────────────────────────────────────────
    room.board[boardPos.r][boardPos.c] = { color: player.team, locked: false };
    player.cards.splice(cardIndex, 1);
    room.discardPile.push(card);
    updateSequencesAndLocks(room);
    if (room.winner) {
      room.lastPlacedPos = boardPos;
      room.markModified('lastPlacedPos');
      await room.save();
      const winnerPlayer = room.players.find(p => p.team === room.winner);
      await broadcastToRoom(roomId, 'gameOver', { winner: winnerPlayer ? winnerPlayer.name : 'Unknown' });
      await Room.deleteOne({ id: room.id });
      return;
    }
    await finishTurn(boardPos);

  });

  socket.on('leaveRoom', async () => {
    const rooms = await Room.find({ "players.socketIds": socket.id });
    for (const room of rooms) {
      if (!room.gameStarted) {
        await Room.deleteOne({ id: room.id });
      } else {
        const activePlayers = room.players.filter(p => p.socketIds && p.socketIds.length > 0 && p.id !== socket.id);
        if (activePlayers.length === 0) {
          await Room.deleteOne({ id: room.id });
        }
      }
    }
  });

  socket.on('disconnect', async () => {
    // Find all rooms this socket is part of
    const rooms = await Room.find({ "players.socketIds": socket.id });
    for (const room of rooms) {
      const idx = room.players.findIndex(p => p.socketIds && p.socketIds.includes(socket.id));
      if (idx !== -1) {

        if (!room.gameStarted) {
          // Completely strip player and retrieve color
          const removedPlayer = room.players.splice(idx, 1)[0];

          if (removedPlayer.team) {
            room.availableColors.push(removedPlayer.team);
            room.markModified('availableColors');
          }

          if (room.players.length === 0) {
            await Room.deleteOne({ id: room.id });
            continue; // Room dead, skip updates
          } else if (room.hostId === removedPlayer.id) {
            // Reassign host
            room.hostId = room.players[0].id;
          }
        } else {
          // If game started, just remove the socket connection
          const player = room.players[idx];
          player.socketIds = player.socketIds.filter(id => id !== socket.id);

          // If no active sockets left across ALL players in a started game, nuke it
          const anyActive = room.players.some(p => p.socketIds && p.socketIds.length > 0);
          if (!anyActive) {
            await Room.deleteOne({ id: room.id });
            continue;
          }

          // Player has no remaining sockets — mark offline, game continues
          if (player.socketIds.length === 0) {
            // Do NOT pause — just notify others so they see "offline" status
            try {
              room.markModified('players');
              await room.save();
            } catch (err) { console.error("Disconnect save error:", err.message); }
            await broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room));
            continue;
          }
        }

        try {
          room.markModified('players');
          await room.save();
        } catch (err) { console.error("Global disconnect save error:", err.message); }
        await broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room));
      }
    }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sequence server listening on port ${PORT}`);
});