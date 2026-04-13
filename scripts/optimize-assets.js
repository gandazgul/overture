#!/usr/bin/env -S deno run -A
// @ts-check
/// <reference lib="deno.ns" />

/**
 * Asset Optimization Script
 * Copies originals to assets-original/ at project root, then resizes/compresses
 * assets in public/assets/ to their actual rendered sizes.
 *
 * Requires: sharp (dev dependency)
 *
 * Usage: deno task optimize
 */

import sharp from "sharp";
import { join, basename, extname } from "node:path";
import { existsSync, mkdirSync, readdirSync, copyFileSync, unlinkSync, statSync } from "node:fs";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const SRC = join(PROJECT_ROOT, "public", "assets");
const ARCHIVE = join(PROJECT_ROOT, "assets-original");

/**
 * Format file size in human-readable form.
 * @param {string} filePath
 * @returns {string}
 */
function fileSize(filePath) {
    const bytes = statSync(filePath).size;
    if (bytes < 1024) return `${bytes}B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)}K`;
    return `${(kb / 1024).toFixed(1)}M`;
}

/**
 * Glob files from a directory matching a pattern prefix and extension.
 * @param {string} dir
 * @param {string} prefix - e.g. "patron_"
 * @param {string} ext - e.g. ".png"
 * @returns {string[]} Full paths sorted alphabetically
 */
function globFiles(dir, prefix, ext) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.startsWith(prefix) && f.endsWith(ext))
        .sort()
        .map((f) => join(dir, f));
}

/**
 * Glob files matching a substring and extension.
 * @param {string} dir
 * @param {string} contains - e.g. "token"
 * @param {string} ext - e.g. ".png"
 * @returns {string[]}
 */
function globContains(dir, contains, ext) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.includes(contains) && f.endsWith(ext))
        .sort()
        .map((f) => join(dir, f));
}

// ── Step 1: Archive originals ───────────────────────────────────────

console.log("=== Asset Optimization ===");
console.log(`Source:  ${SRC}`);
console.log(`Archive: ${ARCHIVE}`);
console.log("");

if (existsSync(ARCHIVE)) {
    console.log("Archive exists, syncing new assets...");
    for (const f of readdirSync(SRC).filter((n) => n.endsWith(".png"))) {
        const dest = join(ARCHIVE, f);
        if (!existsSync(dest)) {
            copyFileSync(join(SRC, f), dest);
            console.log(`  Archived new asset: ${f}`);
        }
    }
} else {
    console.log(`Copying originals to ${ARCHIVE}...`);
    mkdirSync(ARCHIVE, { recursive: true });
    for (const f of readdirSync(SRC)) {
        if (f === ".DS_Store") continue;
        copyFileSync(join(SRC, f), join(ARCHIVE, f));
    }
    console.log("Done.");
}
console.log("");

// ── Step 2: Resize assets ───────────────────────────────────────────

/**
 * Resize a PNG, strip metadata, and save.
 * @param {string} input - Source file path
 * @param {string} output - Destination file path
 * @param {{ width?: number, height?: number, trim?: boolean }} opts
 */
async function resizePng(input, output, opts) {
    let pipeline = sharp(input);
    if (opts.trim) {
        pipeline = pipeline.trim();
    }
    pipeline = pipeline.resize(opts.width, opts.height, { fit: "inside", withoutEnlargement: false });
    await pipeline.png().toFile(output);
}

/**
 * Resize to JPEG with quality setting.
 * @param {string} input
 * @param {string} output
 * @param {number} width
 * @param {number} quality
 */
async function resizeJpeg(input, output, width, quality) {
    await sharp(input).resize(width).jpeg({ quality }).toFile(output);
}

// --- Backgrounds ---
console.log("--- Backgrounds (game: 800px wide JPEG, thumbnails: 320px wide JPEG) ---");
for (const bg of globFiles(ARCHIVE, "bg_", ".png")) {
    const name = basename(bg, ".png");
    const fullPath = join(SRC, `${name}.jpg`);
    const thumbPath = join(SRC, `${name}_thumb.jpg`);

    await resizeJpeg(bg, fullPath, 800, 85);
    // Remove old PNG if it exists
    const oldPng = join(SRC, `${name}.png`);
    if (existsSync(oldPng)) unlinkSync(oldPng);
    // Thumbnail for theater selection cards (320px covers 300×164 card + 1.04× zoom)
    await resizeJpeg(bg, thumbPath, 320, 80);

    console.log(`  ${name}: ${fileSize(fullPath)} (full), ${fileSize(thumbPath)} (thumb)`);
}
console.log("");

