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
  { r: 0, c: 0 }, { r: 0, c: 9 }, { r: 9, c: 0 }, { r: 9, c: 9 }
];
const isCorner = (r, c) => CORNERS.some(k => k.r === r && k.c === c);
const isTwoEyedJack = c => c.rank === 'J' && (c.suit === '♥' || c.suit === '♦');
const isOneEyedJack = c => c.rank === 'J' && (c.suit === '♠' || c.suit === '♣');

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
    div.className = 'player-card';
    div.innerHTML = `
      <div class="player-info">
        <span class="player-name">${p.name}</span>
        ${p.isHost ? '<span class="player-badge">HOST</span>' : ''}
      </div>
      <div class="player-info">
        <span class="player-status">${p.ready ? 'Ready ✓' : 'Waiting'}</span>
        ${p.team ? `<div class="team-dot" style="background:${p.team === 'default' ? 'transparent' : p.team}"></div>` : ''}
      </div>
    `;
    el.playerList.appendChild(div);
  });
  // My data
  myPlayer = room.players.find(p => p.id === socket.id);
  if (!myPlayer) return;
  // Ready button
  el.readyBtn.textContent = myPlayer.ready ? 'Unready' : 'Ready';
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
    for (let c = 0; c < 10; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      if (isCorner(r, c)) {
        cell.classList.add('wild');
      } else {
        const picture = room.cardPositions[r][c];
        if (picture) {
          const mini = document.createElement('span');
          mini.className = 'cardMini';
          mini.textContent = picture;

          if (picture.includes('♥') || picture.includes('♦')) {
            mini.classList.add('red-suit');
            mini.style.color = '#dc2626';
          } else {
            mini.style.color = '#1f2937';
          }

          cell.appendChild(mini);
        }
      }

      const chip = room.board[r][c];
      if (chip) {
        const chipEl = document.createElement('div');
        chipEl.style.backgroundColor = chip.color; // The server currently sends HEX color codes directly!
        chipEl.className = 'chip';
        // Add a class string fallback incase we use the old team strings
        if (chip.color && !chip.color.startsWith('#')) {
          chipEl.classList.add(chip.color);
        }
        cell.appendChild(chipEl);
      } else {
        const current = room.players[room.turnIndex];
        if (current && current.id === socket.id && selectedCardIdx !== null) {
          const card = myPlayer.cards[selectedCardIdx];
          if (card) {
            cell.style.cursor = 'pointer';
          }
        }
      }
      cell.dataset.r = r;
      cell.dataset.c = c;
      el.board.appendChild(cell);
    }
  }
}

function renderHand(room) {
  el.hand.innerHTML = '';
  myPlayer.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (card.suit === '♥' || card.suit === '♦') cardEl.classList.add('red');
    if (idx === selectedCardIdx) cardEl.classList.add('selected');

    let suitHtml = card.suit || '';
    let rankHtml = card.rank || '';

    // Check Jack rules
    if (isTwoEyedJack(card)) {
      suitHtml = '👁️👁️';
      rankHtml = '<span style="font-size: 0.6rem; letter-spacing: 0;">WILD</span>';
    } else if (isOneEyedJack(card)) {
      suitHtml = '👁️';
      rankHtml = '<span style="font-size: 0.6rem; letter-spacing: 0;">REMOVE</span>';
    }

    cardEl.innerHTML = `
      <div class="suit">${suitHtml}</div>
      <div class="rank">${rankHtml}</div>
    `;
    cardEl.onclick = () => {
      selectedCardIdx = idx;
      renderBoard(room);
      renderHand(room);
    };
    el.hand.appendChild(cardEl);
  });
}

function updateTurn(room) {
  const current = room.players[room.turnIndex];

  const currentPlayerSpan = document.getElementById('currentPlayer');
  const recentCardContainer = document.getElementById('recentCardContainer');
  const lastPlayedCardDiv = document.getElementById('lastPlayedCard');

  if (current) {
    currentPlayerSpan.textContent = `Turn: ${current.name}`;
  } else {
    currentPlayerSpan.textContent = 'Waiting for players...';
  }

  if (room.discardPile && room.discardPile.length > 0) {
    const topCard = room.discardPile[room.discardPile.length - 1];

    let suitHtml = topCard.suit || '';
    let rankHtml = topCard.rank || '';

    if (isTwoEyedJack(topCard)) {
      suitHtml = '👁️👁️';
      rankHtml = '<span style="font-size: 0.6rem; letter-spacing: 0;">WILD</span>';
    } else if (isOneEyedJack(topCard)) {
      suitHtml = '👁️';
      rankHtml = '<span style="font-size: 0.6rem; letter-spacing: 0;">REMOVE</span>';
    }

    const suitClass = (topCard.suit === '♥' || topCard.suit === '♦') ? 'red' : '';

    lastPlayedCardDiv.innerHTML = `
      <div class="card ${suitClass}" style="transform: scale(0.6); pointer-events: none; margin: 0; box-shadow: 0 4px 10px rgba(0,0,0,0.8);">
        <div class="suit">${suitHtml}</div>
        <div class="rank">${rankHtml}</div>
      </div>
    `;
    lastPlayedCardDiv.style.opacity = '1';
    recentCardContainer.querySelector('span').textContent = "Last Played";
  } else {
    lastPlayedCardDiv.innerHTML = '';
    lastPlayedCardDiv.style.opacity = '0.5';
    recentCardContainer.querySelector('span').textContent = "Discard Empty";
  }
}

