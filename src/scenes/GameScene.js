// @ts-check
import Phaser from "phaser";
import { Card } from "../objects/Card.js";
import {
  createDeck,
  DefaultLayout,
  PatronColors,
  PlayerColors,
  PlayerColorsHex,
  PlayerNames,
} from "../types.js";
import { scorePlayer } from "../scoring.js";

const ROWS = 4;
const COLS = 5;
const SEAT_SIZE = 80;
const SEAT_GAP = 10;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    /** @type {import('../types.js').CardData[]} */
    this.deck = [];

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
  }

  /**
   * @param {{ playerCount?: number }} data
   */
  init(data) {
    this.playerCount = data.playerCount || 2;
    this.currentPlayer = 0;
    this.round = 1;
    this.selectedCard = null;
    this.turnPhase = "pass-screen";
    this.deck = createDeck();
    this.handCards = [];
    this.seatLabels = [];

    // Initialize per-player state
    this.placedPatrons = [];
    this.playerHands = [];
    for (let p = 0; p < this.playerCount; p++) {
      this.placedPatrons[p] = Array.from({ length: ROWS }, () =>
        Array(COLS).fill(null)
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
      .rectangle(width / 2, 0, width, 56, 0x000000)
      .setOrigin(0.5, 0)
      .setDepth(0);

    this.bannerText = this.add
      .text(width / 2, 28, "", {
        fontSize: "22px",
        fontFamily: "Georgia, serif",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(1);

    // ── Stage area ──────────────────────────────────────────────────
    const gridWidth = COLS * (SEAT_SIZE + SEAT_GAP) - SEAT_GAP;
    const gridStartX = (width - gridWidth) / 2;
    const gridStartY = 100;

    this.add
      .rectangle(width / 2, gridStartY - 25, gridWidth + 40, 20, 0x8b4513)
      .setStrokeStyle(1, 0xdaa520);

    this.add
      .text(width / 2, gridStartY - 25, "🎬 STAGE", {
        fontSize: "12px",
        color: "#ffd700",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);

    // ── Row labels ──────────────────────────────────────────────────
    const rowLabels = ["Row A (Front)", "Row B", "Row C", "Row D (Back)"];

    // ── Build theater grid ──────────────────────────────────────────
    for (let row = 0; row < ROWS; row++) {
      this.seatGrid[row] = [];

      this.add
        .text(
          gridStartX - 10,
          gridStartY + row * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2,
          rowLabels[row],
          { fontSize: "11px", color: "#888899", fontFamily: "Arial" }
        )
        .setOrigin(1, 0.5);

      for (let col = 0; col < COLS; col++) {
        const x = gridStartX + col * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2;
        const y = gridStartY + row * (SEAT_SIZE + SEAT_GAP) + SEAT_SIZE / 2;

        const seat = this.add
          .rectangle(x, y, SEAT_SIZE, SEAT_SIZE, 0x1a1a3e)
          .setStrokeStyle(2, 0x3a3a5e)
          .setInteractive({ useHandCursor: true });

        seat.setData("row", row);
        seat.setData("col", col);

        seat.on("pointerover", () => {
          if (
            this.turnPhase === "play" &&
            !this.placedPatrons[this.currentPlayer][row][col] &&
            this.selectedCard
          ) {
            seat.setFillStyle(0x2a2a5e);
            seat.setStrokeStyle(2, 0xf5c518);
          }
        });

        seat.on("pointerout", () => {
          if (!this.placedPatrons[this.currentPlayer][row][col]) {
            seat.setFillStyle(0x1a1a3e);
            seat.setStrokeStyle(2, 0x3a3a5e);
          }
        });

        seat.on("pointerdown", () => {
          if (this.turnPhase === "play") {
            this.placeSeatCard(row, col, seat);
          }
        });

        this.seatGrid[row][col] = seat;
      }
    }

    // ── UI text ─────────────────────────────────────────────────────
    this.turnText = this.add
      .text(width - 30, 70, "", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(1, 0.5);

    this.deckText = this.add
      .text(width - 30, 92, "", {
        fontSize: "14px",
        fontFamily: "Arial",
        color: "#888899",
      })
      .setOrigin(1, 0.5);

    // ── VP Scoreboard ───────────────────────────────────────────────
    this.scoreTexts = [];
    for (let p = 0; p < this.playerCount; p++) {
      const scoreText = this.add
        .text(width - 30, 118 + p * 22, "", {
          fontSize: "14px",
          fontFamily: "Arial",
          color: PlayerColors[p],
        })
        .setOrigin(1, 0.5);
      this.scoreTexts.push(scoreText);
    }

    this.infoText = this.add
      .text(width / 2, height - 25, "", {
        fontSize: "14px",
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
      .rectangle(width / 2, 0, width, 8, colorHex)
      .setOrigin(0.5, 0);
    container.add(accent);

    // Player emoji/icon
    const icons = ["🔵", "🔴", "🟢", "🟠"];
    const icon = this.add
      .text(width / 2, height / 2 - 100, icons[this.currentPlayer], {
        fontSize: "64px",
      })
      .setOrigin(0.5);
    container.add(icon);

    // "Pass to Player X"
    const title = this.add
      .text(width / 2, height / 2 - 20, `${name}'s Turn`, {
        fontSize: "42px",
        fontFamily: "Georgia, serif",
        color: color,
      })
      .setOrigin(0.5);
    container.add(title);

    // Round info
    const roundInfo = this.add
      .text(
        width / 2,
        height / 2 + 40,
        `Round ${this.round} of ${this.totalRounds}  •  Deck: ${this.deck.length} cards`,
        {
          fontSize: "16px",
          fontFamily: "Arial",
          color: "#aaaaaa",
        }
      )
      .setOrigin(0.5);
    container.add(roundInfo);

    // Ready button
    const readyBtn = this.add
      .text(width / 2, height / 2 + 120, "👆 I'm Ready", {
        fontSize: "28px",
        fontFamily: "Georgia, serif",
        color: "#ffffff",
        backgroundColor: "#4a2c7a",
        padding: { x: 30, y: 15 },
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
          const color = PatronColors[cardData.type] || 0x607d8b;
          seat.setFillStyle(color);
          seat.setStrokeStyle(2, 0xffffff, 0.8);

          const emoji = this.add
            .text(seat.x, seat.y - 10, cardData.emoji, { fontSize: "22px" })
            .setOrigin(0.5);

          const label = this.add
            .text(seat.x, seat.y + 18, cardData.type, {
              fontSize: "9px",
              color: "#ffffff",
              fontFamily: "Arial",
            })
            .setOrigin(0.5);

          this.seatLabels.push(emoji, label);
        } else {
          seat.setFillStyle(0x1a1a3e);
          seat.setStrokeStyle(2, 0x3a3a5e);
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // HAND RENDERING
  // ══════════════════════════════════════════════════════════════════

  clearHandVisuals() {
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

    const handStartX = width / 2 - ((handSize - 1) * (Card.WIDTH + 20)) / 2;
    const handY = height - 100;

    for (let i = 0; i < handSize; i++) {
      const cardData = hand[i];
      const x = handStartX + i * (Card.WIDTH + 20);
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
      card.y = targetY + 150;
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
    const color = PatronColors[cardData.type] || 0x607d8b;
    seat.setFillStyle(color);
    seat.setStrokeStyle(2, 0xffffff, 0.8);

    const emoji = this.add
      .text(seat.x, seat.y - 10, cardData.emoji, { fontSize: "22px" })
      .setOrigin(0.5);
    const label = this.add
      .text(seat.x, seat.y + 18, cardData.type, {
        fontSize: "9px",
        color: "#ffffff",
        fontFamily: "Arial",
      })
      .setOrigin(0.5);
    this.seatLabels.push(emoji, label);

    // Placement animation
    this.tweens.add({
      targets: seat,
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

    // Check if 2-player discard is needed
    if (this.playerCount === 2 && this.playerHands[this.currentPlayer].length > 1) {
      this.turnPhase = "discard";
      if (this.infoText) {
        this.infoText.setText("Now discard a card — click one to remove it.");
      }
      // Highlight remaining cards for discard
      for (const c of this.handCards) {
        c.background.setStrokeStyle(3, 0xff4444, 1);
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
      y: card.y + 80,
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

      const { total } = scorePlayer(this.placedPatrons[p], DefaultLayout);
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
      this.bannerText.setText(`🎭 ${name}'s Theater`);
      this.bannerText.setColor(color);
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
      .rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
      .setDepth(300);

    const container = this.add.container(0, 0).setDepth(301);

    // Title
    container.add(
      this.add
        .text(width / 2, 30, "🎭 Show's Over!", {
          fontSize: "36px",
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
      const result = scorePlayer(this.placedPatrons[p], DefaultLayout);
      scores.push(result.total);
      playerScores.push(result);
    }

    // Find winner
    const maxScore = Math.max(...scores);

    // Draw mini theaters for each player
    const miniSeatSize = 22;
    const miniGap = 3;
    const miniGridW = COLS * (miniSeatSize + miniGap) - miniGap;
    const miniGridH = ROWS * (miniSeatSize + miniGap) - miniGap;
    const totalGridsWidth =
      this.playerCount * miniGridW +
      (this.playerCount - 1) * 40;
    const gridsStartX = (width - totalGridsWidth) / 2;

    for (let p = 0; p < this.playerCount; p++) {
      const baseX = gridsStartX + p * (miniGridW + 40);
      const baseY = 120;
      const color = PlayerColors[p];
      const isWinner = scores[p] === maxScore;

      // Player name
      container.add(
        this.add
          .text(baseX + miniGridW / 2, baseY - 30, PlayerNames[p], {
            fontSize: "16px",
            fontFamily: "Georgia, serif",
            color: color,
          })
          .setOrigin(0.5)
      );

      // Score
      const scoreTxt = this.add
        .text(
          baseX + miniGridW / 2,
          baseY - 10,
          `${scores[p]} VP${isWinner ? " 🏆" : ""}`,
          {
            fontSize: "12px",
            fontFamily: "Arial",
            color: isWinner ? "#f5c518" : "#aaaaaa",
          }
        )
        .setOrigin(0.5);
      container.add(scoreTxt);

      // Mini grid
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x = baseX + c * (miniSeatSize + miniGap) + miniSeatSize / 2;
          const y = baseY + 10 + r * (miniSeatSize + miniGap) + miniSeatSize / 2;
          const cardData = this.placedPatrons[p][r][c];

          const seatVP = playerScores[p].perSeat[r][c];
          const seatColor = cardData
            ? PatronColors[cardData.type] || 0x607d8b
            : 0x1a1a3e;

          const rect = this.add
            .rectangle(x, y, miniSeatSize, miniSeatSize, seatColor)
            .setStrokeStyle(
              1,
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
            const e = this.add
              .text(x, y - 4, cardData.emoji, { fontSize: "10px" })
              .setOrigin(0.5);
            container.add(e);

            // Show per-seat VP
            const vpLabel = this.add
              .text(x, y + 7, `${seatVP}`, {
                fontSize: "8px",
                fontFamily: "Arial",
                color: seatVP < 0 ? "#ff6666" : seatVP > 0 ? "#ffffff" : "#888888",
              })
              .setOrigin(0.5);
            container.add(vpLabel);
          }
        }
      }
    }

    // Winner announcement
    const winners = scores
      .map((s, i) => (s === maxScore ? PlayerNames[i] : null))
      .filter(Boolean);
    const winnerMsg =
      winners.length > 1
        ? `It's a tie! ${winners.join(" & ")}`
        : `${winners[0]} wins!`;

    container.add(
      this.add
        .text(width / 2, baseYForButton(this.playerCount), winnerMsg, {
          fontSize: "28px",
          fontFamily: "Georgia, serif",
          color: "#f5c518",
        })
        .setOrigin(0.5)
    );

    // Play again button
    const restartBtn = this.add
      .text(
        width / 2,
        baseYForButton(this.playerCount) + 50,
        "▶  Play Again",
        {
          fontSize: "24px",
          fontFamily: "Georgia, serif",
          color: "#ffffff",
          backgroundColor: "#4a2c7a",
          padding: { x: 20, y: 10 },
        }
      )
      .setOrigin(0.5)
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

/**
 * Helper: Y position for the winner text based on player count.
 * @param {number} playerCount
 * @returns {number}
 */
function baseYForButton(playerCount) {
  // Mini grids end around y=230. Give space below.
  return 280;
}
