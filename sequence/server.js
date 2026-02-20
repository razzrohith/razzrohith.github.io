const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Immediate startup log to confirm process is running
console.log('=== Sequence server starting ===');

// Global error handlers to prevent silent crashes
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});
server.on('error', (err) => {
  console.error('Server error:' , err);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Log startup info
console.log('Working directory:', process.cwd());
console.log('PORT from env:', process.env.PORT);

// --- Game Constants ---
const BOARD_SIZE = 10;
const CARD_DISTRIBUTION = {
  2: 7,
  3: 6,
  4: 6,
  5: 5,
  6: 4,
  8: 3,
  9: 3,
  10: 3,
  11: 3,
  12: 3
};
const SUITS = ['♣', '♦', '♥', '♠'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#7c3aed', '#0d9488', '#f59e0b'];
const CORNERS = [
  { r: 0, c: 0 },
  { r: 0, c: 9 },
  { r: 9, c: 0 },
  { r: 9, c: 9 }
];

// --- Helper Functions ---
function isCorner(r, c) {
  return CORNERS.some(cor => cor.r === r && cor.c === c);
}

function createDeck() {
  const deck = [];
  for (let d = 0; d < 2; d++) {
    for (let s of SUITS) {
      for (let r of RANKS) {
        deck.push({ suit: s, rank: r, id: `${r}${s}` });
      }
    }
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function getBoardCardPositions() {
  const positions = {};
  const availableCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!isCorner(r, c)) {
        availableCells.push({ r, c });
      }
    }
  }
  // Shuffle cells
  for (let i = availableCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
  }
  const nonJackCards = RANKS.filter(r => r !== 'J');
  let idx = 0;
  for (let s of SUITS) {
    for (let r of nonJackCards) {
      const cardId = `${r}${s}`;
      positions[cardId] = [availableCells[idx++], availableCells[idx++]];
    }
  }
  return positions;
}

function isOneEyedJack(card) {
  return card.rank === 'J' && (card.suit === '♠' || card.suit === '♣');
}

function isTwoEyedJack(card) {
  return card.rank === 'J' && (card.suit === '♥' || card.suit === '♦');
}

function checkSequence(board, playerColor) {
  const sequences = [];
  const directions = [[1,0],[0,1],[1,1],[1,-1]];
  const visited = new Set();

  function cellFits(r, c) {
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (isCorner(r, c)) return true;
    const cell = board[r][c];
    return cell && cell.color === playerColor;
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!cellFits(r, c)) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      for (let [dr, dc] of directions) {
        let line = [{ r, c }];
        let nr = r + dr, nc = c + dc;
        while (cellFits(nr, nc)) {
          line.push({ r: nr, c: nc });
          nr += dr; nc += dc;
        }
        nr = r - dr; nc = c - dc;
        while (cellFits(nr, nc)) {
          line.unshift({ r: nr, c: nc });
          nr -= dr; nc -= dc;
        }
        if (line.length >= 5) {
          line.forEach(p => visited.add(`${p.r},${p.c}`));
          sequences.push(line);
        }
      }
    }
  }
  return sequences;
}

function allCornersTaken(board) {
  return CORNERS.every(cor => board[cor.r][cor.c] && board[cor.r][cor.c].color !== null);
}

// --- Room Management ---
const rooms = {};

function createRoom(hostId, hostName) {
  const roomId = uuidv4().substring(0, 6).toUpperCase();
  rooms[roomId] = {
    id: roomId,
    players: [],
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    deck: [],
    discardPile: [],
    turnIndex: 0,
    sequences: [],
    winner: null,
    gameStarted: false,
    cardPositions: getBoardCardPositions(),
    hostId
  };
  return roomId;
}

function getPlayerWithId(room, playerId) {
  return room.players.find(p => p.id === playerId);
}

function nextTurn(room) {
  const playerCount = room.players.length;
  let next = (room.turnIndex + 1) % playerCount;
  room.turnIndex = next;
}

