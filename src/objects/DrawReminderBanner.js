// src/objects/DrawReminderBanner.js
import Phaser from 'phaser';
import { s, px } from '../config.js';

const DRAW_REMINDER_BANNER_DURATION = 1750;

export class DrawReminderBanner extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {string} msg
     */
    constructor(scene, x, y, msg) {
        super(scene, x, y);
        this.setDepth(10000);
        this.setScrollFactor(0);

        const rect = scene.add.rectangle(0, 0, s(450), s(80), 0x1a1a1a, 0.92).setOrigin(0.5);
        rect.setStrokeStyle(s(4), 0xd4af37, 1);

        const text = scene.add.text(0, 0, msg, {
            fontSize: px(28),
            fontFamily: 'Georgia, serif',
            color: '#ffd700',
            align: 'center',
        }).setOrigin(0.5);

        this.add(rect);
        this.add(text);

        // Auto-destroy children when this container is destroyed
        this.on('destroy', () => {
            rect.destroy();
            text.destroy();
        });

        // Self-destroy after duration
        scene.time.delayedCall(DRAW_REMINDER_BANNER_DURATION, () => {
            this.destroy();
        });
    }
}
