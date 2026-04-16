// @ts-check
import Phaser from "phaser";
import { s } from "../config.js";
import { createStage } from "../factories/Stage.js";
import { seatExists } from "../scoring.js";
import { hasSeatLabel, TraitColors } from "../types.js";
import { AISLE_GAP, SEAT_GAP, SEAT_SIZE } from "../constants.js";

/** @typedef {import('../types.js').LayoutMeta} LayoutMeta */
/** @typedef {import('../types.js').CardData} CardData */

/** @typedef {{
 *   onSeatPointerOver?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
 *   onSeatPointerOut?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
 *   onSeatPointerDown?: (row: number, col: number, seat: Phaser.GameObjects.Rectangle) => void,
 * }} SeatCallbacks */

/** @typedef {{
 *   emptyFill: number,
 *   emptyStroke: number,
 *   strokeWidth: number,
 * }} SeatStyle */

/** @typedef {{
 *   centerAisleGaps: Set<number>,
 *   gapCols: Set<number>,
 *   rowBreaksAfter: Set<number>,
 * }} LayoutBreakMetadata */

/** @typedef {{
 *   colX: number[],
 *   rowY: number[],
 *   totalGridW: number,
 *   totalGridH: number,
 * }} GridGeometry */

/** @typedef {{
 *   stageX: number,
 *   floorW: number,
 *   floorH: number,
 *   gridStartX: number,
 *   gridStartY: number,
 *   gridMarginTop: number,
 *   gridMarginBottom: number,
 * }} FloorGeometry */

/**
 * Phaser-backed theater grid object: owns layout calculations, static visuals,
 * seat creation/wiring, and placed-card rendering.
 */
export class TheaterGrid extends Phaser.GameObjects.Container {
    static BLACKBOX_AISLE_COLOR = 0x4D0D0F;
    static BLACKBOX_AISLE_BORDER_COLOR = 0x493D18;
    static BLACKBOX_AISLE_DASH_COLOR = 0x493D18;
    static BREAK_LINE_COLOR = 0x555577;
    static FRONT_STRIP_COLOR = 0x8b1a2b; // crimson velvet accent
    static FRONT_STRIP_GLOW_COLOR = 0xd46a7a;
    static AISLE_GUIDE_COLOR = 0xd4af37;
    static AISLE_GUIDE_GLOW_COLOR = 0xf5de8a;
    static ROYAL_BOX_TAG_KEY = "tag_royal_box";
    static ROYAL_BOX_TAG_SIZE = s(64);

    /** @type {LayoutMeta} */
    layout;

    /** @type {(Phaser.GameObjects.Rectangle | null)[][]} */
    seatGrid = [];

    /**
     * Visual overlays tied to seat rendering lifecycle (patron images, badges,
     * royal tags and temporary mask graphics).
     *
     * @type {Phaser.GameObjects.GameObject[]}
     */
    seatLabels = [];

    /** @type {SeatCallbacks} */
    callbacks;

    /** @type {Map<string, Phaser.GameObjects.Rectangle>} */
    frontSeatStrips = new Map();

    /** @type {Map<string, Phaser.GameObjects.Container>} */
    frontSeatBadges = new Map();

    /** @type {Map<string, Phaser.Tweens.Tween>} */
    frontSeatPulseTweens = new Map();

    /** @type {boolean} */
    frontSeatGuidanceActive = false;

    /** @type {boolean} */
    frontSeatGuidanceShowBadges = false;

    /** @type {Map<string, Phaser.GameObjects.Rectangle>} */
    aisleSeatGuides = new Map();

    /** @type {Map<string, Phaser.GameObjects.Container>} */
    aisleSeatBadges = new Map();

    /** @type {Map<string, Phaser.Tweens.Tween>} */
    aisleSeatPulseTweens = new Map();

    /** @type {boolean} */
    aisleSeatGuidanceActive = false;

