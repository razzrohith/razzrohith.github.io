const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
    id: String,
    name: String,
    team: String,
    ready: Boolean,
    cards: [mongoose.Schema.Types.Mixed],
    socketIds: [String]
});

const cellSchema = new mongoose.Schema({
    color: String,
    locked: Boolean
});

const roomSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    hostId: String,
    board: [[cellSchema]],
    cardPositions: [[String]],
    availableColors: [String],
    players: [playerSchema],
    deck: [mongoose.Schema.Types.Mixed],
    discardPile: [mongoose.Schema.Types.Mixed],
    sequences: [String],
    teamWinCounts: { type: Map, of: Number, default: {} },
    winner: String,
    turnIndex: { type: Number, default: 0 },
    gameStarted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
