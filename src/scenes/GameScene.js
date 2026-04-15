// @ts-check
import Phaser from "phaser";
import { pickCardAndSeat, pickDrawAction } from "../ai.js";
import { px, s } from "../config.js";
import { ActivePlayerAvatar } from "../objects/ActivePlayerAvatar.js";
import { createButton } from "../factories/Button.js";
import { createLogo } from "../factories/Logo.js";
import { Card } from "../objects/Card.js";
import { DrawReminderBanner } from "../objects/DrawReminderBanner.js";
import { GameInfoPanel } from "../objects/GameInfoPanel.js";
import { SpeechBubble } from "../objects/SpeechBubble.js";
import { TheaterGrid } from "../objects/TheaterGrid.js";
import { ProgressBar } from "../objects/ProgressBar.js";
import { scorePlayer, scoreSeatBreakdown } from "../scoring.js";
import {
    createDeck,
    GrandEmpressLayout,
    LayoutOrder,
    Layouts,
    PatronInfo,
    PatronType,
    PatronTypeOrder,
    PlayerColors,
    PlayerColorsHex,
    PlayerNames,
    Trait,
    TraitInfo,
    TraitOrder,
} from "../types.js";

const ENV = /** @type {{ VITE_DEBUG_AI?: string }} */ ((/** @type {any} */ (import.meta)).env ?? {});

