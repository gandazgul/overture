// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { LayoutOrder, Layouts } from "../types.js";
import { createButton } from "../objects/Button.js";

/**
 * Scene for selecting a theater layout before starting the game.
 */
export class TheaterSelectionScene extends Phaser.Scene {
  constructor() {
    super("TheaterSelectionScene");
  }

  /**
   * @param {{ playerCount: number, aiConfig?: (string | null)[], playerColorMap?: number[] }} data
   */
  init(data) {
    this.selectedPlayerCount = data.playerCount || 2;
    /** @type {(string | null)[]} */
    this.aiConfig = data.aiConfig || Array.from({ length: this.selectedPlayerCount }, () => null);
    /** @type {number[]} */
    this.playerColorMap = data.playerColorMap || Array.from({ length: this.selectedPlayerCount }, (_, i) => i);
  }

  preload() {
    const { width, height } = this.scale;

    // ── Progress bar for thumbnail loading ───────────────────────
    const barW = s(300);
    const barH = s(16);
    const barBorder = this.add.rectangle(
      width / 2,
      height / 2,
      barW + s(4),
      barH + s(4),
    );
    barBorder.setStrokeStyle(s(2), 0xd4af37);
    barBorder.setFillStyle(0x0a0a1a);
    const barFill = this.add.rectangle(
      width / 2 - barW / 2 + s(2),
      height / 2,
      0,
      barH,
      0xd4af37,
    ).setOrigin(0, 0.5);

    this.load.on("progress", (/** @type {number} */ value) => {
      barFill.width = barW * value;
    });

    // Load thumbnail backgrounds for theater selection cards
    const layouts = LayoutOrder.map((id) => Layouts[id]);
    for (const layout of layouts) {
      if (layout.bgThumbKey) {
        this.load.image(layout.bgThumbKey, `assets/${layout.bgThumbKey}.jpg`);
      }
    }
  }

