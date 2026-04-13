// @ts-check
import Phaser from "phaser";
import { Card } from "../objects/Card.js";
import { SpeechBubble } from "../objects/SpeechBubble.js";
import {
  createDeck,
  GrandEmpressLayout,
  hasSeatLabel,
  Layouts,
  PlayerColors,
  PlayerColorsHex,
  PlayerNames,
  TraitColors,
} from "../types.js";
import { scorePlayer, seatExists } from "../scoring.js";
import { createButton } from "../objects/Button.js";
import { pickCardAndSeat, pickSeat } from "../ai.js";
import { px, s } from "../config.js";

const SEAT_SIZE = s(100);
const SEAT_GAP = s(10);
const AISLE_GAP = s(30); // wider gap for aisle walkways

/**
 * Concise scoring reminders shown when a card is selected.
 * @type {Record<string, string>}
 */
const SCORING_HINTS = {
  "Standard": "Base 3 VP",
  "VIP":
    "Base 5 VP\n+3 VP in rows A–B (front 2)\n⚠ −3 VP per adjacent Kid or Noisy",
  "Lovebirds": "+3 VP per adjacent Lovebirds\n×2 VP in back row\n0 VP if alone",
  "Kid": "⚠ 0 VP unless capped by Teacher\n+2 VP when capped",
  "Teacher": "Base 1 VP\n+1 VP per adjacent capped Kid",
  "Critic": "Base 2 VP\n×3 VP in an aisle seat (col 1 or 5)",
};

/**
 * Scoring hints for secondary traits.
 * @type {Record<string, string>}
 */
