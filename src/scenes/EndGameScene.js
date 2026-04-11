// @ts-check
import Phaser from "phaser";
import { s, px } from "../config.js";
import { PlayerNames, PlayerColors, PatronColors } from "../types.js";
import { scorePlayer, seatExists } from "../scoring.js";

/**
 * Scene for displaying the final scores and the players' theaters.
 */
export class EndGameScene extends Phaser.Scene {
  constructor() {
    super("EndGameScene");
  }

  /**
   * @param {{ playerCount: number, layout: import('../types.js').LayoutMeta, placedPatrons: (import('../types.js').CardData | null)[][][] }} data
   */
  init(data) {
    this.playerCount = data.playerCount || 2;
    this.layout = data.layout;
    this.placedPatrons = data.placedPatrons;
  }

  create() {
    const { width, height } = this.scale;

    // Full overlay
    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.96)
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
}
