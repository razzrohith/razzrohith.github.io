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

// Board card layout (from Wikipedia/official Sequence)
// 10x10 grid showing which card picture sits in each cell (corners are free/wild => null)
const BOARD_LAYOUT = [
  // Row 0
  [ null, '5♣', null, '7♣', '8♣', '9♣', '10♣', 'J♣', 'Q♣', null ],
  // Row 1
  [ '4♦', null, '6♦', null, '8♦', null, '10♦', null, 'Q♦', 'A♦' ],
  // Row 2
  [ null, '5♦', null, '7♦', null, '9♦', null, 'J♦', null, 'K♦' ],
  // Row 3
  [ '4♥', null, '6♥', null, '8♥', null, '10♥', null, 'Q♥', 'A♥' ],
  // Row 4
  [ '5♥', null, '7♥', null, '9♥', null, 'J♥', null, 'K♥', '2♥' ],
  // Row 5
  [ '6♥', null, '8♥', null, '10♥', null, 'Q♥', null, 'A♥', '3♥' ],
  // Row 6
  [ '7♥', null, '9♥', null, 'J♥', null, 'K♥', null, '2♥', '4♥' ],
  // Row 7
  [ '8♥', null, '10♥', null, 'Q♥', null, 'A♥', null, '3♥', '5♥' ],
  // Row 8
  [ '9♥', null, 'J♥', null, 'K♥', null, '2♥', null, '4♥', '6♥' ],
  // Row 9
  [ null, '10♠', 'J♠', 'Q♠', 'K♠', 'A♠', '2♠', '3♠', '4♠', null ]
];

// Validate BOARD_LAYOUT shape
for (let r = 0; r < BOARD_SIZE; r++) {
  if (BOARD_LAYOUT[r].length !== BOARD_SIZE) {
    throw new Error(`Row ${r} has ${BOARD_LAYOUT[r].length} columns, expected ${BOARD_SIZE}`);
  }
}

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
  // Add 4 jokers (eye of the tiger? but we just mark as JOKER)
  for (let i = 0; i < 4; i++) {
    deck.push({ rank: 'JOKER', suit: '', display: 'JOKER' });
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

// Room management
const rooms = new Map();

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function createRoom(hostId, hostName) {
  const roomId = generateRoomCode();
  const room = {
    id: roomId,
    hostId,
    board: Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null)),
    cardPositions: BOARD_LAYOUT, // fixed picture per cell (null for free spaces?)
    players: [],
    deck: [],
    discardPile: [],
    sequences: [],
    winner: null,
    turnIndex: 0,
    gameStarted: false,
    createdAt: Date.now()
  };
  rooms.set(roomId, room);
  return room;
}

function getPlayerSocketIds(room) {
  return room.players.flatMap(p => p.socketIds || []);
}

function broadcastToRoom(roomId, event, data, excludeSocketId = null) {
  const room = rooms.get(roomId);
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

function checkForSequence(room, r, c, color) {
  // Check 4 directions: horizontal, vertical, diagonal /, diagonal \
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  for (const [dr, dc] of directions) {
    let count = 1;
    // forward
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && room.board[rr][cc] && room.board[rr][cc].color === color) {
      count++;
      rr += dr; cc += dc;
    }
    // backward
    rr = r - dr; cc = c - dc;
    while (rr >= 0 && rr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && room.board[rr][cc] && room.board[rr][cc].color === color) {
      count++;
      rr -= dr; cc -= dc;
    }
    if (count >= 5) {
      // record sequence as sorted cells
      const cells = [];
      for (let i = 0; i < count; i++) {
        cells.push({ r: r + (i - Math.floor(count/2)) * dr, c: c + (i - Math.floor(count/2)) * dc });
        // Actually we need to collect from both ends; easier: iterate from start to end.
      }
      // Better: collect from start to end properly
      // Let's compute start point:
      let startR = r, startC = c;
      while (true) {
        const nr = startR - dr, nc = startC - dc;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE || !room.board[nr][nc] || room.board[nr][nc].color !== color) break;
        startR = nr; startC = nc;
      }
      const lineCells = [];
      let cr = startR, cc = startC;
      while (cr >= 0 && cr < BOARD_SIZE && cc >= 0 && cc < BOARD_SIZE && room.board[cr][cc] && room.board[cr][cc].color === color) {
        lineCells.push({ r: cr, c: cc });
        cr += dr; cc += dc;
      }
      // Record sequence
      const seqKey = lineCells.map(c => `${c.r},${c.c}`).sort().join('|');
      if (!room.sequences.includes(seqKey)) {
        room.sequences.push(seqKey);
        // award point to team (or player?) Track by team color. team stored in player.team (color or player id)
        // Determine which team this color belongs to: if color is player.team (could be player.id for non-team mode). We'll just count by color.
        // We could keep score elsewhere. For now, we'll check if a team got two sequences to win.
        // Winning: a team has two sequences (officially). Or if they have 9 in one row counts as 2.
        // We'll compute sequences per team:
        // map teamId -> count of distinct sequence keys
      }
    }
  }
}