function updateWinCount(room) {
  if (!room.teamWinCounts) return;
  const parts = [];
  room.players.forEach(p => {
    const count = room.teamWinCounts[p.team] || 0;
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
  const name = el.nameInput.value.trim();
  if (!name) {
    el.homeError.textContent = "Please enter your name first!";
    return;
  }
  socket.emit('createRoom', { name });
};

el.joinBtn.onclick = () => {
  const roomIdInput = el.roomInput.value.trim().toUpperCase();
  const name = el.nameInput.value.trim();

  if (!name) {
    el.homeError.textContent = "Please enter your name first!";
    return;
  }
  if (!roomIdInput) {
    el.homeError.textContent = "Please enter a Room Code!";
    return;
  }

  socket.emit('joinRoom', { roomId: roomIdInput, name });
};

el.copyBtn.onclick = () => {
  if (!roomId) return;
  navigator.clipboard.writeText(roomId).then(() => {
    el.copyMsg.textContent = 'Copied!';
    setTimeout(() => el.copyMsg.textContent = '', 1500);
  });
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
  // Offer rejoin if a saved session exists
  const saved = JSON.parse(localStorage.getItem('seqSession') || 'null');
  if (saved) {
    const rejoinSec = document.getElementById('rejoinSection');
    if (rejoinSec) {
      rejoinSec.style.display = 'block';
      rejoinSec.querySelector('p').textContent = `You were in room ${saved.roomId} as "${saved.name}". Rejoin?`;
    }
  }
});

// Rejoin buttons
const rejoinBtn = document.getElementById('rejoinBtn');
const dismissRejoin = document.getElementById('dismissRejoin');
if (rejoinBtn) {
  rejoinBtn.onclick = () => {
    const saved = JSON.parse(localStorage.getItem('seqSession') || 'null');
    if (!saved) return;
    el.nameInput.value = saved.name;
    socket.emit('rejoinRoom', { roomId: saved.roomId, name: saved.name });
  };
}
if (dismissRejoin) {
  dismissRejoin.onclick = () => {
    localStorage.removeItem('seqSession');
    document.getElementById('rejoinSection').style.display = 'none';
  };
}

socket.on('roomCreated', ({ roomId: id, room }) => {
  roomId = id;
  myPlayer = room.players.find(p => p.id === socket.id);
  if (myPlayer) localStorage.setItem('seqSession', JSON.stringify({ roomId: id, name: myPlayer.name }));
  showScreen('lobby');
  renderLobby(room);
});

socket.on('joinedRoom', ({ roomId: id, room }) => {
  roomId = id;
  myPlayer = room.players.find(p => p.id === socket.id);
  if (myPlayer) localStorage.setItem('seqSession', JSON.stringify({ roomId: id, name: myPlayer.name }));
  if (room.gameStarted) {
    showScreen('game');
    renderGame(room);
  } else {
    showScreen('lobby');
    renderLobby(room);
  }
});

socket.on('roomUpdate', (room) => {
  // Refresh myPlayer reference
  myPlayer = room.players.find(p => p.id === socket.id);

  // Handle pause overlay
  const overlay = document.getElementById('pauseOverlay');
  if (overlay) overlay.style.display = room.paused ? 'flex' : 'none';

  // Enforce Synchronization
  if (room.gameStarted) {
    if (!screens.game.classList.contains('active')) {
      showScreen('game');
    }
    renderGame(room);
  } else {
    renderLobby(room);
  }
});

socket.on('playerDisconnected', ({ playerName, room }) => {
  const overlay = document.getElementById('pauseOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    const msg = document.getElementById('pauseMessage');
    if (msg) msg.textContent = `"${playerName}" disconnected. Game paused. Waiting for them to rejoin...`;
  }
  if (room) {
    myPlayer = room.players.find(p => p.id === socket.id);
    renderGame(room);
  }
});

socket.on('gameStarted', ({ roomId: id }) => {
  roomId = id;
  showScreen('game');
});

socket.on('gameOver', ({ winner }) => {
  localStorage.removeItem('seqSession');
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