// @ts-check
import { px, s } from "../config.js";
import { AISLE_GAP, SEAT_GAP, SEAT_SIZE } from "../constants.js";

/**
 * Resolve stage aspect ratio from texture when available.
 * Falls back to legacy hardcoded ratio.
 *
 * @param {Phaser.Scene} scene
 *
 * @returns {number} height / width
 */
export function getStageAspectRatio(scene) {
    if (scene.textures.exists("ui_stage")) {
        const frame = scene.textures.getFrame("ui_stage");
        if (frame?.width && frame?.height) {
            return frame.height / frame.width;
        }
    }

    return 720 / 1366;
}

/**
 * Compute stage display height from target display width.
 *
 * @param {Phaser.Scene} scene
 * @param {number} displayWidth
 * @returns {number}
 */
export function getStageDisplayHeight(scene, displayWidth) {
    return Math.round(displayWidth * getStageAspectRatio(scene));
}

/**
 * Create and render the stage visual.
 * Falls back to a rectangle when texture is unavailable.
 *
 * @param {Phaser.Scene} scene
 * @param {{ x: number, top: number, label: string, depth?: number }} options
 * @returns {{ stage: Phaser.GameObjects.Container, height: number }}
 */
export function createStage(scene, options) {
    const { depth = 2, x, top, label } = options;

    // this matches the narrowest theater width (Blackbox)
    const width = SEAT_SIZE * 4 + SEAT_GAP * 2 + AISLE_GAP;
    const height = getStageDisplayHeight(scene, width);
    const y = top + (height / 2);

    const stage = scene.add.container(x, y);

    if (scene.textures.exists("ui_stage")) {
        const stageImg = scene.add.image(0, 0, "ui_stage");
        stageImg.setDisplaySize(width, height);
        stageImg.setDepth(depth);

        stage.add(stageImg);
    } else {
        const stageFallback = scene.add
            .rectangle(0, 0, width, height, 0x8b4513)
            .setStrokeStyle(s(1), 0xdaa520)
            .setDepth(depth);

        stage.add(stageFallback);
    }

    const stageLabel = scene.add
        .text(0, 0, label, {
            fontSize: px(36),
            color: "#ffd700",
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            shadow: { blur: 8, color: "#000000", fill: true },
        })
        .setOrigin(0.5)
        .setDepth(3);

    stage.add(stageLabel);

    return { stage, height };
}