    /** @type {boolean} */
    aisleSeatGuidanceShowBadges = false;

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
     * @param {{ layout: LayoutMeta } & SeatCallbacks} options
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
     *
     * This method is intentionally orchestration-only: it delegates geometry,
     * static scenery, and seat creation to focused helpers for readability.
     *
     * @returns {{ gridStartY: number }}
     */
    build() {
        // Defensive reset so accidental rebuilds do not stack visuals.
        this.removeAll(true);
        this.seatGrid = [];
        this.seatLabels = [];
        for (const tween of this.frontSeatPulseTweens.values()) {
            tween.stop();
        }
        for (const tween of this.aisleSeatPulseTweens.values()) {
            tween.stop();
        }
        this.frontSeatStrips.clear();
        this.frontSeatBadges.clear();
        this.frontSeatPulseTweens.clear();
        this.frontSeatGuidanceActive = false;
        this.frontSeatGuidanceShowBadges = false;
        this.aisleSeatGuides.clear();
        this.aisleSeatBadges.clear();
        this.aisleSeatPulseTweens.clear();
        this.aisleSeatGuidanceActive = false;
        this.aisleSeatGuidanceShowBadges = false;

        const breakMetadata = this.deriveLayoutBreakMetadata();
        const geometry = this.computeGridGeometry(breakMetadata);
        const floorGeometry = this.addStageAndMaskedBackground(
            geometry.totalGridW,
            geometry.totalGridH,
        );

        const staggerRowOffsets = this.computeStaggerRowOffsets();
        const worldColX = geometry.colX.map((x) => x + floorGeometry.gridStartX);
        const worldRowY = geometry.rowY.map((y) => y + floorGeometry.gridStartY);

        this.buildSeatGrid(worldColX, worldRowY, staggerRowOffsets);

        this.addRowBreakSeparators(
            breakMetadata.rowBreaksAfter,
            worldRowY,
            geometry.totalGridW,
            floorGeometry.gridStartX,
        );
        this.addColumnBreakSeparators(
            breakMetadata,
            worldColX,
            geometry.totalGridH,
            floorGeometry.gridStartY,
        );

        // Add high-fidelity layout-specific overlays (e.g. Blackbox red carpet)
        this.addBlackboxRedCarpet(
            breakMetadata.centerAisleGaps,
            worldColX,
            geometry.totalGridH,
            floorGeometry,
        );

        this.colX = worldColX;
        this.rowY = worldRowY;
        this.staggerRowOffsets = staggerRowOffsets;
        this.gridStartY = floorGeometry.gridStartY;

        return { gridStartY: floorGeometry.gridStartY };
    }

    /**
     * Derive visual/seating break metadata from layout.
     *
     * Notes:
     * - `centerAisleGaps` are between adjacent columns and are inferred from
     *   legacy `aisleCols` (when `aisleColsByRow` is absent).
     * - `gapCols` are explicit empty columns from `seatMask`.
     * - `rowBreaksAfter` come from `adjacencyBreaks`, with Opera House being the
     *   notable case where adjacency is broken while rows remain visually aligned.
     *
     * @returns {LayoutBreakMetadata}
     */
    deriveLayoutBreakMetadata() {
        const rows = this.layout.rows;
        const cols = this.layout.cols;
        const aisleCols = this.layout.aisleCols ?? [];
        const hasPerRowAisles = !!this.layout.aisleColsByRow;

        /** @type {Set<number>} gaps between col c and col c+1 */
        const centerAisleGaps = new Set();
        if (!hasPerRowAisles) {
            for (let c = 0; c < cols - 1; c++) {
                if (aisleCols.includes(c) && aisleCols.includes(c + 1)) {
                    centerAisleGaps.add(c);
                }
            }
        }

        /** @type {Set<number>} columns that are entirely empty */
        const gapCols = new Set();
        if (this.layout.seatMask) {
            for (let c = 0; c < cols; c++) {
                if (this.layout.seatMask.every((row) => !row[c])) {
                    gapCols.add(c);
                }
            }
        }

        /** @type {Set<number>} row index after which there is a break */
        const rowBreaksAfter = new Set();
        if (this.layout.adjacencyBreaks) {
            for (const [a, b] of this.layout.adjacencyBreaks) {
                const min = Math.min(a, b);
                if (min >= 0 && min < rows - 1) {
                    rowBreaksAfter.add(min);
                }
            }
        }

        return { centerAisleGaps, gapCols, rowBreaksAfter };
    }

