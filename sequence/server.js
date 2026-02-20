const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

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
function createDeck() {
  const deck = [];
  // Two standard decks
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
  // Map non-jack cards to two positions on the board (except corners which are wild)
  // We'll assign each card (except Jacks) to 2 random non-corner cells
  const positions = {};
  const availableCells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!CORNERS.find(cor => cor.r === r && cor.c === c)) {
        availableCells.push({ r, c });
      }
    }
  }
  // Shuffle cells
  for (let i = availableCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableCells[i], availableCells[j]] = [availableCells[j], availableCells[i]];
  }
  // For each non-jack card, assign next 2 cells
  const nonJackCards = RANKS.filter(r => r !== 'J');
  let idx = 0;
  for (let s of SUITS) {
    for (let r of nonJackCards) {
      const cardId = `${r}${s}`;
      positions[cardId] = [
        availableCells[idx++],
        availableCells[idx++]
      ];
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

function checkSequence(board, playerColor, cornersAsWild = true) {
  const sequences = [];
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];
  const visited = new Set();

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = board[r][c];
      if (!cell || cell.color !== playerColor) continue;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;

      for (let [dr, dc] of directions) {
        let line = [{ r, c }];
        // forward
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const next = board[nr][nc];
          if (next && next.color === playerColor) {
            line.push({ r: nr, c: nc });
            nr += dr; nc += dc;
          } else break;
        }
        // backward (opposite direction)
        nr = r - dr; nc = c - dc;
        while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
          const prev = board[nr][nc];
          if (prev && prev.color === playerColor) {
            line.unshift({ r: nr, c: nc });
            nr -= dr; nc -= dc;
          } else break;
        }
        if (line.length >= 5) {
          // Mark cells as visited to avoid duplicate detection
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
  // Skip dead players? Not needed; all players must have cards.
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
  // Shuffle deck
  room.deck = createDeck();
  room.discardPile = [];
  room.board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
  // Mark corners as wild: they are always available for any color but cannot be occupied initially? Actually corners count as chips for all but cannot be occupied by chips. In digital version, we'll treat them as always contributing to sequences but no chip placed. So board[r][c] remains null for corners.
  room.sequences = [];
  room.winner = null;
  room.gameStarted = true;
  // Deal cards
  const playerCount = room.players.length;
  const cardsPerPlayer = CARD_DISTRIBUTION[playerCount] || 3;
  for (let p of room.players) {
    p.cards = [];
    for (let i = 0; i < cardsPerPlayer; i++) {
      if (room.deck.length === 0) {
        // reshuffle discard if needed
        room.deck = room.discardPile;
        room.discardPile = [];
      }
      p.cards.push(room.deck.pop());
    }
  }
  room.turnIndex = 0;
  broadcastRoom(room.id);
}

// --- Socket.io Events ---
io.on('connection', (socket) => {
  console.log('Client connected', socket.id);

  socket.on('createRoom', ({ userName }) => {
    const roomId = createRoom(socket.id, userName);
    const room = rooms[roomId];
    // Add host as player
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
    // Join
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
    const player = getPlayerWithId(room, socket.id);
    if (player && !player.isHost) {
      player.ready = !player.ready;
      broadcastRoom(roomId);
    }
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    const player = getPlayerWithId(room, socket.id);
    if (player && player.isHost && room.players.length >= 2) {
      // All players must be ready or skipping ready check? We'll start regardless.
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

    // Handle one-eyed jack removal
    if (isOneEyedJack(card)) {
      // boardPos must be provided with chip to remove
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
      const targetColor = target.color;
      // Cannot remove from corner (corners not occupied anyway)
      // Remove chip
      room.board[boardPos.r][boardPos.c] = null;
      // Discard the one-eyed jack
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      // Draw new card
      if (room.deck.length === 0) {
        room.deck = room.discardPile;
        room.discardPile = [];
      }
      player.cards.push(room.deck.pop());
      nextTurn(room);
      // Re-check sequences after removal? Usually removed chip remains locked? We'll keep locked status separate. In our implementation, locked chips are not removable, so any removal doesn't affect sequences.
      broadcastRoom(roomId);
      return;
    }

    // Two-eyed jack or normal card
    if (isTwoEyedJack(card)) {
      // Can place on any empty cell
      if (!boardPos) {
        socket.emit('error', { message: 'Select an empty cell' });
        return;
      }
      if (room.board[boardPos.r][boardPos.c]) {
        socket.emit('error', { message: 'Cell occupied' });
        return;
      }
      // Place chip
      room.board[boardPos.r][boardPos.c] = { color: player.team || player.id, locked: false };
      // Discard played card
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
    } else {
      // Normal card: must use one of its two board positions
      const positions = room.cardPositions[card.id];
      if (!positions) {
        socket.emit('error', { message: 'Invalid card' });
        return;
      }
      // Find an available position
      let chosen = boardPos;
      if (!chosen) {
        // frontend should send chosen position
        socket.emit('error', { message: 'Select a board position' });
        return;
      }
      const valid = positions.find(p => p.r === chosen.r && p.c === chosen.c);
      if (!valid) {
        socket.emit('error', { message: 'Invalid position for this card' });
        return;
      }
      const cell = room.board[chosen.r][chosen.c];
      if (cell) {
        socket.emit('error', { message: 'Position already occupied' });
        return;
      }
      room.board[chosen.r][chosen.c] = { color: player.team || player.id, locked: false };
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
    }

    // Draw replacement
    if (room.deck.length === 0) {
      room.deck = room.discardPile;
      room.discardPile = [];
    }
    player.cards.push(room.deck.pop());

    // Check for new sequences for this player color
    const color = player.team || player.id;
    const newSequences = checkSequence(room.board, color);
    // New sequences: lock chips that formed them if not already locked
    for (let seq of newSequences) {
      // Check if this sequence was already counted? We'll maintain room.sequences as array of sequences (sets of positions). We need to avoid duplicates.
      const positionsSet = new Set(seq.map(p => `${p.r},${p.c}`));
      const alreadyCounted = room.sequences.some(existing =>
        existing.every(pos => positionsSet.has(`${pos.r},${pos.c}`))
      );
      if (!alreadyCounted) {
        room.sequences.push(seq);
        // Lock chips
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
    // Remove player from rooms
    for (let roomId in rooms) {
      const room = rooms[roomId];
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        // If host left, assign new host or delete room if empty
        if (room.hostId === socket.id) {
          if (room.players.length > 0) {
            room.hostId = room.players[0].id;
          } else {
            delete rooms[roomId];
            return;
          }
        }
        // If game in progress and a player leaves, consider ending game or continue?
        // We'll continue but mark that player as left.
        broadcastRoom(roomId);
        break;
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sequence server listening on port ${PORT}`);
});