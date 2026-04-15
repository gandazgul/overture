// @ts-check
import Phaser from "phaser";
import { px, s } from "../config.js";

/**
 * @typedef {{ total: number, label: string }} ScoreRow
 */

/**
 * Right-side HUD panel with round/deck info and player scores.
 */
export class GameInfoPanel extends Phaser.GameObjects.Container {
    /** @type {Phaser.GameObjects.Text} */
    turnText;

    /** @type {Phaser.GameObjects.Text} */
    deckText;

    /** @type {Phaser.GameObjects.Container[]} */
    scorePanels = [];

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {{
     *   width?: number,
     *   playerCount: number,
     *   houseRuleDescription?: string,
     *   playerColor: (player: number) => string,
     *   playerColorHex: (player: number) => number,
     *   usherKey: (player: number) => string,
     * }} options
     */
    constructor(scene, x, y, options) {
        super(scene, x, y);

        const {
            width = s(260),
            playerCount,
            houseRuleDescription,
            playerColor,
            playerColorHex,
            usherKey,
        } = options;

        this.setDepth(150);

        const scoreHeight = s(playerCount * 48);
        const houseRuleExtra = houseRuleDescription ? s(60) : 0;
        const panelBg = scene.add.rectangle(
            0,
            0,
            width,
            s(90) + scoreHeight + houseRuleExtra,
            0x0f0f1c,
            0.95,
        )
            .setOrigin(0, 0)
            .setStrokeStyle(s(3), 0xd4af37);
        this.add(panelBg);

        const turnTextY = s(20);
        this.turnText = scene.add
            .text(width / 2, turnTextY, "", {
                fontSize: px(20),
                fontFamily: "Georgia, serif",
                color: "#d4af37",
                fontStyle: "bold",
            })
            .setOrigin(0.5, 0);
        this.add(this.turnText);

        const deckTextY = turnTextY + s(30);
        this.deckText = scene.add
            .text(width / 2, deckTextY, "", {
                fontSize: px(15),
                fontFamily: "Georgia, serif",
                color: "#aaaacc",
            })
            .setOrigin(0.5, 0);
        this.add(this.deckText);

        const scoreStartY = deckTextY + s(30);
        for (let p = 0; p < playerCount; p++) {
            const panel = scene.add.container(s(15), scoreStartY + p * s(48));
            const key = usherKey(p);

            if (scene.textures.exists(key)) {
                const avatar = scene.add.image(s(18), s(18), key);
                avatar.setDisplaySize(s(32), s(32));

                const mask = scene.make.graphics();
                mask.fillStyle(0xffffff);
                mask.fillCircle(
                    x + s(15) + s(18),
                    y + scoreStartY + p * s(48) + s(18),
                    s(16),
                );
                avatar.setMask(mask.createGeometryMask());

                const ring = scene.add.circle(s(18), s(18), s(16), 0x000000, 0)
                    .setStrokeStyle(s(2), playerColorHex(p));
                panel.add([avatar, ring]);
            }

            const text = scene.add
                .text(s(46), s(18), "", {
                    fontSize: px(15),
                    fontFamily: "Georgia, serif",
                    color: playerColor(p),
                    fontStyle: "bold",
                })
                .setOrigin(0, 0.5);

            panel.setData("text", text);
            panel.add(text);
            this.add(panel);
            this.scorePanels.push(panel);
        }

        if (houseRuleDescription) {
            const ruleY = scoreStartY + scoreHeight + s(10);
            const divider = scene.add.rectangle(
                width / 2,
                ruleY,
                width - s(30),
                s(1),
                0xd4af37,
                0.4,
            ).setOrigin(0.5, 0);
            this.add(divider);

            const ruleText = scene.add.text(
                width / 2,
                ruleY + s(8),
                houseRuleDescription,
                {
                    fontSize: px(11),
                    fontFamily: "Georgia, serif",
                    color: "#f5c518",
                    fontStyle: "italic",
                    wordWrap: { width: width - s(24) },
                    align: "center",
                },
            ).setOrigin(0.5, 0);
            this.add(ruleText);
        }

        scene.add.existing(this);
    }

    /**
     * @param {number} round
     * @param {number} totalRounds
     * @param {number} deckCount
     */
    setRoundDeck(round, totalRounds, deckCount) {
        this.turnText.setText(`Round ${round} / ${totalRounds}`);
        this.deckText.setText(`Deck: ${deckCount}`);
    }

    /**
     * @param {ScoreRow[]} rows
     * @param {boolean} showAll
     * @param {number} currentPlayer
     */
    setScores(rows, showAll, currentPlayer) {
        for (let p = 0; p < this.scorePanels.length; p++) {
            const panel = this.scorePanels[p];
            if (!panel) {
                continue;
            }

            const row = rows[p];
            if (!row) {
                panel.setVisible(false);
                continue;
            }

            const text = panel.getData("text");
            text.setText(`${row.label}: ${row.total} VP`);

            if (showAll || p === currentPlayer) {
                panel.setAlpha(p === currentPlayer ? 1 : 0.6);
                panel.setVisible(true);
            } else {
                panel.setVisible(false);
            }
        }
    }
}
