// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { seatExists } from "../scoring.js";
import { hasSeatLabel, TraitColors } from "../types.js";

const SEAT_SIZE = s(100);
const SEAT_GAP = s(10);
const AISLE_GAP = s(30); // wider gap for aisle walkways

/** @typedef {import('../types.js').LayoutMeta} LayoutMeta */
/** @typedef {import('../types.js').CardData} CardData */

/**
 * Phaser-backed theater grid object: owns layout calculations, static visuals,
 * seat creation/wiring, and placed-card rendering.
 */
export class TheaterGrid extends Phaser.GameObjects.Container {
    /** @type {LayoutMeta} */
    layout;

    /** @type {(Phaser.GameObjects.Rectangle | null)[][]} */
    seatGrid = [];

    /** @type {Phaser.GameObjects.GameObject[]} */
    seatLabels = [];

    /** @type {{
     *   onSeatPointerOver?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     *   onSeatPointerOut?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     *   onSeatPointerDown?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     * }} */
    callbacks;

    /** @type {number} */
    floorTop = 0;

    /** @type {number} */
    gridStartY = 0;

    /** @type {number[]} */
    colX = [];

    /** @type {number[]} */
    rowY = [];

    /** @type {number[]} */
    staggerRowOffsets = [];

    /**
     * @param {Phaser.Scene} scene
     * @param {{
     *   layout: LayoutMeta,
     *   onSeatPointerOver?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     *   onSeatPointerOut?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     *   onSeatPointerDown?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
     * }} options
     */
    constructor(scene, options) {
        super(scene, 0, 0);
        this.layout = options.layout;
        this.callbacks = {
            onSeatPointerOver: options.onSeatPointerOver,
            onSeatPointerOut: options.onSeatPointerOut,
            onSeatPointerDown: options.onSeatPointerDown,
        };

        scene.add.existing(this);
    }

