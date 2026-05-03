const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

const layout = [
    [null, "6♣", "A♥", "K♠", "K♣", "9♥", "K♠", "6♣", "2♣", null],
    ["2♠", "A♦", "2♣", "8♣", "8♦", "10♠", "7♥", "8♥", "5♥", "10♣"],
    ["8♠", "7♠", "8♥", "Q♠", "6♦", "A♣", "2♥", "3♣", "9♣", "5♦"],
    ["Q♦", "9♣", "8♠", "7♠", "4♠", "Q♥", "5♠", "3♥", "10♦", "3♦"],
    ["5♦", "4♥", "3♦", "9♥", "6♠", "4♦", "7♦", "2♥", "3♣", "Q♥"],
    ["2♠", "4♠", "7♦", "6♥", "2♦", "6♦", "Q♠", "7♣", "4♥", "9♦"],
    ["4♣", "9♠", "4♦", "9♠", "10♣", "7♥", "A♠", "K♣", "9♦", "3♥"],
    ["8♦", "2♦", "A♣", "K♦", "4♣", "A♥", "3♠", "5♠", "Q♣", "10♠"],
    ["8♣", "3♠", "Q♦", "A♦", "10♥", "Q♣", "7♣", "5♣", "6♠", "K♦"],
    [null, "6♥", "K♥", "K♥", "5♥", "10♥", "5♣", "A♠", "10♦", null]
];

const W = 200;
const H = 200;

async function run() {
    console.log("Loading face images...");
    const faceImages = {
        'J': await loadImage('C:/Users/razzr/.gemini/antigravity/brain/b240276d-b7a1-441c-aa30-cf355827940e/vintage_jack_1772281541083.png'),
        'Q': await loadImage('C:/Users/razzr/.gemini/antigravity/brain/b240276d-b7a1-441c-aa30-cf355827940e/vintage_queen_1772281555599.png'),
        'K': await loadImage('C:/Users/razzr/.gemini/antigravity/brain/b240276d-b7a1-441c-aa30-cf355827940e/vintage_king_1772281570776.png')
    };

    if (!fs.existsSync('public/assets/board_tiles')) {
        fs.mkdirSync('public/assets/board_tiles', { recursive: true });
    }

    function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius)
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y)
            rot += step
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y)
            rot += step
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
    }

    console.log("Generating 100 tiles...");
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
            const card = layout[r][c];
            const canvas = createCanvas(W, H);
            const ctx = canvas.getContext('2d');

            // Parchment bg
            ctx.fillStyle = '#f4ecd8';
            ctx.fillRect(0, 0, W, H);

            ctx.strokeStyle = '#c4b594';
            ctx.lineWidth = 10;
            ctx.strokeRect(0, 0, W, H);

            ctx.strokeStyle = '#8e7d56';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, W - 10, H - 10);

            if (!card) {
                // Wild
                ctx.fillStyle = '#bfa145';
                drawStar(ctx, W / 2, H / 2 - 15, 5, 60, 25);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#333';
                ctx.font = 'bold 30px Georgia';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('WILD', W / 2, H / 2 + 55);

            } else if (card === 'WC') {
                ctx.beginPath();
                ctx.arc(W / 2, H / 2, 60, 0, 2 * Math.PI);
                ctx.fillStyle = '#b32020';
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#f4ecd8';
                ctx.font = 'bold 45px Georgia';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('WC', W / 2, H / 2);

            } else {
                const rank = card.slice(0, -1);
                const suit = card.slice(-1);
                const isRed = suit === '♥' || suit === '♦';
                const color = isRed ? '#b32020' : '#1c1c1c';

                // If face card, draw full bleed image first
                if (['J', 'Q', 'K'].includes(rank)) {
                    const img = faceImages[rank];
                    // Draw image inside the gold border (5px border + 2px inner = 7px padding)
                    // The inner square is 186x186
                    ctx.drawImage(img, 7, 7, W - 14, H - 14);
                } else {
                    ctx.fillStyle = color;
                    ctx.font = '100px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(suit, W / 2, H / 2);
                }

                ctx.fillStyle = color;

                // Draw solid background behind text to ensure readability over image
                if (['J', 'Q', 'K'].includes(rank)) {
                    ctx.fillStyle = '#f4ecd8'; // matching parchment
                    ctx.fillRect(15, 15, 40, 80);
                    ctx.fillRect(W - 55, H - 95, 40, 80);
                    ctx.fillStyle = color;
                }

                // Top Left
                ctx.textAlign = 'center';
                ctx.font = 'bold 36px Georgia';
                ctx.fillText(rank, 35, 45);
                ctx.font = '36px Arial';
                ctx.fillText(suit, 35, 80);

                // Bottom Right
                ctx.save();
                ctx.translate(W, H);
                ctx.rotate(Math.PI);
                ctx.textAlign = 'center';
                ctx.font = 'bold 36px Georgia';
                ctx.fillText(rank, 35, 45);
                ctx.font = '36px Arial';
                ctx.fillText(suit, 35, 80);
                ctx.restore();
            }

            const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
            fs.writeFileSync(`public/assets/board_tiles/tile_${r}_${c}.jpg`, buffer);
        }
    }
    console.log("Deck generation complete!");
}

run().catch(console.error);
