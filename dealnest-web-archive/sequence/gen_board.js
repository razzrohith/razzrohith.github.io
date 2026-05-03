const fs = require('fs');

const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Q', 'K']; // No J

let cards = [];
for (let i = 0; i < 2; i++) {
    for (let s of suits) {
        for (let r of ranks) {
            cards.push(r + s);
        }
    }
}

// Shuffle
for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
}

const board = Array(10).fill(null).map(() => Array(10).fill(null));

let cIdx = 0;
for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
        if ((r === 0 && c === 0) || (r === 0 && c === 9) || (r === 9 && c === 0) || (r === 9 && c === 9)) {
            continue;
        }
        board[r][c] = cards[cIdx++];
    }
}

console.log(JSON.stringify(board));
fs.writeFileSync('board_layout.json', JSON.stringify(board, null, 2));
