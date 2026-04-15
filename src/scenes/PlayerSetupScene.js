// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { createButton } from "../factories/Button.js";
import { createLogo } from "../factories/Logo.js";
import { AIDifficulty } from "../ai.js";
import { PlayerColors, PlayerColorsHex } from "../types.js";

/** Usher avatar texture keys indexed by color slot. */
const USHER_KEYS = ["usher_blue", "usher_red", "usher_green", "usher_orange"];

/**
 * Scene for configuring players (human/AI, difficulty, and colors).
 */
export class PlayerSetupScene extends Phaser.Scene {
    constructor() {
        super("PlayerSetupScene");

        /** @type {number} */
        this.selectedPlayerCount = 2;

        /**
         * AI config per player slot: null = human, string = AI difficulty.
         * Index 0 is always human (the local player).
         * @type {(string | null)[]}
         */
        this.aiConfig = [null, AIDifficulty.MEDIUM, null, null];

        /**
         * Maps player slot → color index. Players can swap colors.
         * Default: [0, 1, 2, 3] (blue, red, green, orange).
         * @type {number[]}
         */
        this.playerColorMap = [0, 1, 2, 3];
    }

    /**
     * @param {{ playerCount?: number, aiConfig?: (string | null)[], playerColorMap?: number[] }} [data]
     */
    init(data) {
        const count = data?.playerCount ?? 2;
        this.selectedPlayerCount = count;
        this.aiConfig = data?.aiConfig ||
            Array.from({ length: 4 }, (_, i) => i === 0 ? null : (i < count ? AIDifficulty.MEDIUM : null));
        this.playerColorMap = data?.playerColorMap || [0, 1, 2, 3];
    }

