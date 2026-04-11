// @ts-check
import Phaser from "phaser";
import { Card } from "../objects/Card.js";
import {
  createDeck,
  GrandEmpressLayout,
  Layouts,
  PatronColors,
  TraitColors,
  PlayerColors,
  PlayerColorsHex,
  PlayerNames,
} from "../types.js";
import { scorePlayer, isAisleSeat, seatExists } from "../scoring.js";
import { s, px } from "../config.js";

const SEAT_SIZE = s(80);
const SEAT_GAP = s(8);
const AISLE_GAP = s(30);   // wider gap for aisle walkways
const WALL_WIDTH = s(6);   // theater wall thickness

/**
 * Concise scoring reminders shown when a card is selected.
 * @type {Record<string, string>}
 */
const SCORING_HINTS = {
  "Standard": "Base 3 VP",
  "VIP": "Base 5 VP\n+3 VP in rows A–B (front 2)\n⚠ −3 VP per adjacent Kid or Noisy",
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
     * @type {'pass-screen' | 'play' | 'discard' | 'ghost-discard'}
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
    this.infoText = null;

    /** @type {Phaser.GameObjects.Rectangle | null} */
    this.topBanner = null;

    /** @type {Phaser.GameObjects.Text | null} */
    this.bannerText = null;

    /** @type {Phaser.GameObjects.Text[]} */
    this.scoreTexts = [];

    /** @type {Phaser.GameObjects.Text[]} */
    this.seatLabels = [];

    /** @type {number[]} center-x of each column (set in create) */
    this.colX = [];

    /** @type {number[]} per-row X offset for staggered layouts (set in create) */
    this.staggerRowOffsets = [];

    /** @type {number[]} center-y of each row (set in create) */
    this.rowY = [];

    /** @type {number} top of the seat grid (set in create) */
    this.gridStartY = 0;

    /** @type {Phaser.GameObjects.Text | null} */
    this.scoringTooltip = null;
  }

  preload() {
    this.load.image('patron_standard', 'assets/patron_standard.png');
    this.load.image('patron_vip', 'assets/patron_vip.png');
    this.load.image('patron_lovebirds', 'assets/patron_lovebirds.png');
    this.load.image('patron_kid', 'assets/patron_kid.png');
    this.load.image('patron_teacher', 'assets/patron_teacher.png');
    this.load.image('patron_critic', 'assets/patron_critic.png');

    this.load.image('badge_tall', 'assets/badge_tall.png');
    this.load.image('badge_short', 'assets/badge_short.png');
    this.load.image('badge_bespectacled', 'assets/badge_bespectacled.png');
    this.load.image('badge_noisy', 'assets/badge_noisy.png');

    this.load.image('bg_grand-empress', 'assets/bg_grand_empress.png');
    this.load.image('bg_blackbox', 'assets/bg_blackbox.png');
    this.load.image('bg_royal-theatre', 'assets/bg_royal_theatre.png');
    this.load.image('bg_amphitheater', 'assets/bg_amphitheater.png');
    this.load.image('bg_cabaret', 'assets/bg_cabaret.png');
    this.load.image('bg_balcony', 'assets/bg_balcony.png');
    this.load.image('bg_promenade', 'assets/bg_promenade.png');

    this.load.image('card_back', 'assets/card_back.png');
    this.load.image('manager_token', 'assets/manager_token.png');
    
    this.load.image('ui_stage', 'assets/ui_stage.png');
    this.load.image('ui_logo', 'assets/ui_logo.png');
    this.load.image('usher_blue', 'assets/usher_blue.png');
    this.load.image('usher_red', 'assets/usher_red.png');
    this.load.image('usher_green', 'assets/usher_green.png');
    this.load.image('usher_orange', 'assets/usher_orange.png');
  }

  /**
   * @param {{ playerCount?: number, layoutId?: string }} data
   */
  init(data) {
    this.layout = (data.layoutId && Layouts[data.layoutId]) || GrandEmpressLayout;
    this.playerCount = data.playerCount || 2;
    this.currentPlayer = 0;
    this.round = 1;
    this.selectedCard = null;
    this.turnPhase = "pass-screen";
    this.deck = createDeck();
    this.handCards = [];
    this.seatLabels = [];

    const { rows, cols } = this.layout;

    // Initialize per-player state
    this.placedPatrons = [];
    this.playerHands = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.placedPatrons[p] = Array.from({ length: rows }, () =>
        Array(cols).fill(null)
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
    this.scoreTexts = [];
  }

  create() {
    const { width, height } = this.scale;

    // ── Top banner (player color indicator) ─────────────────────────
    this.topBanner = this.add
      .rectangle(width / 2, 0, width, s(56), 0x000000)
      .setOrigin(0.5, 0)
      .setDepth(0);

    this.bannerText = this.add
      .text(width / 2, s(28), "", {
        fontSize: px(18),
        fontFamily: "Georgia, serif",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1);

    this.topBannerAvatar = this.add.image(width / 2 - s(200), s(28), 'usher_blue')
      .setOrigin(0.5)
      .setDisplaySize(s(44), s(44))
      .setDepth(1)
      .setVisible(false);

    // Apply circular mask to the avatar
    this.bannerMask = this.make.graphics();
    this.bannerMask.fillStyle(0xffffff);
    this.bannerMask.fillCircle(width / 2 - s(200), s(28), s(22));
    this.topBannerAvatar.setMask(this.bannerMask.createGeometryMask());

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

    const gridStartY = s(110);

    // ── Compute per-row stagger offsets (brick-pattern pyramid) ──
    /** @type {number[]} per-row X shift for staggered layouts */
    const staggerRowOffsets = [];
    const halfSeat = (SEAT_SIZE + SEAT_GAP) / 2;
    if (this.layout.staggered && this.layout.seatMask) {
      // Find row 0's first valid column as the reference point
      let row0FirstCol = 0;
      while (row0FirstCol < COLS && !this.layout.seatMask[0][row0FirstCol]) row0FirstCol++;
      for (let r = 0; r < ROWS; r++) {
        let firstCol = 0;
        while (firstCol < COLS && !this.layout.seatMask[r][firstCol]) firstCol++;
        // Each row should be centered: r * halfSeat inset from row 0
        // The seatMask already skips columns, adding an inherent offset
        // Correction = desired centering offset − inherent grid offset
        const desiredOffset = r * halfSeat;
        const inherentOffset = (firstCol - row0FirstCol) * (SEAT_SIZE + SEAT_GAP);
        staggerRowOffsets[r] = desiredOffset - inherentOffset;
      }
    } else {
      for (let r = 0; r < ROWS; r++) staggerRowOffsets[r] = 0;
    }

    const gridStartX = (width - totalGridW) / 2;

    // Offset colX and rowY so they're relative to gridStartX/gridStartY
    for (let c = 0; c < COLS; c++) colX[c] += gridStartX;
    for (let r = 0; r < ROWS; r++) rowY[r] += gridStartY;

    // ── Theater floor background ─────────────────────────────────
    const floorLeft = gridStartX;
    const floorRight = gridStartX + totalGridW;
    const floorTop = gridStartY - s(4);
    const floorBottom = gridStartY + totalGridH + s(4);
    const floorW = floorRight - floorLeft;
    const floorH = floorBottom - floorTop;

    const bgKey = `bg_${this.layout.id}`;
    if (this.textures.exists(bgKey)) {
      // Draw the background image with slight aesthetic bleed
      const bgImg = this.add.image(floorLeft + floorW / 2, floorTop + floorH / 2, bgKey);
      bgImg.setDisplaySize(floorW + s(60), floorH + s(60));
    } else {
      this.add
        .rectangle(
          floorLeft + floorW / 2,
          floorTop + floorH / 2,
          floorW,
          floorH,
          0x12122a
        )
        .setStrokeStyle(s(1), 0x2a2a4e, 0.5);
    }

    // ── Walls (solid lines on non-aisle edges) ──────────────────
    if (!leftAisle) {
      this.add
        .rectangle(floorLeft, floorTop + floorH / 2, WALL_WIDTH, floorH, 0x4a3a2a)
        .setOrigin(0.5, 0.5);
    }
    if (!rightAisle) {
      this.add
        .rectangle(floorRight, floorTop + floorH / 2, WALL_WIDTH, floorH, 0x4a3a2a)
        .setOrigin(0.5, 0.5);
    }

    // ── Aisle walkway strips ──────────────────────────────────────
    const aisleColor = 0x1e1e32;
    const aisleStripH = floorH;

    // Left aisle walkway
    if (leftAisle) {
      const aisleX = gridStartX + AISLE_GAP / 2;
      this.add
        .rectangle(aisleX, floorTop + floorH / 2, AISLE_GAP - s(4), aisleStripH, aisleColor)
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // Right aisle walkway
    if (rightAisle) {
      const aisleX = floorRight - AISLE_GAP / 2;
      this.add
        .rectangle(aisleX, floorTop + floorH / 2, AISLE_GAP - s(4), aisleStripH, aisleColor)
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
        .rectangle(aisleX, floorTop + floorH / 2, aisleW - s(4), aisleStripH, aisleColor)
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
        .rectangle(aisleX, floorTop + floorH / 2, GAP_COL_WIDTH - s(4), aisleStripH, aisleColor)
        .setAlpha(0.6);
      for (let dy = 0; dy < floorH; dy += s(16)) {
        this.add
          .rectangle(aisleX, floorTop + dy + s(4), s(2), s(8), 0x444466)
          .setAlpha(0.4);
      }
    }

    // ── Stage platform ───────────────────────────────────────────
    // ── Stage platform ───────────────────────────────────────────
    const stageH = s(28); // slightly taller to fit detailed footlights
    const stageY = floorTop - stageH / 2; // sits right above the floor
    
    if (this.textures.exists('ui_stage')) {
      const stageImg = this.add.image(floorLeft + floorW / 2, stageY, 'ui_stage');
      stageImg.setDisplaySize(floorW + s(10), stageH);
    } else {
      this.add
        .rectangle(floorLeft + floorW / 2, stageY, floorW, stageH, 0x8b4513)
        .setStrokeStyle(s(1), 0xdaa520);

      this.add
        .text(floorLeft + floorW / 2, stageY, "STAGE", {
          fontSize: px(11),
          color: "#ffd700",
          fontFamily: "Georgia, serif",
          fontStyle: "bold",
        })
        .setOrigin(0.5);
    }

    // ── Row labels (dynamic based on layout) ────────────────────────
    const rowLabels = Array.from({ length: ROWS }, (_, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C, ...
      if (i === 0) return `${letter} ◂ Front`;
      if (i === ROWS - 1) return `${letter} ◂ Back`;
      return `${letter}`;
    });

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
      for (let dx = 0; dx < floorW; dx += s(12)) {
        this.add
          .rectangle(floorLeft + dx + s(3), midY, s(6), s(2), 0x555577)
          .setAlpha(0.5);
      }
    }

    // ── Build theater grid ──────────────────────────────────────────
    for (let row = 0; row < ROWS; row++) {
      this.seatGrid[row] = [];
      const y = rowY[row];

      // Row label: shift right to match stagger offset
      const rowStagger = staggerRowOffsets[row] || 0;
      this.add
        .text(
          gridStartX + rowStagger - s(6),
          y,
          rowLabels[row],
          { fontSize: px(11), color: "#666688", fontFamily: "Arial" }
        )
        .setOrigin(1, 0.5);

      for (let col = 0; col < COLS; col++) {
        // Skip non-existent seats (seatMask or gap columns)
        if (!seatExists(row, col, this.layout)) {
          this.seatGrid[row][col] = null;
          continue;
        }

        const x = colX[col] + rowStagger;
        const isAisle = isAisleSeat(row, col, this.layout);
        const isRoyalBox = this.layout.royalBoxes?.some(
          (b) => b.row === row && b.col === col
        );

        // Visual styling per seat type
        const emptyFill = isRoyalBox ? 0x2a2040 : isAisle ? 0x1e1e38 : 0x1a1a3e;
        const emptyStroke = isRoyalBox ? 0xdaa520 : isAisle ? 0x6a6a3e : 0x3a3a5e;
        const strokeWidth = isRoyalBox ? s(3) : s(2);

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

    // ── UI text ─────────────────────────────────────────────────────
    this.turnText = this.add
      .text(width - s(30), s(70), "", {
        fontSize: px(16),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(1, 0.5);

    this.deckText = this.add
      .text(width - s(30), s(92), "", {
        fontSize: px(14),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(1, 0.5);

    // ── VP Scoreboard ───────────────────────────────────────────────
    this.scoreTexts = [];
    for (let p = 0; p < this.playerCount; p++) {
      const scoreText = this.add
        .text(width - s(30), s(118) + p * s(22), "", {
          fontSize: px(14),
          fontFamily: "Arial",
          color: PlayerColors[p],
        })
        .setOrigin(1, 0.5);
      this.scoreTexts.push(scoreText);
    }

    this.infoText = this.add
      .text(width / 2, height - s(25), "", {
        fontSize: px(14),
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(0.5);

    // ── Start with pass screen for player 1 ─────────────────────────
    this.showPassScreen();
  }

  // ══════════════════════════════════════════════════════════════════
  // PASS SCREEN — shown between every player's turn
  // ══════════════════════════════════════════════════════════════════

  showPassScreen() {
    this.turnPhase = "pass-screen";
    const { width, height } = this.scale;
    const color = PlayerColors[this.currentPlayer];
    const colorHex = PlayerColorsHex[this.currentPlayer];
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

    // Colored accent bar at top
    const accent = this.add
      .rectangle(width / 2, 0, width, s(8), colorHex)
      .setOrigin(0.5, 0);
    container.add(accent);

    // Player usher avatar
    const usherKeys = ['usher_blue', 'usher_red', 'usher_green', 'usher_orange'];
    const usherKey = usherKeys[this.currentPlayer];
    
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
      
      const ring = this.add.circle(width / 2, avatarY, avatarRadius, 0x000000, 0)
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
        }
      )
      .setOrigin(0.5);
    container.add(roundInfo);

    // House rule reminder
    if (this.layout.houseRuleDescription) {
      const houseRule = this.add
        .text(
          width / 2,
          height / 2 + s(70),
          `${this.layout.emoji} ${this.layout.houseRuleDescription}`,
          {
            fontSize: px(13),
            fontFamily: "Arial",
            color: "#f5c518",
            fontStyle: "italic",
            wordWrap: { width: s(400) },
            align: "center",
          }
        )
        .setOrigin(0.5);
      container.add(houseRule);
    }

    // Ready button
    const readyBtn = this.add
      .text(width / 2, height / 2 + s(120), "👆 I'm Ready", {
        fontSize: px(28),
        fontFamily: "Georgia, serif",
        color: "#ffffff",
        backgroundColor: "#4a2c7a",
        padding: { x: s(30), y: s(15) },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    readyBtn.on("pointerover", () => readyBtn.setStyle({ color: "#f5c518" }));
    readyBtn.on("pointerout", () => readyBtn.setStyle({ color: "#ffffff" }));

    readyBtn.on("pointerdown", () => {
      container.destroy();
      this.passOverlay = null;
      this.startTurn();
    });

    // Gentle pulse on ready button
    this.tweens.add({
      targets: readyBtn,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
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
    this.renderHand();
    this.updateUI();
    this.updateScoreboard();
    this.turnPhase = "play";

    if (this.infoText) {
      if (hand.length === 1) {
        this.infoText.setText("Last round! Play your final card.");
      } else {
        this.infoText.setText(
          "Select a card, then click a seat to place it."
        );
      }
    }
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
          seat.setStrokeStyle(s(2), cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a, 0.8);

          // Base patron image
          const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
          const baseImg = this.add.image(seat.x, seat.y, baseImgKey);
          baseImg.setDisplaySize(SEAT_SIZE, SEAT_SIZE);
          this.seatLabels.push(baseImg);

          // Trait badge
          if (cardData.trait) {
            const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
            // Position badge in top-right corner of the seat
            const badge = this.add.image(seat.x + SEAT_SIZE / 2 - s(12), seat.y - SEAT_SIZE / 2 + s(12), badgeKey);
            badge.setDisplaySize(s(24), s(24));
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
            (b) => b.row === row && b.col === col
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

    if (this.infoText) {
      this.infoText.setText(
        `Selected: ${card.cardData.emoji} ${card.cardData.type} — Click a seat to place it!`
      );
    }

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
    if (!hint) return;

    this.scoringTooltip = this.add
      .text(card.x, card.y - Card.HEIGHT / 2 - s(12), hint, {
        fontSize: px(11),
        fontFamily: "Arial",
        color: "#ffffff",
        backgroundColor: "#1a1a2eee",
        padding: { x: s(8), y: s(5) },
        align: "center",
        wordWrap: { width: s(220) },
      })
      .setOrigin(0.5, 1)
      .setDepth(100);

    // Fade in
    this.scoringTooltip.setAlpha(0);
    this.tweens.add({
      targets: this.scoringTooltip,
      alpha: 1,
      duration: 150,
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
    if (!this.selectedCard || this.placedPatrons[this.currentPlayer][row][col]) {
      if (this.placedPatrons[this.currentPlayer][row][col] && this.infoText) {
        this.infoText.setText("That seat is taken! Choose another.");
      }
      return;
    }

    const cardData = this.selectedCard.cardData;

    // Update logical state
    this.placedPatrons[this.currentPlayer][row][col] = cardData;

    // Update visual
    seat.setFillStyle(0x000000, 0);
    seat.setStrokeStyle(s(2), cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a, 0.8);

    const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
    const baseImg = this.add.image(seat.x, seat.y, baseImgKey);
    baseImg.setDisplaySize(SEAT_SIZE, SEAT_SIZE);
    this.seatLabels.push(baseImg);

    const childrenForAnim = [seat, baseImg];

    // Trait badge
    if (cardData.trait) {
      const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
      const badge = this.add.image(seat.x + SEAT_SIZE / 2 - s(12), seat.y - SEAT_SIZE / 2 + s(12), badgeKey);
      badge.setDisplaySize(s(24), s(24));
      this.seatLabels.push(badge);
      childrenForAnim.push(badge);
    }

    // Placement animation
    this.tweens.add({
      targets: childrenForAnim,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
    });

    // Recalculate scores after placement
    this.updateScoreboard();

    // Remove card from hand (visual and data)
    const cardIndex = this.handCards.indexOf(this.selectedCard);
    if (cardIndex >= 0) {
      // Also remove from player hand data
      const handDataIndex = this.playerHands[this.currentPlayer].indexOf(
        this.selectedCard.cardData
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
    if (this.playerCount === 2 && this.playerHands[this.currentPlayer].length > 1) {
      this.turnPhase = "discard";
      if (this.infoText) {
        this.infoText.setText("Now discard a card — click one to remove it.");
      }
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
      card.cardData
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

    if (this.infoText) {
      this.infoText.setText(
        `Discarded ${card.cardData.emoji} ${card.cardData.type}`
      );
    }

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
      const text = this.scoreTexts[p];
      if (!text) continue;

      const { total } = scorePlayer(this.placedPatrons[p], this.layout);
      const name = PlayerNames[p];

      if (showAll || p === this.currentPlayer) {
        text.setText(`${name}: ${total} VP`);
        text.setAlpha(p === this.currentPlayer ? 1 : 0.6);
        text.setVisible(true);
      } else {
        text.setVisible(false);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // UI UPDATE
  // ══════════════════════════════════════════════════════════════════

  updateUI() {
    const color = PlayerColors[this.currentPlayer];
    const colorHex = PlayerColorsHex[this.currentPlayer];
    const name = PlayerNames[this.currentPlayer];

    if (this.topBanner) {
      this.topBanner.setFillStyle(colorHex, 0.25);
    }

    if (this.bannerText) {
      this.bannerText.setText(`${this.layout.emoji} ${name} — ${this.layout.name}`);
      this.bannerText.setColor(color);
      
      if (this.topBannerAvatar) {
        const usherKeys = ['usher_blue', 'usher_red', 'usher_green', 'usher_orange'];
        const usherKey = usherKeys[this.currentPlayer];
        if (this.textures.exists(usherKey)) {
           this.topBannerAvatar.setTexture(usherKey).setVisible(true);
           // Calculate dynamic width of text to position avatar right next to it
           const textWidth = this.bannerText.width;
           const newX = this.bannerText.x - textWidth / 2 - s(30);
           this.topBannerAvatar.setX(newX);
           
           if (this.bannerMask) {
             this.bannerMask.clear();
             this.bannerMask.fillStyle(0xffffff);
             this.bannerMask.fillCircle(newX, s(28), s(22));
           }
        }
      }
    }

    if (this.turnText) {
      this.turnText.setText(`Round ${this.round} / ${this.totalRounds}`);
    }

    if (this.deckText) {
      this.deckText.setText(`Deck: ${this.deck.length} cards`);
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // END GAME — show all theaters and scores
  // ══════════════════════════════════════════════════════════════════

  endGame() {
    const { width, height } = this.scale;

    // Clear hand
    this.clearHandVisuals();

    // Full overlay
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.93)
      .setDepth(300);

    const container = this.add.container(0, 0).setDepth(301);

    // Title
    container.add(
      this.add
        .text(width / 2, s(30), "🎭 Show's Over!", {
          fontSize: px(32),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
        })
        .setOrigin(0.5)
    );

    // Calculate real VP scores
    /** @type {number[]} */
    const scores = [];
    /** @type {import('../scoring.js').PlayerScore[]} */
    const playerScores = [];
    for (let p = 0; p < this.playerCount; p++) {
      const result = scorePlayer(this.placedPatrons[p], this.layout);
      scores.push(result.total);
      playerScores.push(result);
    }

    // Find winner
    const maxScore = Math.max(...scores);

    // ── Layout: 2-column grid ───────────────────────────────────────
    // 2 players → 1 row, 2 cols
    // 3 players → row 1: 2 cols, row 2: 1 centered
    // 4 players → 2 rows, 2 cols
    const gridCols = 2;
    const gridRows = this.playerCount <= 2 ? 1 : 2;

    // Size the mini seats to fill available space
    const titleAreaH = s(60);                // space for title at top
    const footerAreaH = s(90);               // space for winner text + button
    const availH = height - titleAreaH - footerAreaH;
    const availW = width - s(60);            // horizontal margin

    const cellGapX = s(40);                  // gap between grid columns
    const cellGapY = s(30);                  // gap between grid rows
    const labelH = s(45);                    // player name + score above grid

    // Compute max seat size that fits
    const cellW = (availW - (gridCols - 1) * cellGapX) / gridCols;
    const cellH = (availH - (gridRows - 1) * cellGapY) / gridRows;
    const ROWS = this.layout.rows;
    const COLS = this.layout.cols;
    const maxSeatFromW = (cellW - (COLS - 1) * s(3)) / COLS;
    const maxSeatFromH = (cellH - labelH - (ROWS - 1) * s(3)) / ROWS;
    const miniSeatSize = Math.min(Math.floor(Math.min(maxSeatFromW, maxSeatFromH)), s(50));
    const miniGap = s(5);

    const miniGridW = COLS * (miniSeatSize + miniGap) - miniGap;
    const miniGridH = ROWS * (miniSeatSize + miniGap) - miniGap;
    const panelW = miniGridW;                // width of one player panel
    const panelH = labelH + miniGridH;       // height of one player panel

    // Compute grid positions for each player slot
    // Returns {cx, cy} — the center-x of the panel and top-y
    /**
     * @param {number} idx
     * @returns {{cx: number, topY: number}}
     */
    const slotPosition = (idx) => {
      let col, row;
      if (this.playerCount === 3 && idx === 2) {
        // 3rd player: centered on second row
        col = 0.5; // will be centered
        row = 1;
      } else {
        col = idx % gridCols;
        row = Math.floor(idx / gridCols);
      }

      const totalRowW = (col === 0.5)
        ? panelW  // single centered panel
        : gridCols * panelW + (gridCols - 1) * cellGapX;
      const rowStartX = (width - totalRowW) / 2;

      const cx = (col === 0.5)
        ? width / 2
        : rowStartX + col * (panelW + cellGapX) + panelW / 2;

      const totalH = gridRows * panelH + (gridRows - 1) * cellGapY;
      const gridStartY = titleAreaH + (availH - totalH) / 2;
      const topY = gridStartY + row * (panelH + cellGapY);

      return { cx, topY };
    };

    // Draw each player's theater
    for (let p = 0; p < this.playerCount; p++) {
      const { cx, topY } = slotPosition(p);
      const baseX = cx - miniGridW / 2;      // left edge of grid
      const gridTopY = topY + labelH;         // top of seat grid
      const color = PlayerColors[p];
      const isWinner = scores[p] === maxScore;

      // Player name
      container.add(
        this.add
          .text(cx, topY, PlayerNames[p], {
            fontSize: px(18),
            fontFamily: "Georgia, serif",
            color: color,
          })
          .setOrigin(0.5, 0)
      );

      // Score
      container.add(
        this.add
          .text(
            cx,
            topY + s(22),
            `${scores[p]} VP${isWinner ? " 🏆" : ""}`,
            {
              fontSize: px(14),
              fontFamily: "Arial",
              color: isWinner ? "#f5c518" : "#aaaaaa",
            }
          )
          .setOrigin(0.5, 0)
      );

      // Mini grid
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!seatExists(r, c, this.layout)) continue;

          const x = baseX + c * (miniSeatSize + miniGap) + miniSeatSize / 2;
          const y = gridTopY + r * (miniSeatSize + miniGap) + miniSeatSize / 2;
          const cardData = this.placedPatrons[p][r][c];

          const seatVP = playerScores[p].perSeat[r][c];
          const seatColor = cardData
            ? PatronColors[cardData.type] || 0x607d8b
            : 0x1a1a3e;

          const rect = this.add
            .rectangle(x, y, miniSeatSize, miniSeatSize, seatColor)
            .setStrokeStyle(
              s(1),
              cardData
                ? seatVP < 0
                  ? 0xff4444
                  : seatVP > 3
                    ? 0xf5c518
                    : 0x888888
                : 0x3a3a5e
            );
          container.add(rect);

          if (cardData) {
            const emojiSize = Math.max(8, Math.round(miniSeatSize * 0.45));
            const vpSize = Math.max(6, Math.round(miniSeatSize * 0.32));
            const e = this.add
              .text(x, y - miniSeatSize * 0.12, cardData.emoji, {
                fontSize: `${emojiSize}px`,
              })
              .setOrigin(0.5);
            container.add(e);

            // Show per-seat VP
            const vpLabel = this.add
              .text(x, y + miniSeatSize * 0.28, `${seatVP}`, {
                fontSize: `${vpSize}px`,
                fontFamily: "Arial",
                color: seatVP < 0 ? "#ff6666" : seatVP > 0 ? "#ffffff" : "#888888",
              })
              .setOrigin(0.5);
            container.add(vpLabel);
          }
        }
      }
    }

    // ── Winner announcement & Play Again ─────────────────────────────
    const footerY = height - footerAreaH;

    const winners = scores
      .map((sc, i) => (sc === maxScore ? PlayerNames[i] : null))
      .filter(Boolean);
    const winnerMsg =
      winners.length > 1
        ? `It's a tie! ${winners.join(" & ")}`
        : `${winners[0]} wins!`;

    container.add(
      this.add
        .text(width / 2, footerY, winnerMsg, {
          fontSize: px(26),
          fontFamily: "Georgia, serif",
          color: "#f5c518",
        })
        .setOrigin(0.5, 0)
    );

    const restartBtn = this.add
      .text(
        width / 2,
        footerY + s(40),
        "▶  Play Again",
        {
          fontSize: px(22),
          fontFamily: "Georgia, serif",
          color: "#ffffff",
          backgroundColor: "#4a2c7a",
          padding: { x: s(20), y: s(10) },
        }
      )
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    restartBtn.on("pointerdown", () => {
      this.scene.start("TitleScene");
    });

    container.add(restartBtn);
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


