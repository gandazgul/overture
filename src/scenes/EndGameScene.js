// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { PatronTypeOrder, PlayerColors, PlayerColorsHex, PlayerNames } from "../types.js";
import { scorePlayer } from "../scoring.js";
import { createButton } from "../objects/Button.js";

/** Usher avatar texture keys, indexed by player index. */
const USHER_KEYS = ["usher_blue", "usher_red", "usher_green", "usher_orange"];

/**
 * End-game scene — polished scorecard styled to match the title screen.
 */
export class EndGameScene extends Phaser.Scene {
    /** @type {number} Player count (set in init, before create). */
    playerCount = 2;
    /** @type {import('../types.js').LayoutMeta} Layout metadata (set in init, before create). */
    layout = /** @type {*} */ (null);
    /** @type {(import('../types.js').CardData | null)[][][]} Per-player grids (set in init, before create). */
    placedPatrons = /** @type {*} */ ([]);
    /** @type {number[]} Maps player slot → color index. */
    playerColorMap = [0, 1, 2, 3];
    /** @type {(string | null)[]} AI config per player. */
    aiConfig = [null, null, null, null];

    constructor() {
        super("EndGameScene");
    }

    /** Get color index for player. */
    colorOf(/** @type {number} */ p) {
        return this.playerColorMap[p] ?? p;
    }

    /**
     * @param {{ playerCount: number, layout: import('../types.js').LayoutMeta, placedPatrons: (import('../types.js').CardData | null)[][][], playerColorMap?: number[], aiConfig?: (string | null)[] }} data
     */
    init(data) {
        this.playerCount = data.playerCount || 2;
        this.layout = data.layout;
        this.placedPatrons = data.placedPatrons;
        this.playerColorMap = data.playerColorMap || Array.from({ length: this.playerCount }, (_, i) => i);
        this.aiConfig = data.aiConfig || Array.from({ length: this.playerCount }, () => null);
    }