  create() {
    // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
    this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
      if (!e.shiftKey) return;
      console.log("DEBUG: Skipping to GameScene");
      this.scene.start("GameScene", {
        playerCount: this.selectedPlayerCount,
        layoutId: LayoutOrder[0],
        aiConfig: this.aiConfig,
        playerColorMap: this.playerColorMap,
      });
    });

    this.showTheaterSelect();
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
    if (this.textures.exists("ui_logo")) {
      const logo = this.add.image(width / 2, logoY, "ui_logo");
      const logoRatio = 0.3643695015;
      const logoWidth = 320;
      logo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio));
    }

    // Subtitle
    this.add
      .text(width / 2, logoY + s(100), "Choose Your Theater", {
        fontSize: px(28),
        fontFamily: "Georgia, serif",
        color: "#ffd700",
      })
      .setOrigin(0.5);

    // ── Theater cards grid ──────────────────────────────────────────
    const layouts = LayoutOrder.map((id) => Layouts[id]);
    const cardW = s(300);
    const cardH = s(164);
    const cardGapX = s(16);
    const cardGapY = s(14);
    const gridCols = 4;
    const gridTotalW = gridCols * cardW + (gridCols - 1) * cardGapX;
    const gridStartX = (width - gridTotalW) / 2;
    const gridStartY = logoY + s(160);

    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      const cx = gridStartX + col * (cardW + cardGapX) + cardW / 2;
      const cy = gridStartY + row * (cardH + cardGapY) + cardH / 2;

      // Container for the card
      const container = this.add.container(cx, cy);

      // Background image (cropped to card size) — use thumbnail
      const thumbKey = layout.bgThumbKey || layout.bgKey;
      /** @type {Phaser.GameObjects.Graphics | null} */
      let bgMaskShape = null;
      if (thumbKey && this.textures.exists(thumbKey)) {
        const bgImg = this.add.image(0, 0, thumbKey);
        // Scale to cover the card with padding for zoom
        const texW = bgImg.width;
        const texH = bgImg.height;
        const zoomPadding = 1.10; // larger than hover zoom (1.08) to avoid edge clipping
        const scaleX = cardW / texW;
        const scaleY = cardH / texH;
        const coverScale = Math.max(scaleX, scaleY) * zoomPadding;
        bgImg.setScale(coverScale);
        // Geometry mask at card size (updated on hover to match zoom)
        bgMaskShape = this.make.graphics();
        bgMaskShape.fillRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH);
        bgImg.setMask(bgMaskShape.createGeometryMask());
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

      // Theater name
      const nameText = this.add
        .text(0, -s(30), layout.name, {
          fontSize: px(20),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
          fontStyle: "bold",
          shadow: { blur: 8, color: "#000000", fill: true },
        })
        .setOrigin(0.5);
      container.add(nameText);

      // Description
      const descText = this.add
        .text(0, s(4), layout.description, {
          fontSize: px(16),
          fontFamily: "Arial",
          color: "#ccccdd",
          wordWrap: { width: cardW - s(30) },
          align: "center",
        })
        .setOrigin(0.5);
      container.add(descText);

      // Grid size
      const sizeText = this.add
        .text(0, s(45), `${layout.cols}\u00d7${layout.rows} grid`, {
          fontSize: px(16),
          fontFamily: "Arial",
          color: "#ccccdd",
        })
        .setOrigin(0.5);
      container.add(sizeText);

      // Make the whole card interactive via an invisible hit area
      const hitArea = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitArea);

      // Hover effects
      const hoverZoom = 1.08;
      /** Updates the bg mask to match the container's current scale */
      const syncMask = () => {
        if (!bgMaskShape) return;
        const sc = container.scaleX;
        const mW = cardW * sc;
        const mH = cardH * sc;
        bgMaskShape.clear();
        bgMaskShape.fillRect(cx - mW / 2, cy - mH / 2, mW, mH);
      };
      hitArea.on("pointerover", () => {
        border.setStrokeStyle(s(2), 0xf5c518);
        overlay.fillAlpha = 0.45;
        this.tweens.add({
          targets: container,
          scaleX: hoverZoom,
          scaleY: hoverZoom,
          duration: 150,
          ease: "Sine.easeOut",
          onUpdate: syncMask,
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
          onUpdate: syncMask,
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
    backBtn.on("pointerdown", () => this.scene.start("TitleScene"));
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
    const dimOverlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0,
    );
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
    const modalW = s(570);
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

    // ── Background image (use thumbnail for modal preview) ─────────
    const modalThumbKey = layout.bgThumbKey || layout.bgKey;
    if (modalThumbKey && this.textures.exists(modalThumbKey)) {
      const bgImg = this.add.image(0, 0, modalThumbKey);
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
    const gradOverlay = this.add.rectangle(
      0,
      0,
      modalW,
      modalH,
      0x0a0a1a,
      0.75,
    );
    modalContainer.add(gradOverlay);

    // ── Gold border ─────────────────────────────────────────────────
    const modalBorder = this.add.rectangle(0, 0, modalW, modalH);
    modalBorder.setStrokeStyle(s(3), 0xf5c518);
    modalBorder.setFillStyle();
    modalContainer.add(modalBorder);

    // ── Inner accent border ─────────────────────────────────────────
    const innerBorder = this.add.rectangle(
      0,
      0,
      modalW - s(12),
      modalH - s(12),
    );
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
        shadow: { blur: 8, color: "#000000", fill: true },
      })
      .setOrigin(0.5);
    modalContainer.add(titleText);

    // Decorative divider
    const dividerY = contentTop + s(35);
    const divLine = this.add.rectangle(
      0,
      dividerY,
      s(200),
      s(1),
      0xf5c518,
      0.5,
    );
    modalContainer.add(divLine);

    // Description
    const descText = this.add
      .text(0, dividerY + s(30), layout.description, {
        fontSize: px(16),
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
        fontSize: px(16),
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
          fontSize: px(18),
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

      const ruleBox = this.add.rectangle(
        0,
        ruleBoxY,
        ruleBoxW,
        ruleBoxH,
        0x2a1a4e,
        0.6,
      );
      ruleBox.setStrokeStyle(s(1), 0xf5c518, 0.4);
      modalContainer.add(ruleBox);

      const ruleText = this.add
        .text(0, ruleBoxY, layout.houseRuleDescription, {
          fontSize: px(16),
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
          fontSize: px(16),
          fontFamily: "Georgia, serif",
          color: "#888899",
          fontStyle: "italic",
        })
        .setOrigin(0.5);
      modalContainer.add(noRuleText);
    }

    // ── Player count ────────────────────────────────────────────────
    const playerY = modalH / 2 - s(145);
    const playerBadge = this.add
      .text(0, playerY, `${this.selectedPlayerCount} Players`, {
        fontSize: px(14),
        fontFamily: "Arial",
        color: "#aaaacc",
      })
      .setOrigin(0.5);
    modalContainer.add(playerBadge);

    // ── Buttons ─────────────────────────────────────────────────────
    const btnY = modalH / 2 - s(70);
    const btnGap = s(30);

    // — "Close" button —
    const { hitArea: closeHit } = createButton(
      this, -btnGap - s(70), btnY, "Close",
      { width: 180, fontSize: 16, bgColor: 0x3a3a5e, fontColor: "#ccccdd" },
    );
    modalContainer.add(closeHit.parentContainer);
    closeHit.on("pointerdown", () => {
      this._dismissModal(dimOverlay, modalContainer);
    });

    // — Keyboard Support (ESC) —
    const escListener = () => {
      this._dismissModal(dimOverlay, modalContainer);
    };
    this.input.keyboard?.on("keydown-ESC", escListener);
    dimOverlay.setData("escListener", escListener);

    // — "Let's Go!" button —
    const { hitArea: goHit } = createButton(
      this, btnGap + s(70), btnY, "Let's Go!",
      { width: 180, fontSize: 16 },
    );
    modalContainer.add(goHit.parentContainer);
    goHit.on("pointerdown", () => {
      this.scene.start("GameScene", {
        playerCount: this.selectedPlayerCount,
        layoutId: layout.id,
        aiConfig: this.aiConfig,
        playerColorMap: this.playerColorMap,
      });
    });

    // Store refs for cleanup
    /** @type {Phaser.GameObjects.Rectangle} */
    this._modalDim = dimOverlay;
    /** @type {Phaser.GameObjects.Container} */
    this._modalContainer = modalContainer;
  }

  /**
   * Animate the modal away.
   * @param {Phaser.GameObjects.Rectangle} dimOverlay
   * @param {Phaser.GameObjects.Container} modalContainer
   */
  _dismissModal(dimOverlay, modalContainer) {
    const escListener = dimOverlay.getData("escListener");
    if (escListener) {
      this.input.keyboard?.off("keydown-ESC", escListener);
    }

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