    /**
     * Compute local-space seat center coordinates and total grid dimensions.
     *
     * Column spacing rules:
     * - Seat columns consume `SEAT_SIZE` width.
     * - Explicit gap columns consume `AISLE_GAP` width.
     * - Between normal adjacent seat columns: add `SEAT_GAP`.
     * - Between paired aisle columns (`centerAisleGaps`): add `AISLE_GAP`.
     *
     * @param {LayoutBreakMetadata} breakMetadata
     * @returns {GridGeometry}
     */
    computeGridGeometry(breakMetadata) {
        const rows = this.layout.rows;
        const cols = this.layout.cols;
        const rowBreakGap = s(20);

        /** @type {number[]} */
        const colX = [];
        let xCursor = 0;

        for (let c = 0; c < cols; c++) {
            if (breakMetadata.gapCols.has(c)) {
                colX[c] = xCursor + AISLE_GAP / 2;
                xCursor += AISLE_GAP;
            } else {
                colX[c] = xCursor + SEAT_SIZE / 2;
                xCursor += SEAT_SIZE;
            }

            if (c >= cols - 1) {
                continue;
            }

            if (breakMetadata.centerAisleGaps.has(c)) {
                xCursor += AISLE_GAP;
            } else if (!breakMetadata.gapCols.has(c) && !breakMetadata.gapCols.has(c + 1)) {
                xCursor += SEAT_GAP;
            }
        }

        /** @type {number[]} */
        const rowY = [];
        let yCursor = 0;

        for (let r = 0; r < rows; r++) {
            rowY[r] = yCursor + SEAT_SIZE / 2;
            yCursor += SEAT_SIZE;

            if (r < rows - 1) {
                yCursor += breakMetadata.rowBreaksAfter.has(r) ? SEAT_GAP + rowBreakGap : SEAT_GAP;
            }
        }

        return {
            colX,
            rowY,
            totalGridW: xCursor,
            totalGridH: yCursor,
        };
    }

    /**
     * Create stage + masked floor background and return world-space floor metrics.
     *
     * @param {number} totalGridW
     * @param {number} totalGridH
     *
     * @returns {FloorGeometry}
     */
    addStageAndMaskedBackground(totalGridW, totalGridH) {
        const scene = this.scene;
        const { width } = scene.scale;

        const gridMarginTop = s(this.layout.gridMarginTop ?? 40);
        const gridMarginBottom = s(this.layout.gridMarginBottom ?? 40);
        const floorH = totalGridH + gridMarginTop + gridMarginBottom;
        const stageTop = s(10);
        const stageX = width / 2;
        const { stage, height: stageHeight } = createStage(scene, {
            label: this.layout.name,
            x: stageX,
            top: stageTop,
        });

        // Keep current visual spacing behavior: with equal margins this matches
        // prior `bleedHeight` placement while allowing independent top/bottom tuning.
        const gridStartY = stageTop + stageHeight + gridMarginTop / 2;
        const gridStartX = (width - totalGridW) / 2;
        const floorCenterY = gridStartY + totalGridH / 2 + gridMarginBottom / 2 - gridMarginTop / 2;

        const bgImg = scene.add.image(stageX, floorCenterY, this.layout.bgKey);
        const bgImgRatio = bgImg.width / bgImg.height;
        bgImg.setDisplaySize(floorH * bgImgRatio, floorH);

        // const bgMaskGraphic = scene.make.graphics();
        // bgMaskGraphic.fillRect(gridStartX, gridStartY, totalGridW, floorH);
        // bgImg.setMask(bgMaskGraphic.createGeometryMask());

        this.add(bgImg);
        this.add(stage);

        return {
            stageX,
            totalGridW,
            totalGridH,
            floorW: totalGridW,
            floorH,
            gridStartX,
            gridStartY,
            gridMarginTop,
            gridMarginBottom,
        };
    }

