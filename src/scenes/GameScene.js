// @ts-check
import Phaser from 'phaser';
import { pickCardAndSeat, pickDrawAction } from '../ai.js';
import { px, s } from '../config.js';
import { ActivePlayerAvatar } from '../objects/ActivePlayerAvatar.js';
import { createButton } from '../objects/Button.js';
import { Card } from '../objects/Card.js';
import { DrawReminderBanner } from '../objects/DrawReminderBanner.js';
import { GameInfoPanel } from '../objects/GameInfoPanel.js';
import { SpeechBubble } from '../objects/SpeechBubble.js';
import { scorePlayer, seatExists } from '../scoring.js';
import {
    createDeck,
    GrandEmpressLayout,
    hasSeatLabel,
    LayoutOrder,
    Layouts,
    PatronInfo,
    PatronType,
    PatronTypeOrder,
    PlayerColors,
    PlayerColorsHex,
    PlayerNames,
    Trait,
    TraitColors,
    TraitInfo,
    TraitOrder,
} from '../types.js';

const SEAT_SIZE = s(100);
const SEAT_GAP = s(10);
const AISLE_GAP = s(30); // wider gap for aisle walkways

const ENV = /** @type {{ VITE_DEBUG_AI?: string }} */ ((/** @type {any} */ (import.meta)).env ?? {});