const TRAIT_HINTS = {
  "Tall": "⚠ Patron behind gets −2 VP",
  "Short": "+2 VP if no one in front\n⚠ −3 VP if Tall in front",
  "Bespectacled": "+2 VP in rows A–C (front 3)",
  "Noisy": "⚠ Each adjacent patron gets −1 VP",
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    /** @type {import('../types.js').CardData[]} */
    this.deck = [];

    /** @type {import('../types.js').LayoutMeta} */
    this.layout = GrandEmpressLayout;

    /** @type {number} */
    this.playerCount = 2;

    /** @type {number} */
    this.currentPlayer = 0; // 0-indexed

    /** @type {number} */
    this.round = 1;

    /** @type {number} */
    this.totalRounds = 14;

    /**
     * Per-player theater grids. placedPatrons[playerIdx][row][col]
     * @type {(import('../types.js').CardData | null)[][][]}
     */
    this.placedPatrons = [];

    /**
     * Per-player hands (cards kept between turns).
     * @type {import('../types.js').CardData[][]}
     */
    this.playerHands = [];

    /** @type {Card[]} */
    this.handCards = [];

    /** @type {Card | null} */
    this.selectedCard = null;

    /**
     * Current phase of a turn.
     * @type {'pass-screen' | 'play' | 'discard' | 'ghost-discard' | 'game-over'}
     */
    this.turnPhase = "pass-screen";

    // Visual references
    /** @type {(Phaser.GameObjects.Rectangle | null)[][]} */
    this.seatGrid = [];

    /** @type {Phaser.GameObjects.Container | null} */
    this.passOverlay = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.turnText = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.deckText = null;

    /** @type {Phaser.GameObjects.Text | null} */

    /** @type {Phaser.GameObjects.Container | null} */
    this.uiContainer = null;

    /** @type {Phaser.GameObjects.Container[]} */
    this.scorePanels = [];

    /** @type {Phaser.GameObjects.Container | null} */
    this.deckPileImage = null;

    /** @type {Phaser.GameObjects.GameObject[]} */
    this.seatLabels = [];

    /** @type {number[]} center-x of each column (set in create) */
    this.colX = [];

    /** @type {number[]} per-row X offset for staggered layouts (set in create) */
    this.staggerRowOffsets = [];

    /** @type {number[]} center-y of each row (set in create) */
    this.rowY = [];

    /** @type {number} top of the seat grid (set in create) */
    this.gridStartY = 0;

    /** @type {Phaser.GameObjects.Container | null} */
    this.scoringTooltip = null;

    /**
     * AI config per player slot: null = human, string = AI difficulty.
     * @type {(string | null)[]}
     */
    this.aiConfig = [];
  }

  // ── Color mapping helpers ──────────────────────────────────────────

  /** @type {string[]} */
  static USHER_KEYS = ['usher_blue', 'usher_red', 'usher_green', 'usher_orange'];

  /** Get the color index for a player slot. */
  colorOf(/** @type {number} */ p) {
    return this.playerColorMap?.[p] ?? p;
  }

  /** Get the CSS color string for a player. */
  playerColor(/** @type {number} */ p) {
    return PlayerColors[this.colorOf(p)];
  }

  /** Get the hex color number for a player. */
  playerColorHex(/** @type {number} */ p) {
    return PlayerColorsHex[this.colorOf(p)];
  }

  /** Get the usher texture key for a player. */
  usherKey(/** @type {number} */ p) {
    return GameScene.USHER_KEYS[this.colorOf(p)];
  }

  preload() {
    const { width, height } = this.scale;

    // ── Progress bar ────────────────────────────────────────────────
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

    // ── Helper: only load if not already cached ─────────────────────
    const loadIfMissing = (
      /** @type {string} */ key,
      /** @type {string} */ url,
    ) => {
      if (!this.textures.exists(key)) {
        this.load.image(key, url);
      }
    };

    // ── Patron cards ────────────────────────────────────────────────
    loadIfMissing("patron_standard", "assets/patron_standard.png");
    loadIfMissing("patron_vip", "assets/patron_vip.png");
    loadIfMissing("patron_lovebirds", "assets/patron_lovebirds.png");
    loadIfMissing("patron_kid", "assets/patron_kid.png");
    loadIfMissing("patron_teacher", "assets/patron_teacher.png");
    loadIfMissing("patron_critic", "assets/patron_critic.png");

    // ── Trait badges ────────────────────────────────────────────────
    loadIfMissing("badge_tall", "assets/badge_tall.png");
    loadIfMissing("badge_short", "assets/badge_short.png");
    loadIfMissing("badge_bespectacled", "assets/badge_bespectacled.png");
    loadIfMissing("badge_noisy", "assets/badge_noisy.png");

    // ── Only the selected theater background (JPEG) ─────────────────
    const bgKey = `bg_${this.layout.id}`;
    loadIfMissing(bgKey, `assets/${this.layout.bgKey}.jpg`);

    // ── Game UI assets ──────────────────────────────────────────────
    loadIfMissing("card_back", "assets/card_back.png");
    loadIfMissing("ui_stage", "assets/ui_stage.png");
    loadIfMissing("ui_logo", "assets/ui_logo.png");
    loadIfMissing("ui_button_frame", "assets/ui_button_frame.png");
    loadIfMissing("usher_blue", "assets/usher_blue.png");
    loadIfMissing("usher_red", "assets/usher_red.png");
    loadIfMissing("usher_green", "assets/usher_green.png");
    loadIfMissing("usher_orange", "assets/usher_orange.png");
  }

  /**
   * @param {{ playerCount?: number, layoutId?: string, aiConfig?: (string | null)[], playerColorMap?: number[] }} data
   */
  init(data) {
    this.layout = (data.layoutId && Layouts[data.layoutId]) ||
      GrandEmpressLayout;
    this.playerCount = data.playerCount || 2;
    this.currentPlayer = 0;
    this.round = 1;
    this.selectedCard = null;
    this.turnPhase = "pass-screen";
    this.deck = createDeck();
    this.handCards = [];
    this.seatLabels = [];
    this.aiConfig = data.aiConfig || Array.from({ length: this.playerCount }, () => null);
    /** @type {number[]} */
    this.playerColorMap = data.playerColorMap || Array.from({ length: this.playerCount }, (_, i) => i);

    const { rows, cols } = this.layout;

    // Initialize per-player state
    this.placedPatrons = [];
    this.playerHands = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.placedPatrons[p] = Array.from(
        { length: rows },
        () => Array.from({ length: cols }).fill(null),
      );
      // Deal starting hand: 1 card per player
      const startCard = this.deck.pop();
      this.playerHands[p] = startCard ? [startCard] : [];
    }

    // For 3 players, ghost "4th player" was also dealt and discards
    if (this.playerCount === 3) {
      this.deck.pop();
    }
    // For 2 players, discard 2 to align: 56 - 2 dealt - 2 discarded = 52
    // 52 / 4 cards-per-round = 13 rounds + 1 final round = 14
    if (this.playerCount === 2) {
      this.deck.pop();
      this.deck.pop();
    }

    this.seatGrid = [];
    this.scorePanels = [];
    this.deckPileImage = null;
  }

  create() {
    const { width, height } = this.scale;

    // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
    this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
      if (!e.shiftKey) return;
      console.log("DEBUG: Skipping to end screen");
      this.turnPhase = "game-over";
      this.endGame();
    });

    // ── Compute aisle walkway positions ────────────────────────────
    const ROWS = this.layout.rows;
    const COLS = this.layout.cols;
    const aisleCols = this.layout.aisleCols ?? [];
    const hasPerRowAisles = !!this.layout.aisleColsByRow;

    // Determine where walkway gaps go (edges and between seats).
    // For per-row aisles (Promenade), we skip structural gaps and
    // only use per-seat colour tints.
    const leftAisle = !hasPerRowAisles && aisleCols.includes(0);
    const rightAisle = !hasPerRowAisles && aisleCols.includes(COLS - 1);
    /** @type {Set<number>} gaps between col c and col c+1 */
    const centerAisleGaps = new Set();
    if (!hasPerRowAisles) {
      for (let c = 0; c < COLS - 1; c++) {
        if (aisleCols.includes(c) && aisleCols.includes(c + 1)) {
          centerAisleGaps.add(c);
        }
      }
    }

    // Detect seatMask gap columns (Cabaret: cols where no row has a seat)
    /** @type {Set<number>} columns that are entirely empty (gap columns) */
    const gapCols = new Set();
    if (this.layout.seatMask) {
      for (let c = 0; c < COLS; c++) {
        if (this.layout.seatMask.every((row) => !row[c])) {
          gapCols.add(c);
        }
      }
    }

    // Detect adjacency breaks for visual row gaps (Balcony)
    /** @type {Set<number>} row indices after which there's a visual break */
    const rowBreaksAfter = new Set();
    if (this.layout.adjacencyBreaks) {
      for (const [a, b] of this.layout.adjacencyBreaks) {
        rowBreaksAfter.add(Math.min(a, b));
      }
    }

    // ── Compute column X positions with variable gaps ────────────
    const GAP_COL_WIDTH = AISLE_GAP; // gap columns rendered as aisles (Cabaret tables)
    const ROW_BREAK_GAP = s(20); // extra gap for adjacency breaks
    /** @type {number[]} center-x of each column */
    const colX = [];
    let cursor = 0;
    if (leftAisle) cursor += AISLE_GAP;
    for (let c = 0; c < COLS; c++) {
      if (gapCols.has(c)) {
        // Gap column: skip it (just add gap space)
        colX[c] = cursor + GAP_COL_WIDTH / 2; // position for reference
        cursor += GAP_COL_WIDTH;
      } else {
        colX[c] = cursor + SEAT_SIZE / 2;
        cursor += SEAT_SIZE;
      }
      if (c < COLS - 1) {
        if (centerAisleGaps.has(c)) {
          cursor += AISLE_GAP;
        } else if (!gapCols.has(c) && !gapCols.has(c + 1)) {
          cursor += SEAT_GAP;
        }
      }
    }
    if (rightAisle) cursor += AISLE_GAP;
    const totalGridW = cursor;

    // ── Compute row Y positions with adjacency break gaps ───────
    /** @type {number[]} center-y of each row */
    const rowY = [];
    let yCursor = 0;
    for (let r = 0; r < ROWS; r++) {
      rowY[r] = yCursor + SEAT_SIZE / 2;
      yCursor += SEAT_SIZE;
      if (r < ROWS - 1) {
        yCursor += rowBreaksAfter.has(r) ? SEAT_GAP + ROW_BREAK_GAP : SEAT_GAP;
      }
    }
    const totalGridH = yCursor;

    const labelPad = s(75); // space for row letter labels on the left
    const floorW = totalGridW + labelPad; // total floor width including labels
    const stageAscpectRatio = 222 / 978;
    const stageRenderWidth = floorW + s(115);
    const actualStageH = stageRenderWidth * stageAscpectRatio;
    const topBarBottom = s(10);
    const gridStartY = topBarBottom + actualStageH + s(10);

    // ── Compute per-row stagger offsets (brick-pattern pyramid) ──
    /** @type {number[]} per-row X shift for staggered layouts */
    const staggerRowOffsets = [];
    const halfSeat = (SEAT_SIZE + SEAT_GAP) / 2;
    if (this.layout.staggered && this.layout.seatMask) {
      // Find the widest row as the baseline (no offset needed)
      let maxSeats = 0;
      let widestFirstCol = 0;
      for (let r = 0; r < ROWS; r++) {
        let seats = 0;
        let first = -1;
        for (let c = 0; c < COLS; c++) {
          if (this.layout.seatMask[r][c]) {
            seats++;
            if (first < 0) first = c;
          }
        }
        if (seats > maxSeats) {
          maxSeats = seats;
          widestFirstCol = first;
        }
      }
      // Each row offsets by (seatDifference * halfSeat) for the brick stagger,
      // minus the inherent grid offset from the seatMask column positions
      for (let r = 0; r < ROWS; r++) {
        let seatCount = 0;
        let firstCol = 0;
        for (let c = 0; c < COLS; c++) {
          if (this.layout.seatMask[r][c]) {
            seatCount++;
            if (seatCount === 1) firstCol = c;
          }
        }
        const seatDiff = maxSeats - seatCount;
        const desiredOffset = seatDiff * halfSeat;
        const inherentOffset = (firstCol - widestFirstCol) *
          (SEAT_SIZE + SEAT_GAP);
        staggerRowOffsets[r] = desiredOffset - inherentOffset;
      }
    } else {
      for (let r = 0; r < ROWS; r++) staggerRowOffsets[r] = 0;
    }

    // Center the entire floor (label pad + grid) on screen
    const floorLeft = (width - floorW) / 2;
    const gridStartX = floorLeft + labelPad;

    // Offset colX and rowY so they're relative to gridStartX/gridStartY
    for (let c = 0; c < COLS; c++) colX[c] += gridStartX;
    for (let r = 0; r < ROWS; r++) rowY[r] += gridStartY;

    // ── Theater floor background ─────────────────────────────────
    const floorTop = gridStartY - s(4);
    const floorBottom = gridStartY + totalGridH + s(4);
    const floorH = floorBottom - floorTop;

    const floorCenterX = floorLeft + floorW / 2;
    const bgKey = `bg_${this.layout.id}`;
    if (this.textures.exists(bgKey)) {
      // Draw the background image with cover scaling (maintain aspect ratio)
      const bleed = s(60);
      const coverW = floorW + bleed;
      const coverH = floorH + bleed;
      const bgImg = this.add.image(
        floorCenterX,
        floorTop + floorH / 2,
        bgKey,
      );
      const texW = bgImg.width;
      const texH = bgImg.height;
      const coverScale = Math.max(coverW / texW, coverH / texH);
      bgImg.setScale(coverScale);

      // Clip to the floor area with bleed
      const bgMask = this.make.graphics();
      bgMask.fillRect(
        floorLeft - bleed / 2,
        floorTop - bleed / 2,
        coverW,
        coverH,
      );
      bgImg.setMask(bgMask.createGeometryMask());
    } else {
      this.add
        .rectangle(
          floorCenterX,
          floorTop + floorH / 2,
          floorW,
          floorH,
          0x12122a,
        )
        .setStrokeStyle(s(1), 0x2a2a4e, 0.5);
    }

    // ── Aisle walkway strips ──────────────────────────────────────
    const aisleColor = 0x1e1e32;
    const aisleStripH = floorH;

    // Left aisle walkway
    if (leftAisle) {
      const aisleX = gridStartX + AISLE_GAP / 2;
      this.add
        .rectangle(
          aisleX,
          floorTop + floorH / 2,
          AISLE_GAP - s(4),
          aisleStripH,
          aisleColor,
        )
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // Right aisle walkway
    if (rightAisle) {
      const aisleX = (floorLeft + floorW) - AISLE_GAP / 2;
      this.add
        .rectangle(
          aisleX,
          floorTop + floorH / 2,
          AISLE_GAP - s(4),
          aisleStripH,
          aisleColor,
        )
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // Center aisle walkways
    for (const gapAfterCol of centerAisleGaps) {
      const leftEdge = colX[gapAfterCol] + SEAT_SIZE / 2;
      const rightEdge = colX[gapAfterCol + 1] - SEAT_SIZE / 2;
      const aisleX = (leftEdge + rightEdge) / 2;
      const aisleW = rightEdge - leftEdge;
      this.add
        .rectangle(
          aisleX,
          floorTop + floorH / 2,
          aisleW - s(4),
          aisleStripH,
          aisleColor,
        )
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // Gap-column aisle walkways (Cabaret table gaps)
    for (const gc of gapCols) {
      const aisleX = colX[gc];
      this.add
        .rectangle(
          aisleX,
          floorTop + floorH / 2,
          GAP_COL_WIDTH - s(4),
          aisleStripH,
          aisleColor,
        )
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // ── Stage platform ───────────────────────────────────────────
    const stageY = topBarBottom + actualStageH / 2;

    if (this.textures.exists("ui_stage")) {
      const stageImg = this.add.image(
        floorCenterX,
        stageY,
        "ui_stage",
      );
      stageImg.setDisplaySize(stageRenderWidth, actualStageH);
      stageImg.setDepth(2);
    } else {
      this.add
        .rectangle(
          floorCenterX,
          stageY,
          floorW,
          actualStageH,
          0x8b4513,
        )
        .setStrokeStyle(s(1), 0xdaa520);
    }

    this.add
      .text(floorCenterX, stageY, this.layout.name, {
        fontSize: px(36),
        color: "#ffd700",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        shadow: { blur: 8, color: "#000000", fill: true },
      })
      .setOrigin(0.5)
      .setDepth(3);

    // Store positions for use in renderTheater
    this.colX = colX;
    this.staggerRowOffsets = staggerRowOffsets;
    this.rowY = rowY;
    this.gridStartY = gridStartY;

    // ── Draw balcony break line if applicable ───────────────────
    for (const breakRow of rowBreaksAfter) {
      const y1 = rowY[breakRow] + SEAT_SIZE / 2;
      const y2 = rowY[breakRow + 1] - SEAT_SIZE / 2;
      const midY = (y1 + y2) / 2;
      // Dashed horizontal line
      for (let dx = 0; dx < totalGridW; dx += s(12)) {
        this.add
          .rectangle(gridStartX + dx + s(3), midY, s(6), s(2), 0x555577)
          .setAlpha(0.5);
      }
    }

    // ── Build theater grid ──────────────────────────────────────────
    for (let row = 0; row < ROWS; row++) {
      this.seatGrid[row] = [];
      const y = rowY[row];

      // Row label: position relative to the first valid seat in the row
      const rowStagger = staggerRowOffsets[row] || 0;
      let firstValidCol = 0;
      if (this.layout.seatMask) {
        while (
          firstValidCol < COLS && !this.layout.seatMask[row][firstValidCol]
        ) firstValidCol++;
      }
      const firstValidX = firstValidCol < COLS ? colX[firstValidCol] : colX[0];
      const labelContainer = this.add.container(
        firstValidX + rowStagger - s(75),
        y,
      );
      const circle = this.add.circle(0, 0, s(16), 0x1a1a2e).setStrokeStyle(
        s(2),
        0xd4af37,
        0.8,
      );

      const text = this.add.text(0, 0, String.fromCharCode(65 + row), {
        fontSize: px(16),
        fontFamily: "Georgia, serif",
        color: "#eedd99",
        fontStyle: "bold",
      }).setOrigin(0.5, 0.5);

      labelContainer.add([circle, text]);

      for (let col = 0; col < COLS; col++) {
        // Skip non-existent seats (seatMask or gap columns)
        if (!seatExists(row, col, this.layout)) {
          this.seatGrid[row][col] = null;
          continue;
        }

        const x = colX[col] + rowStagger;
        const isAisle = hasSeatLabel(row, col, "aisle", this.layout);
        const isRoyalBox = this.layout.royalBoxes?.some(
          (b) => b.row === row && b.col === col,
        );

        // Visual styling per seat type
        let emptyFill = 0x1a1a3e;
        let emptyStroke = 0x3a3a5e;
        let strokeWidth = s(2);
        if (isRoyalBox) {
          emptyFill = 0x2a2040;
          emptyStroke = 0xdaa520;
          strokeWidth = s(3);
        } else if (isAisle) {
          emptyFill = 0x1e1e38;
          emptyStroke = 0x8a7a3e;
          strokeWidth = s(2.5);
        }

        const seat = this.add
          .rectangle(x, y, SEAT_SIZE, SEAT_SIZE, emptyFill)
          .setStrokeStyle(strokeWidth, emptyStroke)
          .setInteractive({ useHandCursor: true });

        seat.setData("row", row);
        seat.setData("col", col);
        seat.setData("emptyFill", emptyFill);
        seat.setData("emptyStroke", emptyStroke);
        seat.setData("strokeWidth", strokeWidth);

        seat.on("pointerover", () => {
          if (
            this.turnPhase === "play" &&
            !this.placedPatrons[this.currentPlayer][row][col] &&
            this.selectedCard
          ) {
            seat.setFillStyle(0x2a2a5e);
            seat.setStrokeStyle(s(2), 0xf5c518);
          }
        });

        seat.on("pointerout", () => {
          if (!this.placedPatrons[this.currentPlayer][row][col]) {
            seat.setFillStyle(emptyFill);
            seat.setStrokeStyle(strokeWidth, emptyStroke);
          }
        });

        seat.on("pointerdown", () => {
          if (this.turnPhase === "play") {
            this.placeSeatCard(row, col, seat);
          }
        });

        // Royal Box label
        if (isRoyalBox) {
          const boxLabel = this.add
            .text(x, y + SEAT_SIZE / 2 + s(4), "👑", {
              fontSize: px(10),
            })
            .setOrigin(0.5, 0);
          this.seatLabels.push(boxLabel);
        }

        this.seatGrid[row][col] = seat;
      }
    }

    // ── HUD Panel (Game Information) ────────────────────────────────
    const hudW = s(260);
    const hudX = width - hudW - s(20);
    const hudY = gridStartY;
    this.uiContainer = this.add.container(hudX, hudY).setDepth(150);

    // HUD Background
    const houseRuleExtra = this.layout.houseRuleDescription ? s(60) : 0;
    const hudBg = this.add.rectangle(
      0,
      0,
      hudW,
      s(260 + this.playerCount * 48) + houseRuleExtra,
      0x0f0f1c,
      0.95,
    )
      .setOrigin(0, 0)
      .setStrokeStyle(s(3), 0xd4af37);
    this.uiContainer.add(hudBg);

    this.turnText = this.add
      .text(hudW / 2, s(20), "", {
        fontSize: px(20),
        fontFamily: "Georgia, serif",
        color: "#d4af37",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0);
    this.uiContainer.add(this.turnText);

    this.deckText = this.add
      .text(hudW / 2, s(50), "", {
        fontSize: px(15),
        fontFamily: "Georgia, serif",
        color: "#aaaacc",
      })
      .setOrigin(0.5, 0);
    this.uiContainer.add(this.deckText);

    // ── Deck Visual ───────────────────────────────────────────────
    // Stack regular Image objects to form a card pile. This avoids
    // DynamicTexture / framebuffer issues on mobile WebGL.
    const PILE_LAYERS = 5;
    const pileCardW = s(65);
    const pileCardH = s(87);
    const pileOffset = s(2); // px shift per layer
    const pileCenterX = hudW / 2;
    const pileCenterY = s(145);

    this.deckPileImage = this.add.container(pileCenterX, pileCenterY);
    for (let i = PILE_LAYERS - 1; i >= 0; i--) {
      const ox = i * pileOffset + (i % 2 === 0 ? s(1) : -s(1));
      const oy = i * pileOffset;
      const layer = this.add.image(ox, oy, "card_back");
      layer.setDisplaySize(pileCardW, pileCardH);
      this.deckPileImage.add(layer);
    }
    this.uiContainer.add(this.deckPileImage);

    // ── VP Scoreboard w/ Avatars ──────────────────────────────────
    const scoreStartY = s(220);
    this.scorePanels = [];
    for (let p = 0; p < this.playerCount; p++) {
      const panel = this.add.container(s(15), scoreStartY + p * s(48));

      const usherKey = this.usherKey(p);

      if (this.textures.exists(usherKey)) {
        const avatar = this.add.image(s(18), s(18), usherKey);
        avatar.setDisplaySize(s(32), s(32));

        const mask = this.make.graphics();
        mask.fillStyle(0xffffff);
        // Global position: hudX + panel.x + avatar.x, hudY + panel.y + avatar.y
        mask.fillCircle(
          hudX + s(15) + s(18),
          hudY + scoreStartY + p * s(48) + s(18),
          s(16),
        );
        avatar.setMask(mask.createGeometryMask());

        const ring = this.add.circle(s(18), s(18), s(16), 0x000000, 0)
          .setStrokeStyle(s(2), this.playerColorHex(p));
        panel.add([avatar, ring]);
      }

      const text = this.add
        .text(s(46), s(18), "", {
          fontSize: px(15),
          fontFamily: "Georgia, serif",
          color: this.playerColor(p),
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      // Store the text object directly on the container object for easy access
      panel.setData("text", text);
      panel.add(text);
      this.uiContainer.add(panel);
      this.scorePanels.push(panel);
    }

    // ── House Rule Reminder ──────────────────────────────────────
    if (this.layout.houseRuleDescription) {
      const ruleY = scoreStartY + this.playerCount * s(48) + s(8);
      // Thin gold divider
      const divider = this.add.rectangle(
        hudW / 2, ruleY, hudW - s(30), s(1), 0xd4af37, 0.4,
      ).setOrigin(0.5, 0);
      this.uiContainer.add(divider);

      const ruleText = this.add.text(
        hudW / 2,
        ruleY + s(8),
        this.layout.houseRuleDescription,
        {
          fontSize: px(11),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
          fontStyle: "italic",
          wordWrap: { width: hudW - s(24) },
          align: "center",
        },
      ).setOrigin(0.5, 0);
      this.uiContainer.add(ruleText);
    }

    // ── Active Player Large Avatar ──────────────────────────────────
    this.localPlayerContainer = this.add.container(s(90), height - s(90))
      .setDepth(5);
    this.localPlayerAvatar = this.add.image(0, 0, this.usherKey(0));
    this.localPlayerAvatar.setDisplaySize(s(140), s(140));

    this.localPlayerMask = this.make.graphics();
    this.localPlayerMask.fillStyle(0xffffff);
    this.localPlayerMask.fillCircle(s(90), height - s(90), s(70));
    this.localPlayerAvatar.setMask(this.localPlayerMask.createGeometryMask());

    this.localPlayerRing = this.add.circle(0, 0, s(70), 0x000000, 0)
      .setStrokeStyle(s(6), this.playerColorHex(0));

    this.localPlayerNumberBg = this.add.circle(
      -s(50),
      -s(50),
      s(22),
      0x0a0a1a,
      1,
    ).setStrokeStyle(s(3), this.playerColorHex(0));
    this.localPlayerNumberText = this.add.text(-s(50), -s(50), "1", {
      fontSize: px(24),
      fontFamily: "Georgia, serif",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.localPlayerContainer.add([
      this.localPlayerAvatar,
      this.localPlayerRing,
      this.localPlayerNumberBg,
      this.localPlayerNumberText,
    ]);

    // Global deselect background click
    this.input.on(
      "pointerdown",
      (/** @type {any} */ _pointer, /** @type {any[]} */ gameObjects) => {
        if (gameObjects.length === 0 && this.selectedCard) {
          this.selectedCard.setSelected(false);
          this.selectedCard = null;
          this.hideScoringTooltip();
        }
      },
    );

    // ── Logo ────────────────────────────────────────────────────────
    if (this.textures.exists("ui_logo")) {
      // Centered at s(80) to perfectly align vertically with the player avatar
      const logo = this.add.image(s(120), s(60), "ui_logo");
      const logoRatio = 0.3643695015;
      const logoWidth = 220;
      logo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio)); // Kept proportional to avoid clipping
      logo.setDepth(150);
    }

    // ── Start with pass screen for player 1 ─────────────────────────
    this.showPassScreen();
  }

  // ══════════════════════════════════════════════════════════════════
  // PASS SCREEN — shown between every player's turn
  // ══════════════════════════════════════════════════════════════════

  showPassScreen() {
    this.turnPhase = "pass-screen";

    // AI players skip the pass screen entirely
    if (this.aiConfig[this.currentPlayer]) {
      this.clearHandVisuals();
      this.time.delayedCall(400, () => this.startTurn());
      return;
    }

    const { width, height } = this.scale;
    const color = this.playerColor(this.currentPlayer);
    const colorHex = this.playerColorHex(this.currentPlayer);
    const name = PlayerNames[this.currentPlayer];

    // Remove old overlay
    if (this.passOverlay) {
      this.passOverlay.destroy();
    }

    // Clear hand visuals
    this.clearHandVisuals();

    const container = this.add.container(0, 0).setDepth(200);

    // Dim background
    const bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    container.add(bg);

    // Player usher avatar
    const usherKey = this.usherKey(this.currentPlayer);

    // Shift avatar origin up to avoid text
    const avatarY = height / 2 - s(130);
    const avatarRadius = s(68);

    if (this.textures.exists(usherKey)) {
      const usherIcon = this.add.image(width / 2, avatarY, usherKey);
      usherIcon.setDisplaySize(avatarRadius * 2, avatarRadius * 2);

      // Create a solid circular Graphics mask
      const maskShape = this.make.graphics();
      maskShape.fillStyle(0xffffff);
      maskShape.fillCircle(width / 2, avatarY, avatarRadius);
      usherIcon.setMask(maskShape.createGeometryMask());

      const ring = this.add.circle(
        width / 2,
        avatarY,
        avatarRadius,
        0x000000,
        0,
      )
        .setStrokeStyle(s(4), colorHex, 1);

      container.add([usherIcon, ring]);
    } else {
      const icons = ["🔵", "🔴", "🟢", "🟠"];
      const icon = this.add
        .text(width / 2, avatarY, icons[this.currentPlayer], {
          fontSize: px(64),
        })
        .setOrigin(0.5);
      container.add(icon);
    }

    // "Pass to Player X"
    const title = this.add
      .text(width / 2, height / 2 - s(20), `${name}'s Turn`, {
        fontSize: px(42),
        fontFamily: "Georgia, serif",
        color: color,
      })
      .setOrigin(0.5);
    container.add(title);

    // Round info
    const roundInfo = this.add
      .text(
        width / 2,
        height / 2 + s(40),
        `Round ${this.round} of ${this.totalRounds}  •  Deck: ${this.deck.length} cards`,
        {
          fontSize: px(16),
          fontFamily: "Arial",
          color: "#aaaaaa",
        },
      )
      .setOrigin(0.5);
    container.add(roundInfo);

    // House rule reminder
    if (this.layout.houseRuleDescription) {
      const houseRule = this.add
        .text(
          width / 2,
          height / 2 + s(70),
          `${this.layout.houseRuleDescription}`,
          {
            fontSize: px(16),
            fontFamily: "Arial",
            color: "#f5c518",
            fontStyle: "italic",
            wordWrap: { width: s(600) },
            align: "center",
          },
        )
        .setOrigin(0.5);
      container.add(houseRule);
    }

    // Ready button
    const { container: readyBtn, hitArea: readyHit } = createButton(
      this, width / 2, height / 2 + s(160), "I'm Ready", { fontSize: 20 },
    );
    readyHit.on("pointerdown", () => {
      container.destroy();
      this.passOverlay = null;
      this.startTurn();
    });
    container.add(readyBtn);
    this.passOverlay = container;
  }

  // ══════════════════════════════════════════════════════════════════
  // TURN START — draw cards and show player's theater
  // ══════════════════════════════════════════════════════════════════

  startTurn() {
    // Draw cards from deck into this player's hand
    const hand = this.playerHands[this.currentPlayer];

    // Draw phase: pull cards from deck if available
    if (this.playerCount === 2) {
      // 2-player: draw 2 (or whatever's left)
      const drawCount = Math.min(2, this.deck.length);
      for (let i = 0; i < drawCount; i++) {
        const card = this.deck.pop();
        if (card) hand.push(card);
      }
    } else {
      // 3 or 4 player: draw 1
      if (this.deck.length > 0) {
        const card = this.deck.pop();
        if (card) hand.push(card);
      }
    }

    // Render the current player's theater and hand
    this.renderTheater();
    this.updateUI();
    this.updateScoreboard();

    // AI players: auto-play their turn
    if (this.aiConfig[this.currentPlayer]) {
      this.turnPhase = "play";
      this.time.delayedCall(600, () => this.playAITurn());
      return;
    }

    this.renderHand();
    this.turnPhase = "play";
  }

  // ══════════════════════════════════════════════════════════════════
  // AI TURN — automatic card selection and placement
  // ══════════════════════════════════════════════════════════════════

  /**
   * Execute an AI player's turn automatically.
   * Picks the best card and seat, then animates the placement.
   */
  playAITurn() {
    const difficulty = this.aiConfig[this.currentPlayer];
    if (!difficulty) return;

    const hand = this.playerHands[this.currentPlayer];
    const grid = this.placedPatrons[this.currentPlayer];

    if (hand.length === 0) {
      this.advanceTurn();
      return;
    }

    // For 2-player mode (multiple cards in hand): pick best card + seat, discard the rest
    if (this.playerCount === 2 && hand.length >= 2) {
      const decision = pickCardAndSeat(grid, hand, this.layout, difficulty);
      if (!decision) {
        this.advanceTurn();
        return;
      }

      // Place the chosen card
      const { play, discard } = decision;
      this.placedPatrons[this.currentPlayer][play.row][play.col] = play.card;

      // Remove played card from hand
      const playIdx = hand.indexOf(play.card);
      if (playIdx >= 0) hand.splice(playIdx, 1);

      // Remove discarded card from hand
      const discardIdx = hand.indexOf(discard);
      if (discardIdx >= 0) hand.splice(discardIdx, 1);

      // Animate the placement on the seat
      this.animateAIPlacement(play.row, play.col, play.card);
      return;
    }

    // Single card: pick the best seat
    const cardToPlay = hand[0];
    const seat = pickSeat(grid, cardToPlay, this.layout, difficulty);
    if (!seat) {
      this.advanceTurn();
      return;
    }

    // Place the card
    this.placedPatrons[this.currentPlayer][seat.row][seat.col] = cardToPlay;
    hand.splice(0, 1);

    // Animate the placement
    this.animateAIPlacement(seat.row, seat.col, cardToPlay);
  }

  /**
   * Animate an AI card placement on the grid, then advance.
   * @param {number} row
   * @param {number} col
   * @param {import('../types.js').CardData} cardData
   */
  animateAIPlacement(row, col, cardData) {
    const seat = this.seatGrid[row]?.[col];
    if (!seat) {
      this.renderTheater();
      this.updateScoreboard();
      this.time.delayedCall(300, () => this.advanceTurn());
      return;
    }

    // Update seat visual
    seat.setFillStyle(0x000000, 0);
    seat.setStrokeStyle(
      s(2),
      cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
      0.8,
    );

    // Base patron image
    const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
    const baseImg = this.add.image(seat.x, seat.y, baseImgKey);
    const seatImgW = SEAT_SIZE * 0.9;
    const seatImgH = seatImgW * (140 / 105);
    baseImg.setDisplaySize(seatImgW, seatImgH);
    baseImg.setOrigin(0.5, 1);
    baseImg.setPosition(seat.x, seat.y + SEAT_SIZE / 2 - s(4));
    this.seatLabels.push(baseImg);

    const childrenForAnim = [seat, baseImg];

    // Trait badge
    if (cardData.trait) {
      const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
      const badge = this.add.image(
        seat.x + SEAT_SIZE / 2 - s(6),
        seat.y - SEAT_SIZE / 2 + s(14),
        badgeKey,
      );
      badge.setDisplaySize(s(30), s(30));
      this.seatLabels.push(badge);
      childrenForAnim.push(badge);
    }

    // Animate placement
    baseImg.setAlpha(0);
    this.tweens.add({
      targets: childrenForAnim,
      alpha: 1,
      duration: 150,
    });
    this.tweens.add({
      targets: childrenForAnim,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 150,
      yoyo: true,
    });

    this.updateScoreboard();

    // Advance after animation
    this.time.delayedCall(500, () => this.advanceTurn());
  }

  // ══════════════════════════════════════════════════════════════════
  // THEATER RENDERING — show current player's grid
  // ══════════════════════════════════════════════════════════════════

  renderTheater() {
    const grid = this.placedPatrons[this.currentPlayer];
    const ROWS = this.layout.rows;
    const COLS = this.layout.cols;

    // Clear old seat labels
    for (const lbl of this.seatLabels) {
      lbl.destroy();
    }
    this.seatLabels = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const seat = this.seatGrid[row][col];
        if (!seat) continue;

        const cardData = grid[row][col];
        if (cardData) {
          // Make the seat rectangle transparent so the image takes over
          seat.setFillStyle(0x000000, 0);
          seat.setStrokeStyle(
            s(2),
            cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
            0.8,
          );

          // Base patron image (Maintain aspect ratio, pin to bottom of seat)
          const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
          const baseImg = this.add.image(seat.x, seat.y, baseImgKey);

          const seatImgW = SEAT_SIZE * 0.9;
          const seatImgH = seatImgW * (140 / 105); // Use Card aspect ratio
          baseImg.setDisplaySize(seatImgW, seatImgH);
          baseImg.setOrigin(0.5, 1);
          baseImg.setPosition(seat.x, seat.y + SEAT_SIZE / 2 - s(4));
          this.seatLabels.push(baseImg);

          // Trait badge
          if (cardData.trait) {
            const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
            // Position badge in top-right corner of the seat
            const badge = this.add.image(
              seat.x + SEAT_SIZE / 2 - s(6),
              seat.y - SEAT_SIZE / 2 + s(14),
              badgeKey,
            );
            badge.setDisplaySize(s(30), s(30));
            this.seatLabels.push(badge);
          }
        } else {
          // Restore empty-state appearance from seat data
          const emptyFill = seat.getData("emptyFill") ?? 0x1a1a3e;
          const emptyStroke = seat.getData("emptyStroke") ?? 0x3a3a5e;
          const sw = seat.getData("strokeWidth") ?? s(2);
          seat.setFillStyle(emptyFill);
          seat.setStrokeStyle(sw, emptyStroke);

          // Re-add Royal Box label for empty seats
          const isRoyalBox = this.layout.royalBoxes?.some(
            (b) => b.row === row && b.col === col,
          );
          if (isRoyalBox) {
            const boxLabel = this.add
              .text(seat.x, seat.y + SEAT_SIZE / 2 + s(4), "👑", {
                fontSize: px(10),
              })
              .setOrigin(0.5, 0);
            this.seatLabels.push(boxLabel);
          }
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // HAND RENDERING
  // ══════════════════════════════════════════════════════════════════

  clearHandVisuals() {
    this.hideScoringTooltip();
    for (const card of this.handCards) {
      card.destroy();
    }
    this.handCards = [];
    this.selectedCard = null;
  }

  renderHand() {
    this.clearHandVisuals();

    const { width, height } = this.scale;
    const hand = this.playerHands[this.currentPlayer];
    const handSize = hand.length;
    if (handSize === 0) return;

    const handStartX = width / 2 - ((handSize - 1) * (Card.WIDTH + s(20))) / 2;
    const handY = height - s(100);

    for (let i = 0; i < handSize; i++) {
      const cardData = hand[i];
      const x = handStartX + i * (Card.WIDTH + s(20));
      const card = new Card(this, x, handY, cardData);

      card.on("pointerdown", () => {
        if (this.turnPhase === "play") {
          this.selectCard(card);
        } else if (this.turnPhase === "discard") {
          this.discardCard(card);
        }
      });

      // Animate in
      const targetY = card.y;
      card.y = targetY + s(150);
      card.setAlpha(0);
      this.tweens.add({
        targets: card,
        y: targetY,
        alpha: 1,
        duration: 300,
        delay: i * 100,
        ease: "Back.easeOut",
      });

      this.handCards.push(card);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // CARD SELECTION & PLACEMENT
  // ══════════════════════════════════════════════════════════════════

  /**
   * @param {Card} card
   */
  selectCard(card) {
    for (const c of this.handCards) {
      c.setSelected(false);
    }
    card.setSelected(true);
    this.selectedCard = card;

    this.showScoringTooltip(card);
  }

  /**
   * Show a scoring reminder above the selected card.
   * @param {Card} card
   */
  showScoringTooltip(card) {
    this.hideScoringTooltip();

    let hint = SCORING_HINTS[card.cardData.type] || "";
    if (card.cardData.trait) {
      const traitHint = TRAIT_HINTS[card.cardData.trait];
      if (traitHint) hint = hint ? `${hint}\n${traitHint}` : traitHint;
    }
    if (!card.cardData.label && !hint) return;

    this.scoringTooltip = new SpeechBubble(this, card, card.cardData.label, hint);

    // Fade in
    this.scoringTooltip.setAlpha(0);
    this.tweens.add({
      targets: this.scoringTooltip,
      alpha: 1,
      duration: 150,
      ease: "Sine.easeOut",
    });
  }

  /** Remove the scoring tooltip if visible. */
  hideScoringTooltip() {
    if (this.scoringTooltip) {
      this.scoringTooltip.destroy();
      this.scoringTooltip = null;
    }
  }

  /**
   * @param {number} row
   * @param {number} col
   * @param {Phaser.GameObjects.Rectangle} seat
   */
  placeSeatCard(row, col, seat) {
    if (!this.selectedCard) return;
    // Seat already occupied
    if (this.placedPatrons[this.currentPlayer][row][col]) {
      return;
    }

    const cardData = this.selectedCard.cardData;

    // Update logical state
    this.placedPatrons[this.currentPlayer][row][col] = cardData;

    // Update visual
    seat.setFillStyle(0x000000, 0);
    seat.setStrokeStyle(
      s(2),
      cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
      0.8,
    );

    // Base patron image (Maintain aspect ratio)
    const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
    const baseImg = this.add.image(seat.x, seat.y, baseImgKey);
    const seatImgW = SEAT_SIZE * 0.9;
    const seatImgH = seatImgW * (140 / 105);
    baseImg.setDisplaySize(seatImgW, seatImgH);
    baseImg.setOrigin(0.5, 1);
    baseImg.setPosition(seat.x, seat.y + SEAT_SIZE / 2 - s(4));
    this.seatLabels.push(baseImg);

    const childrenForAnim = [seat, baseImg];

    // Trait badge
    if (cardData.trait) {
      const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
      const badge = this.add.image(
        seat.x + SEAT_SIZE / 2 - s(6),
        seat.y - SEAT_SIZE / 2 + s(14),
        badgeKey,
      );
      badge.setDisplaySize(s(30), s(30));
      this.seatLabels.push(badge);
      childrenForAnim.push(badge);
    }

    // Placement animation: fade in + scale pop
    baseImg.setAlpha(0);
    // Fade in (no yoyo — stays visible)
    this.tweens.add({
      targets: childrenForAnim,
      alpha: 1,
      duration: 150,
    });
    // Scale pop (yoyo back to normal size)
    this.tweens.add({
      targets: childrenForAnim,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 150,
      yoyo: true,
    });

    // Recalculate scores after placement
    this.updateScoreboard();

    // Remove card from hand (visual and data)
    const cardIndex = this.handCards.indexOf(this.selectedCard);
    if (cardIndex >= 0) {
      // Also remove from player hand data
      const handDataIndex = this.playerHands[this.currentPlayer].indexOf(
        this.selectedCard.cardData,
      );
      if (handDataIndex >= 0) {
        this.playerHands[this.currentPlayer].splice(handDataIndex, 1);
      }
      this.selectedCard.destroy();
      this.handCards.splice(cardIndex, 1);
    }
    this.selectedCard = null;
    this.hideScoringTooltip();

    // Check if 2-player discard is needed
    if (
      this.playerCount === 2 && this.playerHands[this.currentPlayer].length > 1
    ) {
      this.turnPhase = "discard";
      // Highlight remaining cards for discard
      for (const c of this.handCards) {
        c.background.setStrokeStyle(s(3), 0xff4444, 1);
      }
      return;
    }

    // Otherwise, advance to next player
    this.advanceTurn();
  }

  /**
   * Discard a card (2-player mode).
   * @param {Card} card
   */
  discardCard(card) {
    // Remove from data
    const handDataIndex = this.playerHands[this.currentPlayer].indexOf(
      card.cardData,
    );
    if (handDataIndex >= 0) {
      this.playerHands[this.currentPlayer].splice(handDataIndex, 1);
    }

    // Remove visual with a fade
    const cardIndex = this.handCards.indexOf(card);
    if (cardIndex >= 0) {
      this.handCards.splice(cardIndex, 1);
    }

    this.tweens.add({
      targets: card,
      alpha: 0,
      y: card.y + s(80),
      duration: 300,
      onComplete: () => card.destroy(),
    });

    // Short delay then advance
    this.time.delayedCall(400, () => {
      this.advanceTurn();
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // TURN ADVANCEMENT
  // ══════════════════════════════════════════════════════════════════

  advanceTurn() {
    const nextPlayer = this.currentPlayer + 1;

    if (nextPlayer >= this.playerCount) {
      // All players have gone this round

      // Ghost discard for 3-player
      if (this.playerCount === 3 && this.deck.length > 0) {
        this.deck.pop();
      }

      // Check if game is over
      if (this.round >= this.totalRounds) {
        this.time.delayedCall(300, () => this.endGame());
        return;
      }

      // Next round
      this.round++;
      this.currentPlayer = 0;
    } else {
      this.currentPlayer = nextPlayer;
    }

    // Show pass screen for next player
    this.time.delayedCall(200, () => this.showPassScreen());
  }

  // ══════════════════════════════════════════════════════════════════
  // SCOREBOARD
  // ══════════════════════════════════════════════════════════════════

  /**
   * Recalculate and display VP scores for all players.
   * Respects the showAllScores setting from the Phaser registry.
   */
  updateScoreboard() {
    const showAll = this.registry.get("showAllScores") ?? true;

    for (let p = 0; p < this.playerCount; p++) {
      const panel = this.scorePanels[p];
      if (!panel) continue;

      const text = panel.getData("text");

      const { total } = scorePlayer(this.placedPatrons[p], this.layout);
      const isAI = !!this.aiConfig[p];
      const name = isAI ? `${PlayerNames[p]} \uD83E\uDD16` : PlayerNames[p];

      if (showAll || p === this.currentPlayer) {
        text.setText(`${name}: ${total} VP`);
        panel.setAlpha(p === this.currentPlayer ? 1 : 0.6);
        panel.setVisible(true);
      } else {
        panel.setVisible(false);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // UI UPDATE
  // ══════════════════════════════════════════════════════════════════

  updateUI() {
    const color = this.playerColor(this.currentPlayer);
    const colorHex = this.playerColorHex(this.currentPlayer);

    if (this.turnText) {
      this.turnText.setText(`Round ${this.round} / ${this.totalRounds}`);
    }

    if (this.deckText) {
      this.deckText.setText(`Deck: ${this.deck.length}`);
    }

    // Update deck pile visualization (scale down as deck empties)
    if (this.deckPileImage) {
      const ratio = Math.max(this.deck.length / 54, 0);
      this.deckPileImage.setScale(0.3 + 0.7 * ratio);
      this.deckPileImage.setAlpha(ratio > 0 ? 0.5 + 0.5 * ratio : 0.2);
    }

    // Update local player avatar
    if (this.localPlayerAvatar && this.localPlayerRing) {
      const usherKey = this.usherKey(this.currentPlayer);
      if (this.textures.exists(usherKey)) {
        this.localPlayerAvatar.setTexture(usherKey);
        this.localPlayerRing.setStrokeStyle(s(6), colorHex);

        if (this.localPlayerNumberBg) {
          this.localPlayerNumberBg.setStrokeStyle(s(3), colorHex);
        }
        if (this.localPlayerNumberText) {
          this.localPlayerNumberText.setText(
            (this.currentPlayer + 1).toString(),
          );
          this.localPlayerNumberText.setColor(color);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // END GAME — show all theaters and scores
  // ══════════════════════════════════════════════════════════════════

  endGame() {
    this.scene.start("EndGameScene", {
      playerCount: this.playerCount,
      layout: this.layout,
      placedPatrons: this.placedPatrons,
      playerColorMap: this.playerColorMap,
      aiConfig: this.aiConfig,
    });
  }

  /**
   * @override
   * @param {number} _time
   * @param {number} _delta
   */
  update(_time, _delta) {
    // Event-driven game — nothing needed here.
  }
}
