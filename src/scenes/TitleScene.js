// @ts-check
import Phaser from "phaser";
import { PlayerColors } from "../types.js";

/**
 * Title screen with player count selection.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    const { width, height } = this.scale;

    // Title
    this.add
      .text(width / 2, height / 4, "🎭 Theater Ushers", {
        fontSize: "52px",
        fontFamily: "Georgia, serif",
        color: "#f5c518",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height / 4 + 70, "A Card Game of Seating Strategy", {
        fontSize: "20px",
        fontFamily: "Georgia, serif",
        color: "#aaaacc",
      })
      .setOrigin(0.5);

    // "How many players?" label
    this.add
      .text(width / 2, height / 2 - 10, "How many players?", {
        fontSize: "24px",
        fontFamily: "Georgia, serif",
        color: "#ccccdd",
      })
      .setOrigin(0.5);

    // Player count buttons
    const counts = [2, 3, 4];
    const buttonWidth = 160;
    const gap = 30;
    const totalWidth = counts.length * buttonWidth + (counts.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + buttonWidth / 2;

    for (let i = 0; i < counts.length; i++) {
      const n = counts[i];
      const x = startX + i * (buttonWidth + gap);
      const y = height / 2 + 60;

      const btn = this.add
        .text(x, y, `${n} Players`, {
          fontSize: "26px",
          fontFamily: "Georgia, serif",
          color: "#ffffff",
          backgroundColor: "#4a2c7a",
          padding: { x: 24, y: 14 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });

      // Pulse
      this.tweens.add({
        targets: btn,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
        delay: i * 150,
      });

      btn.on("pointerover", () => btn.setStyle({ color: "#f5c518" }));
      btn.on("pointerout", () => btn.setStyle({ color: "#ffffff" }));

      btn.on("pointerdown", () => {
        this.scene.start("GameScene", { playerCount: n });
      });
    }

    // Flavor text
    this.add
      .text(
        width / 2,
        height - 60,
        "Seat patrons in your theater to earn the most victory points!\nHot-seat: pass the device between turns.",
        {
          fontSize: "14px",
          fontFamily: "Georgia, serif",
          color: "#666688",
          align: "center",
        }
      )
      .setOrigin(0.5);
  }
}
