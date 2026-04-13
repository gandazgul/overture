// @ts-check
import Phaser from 'phaser';
import { loadSettings } from '../settings.js';
import { px, s } from '../config.js';
import { createButton } from '../objects/Button.js';
import { AIDifficulty } from '../ai.js';
import { PlayerColors, PlayerColorsHex } from '../types.js';

/** Usher avatar texture keys indexed by color slot. */
const USHER_KEYS = ['usher_blue', 'usher_red', 'usher_green', 'usher_orange'];

/**
 * Title screen with player count selection.
 */
export class TitleScene extends Phaser.Scene {
    constructor() {
        super('TitleScene');
        /** @type {number} */
        this.selectedPlayerCount = 2;

        /**
         * AI config per player slot: null = human, string = AI difficulty.
         * Index 0 is always human (the local player).
         * @type {(string | null)[]}
         */
        this.aiConfig = [null, null, null, null];

        /**
         * Maps player slot → color index. Players can swap colors.
         * Default: [0, 1, 2, 3] (blue, red, green, orange).
         * @type {number[]}
         */
        this.playerColorMap = [0, 1, 2, 3];
    }

    create() {
        // Hydrate settings from localStorage into the Phaser registry
        loadSettings(this.registry);

        // ── DEV DEBUG SKIP (Shift+D) ────────────────────────────────────
        this.input.keyboard?.on('keydown-D', (/** @type {KeyboardEvent} */ e) => {
            if (!e.shiftKey) return;
            console.log('DEBUG: Skipping to TheaterSelectionScene');
            this.scene.start('TheaterSelectionScene', { playerCount: 2 });
        });

        this.showMainMenu();
    }

    // ══════════════════════════════════════════════════════════════════
    // MAIN MENU — Player count + settings
    // ══════════════════════════════════════════════════════════════════

