// @ts-check
import { px, s } from "../config.js";

/**
 * Create and render the Overture logo with consistent sizing.
 * Falls back to styled text if the logo texture is unavailable.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x - Center X position
 * @param {number} y - Center Y position
 * @param {object} options
 * @param {number} options.width - Logo width in design pixels (pre-DPR scaling)
 * @param {number} [options.depth]
 * @param {number} [options.originX=0.5]
 * @param {number} [options.originY=0.5]
 * @param {string} [options.fallbackText="Overture"]
 * @param {number} [options.fallbackFontSize] - Font size in design pixels (pre-DPR scaling)
 *
 * @returns {Phaser.GameObjects.Image | Phaser.GameObjects.Text}
 */
export function createLogo(scene, x, y, options) {
    const {
        width,
        depth,
        originX = 0.5,
        originY = 0.5,
        fallbackText = "Overture",
        fallbackFontSize = Math.max(24, Math.round(width * 0.2)),
    } = options;

    const logoKey = "ui_logo";

    if (scene.textures.exists(logoKey)) {
        const frame = scene.textures.getFrame(logoKey);
        if (frame?.width && frame?.height) {
            const logo = scene.add.image(x, y, logoKey).setOrigin(originX, originY);
            const displayW = s(width);
            const displayH = Math.round(displayW * (frame.height / frame.width));
            logo.setDisplaySize(displayW, displayH);
            if (depth !== undefined) logo.setDepth(depth);

            return logo;
        }
    }

    const fallback = scene.add
        .text(x, y, fallbackText, {
            fontSize: px(fallbackFontSize),
            fontFamily: "Georgia, serif",
            color: "#f5c518",
            fontStyle: "bold",
        })
        .setOrigin(originX, originY);

    if (depth !== undefined) fallback.setDepth(depth);
    return fallback;
}
