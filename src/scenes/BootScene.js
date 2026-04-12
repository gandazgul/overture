// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";

/**
 * Minimal boot scene that loads only the essential UI assets (logo + button frame)
 * and displays a progress bar. Transitions to TitleScene when done.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const { width, height } = this.scale;

    // ── "Loading..." text (no images needed) ────────────────────────
    const loadingText = this.add
      .text(width / 2, height / 2 - s(40), "Loading...", {
        fontSize: px(24),
        fontFamily: "Georgia, serif",
        color: "#f5c518",
      })
      .setOrigin(0.5);

    // ── Progress bar (drawn with rectangles, no images) ─────────────
    const barW = s(300);
    const barH = s(20);
    const barX = width / 2 - barW / 2;
    const barY = height / 2;

    // Outer border
    const barBorder = this.add.rectangle(
      width / 2,
      barY + barH / 2,
      barW + s(4),
      barH + s(4),
    );
    barBorder.setStrokeStyle(s(2), 0xd4af37);
    barBorder.setFillStyle(0x0a0a1a);

    // Inner fill (will be scaled on progress)
    const barFill = this.add.rectangle(
      barX + s(2),
      barY + s(2),
      0,
      barH,
      0xd4af37,
    ).setOrigin(0, 0);

    this.load.on("progress", (/** @type {number} */ value) => {
      barFill.width = barW * value;
    });

    this.load.on("complete", () => {
      loadingText.setText("Ready!");
    });

    // ── Load only essential UI assets ───────────────────────────────
    this.load.image("ui_logo", "assets/ui_logo.png");
    this.load.image("ui_button_frame", "assets/ui_button_frame.png");
  }

  create() {
    // Brief delay for the "Ready!" text to be visible, then transition
    this.time.delayedCall(200, () => {
      this.scene.start("TitleScene");
    });
  }
}
