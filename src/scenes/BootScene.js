// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { Layouts } from "../types.js";
import { ProgressBar } from "../objects/ProgressBar.js";

/**
 * Minimal boot scene that loads only the essential UI assets (logo + button frame)
 * and displays a progress bar. Transitions to TitleScene when done.
 */
export class BootScene extends Phaser.Scene {
    constructor() {
        super("BootScene");
    }

    preload() {
        const { width, height } = this.scale;

        // ── "Loading..." text (no images needed) ────────────────────────
        const loadingText = this.add
            .text(width / 2, height / 2 - s(40), "Loading...", {
                fontSize: px(24),
                fontFamily: "Georgia, serif",
                color: "#f5c518",
            })
            .setOrigin(0.5);

        // ── Progress bar ────────────────────────────────────────────────
        const barW = s(300);
        const barH = s(20);
        const progressBar = new ProgressBar(this, width / 2, height / 2 + barH / 2, barW, barH);

        this.load.on("progress", (/** @type {number} */ value) => {
            progressBar.updateProgress(value, barW);
        });

        this.load.on("complete", () => {
            loadingText.setText("Ready!");
            // Small delay then destroy loading visuals
            this.time.delayedCall(s(200), () => {
                progressBar.destroy();
                loadingText.destroy();
            });
        });

        // ── Load only essential UI assets ───────────────────────────────
        this.load.image("ui_logo", "assets/ui_logo.png");
        this.load.image("ui_button_frame", "assets/ui_button_frame.png");

        // ── Usher avatars (needed in TitleScene player setup) ────────────
        this.load.image("usher_blue", "assets/usher_blue.png");
        this.load.image("usher_red", "assets/usher_red.png");
        this.load.image("usher_green", "assets/usher_green.png");
        this.load.image("usher_orange", "assets/usher_orange.png");
    }

    debugTheaterStart() {
        // ── Check for VITE_START_THEATER env (via Vite, browser-safe) ─────
        const startTheater = import.meta.env.VITE_START_THEATER || undefined;
        if (startTheater) {
            // Import Layouts and find matching layout
            // Accept both layout id and layout name (case-insensitive)
            let layoutId;
            // Prefer ID match first
            for (const id of Object.keys(Layouts)) {
                if (id.toLowerCase() === startTheater.toLowerCase()) {
                    layoutId = id;
                    break;
                }
            }

            if (layoutId && Layouts[layoutId]) {
                // Second player is always AI in this mode
                this.scene.start("GameScene", { layoutId, aiConfig: [null, "Normal"] });
            } else {
                // fallback if invalid ENV provided
                console.warn(
                    `[BootScene] Invalid VITE_START_THEATER: '${startTheater}'. Starting normally.`,
                );
            }
        }
    }

    create() {
        const startTheater = import.meta.env.VITE_START_THEATER;

        if (startTheater) {
            this.debugTheaterStart();
        } else {
            this.scene.start("TitleScene");
        }
    }
}