    /**
     * Compute horizontal per-row offsets for staggered seat layouts.
     *
     * Why this math:
     * - We center sparse rows under the densest row by adding half-seat shifts.
     * - We then subtract inherent offset caused by the first occupied column,
     *   so seat masks with different leading blanks still visually align.
     *
     * @returns {number[]}
     */
    computeStaggerRowOffsets() {
        const rows = this.layout.rows;
        const cols = this.layout.cols;
        const offsets = Array.from({ length: rows }, () => 0);

        if (!this.layout.staggered || !this.layout.seatMask) {
            return offsets;
        }

        const halfSeatStride = (SEAT_SIZE + SEAT_GAP) / 2;
        let maxSeatsInRow = 0;
        let firstColOfWidestRow = 0;

        for (let r = 0; r < rows; r++) {
            let seatCount = 0;
            let firstCol = -1;
            for (let c = 0; c < cols; c++) {
                if (!this.layout.seatMask[r][c]) {
                    continue;
                }
                seatCount++;
                if (firstCol < 0) {
                    firstCol = c;
                }
            }

            if (seatCount > maxSeatsInRow) {
                maxSeatsInRow = seatCount;
                firstColOfWidestRow = firstCol;
            }
        }

        for (let r = 0; r < rows; r++) {
            let rowSeatCount = 0;
            let firstSeatCol = firstColOfWidestRow;

            for (let c = 0; c < cols; c++) {
                if (!this.layout.seatMask[r][c]) {
                    continue;
                }
                rowSeatCount++;
                if (rowSeatCount === 1) {
                    firstSeatCol = c;
                }
            }

            const seatDiff = maxSeatsInRow - rowSeatCount;
            const centeredOffset = seatDiff * halfSeatStride;
            const inherentOffset = (firstSeatCol - firstColOfWidestRow) * (SEAT_SIZE + SEAT_GAP);
            offsets[r] = centeredOffset - inherentOffset;
        }

        return offsets;
    }

    /**
     * Add the "Red Carpet" decorative overlay for Blackbox center aisle gaps.
     *
     * @param {Set<number>} centerAisleGaps
     * @param {number[]} colX
     * @param {number} totalGridH
     * @param {FloorGeometry} floorGeometry
     */
    addBlackboxRedCarpet(centerAisleGaps, colX, totalGridH, floorGeometry) {
        if (this.layout.id !== "blackbox") {
            return;
        }

        const scene = this.scene;

        /**
         * @param {number} centerX
         * @param {number} aisleWidth
         */
        const drawAisleStrip = (centerX, aisleWidth) => {
            const borderInset = s(6);
            const stripW = Math.max(0, aisleWidth - borderInset);
            const centerY = floorGeometry.gridStartY + totalGridH / 2;

            const strip = scene.add
                .rectangle(
                    centerX,
                    centerY,
                    stripW,
                    totalGridH,
                    TheaterGrid.BLACKBOX_AISLE_COLOR,
                )
                .setStrokeStyle(s(2), TheaterGrid.BLACKBOX_AISLE_BORDER_COLOR);
            this.add(strip);

            for (
                let dy = floorGeometry.gridMarginTop + s(2);
                dy < floorGeometry.floorH - floorGeometry.gridMarginBottom;
                dy += s(14)
            ) {
                const dash = scene.add.rectangle(
                    centerX,
                    floorGeometry.gridStartY + dy + s(2),
                    s(2),
                    s(7),
                    TheaterGrid.BLACKBOX_AISLE_DASH_COLOR,
                );
                this.add(dash);
            }
        };

        for (const gapAfterCol of centerAisleGaps) {
            const leftEdge = colX[gapAfterCol] + SEAT_SIZE / 2 + s(1);
            const rightEdge = colX[gapAfterCol + 1] - SEAT_SIZE / 2 - s(1);

            drawAisleStrip((leftEdge + rightEdge) / 2, rightEdge - leftEdge);
        }
    }

    /**
     * Build all interactive seats and initial empty-state overlays.
     *
     * @param {number[]} colX
     * @param {number[]} rowY
     * @param {number[]} staggerRowOffsets
     */
    buildSeatGrid(colX, rowY, staggerRowOffsets) {
        const scene = this.scene;
        const rows = this.layout.rows;
        const cols = this.layout.cols;

        for (let row = 0; row < rows; row++) {
            this.seatGrid[row] = [];
            const y = rowY[row];
            const rowStagger = staggerRowOffsets[row] || 0;

            for (let col = 0; col < cols; col++) {
                if (!seatExists(row, col, this.layout)) {
                    this.seatGrid[row][col] = null;
                    continue;
                }

                const x = colX[col] + rowStagger;
                const seatStyle = this.getSeatStyle(row, col);

                const seat = scene.add
                    .rectangle(x, y, SEAT_SIZE, SEAT_SIZE, seatStyle.emptyFill)
                    .setStrokeStyle(seatStyle.strokeWidth, seatStyle.emptyStroke)
                    .setInteractive({ useHandCursor: true });

                seat.setData("row", row);
                seat.setData("col", col);
                seat.setData("occupied", false);
                seat.setData("emptyFill", seatStyle.emptyFill);
                seat.setData("emptyStroke", seatStyle.emptyStroke);
                seat.setData("strokeWidth", seatStyle.strokeWidth);

                seat.on("pointerover", () => this.callbacks.onSeatPointerOver?.(row, col, seat));
                seat.on("pointerout", () => this.callbacks.onSeatPointerOut?.(row, col, seat));
                seat.on("pointerdown", () => this.callbacks.onSeatPointerDown?.(row, col, seat));

                this.seatGrid[row][col] = seat;
                this.add(seat);

                if (hasSeatLabel(row, col, "front", this.layout)) {
                    this.addFrontSeatMarker(row, col, seat);
                }

                if (hasSeatLabel(row, col, "aisle", this.layout)) {
                    this.addAisleSeatGuide(row, col, seat);
                }

                if (hasSeatLabel(row, col, "box", this.layout)) {
                    this.addRoyalBoxTag(x, y);
                }
            }
        }
    }