    create() {
        this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }
            console.log("DEBUG: Skipping to Theater Selection");
            const count = this.selectedPlayerCount;
            this.scene.start("TheaterSelectionScene", {
                playerCount: count,
                aiConfig: this.aiConfig.slice(0, count),
                playerColorMap: this.playerColorMap.slice(0, count),
            });
        });

        this.showPlayerSetup();
    }

    showPlayerSetup() {
        this.children.removeAll(true);
        this.tweens.killAll();

        const { width } = this.scale;
        const count = this.selectedPlayerCount;

        const difficulties = [AIDifficulty.EASY, AIDifficulty.MEDIUM, AIDifficulty.HARD];
        const diffLabels = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: "Easy",
            [AIDifficulty.MEDIUM]: "Medium",
            [AIDifficulty.HARD]: "Hard",
        });
        const diffDots = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: "🟢",
            [AIDifficulty.MEDIUM]: "🟡",
            [AIDifficulty.HARD]: "🔴",
        });
        const diffTextColors = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: "#66bb6a",
            [AIDifficulty.MEDIUM]: "#ffa726",
            [AIDifficulty.HARD]: "#ef5350",
        });

        // ── Header ──────────────────────────────────────────────────
        const logoY = s(90);
        createLogo(this, width / 2, logoY, { width: 320 });

        this.add
            .text(width / 2, logoY + s(100), "Player Setup", {
                fontSize: px(28),
                fontFamily: "Georgia, serif",
                color: "#ffd700",
            })
            .setOrigin(0.5);

        // ── Table dimensions ────────────────────────────────────────
        const tableW = s(600);
        const rowH = s(68);
        const headerH = s(34);
        const tableX = (width - tableW) / 2;
        const tableY = logoY + s(160);

        // Column X positions (center-based, relative to tableX)
        const colAvatar = s(38);
        const colName = s(78);
        const colColor = s(230);
        const colType = s(370);
        const colDiff = s(520);

        const totalH = headerH + count * rowH;

        // Table background
        this.add.rectangle(
            tableX + tableW / 2,
            tableY + totalH / 2,
            tableW,
            totalH,
            0x12122a,
            0.9,
        ).setStrokeStyle(s(2), 0x3a3a6a);

        // ── Table header ────────────────────────────────────────────
        const hdrY = tableY + headerH / 2;
        this.add.rectangle(
            tableX + tableW / 2,
            hdrY,
            tableW,
            headerH,
            0x1a1a3e,
        );

        /** @type {Phaser.Types.GameObjects.Text.TextStyle} */
        const hdrStyle = { fontSize: px(16), fontFamily: "Arial", color: "#888899" };
        this.add.text(tableX + colName, hdrY, "Player", hdrStyle).setOrigin(0, 0.5);
        this.add.text(tableX + colColor, hdrY, "Color", hdrStyle).setOrigin(0.5, 0.5);
        this.add.text(tableX + colType, hdrY, "Type", hdrStyle).setOrigin(0.5, 0.5);
        this.add.text(tableX + colDiff, hdrY, "Difficulty", hdrStyle).setOrigin(0.5, 0.5);

        // ── Player rows ─────────────────────────────────────────────
        for (let p = 0; p < count; p++) {
            const rowCY = tableY + headerH + p * rowH + rowH / 2;
            const ci = this.playerColorMap[p];
            const isFirstPlayer = p === 0;

            if (p % 2 === 1) {
                this.add.rectangle(
                    tableX + tableW / 2,
                    rowCY,
                    tableW,
                    rowH,
                    0x1a1a30,
                    0.5,
                );
            }

            if (p > 0) {
                this.add.rectangle(
                    tableX + tableW / 2,
                    rowCY - rowH / 2,
                    tableW - s(16),
                    s(1),
                    0x3a3a6a,
                    0.4,
                );
            }

            // ── Avatar ──────────────────────────────────────────────
            const ax = tableX + colAvatar;
            const usherKey = USHER_KEYS[ci];
            if (this.textures.exists(usherKey)) {
                const avatar = this.add.image(ax, rowCY, usherKey);
                avatar.setDisplaySize(s(44), s(44));
                const maskGfx = this.make.graphics();
                maskGfx.fillStyle(0xffffff);
                maskGfx.fillCircle(ax, rowCY, s(22));
                avatar.setMask(maskGfx.createGeometryMask());
                this.add.circle(ax, rowCY, s(22), 0x000000, 0)
                    .setStrokeStyle(s(2), PlayerColorsHex[ci]);
            }

            this.add
                .text(tableX + colName, rowCY, `Player ${p + 1}`, {
                    fontSize: px(16),
                    fontFamily: "Georgia, serif",
                    color: PlayerColors[ci],
                    fontStyle: "bold",
                })
                .setOrigin(0, 0.5);

            // ── Color swatches ──────────────────────────────────────
            const swatchR = s(11);
            const swatchGap = s(28);
            const swatchStartX = tableX + colColor - (3 * swatchGap) / 2;

            for (let c = 0; c < 4; c++) {
                const sx = swatchStartX + c * swatchGap;
                const isActive = this.playerColorMap[p] === c;
                const swatch = this.add.circle(
                    sx,
                    rowCY,
                    swatchR,
                    PlayerColorsHex[c],
                    isActive ? 1 : 0.25,
                )
                    .setStrokeStyle(isActive ? s(3) : s(1), isActive ? 0xffffff : 0x555577)
                    .setInteractive({ useHandCursor: true });

                swatch.on("pointerdown", () => {
                    if (this.playerColorMap[p] === c) {
                        return;
                    }
                    const owner = this.playerColorMap.indexOf(c);
                    if (owner >= 0 && owner < count) {
                        this.playerColorMap[owner] = this.playerColorMap[p];
                    }
                    this.playerColorMap[p] = c;
                    this.showPlayerSetup();
                });
            }

            // ── Type toggle ─────────────────────────────────────────
            if (isFirstPlayer) {
                this.add
                    .text(tableX + colType, rowCY, "👤 Human", {
                        fontSize: px(16),
                        fontFamily: "Arial",
                        color: "#66bb6a",
                    })
                    .setOrigin(0.5, 0.5);

                this.add
                    .text(tableX + colDiff, rowCY, "—", {
                        fontSize: px(16),
                        fontFamily: "Arial",
                        color: "#555566",
                    })
                    .setOrigin(0.5, 0.5);
                continue;
            }

            const isAI = this.aiConfig[p] !== null;
            const typeBtn = this.add
                .text(tableX + colType, rowCY, isAI ? "🤖 AI" : "👤 Human", {
                    fontSize: px(16),
                    fontFamily: "Arial",
                    color: isAI ? "#ffa726" : "#66bb6a",
                    backgroundColor: "#2a2a4e",
                    padding: { x: s(12), y: s(5) },
                })
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true });

            const currentDiff = this.aiConfig[p] || AIDifficulty.MEDIUM;
            const diffBtn = this.add
                .text(
                    tableX + colDiff,
                    rowCY,
                    `${diffDots[currentDiff]} ${diffLabels[currentDiff]}`,
                    {
                        fontSize: px(16),
                        fontFamily: "Arial",
                        color: diffTextColors[currentDiff] || "#ffa726",
                        backgroundColor: "#2a2a4e",
                        padding: { x: s(10), y: s(5) },
                    },
                )
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true })
                .setVisible(isAI);

            if (!isAI) {
                this.add
                    .text(tableX + colDiff, rowCY, "—", {
                        fontSize: px(14),
                        fontFamily: "Arial",
                        color: "#555566",
                    })
                    .setOrigin(0.5, 0.5);
            }

            typeBtn.on("pointerdown", () => {
                if (this.aiConfig[p] === null) {
                    this.aiConfig[p] = AIDifficulty.MEDIUM;
                } else {
                    this.aiConfig[p] = null;
                }
                this.showPlayerSetup();
            });

            diffBtn.on("pointerdown", () => {
                const idx = difficulties.indexOf(/** @type {typeof difficulties[number]} */ (this.aiConfig[p]));
                const next = difficulties[(idx + 1) % difficulties.length];
                this.aiConfig[p] = next;
                this.showPlayerSetup();
            });
        }

        // ── Next button ─────────────────────────────────────────────
        const btnY = tableY + totalH + s(85);
        const { hitArea: nextHit } = createButton(
            this,
            width / 2,
            btnY,
            "Next →",
            { fontSize: 18, width: 200 },
        );
        nextHit.on("pointerdown", () => {
            this.scene.start("TheaterSelectionScene", {
                playerCount: count,
                aiConfig: this.aiConfig.slice(0, count),
                playerColorMap: this.playerColorMap.slice(0, count),
            });
        });

        // ── Back button ─────────────────────────────────────────────
        const backBtn = this.add
            .text(s(20), s(20), "← Back", {
                fontSize: px(16),
                fontFamily: "Arial",
                color: "#888899",
            })
            .setInteractive({ useHandCursor: true });

        backBtn.on("pointerover", () => backBtn.setStyle({ color: "#f5c518" }));
        backBtn.on("pointerout", () => backBtn.setStyle({ color: "#888899" }));
        backBtn.on("pointerdown", () => this.scene.start("TitleScene"));
    }
}