    showMainMenu() {
        this.children.removeAll(true);
        this.tweens.killAll();

        const { width, height } = this.scale;

        // Title
        if (this.textures.exists('ui_logo')) {
            const titleLogo = this.add.image(width / 2, height / 4, 'ui_logo');
            const logoRatio = 0.3643695015;
            const logoWidth = 480;
            titleLogo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio));
        }
        else {
            this.add
                .text(width / 2, height / 4, 'Overture', {
                    fontSize: px(52),
                    fontFamily: 'Georgia, serif',
                    color: '#f5c518',
                })
                .setOrigin(0.5);
        }

        // Subtitle
        this.add
            .text(
                width / 2,
                height / 4 + s(120),
                'A Card Game of Seating Strategy\nSeat patrons in your theater to earn the most victory points!',
                {
                    fontSize: px(18),
                    fontFamily: 'Georgia, serif',
                    color: '#aaaacc',
                    align: 'center',
                    lineSpacing: 5,
                },
            )
            .setOrigin(0.5);

        // "How many players?" label
        this.add
            .text(width / 2, height / 2 - s(30), 'How many players?', {
                fontSize: px(24),
                fontFamily: 'Georgia, serif',
                color: '#ccccdd',
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
            const n = counts[i];
            const bx = startX + i * (s(buttonWidth) + gap);
            const by = height / 2 + s(buttonHeight / 2);

            const { hitArea } = createButton(this, bx, by, `${n} Players`, {
                width: buttonWidth,
            });
            hitArea.on('pointerdown', () => {
                this.selectedPlayerCount = n;
                // Reset AI config: player 0 always human, others default to AI medium
                this.aiConfig = Array.from({ length: 4 }, (_, i) =>
                    i === 0 ? null : (i < n ? AIDifficulty.MEDIUM : null)
                );
                this.showAISetup();
            });
        }

        // ── Settings section ────────────────────────────────────────────────
        this.add
            .text(width / 2, height / 2 + s(140), 'Settings', {
                fontSize: px(18),
                fontFamily: 'Georgia, serif',
                color: '#888899',
            })
            .setOrigin(0.5);

        const showAll = this.registry.get('showAllScores') ?? true;
        const toggleText = this.add
            .text(
                width / 2,
                height / 2 + s(175),
                `Show all scores: ${showAll ? 'ON' : 'OFF'}`,
                {
                    fontSize: px(16),
                    fontFamily: 'Arial',
                    color: showAll ? '#66bb6a' : '#888899',
                    backgroundColor: '#2a2a4e',
                    padding: { x: s(16), y: s(8) },
                },
            )
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        toggleText.on(
            'pointerover',
            () => toggleText.setStyle({ color: '#f5c518' }),
        );
        toggleText.on('pointerout', () => {
            const current = this.registry.get('showAllScores') ?? true;
            toggleText.setStyle({ color: current ? '#66bb6a' : '#888899' });
        });

        toggleText.on('pointerdown', () => {
            const current = this.registry.get('showAllScores') ?? true;
            const next = !current;
            this.registry.set('showAllScores', next);
            toggleText.setText(`Show all scores: ${next ? 'ON' : 'OFF'}`);
            toggleText.setStyle({ color: next ? '#66bb6a' : '#888899' });
        });

        // Fullscreen button
        const fsBtn = this.add
            .text(width * 0.9, s(40), '⛶ Fullscreen', {
                fontSize: px(16),
                fontFamily: 'Arial',
                color: '#ffffff',
                backgroundColor: '#2a2a4e',
                padding: { x: s(12), y: s(6) },
            })
            .setOrigin(0.5, 0)
            .setInteractive({ useHandCursor: true });

        fsBtn.on('pointerdown', () => {
            const el = /** @type {any} */ (document.documentElement);
            if (el.requestFullscreen) {
                el.requestFullscreen();
            }
            else if (el.webkitRequestFullscreen) {
                el.webkitRequestFullscreen();
            }
            else if (el.msRequestFullscreen) {
                el.msRequestFullscreen();
            }
        });
    }

    // ══════════════════════════════════════════════════════════════════
    // AI SETUP — Table-based player configuration
    // ══════════════════════════════════════════════════════════════════

    showAISetup() {
        this.children.removeAll(true);
        this.tweens.killAll();

        const { width } = this.scale;
        const count = this.selectedPlayerCount;

        const difficulties = [AIDifficulty.EASY, AIDifficulty.MEDIUM, AIDifficulty.HARD];
        const diffLabels = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: 'Easy',
            [AIDifficulty.MEDIUM]: 'Medium',
            [AIDifficulty.HARD]: 'Hard',
        });
        const diffDots = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: '🟢',
            [AIDifficulty.MEDIUM]: '🟡',
            [AIDifficulty.HARD]: '🔴',
        });
        const diffTextColors = /** @type {Record<string,string>} */ ({
            [AIDifficulty.EASY]: '#66bb6a',
            [AIDifficulty.MEDIUM]: '#ffa726',
            [AIDifficulty.HARD]: '#ef5350',
        });

        // ── Header ──────────────────────────────────────────────────
        if (this.textures.exists('ui_logo')) {
            const logo = this.add.image(width / 2, s(70), 'ui_logo');
            const logoRatio = 0.3643695015;
            const logoWidth = 280;
            logo.setDisplaySize(s(logoWidth), s(logoWidth * logoRatio));
        }

        this.add
            .text(width / 2, s(148), 'Player Setup', {
                fontSize: px(26),
                fontFamily: 'Georgia, serif',
                color: '#ffd700',
            })
            .setOrigin(0.5);

        // ── Table dimensions ────────────────────────────────────────
        const tableW = s(600);
        const rowH = s(68);
        const headerH = s(34);
        const tableX = (width - tableW) / 2;
        const tableY = s(185);

        // Column X positions (center-based, relative to tableX)
        const colAvatar = s(38);
        const colName = s(78);
        const colColor = s(230);
        const colType = s(370);
        const colDiff = s(520);

        const totalH = headerH + count * rowH;

        // Table background
        this.add.rectangle(
            tableX + tableW / 2, tableY + totalH / 2,
            tableW, totalH, 0x12122a, 0.9,
        ).setStrokeStyle(s(2), 0x3a3a6a);

        // ── Table header ────────────────────────────────────────────
        const hdrY = tableY + headerH / 2;
        this.add.rectangle(
            tableX + tableW / 2, hdrY, tableW, headerH, 0x1a1a3e,
        );

        /** @type {Phaser.Types.GameObjects.Text.TextStyle} */
        const hdrStyle = { fontSize: px(11), fontFamily: 'Arial', color: '#888899' };
        this.add.text(tableX + colName, hdrY, 'Player', hdrStyle).setOrigin(0, 0.5);
        this.add.text(tableX + colColor, hdrY, 'Color', hdrStyle).setOrigin(0.5, 0.5);
        this.add.text(tableX + colType, hdrY, 'Type', hdrStyle).setOrigin(0.5, 0.5);
        this.add.text(tableX + colDiff, hdrY, 'Difficulty', hdrStyle).setOrigin(0.5, 0.5);

        // ── Player rows ─────────────────────────────────────────────
        for (let p = 0; p < count; p++) {
            const rowCY = tableY + headerH + p * rowH + rowH / 2;
            const ci = this.playerColorMap[p];
            const isFirstPlayer = p === 0;

            // Alternating row tint
            if (p % 2 === 1) {
                this.add.rectangle(
                    tableX + tableW / 2, rowCY, tableW, rowH, 0x1a1a30, 0.5,
                );
            }

            // Row separator
            if (p > 0) {
                this.add.rectangle(
                    tableX + tableW / 2, rowCY - rowH / 2,
                    tableW - s(16), s(1), 0x3a3a6a, 0.4,
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

            // ── Name ────────────────────────────────────────────────
            this.add
                .text(tableX + colName, rowCY, `Player ${p + 1}`, {
                    fontSize: px(15),
                    fontFamily: 'Georgia, serif',
                    color: PlayerColors[ci],
                    fontStyle: 'bold',
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
                    sx, rowCY, swatchR,
                    PlayerColorsHex[c], isActive ? 1 : 0.25,
                )
                    .setStrokeStyle(isActive ? s(3) : s(1), isActive ? 0xffffff : 0x555577)
                    .setInteractive({ useHandCursor: true });

                swatch.on('pointerdown', () => {
                    if (this.playerColorMap[p] === c) return;
                    // Swap with whoever currently owns this color
                    const owner = this.playerColorMap.indexOf(c);
                    if (owner >= 0 && owner < count) {
                        this.playerColorMap[owner] = this.playerColorMap[p];
                    }
                    this.playerColorMap[p] = c;
                    this.showAISetup(); // redraw
                });
            }

            // ── Type toggle ─────────────────────────────────────────
            if (isFirstPlayer) {
                this.add
                    .text(tableX + colType, rowCY, '👤 Human', {
                        fontSize: px(14),
                        fontFamily: 'Arial',
                        color: '#66bb6a',
                    })
                    .setOrigin(0.5, 0.5);

                this.add
                    .text(tableX + colDiff, rowCY, '—', {
                        fontSize: px(14),
                        fontFamily: 'Arial',
                        color: '#555566',
                    })
                    .setOrigin(0.5, 0.5);
                continue;
            }

            const isAI = this.aiConfig[p] !== null;
            const typeBtn = this.add
                .text(tableX + colType, rowCY, isAI ? '🤖 AI' : '👤 Human', {
                    fontSize: px(14),
                    fontFamily: 'Arial',
                    color: isAI ? '#ffa726' : '#66bb6a',
                    backgroundColor: '#2a2a4e',
                    padding: { x: s(12), y: s(5) },
                })
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true });

            // Difficulty button
            const currentDiff = this.aiConfig[p] || AIDifficulty.MEDIUM;
            const diffBtn = this.add
                .text(tableX + colDiff, rowCY,
                    `${diffDots[currentDiff]} ${diffLabels[currentDiff]}`, {
                    fontSize: px(13),
                    fontFamily: 'Arial',
                    color: diffTextColors[currentDiff] || '#ffa726',
                    backgroundColor: '#2a2a4e',
                    padding: { x: s(10), y: s(5) },
                })
                .setOrigin(0.5, 0.5)
                .setInteractive({ useHandCursor: true })
                .setVisible(isAI);

            if (!isAI) {
                // Show placeholder for difficulty column
                this.add
                    .text(tableX + colDiff, rowCY, '—', {
                        fontSize: px(14),
                        fontFamily: 'Arial',
                        color: '#555566',
                    })
                    .setOrigin(0.5, 0.5);
            }

            // Toggle human ↔ AI
            typeBtn.on('pointerdown', () => {
                if (this.aiConfig[p] === null) {
                    this.aiConfig[p] = AIDifficulty.MEDIUM;
                } else {
                    this.aiConfig[p] = null;
                }
                this.showAISetup();
            });

            // Cycle difficulty
            diffBtn.on('pointerdown', () => {
                const idx = difficulties.indexOf(/** @type {string} */ (this.aiConfig[p]));
                const next = difficulties[(idx + 1) % difficulties.length];
                this.aiConfig[p] = next;
                this.showAISetup();
            });
        }

        // ── Next button ─────────────────────────────────────────────
        const btnY = tableY + totalH + s(45);
        const { hitArea: startHit } = createButton(
            this, width / 2, btnY, 'Next \u2192',
            { fontSize: 18, width: 200 },
        );
        startHit.on('pointerdown', () => {
            this.scene.start('TheaterSelectionScene', {
                playerCount: count,
                aiConfig: this.aiConfig.slice(0, count),
                playerColorMap: this.playerColorMap.slice(0, count),
            });
        });

        // ── Back button ─────────────────────────────────────────────
        const backBtn = this.add
            .text(s(20), s(20), '\u2190 Back', {
                fontSize: px(16),
                fontFamily: 'Arial',
                color: '#888899',
            })
            .setInteractive({ useHandCursor: true });

        backBtn.on('pointerover', () => backBtn.setStyle({ color: '#f5c518' }));
        backBtn.on('pointerout', () => backBtn.setStyle({ color: '#888899' }));
        backBtn.on('pointerdown', () => this.showMainMenu());
    }
}
