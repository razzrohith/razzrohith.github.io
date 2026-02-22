const socket = io();
let roomId = null;
let myPlayer = null;
let selectedCardIdx = null;

const screens = {
  home: document.getElementById('home'),
  lobby: document.getElementById('lobby'),
  game: document.getElementById('game'),
  end: document.getElementById('end')
};
const el = {
  homeError: document.getElementById('homeError'),
  createBtn: document.getElementById('createBtn'),
  nameInput: document.getElementById('nameInput'),
  roomInput: document.getElementById('roomInput'),
  joinBtn: document.getElementById('joinBtn'),
  roomCode: document.getElementById('roomCode'),
  copyBtn: document.getElementById('copyBtn'),
  copyMsg: document.getElementById('copyMsg'),
  playerList: document.getElementById('playerList'),
  teamSelect: document.getElementById('teamSelect'),
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

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'pink', 'cyan', 'lime'];
const CORNERS = [
  {r:0,c:0}, {r:0,c:9}, {r:9,c:0}, {r:9,c:9}
];
const isCorner = (r,c) => CORNERS.some(k=>k.r===r && k.c===c);
const isTwoEyedJack = c => c.rank==='J' && (c.suit==='♥' || c.suit==='♦');
const isOneEyedJack = c => c.rank==='J' && (c.suit==='♠' || c.suit==='♣');

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function formatCard(card) {
  if (!card) return '';
  if (card.rank === 'JOKER') return '🃏';
  return `${card.rank}${card.suit}`;
}

function renderLobby(room) {
  el.roomCode.textContent = room.id;
  el.playerList.innerHTML = '';
  room.players.forEach(p => {
    const div = document.createElement('div');
    div.className = 'player';
    div.innerHTML = `
      <span>
        ${p.isHost ? '<span class="badge">HOST</span>' : ''}
        ${p.name}
        ${p.ready ? ' ✓' : ''}
      </span>
      <span>
        ${p.team ? `<span class="team" style="background:${p.team==='default'?'#94a3b8':p.team}"></span>` : ''}
      </span>
    `;
    el.playerList.appendChild(div);
  });
  // My data
  myPlayer = room.players.find(p => p.id === socket.id);
  if (!myPlayer) return;
  // Team select
  el.teamSelect.value = myPlayer.team || 'default';
  // Ready button
  el.readyBtn.textContent = myPlayer.ready ? 'Unready' : 'Ready';
  el.readyBtn.disabled = myPlayer.isHost; // host is always ready? Actually host can also ready. We'll allow.
  // Start button: host only, hide when not host
  const isHostNow = myPlayer.isHost;
  el.startBtn.classList.toggle('hidden', !isHostNow);
  if (isHostNow) {
    const notReadyCount = room.players.filter(p => !p.ready).length;
    el.startBtn.textContent = notReadyCount === 0 ? '▶ PLAY GAME' : `Waiting (${notReadyCount} not ready)`;
    el.startBtn.disabled = notReadyCount > 0;
  }
}

function renderBoard(room) {
  el.board.innerHTML = '';
  for (let r = 0; r < 10; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    for (let c = 0; c < 10; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (isCorner(r,c)) cell.classList.add('wild');
      const picture = room.cardPositions[r][c];
      if (picture && !isCorner(r,c)) {
        const mini = document.createElement('span');
        mini.className = 'cardMini';
        mini.textContent = picture;
        cell.appendChild(mini);
      }
      const chip = room.board[r][c];
      if (chip) {
        const chipEl = document.createElement('div');
        chipEl.className = `chip ${chip.color}`;
        if (chip.color === 'default') chipEl.style.backgroundColor = '#94a3b8';
        cell.appendChild(chipEl);
      } else {
        // Clickable only if it's my turn and I have a selected card
        const current = room.players[room.turnIndex];
        if (current && current.id === socket.id && selectedCardIdx !== null) {
          const card = myPlayer.cards[selectedCardIdx];
          if (card) {
            if (isOneEyedJack(card)) {
              // For one-eyed jack, we also allow clicking a chip to remove
              // But chip presence indicates could be target; signal via data attribute
              cell.style.cursor = 'pointer';
            } else {
              cell.style.cursor = 'pointer';
            }
          }
        }
      }
      cell.dataset.r = r;
      cell.dataset.c = c;
      row.appendChild(cell);
    }
    el.board.appendChild(row);
  }
}

function renderHand(room) {
  el.hand.innerHTML = '';
  myPlayer.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (idx === selectedCardIdx) cardEl.classList.add('selected');
    cardEl.innerHTML = `
      <span class="suit">${card.suit || (card.rank==='JOKER'?'🃏':'')}</span>
      <span class="rank">${card.rank}</span>
    `;
    cardEl.onclick = () => {
      selectedCardIdx = idx;
      renderHand(room);
    };
    el.hand.appendChild(cardEl);
  });
}

