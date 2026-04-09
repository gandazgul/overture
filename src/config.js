// @ts-check

/**
 * ========================================================================
 * DPR-aware scaling for HiDPI / Retina displays
 * ========================================================================
 * Phaser 3 renders its canvas at the configured width × height pixels.
 * On a 2× Retina display, a 1024×768 canvas is CSS-scaled to 2048×1536
 * physical pixels, causing blurry text and graphics.
 *
 * Fix: multiply the game resolution by devicePixelRatio so the canvas
 * buffer matches the device's physical pixels. All hardcoded pixel values
 * (font sizes, element dimensions, gaps) must also scale by DPR — use
 * the `s()` and `px()` helpers below instead of raw numbers.
 * ========================================================================
 */

/** Device pixel ratio (1 on standard displays, 2 on Retina, 3 on some phones) */
export const DPR = globalThis.devicePixelRatio || 1;

/** Game canvas width in physical pixels */
export const GAME_WIDTH = Math.round(1024 * DPR);

/** Game canvas height in physical pixels */
export const GAME_HEIGHT = Math.round(768 * DPR);

/**
 * Scale a numeric pixel value by DPR.
 * Use for dimensions, positions, gaps, padding, stroke widths, etc.
 * @param {number} n - Design pixel value (at 1× DPR)
 * @returns {number}
 */
export const s = (n) => Math.round(n * DPR);

/**
 * Scale a pixel value and return as a CSS font-size string.
 * @param {number} n - Design font size in pixels (at 1× DPR)
 * @returns {string} e.g. "52px" on 1× or "104px" on 2×
 */
export const px = (n) => `${Math.round(n * DPR)}px`;
