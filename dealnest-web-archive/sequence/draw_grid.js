async function drawGrid() {
    try {
        const jimp = await import('jimp');
        const JimpModule = jimp.Jimp || jimp.default;
        const image = await JimpModule.read('public/assets/reference.jpg');

        const startX = 64;
        const startY = 64; // Adjusted from 116
        const gapX = 51.5;
        const gapY = 51.5;

        const red = 0xFF0000FF; // RGBA

        // Draw Horizontal lines
        for (let r = 0; r <= 10; r++) {
            const y = Math.round(startY + r * gapY);
            for (let x = startX; x <= startX + 10 * gapX; x++) {
                if (y >= 0 && y < image.bitmap.height && x >= 0 && x < image.bitmap.width) {
                    image.setPixelColor(red, Math.round(x), y);
                    image.setPixelColor(red, Math.round(x), y + 1); // thicker
                }
            }
        }

        // Draw Vertical lines
        for (let c = 0; c <= 10; c++) {
            const x = Math.round(startX + c * gapX);
            for (let y = startY; y <= startY + 10 * gapY; y++) {
                if (y >= 0 && y < image.bitmap.height && x >= 0 && x < image.bitmap.width) {
                    image.setPixelColor(red, x, Math.round(y));
                    image.setPixelColor(red, x + 1, Math.round(y)); // thicker
                }
            }
        }

        await image.write('public/assets/grid_test.jpg');
        console.log("Saved grid_test.jpg");
    } catch (e) {
        console.error("Error drawing grid:", e);
    }
}

drawGrid();