    /**
     * Compute empty-seat visual style.
     *
     * @param {number} row
     * @param {number} col
     * @returns {SeatStyle}
     */
    getSeatStyle(row, col) {
        const isRoyalBox = hasSeatLabel(row, col, "box", this.layout);
        const isAisle = hasSeatLabel(row, col, "aisle", this.layout);

        if (isRoyalBox) {
            return {
                emptyFill: 0x2a2040,
                emptyStroke: 0xdaa520,
                strokeWidth: s(3),
            };
        }

        if (isAisle) {
            return {
                emptyFill: 0x1e1e38,
                emptyStroke: 0xb89a3e,
                strokeWidth: s(3),
            };
        }

        return {
            emptyFill: 0x1a1a3e,
            emptyStroke: 0x3a3a5e,
            strokeWidth: s(2),
        };
    }

    /**
     * Add a subtle crimson velvet strip on the stage-facing edge of front seats.
     * Also prepares a centered "F" badge (hidden by default) for guided highlighting.
     *
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    addFrontSeatMarker(row, col, seat) {
        const scene = this.scene;
        const seatBounds = this.getSeatBounds(seat);
        const key = `${row},${col}`;

        const strip = scene.add
            .rectangle(
                seat.x,
                seatBounds.top + s(3),
                seatBounds.width - s(6),
                s(5),
                TheaterGrid.FRONT_STRIP_COLOR,
                0.95,
            )
            .setStrokeStyle(s(1), TheaterGrid.FRONT_STRIP_GLOW_COLOR, 0.7);

        const badgeBg = scene.add
            .circle(0, 0, s(12), TheaterGrid.FRONT_STRIP_COLOR, 0.96)
            .setStrokeStyle(s(2), TheaterGrid.FRONT_STRIP_GLOW_COLOR, 0.9);
        const badgeText = scene.add
            .text(0, 0, "F", {
                fontFamily: "Arial",
                fontStyle: "bold",
                fontSize: `${Math.max(12, Math.round(s(14)))}px`,
                color: "#ffe7eb",
            })
            .setOrigin(0.5);

        const badge = scene.add.container(seat.x, seat.y, [badgeBg, badgeText]);
        badge.setVisible(false);

        this.frontSeatStrips.set(key, strip);
        this.frontSeatBadges.set(key, badge);

        this.add(strip);
        this.add(badge);
    }

    /**
     * Toggle front-seat guidance mode.
     *
     * - Velvet strip remains as static affordance when seat is empty.
     * - Optional pulse and "F" badges are only shown while guidance is active.
     *
     * @param {boolean} active
     * @param {{ showBadges?: boolean }} [options]
     */
    setFrontSeatGuidance(active, options = {}) {
        const { showBadges = false } = options;
        this.frontSeatGuidanceActive = active;
        this.frontSeatGuidanceShowBadges = showBadges;

        for (const [key, strip] of this.frontSeatStrips.entries()) {
            const [rowStr, colStr] = key.split(",");
            const row = Number(rowStr);
            const col = Number(colStr);
            const seat = this.getSeat(row, col);
            const isOccupied = !!seat?.getData("occupied");
            const badge = this.frontSeatBadges.get(key);

            strip.setVisible(!isOccupied);
            if (badge) {
                badge.setVisible(!isOccupied && active && showBadges);
            }

            if (!isOccupied && active) {
                if (!this.frontSeatPulseTweens.has(key)) {
                    const tween = this.scene.tweens.add({
                        targets: strip,
                        alpha: { from: 1, to: 0.45 },
                        duration: 1100,
                        yoyo: true,
                        repeat: -1,
                        ease: "Sine.easeInOut",
                    });
                    this.frontSeatPulseTweens.set(key, tween);
                }
            } else {
                const tween = this.frontSeatPulseTweens.get(key);
                if (tween) {
                    tween.stop();
                    this.frontSeatPulseTweens.delete(key);
                }
                strip.setAlpha(1);
            }
        }
    }

