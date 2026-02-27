const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '..'))); // To allow index to load from root if needed
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const COLORS = ['green', 'blue', 'red', 'yellow'];

// State
// rooms[code] = { code, players: { socketId: { color, name } }, state: { turnIndex, diceValue, tokens } }
const rooms = new Map();

function createInitialState() {
    return {
        turnIndex: 0, // 0:green, 1:blue, 2:red, 3:yellow
        diceValue: null,
        rollValid: false,
        players: {
            green: { joined: false, name: null, tokens: [-1, -1, -1, -1] },
            blue: { joined: false, name: null, tokens: [-1, -1, -1, -1] },
            red: { joined: false, name: null, tokens: [-1, -1, -1, -1] },
            yellow: { joined: false, name: null, tokens: [-1, -1, -1, -1] }
        },
        logs: []
    };
}

// Socket.io
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('joinRoom', ({ roomCode, playerName }) => {
        roomCode = roomCode.toUpperCase();
        if (!rooms.has(roomCode)) {
            rooms.set(roomCode, {
                code: roomCode,
                connections: new Map(), // socket.id -> { color, name }
                state: createInitialState(),
                playersOnline: 0
            });
        }

        const room = rooms.get(roomCode);

        // Find an empty color slot
        let assignedColor = null;
        for (const color of COLORS) {
            if (!room.state.players[color].joined) {
                assignedColor = color;
                room.state.players[color].joined = true;
                room.state.players[color].name = playerName;
                break;
            }
        }

        if (!assignedColor) {
            socket.emit('errorMsg', 'Room is full (4 players max)');
            return;
        }

        room.connections.set(socket.id, { color: assignedColor, name: playerName });
        room.playersOnline++;
        socket.join(roomCode);

        room.state.logs.push(`${playerName} joined as ${assignedColor.toUpperCase()}`);
        console.log(`[${roomCode}] ${playerName} joined as ${assignedColor}`);

        socket.emit('joined', { roomCode, color: assignedColor, state: room.state });
        io.to(roomCode).emit('gameStateUpdate', room.state);
    });

    socket.on('rollDice', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.connections.get(socket.id);
        if (!player) return;

        // Verify it's their turn
        if (COLORS[room.state.turnIndex] !== player.color) {
            socket.emit('errorMsg', "Not your turn!");
            return;
        }

        if (room.state.rollValid) {
            socket.emit('errorMsg', "Already rolled!");
            return;
        }

        // Generate Roll Server-Side
        const roll = Math.floor(Math.random() * 6) + 1;
        room.state.diceValue = roll;
        room.state.rollValid = true;

        room.state.logs.push(`${player.name} rolled a ${roll}`);

        io.to(roomCode).emit('diceRolled', { roll, state: room.state });
    });

    socket.on('moveToken', ({ roomCode, tokenIndex }) => {
        const room = rooms.get(roomCode);
        if (!room) return;

        const player = room.connections.get(socket.id);
        if (!player) return;

        if (COLORS[room.state.turnIndex] !== player.color) return;
        if (!room.state.rollValid) return;

        const color = player.color;
        const step = room.state.players[color].tokens[tokenIndex];
        const roll = room.state.diceValue;

        // Basic validation matching client logic
        let validMove = false;
        if (step === -1 && roll === 6) {
            validMove = true;
            room.state.players[color].tokens[tokenIndex] = 0;
            room.state.logs.push(`${player.name} brought a token out!`);
        } else if (step !== -1 && step + roll <= 56) {
            validMove = true;
            room.state.players[color].tokens[tokenIndex] += roll;
            room.state.logs.push(`${player.name} moved a token ${roll} spaces.`);
        }

        if (!validMove) return;

        // ── Phase 2: Capture Logic (Simplified) ──
        const newStep = room.state.players[color].tokens[tokenIndex];
        let capturedSomeone = false;

        if (newStep >= 0 && newStep <= 50) {
            const START_INDEX = { green: 1, blue: 14, red: 27, yellow: 40 };
            const SAFE_SPOTS = [1, 9, 14, 22, 27, 35, 40, 48];
            const movingGlobalIndex = (START_INDEX[color] + newStep) % 52;

            if (!SAFE_SPOTS.includes(movingGlobalIndex)) {
                COLORS.forEach(c => {
                    if (c !== color) {
                        room.state.players[c].tokens.forEach((s, idx) => {
                            if (s >= 0 && s <= 50) {
                                const otherGlobalIndex = (START_INDEX[c] + s) % 52;
                                if (movingGlobalIndex === otherGlobalIndex) {
                                    room.state.players[c].tokens[idx] = -1; // Captured!
                                    capturedSomeone = true;
                                    room.state.logs.push(`${player.name} CAPTURED ${c}'s token!`);
                                }
                            }
                        });
                    }
                });
            }
        }

        room.state.rollValid = false;

        // Determine next turn
        // Rule: rolling a 6 or capturing someone grants an extra turn
        if (roll !== 6 && !capturedSomeone) {
            room.state.turnIndex = (room.state.turnIndex + 1) % 4;
            room.state.diceValue = null;
        }

        io.to(roomCode).emit('gameStateUpdate', room.state);
    });

    // Pass turn if no valid moves exist
    socket.on('passTurn', ({ roomCode }) => {
        const room = rooms.get(roomCode);
        if (!room) return;
        const player = room.connections.get(socket.id);
        if (!player || COLORS[room.state.turnIndex] !== player.color) return;

        room.state.turnIndex = (room.state.turnIndex + 1) % 4;
        room.state.diceValue = null;
        room.state.rollValid = false;

        io.to(roomCode).emit('gameStateUpdate', room.state);
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        // Remove from rooms
        for (const [code, room] of rooms.entries()) {
            if (room.connections.has(socket.id)) {
                const player = room.connections.get(socket.id);
                room.connections.delete(socket.id);
                room.state.players[player.color].joined = false;
                room.state.players[player.color].name = null;
                room.state.logs.push(`${player.name} (${player.color}) disconnected.`);
                room.playersOnline--;

                if (room.playersOnline <= 0) {
                    rooms.delete(code); // Clean up empty room
                    console.log(`Room ${code} deleted (empty)`);
                } else {
                    io.to(code).emit('gameStateUpdate', room.state);
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Ludo server running on port ${PORT}`);
});
