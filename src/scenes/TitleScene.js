// @ts-check
import Phaser from "phaser";
import { loadSettings } from "../settings.js";
import { s, px } from "../config.js";

/**
 * Title screen with player count selection.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create() {
    const { width, height } = this.scale;

    // Hydrate settings from localStorage into the Phaser registry
    loadSettings(this.registry);

    // Title
    this.add
      .text(width / 2, height / 4, "🎭 Theater Ushers", {
        fontSize: px(52),
        fontFamily: "Georgia, serif",
        color: "#f5c518",
      })
      .setOrigin(0.5);

    // Subtitle
    this.add
      .text(width / 2, height / 4 + s(70), "A Card Game of Seating Strategy", {
        fontSize: px(20),
        fontFamily: "Georgia, serif",
        color: "#aaaacc",
      })
      .setOrigin(0.5);

    // "How many players?" label
    this.add
      .text(width / 2, height / 2 - s(10), "How many players?", {
        fontSize: px(24),
        fontFamily: "Georgia, serif",
        color: "#ccccdd",
      })
      .setOrigin(0.5);

    // Player count buttons
    const counts = [2, 3, 4];
    const buttonWidth = s(160);
    const gap = s(30);
    const totalWidth = counts.length * buttonWidth + (counts.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + buttonWidth / 2;

    for (let i = 0; i < counts.length; i++) {
      const n = counts[i];
      const x = startX + i * (buttonWidth + gap);
      const y = height / 2 + s(60);

      const btn = this.add
        .text(x, y, `${n} Players`, {
          fontSize: px(26),
          fontFamily: "Georgia, serif",
          color: "#ffffff",
          backgroundColor: "#4a2c7a",
          padding: { x: s(24), y: s(14) },
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

    // ── Settings section ────────────────────────────────────────────────
    this.add
      .text(width / 2, height / 2 + s(140), "⚙️ Settings", {
        fontSize: px(18),
        fontFamily: "Georgia, serif",
        color: "#888899",
      })
      .setOrigin(0.5);

    const showAll = this.registry.get("showAllScores") ?? true;
    const toggleText = this.add
      .text(
        width / 2,
        height / 2 + s(175),
        `Show all scores: ${showAll ? "ON" : "OFF"}`,
        {
          fontSize: px(16),
          fontFamily: "Arial",
          color: showAll ? "#66bb6a" : "#888899",
          backgroundColor: "#2a2a4e",
          padding: { x: s(16), y: s(8) },
        }
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    toggleText.on("pointerover", () => toggleText.setStyle({ color: "#f5c518" }));
    toggleText.on("pointerout", () => {
      const current = this.registry.get("showAllScores") ?? true;
      toggleText.setStyle({ color: current ? "#66bb6a" : "#888899" });
    });

    toggleText.on("pointerdown", () => {
      const current = this.registry.get("showAllScores") ?? true;
      const next = !current;
      this.registry.set("showAllScores", next);
      toggleText.setText(`Show all scores: ${next ? "ON" : "OFF"}`);
      toggleText.setStyle({ color: next ? "#66bb6a" : "#888899" });
    });

    // Flavor text
    this.add
      .text(
        width / 2,
        height - s(40),
        "Seat patrons in your theater to earn the most victory points!\nHot-seat: pass the device between turns.",
        {
          fontSize: px(14),
          fontFamily: "Georgia, serif",
          color: "#666688",
          align: "center",
        }
      )
      .setOrigin(0.5);
  }
}