    /**
     * Add a guidance overlay + centered badge for aisle seats.
     * The overlay stays hidden unless aisle guidance is active.
     *
     * @param {number} row
     * @param {number} col
     * @param {Phaser.GameObjects.Rectangle} seat
     */
    addAisleSeatGuide(row, col, seat) {
        const scene = this.scene;
        const seatBounds = this.getSeatBounds(seat);
        const key = `${row},${col}`;

        const overlay = scene.add
            .rectangle(
                seat.x,
                seat.y,
                seatBounds.width - s(6),
                seatBounds.height - s(6),
                TheaterGrid.AISLE_GUIDE_COLOR,
                0.2,
            )
            .setStrokeStyle(s(1), TheaterGrid.AISLE_GUIDE_GLOW_COLOR, 0.85)
            .setVisible(false)
            .setAlpha(0.2);

        const badgeBg = scene.add
            .circle(0, 0, s(12), TheaterGrid.AISLE_GUIDE_COLOR, 0.96)
            .setStrokeStyle(s(2), TheaterGrid.AISLE_GUIDE_GLOW_COLOR, 0.9);
        const badgeText = scene.add
            .text(0, 0, "A", {
                fontFamily: "Arial",
                fontStyle: "bold",
                fontSize: `${Math.max(12, Math.round(s(14)))}px`,
                color: "#2d2204",
            })
            .setOrigin(0.5);

        const badge = scene.add.container(seat.x, seat.y, [badgeBg, badgeText]);
        badge.setVisible(false);

        this.aisleSeatGuides.set(key, overlay);
        this.aisleSeatBadges.set(key, badge);

        this.add(overlay);
        this.add(badge);
    }

    /**
     * Toggle aisle-seat guidance mode (used when Critic is selected).
     *
     * @param {boolean} active
     * @param {{ showBadges?: boolean }} [options]
     */
    setAisleSeatGuidance(active, options = {}) {
        const { showBadges = false } = options;
        this.aisleSeatGuidanceActive = active;
        this.aisleSeatGuidanceShowBadges = showBadges;

        for (const [key, overlay] of this.aisleSeatGuides.entries()) {
            const [rowStr, colStr] = key.split(",");
            const row = Number(rowStr);
            const col = Number(colStr);
            const seat = this.getSeat(row, col);
            const isOccupied = !!seat?.getData("occupied");
            const badge = this.aisleSeatBadges.get(key);

            overlay.setVisible(!isOccupied && active);
            if (badge) {
                badge.setVisible(!isOccupied && active && showBadges);
            }

            if (!isOccupied && active) {
                if (!this.aisleSeatPulseTweens.has(key)) {
                    const tween = this.scene.tweens.add({
                        targets: overlay,
                        alpha: { from: 0.2, to: 0.58 },
                        duration: 1100,
                        yoyo: true,
                        repeat: -1,
                        ease: "Sine.easeInOut",
                    });
                    this.aisleSeatPulseTweens.set(key, tween);
                }
            } else {
                const tween = this.aisleSeatPulseTweens.get(key);
                if (tween) {
                    tween.stop();
                    this.aisleSeatPulseTweens.delete(key);
                }
                overlay.setAlpha(0.2);
            }
        }
    }

    /**
     * Add a Royal Box tag at the provided seat center.
     *
     * @param {number} x
     * @param {number} y
     */
    addRoyalBoxTag(x, y) {
        const scene = this.scene;
        if (!scene.textures.exists(TheaterGrid.ROYAL_BOX_TAG_KEY)) {
            return;
        }

        const tag = scene.add
            .image(x, y, TheaterGrid.ROYAL_BOX_TAG_KEY)
            .setDisplaySize(TheaterGrid.ROYAL_BOX_TAG_SIZE, TheaterGrid.ROYAL_BOX_TAG_SIZE)
            .setAlpha(0.85);

        this.seatLabels.push(tag);
        this.add(tag);
    }

