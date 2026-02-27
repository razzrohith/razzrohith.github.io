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

  // Toggle green felt vs galaxy background
  if (name === 'game') {
    document.body.classList.add('in-game');
  } else {
    document.body.classList.remove('in-game');
  }
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
        const starImg = document.createElement('img');
        starImg.src = 'wild_star.png';
        starImg.alt = 'WILD';
        starImg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:2px;';
        cell.appendChild(starImg);
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
            img.src = 'assets/king_face.png';
            img.alt = 'K'; img.className = 'face-img';
            cell.appendChild(img);
          } else if (rank === 'Q') {
            const img = document.createElement('img');
            img.src = 'assets/queen_face.png';
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
        const c = chip.color;
        const chipEl = document.createElement('div');
        // Authentic poker chip: center dot + stripe ring + outer rim in team color
        chipEl.className = 'chip';
        // Authentic Poker Chip Image
        const chipImg = document.createElement('img');
        chipImg.src = 'assets/' + CHIP_IMAGES[c];
        chipImg.style.cssText = 'width:100%; height:100%; object-fit:contain; border-radius:50%; box-shadow: 0 4px 6px rgba(0,0,0,0.5); pointer-events:none;';
        chipEl.appendChild(chipImg);

        chipEl.style.cssText = `
          width:26px; height:26px; border-radius:50%;
          position:absolute; z-index:5; pointer-events:none;
          animation: chipDrop .35s cubic-bezier(.22,1,.36,1) both;
        `;
        if (chip.locked) chipEl.classList.add('locked');
        if (room.lastPlacedPos && room.lastPlacedPos.r === r && room.lastPlacedPos.c === c) {
          chipEl.classList.add('recent');
        }
        cell.appendChild(chipEl);

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
  if (!myPlayer || !myPlayer.cards) return;
  myPlayer.cards.forEach((card, idx) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    const isRed = card.suit === '♥' || card.suit === '♦';
    if (isRed) cardEl.classList.add('red');
    if (idx === selectedCardIdx) cardEl.classList.add('selected');

    if (isTwoEyedJack(card)) {
      cardEl.innerHTML = `
        <span class="rank-tl${isRed ? ' red' : ''}" style="position:absolute;top:3px;left:4px;font-size:.75rem;">J${card.suit}</span>
        <img src="assets/jack_face.png" alt="Two-Eye Jack" style="width:90%;height:65%;object-fit:cover;border-radius:3px;margin-top:4px;">
        <span class="rank-br${isRed ? ' red' : ''}" style="position:absolute;bottom:3px;right:4px;font-size:.75rem;">J${card.suit}</span>
        <div class="rank" style="font-size:0.50rem;text-align:center;position:absolute;bottom:2px;width:100%;color:#b91c1c;font-weight:900;">TWO-EYE (WILD)</div>
      `;
      cardEl.title = 'Two-Eyed Jack: Place chip ANYWHERE on board';
    } else if (isOneEyedJack(card)) {
      cardEl.innerHTML = `
        <span class="rank-tl${isRed ? ' red' : ''}" style="position:absolute;top:3px;left:4px;font-size:.75rem;">J${card.suit}</span>
        <img src="assets/jack_face.png" alt="One-Eye Jack" style="width:90%;height:65%;object-fit:cover;border-radius:3px;margin-top:4px;">
        <span class="rank-br${isRed ? ' red' : ''}" style="position:absolute;bottom:3px;right:4px;font-size:.75rem;">J${card.suit}</span>
        <div class="rank" style="font-size:0.50rem;text-align:center;position:absolute;bottom:2px;width:100%;color:#1e3a5f;font-weight:900;">ONE-EYE (REMOVE)</div>
      `;
      cardEl.title = "One-Eyed Jack: Remove opponent's chip";
    } else if (card.rank === 'K') {
      cardEl.innerHTML = `
        <span class="rank-tl${isRed ? ' red' : ''}" style="position:absolute;top:3px;left:4px;font-size:.75rem;">K${card.suit}</span>
        <img src="assets/king_face.png" alt="King" style="width:90%;height:65%;object-fit:cover;border-radius:3px;margin-top:4px;">
        <span class="rank-br${isRed ? ' red' : ''}" style="position:absolute;bottom:3px;right:4px;font-size:.75rem;">K${card.suit}</span>
      `;
    } else if (card.rank === 'Q') {
      cardEl.innerHTML = `
        <span class="rank-tl${isRed ? ' red' : ''}" style="position:absolute;top:3px;left:4px;font-size:.75rem;">Q${card.suit}</span>
        <img src="assets/queen_face.png" alt="Queen" style="width:90%;height:65%;object-fit:cover;border-radius:3px;margin-top:4px;">
        <span class="rank-br${isRed ? ' red' : ''}" style="position:absolute;bottom:3px;right:4px;font-size:.75rem;">Q${card.suit}</span>
      `;
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
  const lastPlayedCardDiv = document.getElementById('lastPlayedCard');

  if (current) {
    currentPlayerSpan.textContent = `🃏 Turn: ${current.name}`;
  } else {
    currentPlayerSpan.textContent = 'Waiting for players...';
  }

  // Fill lastPlayedCard with mini card from top of discard pile
  if (lastPlayedCardDiv) {
    if (room.discardPile && room.discardPile.length > 0) {
      const top = room.discardPile[room.discardPile.length - 1];
      const isRed = top.suit === '♥' || top.suit === '♦';
      let label = top.rank + top.suit;
      if (top.rank === 'J' && isRed) label = '👁️👁️ J';
      else if (top.rank === 'J') label = '👁️ J';
      lastPlayedCardDiv.innerHTML = `
        <div style="width:46px;height:64px;background:#F4EDD6;border:1px solid #c9b58a;border-radius:5px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          box-shadow:0 3px 8px rgba(0,0,0,.5);font-family:Georgia,serif;">
          <span style="font-size:.8rem;font-weight:900;color:${isRed ? '#b91c1c' : '#1a1208'}">${top.rank}</span>
          <span style="font-size:1.2rem;color:${isRed ? '#b91c1c' : '#1a1208'}">${top.suit}</span>
        </div>`;
    } else {
      lastPlayedCardDiv.innerHTML = `<span style="font-size:.7rem;opacity:.4;">none yet</span>`;
    }
  }

  const isMyTurn = myPlayer && current && current.id === socket.id;
  if (handContainer) handContainer.classList.toggle('my-turn', isMyTurn);
  if (isMyTurn) showYourTurnToast();

  if (typeof anime !== 'undefined') {
    anime({ targets: '#currentPlayer', scale: [0.85, 1], opacity: [0.4, 1], duration: 500, easing: 'easeOutElastic(1,.8)' });
  }
}

function renderPlayers(room) {
  const list = document.getElementById('gamePlayersList');
  if (!list) return;
  list.innerHTML = '';
  room.players.forEach(p => {
    const isMe = p.id === socket.id;
    const isHost = p.id === room.hostId;
    const isOnline = p.connected !== false; // default true
    const pill = document.createElement('div');
    pill.style.cssText = `display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.35);
      border:1px solid ${isOnline ? 'rgba(255,255,255,.12)' : 'rgba(255,80,80,.25)'};border-radius:20px;padding:4px 12px;
      font-size:.82rem;font-family:Georgia,serif;opacity:${isOnline ? '1' : '0.6'};`;
    const statusDot = isOnline
      ? `<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 5px #22c55e;flex-shrink:0;"></span>`
      : `<span style="width:7px;height:7px;border-radius:50%;background:#666;flex-shrink:0;" title="Offline"></span>`;
    pill.innerHTML = `
      ${statusDot}
      <span style="width:10px;height:10px;border-radius:50%;background:${p.team};border:1px solid rgba(255,255,255,.4);flex-shrink:0;"></span>
      <span style="color:${isMe ? '#f5c518' : '#e2e8f0'};font-weight:${isMe ? '900' : '600'};">${p.name}</span>
      ${!isOnline ? '<span style="font-size:.62rem;color:#f87171;">offline</span>' : ''}
      ${isHost ? '<span style="font-size:.65rem;padding:1px 5px;background:#c29535;color:#000;border-radius:6px;font-weight:800;">HOST</span>' : ''}
      ${isMe ? '<span style="font-size:.65rem;padding:1px 5px;background:#3b82f6;color:#fff;border-radius:6px;font-weight:800;">ME</span>' : ''}
    `;
    list.appendChild(pill);
  });
}

function showYourTurnToast() {
  // Only show if not already visible
  if (document.getElementById('yourTurnToast')) return;
  const toast = document.createElement('div');
  toast.id = 'yourTurnToast';
  toast.innerHTML = `
    <div style="
      position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-120px);
      background:linear-gradient(135deg,#f5c518,#ff6b00,#f5c518);
      background-size:200% 200%;
      color:#1a1208; font-family:Georgia,serif; font-size:2rem; font-weight:900;
      padding:18px 44px; border-radius:50px;
      box-shadow:0 8px 40px rgba(245,197,24,.8), 0 0 0 4px #fff2;
      z-index:9998; letter-spacing:.05em; pointer-events:none;
      border:3px solid rgba(255,255,255,.5);
      animation: toastSlide 4s cubic-bezier(.22,1,.36,1) forwards, rainbowShift 2s linear infinite;
    ">
      🃏 &nbsp; YOUR TURN! &nbsp; 🃏
    </div>
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @keyframes toastSlide {
      0%   { opacity:0; transform:translateX(-50%) translateY(-120px) scale(.8); }
      12%  { opacity:1; transform:translateX(-50%) translateY(0)       scale(1.05); }
      20%  { transform:translateX(-50%) translateY(0) scale(1); }
      75%  { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
      100% { opacity:0; transform:translateX(-50%) translateY(-120px) scale(.9); }
    }
    @keyframes rainbowShift {
      0%  {background-position:0% 50%;}
      50% {background-position:100% 50%;}
      100%{background-position:0% 50%;}
    }
  `;
  document.head.appendChild(styleEl);
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); styleEl.remove(); }, 4100);
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
  renderPlayers(room);

  // Show room code in header
  const codeEl = document.getElementById('gameCodeDisplay');
  if (codeEl && room.id) codeEl.textContent = room.id;

  // Fire confetti and popup when a new sequence is detected
  const totalSeqCount = Object.values(room.teamWinCounts || {}).reduce((a, b) => a + b, 0);
  if (totalSeqCount > prevSequenceCount) {
    fireConfetti(0.5);
    const justScored = room.players[(room.turnIndex - 1 + room.players.length) % room.players.length];
    showToast(`🌟 ${justScored ? justScored.name : 'A player'} completed a Sequence of 5! 🌟`);
    prevSequenceCount = totalSeqCount;
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

// Rejoin: server sends this when a player rejoins a game already in progress
socket.on('gameRejoined', ({ roomId: id, room }) => {
  roomId = id;
  myPlayer = room.players.find(p => p.id === socket.id);
  if (myPlayer) localStorage.setItem('seqSession', JSON.stringify({ roomId: id, name: myPlayer.name }));
  document.getElementById('rejoinSection') && (document.getElementById('rejoinSection').style.display = 'none');
  const overlay = document.getElementById('pauseOverlay');
  if (overlay) overlay.style.display = 'none';
  showScreen('game');
  renderGame(room);
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