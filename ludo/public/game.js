const socket = io();

// UI Elements
const homeScreen = document.getElementById('home');
const gameScreen = document.getElementById('game');
const nameInput = document.getElementById('nameInput');
const roomInput = document.getElementById('roomInput');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const homeError = document.getElementById('homeError');
const roomDisplay = document.getElementById('roomDisplay');

const tokensLayer = document.getElementById('tokensLayer');
const rollBtn = document.getElementById('rollBtn');
const diceCube = document.getElementById('diceCube');
const turnIndicator = document.getElementById('turnIndicator');

const COLORS = ['green', 'blue', 'red', 'yellow'];

let currentRoom = null;
let myColor = null;
let gameState = null;
let tokenEls = [];

// ── Lobby Setup ── //

function showError(msg) {
    homeError.textContent = msg;
    homeError.style.display = 'block';
    setTimeout(() => homeError.style.display = 'none', 3000);
}

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Player 1';
    const code = generateRoomCode();
    socket.emit('joinRoom', { roomCode: code, playerName: name });
});

joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim() || 'Player';
    const code = roomInput.value.trim().toUpperCase();
    if (code.length === 4) {
        socket.emit('joinRoom', { roomCode: code, playerName: name });
    } else {
        showError('Enter a valid 4-character room code.');
    }
});

leaveBtn.addEventListener('click', () => {
    window.location.reload();
});

// ── Socket Events ── //

socket.on('errorMsg', (msg) => {
    if (!currentRoom) showError(msg);
    else alert(msg); // Cheap in-game error handling
});

socket.on('joined', (data) => {
    currentRoom = data.roomCode;
    myColor = data.color;
    roomDisplay.textContent = `Room: ${currentRoom}`;
    roomDisplay.style.color = `var(--${myColor})`;

    homeScreen.classList.remove('active');
    gameScreen.classList.add('active');

    initBoardDOM();
});

socket.on('gameStateUpdate', (state) => {
    gameState = state;
    updateBoard();
});

socket.on('diceRolled', ({ roll, state }) => {
    // We animate the dice exactly to `roll`, wait, then update state
    diceCube.classList.add('rolling');

    setTimeout(() => {
        diceCube.classList.remove('rolling');
        const rot = rotationMap[roll];
        const finalRX = rot.x + 360 * 2;
        const finalRY = rot.y + 360 * 2;
        diceCube.style.transform = `translateZ(-30px) rotateX(${finalRX}deg) rotateY(${finalRY}deg)`;

        // After dice lands, apply state
        setTimeout(() => {
            gameState = state;
            updateBoard();

            // Auto pass turn if I rolled but have no valid moves
            if (COLORS[gameState.turnIndex] === myColor && gameState.rollValid) {
                let hasMove = false;
                for (let i = 0; i < 4; i++) {
                    if (canMove(myColor, i, roll)) hasMove = true;
                }
                if (!hasMove) {
                    setTimeout(() => socket.emit('passTurn', { roomCode: currentRoom }), 1000);
                }
            }
        }, 500);
    }, 1000); // 1s rolling animation
});

// ── Board DOM & Rendering ── //

function initBoardDOM() {
    tokensLayer.innerHTML = '';
    tokenEls = [];

    COLORS.forEach(color => {
        for (let i = 0; i < 4; i++) {
            const el = document.createElement('div');
            el.className = `token token-${color}`;
            el.dataset.color = color;
            el.dataset.index = i;

            const piece = document.createElement('div');
            piece.className = 'token-piece';
            el.appendChild(piece);

            // Important: Handle clicks via Socket.io
            el.addEventListener('click', () => handleTokenClick(color, i));

            tokensLayer.appendChild(el);
            tokenEls.push(el);
        }
    });
}

function updateBoard() {
    if (!gameState) return;

    // Update Player Names
    COLORS.forEach(c => {
        const slotState = gameState.players[c];
        const slotEl = document.querySelector(`#slot-${c} .player-name`);
        if (slotEl) {
            slotEl.textContent = slotState.joined ? slotState.name : 'Waiting...';
            slotEl.style.opacity = slotState.joined ? '1' : '0.5';
        }
    });

    // Update Turn Indicator
    const currentTurnColor = COLORS[gameState.turnIndex];
    if (currentTurnColor === myColor) {
        turnIndicator.textContent = "Your Turn!";
        turnIndicator.style.color = "#fff";
        turnIndicator.style.textShadow = `0 0 10px var(--${myColor})`;
        rollBtn.disabled = gameState.rollValid; // Can roll if haven't yet
    } else {
        const activePlayerName = gameState.players[currentTurnColor].name || 'Waiting...';
        turnIndicator.textContent = `${activePlayerName}'s Turn`;
        turnIndicator.style.color = `var(--${currentTurnColor})`;
        turnIndicator.style.textShadow = 'none';
        rollBtn.disabled = true;
    }

    // Sync Token Positions
    tokenEls.forEach(el => {
        const color = el.dataset.color;
        const index = parseInt(el.dataset.index);
        const step = gameState.players[color].tokens[index];

        const pos = getDisplayPosition(color, step, index);
        if (pos) {
            el.style.left = pos.left;
            el.style.top = pos.top;
            el.style.display = 'block';
        } else {
            el.style.display = 'none';
        }

        // Highlight my valid tokens
        if (color === myColor && currentTurnColor === myColor && gameState.rollValid && canMove(color, index, gameState.diceValue)) {
            el.style.filter = 'drop-shadow(0 0 15px white)';
            el.style.cursor = 'pointer';
            el.style.zIndex = 100;
        } else {
            el.style.filter = 'none';
            el.style.cursor = 'default';
            el.style.zIndex = 10;
        }
    });
}

// ── Dice & Move Logic (Client Auth Check only) ── //

const rotationMap = {
    1: { x: 0, y: 0 },
    2: { x: 0, y: 180 },
    3: { x: 0, y: -90 },
    4: { x: 0, y: 90 },
    5: { x: -90, y: 0 },
    6: { x: 90, y: 0 }
};

rollBtn.addEventListener('click', () => {
    if (COLORS[gameState.turnIndex] === myColor && !gameState.rollValid) {
        rollBtn.disabled = true;
        socket.emit('rollDice', { roomCode: currentRoom });
    }
});

function canMove(color, tokenIndex, roll) {
    if (!roll) return false;
    if (color !== COLORS[gameState.turnIndex]) return false;
    const step = gameState.players[color].tokens[tokenIndex];

    if (step === -1) {
        return roll === 6; // Need a 6 to exit yard
    }
    if (step + roll <= 56) {
        return true; // Valid move towards finish line
    }
    return false;
}

function handleTokenClick(color, tokenIndex) {
    // Only process if it's strictly my piece and valid move
    if (color !== myColor) return;
    if (COLORS[gameState.turnIndex] !== myColor) return;
    if (!gameState.rollValid) return;

    if (canMove(color, tokenIndex, gameState.diceValue)) {
        socket.emit('moveToken', { roomCode: currentRoom, tokenIndex });
    }
}
