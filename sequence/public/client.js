const socket = io();
let roomId = null;
let myPlayer = null;
let selectedCardIdx = null;
let lastPlacedPos = null;  // track most recently placed chip {r,c}
let prevSequenceCount = 0; // detect new sequences for confetti

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

// Chip colour → image filename mapping
const CHIP_IMAGES = {
  red: 'chip_red.png',
  blue: 'chip_blue.png',
  green: 'chip_green.png',
  yellow: 'chip_red.png',
  purple: 'chip_blue.png',
  orange: 'chip_red.png',
  black: 'chip_green.png',
  pink: 'chip_red.png',
  cyan: 'chip_blue.png',
  lime: 'chip_green.png',
};

function renderBoard(room) {
  el.board.innerHTML = '';
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      if (isCorner(r, c)) {
        cell.classList.add('wild');
      } else {
        const picture = room.cardPositions[r][c];  // e.g. "K♥"
        if (picture) {
          const rank = picture.slice(0, -1);
          const suit = picture.slice(-1);
          const isRed = suit === '♥' || suit === '♦';
          const colorClass = isRed ? ' red' : '';

          // Rank label top-left
          const tlEl = document.createElement('span');
          tlEl.className = 'rank-tl' + colorClass;
          tlEl.textContent = rank + suit;
          cell.appendChild(tlEl);

          // Rank label bottom-right (rotated)
          const brEl = document.createElement('span');
          brEl.className = 'rank-br' + colorClass;
          brEl.textContent = rank + suit;
          cell.appendChild(brEl);

          // Face card image for K and Q
          if (rank === 'K') {
            const img = document.createElement('img');
            img.src = 'king_face.png';
            img.alt = 'K'; img.className = 'face-img';
            cell.appendChild(img);
          } else if (rank === 'Q') {
            const img = document.createElement('img');
            img.src = 'queen_face.png';
            img.alt = 'Q'; img.className = 'face-img';
            cell.appendChild(img);
          } else {
            // Suit pips in centre
            const mini = document.createElement('span');
            mini.className = 'cardMini' + (isRed ? ' red-suit' : '');
            mini.textContent = suit;
            cell.appendChild(mini);
          }
        }
      }

      // Chip / coin
      const chip = room.board[r][c];
      const isMyTurn = myPlayer && room.players[room.turnIndex]?.id === socket.id;
      const selCard = (isMyTurn && selectedCardIdx !== null) ? myPlayer?.cards[selectedCardIdx] : null;

      if (chip) {
        const chipImg = document.createElement('img');
        // Pick chip image by team colour
        const teamColor = chip.color;
        chipImg.src = CHIP_IMAGES[teamColor] || 'chip_blue.png';
        chipImg.style.width = '24px'; chipImg.style.height = '24px';
        chipImg.className = 'chip';
        if (chip.locked) chipImg.classList.add('locked');

        // Recent chip glow
        if (lastPlacedPos && lastPlacedPos.r === r && lastPlacedPos.c === c) {
          chipImg.classList.add('recent');
        }
        cell.appendChild(chipImg);

        // One-eyed Jack can remove unprotected enemy chips
        if (selCard && isOneEyedJack(selCard) && chip.color !== myPlayer.team && !chip.locked) {
          cell.style.cursor = 'pointer'; cell.title = 'Remove this chip';
        }
      } else {
        if (selCard) {
          if (isTwoEyedJack(selCard)) {
            if (!isCorner(r, c)) { cell.style.cursor = 'pointer'; cell.title = 'Place chip here (wild)'; }
          } else {
            cell.style.cursor = 'pointer';
          }
        }
      }

      cell.dataset.r = r; cell.dataset.c = c;
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

    if (isTwoEyedJack(card)) {
      // Show image for two-eyed Jack
      cardEl.innerHTML = `
        <img src="jack_two_eye.png" alt="Two-Eye Jack" style="width:100%;height:80%;object-fit:cover;border-radius:4px;">
        <div class="rank" style="font-size:0.55rem;text-align:center;margin-top:2px;color:#b91c1c;font-weight:900;">WILD JACK</div>
      `;
      cardEl.title = 'Two-Eyed Jack: Place your chip ANYWHERE on the board';
    } else if (isOneEyedJack(card)) {
      // Show image for one-eyed Jack
      cardEl.innerHTML = `
        <img src="jack_one_eye.png" alt="One-Eye Jack" style="width:100%;height:80%;object-fit:cover;border-radius:4px;">
        <div class="rank" style="font-size:0.55rem;text-align:center;margin-top:2px;color:#1e3a5f;font-weight:900;">REMOVE</div>
      `;
      cardEl.title = 'One-Eyed Jack: Remove an opponent\'s chip from the board';
    } else {
      cardEl.innerHTML = `
        <div class="suit">${card.suit || ''}</div>
        <div class="rank">${card.rank || ''}</div>
      `;
    }

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
  const handContainer = document.querySelector('.hand-container');

  if (current) {
    currentPlayerSpan.textContent = `Turn: ${current.name}`;
  } else {
    currentPlayerSpan.textContent = 'Waiting for players...';
  }

  // Glow hand container only when it is MY turn
  const isMyTurn = myPlayer && current && current.id === socket.id;
  if (handContainer) {
    handContainer.classList.toggle('my-turn', isMyTurn);
  }

  // Animate turn indicator with Anime.js if available
  if (typeof anime !== 'undefined') {
    anime({ targets: '#currentPlayer', scale: [0.85, 1], opacity: [0.4, 1], duration: 500, easing: 'easeOutElastic(1,.8)' });
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

function fireConfetti(origin = 0.5) {
  if (typeof confetti === 'undefined') return;
  confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: origin - 0.15, y: 0.6 } });
  confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: origin + 0.15, y: 0.6 } });
}

function renderGame(room) {
  renderBoard(room);
  renderHand(room);
  updateTurn(room);
  updateWinCount(room);

  // Fire confetti when a new sequence is detected
  const seqCount = (room.sequences || []).length;
  if (seqCount > prevSequenceCount) {
    fireConfetti(0.5);
    prevSequenceCount = seqCount;
  }
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
  lastPlacedPos = { r, c };
  socket.emit('placeCard', { roomId, card, boardPos: { r, c } });
  selectedCardIdx = null;
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
  el.winnerText.textContent = `${winner} wins! 🏆`;
  el.winnerSubtext.textContent = 'Congratulations!';
  showScreen('end');
  // Big confetti celebration
  if (typeof confetti !== 'undefined') {
    const end = Date.now() + 3500;
    const colors = ['#f5c518', '#ff0000', '#0000ff', '#00cc44', '#ffffff'];
    (function frame() {
      confetti({ particleCount: 6, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 6, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }
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