export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

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
        this.turnPhase = 'pass-screen';

        // Visual references
        /** @type {(Phaser.GameObjects.Rectangle | null)[][]} */
        this.seatGrid = [];

        /** @type {Phaser.GameObjects.Container | null} */
        this.passOverlay = null;

        /** @type {GameInfoPanel | null} */
        this.gameInfoPanel = null;

        /** @type {ActivePlayerAvatar | null} */
        this.activePlayerAvatar = null;

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

        /** @type {SpeechBubble | null} */
        this.scoringTooltip = null;

        /** @type {DrawReminderBanner | null} */
        this.drawReminderBanner = null;

        /** @type {import('../types.js').CardData[]} */
        this.lobbyCards = [];

        /** @type {Card[]} */
        this.lobbyCardVisuals = [];

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
    static USHER_KEYS = ['usher_blue', 'usher_red', 'usher_green', 'usher_orange'];

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

        this.load.on('progress', (/** @type {number} */ value) => {
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
        loadIfMissing('tag_royal_box', 'assets/tag_royal_box.png');

        // ── Only the selected theater background (JPEG) ─────────────────
        const bgKey = `bg_${this.layout.id}`;
        loadIfMissing(bgKey, `assets/${this.layout.bgKey}.jpg`);

        // ── Game UI assets ──────────────────────────────────────────────
        loadIfMissing('card_back', 'assets/card_back.png');
        loadIfMissing('ui_stage', 'assets/ui_stage.png');
        loadIfMissing('ui_logo', 'assets/ui_logo.png');
        loadIfMissing('ui_button_frame', 'assets/ui_button_frame.png');
        loadIfMissing('usher_blue', 'assets/usher_blue.png');
        loadIfMissing('usher_red', 'assets/usher_red.png');
        loadIfMissing('usher_green', 'assets/usher_green.png');
        loadIfMissing('usher_orange', 'assets/usher_orange.png');
    }

    /**
     * @param {{ playerCount?: number, layoutId?: string, aiConfig?: (string | null)[], playerColorMap?: number[] }} data
     */
    init(data) {
        if (data?.layoutId && Layouts[data.layoutId]) {
            this.layout = Layouts[data.layoutId];
        }
        else {
            this.layout = GrandEmpressLayout;
        }
        this.playerCount = data.playerCount || 2;
        this.maxCardsInHand = this.playerCount === 2 ? 3 : 2;
        this.currentPlayer = 0;
        this.round = 1;
        this.selectedCard = null;
        this.turnPhase = 'pass-screen';
        this.isDrawAnimating = false;
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
        this.gameInfoPanel = null;
        this.activePlayerAvatar = null;
        this.deckPileImage = null;
    }

    debugSetup() {
        // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
        this.input.keyboard?.on('keydown-D', (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log('DEBUG: Skipping to end screen');
            this.turnPhase = 'game-over';
            this.endGame();
        });

        // ── DEV DEBUG HAND (Shift+H) — one of each patron + one of each trait
        this.input.keyboard?.on('keydown-H', (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log('DEBUG: Dealing debug hand (all types + all traits)');
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
        this.input.keyboard?.on('keydown-T', (/** @type {KeyboardEvent} */ e) => {
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

        this.debugSetup();

        // ── Compute aisle walkway positions ────────────────────────────
        const ROWS = this.layout.rows;
        const COLS = this.layout.cols;
        const aisleCols = this.layout.aisleCols ?? [];
        const hasPerRowAisles = !!this.layout.aisleColsByRow;

        // Determine where walkway gaps go (edges and between seats).
        // For per-row aisles (Promenade), we skip structural gaps and
        // only use per-seat colour tints.
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
        for (let c = 0; c < COLS; c++) {
            if (gapCols.has(c)) {
                // Gap column: skip it (just add gap space)
                colX[c] = cursor + GAP_COL_WIDTH / 2; // position for reference
                cursor += GAP_COL_WIDTH;
            }
            else {
                colX[c] = cursor + SEAT_SIZE / 2;
                cursor += SEAT_SIZE;
            }
            if (c < COLS - 1) {
                if (centerAisleGaps.has(c)) {
                    cursor += AISLE_GAP;
                }
                else if (!gapCols.has(c) && !gapCols.has(c + 1)) {
                    cursor += SEAT_GAP;
                }
            }
        }
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

        const bleed = s(30);
        const floorW = totalGridW + bleed * 2; // grid centered on screen
        const floorH = totalGridH + bleed * 2; // grid centered on screen
        // TODO: get this from the texture
        const stageAspectRatio = 222 / 978;
        const stageRenderWidth = floorW + bleed * 2; // the stage bleeds again
        const actualStageH = stageRenderWidth * stageAspectRatio;
        const stageTop = s(10);
        // Center the entire floor (label pad + grid) on screen
        const floorTop = stageTop + actualStageH - bleed / 2;
        const floorLeft = (width - floorW) / 2;
        const gridStartX = floorLeft + bleed;
        const gridStartY = floorTop + bleed;

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
                        if (first < 0) {
                            first = c;
                        }
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
                        if (seatCount === 1) {
                            firstCol = c;
                        }
                    }
                }
                const seatDiff = maxSeats - seatCount;
                const desiredOffset = seatDiff * halfSeat;
                const inherentOffset = (firstCol - widestFirstCol) *
                    (SEAT_SIZE + SEAT_GAP);
                staggerRowOffsets[r] = desiredOffset - inherentOffset;
            }
        }
        else {
            for (let r = 0; r < ROWS; r++) {
                staggerRowOffsets[r] = 0;
            }
        }

        // Offset colX and rowY so they're relative to gridStartX/gridStartY
        for (let c = 0; c < COLS; c++) {
            colX[c] += gridStartX;
        }
        for (let r = 0; r < ROWS; r++) {
            rowY[r] += gridStartY;
        }

        // ── Theater floor background ─────────────────────────────────
        const floorCenterX = floorLeft + floorW / 2;
        const floorCenterY = floorTop + floorH / 2;
        const bgKey = `bg_${this.layout.id}`;
        // Draw the background image with cover scaling (maintain aspect ratio)
        const bgImg = this.add.image(
            floorCenterX,
            floorCenterY,
            bgKey,
        );
        const texW = bgImg.width;
        const texH = bgImg.height;
        const coverScale = Math.max(floorW / texW, floorH / texH);
        bgImg.setScale(coverScale);

        const bgMask = this.make.graphics();
        bgMask.fillRect(
            floorLeft,
            floorTop,
            floorW,
            floorH,
        );
        bgImg.setMask(bgMask.createGeometryMask());

        // ── Aisle walkway strips ──────────────────────────────────────
        const aisleColor = 0x4D0D0F;
        const aisleBorderColor = 0x493D18;
        const aisleDashColor = 0x493D18;

        /**
         * Draw a single aisle walkway strip with gold-tinted borders and dashes.
         * @param {number} centerX - center X
         * @param {number} aisleWidth  - strip width
         */
        const drawAisleStrip = (centerX, aisleWidth) => {
            const aisleWidthWithBorder = aisleWidth - s(6);
            const centerY = floorTop + floorH / 2;

            // Main walkway background
            this.add
                .rectangle(centerX, centerY, aisleWidthWithBorder, totalGridH, aisleColor)
                .setStrokeStyle(s(2), aisleBorderColor);
            // Center dashed line
            for (let dy = bleed + s(2); dy < floorH - bleed; dy += s(14)) {
                this.add
                    .rectangle(centerX, floorTop + dy + s(2), s(2), s(7), aisleDashColor);
            }
        };

        // Only draw walkway strips for Blackbox (center aisle is the defining feature)
        if (this.layout.id === 'blackbox') {
            for (const gapAfterCol of centerAisleGaps) {
                const leftEdge = colX[gapAfterCol] + SEAT_SIZE / 2 + s(1);
                const rightEdge = colX[gapAfterCol + 1] - SEAT_SIZE / 2 - s(1);
                drawAisleStrip((leftEdge + rightEdge) / 2, rightEdge - leftEdge);
            }
        }

        // ── Stage platform ───────────────────────────────────────────
        const stageX = floorCenterX;
        const stageY = stageTop + actualStageH / 2;

        if (this.textures.exists('ui_stage')) {
            const stageImg = this.add.image(
                stageX,
                stageY,
                'ui_stage',
            );
            stageImg.setDisplaySize(stageRenderWidth, actualStageH);
            stageImg.setDepth(2);
        }
        else {
            this.add
                .rectangle(
                    stageX,
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
                color: '#ffd700',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                shadow: { blur: 8, color: '#000000', fill: true },
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
            const rowStagger = staggerRowOffsets[row] || 0;

            for (let col = 0; col < COLS; col++) {
                // Skip non-existent seats (seatMask or gap columns)
                if (!seatExists(row, col, this.layout)) {
                    this.seatGrid[row][col] = null;
                    continue;
                }

                const x = colX[col] + rowStagger;
                const isAisle = hasSeatLabel(row, col, 'aisle', this.layout);
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
                }
                else if (isAisle) {
                    emptyFill = 0x1e1e38;
                    emptyStroke = 0xb89a3e;
                    strokeWidth = s(3);
                }

                const seat = this.add
                    .rectangle(x, y, SEAT_SIZE, SEAT_SIZE, emptyFill)
                    .setStrokeStyle(strokeWidth, emptyStroke)
                    .setInteractive({ useHandCursor: true });

                seat.setData('row', row);
                seat.setData('col', col);
                seat.setData('emptyFill', emptyFill);
                seat.setData('emptyStroke', emptyStroke);
                seat.setData('strokeWidth', strokeWidth);

                seat.on('pointerover', () => {
                    if (
                        this.turnPhase === 'play' &&
                        !this.placedPatrons[this.currentPlayer][row][col] &&
                        this.selectedCard
                    ) {
                        seat.setFillStyle(0x2a2a5e);
                        seat.setStrokeStyle(s(2), 0xf5c518);
                    }
                });

                seat.on('pointerout', () => {
                    if (!this.placedPatrons[this.currentPlayer][row][col]) {
                        seat.setFillStyle(emptyFill);
                        seat.setStrokeStyle(strokeWidth, emptyStroke);
                    }
                });

                seat.on('pointerdown', () => {
                    if (this.turnPhase === 'play') {
                        this.placeSeatCard(row, col);
                    }
                });

                // Royal Box tag (centered on empty seat)
                if (isRoyalBox && this.textures.exists('tag_royal_box')) {
                    const tag = this.add.image(x, y, 'tag_royal_box')
                        .setDisplaySize(s(64), s(64)).setAlpha(0.85);
                    this.seatLabels.push(tag);
                }

                this.seatGrid[row][col] = seat;
            }
        }

        // ── HUD Panel (Game Information) ────────────────────────────────
        const hudW = s(260);
        const hudX = width - hudW - s(20);
        this.gameInfoPanel = new GameInfoPanel(this, hudX, floorTop, {
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
                color: '#ffffff',
                playerNumber: 1,
            },
        );

        // Global deselect background click
        this.input.on(
            'pointerdown',
            (/** @type {any} */ _pointer, /** @type {any[]} */ gameObjects) => {
                if (gameObjects.length === 0 && this.selectedCard) {
                    this.selectedCard.setSelected(false);
                    this.selectedCard = null;
                    this.hideScoringTooltip();
                }
            },
        );

        // ── Logo ────────────────────────────────────────────────────────
        if (this.textures.exists('ui_logo')) {
            // Centered at s(80) to perfectly align vertically with the player avatar
            const logo = this.add.image(s(120), s(60), 'ui_logo');
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
        this.turnPhase = 'pass-screen';

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
                fontFamily: 'Georgia, serif',
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
                    fontFamily: 'Arial',
                    color: '#aaaaaa',
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
                        fontFamily: 'Arial',
                        color: '#f5c518',
                        fontStyle: 'italic',
                        wordWrap: { width: s(600) },
                        align: 'center',
                    },
                )
                .setOrigin(0.5);
            container.add(houseRule);
        }

        // Ready button
        const { container: readyBtn, hitArea: readyHit } = createButton(
            this, width / 2, height / 2 + s(160), 'I\'m Ready', { fontSize: 20 },
        );
        readyHit.on('pointerdown', () => {
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
            this.turnPhase = 'play';
            this.time.delayedCall(600, () => this.playAITurn());
            return;
        }

        this.renderHand();
        this.turnPhase = 'play';
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
            if (ENV.VITE_DEBUG_AI === 'true') {
                console.log(`[AI DEBUG] Action ${actions.length + 1}: Draw from ${source}${source === 'lobby' ? ` index ${lobbyIdx}` : ''}`);
            }

            /** @type {import('../types.js').CardData | null} */
            let simulatedDrawn = null;

            if (source === 'lobby' && lobbyIdx !== undefined) {
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

                    actions.push({ type: 'draw', decision: { source: 'lobby', index: lobbyIdx } });
                }
            }
            else if (source === 'deck' && tempDeckCount > 0) {
                const deckTop = this.deck[tempDeckCount - 1];
                tempDeckCount -= 1;
                if (deckTop) {
                    simulatedDrawn = deckTop;
                    tempHand.push(simulatedDrawn);
                    actions.push({ type: 'draw', decision: { source: 'deck' } });
                }
            }

            if (simulatedDrawn && ENV.VITE_DEBUG_AI === 'true') {
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
                actions.push({ type: 'select', decision: playAndDiscard.play });
                actions.push({ type: 'place', decision: playAndDiscard.play });
                // for 2 players then there will be a discard too
                if (playAndDiscard.discard) {
                    actions.push({ type: 'discard', decision: playAndDiscard.discard });
                }
            }
        }

        // Execute actions sequentially.
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            const isLast = i === actions.length - 1;

            switch (action.type) {
                case 'draw': {
                    if (action.decision.source === 'lobby' && action.decision.index !== undefined) {
                        await this.drawFromLobby(action.decision.index);
                    }
                    else {
                        await this.drawFromDeck();
                    }
                    break;
                }
                case 'select': {
                    const { cardData } = action.decision;
                    for (const card of this.handCards) {
                        if (card.cardData.label === cardData.label) {
                            this.selectCard(card);
                        }
                    }
                    break;
                }
                case 'place': {
                    const { cardData, row, col } = action.decision;

                    if (ENV.VITE_DEBUG_AI === 'true') {
                        console.log(`[AI DEBUG] Action ${i}: Place ${cardData.label || cardData.type} at (${row}, ${col})`);
                    }

                    this.placeSeatCard(row, col);
                    break;
                }
                case 'discard': {
                    const { cardData } = action.decision;
                    if (ENV.VITE_DEBUG_AI === 'true') {
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
                await this.waitMs(250);
            }
            else if (ENV.VITE_DEBUG_AI === 'true') {
                console.log(`[AI DEBUG] Turn complete for player ${this.currentPlayer}. Advancing...`);
            }
        }
    }

    /**
     * Render a played patron card (and badge) on a seat, with animatable entry and masking.
     * Returns the created sprites for animation if needed.
     *
     * @param {Phaser.GameObjects.Rectangle} seat
     * @param {import('../types.js').CardData} cardData
     * @param {{ animate?: boolean }} [options]
     * @returns {Phaser.GameObjects.GameObject[]} The created visual objects (seat, baseImg, badge?)
     */
    renderPlacedCardOnSeat(seat, cardData, { animate = true } = {}) {
        seat.setFillStyle(0x000000, 0);
        seat.setStrokeStyle(
            s(2),
            cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
            0.8,
        );
        // Patron image
        const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
        // The mask will use seat dimensions, not SEAT_SIZE (for flexibility)
        const seatImgW = (seat.width ?? SEAT_SIZE) - s(2);
        const seatImgH = seatImgW * (140 / 105);

        const baseImg = this.add.image(seat.x, seat.y, baseImgKey);
        baseImg.setDisplaySize(seatImgW, seatImgH);
        // Pin to bottom of seat rect
        baseImg.setPosition(seat.x, seat.y + seatImgH / 2 - (seat.height ?? SEAT_SIZE) / 2);
        // Mask so patron never escapes seat boundary
        const bgMask = this.make.graphics();
        bgMask.fillRect(
            seat.x - (seat.width ?? SEAT_SIZE) / 2,
            seat.y - (seat.height ?? SEAT_SIZE) / 2,
            seat.width ?? SEAT_SIZE,
            seat.height ?? SEAT_SIZE,
        );
        baseImg.setMask(bgMask.createGeometryMask());
        this.seatLabels.push(baseImg);
        const visuals = [seat, baseImg];
        if (cardData.trait) {
            const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
            // Position in top-right of the seat rect
            const badge = this.add.image(
                seat.x + (seat.width ?? SEAT_SIZE) / 2 - s(15),
                seat.y - (seat.height ?? SEAT_SIZE) / 2 + s(16),
                badgeKey,
            );
            badge.setDisplaySize(s(30), s(30));
            this.seatLabels.push(badge);
            visuals.push(badge);
        }
        if (animate) {
            baseImg.setAlpha(0);
            this.tweens.add({
                targets: visuals,
                alpha: 1,
                duration: 150,
            });
            this.tweens.add({
                targets: visuals,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 150,
                yoyo: true,
            });
        }
        return visuals;
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
                if (!seat) {
                    continue;
                }

                const cardData = grid[row][col];
                if (cardData) {
                    this.renderPlacedCardOnSeat(seat, cardData, { animate: false });
                }
                else {
                    // Restore empty-state appearance from seat data
                    const emptyFill = seat.getData('emptyFill') ?? 0x1a1a3e;
                    const emptyStroke = seat.getData('emptyStroke') ?? 0x3a3a5e;
                    const sw = seat.getData('strokeWidth') ?? s(2);
                    seat.setFillStyle(emptyFill);
                    seat.setStrokeStyle(sw, emptyStroke);

                    // Re-add seat tags for empty seats
                    const isRoyalBox = this.layout.royalBoxes?.some(
                        (b) => b.row === row && b.col === col,
                    );
                    if (isRoyalBox && this.textures.exists('tag_royal_box')) {
                        const tag = this.add.image(seat.x, seat.y, 'tag_royal_box')
                            .setDisplaySize(s(64), s(64)).setAlpha(0.85);
                        this.seatLabels.push(tag);
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
                card.on('pointerdown', () => {
                    if (this.turnPhase === 'discard') {
                        this.discardCard(card);
                    }
                    else {
                        this.selectCard(card);
                    }
                });
            }

            // Always show scoring tooltip on hover
            card.on('pointerover', () => {
                this.showScoringTooltip(card);
            });

            card.on('pointerout', () => {
                if (this.selectedCard) {
                    this.showScoringTooltip(this.selectedCard);
                }
                else {
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
     * @param {Card} card
     */
    selectCard(card) {
        const hand = this.playerHands[this.currentPlayer];
        const handIsFull = hand.length === this.maxCardsInHand;
        if (this.turnPhase === 'play' && !handIsFull) {
            this.showDrawReminderBanner();
            return;
        }
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

        let hint = PatronInfo[card.cardData.type]?.scoringHint || '';
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
            ease: 'Sine.easeOut',
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
        const { width, height } = this.scale;
        let msg;
        if (this.playerCount === 2) {
            const currentHand = this.playerHands[this.currentPlayer] || [];
            const needed = this.maxCardsInHand - currentHand.length;
            msg = needed === 2 ? 'You must draw two cards first' : 'You must draw a card first';
        }
        else {
            msg = 'You must draw a card first';
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

        const seat = this.seatGrid[row][col];
        if (!seat) {
            return;
        }

        const cardData = this.selectedCard.cardData;
        // Update logical state
        this.placedPatrons[this.currentPlayer][row][col] = cardData;
        this.renderPlacedCardOnSeat(seat, cardData, { animate: true });
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
            this.turnPhase = 'discard';
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

    getNextHandSlotPosition() {
        const { width, height } = this.scale;
        const handSizeAfterDraw = this.playerHands[this.currentPlayer].length + 1;
        const handStartX = width / 2 - ((handSizeAfterDraw - 1) * (Card.WIDTH + s(20))) / 2;

        return {
            x: handStartX + (handSizeAfterDraw - 1) * (Card.WIDTH + s(20)),
            y: height - s(100),
        };
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
                ease: 'Back.easeOut',
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
                ease: 'Cubic.easeInOut',
                onComplete: () => resolve(null),
            });
        });

        animCard.destroy();
    }

    /**
     * @param {import('../types.js').CardData} cardData
     */
    async animateDeckDrawToHand(cardData) {
        const pickupScale = 1.14;
        const travelScale = 1.08;
        const { deckX, deckY } = this.getLobbyMetrics();
        const target = this.getNextHandSlotPosition();

        const back = this.add.container(deckX, deckY);
        back.setDepth(500);

        const backBorder = this.add
            .rectangle(0, 0, Card.WIDTH, Card.HEIGHT, 0x000000)
            .setStrokeStyle(s(2), 0x000000, 0.7);
        const backImage = this.add.image(0, 0, 'card_back').setDisplaySize(Card.WIDTH, Card.HEIGHT);
        back.add([backBorder, backImage]);

        await new Promise((resolve) => {
            this.tweens.add({
                targets: back,
                scaleX: pickupScale,
                scaleY: pickupScale,
                duration: 70,
                ease: 'Sine.easeOut',
                onComplete: () => resolve(null),
            });
        });

        await new Promise((resolve) => {
            this.tweens.add({
                targets: back,
                scaleX: 0,
                duration: 120,
                ease: 'Sine.easeIn',
                onComplete: () => resolve(null),
            });
        });

        const faceCard = new Card(this, deckX, deckY, cardData);
        faceCard.disableInteractive();
        faceCard.setDepth(501);
        faceCard.setScale(0, pickupScale);
        back.destroy();

        await new Promise((resolve) => {
            this.tweens.add({
                targets: faceCard,
                scaleX: pickupScale,
                duration: 140,
                ease: 'Sine.easeOut',
                onComplete: () => resolve(null),
            });
        });

        await new Promise((resolve) => {
            this.tweens.add({
                targets: faceCard,
                x: target.x,
                y: target.y,
                scaleX: travelScale,
                scaleY: travelScale,
                duration: 230,
                ease: 'Cubic.easeInOut',
                onComplete: () => resolve(null),
            });
        });

        faceCard.destroy();
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

        const { deckX, deckY, gap } = this.getLobbyMetrics();
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

            const image = this.add.image(ox, oy, 'card_back');
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
                Card.HEIGHT + s(PILE_LAYERS)
            ),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
        });
        this.deckPileImage.on('pointerdown', () => {
            void this.drawFromDeck();
        });

        // Draw lobby cards
        for (let i = 0; i < this.lobbyCards.length; i++) {
            const data = this.lobbyCards[i];
            if (!data) {
                continue;
            }
            // Start lobby cards to the right of the deck pile
            const cardY = deckY + (i + 1) * (Card.HEIGHT + gap);

            // use deckX sot they are all aligned with the deck
            const card = new Card(this, deckX, cardY, data);
            card.setDepth(160); // Ensure they are above everything else

            const isAI = !!this.aiConfig[this.currentPlayer];

            card.on('pointerover', () => {
                this.showScoringTooltip(card);
            });
            card.on('pointerout', () => {
                if (this.selectedCard) {
                    this.showScoringTooltip(this.selectedCard);
                }
                else {
                    this.hideScoringTooltip();
                }
            });

            // Slot 0 is unavailable
            if (i === 0) {
                card.setInteractive(false);
                // TODO: how to make the card look unavailable
                card.setStrokeColor(0xf44336);
            }
            else {
                if (!isAI) {
                    card.on('pointerdown', () => {
                        void this.drawFromLobby(i);
                    });
                }
            }

            this.lobbyCardVisuals.push(card);
        }
    }

    /**
     * Handles picking a card from the lobby.
     * @param {number} index
     */
    async drawFromLobby(index) {
        if (this.turnPhase !== 'play' || this.isDrawAnimating) {
            return false;
        }

        const hand = this.playerHands[this.currentPlayer];
        // hand is full
        if (hand.length === this.maxCardsInHand) {
            return false;
        }

        const cardData = this.lobbyCards[index];
        if (!cardData) {
            return false;
        }

        const sourceVisual = this.lobbyCardVisuals[index];
        const { deckX, deckY, gap } = this.getLobbyMetrics();
        const fallbackY = deckY + (index + 1) * (Card.HEIGHT + gap);

        this.isDrawAnimating = true;
        this.hideScoringTooltip();

        if (sourceVisual) {
            sourceVisual.setVisible(false);
        }

        try {
            await this.animateLobbyDrawToHand(
                cardData,
                sourceVisual?.x ?? deckX,
                sourceVisual?.y ?? fallbackY,
            );

            // Add to player hand
            hand.push(cardData);

            // Remove from lobby
            this.lobbyCards.splice(index, 1);

            // Refill from deck
            if (this.deck.length > 0) {
                const refill = this.deck.pop();
                if (refill) {
                    this.lobbyCards.unshift(refill);
                }
            }

            this.renderHand();
            this.updateUI();
            return true;
        }
        finally {
            this.isDrawAnimating = false;
        }
    }

    /**
     * Blind draw from the deck.
     */
    async drawFromDeck() {
        if (this.turnPhase !== 'play' || this.isDrawAnimating) {
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
        }
        finally {
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
        }
        else {
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
        const showAll = this.registry.get('showAllScores') ?? true;

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
        this.scene.start('EndGameScene', {
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