const AI_TURN_START_DELAY_MS = 520;
const AI_ACTION_PAUSE_MS = 210;

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
        /** @type {TheaterGrid | null} */
        this.theaterGrid = null;

        /** @type {Phaser.GameObjects.Container | null} */
        this.passOverlay = null;

        /** @type {GameInfoPanel | null} */
        this.gameInfoPanel = null;

        /** @type {ActivePlayerAvatar | null} */
        this.activePlayerAvatar = null;

        /** @type {Phaser.GameObjects.Container | null} */
        this.deckPileImage = null;

        /** @type {SpeechBubble | null} */
        this.scoringTooltip = null;

        /** @type {SpeechBubble | null} */
        this.seatScoreTooltip = null;

        /** @type {DrawReminderBanner | null} */
        this.drawReminderBanner = null;

        /** @type {import('../types.js').CardData[]} */
        this.lobbyCards = [];

        /** @type {Card[]} */
        this.lobbyCardVisuals = [];

        /** @type {Phaser.GameObjects.GameObject[]} */
        this.lobbyBarrierVisuals = [];

        /** @type {number} */
        this.maxCardsInHand = 0;

        /** @type {number[]} */
        this.playerColorMap = [];

        /**
         * AI config per player slot: null = human, string = AI difficulty.
         * @type {(string | null)[]}
         */
        this.aiConfig = [];

        /** @type {boolean} */
        this.isDrawAnimating = false;
    }

    // ── Color mapping helpers ──────────────────────────────────────────

    /** @type {string[]} */
    static USHER_KEYS = ["usher_blue", "usher_red", "usher_green", "usher_orange"];

    /** Get the color index for a player slot. */
    colorOf(/** @type {number} */ p) {
        return this.playerColorMap[p] ?? p;
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
        const progressBar = new ProgressBar(this, width / 2, height / 2, barW, barH);

        this.load.on("progress", (/** @type {number} */ value) => {
            progressBar.updateProgress(value, barW);
        });

        this.load.on("complete", () => {
            this.time.delayedCall(s(200), () => {
                progressBar.destroy();
            });
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
        for (const type of PatronTypeOrder) {
            const info = PatronInfo[type];
            loadIfMissing(info.assetKey, info.assetPath);
        }

        // ── Trait badges ────────────────────────────────────────────────
        for (const trait of TraitOrder) {
            const info = TraitInfo[trait];
            loadIfMissing(info.badgeAssetKey, info.badgeAssetPath);
        }

        // ── Seat tags ──────────────────────────────────────────────────────────
        loadIfMissing("tag_royal_box", "assets/tag_royal_box.png");

        // ── Only the selected theater background (JPEG) ─────────────────
        loadIfMissing(this.layout.bgKey, `assets/${this.layout.bgKey}.jpg`);

        // ── Game UI assets ──────────────────────────────────────────────
        loadIfMissing("card_back", "assets/card_back.png");
        loadIfMissing("ui_stage", "assets/ui_stage.png");
        loadIfMissing("ui_logo", "assets/ui_logo.png");
        loadIfMissing("ui_button_frame", "assets/ui_button_frame.png");
        loadIfMissing("usher_blue", "assets/usher_blue.png");
        loadIfMissing("usher_red", "assets/usher_red.png");
        loadIfMissing("usher_green", "assets/usher_green.png");
        loadIfMissing("usher_orange", "assets/usher_orange.png");
        loadIfMissing("ui_brass_stanchion", "assets/ui_brass_stanchion.png");
    }

    /**
     * @param {{ playerCount?: number, layoutId?: string, aiConfig?: (string | null)[], playerColorMap?: number[] }} data
     */
    init(data) {
        const requestedLayoutId = data?.layoutId ?? "";
        this.layout = Layouts[requestedLayoutId] || GrandEmpressLayout;
        this.playerCount = data.playerCount || 2;
        this.maxCardsInHand = this.playerCount === 2 ? 3 : 2;
        this.currentPlayer = 0;
        this.round = 1;
        this.selectedCard = null;
        this.turnPhase = "pass-screen";
        this.isDrawAnimating = false;
        this.deck = createDeck();
        this.handCards = [];
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

        this.theaterGrid = null;
        this.gameInfoPanel = null;
        this.activePlayerAvatar = null;
        this.deckPileImage = null;
        this.scoringTooltip = null;
        this.seatScoreTooltip = null;
    }

    setupDebug() {
        // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
        this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log("DEBUG: Skipping to end screen");
            this.turnPhase = "game-over";
            this.endGame();
        });

        // ── DEV DEBUG CYCLE (Shift+S) — cycle without Title/Game ───────
        this.input.keyboard?.on("keydown-S", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log("DEBUG: Cycle skip to EndGameScene");
            this.turnPhase = "game-over";
            this.endGame();
        });

        // ── DEV DEBUG HAND (Shift+H) — one of each patron + one of each trait
        this.input.keyboard?.on("keydown-H", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log("DEBUG: Dealing debug hand (all types + all traits)");
            const hand = this.playerHands[this.currentPlayer];
            hand.length = 0;

            // One card per patron type (no trait)
            for (const type of Object.values(PatronType)) {
                const info = PatronInfo[type];
                hand.push({
                    type,
                    label: type,
                    description: info.description,
                });
            }

            // One Standard card per trait
            const baseType = PatronType.STANDARD;
            const baseInfo = PatronInfo[baseType];
            for (const trait of Object.values(Trait)) {
                const tInfo = TraitInfo[trait];
                hand.push({
                    type: baseType,
                    trait,
                    label: `${trait} ${baseType}`,
                    description: `${baseInfo.description} ${tInfo.description}`,
                });
            }

            // Clear visible hand and re-render
            for (const c of this.handCards) {
                c.destroy();
            }
            this.handCards = [];
            this.renderHand();
        });

        // ── DEV DEBUG THEATER CYCLE (Shift+T) ─────────────────────────
        this.input.keyboard?.on("keydown-T", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            const curIdx = LayoutOrder.indexOf(this.layout.id);
            const nextIdx = (curIdx + 1) % LayoutOrder.length;
            const nextId = LayoutOrder[nextIdx];
            console.log(`DEBUG: Cycling theater → ${Layouts[nextId].name}`);
            this.scene.restart({
                layoutId: nextId,
                playerCount: this.playerCount,
                aiConfig: this.aiConfig,
                playerColorMap: this.playerColorMap,
            });
        });
    }

    create() {
        const { width, height } = this.scale;

        this.setupDebug();

        this.theaterGrid = new TheaterGrid(this, {
            layout: this.layout,
            onSeatPointerOver: (row, col, seat) => this.handleSeatPointerOver(row, col, seat),
            onSeatPointerOut: (row, col, seat) => this.handleSeatPointerOut(row, col, seat),
            onSeatPointerDown: (row, col, seat) => this.handleSeatPointerDown(row, col, seat),
        });

        const { gridStartY } = this.theaterGrid.build();

        // ── Full Background Fill ──────────────────────────────────────────────
        // Ensure we cover the TitleScene/other scenes since theater floor is masked
        this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a).setDepth(-1);

        // ── HUD Panel (Game Information) ────────────────────────────────
        const hudW = s(260);
        const hudX = width - hudW - s(20);
        this.gameInfoPanel = new GameInfoPanel(this, hudX, gridStartY, {
            width: hudW,
            playerCount: this.playerCount,
            houseRuleDescription: this.layout.houseRuleDescription,
            playerColor: (p) => this.playerColor(p),
            playerColorHex: (p) => this.playerColorHex(p),
            usherKey: (p) => this.usherKey(p),
        });

        // ── Lobby ─────────────────────────────────────────────────────
        this.lobbyCards = [];
        this.lobbyCardVisuals = [];

        // ── Active Player Large Avatar ──────────────────────────────────
        this.activePlayerAvatar = new ActivePlayerAvatar(
            this,
            width - s(90),
            height - s(90),
            {
                usherKey: this.usherKey(0),
                colorHex: this.playerColorHex(0),
                color: "#ffffff",
                playerNumber: 1,
            },
        );

        // Global deselect background click
        this.input.on(
            "pointerdown",
            (/** @type {any} */ _pointer, /** @type {any[]} */ gameObjects) => {
                if (gameObjects.length !== 0) {
                    return;
                }
                if (this.selectedCard) {
                    this.selectedCard.setSelected(false);
                    this.selectedCard = null;
                    this.hideScoringTooltip();
                }
                this.hideSeatScoreTooltip();
            },
        );

        // ── Logo ────────────────────────────────────────────────────────
        // Centered at s(80) to perfectly align vertically with the player avatar
        createLogo(this, s(120), s(60), { width: 220, depth: 150 });

        // ── Start with pass screen for player 1 ─────────────────────────
        this.showPassScreen();
    }

    // ══════════════════════════════════════════════════════════════════
    // PASS SCREEN — shown between every player's turn
    // ══════════════════════════════════════════════════════════════════

    showPassScreen() {
        this.turnPhase = "pass-screen";
        this.hideSeatScoreTooltip();

        // Skip the pass screen for AI players, and for the sole human in an AI game
        const isAI = !!this.aiConfig[this.currentPlayer];
        const soloHuman = !isAI &&
            this.aiConfig.filter((a, i) => i < this.playerCount && !a).length === 1;
        if (isAI || soloHuman) {
            this.clearHandVisuals();
            this.time.delayedCall(isAI ? 400 : 0, () => this.startTurn());
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
            this,
            width / 2,
            height / 2 + s(160),
            "I'm Ready",
            { fontSize: 20 },
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
        // Initialize lobby if empty
        this.fillLobby();

        // Render the current player's theater and hand
        this.renderTheater();
        this.updateUI();
        this.updateScoreboard();
        this.renderHand();

        // AI players: auto-play their turn
        if (this.aiConfig[this.currentPlayer]) {
            this.turnPhase = "play";
            this.time.delayedCall(AI_TURN_START_DELAY_MS, () => this.playAITurn());
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
     * First, fills the hand to max capacity using drawing logic, then places/discards.
     */
    async playAITurn() {
        const difficulty = this.aiConfig[this.currentPlayer];
        if (!difficulty) {
            return;
        }

        const grid = this.placedPatrons[this.currentPlayer];

        // Create a sequence of AI actions to avoid instant jumps
        /**
         * @typedef {{ type: 'draw', decision: { source: 'lobby' | 'deck', index?: number } }
         *   | { type: 'select' | 'place', decision: { cardData: import('../types.js').CardData, row: number, col: number } }
         *   | { type: 'discard', decision: { cardData: import('../types.js').CardData } }} AIAction
         */
        /** @type {AIAction[]} */
        const actions = [];

        // ── Drawing Phase ────────────────────────────────────────────
        // Determine all needed draws first using simulated state (do not mutate live arrays).
        const tempHand = [...this.playerHands[this.currentPlayer]];
        const tempLobby = [...this.lobbyCards];
        let tempDeckCount = this.deck.length;

        while (tempHand.length < this.maxCardsInHand) {
            const action = pickDrawAction(
                tempLobby,
                tempDeckCount,
                difficulty,
                grid,
                this.layout,
            );

            if (!action) {
                break;
            }

            const { source, index: lobbyIdx } = action;
            if (ENV.VITE_DEBUG_AI === "true") {
                console.log(
                    `[AI DEBUG] Action ${actions.length + 1}: Draw from ${source}${
                        source === "lobby" ? ` index ${lobbyIdx}` : ""
                    }`,
                );
            }

            /** @type {import('../types.js').CardData | null} */
            let simulatedDrawn = null;

            if (source === "lobby" && lobbyIdx !== undefined) {
                const lobbyCard = tempLobby[lobbyIdx];
                if (lobbyCard) {
                    simulatedDrawn = lobbyCard;
                    tempHand.push(simulatedDrawn);
                    tempLobby.splice(lobbyIdx, 1);

                    if (tempDeckCount > 0) {
                        const refill = this.deck[tempDeckCount - 1];
                        tempDeckCount -= 1;
                        if (refill) {
                            tempLobby.unshift(refill);
                        }
                    }

                    actions.push({ type: "draw", decision: { source: "lobby", index: lobbyIdx } });
                }
            } else if (source === "deck" && tempDeckCount > 0) {
                const deckTop = this.deck[tempDeckCount - 1];
                tempDeckCount -= 1;
                if (deckTop) {
                    simulatedDrawn = deckTop;
                    tempHand.push(simulatedDrawn);
                    actions.push({ type: "draw", decision: { source: "deck" } });
                }
            }

            if (simulatedDrawn && ENV.VITE_DEBUG_AI === "true") {
                console.log(`[AI DEBUG] Planned draw from ${source}: ${simulatedDrawn.label || simulatedDrawn.type}`);
            }
        }

        // Determine placement/discard action.
        if (tempHand.length > 0) {
            const playAndDiscard = pickCardAndSeat(
                grid,
                tempHand,
                this.playerCount,
                this.layout,
                difficulty,
            );

            if (playAndDiscard) {
                actions.push({ type: "select", decision: playAndDiscard.play });
                actions.push({ type: "place", decision: playAndDiscard.play });
                // for 2 players then there will be a discard too
                if (playAndDiscard.discard) {
                    actions.push({ type: "discard", decision: playAndDiscard.discard });
                }
            }
        }

        // Execute actions sequentially.
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            const isLast = i === actions.length - 1;

            switch (action.type) {
                case "draw": {
                    if (action.decision.source === "lobby" && action.decision.index !== undefined) {
                        await this.drawFromLobby(action.decision.index);
                    } else {
                        await this.drawFromDeck();
                    }
                    break;
                }
                case "select": {
                    const { cardData } = action.decision;
                    for (const card of this.handCards) {
                        if (card.cardData.label === cardData.label) {
                            this.selectCard(card);
                        }
                    }
                    break;
                }
                case "place": {
                    const { cardData, row, col } = action.decision;

                    if (ENV.VITE_DEBUG_AI === "true") {
                        console.log(
                            `[AI DEBUG] Action ${i}: Place ${cardData.label || cardData.type} at (${row}, ${col})`,
                        );
                    }

                    this.placeSeatCard(row, col);
                    break;
                }
                case "discard": {
                    const { cardData } = action.decision;
                    if (ENV.VITE_DEBUG_AI === "true") {
                        console.log(`[AI DEBUG] Discarding: ${cardData.label || cardData.type}`);
                    }

                    for (const card of this.handCards) {
                        if (card.cardData.label === cardData.label) {
                            this.discardCard(card);
                        }
                    }
                    break;
                }
            }

            if (!isLast) {
                await this.waitMs(AI_ACTION_PAUSE_MS);
            } else if (ENV.VITE_DEBUG_AI === "true") {
                console.log(`[AI DEBUG] Turn complete for player ${this.currentPlayer}. Advancing...`);
            }
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // THEATER RENDERING — show current player's grid
    // ══════════════════════════════════════════════════════════════════

    renderTheater() {
        const grid = this.placedPatrons[this.currentPlayer];
        this.hideSeatScoreTooltip();
        this.theaterGrid?.renderTheater(grid);
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    handleSeatPointerOver(row, col, seat) {
        const occupied = !!this.placedPatrons[this.currentPlayer]?.[row]?.[col];
        if (occupied) {
            this.showSeatScoreTooltip(row, col, seat);
            return;
        }

        if (this.turnPhase === "play" && this.selectedCard) {
            seat.setFillStyle(0x2a2a5e);
            seat.setStrokeStyle(s(2), 0xf5c518);
        }
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    handleSeatPointerOut(row, col, seat) {
        const occupied = !!this.placedPatrons[this.currentPlayer]?.[row]?.[col];
        if (occupied) {
            this.hideSeatScoreTooltip();
            return;
        }

        const emptyFill = seat.getData("emptyFill") ?? 0x1a1a3e;
        const emptyStroke = seat.getData("emptyStroke") ?? 0x3a3a5e;
        const strokeWidth = seat.getData("strokeWidth") ?? s(2);
        seat.setFillStyle(emptyFill);
        seat.setStrokeStyle(strokeWidth, emptyStroke);
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    handleSeatPointerDown(row, col, seat) {
        const occupied = !!this.placedPatrons[this.currentPlayer]?.[row]?.[col];
        if (occupied) {
            // Mobile/touch fallback for hover-driven tooltip.
            this.showSeatScoreTooltip(row, col, seat);
            return;
        }

        if (this.turnPhase === "play") {
            this.placeSeatCard(row, col);
        }
    }

    /** @param {string} text */
    strikeFallback(text) {
        return `~~${text}~~`;
    }

    /**
     * @param {number} value
     */
    formatSigned(value) {
        return `${value >= 0 ? "+" : ""}${value}`;
    }

    /**
     * @param {number} row
     * @param {number} col
     */
    getSeatScoreTooltipText(row, col) {
        const grid = this.placedPatrons[this.currentPlayer];
        const card = grid[row]?.[col];
        if (!card) {
            return null;
        }

        const breakdown = scoreSeatBreakdown(grid, row, col, this.layout);
        const lines = [`Base: ${this.formatSigned(breakdown.base)} VP`];

        for (const mod of breakdown.modifiers) {
            const line = `${this.formatSigned(mod.value)} VP ${mod.label}`;
            if (mod.applied) {
                lines.push(line);
            } else {
                const why = mod.reason ? ` (nullified: ${mod.reason})` : " (nullified)";
                lines.push(`${this.strikeFallback(line)}${why}`);
            }
        }

        lines.push(`Total: ${this.formatSigned(breakdown.total)} VP`);
        return {
            title: card.label,
            hint: lines.join("\n"),
        };
    }

    /**
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    showSeatScoreTooltip(row, col, seat) {
        const tooltip = this.getSeatScoreTooltipText(row, col);
        if (!tooltip) {
            return;
        }

        this.hideSeatScoreTooltip();
        this.seatScoreTooltip = new SpeechBubble(this, seat, tooltip.title, tooltip.hint, {
            width: 250,
            height: 108,
            gap: 4,
        });

        this.seatScoreTooltip.setAlpha(0);
        this.tweens.add({
            targets: this.seatScoreTooltip,
            alpha: 1,
            duration: 130,
            ease: "Sine.easeOut",
        });
    }

    hideSeatScoreTooltip() {
        if (this.seatScoreTooltip) {
            this.seatScoreTooltip.destroy();
            this.seatScoreTooltip = null;
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // HAND RENDERING
    // ══════════════════════════════════════════════════════════════════

    clearHandVisuals() {
        this.hideScoringTooltip();
        this.hideSeatScoreTooltip();
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
        if (handSize === 0) {
            return;
        }

        const handStartX = width / 2 - ((handSize - 1) * (Card.WIDTH + s(20))) / 2;
        const handY = height - s(100);

        // AI turn check: if current player is AI, cards are not interactive
        const isAI = !!this.aiConfig[this.currentPlayer];

        for (let i = 0; i < handSize; i++) {
            const cardData = hand[i];
            const x = handStartX + i * (Card.WIDTH + s(20));
            const card = new Card(this, x, handY, cardData);

            if (!isAI) {
                card.on("pointerdown", () => {
                    if (this.turnPhase === "discard") {
                        this.discardCard(card);
                    } else {
                        this.selectCard(card);
                    }
                });
            }

            // Always show scoring tooltip on hover
            card.on("pointerover", () => {
                this.showScoringTooltip(card);
            });

            card.on("pointerout", () => {
                if (this.selectedCard) {
                    this.showScoringTooltip(this.selectedCard);
                } else {
                    this.hideScoringTooltip();
                }
            });

            this.handCards.push(card);
        }
    }

    // ══════════════════════════════════════════════════════════════════
    // CARD SELECTION & PLACEMENT
    // ══════════════════════════════════════════════════════════════════

    /**
     * Returns whether this player can still draw at least one legal card this turn.
     */
    canStillDrawThisTurn() {
        const hand = this.playerHands[this.currentPlayer] ?? [];
        if (hand.length >= this.maxCardsInHand) {
            return false;
        }

        if (this.deck.length > 0) {
            if (this.lobbyCards.length > 1) {
                return true;
            }
            return true; // can always draw from deck while it has cards
        }

        // Deck empty: frozen slot unlocks, so any remaining lobby card is drawable.
        return this.lobbyCards.length > 0;
    }

    /**
     * @param {Card} card
     */
    selectCard(card) {
        const hand = this.playerHands[this.currentPlayer];
        const handIsFull = hand.length === this.maxCardsInHand;
        if (this.turnPhase === "play" && !handIsFull && this.canStillDrawThisTurn()) {
            this.showDrawReminderBanner();
            return;
        }
        this.hideSeatScoreTooltip();
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

        let hint = PatronInfo[card.cardData.type]?.scoringHint || "";
        if (card.cardData.trait) {
            const traitHint = TraitInfo[card.cardData.trait]?.scoringHint;
            if (traitHint) {
                hint = hint ? `${hint}\n${traitHint}` : traitHint;
            }
        }
        if (!card.cardData.label && !hint) {
            return;
        }

        this.scoringTooltip = new SpeechBubble(this, card, card.cardData.label, hint);
        //this.scoringTooltip.setDepth(200); // Ensure it is above everything

        // Fade in
        this.scoringTooltip.setAlpha(0);
        this.tweens.add({
            targets: this.scoringTooltip,
            alpha: 1,
            duration: 150,
            ease: "Sine.easeOut",
        });
    }

    /**
     * Show a notification banner in the middle of the screen
     * when the player tries to select a card with an incomplete hand.
     */
    showDrawReminderBanner() {
        // Remove existing banner first, if present
        if (this.drawReminderBanner) {
            this.drawReminderBanner.destroy();
            this.drawReminderBanner = null;
        }

        if (!this.canStillDrawThisTurn()) {
            return;
        }

        const { width, height } = this.scale;
        let msg;
        if (this.playerCount === 2) {
            const currentHand = this.playerHands[this.currentPlayer] || [];
            const needed = this.maxCardsInHand - currentHand.length;
            msg = needed === 2 ? "You must draw two cards first" : "You must draw a card first";
        } else {
            msg = "You must draw a card first";
        }
        // Use DrawReminderBanner game object
        const banner = new DrawReminderBanner(this, width / 2, height / 2, msg);
        this.add.existing(banner);
        this.drawReminderBanner = banner; // Banner will self-destroy after its duration.
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
     */
    placeSeatCard(row, col) {
        if (!this.selectedCard) {
            return;
        }
        // Seat already occupied
        if (this.placedPatrons[this.currentPlayer][row][col]) {
            return;
        }

        const seat = this.theaterGrid?.getSeat(row, col);
        if (!seat || !this.theaterGrid) {
            return;
        }

        const cardData = this.selectedCard.cardData;
        // Update logical state
        this.placedPatrons[this.currentPlayer][row][col] = cardData;
        this.hideSeatScoreTooltip();
        this.theaterGrid.renderPlacedCardOnSeat(seat, cardData, { animate: true });
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
    // LOBBY LOGIC — shared market of 3 cards
    // ══════════════════════════════════════════════════════════════════

    getLobbyMetrics() {
        return {
            deckX: s(130),
            deckY: s(250),
            gap: s(20),
        };
    }

    /**
     * @param {number} lobbyIndex
     */
    getLobbySlotPosition(lobbyIndex) {
        const { deckX, deckY, gap } = this.getLobbyMetrics();
        return {
            x: deckX,
            y: deckY + (lobbyIndex + 1) * (Card.HEIGHT + gap),
        };
    }

    getNextHandSlotPosition() {
        const { width, height } = this.scale;
        const handSizeAfterDraw = this.playerHands[this.currentPlayer].length + 1;
        const handStartX = width / 2 - ((handSizeAfterDraw - 1) * (Card.WIDTH + s(20))) / 2;

        return {
            x: handStartX + (handSizeAfterDraw - 1) * (Card.WIDTH + s(20)),
            y: height - s(100),
        };
    }

    clearLobbyBarrierVisuals() {
        for (const v of this.lobbyBarrierVisuals) {
            v.destroy();
        }
        this.lobbyBarrierVisuals = [];
    }

    /**
     * Theater-style decorative barrier for the locked lobby slot (index 0).
     * @param {number} cardX
     * @param {number} cardY
     */
    renderLockedLobbyBarrier(cardX, cardY) {
        if (!this.textures.exists("ui_brass_stanchion")) {
            return;
        }

        const stanchionTexture = this.textures.get("ui_brass_stanchion").getSourceImage();
        const targetStanchionHeight = Card.HEIGHT / 2;
        const stanchionScale = targetStanchionHeight / stanchionTexture.height;
        const stanchionDisplayW = stanchionTexture.width * stanchionScale;

        const cardBottomY = cardY + Card.HEIGHT / 2;
        const stanchionY = cardBottomY - targetStanchionHeight / 2 + s(2);
        const stanchionInset = s(5);

        const leftX = cardX - Card.WIDTH / 2 - stanchionDisplayW * 0.2 + stanchionInset;
        const rightX = cardX + Card.WIDTH / 2 + stanchionDisplayW * 0.2 - stanchionInset;

        const leftStanchion = this.add.image(leftX, stanchionY, "ui_brass_stanchion");
        leftStanchion.setDisplaySize(stanchionDisplayW, targetStanchionHeight);
        leftStanchion.setDepth(171);

        const rightStanchion = this.add.image(rightX, stanchionY, "ui_brass_stanchion");
        rightStanchion.setDisplaySize(stanchionDisplayW, targetStanchionHeight);
        rightStanchion.setFlipX(true);
        rightStanchion.setDepth(171);

        const stanchionTopY = cardBottomY - targetStanchionHeight;
        const ropeAnchorY = stanchionTopY + s(18);
        const leftAnchorX = leftX + stanchionDisplayW * 0.15 + s(2);
        const rightAnchorX = rightX - stanchionDisplayW * 0.15 - s(2);
        const ropeSag = s(18);

        const ropeCurve = new Phaser.Curves.QuadraticBezier(
            new Phaser.Math.Vector2(leftAnchorX, ropeAnchorY),
            new Phaser.Math.Vector2((leftAnchorX + rightAnchorX) / 2, ropeAnchorY + ropeSag),
            new Phaser.Math.Vector2(rightAnchorX, ropeAnchorY),
        );
        const ropePoints = ropeCurve.getPoints(40);

        const ropeShadow = this.add.graphics();
        ropeShadow.lineStyle(s(10), 0x2b0708, 0.5);
        ropeShadow.strokePoints(ropePoints.map((p) => new Phaser.Math.Vector2(p.x, p.y + s(2))), false, false);
        ropeShadow.setDepth(172);

        const ropeBase = this.add.graphics();
        ropeBase.lineStyle(s(8), 0x4d0d0f, 1);
        ropeBase.strokePoints(ropePoints, false, false);
        ropeBase.setDepth(173);

        const ropeHighlight = this.add.graphics();
        ropeHighlight.lineStyle(s(3), 0x8f3033, 0.7);
        ropeHighlight.strokePoints(ropePoints.map((p) => new Phaser.Math.Vector2(p.x, p.y - s(2))), false, false);
        ropeHighlight.setDepth(174);

        this.lobbyBarrierVisuals.push(leftStanchion, rightStanchion, ropeShadow, ropeBase, ropeHighlight);
    }

    /** @param {number} ms */
    waitMs(ms) {
        return new Promise((resolve) => {
            this.time.delayedCall(ms, () => resolve(null));
        });
    }

    /**
     * @param {import('../types.js').CardData} cardData
     * @param {number} sourceX
     * @param {number} sourceY
     */
    async animateLobbyDrawToHand(cardData, sourceX, sourceY) {
        const pickupScale = 1.14;
        const travelScale = 1.08;
        const target = this.getNextHandSlotPosition();

        const animCard = new Card(this, sourceX, sourceY, cardData);
        animCard.disableInteractive();
        animCard.setDepth(500);

        await new Promise((resolve) => {
            this.tweens.add({
                targets: animCard,
                scaleX: pickupScale,
                scaleY: pickupScale,
                y: sourceY - s(16),
                duration: 110,
                ease: "Back.easeOut",
                onComplete: () => resolve(null),
            });
        });

        await new Promise((resolve) => {
            this.tweens.add({
                targets: animCard,
                x: target.x,
                y: target.y,
                scaleX: travelScale,
                scaleY: travelScale,
                duration: 230,
                ease: "Cubic.easeInOut",
                onComplete: () => resolve(null),
            });
        });

        animCard.destroy();
    }

    /**
     * @param {import('../types.js').CardData} cardData
     * @param {number} targetX
     * @param {number} targetY
     * @param {{ travelScale?: number }} [options]
     */
    async animateDeckFlipToPosition(cardData, targetX, targetY, { travelScale = 1.08 } = {}) {
        const pickupScale = 1.14;
        const { deckX, deckY } = this.getLobbyMetrics();

        const back = this.add.container(deckX, deckY);
        back.setDepth(165);

        const backBorder = this.add
            .rectangle(0, 0, Card.WIDTH, Card.HEIGHT, 0x000000)
            .setStrokeStyle(s(2), 0x000000, 0.7);
        const backImage = this.add.image(0, 0, "card_back").setDisplaySize(Card.WIDTH, Card.HEIGHT);
        back.add([backBorder, backImage]);

        await new Promise((resolve) => {
            this.tweens.add({
                targets: back,
                scaleX: pickupScale,
                scaleY: pickupScale,
                duration: 70,
                ease: "Sine.easeOut",
                onComplete: () => resolve(null),
            });
        });

        await new Promise((resolve) => {
            this.tweens.add({
                targets: back,
                scaleX: 0,
                duration: 120,
                ease: "Sine.easeIn",
                onComplete: () => resolve(null),
            });
        });

        const faceCard = new Card(this, deckX, deckY, cardData);
        faceCard.disableInteractive();
        faceCard.setDepth(165);
        faceCard.setScale(0, pickupScale);
        back.destroy();

        await new Promise((resolve) => {
            this.tweens.add({
                targets: faceCard,
                scaleX: pickupScale,
                duration: 140,
                ease: "Sine.easeOut",
                onComplete: () => resolve(null),
            });
        });

        await new Promise((resolve) => {
            this.tweens.add({
                targets: faceCard,
                x: targetX,
                y: targetY,
                scaleX: travelScale,
                scaleY: travelScale,
                duration: 230,
                ease: "Cubic.easeInOut",
                onComplete: () => resolve(null),
            });
        });

        faceCard.destroy();
    }

    /**
     * @param {import('../types.js').CardData} cardData
     */
    async animateDeckDrawToHand(cardData) {
        const target = this.getNextHandSlotPosition();
        await this.animateDeckFlipToPosition(cardData, target.x, target.y, { travelScale: 1.08 });
    }

    /**
     * @param {import('../types.js').CardData} cardData
     */
    async animateDeckRefillToLobby(cardData) {
        const target = this.getLobbySlotPosition(0);
        await this.animateDeckFlipToPosition(cardData, target.x, target.y, { travelScale: 1.0 });
    }

    /**
     * @param {number} drawnIndex
     * @param {boolean} willRefill
     */
    async animateLobbyShiftAfterDraw(drawnIndex, willRefill) {
        /** @type {Promise<null>[]} */
        const animations = [];

        for (let i = 0; i < this.lobbyCardVisuals.length; i++) {
            if (i === drawnIndex) {
                continue;
            }

            const card = this.lobbyCardVisuals[i];
            if (!card || !card.active || !card.visible) {
                continue;
            }

            let targetIndex = i;
            if (willRefill) {
                // EVERYONE moves down 1 slot because a new card enters at index 0
                targetIndex = i + 1;

                // But the card that was drawn is already "gone" (invisible),
                // so if i was the drawn card, it doesn't move.
                // But we already skip i === drawnIndex at the top of the loop.

                // If we are moving a card that is ABOVE the drawn card,
                // it still moves down 1.
                // If we are moving a card that is BELOW the drawn card,
                // it moves down 1 (for the refill) but then effectively stays
                // in the same relative slot because one card was removed.
                if (i > drawnIndex) {
                    targetIndex = i;
                }
            } else if (i > drawnIndex) {
                targetIndex = i - 1;
            }
            const target = this.getLobbySlotPosition(targetIndex);

            animations.push(
                new Promise((resolve) => {
                    this.tweens.add({
                        targets: card,
                        x: target.x,
                        y: target.y,
                        duration: 230,
                        ease: "Cubic.easeInOut",
                        onComplete: () => resolve(null),
                    });
                }),
            );
        }

        await Promise.all(animations);
    }

    /**
     * Initial fills the lobby to 3 cards.
     */
    fillLobby() {
        while (this.lobbyCards.length < 3 && this.deck.length > 0) {
            const drawn = this.deck.pop();
            if (drawn) {
                this.lobbyCards.push(drawn);
            }
        }

        this.renderLobby();
    }

    /**
     * Renders the lobby cards on the left of the screen.
     */
    renderLobby() {
        // Clear old visuals
        for (const v of this.lobbyCardVisuals) {
            v.destroy();
        }
        this.lobbyCardVisuals = [];
        this.clearLobbyBarrierVisuals();

        const { deckX, deckY } = this.getLobbyMetrics();
        // Stack regular Image objects to form a card pile.
        const PILE_LAYERS = 10;
        const pileOffset = s(-1);

        this.deckPileImage = this.add.container(deckX, deckY);
        for (let i = 0; i < PILE_LAYERS; i++) {
            const ox = i * pileOffset;
            const oy = i * pileOffset;
            const background = this.add
                .rectangle(ox, oy, Card.WIDTH, Card.HEIGHT, 0x000000)
                .setStrokeStyle(s(2), 0x000000, 0.7);

            const image = this.add.image(ox, oy, "card_back");
            image.setDisplaySize(Card.WIDTH, Card.HEIGHT);

            /** @type {Phaser.GameObjects.GameObject[]} */
            const children = [background, image];

            this.deckPileImage.add(children);
        }
        this.deckPileImage.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(
                -Card.WIDTH / 2 - s(PILE_LAYERS),
                -Card.HEIGHT / 2 - s(PILE_LAYERS),
                Card.WIDTH + s(PILE_LAYERS),
                Card.HEIGHT + s(PILE_LAYERS),
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
        });
        this.deckPileImage.on("pointerdown", () => {
            void this.drawFromDeck();
        });

        // Draw lobby cards
        for (let i = 0; i < this.lobbyCards.length; i++) {
            const data = this.lobbyCards[i];
            if (!data) {
                continue;
            }
            const slot = this.getLobbySlotPosition(i);

            // use deckX so they are all aligned with the deck
            const card = new Card(this, slot.x, slot.y, data);
            card.setDepth(160); // Ensure they are above everything else

            const isAI = !!this.aiConfig[this.currentPlayer];

            card.on("pointerover", () => {
                this.showScoringTooltip(card);
            });
            card.on("pointerout", () => {
                if (this.selectedCard) {
                    this.showScoringTooltip(this.selectedCard);
                } else {
                    this.hideScoringTooltip();
                }
            });

            const slotZeroLocked = i === 0 && this.deck.length > 0;
            if (slotZeroLocked) {
                card.setInteractive(false);
                this.renderLockedLobbyBarrier(slot.x, slot.y);
            } else if (!isAI) {
                card.on("pointerdown", () => {
                    void this.drawFromLobby(i);
                });
            }

            this.lobbyCardVisuals.push(card);
        }
    }

    /**
     * Handles picking a card from the lobby.
     * @param {number} index
     */
    async drawFromLobby(index) {
        if (this.turnPhase !== "play" || this.isDrawAnimating) {
            return false;
        }

        const hand = this.playerHands[this.currentPlayer];
        // hand is full
        if (hand.length === this.maxCardsInHand) {
            return false;
        }

        if (index === 0 && this.deck.length > 0) {
            return false;
        }

        const cardData = this.lobbyCards[index];
        if (!cardData) {
            return false;
        }

        const sourceVisual = this.lobbyCardVisuals[index];
        const fallback = this.getLobbySlotPosition(index);
        const refillCardData = this.deck[this.deck.length - 1] ?? null;
        const willRefill = !!refillCardData;

        this.isDrawAnimating = true;
        this.hideScoringTooltip();

        if (sourceVisual) {
            sourceVisual.setVisible(false);
        }

        try {
            const selectedToHand = this.animateLobbyDrawToHand(
                cardData,
                sourceVisual?.x ?? fallback.x,
                sourceVisual?.y ?? fallback.y,
            );

            const lobbyShift = this.animateLobbyShiftAfterDraw(index, willRefill);
            const refillAnim = refillCardData ? this.animateDeckRefillToLobby(refillCardData) : Promise.resolve();

            await Promise.all([selectedToHand, lobbyShift, refillAnim]);

            // Add to player hand
            hand.push(cardData);

            // Remove from lobby
            this.lobbyCards.splice(index, 1);

            // Refill from deck
            if (willRefill) {
                const refill = this.deck.pop();
                if (refill) {
                    this.lobbyCards.unshift(refill);
                }
            }

            this.renderHand();
            this.updateUI();
            return true;
        } finally {
            this.isDrawAnimating = false;
        }
    }

    /**
     * Blind draw from the deck.
     */
    async drawFromDeck() {
        if (this.turnPhase !== "play" || this.isDrawAnimating) {
            return false;
        }
        if (this.deck.length === 0) {
            return false;
        }

        const hand = this.playerHands[this.currentPlayer];
        // hand is full
        if (hand.length === this.maxCardsInHand) {
            return false;
        }

        const cardData = this.deck[this.deck.length - 1];
        if (!cardData) {
            return false;
        }

        this.isDrawAnimating = true;
        this.hideScoringTooltip();

        try {
            await this.animateDeckDrawToHand(cardData);

            const drawn = this.deck.pop();
            if (!drawn) {
                return false;
            }
            hand.push(drawn);

            this.renderHand();
            this.updateUI();
            return true;
        } finally {
            this.isDrawAnimating = false;
        }
    }

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

        /** @type {{ total: number, label: string }[]} */
        const rows = [];

        for (let p = 0; p < this.playerCount; p++) {
            const { total } = scorePlayer(this.placedPatrons[p], this.layout);
            const isAI = !!this.aiConfig[p];
            const name = isAI ? `${PlayerNames[p]} \uD83E\uDD16` : PlayerNames[p];
            rows.push({ total, label: name });
        }

        this.gameInfoPanel?.setScores(rows, showAll, this.currentPlayer);
    }

    /**
     * Re-render and update the lobby visuals.
     */
    updateLobby() {
        this.renderLobby();
    }

    // ══════════════════════════════════════════════════════════════════
    // UI UPDATE
    // ══════════════════════════════════════════════════════════════════

    updateUI() {
        const color = this.playerColor(this.currentPlayer);
        const colorHex = this.playerColorHex(this.currentPlayer);

        this.gameInfoPanel?.setRoundDeck(this.round, this.totalRounds, this.deck.length);

        // Update deck pile visualization (scale down as deck empties)
        if (this.deckPileImage) {
            const ratio = Math.max(this.deck.length / 54, 0);
            this.deckPileImage.setScale(0.3 + 0.7 * ratio);
            this.deckPileImage.setAlpha(ratio > 0 ? 0.5 + 0.5 * ratio : 0.2);
        }

        this.updateLobby();

        this.activePlayerAvatar?.setPlayer({
            usherKey: this.usherKey(this.currentPlayer),
            colorHex,
            color,
            playerNumber: this.currentPlayer + 1,
        });
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