function updateTurn(room) {
  const current = room.players[room.turnIndex];
  el.currentPlayer.textContent = current ? `Turn: ${current.name}` : '';
  // My turn indicator: if my turn, highlight?
}

function updateWinCount(room) {
  // Count sequences per team
  const counts = {};
  for (const seqKey of room.sequences) {
    const cells = seqKey.split('|').map(s => {
      const [r,c] = s.split(',').map(Number);
      return {r,c};
    });
    const { r, c } = cells[0];
    const color = room.board[r][c].color;
    counts[color] = (counts[color] || 0) + 1;
    if (cells.length >= 9) counts[color] += 1;
  }
  // Show counts for all teams present
  const parts = [];
  room.players.forEach(p => {
    const count = counts[p.team] || 0;
    parts.push(`${p.name}: ${count}`);
  });
  el.winCount.textContent = parts.join(' | ');
}

function renderGame(room) {
  renderBoard(room);
  renderHand(room);
  updateTurn(room);
  updateWinCount(room);
}

// --- Event Listeners ---
el.createBtn.onclick = () => {
  const name = el.nameInput.value.trim() || 'Host';
  socket.emit('createRoom', { name });
};

el.joinBtn.onclick = () => {
  const roomIdInput = el.roomInput.value.trim().toUpperCase();
  const name = el.nameInput.value.trim() || 'Player';
  if (!roomIdInput) return;
  socket.emit('joinRoom', { roomId: roomIdInput, name });
};

el.copyBtn.onclick = () => {
  if (!roomId) return;
  navigator.clipboard.writeText(roomId).then(() => {
    el.copyMsg.textContent = 'Copied!';
    setTimeout(() => el.copyMsg.textContent = '', 1500);
  });
};

el.teamSelect.onchange = () => {
  if (!roomId) return;
  const team = el.teamSelect.value === 'default' ? null : el.teamSelect.value;
  socket.emit('setTeam', { roomId, team });
};

el.readyBtn.onclick = () => {
  if (!roomId) return;
  socket.emit('toggleReady', { roomId });
};

el.startBtn.onclick = () => {
  if (!roomId) return;
  socket.emit('startGame', { roomId });
};

el.leaveLobbyBtn.onclick = () => {
  if (!roomId) return;
  location.reload();
};

el.leaveGameBtn.onclick = () => {
  if (!roomId) return;
  location.reload();
};

el.playAgainBtn.onclick = () => {
  if (!roomId) return;
  socket.emit('startGame', { roomId });
  showScreen('game');
};

el.backLobbyBtn.onclick = () => {
  location.reload();
};

// Board click handling
el.board.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || !roomId) return;
  const r = parseInt(cell.dataset.r);
  const c = parseInt(cell.dataset.c);
  if (isNaN(r) || isNaN(c)) return;
  if (selectedCardIdx === null) return;
  const card = myPlayer.cards[selectedCardIdx];
  if (!card) return;
  socket.emit('placeCard', { roomId, card, boardPos: { r, c } });
});

// Socket events
socket.on('connect', () => {
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  if (urlRoom) {
    el.roomInput.value = urlRoom;
  }
});

socket.on('roomCreated', ({ roomId: id, room }) => {
  roomId = id;
  showScreen('lobby');
  renderLobby(room);
});

socket.on('joinedRoom', ({ roomId: id, room }) => {
  roomId = id;
  showScreen('lobby');
  renderLobby(room);
});

socket.on('roomUpdate', (room) => {
  // Refresh myPlayer reference
  myPlayer = room.players.find(p => p.id === socket.id);
  if (!room.gameStarted) {
    renderLobby(room);
  } else {
    renderGame(room);
  }
});

socket.on('gameStarted', ({ roomId: id }) => {
  roomId = id;
  showScreen('game');
});

socket.on('gameOver', ({ winner }) => {
  el.winnerText.textContent = `${winner} wins!`;
  el.winnerSubtext.textContent = 'Congratulations!';
  showScreen('end');
});

socket.on('error', ({ message }) => {
  // Determine which screen currently active
  if (screens.lobby.classList.contains('active')) {
    el.lobbyError.textContent = message;
  } else {
    el.homeError.textContent = message;
  }
});

// Auto‑join from URL param
window.addEventListener('load', () => {
  const params = new URLSearchParams(window.location.search);
  const autoRoom = params.get('room');
  if (autoRoom) {
    el.roomInput.value = autoRoom.toUpperCase();
  }
});