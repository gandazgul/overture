// @ts-check
import Phaser from 'phaser';
import { px, s } from '../config.js';

/**
 * Bottom-right active-player avatar HUD element.
 */
export class ActivePlayerAvatar extends Phaser.GameObjects.Container {
    /** @type {Phaser.GameObjects.Image} */
    avatar;

    /** @type {Phaser.GameObjects.Arc} */
    ring;

    /** @type {Phaser.GameObjects.Arc} */
    numberBg;

    /** @type {Phaser.GameObjects.Text} */
    numberText;

    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {{ usherKey: string, colorHex: number, color: string, playerNumber: number }} options
     */
    constructor(scene, x, y, options) {
        super(scene, x, y);

        this.setDepth(5);

        this.avatar = scene.add.image(0, 0, options.usherKey);
        this.avatar.setDisplaySize(s(140), s(140));

        const avatarMask = scene.make.graphics();
        avatarMask.fillStyle(0xffffff);
        avatarMask.fillCircle(x, y, s(70));
        this.avatar.setMask(avatarMask.createGeometryMask());

        this.ring = scene.add.circle(0, 0, s(70), 0x000000, 0)
            .setStrokeStyle(s(6), options.colorHex);

        this.numberBg = scene.add.circle(-s(50), -s(50), s(22), 0x0a0a1a, 1)
            .setStrokeStyle(s(3), options.colorHex);

        this.numberText = scene.add.text(-s(50), -s(50), String(options.playerNumber), {
            fontSize: px(24),
            fontFamily: 'Georgia, serif',
            color: options.color,
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add([
            this.avatar,
            this.ring,
            this.numberBg,
            this.numberText,
        ]);

        scene.add.existing(this);
    }

    /**
     * @param {{ usherKey: string, colorHex: number, color: string, playerNumber: number }} state
     */
    setPlayer(state) {
        if (this.scene.textures.exists(state.usherKey)) {
            this.avatar.setTexture(state.usherKey);
        }

        this.ring.setStrokeStyle(s(6), state.colorHex);
        this.numberBg.setStrokeStyle(s(3), state.colorHex);
        this.numberText.setText(String(state.playerNumber));
        this.numberText.setColor(state.color);
    }
}
