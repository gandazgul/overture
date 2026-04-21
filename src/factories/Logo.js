// @ts-check
import { px, s } from "../config.js";

/**
 * Create and render the Overture logo with consistent sizing.
 * Falls back to styled text if the logo texture is unavailable.
 *
 * @param {Phaser.Scene} scene
 * @param {object} options
 * @param {number} options.width - Logo width in design pixels (pre-DPR scaling)
 * @param {number} [options.depth]
 * @param {number} [options.originX=0.5]
 * @param {number} [options.originY=0.5]
 * @param {string} [options.fallbackText="Overture"]
 * @param {number} [options.fallbackFontSize] - Font size in design pixels (pre-DPR scaling)
 *
 * @returns {number} The Y position of the logo's center, useful for layout purposes.
 */
export function createLogo(scene, options) {
    const {
        width,
        depth,
        originX = 20,
        originY = 20,
        fallbackText = "Overture",
        fallbackFontSize = Math.max(24, Math.round(width * 0.2)),
    } = options;

    const logoKey = "ui_logo";

    if (scene.textures.exists(logoKey)) {
        const frame = scene.textures.getFrame(logoKey);
        if (frame?.width && frame?.height) {
            const displayW = s(width);
            const displayH = Math.round(displayW * (frame.height / frame.width));
            const logoX = displayW / 2 + originX;
            const logoY = displayH / 2 + originY;
            const logo = scene.add.image(logoX, logoY, logoKey);
            logo.setDisplaySize(displayW, displayH);
            if (depth !== undefined) logo.setDepth(depth);

            // Create a graphics object
            const graphics = scene.add.graphics();

            // Set the line style: thickness (4px), color (red: 0xff0000), and alpha (1)
            graphics.lineStyle(4, 0xff0000, 1);

            // Draw from the top-middle to the bottom-middle
            graphics.lineBetween(logoX, 0, logoX, 1900);

            return originY + displayH;
        }
    }

    const fallback = scene.add
        .text(originX, originY, fallbackText, {
            fontSize: px(fallbackFontSize),
            fontFamily: "Georgia, serif",
            color: "#f5c518",
            fontStyle: "bold",
        });

    if (depth !== undefined) fallback.setDepth(depth);

    return originY;
}