// Actually compute sequences after each move: easier to recompute all sequences for both teams?
// We'll store sequences as set of cells (per key). When a chip placed, check for new sequences that include that chip, add them if not already present.
function addSequenceIfNew(room, cells) {
  // cells: array of {r,c} forming a straight line of same color
  const sorted = cells.map(c => `${c.r},${c.c}`).sort().join('|');
  if (!room.sequences.includes(sorted)) {
    room.sequences.push(sorted);
    return true;
  }
  return false;
}

// Instead of complex direction scanning each time, we can check 4 directions from the placed chip for its color and count length including placed cell. Then if 5+ in line, record the exact set. Let's implement that.
function detectSequencesForChip(room, r, c) {
  const cell = room.board[r][c];
  if (!cell) return []; // no chip
  const color = cell.color;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  const newSeqs = [];
  for (const [dr, dc] of dirs) {
    // get contiguous line along this direction that includes (r,c)
    let line = [{r,c}];
    // forward
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && room.board[nr][nc] && room.board[nr][nc].color === color) {
      line.push({r: nr, c: nc});
      nr += dr; nc += dc;
    }
    // backward
    nr = r - dr; nc = c - dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && room.board[nr][nc] && room.board[nr][nc].color === color) {
      line.push({r: nr, c: nc});
      nr -= dr; nc -= dc;
    }
    if (line.length >= 5) {
      // This line is a potential sequence. Need to see if it's already counted. Since overlapping lines could be counted multiple times. To avoid duplicates, we'll store normalized representation: sort by coords.
      line.sort((a,b) => a.r - b.r || a.c - b.c);
      const key = line.map(p => `${p.r},${p.c}`).join('|');
      if (!room.sequences.includes(key)) {
        room.sequences.push(key);
        // Lock all cells in this sequence
        line.forEach(p => {
          if (room.board[p.r][p.c]) room.board[p.r][p.c].locked = true;
        });
        newSeqs.push(key);
      }
    }
  }
  return newSeqs;
}

