const socket = io();

// State
let roomId = null;
let myPlayerId = null;
let isHost = false;
let myTeam = null;
let myCardIndices = {}; // card.id -> index in hand for quick lookup

// DOM elements
const screens = {
  home: document.getElementById('home'),
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  end: document.getElementById('end')
};

const el = {
  createBtn: document.getElementById('createBtn'),
  joinBtn: document.getElementById('joinBtn'),
  roomInput: document.getElementById('roomInput'),
  homeError: document.getElementById('homeError'),
  roomCode: document.getElementById('roomCode'),
  copyBtn: document.getElementById('copyBtn'),
  playerList: document.getElementById('playerList'),
  teamSelect: document.getElementById('teamSelect'),
  teamInput: document.getElementById('teamInput'),
  readyBtn: document.getElementById('readyBtn'),
  startBtn: document.getElementById('startBtn'),
  lobbyError: document.getElementById('lobbyError'),
  leaveLobbyBtn: document.getElementById('leaveLobbyBtn'),
  board: document.getElementById('board'),
  hand: document.getElementById('hand'),
  currentPlayer: document.getElementById('currentPlayer'),
  winCount: document.getElementById('winCount'),
  leaveGameBtn: document.getElementById('leaveGameBtn'),
  winnerText: document.getElementById('winnerText'),
  winnerSubtext: document.getElementById('winnerSubtext'),
  playAgainBtn: document.getElementById('playAgainBtn'),
  backLobbyBtn: document.getElementById('backLobbyBtn')
};

// --- Navigation ---
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// --- Home ---
el.createBtn.addEventListener('click', () => {
  el.homeError.textContent = '';
  socket.emit('createRoom', { userName: `Player${Math.floor(Math.random()*1000)}` });
});

el.joinBtn.addEventListener('click', () => {
  const code = el.roomInput.value.trim().toUpperCase();
  if (!code) return;
  el.homeError.textContent = '';
  socket.emit('joinRoom', { roomId: code, userName: `Player${Math.floor(Math.random()*1000)}` });
});

socket.on('roomCreated', ({ roomId: rid, isHost }) => {
  roomId = rid;
  myPlayerId = socket.id;
  window.location.hash = roomId;
  el.roomCode.textContent = roomId;
  this.isHost = isHost;
  showScreen('lobby');
});

socket.on('joinedRoom', ({ roomId: rid, isHost }) => {
  roomId = rid;
  myPlayerId = socket.id;
  window.location.hash = roomId;
  el.roomCode.textContent = roomId;
  this.isHost = isHost;
  showScreen('lobby');
});

socket.on('error', ({ message }) => {
  if (screens.home.classList.contains('hidden') === false) el.homeError.textContent = message;
  else el.lobbyError.textContent = message;
});

socket.on('roomUpdate', (room) => {
  renderLobby(room);
  if (room.gameStarted) {
    showScreen('game');
    renderGame(room);
  }
});

