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
    /** @type {number} */
    this.selectedPlayerCount = 2;
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
      const logoRatio = 0.3643695015;
      const logoWidth = 480;
      titleLogo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio));
    } else {
      this.add
        .text(width / 2, height / 4, "Overture", {
          fontSize: px(52),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
        })
        .setOrigin(0.5);
    }

    // Subtitle
    this.add
      .text(width / 2, height / 4 + s(120), "A Card Game of Seating Strategy\nSeat patrons in your theater to earn the most victory points!", {
        fontSize: px(18),
        fontFamily: "Georgia, serif",
        color: "#aaaacc",
        align: "center",
        lineSpacing: 5
      })
      .setOrigin(0.5);

    // "How many players?" label
    this.add
      .text(width / 2, height / 2 - s(30), "How many players?", {
        fontSize: px(24),
        fontFamily: "Georgia, serif",
        color: "#ccccdd",
      })
      .setOrigin(0.5);

    // Player count buttons
    const counts = [2, 3, 4];
    const buttonWidth = 180;
    const buttonHeight = buttonWidth * 0.4704684318;
    const gap = s(30);
    const totalWidth = counts.length * s(buttonWidth) + (counts.length - 1) * gap;
    const startX = (width - totalWidth) / 2 + s(buttonWidth) / 2;

    for (let i = 0; i < counts.length; i++) {
      const n = counts[i];
      const x = startX + i * (s(buttonWidth) + gap);
      const y = height / 2 + s(buttonHeight / 2);

      const btnContainer = this.add.container(x, y);

      if (this.textures.exists('ui_button_frame')) {
        const bgImg = this.add.image(0, 0, 'ui_button_frame');
        bgImg.setDisplaySize(s(buttonWidth), s(buttonHeight));
        btnContainer.add(bgImg);
      } else {
        const fallbackBg = this.add.rectangle(0, 0, s(buttonWidth), s(buttonHeight), 0x4a2c7a);
        btnContainer.add(fallbackBg);
      }

      const textLabel = this.add
        .text(0, 0, `${n} Players`, {
          fontSize: px(18),
          fontFamily: "Georgia, serif",
          color: "#ffffff",
          fontStyle: "bold"
        })
        .setOrigin(0.5);
      btnContainer.add(textLabel);

      const hitArea = this.add.rectangle(0, 0, buttonWidth, s(60), 0, 0)
        .setInteractive({ useHandCursor: true });
      btnContainer.add(hitArea);

      hitArea.on("pointerover", () => {
        textLabel.setStyle({ color: "#f5c518" });
        this.tweens.add({
          targets: btnContainer,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 150,
          ease: "Sine.easeOut",
        });
      });
      hitArea.on("pointerout", () => {
        textLabel.setStyle({ color: "#ffffff" });
        this.tweens.add({
          targets: btnContainer,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: "Sine.easeOut",
        });
      });

      hitArea.on("pointerdown", () => {
        this.selectedPlayerCount = n;
        this.scene.start("TheaterSelectionScene", { playerCount: n });
      });
    }

    // ── Settings section ────────────────────────────────────────────────
    this.add
      .text(width / 2, height / 2 + s(140), "Settings", {
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

    // Flavor text removed per requested changes
  }
}