    /**
     * Draw horizontal dashed separators between row breaks.
     *
     * @param {Set<number>} rowBreaksAfter
     * @param {number[]} rowY
     * @param {number} totalGridW
     * @param {number} gridStartX
     */
    addRowBreakSeparators(rowBreaksAfter, rowY, totalGridW, gridStartX) {
        const scene = this.scene;

        for (const breakRow of rowBreaksAfter) {
            const y1 = rowY[breakRow] + SEAT_SIZE / 2;
            const y2 = rowY[breakRow + 1] - SEAT_SIZE / 2;
            const midY = (y1 + y2) / 2;

            for (let dx = 0; dx < totalGridW; dx += s(12)) {
                const line = scene.add
                    .rectangle(gridStartX + dx + s(3), midY, s(6), s(2), TheaterGrid.BREAK_LINE_COLOR)
                    .setAlpha(0.5)
                    .setDepth(5);
                this.add(line);
            }
        }
    }

    /**
     * Draw vertical dashed separators for both explicit gap columns and center
     * aisle gaps between adjacent columns.
     *
     * Blackbox still gets its additional red-carpet visual in those same gaps.
     *
     * @param {LayoutBreakMetadata} breakMetadata
     * @param {number[]} colX
     * @param {number} totalGridH
     * @param {number} gridStartY
     */
    addColumnBreakSeparators(breakMetadata, colX, totalGridH, gridStartY) {
        const separatorXs = new Set();

        // Explicit empty columns (e.g. Dinner Playhouse table columns).
        for (const gapCol of breakMetadata.gapCols) {
            separatorXs.add(colX[gapCol]);
        }

        // Center aisle breaks between adjacent columns.
        for (const gapAfterCol of breakMetadata.centerAisleGaps) {
            const midpoint = (colX[gapAfterCol] + colX[gapAfterCol + 1]) / 2;
            separatorXs.add(midpoint);
        }

        for (const midX of separatorXs) {
            this.addVerticalDashedLine(midX, gridStartY, totalGridH);
        }
    }

    /**
     * Draw a vertical dashed line at a fixed X coordinate.
     *
     * @param {number} x
     * @param {number} startY
     * @param {number} totalHeight
     */
    addVerticalDashedLine(x, startY, totalHeight) {
        const scene = this.scene;

        for (let dy = 0; dy < totalHeight; dy += s(12)) {
            const line = scene.add
                .rectangle(x, startY + dy + s(3), s(2), s(6), TheaterGrid.BREAK_LINE_COLOR)
                .setAlpha(0.5)
                .setDepth(5);
            this.add(line);
        }
    }

    /**
     * Get a seat rectangle object for row/column indices.
     *
     * @param {number} row
     * @param {number} col
     * @returns {Phaser.GameObjects.Rectangle | null}
     */
    getSeat(row, col) {
        return this.seatGrid[row]?.[col] ?? null;
    }

    /**
     * Destroy all seat overlay visuals (patron images, badges, tags, masks)
     * created during `renderPlacedCardOnSeat()` / `renderTheater()`.
     */
    clearSeatLabels() {
        for (const label of this.seatLabels) {
            label.destroy();
        }
        this.seatLabels = [];
    }

    /**
     * Compute basic seat bounds using seat dimensions with `SEAT_SIZE` fallback.
     *
     * @param {Phaser.GameObjects.Rectangle} seat
     * @returns {{ width: number, height: number, left: number, top: number, right: number, bottom: number }}
     */
    getSeatBounds(seat) {
        const width = seat.width ?? SEAT_SIZE;
        const height = seat.height ?? SEAT_SIZE;
        const left = seat.x - width / 2;
        const top = seat.y - height / 2;

        return {
            width,
            height,
            left,
            top,
            right: left + width,
            bottom: top + height,
        };
    }

