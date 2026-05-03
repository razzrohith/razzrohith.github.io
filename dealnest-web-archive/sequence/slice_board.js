async function slice() {
    try {
        const jimp = await import('jimp');
        const JimpModule = jimp.Jimp || jimp.default;
        const image = await JimpModule.read('public/assets/reference.jpg');
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 10; c++) {
                const x = Math.round(64 + c * 51.5);
                const y = Math.round(64 + r * 51.5);
                const w = 52;
                const h = 52;

                // Clone the image for each crop
                const copy = image.clone();
                copy.crop({ x, y, w, h }); // Jimp 1.x takes an object
                await copy.write(`public/assets/board_tiles/tile_${r}_${c}.jpg`);
            }
        }
        console.log("Successfully generated all 100 tiles!");
    } catch (e) {
        console.error("Error during slicing:", e);
    }
}

slice();
