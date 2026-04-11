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
    // Preload all theater background images
    const layouts = LayoutOrder.map((id) => Layouts[id]);
    for (const layout of layouts) {
      if (layout.bgKey) {
        this.load.image(layout.bgKey, `assets/${layout.bgKey}.png`);
      }
    }
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
        .text(width / 2, height / 4, "Theater Ushers", {
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

    // ── Logo — same position as title screen ────────────────────────
    const logoY = s(90);
    if (this.textures.exists('ui_logo')) {
      const logo = this.add.image(width / 2, logoY, 'ui_logo');
      logo.setDisplaySize(s(320), s(180)); // slightly smaller to leave room for grid
    }

    // Subtitle
    this.add
      .text(width / 2, logoY + s(55), "Choose Your Theater", {
        fontSize: px(26),
        fontFamily: "Georgia, serif",
        color: "#aaaacc",
      })
      .setOrigin(0.5);

    // Player count badge
    this.add
      .text(width / 2, logoY + s(85), `${this.selectedPlayerCount} Players`, {
        fontSize: px(14),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(0.5);

    // ── Theater cards grid ──────────────────────────────────────────
    const layouts = LayoutOrder.map((id) => Layouts[id]);
    const cardW = s(250);
    const cardH = s(130);
    const cardGapX = s(24);
    const cardGapY = s(16);
    const gridCols = 2;
    const gridTotalW = gridCols * cardW + (gridCols - 1) * cardGapX;
    const gridStartX = (width - gridTotalW) / 2;
    const gridStartY = logoY + s(115);

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const cx = gridStartX + col * (cardW + cardGapX) + cardW / 2;
      const cy = gridStartY + row * (cardH + cardGapY) + cardH / 2;

      // Container for the card
      const container = this.add.container(cx, cy);

      // Background image (cropped to card size)
      if (layout.bgKey && this.textures.exists(layout.bgKey)) {
        const bgImg = this.add.image(0, 0, layout.bgKey);
        // Scale to cover the card
        const texW = bgImg.width;
        const texH = bgImg.height;
        const scaleX = cardW / texW;
        const scaleY = cardH / texH;
        const coverScale = Math.max(scaleX, scaleY);
        bgImg.setScale(coverScale);
        // Create a geometry mask to clip to card bounds
        const maskShape = this.make.graphics({ x: cx - cardW / 2, y: cy - cardH / 2 });
        maskShape.fillRect(0, 0, cardW, cardH);
        bgImg.setMask(maskShape.createGeometryMask());
        container.add(bgImg);
      }

      // Dark overlay for readability
      const overlay = this.add.rectangle(0, 0, cardW, cardH, 0x0a0a1a, 0.65);
      container.add(overlay);

      // Border
      const border = this.add.rectangle(0, 0, cardW, cardH);
      border.setStrokeStyle(s(2), 0x4a4a6e);
      border.setFillStyle();
      container.add(border);

      // Theater name (no emoji)
      const nameText = this.add
        .text(0, -s(30), layout.name, {
          fontSize: px(17),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      container.add(nameText);

      // Description
      const descText = this.add
        .text(0, s(2), layout.description, {
          fontSize: px(10),
          fontFamily: "Arial",
          color: "#ccccdd",
          wordWrap: { width: cardW - s(30) },
          align: "center",
        })
        .setOrigin(0.5);
      container.add(descText);

      // Grid size
      const sizeText = this.add
        .text(0, s(32), `${layout.cols}\u00d7${layout.rows} grid`, {
          fontSize: px(9),
          fontFamily: "Arial",
          color: "#888899",
        })
        .setOrigin(0.5);
      container.add(sizeText);

      // Make the whole card interactive via an invisible hit area
      const hitArea = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitArea);

      // Hover effects
      hitArea.on("pointerover", () => {
        border.setStrokeStyle(s(2), 0xf5c518);
        overlay.fillAlpha = 0.45;
        this.tweens.add({
          targets: container,
          scaleX: 1.04,
          scaleY: 1.04,
          duration: 150,
          ease: "Sine.easeOut",
        });
      });
      hitArea.on("pointerout", () => {
        border.setStrokeStyle(s(2), 0x4a4a6e);
        overlay.fillAlpha = 0.65;
        this.tweens.add({
          targets: container,
          scaleX: 1,
          scaleY: 1,
          duration: 150,
          ease: "Sine.easeOut",
        });
      });

      // Click — open modal
      hitArea.on("pointerdown", () => {
        this.showTheaterModal(layout);
      });
    }

    // ── Back button ─────────────────────────────────────────────────
    const backBtn = this.add
      .text(s(20), s(20), "\u2190 Back", {
        fontSize: px(16),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setInteractive({ useHandCursor: true });

    backBtn.on("pointerover", () => backBtn.setStyle({ color: "#f5c518" }));
    backBtn.on("pointerout", () => backBtn.setStyle({ color: "#888899" }));
    backBtn.on("pointerdown", () => this.showMainMenu());
  }

  // ══════════════════════════════════════════════════════════════════
  // THEATER MODAL — Expanded detail view
  // ══════════════════════════════════════════════════════════════════

  /**
   * Show an expanded modal for the selected theater.
   * @param {import("../types.js").LayoutMeta} layout
   */
  showTheaterModal(layout) {
    const { width, height } = this.scale;

    // ── Dim overlay ─────────────────────────────────────────────────
    const dimOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    dimOverlay.setInteractive(); // block clicks through
    dimOverlay.setDepth(100);
    dimOverlay.on("pointerdown", () => {
      this._dismissModal(dimOverlay, modalContainer);
    });
    this.tweens.add({
      targets: dimOverlay,
      fillAlpha: 0.7,
      duration: 200,
      ease: "Sine.easeOut",
    });

    // ── Modal container ─────────────────────────────────────────────
    const modalW = s(550);
    const modalH = s(520);
    const modalX = width / 2;
    const modalY = height / 2;

    const modalContainer = this.add.container(modalX, modalY);
    modalContainer.setDepth(101);
    modalContainer.setScale(0.8);
    modalContainer.setAlpha(0);

    // Animate in
    this.tweens.add({
      targets: modalContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 300,
      ease: "Back.easeOut",
    });

    // ── Background image ────────────────────────────────────────────
    if (layout.bgKey && this.textures.exists(layout.bgKey)) {
      const bgImg = this.add.image(0, 0, layout.bgKey);
      const texW = bgImg.width;
      const texH = bgImg.height;
      const scaleX = modalW / texW;
      const scaleY = modalH / texH;
      const coverScale = Math.max(scaleX, scaleY);
      bgImg.setScale(coverScale);
      // Clip to modal bounds
      const maskShape = this.make.graphics({
        x: modalX - modalW / 2,
        y: modalY - modalH / 2,
      });
      maskShape.fillRect(0, 0, modalW, modalH);
      bgImg.setMask(maskShape.createGeometryMask());
      modalContainer.add(bgImg);
    }

    // ── Dark gradient overlay ───────────────────────────────────────
    const gradOverlay = this.add.rectangle(0, 0, modalW, modalH, 0x0a0a1a, 0.75);
    modalContainer.add(gradOverlay);

    // ── Gold border ─────────────────────────────────────────────────
    const modalBorder = this.add.rectangle(0, 0, modalW, modalH);
    modalBorder.setStrokeStyle(s(3), 0xf5c518);
    modalBorder.setFillStyle();
    modalContainer.add(modalBorder);

    // ── Inner accent border ─────────────────────────────────────────
    const innerBorder = this.add.rectangle(0, 0, modalW - s(12), modalH - s(12));
    innerBorder.setStrokeStyle(s(1), 0xf5c518, 0.3);
    innerBorder.setFillStyle();
    modalContainer.add(innerBorder);

    // ── Content ─────────────────────────────────────────────────────
    const contentTop = -modalH / 2 + s(40);

    // Theater name
    const titleText = this.add
      .text(0, contentTop, layout.name, {
        fontSize: px(32),
        fontFamily: "Georgia, serif",
        color: "#f5c518",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    modalContainer.add(titleText);

    // Decorative divider
    const dividerY = contentTop + s(35);
    const divLine = this.add.rectangle(0, dividerY, s(200), s(1), 0xf5c518, 0.5);
    modalContainer.add(divLine);

    // Description
    const descText = this.add
      .text(0, dividerY + s(30), layout.description, {
        fontSize: px(15),
        fontFamily: "Georgia, serif",
        color: "#ccccdd",
        wordWrap: { width: modalW - s(80) },
        align: "center",
        lineSpacing: s(4),
      })
      .setOrigin(0.5);
    modalContainer.add(descText);

    // Grid dimensions
    const gridInfoY = dividerY + s(75);
    const gridInfoText = this.add
      .text(0, gridInfoY, `${layout.cols} \u00d7 ${layout.rows} Seating Grid`, {
        fontSize: px(13),
        fontFamily: "Arial",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    modalContainer.add(gridInfoText);

    // ── House Rule section ───────────────────────────────────────────
    const ruleY = gridInfoY + s(45);

    if (layout.houseRule && layout.houseRuleDescription) {
      // Rule label
      const ruleLabelText = this.add
        .text(0, ruleY, "House Rule", {
          fontSize: px(12),
          fontFamily: "Arial",
          color: "#f5c518",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
      modalContainer.add(ruleLabelText);

      // Rule box background
      const ruleBoxW = modalW - s(80);
      const ruleBoxH = s(60);
      const ruleBoxY = ruleY + s(42);

      const ruleBox = this.add.rectangle(0, ruleBoxY, ruleBoxW, ruleBoxH, 0x2a1a4e, 0.6);
      ruleBox.setStrokeStyle(s(1), 0xf5c518, 0.4);
      modalContainer.add(ruleBox);

      const ruleText = this.add
        .text(0, ruleBoxY, layout.houseRuleDescription, {
          fontSize: px(13),
          fontFamily: "Georgia, serif",
          color: "#e0d0ff",
          wordWrap: { width: ruleBoxW - s(30) },
          align: "center",
          lineSpacing: s(3),
        })
        .setOrigin(0.5);
      modalContainer.add(ruleText);
    } else {
      // No house rule — show "No special rule"
      const noRuleText = this.add
        .text(0, ruleY + s(10), "No House Rule \u2014 Standard Scoring", {
          fontSize: px(13),
          fontFamily: "Georgia, serif",
          color: "#888899",
          fontStyle: "italic",
        })
        .setOrigin(0.5);
      modalContainer.add(noRuleText);
    }

    // ── Player count ────────────────────────────────────────────────
    const playerY = modalH / 2 - s(115);
    const playerBadge = this.add
      .text(0, playerY, `${this.selectedPlayerCount} Players`, {
        fontSize: px(14),
        fontFamily: "Arial",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    modalContainer.add(playerBadge);

    // ── Buttons ─────────────────────────────────────────────────────
    const btnY = modalH / 2 - s(50);
    const btnGap = s(30);

    // — "Select Another" button —
    const selectAnotherBtn = this._createModalButton(
      -btnGap - s(70),
      btnY,
      "Select Another",
      0x3a3a5e,
      "#ccccdd",
      modalContainer
    );
    selectAnotherBtn.on("pointerdown", () => {
      this._dismissModal(dimOverlay, modalContainer);
    });

    // — "Let's Go!" button —
    const letsGoBtn = this._createModalButton(
      btnGap + s(70),
      btnY,
      "Let's Go!",
      0x4a2c7a,
      "#f5c518",
      modalContainer
    );
    letsGoBtn.on("pointerdown", () => {
      this.scene.start("GameScene", {
        playerCount: this.selectedPlayerCount,
        layoutId: layout.id,
      });
    });

    // Pulse the Let's Go button
    this.tweens.add({
      targets: letsGoBtn,
      scaleX: 1.06,
      scaleY: 1.06,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Store refs for cleanup
    /** @type {Phaser.GameObjects.Rectangle} */
    this._modalDim = dimOverlay;
    /** @type {Phaser.GameObjects.Container} */
    this._modalContainer = modalContainer;
  }

  /**
   * Create a styled button inside the modal.
   * @param {number} x
   * @param {number} y
   * @param {string} label
   * @param {number} bgColor
   * @param {string} textColor
   * @param {Phaser.GameObjects.Container} parent
   * @returns {Phaser.GameObjects.Container}
   */
  _createModalButton(x, y, label, bgColor, textColor, parent) {
    const btnW = s(160);
    const btnH = s(44);

    const btnContainer = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, btnW, btnH, bgColor, 0.9);
    bg.setStrokeStyle(s(1), 0xf5c518, 0.5);
    btnContainer.add(bg);

    const text = this.add
      .text(0, 0, label, {
        fontSize: px(16),
        fontFamily: "Georgia, serif",
        color: textColor,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    btnContainer.add(text);

    // Hit area
    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btnContainer.add(hitArea);

    // Hover
    hitArea.on("pointerover", () => {
      bg.fillAlpha = 1;
      text.setStyle({ color: "#ffffff" });
      bg.setStrokeStyle(s(2), 0xf5c518, 0.8);
    });
    hitArea.on("pointerout", () => {
      bg.fillAlpha = 0.9;
      text.setStyle({ color: textColor });
      bg.setStrokeStyle(s(1), 0xf5c518, 0.5);
    });

    parent.add(btnContainer);
    return hitArea;
  }

  /**
   * Animate the modal away.
   * @param {Phaser.GameObjects.Rectangle} dimOverlay
   * @param {Phaser.GameObjects.Container} modalContainer
   */
  _dismissModal(dimOverlay, modalContainer) {
    this.tweens.add({
      targets: modalContainer,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 200,
      ease: "Sine.easeIn",
      onComplete: () => {
        modalContainer.destroy();
      },
    });
    this.tweens.add({
      targets: dimOverlay,
      fillAlpha: 0,
      duration: 200,
      ease: "Sine.easeIn",
      onComplete: () => {
        dimOverlay.destroy();
      },
    });
  }
}
