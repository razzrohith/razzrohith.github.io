(function () {
  const COLORS = ['green', 'blue', 'red', 'yellow'];
  const THEME = {
    green: '#35c978',
    blue: '#438bff',
    red: '#ff5d5d',
    yellow: '#f4c84d'
  };
  const START_INDEX = { green: 1, blue: 14, red: 27, yellow: 40 };
  const SAFE_SPOTS = [1, 9, 14, 22, 27, 35, 40, 48];
  const BOARD_PADDING = 0;
  const CELL_SIZE = 100 / 15;

  const setupScreen = document.getElementById('setupScreen');
  const gameScreen = document.getElementById('gameScreen');
  const setupForm = document.getElementById('setupForm');
  const playerCount = document.getElementById('playerCount');
  const hostName = document.getElementById('hostName');
  const board = document.getElementById('board');
  const tokenLayer = document.getElementById('tokenLayer');
  const playersCard = document.getElementById('playersCard');
  const rollBtn = document.getElementById('rollBtn');
  const dice = document.getElementById('dice');
  const hint = document.getElementById('hint');
  const turnTitle = document.getElementById('turnTitle');
  const turnBadge = document.getElementById('turnBadge');
  const logList = document.getElementById('logList');
  const newGameBtn = document.getElementById('newGameBtn');
  const winnerModal = document.getElementById('winnerModal');
  const winnerTitle = document.getElementById('winnerTitle');
  const winnerText = document.getElementById('winnerText');
  const playAgainBtn = document.getElementById('playAgainBtn');

  const MAIN_PATH_CELLS = [
    [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
    [7, 0], [8, 0],
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
    [14, 7], [14, 8],
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
    [7, 14], [6, 14],
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
    [0, 7]
  ];

  const HOME_CELLS = {
    green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    blue: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    red: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]
  };

  const YARD_CENTERS = {
    green: [2.5, 2.5],
    blue: [11.5, 2.5],
    red: [11.5, 11.5],
    yellow: [2.5, 11.5]
  };

  const state = {
    players: [],
    turn: 0,
    dice: null,
    rolled: false,
    winner: null,
    lastMoved: null,
    logs: []
  };

  function titleCase(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function getPos(col, row) {
    return {
      left: `${BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2}%`,
      top: `${BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2}%`
    };
  }

  function yardPos(color, index) {
    const [c, r] = YARD_CENTERS[color];
    const offsets = [[-.58, -.58], [.58, -.58], [-.58, .58], [.58, .58]];
    return getPos(c + offsets[index][0], r + offsets[index][1]);
  }

  function finishPos(color, index) {
    const offsets = [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]];
    return getPos(7 + offsets[index][0], 7 + offsets[index][1]);
  }

  function displayPosition(color, step, tokenIndex) {
    if (step === -1) return yardPos(color, tokenIndex);
    if (step === 56) return finishPos(color, tokenIndex);
    if (step >= 51) {
      const [c, r] = HOME_CELLS[color][step - 51];
      return getPos(c, r);
    }
    const [c, r] = MAIN_PATH_CELLS[(START_INDEX[color] + step) % 52];
    return getPos(c, r);
  }

  function currentPlayer() {
    return state.players[state.turn];
  }

  function addLog(message) {
    state.logs.unshift(message);
    state.logs = state.logs.slice(0, 12);
  }

  function diceMarkup(value) {
    const layouts = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9]
    };
    if (!layouts[value]) return '<span class="dice-wait">?</span>';
    return layouts[value].map((slot) => `<span class="pip pip-${slot}"></span>`).join('');
  }

  function canMove(player, tokenIndex) {
    if (!state.rolled || !state.dice || state.winner) return false;
    const step = player.tokens[tokenIndex];
    if (step === -1) return state.dice === 6;
    return step + state.dice <= 56;
  }

  function validMoves(player = currentPlayer()) {
    return player.tokens.map((_, index) => index).filter((index) => canMove(player, index));
  }

  function nextTurn() {
    state.turn = (state.turn + 1) % state.players.length;
    state.dice = null;
    state.rolled = false;
  }

  function drawBoard() {
    board.innerHTML = '';
    const mainSet = new Set(MAIN_PATH_CELLS.map(([c, r]) => `${c},${r}`));
    const safeSet = new Set(SAFE_SPOTS.map((index) => MAIN_PATH_CELLS[index].join(',')));
    const homeMap = new Map();
    Object.entries(HOME_CELLS).forEach(([color, cells]) => {
      cells.forEach(([c, r]) => homeMap.set(`${c},${r}`, color));
    });

    for (let row = 0; row < 15; row += 1) {
      for (let col = 0; col < 15; col += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const key = `${col},${row}`;
        if (col <= 5 && row <= 5) cell.classList.add('green-zone');
        if (col >= 9 && row <= 5) cell.classList.add('blue-zone');
        if (col >= 9 && row >= 9) cell.classList.add('red-zone');
        if (col <= 5 && row >= 9) cell.classList.add('yellow-zone');
        if (mainSet.has(key)) cell.classList.add('path');
        if (safeSet.has(key)) cell.classList.add('safe');
        if (homeMap.has(key)) {
          cell.classList.add('home');
          cell.style.setProperty('--zone-color', THEME[homeMap.get(key)]);
        }
        if (col >= 6 && col <= 8 && row >= 6 && row <= 8) cell.classList.add('finish');
        if (col === 7 && row === 7) cell.classList.add('center');

        const zoneColor = (col <= 5 && row <= 5 && 'green')
          || (col >= 9 && row <= 5 && 'blue')
          || (col >= 9 && row >= 9 && 'red')
          || (col <= 5 && row >= 9 && 'yellow');
        if (zoneColor) cell.style.setProperty('--zone-color', THEME[zoneColor]);

        const isYardDot = [[2, 2], [3, 2], [2, 3], [3, 3], [11, 2], [12, 2], [11, 3], [12, 3], [11, 11], [12, 11], [11, 12], [12, 12], [2, 11], [3, 11], [2, 12], [3, 12]]
          .some(([c, r]) => c === col && r === row);
        if (isYardDot) {
          const dot = document.createElement('span');
          dot.className = 'yard-dot';
          cell.appendChild(dot);
        }
        board.appendChild(cell);
      }
    }
  }

  function renderPlayers() {
    playersCard.innerHTML = '';
    state.players.forEach((player, index) => {
      const pill = document.createElement('div');
      pill.className = `player-pill${index === state.turn ? ' active' : ''}`;
      pill.style.setProperty('--player-color', THEME[player.color]);
      pill.innerHTML = `
        <span class="color-dot"></span>
        <span><strong>${player.name}</strong><span>${titleCase(player.color)} team</span></span>
        <strong>${player.tokens.filter((token) => token === 56).length}/4</strong>
      `;
      playersCard.appendChild(pill);
    });
  }

  function renderTokens() {
    tokenLayer.innerHTML = '';
    const player = currentPlayer();
    state.players.forEach((p) => {
      p.tokens.forEach((step, index) => {
        const token = document.createElement('button');
        const pos = displayPosition(p.color, step, index);
        token.className = 'token';
        token.style.left = pos.left;
        token.style.top = pos.top;
        token.style.setProperty('--token-color', THEME[p.color]);
        token.dataset.tokenLabel = String(index + 1);
        token.type = 'button';
        token.setAttribute('aria-label', `${p.name} token ${index + 1}`);
        if (p === player && canMove(p, index)) token.classList.add('legal');
        if (state.lastMoved && state.lastMoved.color === p.color && state.lastMoved.index === index) {
          token.classList.add('just-moved');
        }
        token.addEventListener('click', () => moveToken(p, index));
        tokenLayer.appendChild(token);
      });
    });
  }

  function renderLog() {
    logList.innerHTML = '';
    state.logs.forEach((log) => {
      const item = document.createElement('li');
      item.textContent = log;
      logList.appendChild(item);
    });
  }

  function render() {
    const player = currentPlayer();
    turnTitle.textContent = state.winner ? `${state.winner.name} wins` : `${player.name}'s turn`;
    turnTitle.style.color = THEME[player.color];
    turnBadge.textContent = state.winner ? 'Victory' : state.rolled ? `Move ${state.dice}` : 'Roll phase';
    turnBadge.style.background = state.winner
      ? `linear-gradient(135deg, #fff, ${THEME[player.color]})`
      : state.rolled
        ? `linear-gradient(135deg, #fff, ${THEME[player.color]})`
        : '';
    dice.innerHTML = diceMarkup(state.dice);
    rollBtn.disabled = state.rolled || !!state.winner;
    if (!state.rolled && !state.winner) hint.textContent = `${player.name}, roll the dice.`;
    renderPlayers();
    renderTokens();
    renderLog();
  }

  function rollDice() {
    if (state.rolled || state.winner) return;
    state.dice = Math.floor(Math.random() * 6) + 1;
    state.rolled = true;
    state.lastMoved = null;
    dice.classList.remove('rolling');
    void dice.offsetWidth;
    dice.classList.add('rolling');
    addLog(`${currentPlayer().name} rolled ${state.dice}.`);

    const moves = validMoves();
    if (moves.length === 0) {
      hint.textContent = `No legal move. Passing turn.`;
      render();
      setTimeout(() => {
        nextTurn();
        render();
      }, 900);
      return;
    }
    hint.textContent = `Choose a glowing token to move ${state.dice}.`;
    render();
  }

  function moveToken(player, tokenIndex) {
    if (player !== currentPlayer() || !canMove(player, tokenIndex)) return;
    let captured = false;
    const oldStep = player.tokens[tokenIndex];
    player.tokens[tokenIndex] = oldStep === -1 ? 0 : oldStep + state.dice;
    state.lastMoved = { color: player.color, index: tokenIndex };
    const newStep = player.tokens[tokenIndex];

    if (newStep <= 50) {
      const globalIndex = (START_INDEX[player.color] + newStep) % 52;
      if (!SAFE_SPOTS.includes(globalIndex)) {
        state.players.forEach((other) => {
          if (other === player) return;
          other.tokens.forEach((step, index) => {
            if (step >= 0 && step <= 50) {
              const otherGlobal = (START_INDEX[other.color] + step) % 52;
              if (otherGlobal === globalIndex) {
                other.tokens[index] = -1;
                captured = true;
                addLog(`${player.name} captured ${other.name}'s token.`);
              }
            }
          });
        });
      }
    }

    addLog(`${player.name} moved token ${tokenIndex + 1}.`);
    if (player.tokens.every((step) => step === 56)) {
      state.winner = player;
      winnerTitle.textContent = `${player.name} wins`;
      winnerTitle.style.color = THEME[player.color];
      winnerText.textContent = `${titleCase(player.color)} brought every token home.`;
      winnerModal.classList.remove('hidden');
      render();
      return;
    }

    if (state.dice === 6 || captured) {
      state.dice = null;
      state.rolled = false;
      hint.textContent = captured ? 'Capture bonus: roll again.' : 'Six bonus: roll again.';
    } else {
      nextTurn();
    }
    render();
  }

  function startGame(event) {
    event.preventDefault();
    const count = Number(playerCount.value);
    const baseName = hostName.value.trim() || 'Player';
    state.players = COLORS.slice(0, count).map((color, index) => ({
      color,
      name: index === 0 ? baseName : `${titleCase(color)} Player`,
      tokens: [-1, -1, -1, -1]
    }));
    state.turn = 0;
    state.dice = null;
    state.rolled = false;
    state.winner = null;
    state.lastMoved = null;
    state.logs = ['Match started. Roll a 6 to leave the yard.'];
    winnerModal.classList.add('hidden');
    setupScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    drawBoard();
    render();
  }

  setupForm.addEventListener('submit', startGame);
  rollBtn.addEventListener('click', rollDice);
  newGameBtn.addEventListener('click', () => {
    gameScreen.classList.add('hidden');
    winnerModal.classList.add('hidden');
    setupScreen.classList.remove('hidden');
  });
  playAgainBtn.addEventListener('click', () => {
    winnerModal.classList.add('hidden');
    setupForm.requestSubmit();
  });

}());
