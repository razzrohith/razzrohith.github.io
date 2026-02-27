// Ludo Board Coordinate System
// The board is a standard 15x15 grid. We map each tile to its (col, row) index (0-14).
// The board image has a wooden frame, so we offset the playable area by a padding percentage.
const BOARD_PADDING = 8.5; // % offset for the wooden frame (tweakable)
const PLAYABLE_SIZE = 100 - (BOARD_PADDING * 2);
const CELL_SIZE = PLAYABLE_SIZE / 15;

function getPos(col, row) {
    return {
        left: (BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2) + '%',
        top: (BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2) + '%'
    };
}

// 1. The Global Outer Path (52 Tiles)
// Starts at (0,6) and goes clockwise around the whole board.
const MAIN_PATH = [
    getPos(0, 6), getPos(1, 6), getPos(2, 6), getPos(3, 6), getPos(4, 6), getPos(5, 6), // Left arm top
    getPos(6, 5), getPos(6, 4), getPos(6, 3), getPos(6, 2), getPos(6, 1), getPos(6, 0), // Top arm left
    getPos(7, 0), getPos(8, 0),                                                         // Top arm top edge
    getPos(8, 1), getPos(8, 2), getPos(8, 3), getPos(8, 4), getPos(8, 5),               // Top arm right
    getPos(9, 6), getPos(10, 6), getPos(11, 6), getPos(12, 6), getPos(13, 6), getPos(14, 6), // Right arm top
    getPos(14, 7), getPos(14, 8),                                                       // Right arm edge
    getPos(13, 8), getPos(12, 8), getPos(11, 8), getPos(10, 8), getPos(9, 8),           // Right arm bottom
    getPos(8, 9), getPos(8, 10), getPos(8, 11), getPos(8, 12), getPos(8, 13), getPos(8, 14), // Bottom arm right
    getPos(7, 14), getPos(6, 14),                                                       // Bottom arm edge
    getPos(6, 13), getPos(6, 12), getPos(6, 11), getPos(6, 10), getPos(6, 9),           // Bottom arm left
    getPos(5, 8), getPos(4, 8), getPos(3, 8), getPos(2, 8), getPos(1, 8), getPos(0, 8), // Left arm bottom
    getPos(0, 7)                                                                         // Left arm edge
];

// 2. The Home Pathways (5 tiles per color leading to the final center)
const HOME_PATHS = {
    green: [getPos(1, 7), getPos(2, 7), getPos(3, 7), getPos(4, 7), getPos(5, 7)],
    blue: [getPos(7, 1), getPos(7, 2), getPos(7, 3), getPos(7, 4), getPos(7, 5)],
    red: [getPos(13, 7), getPos(12, 7), getPos(11, 7), getPos(10, 7), getPos(9, 7)],
    yellow: [getPos(7, 13), getPos(7, 12), getPos(7, 11), getPos(7, 10), getPos(7, 9)]
};

// 3. Final Center Trophies (The 100% completed state)
const FINISH_ZONES = {
    green: getPos(6.5, 7),
    blue: getPos(7, 6.5),
    red: getPos(7.5, 7),
    yellow: getPos(7, 7.5)
};

// 4. Starting Grid Coordinates inside the 4 glowing rings
function getYardPos(color, index) {
    const centers = {
        green: { c: 2.5, r: 2.5 },   // Top-Left
        blue: { c: 11.5, r: 2.5 },   // Top-Right
        red: { c: 11.5, r: 11.5 },   // Bottom-Right
        yellow: { c: 2.5, r: 11.5 }  // Bottom-Left
    };
    const offsets = [
        { dc: -0.6, dr: -0.6 },
        { dc: 0.6, dr: -0.6 },
        { dc: -0.6, dr: 0.6 },
        { dc: 0.6, dr: 0.6 }
    ];
    return getPos(centers[color].c + offsets[index].dc, centers[color].r + offsets[index].dr);
}

// Start index for each color on MAIN_PATH
const START_INDEX = {
    green: 1,      // (1, 6)
    blue: 14,      // (8, 1)
    red: 27,       // (13, 8)
    yellow: 40     // (6, 13)
};

const TURN_INDEX = {
    green: 50,
    blue: 11,
    red: 24,
    yellow: 37
};

// Safe spots where captures cannot happen (usually the starts and the inner star spots)
const SAFE_SPOTS = [
    1, 9, 14, 22, 27, 35, 40, 48
];

// Helper to convert an absolute token step count to a screen coordinate
// Steps:
// -1 = Yard
// 0 to 50 = traversing the board (relative to their start)
// 51 to 55 = traversing home path (5 tiles)
// 56 = Finished
function getDisplayPosition(color, step, tokenIndex) {
    if (step === -1) {
        return getYardPos(color, tokenIndex);
    }

    if (step === 56) {
        return FINISH_ZONES[color];
    }

    if (step >= 51 && step <= 55) {
        return HOME_PATHS[color][step - 51];
    }

    const mainIndex = (START_INDEX[color] + step) % 52;
    return MAIN_PATH[mainIndex];
}