function broadcastRoom(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  io.to(roomId).emit('roomUpdate', serializeRoom(room));
}

function serializeRoom(room) {
  return {
    id: room.id,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      team: p.team,
      ready: p.ready,
      cards: p.cards,
      isHost: p.id === room.hostId
    })),
    board: room.board.map(row => row.map(cell => cell ? { color: cell.color, locked: cell.locked } : null)),
    turnIndex: room.turnIndex,
    sequences: room.sequences,
    winner: room.winner,
    gameStarted: room.gameStarted,
    cardPositions: room.cardPositions
  };
}

function initializeGame(room) {
  // Auto-assign teams for any unassigned player
  for (let p of room.players) {
    if (p.team === null) {
      // Find a team with fewer than 2 players (max 2 per team for visuals)
      for (let t = 0; t < COLORS.length; t++) {
        const count = room.players.filter(pp => pp.team === t).length;
        if (count < 2) {
          p.team = t;
          break;
        }
      }
      // If all teams full, assign sequentially
      if (p.team === null) p.team = room.players.indexOf(p) % COLORS.length;
    }
  }

  room.deck = createDeck();
  room.discardPile = [];
  room.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  room.sequences = [];
  room.winner = null;
  room.gameStarted = true;
  const playerCount = room.players.length;
  const cardsPerPlayer = CARD_DISTRIBUTION[playerCount] || 3;
  for (let p of room.players) {
    p.cards = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      if (room.deck.length === 0) {
        room.deck = room.discardPile;
        room.discardPile = [];
      }
      p.cards.push(room.deck.pop());
    }
  }
  room.turnIndex = 0;
  broadcastRoom(room.id);
}

