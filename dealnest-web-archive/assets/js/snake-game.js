(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestScoreEl = document.getElementById('bestScore');
  const levelEl = document.getElementById('level');
  const lengthEl = document.getElementById('length');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const wrapToggle = document.getElementById('wrapToggle');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const overlayAction = document.getElementById('overlayAction');

  const size = 24;
  const cell = canvas.width / size;
  const speeds = {
    easy: 150,
    normal: 112,
    fast: 78
  };

  const state = {
    snake: [],
    food: { x: 16, y: 12 },
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    score: 0,
    level: 1,
    speedKey: 'normal',
    wrap: false,
    running: false,
    paused: false,
    over: false,
    accumulator: 0,
    lastTime: 0
  };

  function storageKey() {
    return `snakeBest:${state.speedKey}:${state.wrap ? 'wrap' : 'walls'}`;
  }

  function getBest() {
    try {
      return Number(localStorage.getItem(storageKey()) || 0);
    } catch (_) {
      return 0;
    }
  }

  function setBest(value) {
    try {
      localStorage.setItem(storageKey(), String(value));
    } catch (_) {
      return false;
    }
    return true;
  }

  function showOverlay(title, text, actionText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayAction.textContent = actionText;
    overlay.classList.add('active');
  }

  function hideOverlay() {
    overlay.classList.remove('active');
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    bestScoreEl.textContent = getBest();
    levelEl.textContent = state.level;
    lengthEl.textContent = state.snake.length;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  }

  function reset() {
    state.snake = [
      { x: 7, y: 12 },
      { x: 6, y: 12 },
      { x: 5, y: 12 }
    ];
    state.food = { x: 16, y: 12 };
    state.dir = { x: 1, y: 0 };
    state.nextDir = { x: 1, y: 0 };
    state.score = 0;
    state.level = 1;
    state.running = false;
    state.paused = false;
    state.over = false;
    state.accumulator = 0;
    state.lastTime = 0;
    spawnFood();
    updateHud();
    draw();
    showOverlay('Ready?', 'Press Start, use arrow keys or WASD, and keep moving.', 'Start game');
  }

  function start() {
    if (state.over) reset();
    state.running = true;
    state.paused = false;
    hideOverlay();
    updateHud();
    requestAnimationFrame(loop);
  }

  function pause() {
    if (state.over) return;
    if (!state.running) {
      start();
      return;
    }
    state.paused = !state.paused;
    if (state.paused) {
      showOverlay('Paused', 'Take a breath. Resume when you are ready.', 'Resume');
    } else {
      hideOverlay();
      state.lastTime = 0;
      requestAnimationFrame(loop);
    }
    updateHud();
  }

  function isSameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function spawnFood() {
    const occupied = new Set(state.snake.map((part) => `${part.x},${part.y}`));
    const free = [];
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      }
    }
    state.food = free[Math.floor(Math.random() * free.length)] || { x: 0, y: 0 };
  }

  function canTurn(dir) {
    return !(dir.x + state.dir.x === 0 && dir.y + state.dir.y === 0);
  }

  function setDirection(dir) {
    if (!state.running && !state.over) start();
    if (canTurn(dir)) state.nextDir = dir;
  }

  function currentDelay() {
    return Math.max(48, speeds[state.speedKey] - (state.level - 1) * 7);
  }

  function step() {
    state.dir = state.nextDir;
    const head = {
      x: state.snake[0].x + state.dir.x,
      y: state.snake[0].y + state.dir.y
    };

    if (state.wrap) {
      head.x = (head.x + size) % size;
      head.y = (head.y + size) % size;
    } else if (head.x < 0 || head.x >= size || head.y < 0 || head.y >= size) {
      finish();
      return;
    }

    const willEat = isSameCell(head, state.food);
    const bodyToCheck = willEat ? state.snake : state.snake.slice(0, -1);
    if (bodyToCheck.some((part) => isSameCell(part, head))) {
      finish();
      return;
    }

    state.snake.unshift(head);
    if (willEat) {
      state.score += 10;
      state.level = Math.floor(state.score / 50) + 1;
      spawnFood();
    } else {
      state.snake.pop();
    }
    updateHud();
  }

  function finish() {
    state.running = false;
    state.paused = false;
    state.over = true;
    const best = getBest();
    const isRecord = state.score > best;
    if (isRecord) setBest(state.score);
    updateHud();
    draw();
    showOverlay(
      isRecord ? 'New best' : 'Game over',
      `Final score: ${state.score}. Length: ${state.snake.length}.`,
      'Play again'
    );
  }

  function drawGrid() {
    ctx.fillStyle = '#102018';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#14281f' : '#11241b';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawSnake() {
    state.snake.forEach((part, index) => {
      const x = part.x * cell + 3;
      const y = part.y * cell + 3;
      const pad = index === 0 ? 2 : 4;
      const gradient = ctx.createLinearGradient(x, y, x + cell, y + cell);
      gradient.addColorStop(0, index === 0 ? '#80e2a1' : '#57bd75');
      gradient.addColorStop(1, index === 0 ? '#2f8d54' : '#276c43');
      roundedRect(x + pad / 2, y + pad / 2, cell - 6 - pad, cell - 6 - pad, 8);
      ctx.fillStyle = gradient;
      ctx.fill();

      if (index === 0) {
        const eyeOffsetX = state.dir.x === 0 ? 8 : state.dir.x > 0 ? 17 : 7;
        const eyeOffsetY = state.dir.y === 0 ? 8 : state.dir.y > 0 ? 17 : 7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(part.x * cell + eyeOffsetX, part.y * cell + eyeOffsetY, 3, 0, Math.PI * 2);
        ctx.arc(part.x * cell + (state.dir.x === 0 ? 22 : eyeOffsetX), part.y * cell + (state.dir.y === 0 ? 22 : eyeOffsetY), 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function drawFood() {
    const x = state.food.x * cell + cell / 2;
    const y = state.food.y * cell + cell / 2;
    const pulse = state.running ? Math.sin(Date.now() / 160) * 1.5 : 0;
    ctx.save();
    ctx.shadowColor = '#ff6b55';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff6b55';
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.26 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    drawGrid();
    drawFood();
    drawSnake();
  }

  function loop(timestamp) {
    if (!state.running || state.paused || state.over) return;
    if (!state.lastTime) state.lastTime = timestamp;
    const delta = timestamp - state.lastTime;
    state.lastTime = timestamp;
    state.accumulator += delta;

    while (state.accumulator >= currentDelay()) {
      step();
      state.accumulator -= currentDelay();
      if (state.over) break;
    }

    draw();
    if (!state.over) requestAnimationFrame(loop);
  }

  function setSpeed(key) {
    state.speedKey = key;
    document.querySelectorAll('[data-speed]').forEach((button) => {
      button.classList.toggle('active', button.dataset.speed === key);
    });
    updateHud();
  }

  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => setSpeed(button.dataset.speed));
  });

  wrapToggle.addEventListener('click', () => {
    state.wrap = !state.wrap;
    wrapToggle.setAttribute('aria-pressed', String(state.wrap));
    wrapToggle.textContent = state.wrap ? 'Wrap through walls' : 'Classic walls';
    updateHud();
  });

  startBtn.addEventListener('click', start);
  restartBtn.addEventListener('click', () => {
    reset();
    start();
  });
  pauseBtn.addEventListener('click', pause);
  overlayAction.addEventListener('click', () => {
    if (state.paused) pause();
    else start();
  });

  document.addEventListener('keydown', (event) => {
    const map = {
      ArrowUp: { x: 0, y: -1 },
      w: { x: 0, y: -1 },
      W: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      s: { x: 0, y: 1 },
      S: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      a: { x: -1, y: 0 },
      A: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      d: { x: 1, y: 0 },
      D: { x: 1, y: 0 }
    };
    if (event.code === 'Space') {
      event.preventDefault();
      pause();
      return;
    }
    const dir = map[event.key];
    if (dir) {
      event.preventDefault();
      setDirection(dir);
    }
  });

  let touchStart = null;
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  canvas.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDirection(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
  }, { passive: true });

  document.querySelectorAll('[data-dir]').forEach((button) => {
    button.addEventListener('click', () => {
      const dir = button.dataset.dir;
      if (dir === 'pause') {
        pause();
      } else if (dir === 'up') setDirection({ x: 0, y: -1 });
      else if (dir === 'down') setDirection({ x: 0, y: 1 });
      else if (dir === 'left') setDirection({ x: -1, y: 0 });
      else if (dir === 'right') setDirection({ x: 1, y: 0 });
    });
  });

  reset();
}());