// After a sequence is added, check if the team (color) now has 2 sequences, or one sequence of length >=9 (counts as 2)
function checkWinner(room) {
  // Count sequences per color
  const counts = {};
  for (const seqKey of room.sequences) {
    const cells = seqKey.split('|').map(s => ({ r: parseInt(s.split(',')[0]), c: parseInt(s.split(',')[1]) }));
    // Determine color by looking at any cell (all same)
    const { r, c } = cells[0];
    const color = room.board[r][c].color;
    counts[color] = (counts[color] || 0) + 1;
    if (cells.length >= 9) {
      // Extra point? Actually official: 9 in a row counts as 2 sequences. So we add an extra.
      counts[color] += 1;
    }
    if (counts[color] >= 2) {
      // Find which player/team this color belongs to
      // For simplicity, if color is player.id (when no team) or team value (could be string like 'red'?). We'll just set winner to color.
      room.winner = color;
      return color;
    }
  }
  return null;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createRoom', ({ name }) => {
    const room = createRoom(socket.id, name || 'Host');
    room.players.push({
      id: socket.id,
      name: name || 'Host',
      team: socket.id, // default team = player ID (color)
      ready: false,
      cards: [],
      socketIds: [socket.id]
    });
    socket.join(room.id);
    socket.emit('roomCreated', { roomId: room.id, room: serializeRoom(room) });
  });

  socket.on('joinRoom', ({ roomId, name }) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.gameStarted) {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }
    const existing = room.players.find(p => p.id === socket.id);
    if (existing) {
      socket.emit('error', { message: 'Already in room' });
      return;
    }
    const player = {
      id: socket.id,
      name: name || `Player_${socket.id.substr(0,4)}`,
      team: socket.id,
      ready: false,
      cards: [],
      socketIds: [socket.id]
    };
    room.players.push(player);
    socket.join(room.id);
    socket.emit('joinedRoom', { roomId: room.id, room: serializeRoom(room) });
    broadcastToRoom(room.id, 'roomUpdate', serializeRoom(room), socket.id);
  });

  socket.on('setTeam', ({ roomId, team }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find(p => p.id === socket.id);
    if (!player) return;
    player.team = team; // team can be color string or player ID
    broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
  });

  socket.on('toggleReady', ({ roomId }) => {
    const room = rooms.get(roomId);
    const player = room?.players.find(p => p.id === socket.id);
    if (!player) return;
    player.ready = !player.ready;
    broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
  });

  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    if (room.hostId !== socket.id) {
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
    socket.emit('gameStarted', { roomId });
  });

  socket.on('placeCard', ({ roomId, card, boardPos }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'Game not in progress' });
      return;
    }
    const player = room.players.find(p => p.id === socket.id);
    if (!player) {
      socket.emit('error', { message: 'Not in room' });
      return;
    }
    if (room.turnIndex !== room.players.findIndex(p => p.id === socket.id)) {
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
    // Corners are wild: any card can be placed on a corner (including jokers) as long as cell empty
    const corner = isCorner(boardPos.r, boardPos.c);
    if (!corner) {
      // Normal placement: card must match picture on board at that position
      const expected = room.cardPositions[boardPos.r][boardPos.c];
      if (!expected) {
        socket.emit('error', { message: 'No card picture at this position' });
        return;
      }
      // Build expected card object
      const expectedCard = { rank: expected.slice(0, -1), suit: expected.slice(-1), display: expected };
      if (!cardEquals(card, expectedCard)) {
        socket.emit('error', { message: 'Card does not match board position' });
        return;
      }
    }
    // Check if cell already occupied
    if (room.board[boardPos.r][boardPos.c]) {
      socket.emit('error', { message: 'Cell already occupied' });
      return;
    }
    // Two-eyed Jack (wild) placement: allowed anywhere (including corners)
    if (isTwoEyedJack(card)) {
      // place it; color = player's team
      room.board[boardPos.r][boardPos.c] = { color: player.team, locked: false };
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      // Check for sequences created by this chip
      const newSeqs = detectSequencesForChip(room, boardPos.r, boardPos.c);
      if (newSeqs.length > 0) {
        const maybeWinner = checkWinner(room);
        if (maybeWinner) {
          room.winner = maybeWinner;
          // Find winning player name
          const winnerPlayer = room.players.find(p => p.team === maybeWinner);
          broadcastToRoom(roomId, 'gameOver', { winner: winnerPlayer ? winnerPlayer.name : 'Unknown' });
        }
      }
      // Draw replacement card
      if (room.deck.length === 0) {
        room.deck = room.discardPile;
        room.discardPile = [];
        shuffle(room.deck);
      }
      player.cards.push(room.deck.pop());
      nextTurn(room);
      broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
      return;
    }
    // One-eyed Jack: remove opponent's chip
    if (isOneEyedJack(card)) {
      if (!boardPos) {
        socket.emit('error', { message: 'Select a chip to remove' });
        return;
      }
      if (boardPos.r < 0 || boardPos.r >= BOARD_SIZE || boardPos.c < 0 || boardPos.c >= BOARD_SIZE) {
        socket.emit('error', { message: 'Invalid cell' });
        return;
      }
      const target = room.board[boardPos.r][boardPos.c];
      if (target && target.locked) {
        socket.emit('error', { message: 'Cannot remove chip from a completed sequence' });
        return;
      }
      if (!target) {
        socket.emit('error', { message: 'No chip at that position' });
        return;
      }
      // Cannot remove if chip is locked (by sequence?) Officially, one-eyed jack can remove any opponent chip that is not part of a completed sequence. We ignore lock for now.
      // Opponent check: target.color must not equal player's team (or same player if free-for-all). We'll assume teams are separate.
      if (target.color === player.team) {
        socket.emit('error', { message: 'Cannot remove your own chip' });
        return;
      }
      // Remove it
      room.board[boardPos.r][boardPos.c] = null;
      player.cards.splice(cardIndex, 1);
      room.discardPile.push(card);
      // Draw replacement
      if (room.deck.length === 0) {
        room.deck = room.discardPile;
        room.discardPile = [];
        shuffle(room.deck);
      }
      player.cards.push(room.deck.pop());
      nextTurn(room);
      broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
      return;
    }
    // Normal card placement: must match board picture and cell empty (already checked)
    room.board[boardPos.r][boardPos.c] = { color: player.team, locked: false };
    // Remove card from hand, add to discard
    player.cards.splice(cardIndex, 1);
    room.discardPile.push(card);
    // Check for sequences
    const newSeqs = detectSequencesForChip(room, boardPos.r, boardPos.c);
    if (newSeqs.length > 0) {
      const maybeWinner = checkWinner(room);
      if (maybeWinner) {
        room.winner = maybeWinner;
        const winnerPlayer = room.players.find(p => p.team === maybeWinner);
        broadcastToRoom(roomId, 'gameOver', { winner: winnerPlayer ? winnerPlayer.name : 'Unknown' });
      }
    }
    // Draw replacement
    if (room.deck.length === 0) {
      room.deck = room.discardPile;
      room.discardPile = [];
      shuffle(room.deck);
    }
    player.cards.push(room.deck.pop());
    nextTurn(room);
    broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
  });

  socket.on('disconnect', () => {
    // Remove player from all rooms
    for (const [roomId, room] of rooms.entries()) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        // If room empty, delete
        if (room.players.length === 0) {
          rooms.delete(roomId);
        } else {
          // If host left, assign new host
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].id;
          }
          broadcastToRoom(roomId, 'roomUpdate', serializeRoom(room));
        }
        break;
      }
    }
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Sequence server listening on port ${PORT}`);
});