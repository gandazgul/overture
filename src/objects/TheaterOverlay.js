// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";
import { TheaterGrid } from "./TheaterGrid.js";
import { createButton } from "../factories/Button.js";
import { PlayerNames } from "../types.js";

/**
 * Overlay modal to view players' theaters mid-game or post-game.
 */
export class TheaterOverlay extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} options
     * @param {import('../types.js').LayoutMeta} options.layout
     * @param {(import('../types.js').CardData | null)[][][]} options.placedPatrons
     * @param {number} options.playerCount
     * @param {number} options.initialPlayerIndex
     * @param {() => void} [options.onClose]
     */
    constructor(scene, options) {
        super(scene, 0, 0);

        this.layout = options.layout;
        this.placedPatrons = options.placedPatrons;
        this.playerCount = options.playerCount;
        this.currentPlayerView = options.initialPlayerIndex || 0;
        this.onClose = options.onClose;

        this.setDepth(1000); // Overlay HUD and other UI elements

        const { width, height } = scene.scale;

        // Background dark overlay
        const bg = scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.90)
            .setInteractive(); // Stop click propagation to elements beneath
        this.add(bg);

        const btnY = height - s(60);

        // Header text for player's theater (moved above buttons)
        this.headerText = scene.add
            .text(width / 2, btnY - s(80), "", {
                fontSize: px(34),
                fontFamily: "Georgia, serif",
                color: "#f5c518",
                fontStyle: "italic",
                shadow: { blur: 4, color: "#000000", fill: true, stroke: true },
            })
            .setOrigin(0.5);
        this.add(this.headerText);

        // Close button
        const closeY = s(55);
        const { container: closeBtn, hitArea: closeHit } = createButton(
            scene,
            width - s(120),
            closeY,
            "Close",
            { fontSize: 18, width: 140 },
        );
        closeHit.on("pointerdown", () => {
            this.onClose?.();
            this.destroy(); // Safely removes graphics and container
        });
        this.add(closeBtn);

        // Next / Prev buttons for multi-player games
        if (this.playerCount > 1) {
            const { container: prevBtn, hitArea: prevHit } = createButton(
                scene,
                width / 2 - s(200),
                btnY,
                "< Previous",
                { fontSize: 20, width: 180 },
            );
            prevHit.on("pointerdown", () => this.cycle(-1));
            this.add(prevBtn);

            const { container: nextBtn, hitArea: nextHit } = createButton(
                scene,
                width / 2 + s(200),
                btnY,
                "Next >",
                { fontSize: 20, width: 180 },
            );
            nextHit.on("pointerdown", () => this.cycle(1));
            this.add(nextBtn);
        }

        /** @type {TheaterGrid | null} */
        this.theaterGrid = null;

        this.renderView();

        scene.add.existing(this);
    }

    /**
     * Cycles to the next or previous player.
     * @param {number} direction
     */
    cycle(direction) {
        this.currentPlayerView = (this.currentPlayerView + direction + this.playerCount) % this.playerCount;
        this.renderView();
    }

    renderView() {
        const isAI = /** @type {any} */ (this.scene).aiConfig?.[this.currentPlayerView];
        const nameLabel = isAI
            ? `${PlayerNames[this.currentPlayerView].replace("Player ", "P")} 🤖`
            : PlayerNames[this.currentPlayerView];

        this.headerText.setText(`${nameLabel}'s Theater`);

        if (this.theaterGrid) {
            this.theaterGrid.destroy();
        }

        // Initialize grid component logic (without active seat callbacks since it's view-only)
        this.theaterGrid = new TheaterGrid(this.scene, {
            layout: this.layout,
        });

        this.theaterGrid.build();
        this.theaterGrid.renderTheater(this.placedPatrons[this.currentPlayerView]);

        // Disable front & aisle pulse guidance
        this.theaterGrid.setFrontSeatGuidance(false);
        this.theaterGrid.setAisleSeatGuidance(false);

        this.add(this.theaterGrid);
        // Ensure the theater is drawn beneath the overlay UI controls (buttons, header)
        this.theaterGrid.setDepth(-1);
    }
}
