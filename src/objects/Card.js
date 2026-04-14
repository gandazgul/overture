// @ts-check
import Phaser from 'phaser';
import { TraitColors } from '../types.js';
import { s } from '../config.js';

/** @typedef {import('../types.js').CardData} CardData */

/**
 * Visual representation of a patron card.
 * Extends Phaser.GameObjects.Container to group card elements together.
 */
export class Card extends Phaser.GameObjects.Container {
    /** @type {CardData} */
    cardData;

    /** @type {Phaser.GameObjects.Rectangle} */
    background;

    /** @type {number} */
    strokeColor;

    /** @type {boolean} */
    isSelected = false;

    static WIDTH = s(105);
    static HEIGHT = s(140);

    /**
     * @param {Phaser.Scene} scene - The scene this card belongs to
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {CardData} cardData - The patron data for this card
     */
    constructor(scene, x, y, cardData) {
        super(scene, x, y);
        this.cardData = cardData;

        this.baseY = y;

        this.strokeColor = cardData.trait
            ? TraitColors[cardData.trait] || 0xffffff
            : 0x4a4a6a;

        // Use black fill since the image will cover it, but keep it for the stroke outline when selected
        this.background = scene.add
            .rectangle(0, 0, Card.WIDTH, Card.HEIGHT, 0x000000)
            .setStrokeStyle(s(2), this.strokeColor, 0.7);

        // Base patron image
        const baseImage = scene.add.image(0, 0, `patron_${cardData.type.toLowerCase()}`);
        baseImage.setDisplaySize(Card.WIDTH, Card.HEIGHT);

        /** @type {Phaser.GameObjects.GameObject[]} */
        const children = [this.background, baseImage];

        // Trait badge
        if (cardData.trait) {
            const badge = scene.add.image(Card.WIDTH / 2 - s(18), -Card.HEIGHT / 2 + s(18), `badge_${cardData.trait.toLowerCase()}`);
            badge.setDisplaySize(s(28), s(28));
            children.push(badge);
        }

        this.add(children);

        this.setSize(Card.WIDTH, Card.HEIGHT);
        this.setInteractive(
            new Phaser.Geom.Rectangle(
                0,
                0,
                Card.WIDTH,
                Card.HEIGHT,
            ),
            Phaser.Geom.Rectangle.Contains,
        );

        this.on('pointerover', () => {
            if (!this.isSelected) {
                scene.tweens.add({
                    targets: this,
                    y: this.baseY - s(20), // Pop up slightly
                    duration: 150,
                    ease: 'Back.easeOut',
                });
            }
        });

        this.on('pointerout', () => {
            if (!this.isSelected) {
                scene.tweens.add({
                    targets: this,
                    scaleX: 1,
                    scaleY: 1,
                    y: this.baseY,
                    duration: 150,
                    ease: 'Sine.easeOut',
                });
            }
        });

        // Add this container to the scene's display list
        scene.add.existing(this);
    }

    setStrokeColor(newStrokeColor) {
        this.strokeColor = newStrokeColor;
        this.background.setStrokeStyle(s(2), this.strokeColor, 0.7);
    }

    /**
     * Toggle the selected visual state of the card.
     * @param {boolean} selected
     */
    setSelected(selected) {
        this.isSelected = selected;

        if (selected) {
            this.background.setStrokeStyle(s(3), 0xf5c518, 1);
            this.scene.tweens.add({
                targets: this,
                scaleX: 1.6,
                scaleY: 1.6,
                y: this.baseY - s(42), // Pop up more when selected
                duration: 250,
                ease: 'Back.easeOut',
            });
            this.scene.children.bringToTop(this);
        }
        else {
            this.background.setStrokeStyle(s(2), this.strokeColor, 0.7);
            this.scene.tweens.add({
                targets: this,
                scaleX: 1,
                scaleY: 1,
                y: this.baseY,
                duration: 200,
                ease: 'Sine.easeOut',
            });
        }
    }
}