// --- Socket Events ---
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('createRoom', ({ userName }) => {
    const roomId = createRoom(socket.id, userName);
    const room = rooms[roomId];
    room.players.push({
      id: socket.id,
      name: userName,
      team: null,
      ready: true,
      cards: []
    });
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, isHost: true });
    broadcastRoom(roomId);
  });

  socket.on('joinRoom', ({ roomId, userName }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStarted) {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    socket.join(roomId);
    room.players.push({
      id: socket.id,
      name: userName,
      team: null,
      ready: false,
      cards: []
    });
    socket.emit('joinedRoom', { roomId, isHost: false });
    broadcastRoom(roomId);
  });

  socket.on('setTeam', ({ roomId, team }) => {
    const room = rooms[roomId];
    const player = getPlayerWithId(room, socket.id);
    if (player) {
      player.team = team;
      broadcastRoom(roomId);
    }
  });

  socket.on('toggleReady', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', { message: 'Room not found. Rejoin?' });
      return;
    }
    const player = getPlayerWithId(room, socket.id);
    if (!player) {
      socket.emit('error', { message: 'You are not in this room' });
      return;
    }
    // Anyone can toggle ready
    player.ready = !player.ready;
    broadcastRoom(roomId);
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    const player = getPlayerWithId(room, socket.id);
    if (player && player.isHost && room.players.length >= 2) {
      initializeGame(room);
    }
  });

  socket.on('playCard', ({ roomId, cardIndex, boardPos }) => {
    const room = rooms[roomId];
    if (!room || !room.gameStarted) return;
    const player = getPlayerWithId(room, socket.id);
    if (!player) return;
    if (room.turnIndex !== room.players.findIndex(p => p.id === socket.id)) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const card = player.cards[cardIndex];
    if (!card) return;

    // One-eyed Jack: remove opponent chip
    if (isOneEyedJack(card)) {
      if (!boardPos) {
        socket.emit('error', { message: 'Select a chip to remove' });
        return;
      }
      const target = room.board[boardPos.r][boardPos.c];
      if (!target) {
        socket.emit('error', { message: 'No chip at that position' });
        return;
      }
      if (target.locked) {
        socket.emit('error', { message: 'Cannot remove a locked sequence chip' });
        return;
      }
      // Remove chip
      room.board[boardPos.r][boardPos.c] = null;
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      // Draw new card
      if (room.deck.length === 0) {
        room.deck = room.discardPile;
        room.discardPile = [];
      }
      player.cards.push(room.deck.pop());
      nextTurn(room);
      broadcastRoom(roomId);
      return;
    }

    // Two-eyed Jack or normal card
    if (isTwoEyedJack(card)) {
      if (!boardPos) {
        socket.emit('error', { message: 'Select an empty cell' });
        return;
      }
      if (room.board[boardPos.r][boardPos.c]) {
        socket.emit('error', { message: 'Cell occupied' });
        return;
      }
      if (isCorner(boardPos.r, boardPos.c)) {
        socket.emit('error', { message: 'Cannot place on corner' });
        return;
      }
      room.board[boardPos.r][boardPos.c] = { color: player.team !== null ? player.team : player.id, locked: false };
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
    } else {
      // Normal card
      const positions = room.cardPositions[card.id];
      if (!positions) {
        socket.emit('error', { message: 'Invalid card' });
        return;
      }
      if (!boardPos) {
        socket.emit('error', { message: 'Select a board position' });
        return;
      }
      const valid = positions.find(p => p.r === boardPos.r && p.c === boardPos.c);
      if (!valid) {
        socket.emit('error', { message: 'Invalid position for this card' });
        return;
      }
      if (room.board[boardPos.r][boardPos.c]) {
        socket.emit('error', { message: 'Position already occupied' });
        return;
      }
      room.board[boardPos.r][boardPos.c] = { color: player.team !== null ? player.team : player.id, locked: false };
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
    }

    // Draw replacement card
    if (room.deck.length === 0) {
      room.deck = room.discardPile;
      room.discardPile = [];
    }
    player.cards.push(room.deck.pop());

    // Check for new sequences
    const color = player.team !== null ? player.team : player.id;
    const newSequences = checkSequence(room.board, color);
    for (let seq of newSequences) {
      const positionsSet = new Set(seq.map(p => `${p.r},${p.c}`));
      const alreadyCounted = room.sequences.some(existing =>
        existing.every(pos => positionsSet.has(`${pos.r},${pos.c}`))
      );
      if (!alreadyCounted) {
        room.sequences.push(seq);
        for (let p of seq) {
          if (room.board[p.r][p.c]) room.board[p.r][p.c].locked = true;
        }
      }
    }

    // Check win condition
    const playerSeqs = room.sequences.filter(seq =>
      seq[0] && room.board[seq[0].r][seq[0].c] &&
      room.board[seq[0].r][seq[0].c].color === color
    ).length;
    const totalPlayers = room.players.length;
    const winThreshold = (totalPlayers === 2 || totalPlayers === 3) ? 2 : 1;
    if (playerSeqs >= winThreshold) {
      room.winner = { playerId: player.id, playerName: player.name };
      broadcastRoom(roomId);
      return;
    }

    nextTurn(room);
    broadcastRoom(roomId);
  });

  socket.on('disconnect', () => {
    for (let roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        if (room.hostId === socket.id) {
          if (room.players.length > 0) {
            room.hostId = room.players[0].id;
          } else {
            delete rooms[roomId];
            return;
          }
        }
        broadcastRoom(roomId);
        break;
      }
    }
  });
});
server.on('error', (err) => {
  console.error('Server error:' , err);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Additional logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const PORT = process.env.PORT || 3000;
<<<<<<< HEAD
const HOST = '0.0.0.0';

console.error(`Starting server on ${HOST}:${PORT}`);
console.error(`Working directory: ${process.cwd()}`);
console.error(`Node version: ${process.version}`);

function startServer() {
  server.listen(PORT, HOST, () => {
    console.error(`Server listening on http://${HOST}:${PORT}`);
  });
}

server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is busy, retrying in 1s...`);
    setTimeout(startServer, 1000);
  } else {
    process.exit(1);
  }
});

startServer();
=======
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sequence server listening on port ${PORT}`);
});
server.on('error', (err) => {
  console.error('Server error:' , err);
});
>>>>>>> origin/main