    /**
     * Build theater visuals and interactive seats.
     * @returns {{ floorTop: number }}
     */
    build() {
        const scene = this.scene;
        const { width } = scene.scale;

        const ROWS = this.layout.rows;
        const COLS = this.layout.cols;
        const aisleCols = this.layout.aisleCols ?? [];
        const hasPerRowAisles = !!this.layout.aisleColsByRow;

        /** @type {Set<number>} gaps between col c and col c+1 */
        const centerAisleGaps = new Set();
        if (!hasPerRowAisles) {
            for (let c = 0; c < COLS - 1; c++) {
                if (aisleCols.includes(c) && aisleCols.includes(c + 1)) {
                    centerAisleGaps.add(c);
                }
            }
        }

        /** @type {Set<number>} columns that are entirely empty (gap columns) */
        const gapCols = new Set();
        if (this.layout.seatMask) {
            for (let c = 0; c < COLS; c++) {
                if (this.layout.seatMask.every((row) => !row[c])) {
                    gapCols.add(c);
                }
            }
        }

        /** @type {Set<number>} row indices after which there's a visual break */
        const rowBreaksAfter = new Set();
        if (this.layout.adjacencyBreaks) {
            for (const [a, b] of this.layout.adjacencyBreaks) {
                rowBreaksAfter.add(Math.min(a, b));
            }
        }

        // ── Compute column X positions with variable gaps ────────────
        const GAP_COL_WIDTH = AISLE_GAP;
        const ROW_BREAK_GAP = s(20);
        const colX = [];
        let cursor = 0;
        for (let c = 0; c < COLS; c++) {
            if (gapCols.has(c)) {
                colX[c] = cursor + GAP_COL_WIDTH / 2;
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
        const totalGridW = cursor;

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
        const floorW = totalGridW + bleed * 2;
        const floorH = totalGridH + bleed * 2;
        const stageAspectRatio = 222 / 978;
        const stageRenderWidth = floorW + bleed * 2;
        const actualStageH = stageRenderWidth * stageAspectRatio;
        const stageTop = s(10);
        const floorTop = stageTop + actualStageH - bleed / 2;
        const floorLeft = (width - floorW) / 2;
        const gridStartX = floorLeft + bleed;
        const gridStartY = floorTop + bleed;

        /** @type {number[]} */
        const staggerRowOffsets = [];
        const halfSeat = (SEAT_SIZE + SEAT_GAP) / 2;
        if (this.layout.staggered && this.layout.seatMask) {
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
                const inherentOffset = (firstCol - widestFirstCol) * (SEAT_SIZE + SEAT_GAP);
                staggerRowOffsets[r] = desiredOffset - inherentOffset;
            }
        } else {
            for (let r = 0; r < ROWS; r++) {
                staggerRowOffsets[r] = 0;
            }
        }

        for (let c = 0; c < COLS; c++) colX[c] += gridStartX;
        for (let r = 0; r < ROWS; r++) rowY[r] += gridStartY;

        const floorCenterX = floorLeft + floorW / 2;
        const floorCenterY = floorTop + floorH / 2;
        const bgKey = `bg_${this.layout.id}`;

        const bgImg = scene.add.image(floorCenterX, floorCenterY, bgKey);
        const coverScale = Math.max(floorW / bgImg.width, floorH / bgImg.height);
        bgImg.setScale(coverScale);
        const bgMask = scene.make.graphics();
        bgMask.fillRect(floorLeft, floorTop, floorW, floorH);
        bgImg.setMask(bgMask.createGeometryMask());
        this.add(bgImg);

        const aisleColor = 0x4D0D0F;
        const aisleBorderColor = 0x493D18;
        const aisleDashColor = 0x493D18;

        /** @param {number} centerX @param {number} aisleWidth */
        const drawAisleStrip = (centerX, aisleWidth) => {
            const aisleWidthWithBorder = aisleWidth - s(6);
            const centerY = floorTop + floorH / 2;

            const strip = scene.add
                .rectangle(centerX, centerY, aisleWidthWithBorder, totalGridH, aisleColor)
                .setStrokeStyle(s(2), aisleBorderColor);
            this.add(strip);

            for (let dy = bleed + s(2); dy < floorH - bleed; dy += s(14)) {
                this.add(scene.add.rectangle(centerX, floorTop + dy + s(2), s(2), s(7), aisleDashColor));
            }
        };

        if (this.layout.id === "blackbox") {
            for (const gapAfterCol of centerAisleGaps) {
                const leftEdge = colX[gapAfterCol] + SEAT_SIZE / 2 + s(1);
                const rightEdge = colX[gapAfterCol + 1] - SEAT_SIZE / 2 - s(1);
                drawAisleStrip((leftEdge + rightEdge) / 2, rightEdge - leftEdge);
            }
        }

        const stageX = floorCenterX;
        const stageY = stageTop + actualStageH / 2;

        if (scene.textures.exists("ui_stage")) {
            const stageImg = scene.add.image(stageX, stageY, "ui_stage");
            stageImg.setDisplaySize(stageRenderWidth, actualStageH);
            stageImg.setDepth(2);
            this.add(stageImg);
        } else {
            const fallbackStage = scene.add
                .rectangle(stageX, stageY, floorW, actualStageH, 0x8b4513)
                .setStrokeStyle(s(1), 0xdaa520);
            this.add(fallbackStage);
        }

        const stageLabel = scene.add
            .text(floorCenterX, stageY, this.layout.name, {
                fontSize: px(36),
                color: "#ffd700",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
                shadow: { blur: 8, color: "#000000", fill: true },
            })
            .setOrigin(0.5)
            .setDepth(3);
        this.add(stageLabel);

        for (const breakRow of rowBreaksAfter) {
            const y1 = rowY[breakRow] + SEAT_SIZE / 2;
            const y2 = rowY[breakRow + 1] - SEAT_SIZE / 2;
            const midY = (y1 + y2) / 2;
            for (let dx = 0; dx < totalGridW; dx += s(12)) {
                const line = scene.add
                    .rectangle(gridStartX + dx + s(3), midY, s(6), s(2), 0x555577)
                    .setAlpha(0.5);
                this.add(line);
            }
        }

        // ── Build theater grid ──────────────────────────────────────
        for (let row = 0; row < ROWS; row++) {
            this.seatGrid[row] = [];
            const y = rowY[row];
            const rowStagger = staggerRowOffsets[row] || 0;

            for (let col = 0; col < COLS; col++) {
                if (!seatExists(row, col, this.layout)) {
                    this.seatGrid[row][col] = null;
                    continue;
                }

                const x = colX[col] + rowStagger;
                const isAisle = hasSeatLabel(row, col, "aisle", this.layout);
                const isRoyalBox = this.layout.royalBoxes?.some((b) => b.row === row && b.col === col);

                let emptyFill = 0x1a1a3e;
                let emptyStroke = 0x3a3a5e;
                let strokeWidth = s(2);
                if (isRoyalBox) {
                    emptyFill = 0x2a2040;
                    emptyStroke = 0xdaa520;
                    strokeWidth = s(3);
                } else if (isAisle) {
                    emptyFill = 0x1e1e38;
                    emptyStroke = 0xb89a3e;
                    strokeWidth = s(3);
                }

                const seat = scene.add
                    .rectangle(x, y, SEAT_SIZE, SEAT_SIZE, emptyFill)
                    .setStrokeStyle(strokeWidth, emptyStroke)
                    .setInteractive({ useHandCursor: true });

                seat.setData("row", row);
                seat.setData("col", col);
                seat.setData("emptyFill", emptyFill);
                seat.setData("emptyStroke", emptyStroke);
                seat.setData("strokeWidth", strokeWidth);

                seat.on("pointerover", () => this.callbacks.onSeatPointerOver?.(row, col, seat));
                seat.on("pointerout", () => this.callbacks.onSeatPointerOut?.(row, col, seat));
                seat.on("pointerdown", () => this.callbacks.onSeatPointerDown?.(row, col, seat));

                if (isRoyalBox && scene.textures.exists("tag_royal_box")) {
                    const tag = scene.add.image(x, y, "tag_royal_box")
                        .setDisplaySize(s(64), s(64)).setAlpha(0.85);
                    this.seatLabels.push(tag);
                    this.add(tag);
                }

                this.seatGrid[row][col] = seat;
                this.add(seat);
            }
        }

        this.colX = colX;
        this.rowY = rowY;
        this.staggerRowOffsets = staggerRowOffsets;
        this.gridStartY = gridStartY;
        this.floorTop = floorTop;

        return { floorTop };
    }

    /**
     * @param {number} row
     * @param {number} col
     * @returns {Phaser.GameObjects.Rectangle | null}
     */
    getSeat(row, col) {
        return this.seatGrid[row]?.[col] ?? null;
    }

    clearSeatLabels() {
        for (const lbl of this.seatLabels) {
            lbl.destroy();
        }
        this.seatLabels = [];
    }

    /**
     * Render a played patron card (and badge) on a seat, with animatable entry and masking.
     *
     * @param {Phaser.GameObjects.Rectangle} seat
     * @param {CardData} cardData
     * @param {{ animate?: boolean }} [options]
     * @returns {Phaser.GameObjects.GameObject[]}
     */
    renderPlacedCardOnSeat(seat, cardData, { animate = true } = {}) {
        const scene = this.scene;
        seat.setFillStyle(0x000000, 0);
        seat.setStrokeStyle(
            s(2),
            cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
            0.8,
        );

        const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
        const seatImgW = (seat.width ?? SEAT_SIZE) - s(2);
        const seatImgH = seatImgW * (140 / 105);

        const baseImg = scene.add.image(seat.x, seat.y, baseImgKey);
        baseImg.setDisplaySize(seatImgW, seatImgH);
        baseImg.setPosition(seat.x, seat.y + seatImgH / 2 - (seat.height ?? SEAT_SIZE) / 2);

        const bgMask = scene.make.graphics();
        bgMask.fillRect(
            seat.x - (seat.width ?? SEAT_SIZE) / 2,
            seat.y - (seat.height ?? SEAT_SIZE) / 2,
            seat.width ?? SEAT_SIZE,
            seat.height ?? SEAT_SIZE,
        );
        baseImg.setMask(bgMask.createGeometryMask());

        this.seatLabels.push(baseImg);
        this.add(baseImg);
        const visuals = [seat, baseImg];

        if (cardData.trait) {
            const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
            const badge = scene.add.image(
                seat.x + (seat.width ?? SEAT_SIZE) / 2 - s(15),
                seat.y - (seat.height ?? SEAT_SIZE) / 2 + s(16),
                badgeKey,
            );
            badge.setDisplaySize(s(30), s(30));
            this.seatLabels.push(badge);
            this.add(badge);
            visuals.push(badge);
        }

        if (animate) {
            baseImg.setAlpha(0);
            scene.tweens.add({
                targets: visuals,
                alpha: 1,
                duration: 150,
            });
            scene.tweens.add({
                targets: visuals,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 150,
                yoyo: true,
            });
        }

        return visuals;
    }

    /**
     * @param {(CardData | null)[][]} grid
     */
    renderTheater(grid) {
        this.clearSeatLabels();

        for (let row = 0; row < this.layout.rows; row++) {
            for (let col = 0; col < this.layout.cols; col++) {
                const seat = this.seatGrid[row]?.[col];
                if (!seat) continue;

                const cardData = grid[row]?.[col] ?? null;
                if (cardData) {
                    this.renderPlacedCardOnSeat(seat, cardData, { animate: false });
                } else {
                    const emptyFill = seat.getData("emptyFill") ?? 0x1a1a3e;
                    const emptyStroke = seat.getData("emptyStroke") ?? 0x3a3a5e;
                    const sw = seat.getData("strokeWidth") ?? s(2);
                    seat.setFillStyle(emptyFill);
                    seat.setStrokeStyle(sw, emptyStroke);

                    const isRoyalBox = this.layout.royalBoxes?.some((b) => b.row === row && b.col === col);
                    if (isRoyalBox && this.scene.textures.exists("tag_royal_box")) {
                        const tag = this.scene.add.image(seat.x, seat.y, "tag_royal_box")
                            .setDisplaySize(s(64), s(64)).setAlpha(0.85);
                        this.seatLabels.push(tag);
                        this.add(tag);
                    }
                }
            }
        }
    }
}
