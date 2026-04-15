// @ts-check
import { px, s } from "../config.js";

/**
 * Create a styled button with the ui_button_frame background (or rectangle
 * fallback). Hover changes text to gold. No zoom animation.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {string} label
 * @param {object} [options]
 * @param {number} [options.width=220] - Button width (pre-scale)
 * @param {number} [options.fontSize=18] - Font size (pre-scale)
 * @param {string} [options.fontColor="#ffffff"] - Default text color
 * @param {string} [options.hoverColor="#f5c518"] - Hover text color
 * @param {number} [options.bgColor=0x4a2c7a] - Fallback rectangle color
 * @returns {{ container: Phaser.GameObjects.Container, hitArea: Phaser.GameObjects.Rectangle }}
 */
export function createButton(scene, x, y, label, options = {}) {
    const {
        width = 220,
        fontSize = 18,
        fontColor = "#ffffff",
        hoverColor = "#f5c518",
        bgColor = 0x4a2c7a,
    } = options;

    const btnW = s(width);
    const btnH = s(Math.round(width * 0.4704684318));
    const container = scene.add.container(x, y);

    if (scene.textures.exists("ui_button_frame")) {
        const bgImg = scene.add.image(0, 0, "ui_button_frame");
        bgImg.setDisplaySize(btnW, btnH);
        container.add(bgImg);
    } else {
        container.add(scene.add.rectangle(0, 0, btnW, btnH, bgColor));
    }

    const textObj = scene.add
        .text(0, 0, label, {
            fontSize: px(fontSize),
            fontFamily: "Georgia, serif",
            color: fontColor,
            fontStyle: "bold",
        })
        .setOrigin(0.5);
    container.add(textObj);

    const hitArea = scene.add
        .rectangle(0, 0, btnW, btnH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on("pointerover", () => textObj.setStyle({ color: hoverColor }));
    hitArea.on("pointerout", () => textObj.setStyle({ color: fontColor }));

    return { container, hitArea };
}
