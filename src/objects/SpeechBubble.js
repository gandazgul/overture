// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";

/**
 * A speech bubble tooltip that follows a target game object.
 * Updates its position every frame to stay above the target's scaled bounds.
 * @class SpeechBubble
 * @extends {Phaser.GameObjects.Container}
 */
export class SpeechBubble extends Phaser.GameObjects.Container {
    /** @type {Phaser.GameObjects.Container & { x: number, y: number, scaleY: number, height: number }} */
    target;

    /** @type {number} Gap between the target's top edge and the bubble tail */
    gap;

    /** @type {number} Total height of the bubble body + tail (for positioning) */
    totalH;

    /**
     * @param {Phaser.Scene} scene
     * @param {Phaser.GameObjects.Container & { x: number, y: number, scaleY: number, height: number }} target - Object to follow
     * @param {string} title - Bold title line
     * @param {string} hint - Description text
     * @param {object} [options]
     * @param {number} [options.width=220] - Bubble width (pre-scale)
     * @param {number} [options.height=80] - Bubble body height (pre-scale)
     * @param {number} [options.gap=10] - Gap above target's top edge (pre-scale)
     */
    constructor(scene, target, title, hint, options = {}) {
        const {
            width = 220,
            height = 80,
            gap = 0,
        } = options;

        super(scene, target.x, target.y);

        this.target = target;
        this.gap = s(gap);

        const bubbleW = s(width);
        const bubbleH = s(height);
        const r = s(12);
        const tailW = s(12);
        const tailH = s(16);

        // ── Draw bubble background ──────────────────────────────────────
        const bg = scene.add.graphics();

        // Fill body
        bg.fillStyle(0x1a1a2e, 0.95);
        bg.fillRoundedRect(-bubbleW / 2, -bubbleH, bubbleW, bubbleH, r);

        // Fill tail (overlap into rect by 2px to hide seam)
        bg.beginPath();
        bg.moveTo(-tailW, -s(1));
        bg.lineTo(tailW, -s(1));
        bg.lineTo(0, tailH);
        bg.closePath();
        bg.fillPath();

        // Stroke: one continuous path around the entire silhouette
        bg.lineStyle(s(2), 0xd4af37, 1);
        bg.beginPath();
        bg.moveTo(-tailW, 0);
        bg.lineTo(0, tailH);
        bg.lineTo(tailW, 0);
        bg.lineTo(bubbleW / 2 - r, 0);
        bg.arc(bubbleW / 2 - r, -r, r, Math.PI * 0.5, 0, true);
        bg.lineTo(bubbleW / 2, -bubbleH + r);
        bg.arc(bubbleW / 2 - r, -bubbleH + r, r, 0, -Math.PI * 0.5, true);
        bg.lineTo(-bubbleW / 2 + r, -bubbleH);
        bg.arc(
            -bubbleW / 2 + r,
            -bubbleH + r,
            r,
            -Math.PI * 0.5,
            Math.PI,
            true,
        );
        bg.lineTo(-bubbleW / 2, -r);
        bg.arc(-bubbleW / 2 + r, -r, r, Math.PI, Math.PI * 0.5, true);
        bg.lineTo(-tailW, 0);
        bg.strokePath();

        // ── Text ────────────────────────────────────────────────────────
        const titleText = scene.add
            .text(0, -bubbleH + s(18), title, {
                fontSize: px(14),
                fontFamily: "Georgia, serif",
                color: "#d4af37",
                fontStyle: "bold",
                align: "center",
            })
            .setOrigin(0.5, 0.5);

        const hintText = scene.add
            .text(0, -bubbleH + s(48), hint, {
                fontSize: px(11),
                fontFamily: "Arial",
                color: "#ffffff",
                align: "center",
                wordWrap: { width: bubbleW - s(16) },
            })
            .setOrigin(0.5, 0.5);

        this.add([bg, titleText, hintText]);
        this.totalH = bubbleH + tailH;
        this.setDepth(200);

        // Follow the target every frame, positioning above its scaled top edge
        /** @type {() => void} */
        this._updateHandler = () => {
            if (this.target && this.target.active !== false) {
                this.x = this.target.x;
                const targetTopY = this.target.y -
                    (this.target.height * this.target.scaleY) / 2;
                this.y = targetTopY - this.gap;
            }
        };
        this._updateHandler(); // position immediately
        scene.events.on("update", this._updateHandler);

        scene.add.existing(this);
    }

    /** @override */
    destroy(/** @type {boolean} [fromScene] */ fromScene) {
        this.scene?.events?.off("update", this._updateHandler);
        super.destroy(fromScene);
    }
}
