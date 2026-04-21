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
import { basename, extname, join } from "node:path";
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";

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
 * @returns {string[]} Full paths sorted alphabetically
 */
function globFiles(dir, prefix) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((f) => f.startsWith(prefix))
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

mkdirSync(ARCHIVE, { recursive: true });

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
for (const bg of globFiles(SRC, "bg_")) {
    if (bg.endsWith("_thumb.jpg")) {
        continue; //skip thumbs
    }
    const ext = extname(bg);
    const name = basename(bg, ext);
    let archived;
    const archivedJpg = join(ARCHIVE, `${name}.jpg`);
    const archivedPng = join(ARCHIVE, `${name}.png`);
    if (existsSync(archivedJpg)) {
        archived = archivedJpg;
    } else if (existsSync(archivedPng)) {
        archived = archivedPng;
    }
    const fullPath = join(SRC, `${name}.jpg`);
    const thumbPath = join(SRC, `${name}_thumb.jpg`);

    if (!existsSync(archivedJpg) && !existsSync(archivedPng)) {
        archived = join(ARCHIVE, basename(bg));
        copyFileSync(bg, archived);
        unlinkSync(bg);
        try { unlinkSync(fullPath); } catch { /* ignore if they don't exist */ }
        try { unlinkSync(thumbPath); } catch { /* ignore if they don't exist */ }
        console.log(`  Archived new asset: ${bg}`);
    }

    if (!existsSync(fullPath)) {
        await resizeJpeg(archived, fullPath, 1250, 85);
        console.log(`  ${name}: wrote full asset`);
    } else {
        console.log(`  ${name}: skipped (full asset exists)`);
    }

    if (!existsSync(thumbPath)) {
        await resizeJpeg(archived, thumbPath, 320, 80);
        console.log(`  ${name}: wrote thumb`);
    } else {
        console.log(`  ${name}: skipped (thumb exists)`);
    }
}
console.log("");

const UI_MAP = {
    ui_logo: 600,
    ui_button_frame: 256,
    ui_stage: 640,
    ui_card_back: 128,
    ui_brass_stanchion: 50
};
// --- UI  ---
console.log("--- UI assets ---");
for (const ui of globFiles(SRC, "ui_")) {
    const ext = extname(ui);
    const name = basename(ui, ext);
    const archived = join(ARCHIVE, basename(ui));
    if (!existsSync(archived)) {
        copyFileSync(ui, archived);
        unlinkSync(ui);
        console.log(`  Archived new asset: ${name}`);

        ext === '.jpg' ?
            await resizeJpeg(archived, ui, UI_MAP[name], 85) :
            await resizePng(archived, ui, { width: UI_MAP[name] });

        console.log(`  ${name}: wrote full asset`);
    } else {
        console.log(`  ${name}: skipped (exists)`);
    }
}
console.log("");

// --- Patron Cards (trimmed) ---
console.log("--- Patron Cards (168px wide, trimmed) ---");
for (const patron of globFiles(SRC, "patron_")) {
    const ext = extname(patron);
    const name = basename(patron, ext);
    const archived = join(ARCHIVE, basename(patron));
    if (!existsSync(archived)) {
        copyFileSync(patron, archived);
        unlinkSync(patron);
        console.log(`  Archived new asset: ${name}`);

        ext === '.jpg' ?
            await resizeJpeg(archived, patron, 168, 85) :
            await resizePng(archived, patron, { width: 168, trim: true });

        console.log(`  ${name}: wrote`);
    } else {
        console.log(`  ${name}: skipped (exists)`);
    }
}
console.log("");

// --- Ushers ---
console.log("--- Ushers (160px wide) ---");
for (const usher of globFiles(SRC, "usher_")) {
    const ext = extname(usher);
    const name = basename(usher, ext);
    let archived;
    const archivedJpg = join(ARCHIVE, `${name}.jpg`);
    const archivedPng = join(ARCHIVE, `${name}.png`);
    if (existsSync(archivedJpg)) {
        archived = archivedJpg;
    } else if (existsSync(archivedPng)) {
        archived = archivedPng;
    }
    if (!existsSync(archived)) {
        copyFileSync(usher, archived);
        unlinkSync(usher);
        console.log(`  Archived new asset: ${usher}`);

        await resizeJpeg(archived, join(SRC, `${name}.jpg`), 160, 90);

        console.log(`  ${name}: wrote`);
    } else {
        console.log(`  ${name}: skipped (exists)`);
    }
}
console.log("");

// --- Badges (trimmed) ---
console.log("--- Badges (64px, trimmed) ---");
for (const badge of globFiles(SRC, "badge_")) {
    const ext = extname(badge);
    const name = basename(badge, ext);
    const archived = join(ARCHIVE, basename(badge));
    if (!existsSync(archived)) {
        copyFileSync(badge, archived);
        unlinkSync(badge);
        console.log(`  Archived new asset: ${name}`);

        ext === '.jpg' ?
            await resizeJpeg(archived, badge, 64, 85) :
            await resizePng(archived, badge, { width: 64, trim: true });

        console.log(`  ${name}: wrote`);
    } else {
        console.log(`  ${name}: skipped (exists)`);
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
