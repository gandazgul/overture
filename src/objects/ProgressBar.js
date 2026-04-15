// @ts-check
import Phaser from "phaser";
import { s } from "../config.js";

/**
 * A reusable loading progress bar.
 * Encapsulated in a Container for easy destruction.
 */
export class ProgressBar extends Phaser.GameObjects.Container {
    /** @type {Phaser.GameObjects.Rectangle} */
    fillBar;

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    constructor(scene, x, y, width, height) {
        super(scene, x, y);

        const borderPadding = s(2);

        // Outer border
        const barBorder = scene.add.rectangle(
            0,
            0,
            width + borderPadding * 2,
            height + borderPadding * 2,
            0x0a0a1a,
        ).setStrokeStyle(s(2), 0xd4af37);

        // Inner fill
        this.fillBar = scene.add.rectangle(
            -width / 2,
            0,
            0,
            height,
            0xd4af37,
        ).setOrigin(0, 0.5);

        this.add([barBorder, this.fillBar]);

        scene.add.existing(this);
    }

    /**
     * Update the progress fill.
     * @param {number} progress - 0 to 1
     * @param {number} maxWidth - The target width of the bar
     */
    updateProgress(progress, maxWidth) {
        this.fillBar.width = maxWidth * progress;
    }
}