// --- Lobby ---
function renderLobby(room) {
  const me = room.players.find(p => p.id === myPlayerId);
  myTeam = me.team;
  // Lobby controls
  if (me) {
    el.teamSelect.classList.toggle('hidden', me.team !== null);
    if (me.team === null) {
      // Populate team select
      el.teamInput.innerHTML = '';
      const teamCounts = {};
      room.players.forEach(p => {
        if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1;
      });
      for (let i = 0; i < COLORS.length; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Team ${i+1}`;
        if (teamCounts[i] >= 2) opt.disabled = true; // limit 2 per team for now
        el.teamInput.appendChild(opt);
      }
    }
    el.readyBtn.textContent = me.ready ? 'Unready' : 'Ready';
    el.readyBtn.style.background = me.ready ? 'var(--success)' : '';
  }
  // Start button for host
  el.startBtn.classList.toggle('hidden', !isHost || room.players.length < 2);

  // Player list
  el.playerList.innerHTML = '';
  room.players.forEach(p => {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.innerHTML = `
      <div>
        <div class="player-name">${p.name} ${p.id === room.hostId ? '(Host)' : ''}</div>
        <div class="player-meta">
          Team: ${p.team !== null ? p.team+1 : 'Not set'} | Status: <span class="${p.ready ? 'ready-badge' : 'not-ready'}">${p.ready ? 'Ready' : 'Not ready'}</span>
        </div>
      </div>
      ${p.id === myPlayerId ? `<div class="player-meta">You</div>` : ''}
    `;
    el.playerList.appendChild(card);
  });
}

el.teamInput.addEventListener('change', () => {
  const team = parseInt(el.teamInput.value);
  socket.emit('setTeam', { roomId, team });
});

el.readyBtn.addEventListener('click', () => {
  if (!roomId) {
    el.lobbyError.textContent = 'Room error: not connected. Refresh and try again.';
    return;
  }
  el.lobbyError.textContent = '';
  socket.emit('toggleReady', { roomId });
});

el.startBtn.addEventListener('click', () => {
  socket.emit('startGame', { roomId });
});

el.copyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(roomId).then(() => {
    el.copyBtn.textContent = 'Copied!';
    setTimeout(() => el.copyBtn.textContent = 'Copy', 1500);
  });
});

el.leaveLobbyBtn.addEventListener('click', () => {
  location.reload();
});

// --- Game ---
let selectedCardIdx = null;

function renderGame(room) {
  const player = room.players.find(p => p.id === myPlayerId);
  if (!player) return;
  const myTurn = room.turnIndex === room.players.findIndex(p => p.id === myPlayerId);
  const winThreshold = (room.players.length === 2 || room.players.length === 3) ? 2 : 1;
  el.winCount.textContent = winThreshold;

  const currentPlayerName = room.players[room.turnIndex] ? room.players[room.turnIndex].name : '';
  el.currentPlayer.textContent = `${currentPlayerName}${myTurn ? ' (your turn)' : ''}`;

  // Render board
  renderBoard(room, player);

  // Render hand
  renderHand(room, player, myTurn);
}

function renderBoard(room, player) {
  el.board.innerHTML = '';
  // Get color for my team
  const teamColor = COLORS[player.team !== null ? player.team : 0];
  // Dynamic CSS for team colors
  let dynamicStyle = document.getElementById('dynamicTeamStyle');
  if (!dynamicStyle) {
    dynamicStyle = document.createElement('style');
    dynamicStyle.id = 'dynamicTeamStyle';
    document.head.appendChild(dynamicStyle);
  }
  let css = '';
  for (let i = 0; i < COLORS.length; i++) {
    css += `.chip.p${i} { background: ${COLORS[i]}; } `;
  }
  dynamicStyle.textContent = css;

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const isCorner = CORNERS.some(cor => cor.r === r && cor.c === c);
      if (isCorner) cell.classList.add('wild');
      const cellData = room.board[r][c];
      if (cellData) {
        const chip = document.createElement('div');
        chip.className = `chip p${cellData.color}`;
        cell.appendChild(chip);
        if (cellData.locked) cell.classList.add('locked');
      }
      // Determine if this cell is a valid move for selected card
      let validMove = false;
      if (selectedCardIdx !== null && myTurn) {
        const card = player.cards[selectedCardIdx];
        if (card) {
          if (isTwoEyedJack(card)) {
            validMove = !cellData && !isCorner(r, c);
          } else if (isOneEyedJack(card)) {
            validMove = cellData && cellData.color !== (player.team !== null ? player.team : player.id) && !cellData.locked;
          } else {
            const pos = room.cardPositions[card.id];
            if (pos) {
              validMove = pos.some(p => p.r === r && p.c === c) && !cellData;
            }
          }
        }
      }
      if (validMove) cell.classList.add('highlight');
      cell.addEventListener('click', () => handleCellClick(r, c, myTurn));
      el.board.appendChild(cell);
    }
  }
}

function renderHand(room, player, myTurn) {
  el.hand.innerHTML = '';
  player.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = `card${selectedCardIdx === idx ? ' selected' : ''}${myTurn ? '' : ' disabled'}`;
    const isRed = ['♥','♦'].includes(card.suit);
    const colorStyle = isRed ? 'color: #ef4444;' : '';
    const corner = `<span class="corner" style="${colorStyle}">${card.rank}</span>`;
    cardEl.innerHTML = `
      ${corner}
      <div class="rank" style="${colorStyle}">${card.rank}</div>
      <div class="suit" style="${colorStyle}">${card.suit}</div>
      <div class="suit-bottom" style="${colorStyle}">${card.suit}</div>
    `;
    if (myTurn) {
      cardEl.addEventListener('click', () => selectCard(idx));
    }
    el.hand.appendChild(cardEl);
  });
}

function selectCard(idx) {
  selectedCardIdx = selectedCardIdx === idx ? null : idx;
  // Re-render board to show highlights
  socket.emit('roomUpdate', {}); // Trigger update? We'll just pull from state.
  // Better: we'll store last room state globally. Let's keep a cache.
  if (lastRoom) renderGame(lastRoom);
}

function handleCellClick(r, c, myTurn) {
  if (!myTurn || selectedCardIdx === null) return;
  const player = lastRoom.players.find(p => p.id === myPlayerId);
  const card = player.cards[selectedCardIdx];
  // For one-eyed jack, we target an occupied cell; for others, empty.
  const boardPos = { r, c };
  socket.emit('playCard', { roomId, cardIndex: selectedCardIdx, boardPos });
  selectedCardIdx = null;
}

let lastRoom = null;
socket.on('roomUpdate', (room) => {
  lastRoom = room;
  if (!room.gameStarted) {
    renderLobby(room);
  } else {
    renderGame(room);
    if (room.winner) {
      screens.game.classList.add('hidden');
      el.winnerText.textContent = `Winner: ${room.winner.playerName}!`;
      el.winnerSubtext.textContent = `Completed required sequences.`;
      showScreen('end');
    }
  }
});

el.leaveGameBtn.addEventListener('click', () => {
  if (confirm('Leave game?')) location.reload();
});

el.playAgainBtn.addEventListener('click', () => {
  // Only host can restart
  socket.emit('startGame', { roomId });
});

el.backLobbyBtn.addEventListener('click', () => {
  location.reload();
});

// --- Globals for client checks ---
function isTwoEyedJack(card) {
  return card.rank === 'J' && (card.suit === '♥' || card.suit === '♦');
}
function isOneEyedJack(card) {
  return card.rank === 'J' && (card.suit === '♠' || card.suit === '♣');
}
function isCorner(r, c) {
  return CORNERS.some(cor => cor.r === r && cor.c === c);
}

// Board size constant used for corners
const BOARD_SIZE = 10;
const CORNERS = [
  {r:0,c:0}, {r:0,c:9}, {r:9,c:0}, {r:9,c:9}
];
const COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#9333ea', '#0891b2', '#dc2626', '#7c3aed', '#0d9488', '#f59e0b'];