    /**
     * Render a played patron card (and optional trait badge) on a seat.
     *
     * @param {Phaser.GameObjects.Rectangle} seat
     * @param {CardData} cardData
     * @param {{ animate?: boolean }} [options]
     * @returns {Phaser.GameObjects.GameObject[]}
     */
    renderPlacedCardOnSeat(seat, cardData, { animate = true } = {}) {
        const scene = this.scene;
        const seatBounds = this.getSeatBounds(seat);

        seat.setData("occupied", true);

        const row = Number(seat.getData("row"));
        const col = Number(seat.getData("col"));
        const frontKey = `${row},${col}`;
        const frontStrip = this.frontSeatStrips.get(frontKey);
        const frontBadge = this.frontSeatBadges.get(frontKey);
        if (frontStrip) {
            const pulse = this.frontSeatPulseTweens.get(frontKey);
            if (pulse) {
                pulse.stop();
                this.frontSeatPulseTweens.delete(frontKey);
            }
            frontStrip.setVisible(false);
            frontStrip.setAlpha(1);
        }
        if (frontBadge) {
            frontBadge.setVisible(false);
        }

        const aisleGuide = this.aisleSeatGuides.get(frontKey);
        const aisleBadge = this.aisleSeatBadges.get(frontKey);
        if (aisleGuide) {
            const pulse = this.aisleSeatPulseTweens.get(frontKey);
            if (pulse) {
                pulse.stop();
                this.aisleSeatPulseTweens.delete(frontKey);
            }
            aisleGuide.setVisible(false);
            aisleGuide.setAlpha(0.2);
        }
        if (aisleBadge) {
            aisleBadge.setVisible(false);
        }

        seat.setFillStyle(0x000000, 0);
        seat.setStrokeStyle(
            s(2),
            cardData.trait ? TraitColors[cardData.trait] || 0xffffff : 0x4a4a6a,
            0.8,
        );

        const baseImgKey = `patron_${cardData.type.toLowerCase()}`;
        const seatImgW = seatBounds.width - s(2);
        const seatImgH = seatImgW * (140 / 105);

        const baseImg = scene.add.image(seat.x, seat.y, baseImgKey);
        baseImg.setDisplaySize(seatImgW, seatImgH);
        baseImg.setPosition(seat.x, seat.y + seatImgH / 2 - seatBounds.height / 2);

        const seatMaskGraphic = scene.make.graphics();
        seatMaskGraphic.fillRect(seatBounds.left, seatBounds.top, seatBounds.width, seatBounds.height);
        baseImg.setMask(seatMaskGraphic.createGeometryMask());

        this.seatLabels.push(baseImg, seatMaskGraphic);
        this.add(baseImg);

        /** @type {Phaser.GameObjects.GameObject[]} */
        const visuals = [seat, baseImg];

        if (cardData.trait) {
            const badgeKey = `badge_${cardData.trait.toLowerCase()}`;
            const badge = scene.add.image(
                seatBounds.right - s(15),
                seatBounds.top + s(16),
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
     * Render an entire grid state into the theater seats.
     *
     * @param {(CardData | null)[][]} grid
     */
    renderTheater(grid) {
        this.clearSeatLabels();

        for (let row = 0; row < this.layout.rows; row++) {
            for (let col = 0; col < this.layout.cols; col++) {
                const seat = this.seatGrid[row]?.[col];
                if (!seat) {
                    continue;
                }

                const cardData = grid[row]?.[col] ?? null;
                if (cardData) {
                    this.renderPlacedCardOnSeat(seat, cardData, { animate: false });
                    continue;
                }

                seat.setData("occupied", false);

                const emptyFill = seat.getData("emptyFill") ?? 0x1a1a3e;
                const emptyStroke = seat.getData("emptyStroke") ?? 0x3a3a5e;
                const strokeWidth = seat.getData("strokeWidth") ?? s(2);
                seat.setFillStyle(emptyFill);
                seat.setStrokeStyle(strokeWidth, emptyStroke);

                if (hasSeatLabel(row, col, "box", this.layout)) {
                    this.addRoyalBoxTag(seat.x, seat.y);
                }
            }
        }

        // Re-apply seat guidance state after occupancy has been refreshed.
        this.setFrontSeatGuidance(this.frontSeatGuidanceActive, {
            showBadges: this.frontSeatGuidanceShowBadges,
        });
        this.setAisleSeatGuidance(this.aisleSeatGuidanceActive, {
            showBadges: this.aisleSeatGuidanceShowBadges,
        });
    }
}
