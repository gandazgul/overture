// @ts-check
import Phaser from "phaser";
import { loadSettings } from "../settings.js";
import { s, px } from "../config.js";
import { Layouts, LayoutOrder } from "../types.js";

/**
 * Title screen with player count selection.
 */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
    /** @type {number} */
    this.selectedPlayerCount = 2;
  }

  preload() {
    this.load.image('ui_logo', 'assets/ui_logo.png');
  }

  create() {
    // Hydrate settings from localStorage into the Phaser registry
    loadSettings(this.registry);
    this.showMainMenu();
  }

  // ══════════════════════════════════════════════════════════════════
  // MAIN MENU — Player count + settings
  // ══════════════════════════════════════════════════════════════════

  showMainMenu() {
    this.children.removeAll(true);
    this.tweens.killAll();

    const { width, height } = this.scale;

    // Title
    if (this.textures.exists('ui_logo')) {
      const titleLogo = this.add.image(width / 2, height / 4, 'ui_logo');
      titleLogo.setDisplaySize(s(480), s(270)); // 16:9 ratio
    } else {
      this.add
        .text(width / 2, height / 4, "🎭 Theater Ushers", {
          fontSize: px(52),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
        })
        .setOrigin(0.5);
    }

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
        this.selectedPlayerCount = n;
        this.showTheaterSelect();
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

  // ══════════════════════════════════════════════════════════════════
  // THEATER SELECTION
  // ══════════════════════════════════════════════════════════════════

  showTheaterSelect() {
    this.children.removeAll(true);
    this.tweens.killAll();

    const { width } = this.scale;

    // Title
    this.add
      .text(width / 2, s(40), "🎭 Choose Your Theater", {
        fontSize: px(36),
        fontFamily: "Georgia, serif",
        color: "#f5c518",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, s(80), `${this.selectedPlayerCount} Players`, {
        fontSize: px(16),
        fontFamily: "Arial",
        color: "#aaaacc",
      })
      .setOrigin(0.5);

    // Theater cards in a 2-column grid
    const layouts = LayoutOrder.map((id) => Layouts[id]);
    const cardW = s(220);
    const cardH = s(110);
    const cardGapX = s(30);
    const cardGapY = s(20);
    const gridCols = 2;
    const gridTotalW = gridCols * cardW + (gridCols - 1) * cardGapX;
    const gridStartX = (width - gridTotalW) / 2;
    const gridStartY = s(120);

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const x = gridStartX + col * (cardW + cardGapX) + cardW / 2;
      const y = gridStartY + row * (cardH + cardGapY) + cardH / 2;

      // Card background
      const card = this.add
        .rectangle(x, y, cardW, cardH, 0x2a2a4e)
        .setStrokeStyle(s(2), 0x4a4a6e)
        .setInteractive({ useHandCursor: true });

      // Theater emoji + name
      this.add
        .text(x, y - s(28), `${layout.emoji} ${layout.name}`, {
          fontSize: px(18),
          fontFamily: "Georgia, serif",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      // Description
      this.add
        .text(x, y + s(2), layout.description, {
          fontSize: px(11),
          fontFamily: "Arial",
          color: "#aaaacc",
          wordWrap: { width: cardW - s(20) },
          align: "center",
        })
        .setOrigin(0.5);

      // Grid size
      this.add
        .text(x, y + s(30), `${layout.cols}\u00d7${layout.rows}`, {
          fontSize: px(10),
          fontFamily: "Arial",
          color: "#888899",
        })
        .setOrigin(0.5);

      // Hover
      card.on("pointerover", () => {
        card.setFillStyle(0x3a3a6e);
        card.setStrokeStyle(s(2), 0xf5c518);
      });
      card.on("pointerout", () => {
        card.setFillStyle(0x2a2a4e);
        card.setStrokeStyle(s(2), 0x4a4a6e);
      });

      card.on("pointerdown", () => {
        this.scene.start("GameScene", {
          playerCount: this.selectedPlayerCount,
          layoutId: layout.id,
        });
      });
    }

    // Random button
    const randomY =
      gridStartY +
      Math.ceil(layouts.length / gridCols) * (cardH + cardGapY) +
      s(20);
    const randomBtn = this.add
      .text(width / 2, randomY, "🎲 Random Theater", {
        fontSize: px(22),
        fontFamily: "Georgia, serif",
        color: "#ffffff",
        backgroundColor: "#4a2c7a",
        padding: { x: s(24), y: s(12) },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    randomBtn.on("pointerover", () => randomBtn.setStyle({ color: "#f5c518" }));
    randomBtn.on("pointerout", () => randomBtn.setStyle({ color: "#ffffff" }));
    randomBtn.on("pointerdown", () => {
      const randomId =
        LayoutOrder[Math.floor(Math.random() * LayoutOrder.length)];
      this.scene.start("GameScene", {
        playerCount: this.selectedPlayerCount,
        layoutId: randomId,
      });
    });

    // Back button
    const backBtn = this.add
      .text(s(20), s(20), "← Back", {
        fontSize: px(16),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setStyle({ color: "#f5c518" }));
    backBtn.on("pointerout", () => backBtn.setStyle({ color: "#888899" }));
    backBtn.on("pointerdown", () => this.showMainMenu());
  }
}
