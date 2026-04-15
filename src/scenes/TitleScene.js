// @ts-check
import Phaser from "phaser";
import { loadSettings } from "../settings.js";
import { px, s } from "../config.js";
import { createButton } from "../objects/Button.js";
import { createLogo } from "../objects/Logo.js";
import { AIDifficulty } from "../ai.js";

/**
 * Title screen with player count selection and settings.
 */
export class TitleScene extends Phaser.Scene {
    constructor() {
        super("TitleScene");
    }

    create() {
        // Hydrate settings from localStorage into the Phaser registry
        loadSettings(this.registry);

        // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
        this.input.keyboard?.on("keydown-D", (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) {
                return;
            }

            console.log("DEBUG: Skipping to Player Setup (4 players)");
            this.scene.start("PlayerSetupScene", {
                playerCount: 4,
                aiConfig: Array.from(
                    { length: 4 },
                    (_, i) => i === 0 ? null : AIDifficulty.MEDIUM,
                ),
                playerColorMap: [0, 1, 2, 3],
            });
        });

        this.showMainMenu();
    }

    showMainMenu() {
        this.children.removeAll(true);
        this.tweens.killAll();

        const { width, height } = this.scale;

        // Title
        createLogo(this, width / 2, height / 4, { width: 480 });

        // Subtitle
        this.add
            .text(
                width / 2,
                height / 4 + s(120),
                "A Card Game of Seating Strategy\nSeat patrons in your theater to earn the most victory points!",
                {
                    fontSize: px(18),
                    fontFamily: "Georgia, serif",
                    color: "#aaaacc",
                    align: "center",
                    lineSpacing: 5,
                },
            )
            .setOrigin(0.5);

        // "How many players?" label
        this.add
            .text(width / 2, height / 2 - s(30), "How many players?", {
                fontSize: px(28),
                fontFamily: "Georgia, serif",
                color: "#ffd700",
            })
            .setOrigin(0.5);

        // Player count buttons
        const counts = [2, 3, 4];
        const buttonWidth = 180;
        const buttonHeight = Math.round(buttonWidth * 0.4704684318);
        const gap = s(30);
        const totalWidth = counts.length * s(buttonWidth) +
            (counts.length - 1) * gap;
        const startX = (width - totalWidth) / 2 + s(buttonWidth) / 2;

        for (let i = 0; i < counts.length; i++) {
            const count = counts[i];
            const bx = startX + i * (s(buttonWidth) + gap);
            const by = height / 2 + s(buttonHeight / 2);

            const { hitArea } = createButton(this, bx, by, `${count} Players`, {
                width: buttonWidth,
            });
            hitArea.on("pointerdown", () => {
                this.scene.start("PlayerSetupScene", {
                    playerCount: count,
                    aiConfig: Array.from(
                        { length: 4 },
                        (_, p) => p === 0 ? null : (p < count ? AIDifficulty.MEDIUM : null),
                    ),
                    playerColorMap: [0, 1, 2, 3],
                });
            });
        }

        // ── Settings section ────────────────────────────────────────────────
        this.add
            .text(width / 2, height / 2 + s(140), "Settings", {
                fontSize: px(18),
                fontFamily: "Georgia, serif",
                color: "#888899",
            })
            .setOrigin(0.5);

        const showAll = this.registry.get("showAllScores") ?? true;
        const toggleText = this.add
            .text(
                width / 2,
                height / 2 + s(175),
                `Show all scores: ${showAll ? "ON" : "OFF"}`,
                {
                    fontSize: px(16),
                    fontFamily: "Arial",
                    color: showAll ? "#66bb6a" : "#888899",
                    backgroundColor: "#2a2a4e",
                    padding: { x: s(16), y: s(8) },
                },
            )
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        toggleText.on(
            "pointerover",
            () => toggleText.setStyle({ color: "#f5c518" }),
        );
        toggleText.on("pointerout", () => {
            const current = this.registry.get("showAllScores") ?? true;
            toggleText.setStyle({ color: current ? "#66bb6a" : "#888899" });
        });

        toggleText.on("pointerdown", () => {
            const current = this.registry.get("showAllScores") ?? true;
            const next = !current;
            this.registry.set("showAllScores", next);
            toggleText.setText(`Show all scores: ${next ? "ON" : "OFF"}`);
            toggleText.setStyle({ color: next ? "#66bb6a" : "#888899" });
        });

        // Fullscreen button
        const fsBtn = this.add
            .text(width * 0.9, s(40), "⛶ Fullscreen", {
                fontSize: px(16),
                fontFamily: "Arial",
                color: "#ffffff",
                backgroundColor: "#2a2a4e",
                padding: { x: s(12), y: s(6) },
            })
            .setOrigin(0.5, 0)
            .setInteractive({ useHandCursor: true });

        fsBtn.on("pointerdown", () => {
            const el = /** @type {any} */ (document.documentElement);
            if (el.requestFullscreen) {
                el.requestFullscreen();
            } else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            } else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        });
    }
}
