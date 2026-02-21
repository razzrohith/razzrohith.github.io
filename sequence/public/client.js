document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready, init');

  // Elements
  const el = {
    home: document.getElementById('home'),
    lobby: document.getElementById('lobby'),
    game: document.getElementById('game'),
    end: document.getElementById('end'),
    createBtn: document.getElementById('createBtn'),
    joinBtn: document.getElementById('joinBtn'),
    roomInput: document.getElementById('roomInput'),
    homeError: document.getElementById('homeError'),
    roomCode: document.getElementById('roomCode'),
    copyBtn: document.getElementById('copyBtn'),
    inviteBtn: document.getElementById('inviteBtn'),
    inviteMsg: document.getElementById('inviteMsg'),
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
    backLobbyBtn: document.getElementById('backLobbyBtn'),
    playerList: document.getElementById('playerList')
  };

  // State
  let roomId = null;
  let myPlayerId = null;
  let isHost = false;
  let myTeam = null;
  let selectedCardIdx = null;
  let lastRoom = null;

  const socket = io();
  socket.on('connect', () => console.log('Socket connected', socket.id));
  socket.on('error', (e) => console.error('Socket error', e));

  socket.on('roomCreated', ({ roomId: rid, isHost: hostFlag }) => {
    roomId = rid; myPlayerId = socket.id; isHost = hostFlag;
    window.location.hash = roomId;
    el.roomCode.textContent = roomId;
    showScreen('lobby');
  });

  socket.on('joinedRoom', ({ roomId: rid, isHost: hostFlag }) => {
    roomId = rid; myPlayerId = socket.id; isHost = hostFlag;
    window.location.hash = roomId;
    el.roomCode.textContent = roomId;
    showScreen('lobby');
  });

  socket.on('roomUpdate', (room) => {
    lastRoom = room;
    if (!room.gameStarted) renderLobby(room);
    else {
      showScreen('game');
      renderGame(room);
      if (room.winner) {
        showScreen('end');
        el.winnerText.textContent = `Winner: ${room.winner.playerName}!`;
      }
    }
  });

  socket.on('error', ({ message }) => {
    console.error('Server error:', message);
    if (!el.lobby.classList.contains('hidden')) el.lobbyError.textContent = message;
    else if (!el.home.classList.contains('hidden')) el.homeError.textContent = message;
  });

  function showScreen(name) {
    ['home','lobby','game','end'].forEach(s => {
      const e = document.getElementById(s);
      if (e) e.classList.add('hidden');
    });
    const t = document.getElementById(name);
    if (t) t.classList.remove('hidden');
  }

  // Home
  el.createBtn.addEventListener('click', () => {
    const name = `Player${Math.floor(Math.random()*1000)}`;
    socket.emit('createRoom', { userName: name });
  });

  el.joinBtn.addEventListener('click', () => {
    const code = el.roomInput.value.trim().toUpperCase();
    if (!code) return;
    const name = `Player${Math.floor(Math.random()*1000)}`;
    socket.emit('joinRoom', { roomId: code, userName: name });
  });

  el.copyBtn.addEventListener('click', () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      el.copyBtn.textContent = 'Copied!';
      setTimeout(() => el.copyBtn.textContent = 'Copy Code', 1500);
    });
  });

  el.inviteBtn.addEventListener('click', () => {
    if (!roomId) return;
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(`Join my Sequence game! ${url}`).then(() => {
      el.inviteMsg.textContent = 'Invite link copied!';
      el.inviteMsg.style.display = 'block';
      setTimeout(() => { el.inviteMsg.style.display = 'none'; el.inviteMsg.textContent = ''; }, 3000);
    });
  });

  // Auto‑join from URL ?room=CODE
  (() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      socket.once('connect', () => {
        socket.emit('joinRoom', { roomId: code, userName: `Player${Math.floor(Math.random()*1000)}` });
      });
    }
  })();

  el.leaveLobbyBtn.addEventListener('click', () => location.reload());

  // Lobby functions
  function renderLobby(room) {
    const me = room.players.find(p => p.id === myPlayerId);
    myTeam = me ? me.team : null;

    // Team selection (always visible)
    el.teamSelect.classList.remove('hidden');
    if (me && me.team === null) {
      // Show dropdown to pick team
      el.teamSelect.innerHTML = '';
      const label = document.createElement('label');
      label.textContent = 'Choose Team:';
      label.style.color = 'var(--gold)';
      label.style.marginRight = '8px';
      const select = document.createElement('select');
      select.id = 'teamInput';
      const counts = {};
      room.players.forEach(p => { if (p.team !== null) counts[p.team] = (counts[p.team]||0)+1; });
      for (let i = 0; i < COLORS.length; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Team ${i+1}`;
        if (counts[i] >= 2) opt.disabled = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        socket.emit('setTeam', { roomId, team: parseInt(select.value) });
      });
      el.teamSelect.appendChild(label);
      el.teamSelect.appendChild(select);
    } else if (me) {
      // Already selected: show current team + Change button
      el.teamSelect.innerHTML = '';
      const cur = document.createElement('span');
      cur.style.color = COLORS[me.team] || '#fff';
      cur.textContent = `Team ${me.team+1}`;
      const changeBtn = document.createElement('button');
      changeBtn.className = 'btn small';
      changeBtn.textContent = 'Change';
      changeBtn.style.marginLeft = '8px';
      changeBtn.addEventListener('click', () => {
        socket.emit('setTeam', { roomId, team: null });
      });
      el.teamSelect.appendChild(cur);
      el.teamSelect.appendChild(changeBtn);
    }

    // Ready button
    if (me) {
      el.readyBtn.textContent = me.ready ? 'Unready' : 'Ready';
      el.readyBtn.style.background = me.ready ? 'var(--success)' : '';
    }

    // Start button (host only, all ready)
    const isHostNow = me ? me.isHost : false;
    const allReady = room.players.every(p => p.ready);
    const shouldShow = isHostNow && room.players.length >= 2 && allReady;
    el.startBtn.classList.toggle('hidden', !shouldShow);
    if (isHostNow) {
      el.startBtn.textContent = allReady ? '▶ PLAY GAME' : `Waiting (${room.players.filter(p=>!p.ready).length} not ready)`;
      el.startBtn.disabled = !allReady;
    }

    // Player list with Invite button for others
    el.playerList.innerHTML = '';
    room.players.forEach(p => {
      const seqs = (room.sequences||[]).filter(seq =>
        seq[0] && room.board[seq[0].r][seq[0].c] &&
        room.board[seq[0].r][seq[0].c].color === p.team
      ).length;
      const card = document.createElement('div');
      card.className = 'player-card';
      const actions = (p.id !== myPlayerId) ?
        `<button class="invite-player small" data-name="${p.name}">Invite</button>` : '';
      card.innerHTML = `
        <div>
          <div class="player-name">${p.name} ${p.id===room.hostId?'(Host)':''}</div>
          <div class="player-meta">
            Team: ${p.team !== null ? p.team+1 : 'Not set'} | Sequences: ${seqs} | Status: <span class="${p.ready?'ready-badge':'not-ready'}">${p.ready?'Ready':'Not ready'}</span>
          </div>
        </div>
        <div class="player-actions">${actions}</div>
      `;
      const inviteBtn = card.querySelector('.invite-player');
      if (inviteBtn) {
        inviteBtn.addEventListener('click', () => {
          const url = `${window.location.origin}?room=${roomId}`;
          navigator.clipboard.writeText(`Join my Sequence game! ${url}`).then(() => {
            alert('Invite copied!');
          });
        });
      }
      el.playerList.appendChild(card);
    });
  }

  el.readyBtn.addEventListener('click', () => {
    if (!roomId) return;
    socket.emit('toggleReady', { roomId });
  });

  el.startBtn.addEventListener('click', () => {
    if (!roomId) return;
    socket.emit('startGame', { roomId });
  });

  // Game Board
  function renderBoard(room, player) {
    el.board.innerHTML = '';

    // Map positions to card IDs
    const posToCard = {};
    if (room.cardPositions) {
      for (const cardId in room.cardPositions) {
        for (const pos of room.cardPositions[cardId]) {
          posToCard[`${pos.r},${pos.c}`] = cardId;
        }
      }
    }

    // Team color CSS
    let dyn = document.getElementById('dynamicTeamStyle');
    if (!dyn) { dyn = document.createElement('style'); dyn.id = 'dynamicTeamStyle'; document.head.appendChild(dyn); }
    let css = '';
    for (let i = 0; i < COLORS.length; i++) {
      css += `.chip.p${i} { background: radial-gradient(circle at 30% 30%, ${COLORS[i]}); } `;
    }
    dyn.textContent = css;

    const myTurn = room.turnIndex === room.players.findIndex(p => p.id === myPlayerId);

    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const corner = CORNERS.some(c => c.r === r && c.c === c);
        if (corner) cell.classList.add('wild');
        const cellData = room.board[r][c];
        if (cellData) {
          const chip = document.createElement('div');
          chip.className = `chip p${cellData.color}`;
          if (cellData.locked) chip.classList.add('locked');
          cell.appendChild(chip);
        }
        // Card label if empty
        const cardId = posToCard[`${r},${c}`];
        if (cardId && !cellData) {
          const bg = document.createElement('div');
          bg.className = 'card-bg';
          const rank = cardId.slice(0, -1);
          const suit = cardId.slice(-1);
          const red = ['♥','♦'].includes(suit);
          bg.innerHTML = `<span class="card-center ${red?'red':'black'}">${rank}<br>${suit}</span>`;
          cell.appendChild(bg);
        }
        // Highlight valid moves
        let valid = false;
        if (selectedCardIdx !== null && myTurn) {
          const card = player.cards[selectedCardIdx];
          if (card) {
            if (isTwoEyedJack(card)) {
              valid = !cellData && !corner;
            } else if (isOneEyedJack(card)) {
              valid = cellData && cellData.color !== (player.team !== null ? player.team : player.id) && !cellData.locked;
            } else {
              const pos = room.cardPositions[card.id];
              if (pos) valid = pos.some(p => p.r===r && p.c===c) && !cellData;
            }
          }
        }
        if (valid) cell.classList.add('highlight');
        cell.addEventListener('click', () => handleCellClick(r, c, myTurn));
        el.board.appendChild(cell);
      }
    }
  }

  function renderHand(room, player, myTurn) {
    el.hand.innerHTML = '';
    player.cards.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      const isJack = card.rank === 'J';
      const cls = isJack ? 'jack' : '';
      cardEl.className = `card ${cls}${selectedCardIdx===idx?' selected':''}${myTurn?'':' disabled'}`;
      const red = ['♥','♦'].includes(card.suit);
      const colorCls = red ? 'red' : 'black';
      cardEl.innerHTML = `
        <div class="pip ${colorCls}">
          <span class="rank">${card.rank}</span>
          <span class="suit">${card.suit}</span>
        </div>
      `;
      if (myTurn) cardEl.addEventListener('click', () => selectCard(idx));
      el.hand.appendChild(cardEl);
    });
  }

  function renderGame(room) {
    const player = room.players.find(p => p.id === myPlayerId);
    if (!player) return;
    const myTurn = room.turnIndex === room.players.findIndex(p => p.id === myPlayerId);
    const winThresh = (room.players.length===2||room.players.length===3)?2:1;
    el.winCount.textContent = winThresh;

    const currentName = room.players[room.turnIndex]?.name || '';
    el.currentPlayer.textContent = `${currentName}${myTurn?' (your turn)':''}`;

    renderBoard(room, player);
    renderHand(room, player, myTurn);
  }

  function selectCard(idx) {
    selectedCardIdx = selectedCardIdx === idx ? null : idx;
    if (lastRoom) renderGame(lastRoom);
  }

  function handleCellClick(r, c, myTurn) {
    if (!myTurn || selectedCardIdx === null) return;
    const player = lastRoom.players.find(p => p.id === myPlayerId);
    const boardPos = { r, c };
    socket.emit('playCard', { roomId, cardIndex: selectedCardIdx, boardPos });
    selectedCardIdx = null;
  }

  // Helpers
  window.isTwoEyedJack = c => c.rank==='J' && (c.suit==='♥'||c.suit==='♦');
  window.isOneEyedJack = c => c.rank==='J' && (c.suit==='♠'||c.suit==='♣');

  // End screen
  el.playAgainBtn.addEventListener('click', () => socket.emit('startGame',{roomId}));
  el.backLobbyBtn.addEventListener('click', () => location.reload());
  el.leaveGameBtn.addEventListener('click', () => { if (confirm('Leave?')) location.reload(); });

  // Initial
  showScreen('home');
});