// --- Card Back ---
console.log("--- Card Back (128px wide) ---");
{
    const out = join(SRC, "card_back.png");
    await resizePng(join(ARCHIVE, "card_back.png"), out, { width: 128 });
    console.log(`  card_back: ${fileSize(out)}`);
}
console.log("");

// --- UI Logo ---
console.log("--- UI Logo (600px wide) ---");
{
    const out = join(SRC, "ui_logo.png");
    await resizePng(join(ARCHIVE, "ui_logo.png"), out, { width: 600 });
    console.log(`  ui_logo: ${fileSize(out)}`);
}
console.log("");

// --- UI Button Frame ---
console.log("--- UI Button Frame (256px wide) ---");
{
    const out = join(SRC, "ui_button_frame.png");
    await resizePng(join(ARCHIVE, "ui_button_frame.png"), out, { width: 256 });
    console.log(`  ui_button_frame: ${fileSize(out)}`);
}
console.log("");

// --- UI Stage ---
console.log("--- UI Stage (640px wide) ---");
{
    const out = join(SRC, "ui_stage.png");
    await resizePng(join(ARCHIVE, "ui_stage.png"), out, { width: 640 });
    console.log(`  ui_stage: ${fileSize(out)}`);
}
console.log("");

// --- Patron Cards (trimmed) ---
console.log("--- Patron Cards (168px wide, trimmed) ---");
for (const patron of globFiles(ARCHIVE, "patron_", ".png")) {
    const name = basename(patron, ".png");
    const out = join(SRC, `${name}.png`);
    await resizePng(patron, out, { width: 168, trim: true });
    console.log(`  ${name}: ${fileSize(out)}`);
}
console.log("");

// --- Ushers ---
console.log("--- Ushers (160px wide) ---");
for (const usher of globFiles(ARCHIVE, "usher_", ".png")) {
    const name = basename(usher, ".png");
    const out = join(SRC, `${name}.png`);
    await resizePng(usher, out, { width: 160 });
    console.log(`  ${name}: ${fileSize(out)}`);
}
console.log("");

// --- Badges (trimmed) ---
console.log("--- Badges (64px, trimmed) ---");
for (const badge of globFiles(ARCHIVE, "badge_", ".png")) {
    const name = basename(badge, ".png");
    const out = join(SRC, `${name}.png`);
    await resizePng(badge, out, { width: 64, height: 64, trim: true });
    console.log(`  ${name}: ${fileSize(out)}`);
}
console.log("");

// --- Tokens (trimmed) ---
console.log("--- Tokens (64px, trimmed) ---");
{
    const tokens = globContains(ARCHIVE, "token", ".png");
    if (tokens.length === 0) {
        console.log("  (no token files found)");
    } else {
        for (const token of tokens) {
            const name = basename(token, ".png");
            const out = join(SRC, `${name}.png`);
            await resizePng(token, out, { width: 64, height: 64, trim: true });
            console.log(`  ${name}: ${fileSize(out)}`);
        }
    }
}
console.log("");

// ── Summary ─────────────────────────────────────────────────────────

/**
 * Sum total size of all files in a directory (non-recursive).
 * @param {string} dir
 * @returns {string}
 */
function dirSize(dir) {
    const total = readdirSync(dir).reduce((sum, f) => {
        const p = join(dir, f);
        try {
            return sum + statSync(p).size;
        } catch {
            return sum;
        }
    }, 0);
    const mb = total / (1024 * 1024);
    return `${mb.toFixed(1)}M`;
}

console.log("=== Summary ===");
console.log(`Original:  ${dirSize(ARCHIVE)}`);
console.log(`Optimized: ${dirSize(SRC)}`);
console.log("");
console.log(`Done! Originals preserved in ${ARCHIVE}`);