    create() {
        const { width, height } = this.scale;

        // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
        this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) return;
            console.log("DEBUG: Skipping to TitleScene");
            this.scene.start("TitleScene");
        });

        // ── Dark background ─────────────────────────────────────────────
        this.cameras.main.setBackgroundColor(0x0a0a1a);

        // ── Logo (same position as TitleScene) ──────────────────────────
        if (this.textures.exists("ui_logo")) {
            const titleLogo = this.add.image(
                width / 2,
                height / 5 - s(30),
                "ui_logo",
            );
            const logoRatio = 0.3643695015;
            const logoWidth = 480;
            titleLogo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio));
        } else {
            this.add
                .text(width / 2, height / 4 - s(30), "Overture", {
                    fontSize: px(52),
                    fontFamily: "Georgia, serif",
                    color: "#f5c518",
                })
                .setOrigin(0.5);
        }

        // ── Compute scores ──────────────────────────────────────────────
        /** @type {import('../scoring.js').PlayerScore[]} */
        const playerScores = [];
        /** @type {number[]} */
        const totals = [];
        for (let p = 0; p < this.playerCount; p++) {
            const result = scorePlayer(this.placedPatrons[p], this.layout);
            playerScores.push(result);
            totals.push(result.total);
        }

        // Per-type VP breakdown: typeVP[playerIdx][patronType] = sum
        /** @type {Record<string, number>[]} */
        const typeVP = [];
        for (let p = 0; p < this.playerCount; p++) {
            /** @type {Record<string, number>} */
            const breakdown = {};
            for (const t of PatronTypeOrder) breakdown[t] = 0;
            const grid = this.placedPatrons[p];
            for (let r = 0; r < this.layout.rows; r++) {
                for (let c = 0; c < this.layout.cols; c++) {
                    const card = grid[r][c];
                    if (card) {
                        breakdown[card.type] = (breakdown[card.type] || 0) +
                            playerScores[p].perSeat[r][c];
                    }
                }
            }
            typeVP.push(breakdown);
        }

        // ── Winner announcement ─────────────────────────────────────────
        const maxScore = Math.max(...totals);
        const winners = totals
            .map((sc, i) => (sc === maxScore ? PlayerNames[i] : null))
            .filter(Boolean);
        const isTie = winners.length > 1;
        const winnerMsg = isTie ? `It's a tie! ${winners.join(" & ")}` : `🏆 ${winners[0]} wins! 🏆`;

        const winnerY = height / 4 + s(50);
        this.add
            .text(width / 2, winnerY, winnerMsg, {
                fontSize: px(isTie ? 22 : 26),
                fontFamily: "Georgia, serif",
                color: "#f5c518",
            })
            .setOrigin(0.5);

        // ── Scoring Card Table ──────────────────────────────────────────
        const tableTop = winnerY + s(45);
        const tableBottom = height - s(90);
        const tableAvailH = tableBottom - tableTop;

        // Columns: label column + one per player
        const labelColW = s(130);
        const playerColW = s(this.playerCount <= 3 ? 140 : 115);
        const tableW = labelColW + this.playerCount * playerColW;
        const tableLeft = (width - tableW) / 2;

        // Rows: avatar header + 6 patron types + divider + total = 9 visual rows
        const avatarRowH = s(70);
        const dataRowCount = PatronTypeOrder.length;
        const totalRowH = s(38);
        const dataRowH = Math.min(
            s(34),
            (tableAvailH - avatarRowH - totalRowH - s(10)) / dataRowCount,
        );

        const gold = 0xd4af37;
        const darkBg = 0x12122a;
        const altBg = 0x181838;

        const gfx = this.add.graphics();

        // ── Table outer border + background ─────────────────────────────
        const fullTableH = avatarRowH + dataRowCount * dataRowH + s(4) + totalRowH;
        gfx.fillStyle(darkBg, 0.95);
        gfx.fillRoundedRect(
            tableLeft - s(4),
            tableTop - s(4),
            tableW + s(8),
            fullTableH + s(8),
            s(8),
        );
        gfx.lineStyle(s(2), gold, 0.8);
        gfx.strokeRoundedRect(
            tableLeft - s(4),
            tableTop - s(4),
            tableW + s(8),
            fullTableH + s(8),
            s(8),
        );

        // ── Avatar header row ───────────────────────────────────────────
        const headerY = tableTop;
        // "Score Card" label in top-left
        this.add
            .text(tableLeft + labelColW / 2, headerY + avatarRowH / 2, "Score Card", {
                fontSize: px(13),
                fontFamily: "Georgia, serif",
                color: "#d4af37",
                fontStyle: "italic",
            })
            .setOrigin(0.5);

        for (let p = 0; p < this.playerCount; p++) {
            const colX = tableLeft + labelColW + p * playerColW + playerColW / 2;

            // Usher avatar
            const avatarSize = s(36);
            const usherKey = USHER_KEYS[this.colorOf(p)];
            if (this.textures.exists(usherKey)) {
                const avatar = this.add.image(colX, headerY + s(22), usherKey);
                avatar.setDisplaySize(avatarSize, avatarSize);
                // Circular mask
                const maskGfx = this.add.graphics();
                maskGfx.fillCircle(colX, headerY + s(22), avatarSize / 2);
                avatar.setMask(maskGfx.createGeometryMask());
            }

            // Player name
            const isAI = !!this.aiConfig[p];
            const nameLabel = isAI
                ? `${PlayerNames[p].replace("Player ", "P")} \uD83E\uDD16`
                : PlayerNames[p].replace("Player ", "P");
            this.add
                .text(colX, headerY + s(46), nameLabel, {
                    fontSize: px(11),
                    fontFamily: "Georgia, serif",
                    color: PlayerColors[this.colorOf(p)],
                    fontStyle: "bold",
                })
                .setOrigin(0.5, 0);

            // Colored underline
            gfx.lineStyle(s(2), PlayerColorsHex[this.colorOf(p)], 0.7);
            gfx.lineBetween(
                colX - playerColW / 2 + s(10),
                headerY + avatarRowH - s(2),
                colX + playerColW / 2 - s(10),
                headerY + avatarRowH - s(2),
            );
        }

        // Horizontal line under header
        gfx.lineStyle(s(1), gold, 0.5);
        gfx.lineBetween(
            tableLeft,
            headerY + avatarRowH,
            tableLeft + tableW,
            headerY + avatarRowH,
        );

        // ── Data rows (one per patron type) ─────────────────────────────
        const dataStartY = headerY + avatarRowH;

        for (let i = 0; i < PatronTypeOrder.length; i++) {
            const type = PatronTypeOrder[i];
            const rowY = dataStartY + i * dataRowH;

            // Alternating row background
            if (i % 2 === 1) {
                gfx.fillStyle(altBg, 0.5);
                gfx.fillRect(tableLeft, rowY, tableW, dataRowH);
            }

            // Row label: type name
            this.add
                .text(
                    tableLeft + s(10),
                    rowY + dataRowH / 2,
                    type,
                    {
                        fontSize: px(12),
                        fontFamily: "Georgia, serif",
                        color: "#ccccdd",
                    },
                )
                .setOrigin(0, 0.5);

            // Player values
            for (let p = 0; p < this.playerCount; p++) {
                const colX = tableLeft + labelColW + p * playerColW + playerColW / 2;
                const vp = typeVP[p][type];
                const color = vp < 0 ? "#ff6666" : vp > 0 ? "#ffffff" : "#666677";

                this.add
                    .text(colX, rowY + dataRowH / 2, `${vp}`, {
                        fontSize: px(13),
                        fontFamily: "Arial",
                        color,
                        fontStyle: vp !== 0 ? "bold" : "",
                    })
                    .setOrigin(0.5);
            }

            // Horizontal line
            gfx.lineStyle(s(1), gold, 0.15);
            gfx.lineBetween(
                tableLeft,
                rowY + dataRowH,
                tableLeft + tableW,
                rowY + dataRowH,
            );
        }

        // ── Total row ───────────────────────────────────────────────────
        const totalY = dataStartY + dataRowCount * dataRowH + s(4);

        // Gold background for totals
        gfx.fillStyle(gold, 0.12);
        gfx.fillRect(tableLeft, totalY, tableW, totalRowH);
        gfx.lineStyle(s(2), gold, 0.6);
        gfx.lineBetween(tableLeft, totalY, tableLeft + tableW, totalY);

        // "Total" label
        this.add
            .text(tableLeft + s(10), totalY + totalRowH / 2, "Total VP", {
                fontSize: px(14),
                fontFamily: "Georgia, serif",
                color: "#d4af37",
                fontStyle: "bold",
            })
            .setOrigin(0, 0.5);

        // Player totals
        for (let p = 0; p < this.playerCount; p++) {
            const colX = tableLeft + labelColW + p * playerColW + playerColW / 2;
            const isWinner = totals[p] === maxScore;

            this.add
                .text(colX, totalY + totalRowH / 2, `${totals[p]}`, {
                    fontSize: px(isWinner ? 18 : 15),
                    fontFamily: "Georgia, serif",
                    color: isWinner ? "#f5c518" : "#ccccdd",
                    fontStyle: "bold",
                })
                .setOrigin(0.5);

            // Trophy for winner
            if (isWinner) {
                this.add
                    .text(colX + s(18), totalY + totalRowH / 2 - s(1), "🏆", {
                        fontSize: px(12),
                    })
                    .setOrigin(0, 0.5);
            }
        }

        // Vertical separator lines (label | player cols)
        gfx.lineStyle(s(1), gold, 0.3);
        gfx.lineBetween(
            tableLeft + labelColW,
            tableTop,
            tableLeft + labelColW,
            totalY + totalRowH,
        );
        for (let p = 1; p < this.playerCount; p++) {
            const lineX = tableLeft + labelColW + p * playerColW;
            gfx.lineStyle(s(1), gold, 0.15);
            gfx.lineBetween(lineX, tableTop, lineX, totalY + totalRowH);
        }

        // ── Play Again Button ───────────────────────────────────────────
        const { hitArea: playAgainHit } = createButton(
            this,
            width / 2,
            height - s(140),
            "Play Again",
            { fontSize: 20 },
        );
        playAgainHit.on("pointerdown", () => {
            this.scene.start("TitleScene");
        });
    }
}
