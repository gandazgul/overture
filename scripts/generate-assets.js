#!/usr/bin/env -S deno run -A
// @ts-check
/// <reference lib="deno.ns" />

/**
 * Asset Generation Script
 * Generates game art assets using Google Imagen via the @google/genai SDK.
 * Reads GEMINI_API_KEY from the .env file at the project root.
 *
 * Requires: @google/genai (dev dependency)
 *
 * Usage: deno task generate
 */

import { GoogleGenAI } from "@google/genai";
import { extname, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { config } from "npm:dotenv@16";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const OUTPUT_DIR = join(PROJECT_ROOT, "public", "assets");

mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Load environment ────────────────────────────────────────────────

config({ path: join(PROJECT_ROOT, ".env") });

const apiKey = Deno.env.get("GEMINI_API_KEY");
if (!apiKey) {
    console.error("Error: Please set the GEMINI_API_KEY environment variable in a .env file or your environment.");
    console.error("Example: GEMINI_API_KEY='your_api_key_here'");
    console.error("Then run: deno task generate");
    Deno.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const MODEL = "imagen-4.0-generate-001";

// ── Asset definitions ───────────────────────────────────────────────

/**
 * @typedef {Object} AssetDef
 * @property {string} filename
 * @property {string} prompt
 * @property {string} aspectRatio
 */

/** @type {AssetDef[]} */
const ASSETS = [
    // ── Primary Patron Types (Card Illustrations) ─ 3:4 ──────────
    {
        filename: "patron_patron.png",
        prompt:
            "A charming, stylized 2D digital illustration of a 1920s everyday theatergoer, dressed in a neat vintage suit, looking attentively forward. Warm theater lighting. Art Deco illustration style, clean lines, vibrant but elegant color palette, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_vip.png",
        prompt:
            "A charming, stylized 2D digital illustration of a glamorous 1920s celebrity VIP in a sparkling gown and fur boa, looking haughty and fabulous. Warm theater lighting. Art Deco illustration style, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_lovebirds.png",
        prompt:
            "A charming, stylized 2D digital illustration of a romantic couple in 1920s attire leaning in close, sharing a box of popcorn. Warm theater spotlight. Art Deco illustration style, clean lines, cozy and affectionate mood, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_kid.png",
        prompt:
            "A charming, stylized 2D digital illustration of a school boy in vintage 1920s clothes, excitedly pointing. Came to the theater as a school trip. Warm theater lighting. Art Deco illustration style, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_teacher.png",
        prompt:
            "A charming, stylized 2D digital illustration of a strict but caring chaperone teacher from the 1920s, wearing modest vintage clothing and holding a schedule. Warm theater lighting. Art Deco illustration style, clean lines, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_critic.png",
        prompt:
            "A charming, stylized 2D digital illustration of a snooty, older theater critic in a tuxedo, holding up a notepad and pen, looking skeptical. Warm theater lighting. Art Deco illustration style, clean lines, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },
    {
        filename: "patron_friends.png",
        prompt:
            "A charming, stylized 2D digital illustration of a friendly 1920s theater-goer laughing. Sitting at an art deco theater. Warm theater lighting. Art Deco illustration style, clean lines, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "3:4",
    },

    // ── Secondary Trait Badges (UI Icons) ─ 1:1 ─────────────────
    {
        filename: "badge_tall.png",
        prompt:
            "A stylized 2D UI icon of a very tall vintage 1920s formal top hat. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "badge_short.png",
        prompt:
            "A stylized 2D UI icon of a vintage 1920s plush velvet theater booster cushion. Art Deco vector illustration style, elegant gold and crimson colors, bold lines, plain solid dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "badge_bespectacled.png",
        prompt:
            "A stylized 2D UI icon of an elegant pair of 1920s round gold-rimmed spectacles. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "badge_noisy.png",
        prompt:
            "A stylized 2D UI icon of an ornate vintage 1920s brass megaphone with stylized sound waves. Art Deco vector illustration style, elegant gold and black colors, bold lines, plain solid dark background.",
        aspectRatio: "1:1",
    },

    // ── Theater Boards (Background Mats) ─ 16:9 ─────────────────
    {
        filename: "bg_grand_empress.png",
        prompt:
            "A top-down stylized view of a grand 1920s theater floor. Plush red carpet, ornate gold trim on the edges, warm ambient lighting. Elegant Art Deco geometric patterns on the floor. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_blackbox.png",
        prompt:
            "A top-down stylized view of a modern, minimalist blackbox theater floor. Scuffed black wooden floorboards, subtle overhead spotlight beams cutting through dark dust motes. Moody atmospheric UI background.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_opera_house.png",
        prompt:
            "A top-down stylized view of an opulent opera house floor. Deep purple carpets with intricate gold leaf embroidery, rich mahogany wood borders, extremely luxurious and regal. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_amphitheater.png",
        prompt:
            "A top-down stylized view of an ancient Greek-style amphitheater floor. Weathered stone steps and marble paving, sunlit daytime atmosphere, subtle ivy creeping on the edges. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_dinner_playhouse.png",
        prompt:
            "A top-down stylized view of a smoky 1920s dinner playhouse floor. Rich dark hardwood flooring, subtle checkered tile patterns, warm pink and amber club lighting reflecting off the floor. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_balcony.png",
        prompt:
            "A top-down stylized view of a theater showing a distinct split. The top edge features an ornate brass balcony railing overlooking a lower velvet carpeted floor. Rich crimson and gold tones. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_promenade.png",
        prompt:
            "A top-down stylized view of a modern theater floor with swirling, asymmetric carpet patterns in teal and copper. Avant-garde theater interior, sleek and intriguing. UI background illustration.",
        aspectRatio: "16:9",
    },
    {
        filename: "bg_rotunda.png",
        prompt:
            "A top-down stylized view of a circular theater-in-the-round floor. Concentric rings of polished marble and dark wood radiate outward from a central stage area. Warm amber spotlight on the center, Art Deco geometric inlays in the stone. Intimate and dramatic. UI background illustration.",
        aspectRatio: "16:9",
    },

    // ── Game UI & Extras ─────────────────────────────────────────
    {
        filename: "card_back.png",
        prompt:
            "A 2D stylized playing card back featuring an elegant Art Deco geometric pattern of a theater stage curtain and marquee stars. Symmetrical, classic playing card design, rich gold, black, and red colors.",
        aspectRatio: "3:4",
    },
    {
        filename: "ui_stage.png",
        prompt:
            "A top-down 2D stylized view of a vintage mahogany wooden theater stage edge fitted with classic brass clam-shell footlights. Art Deco vector illustration style, elegant, solid dark background.",
        aspectRatio: "16:9",
    },
    {
        filename: "ui_logo.png",
        prompt:
            "A glowing 1920s Art Deco theater marquee sign serving as a game title logo reading 'Overture'. High quality vector illustration, elegant 1920s classic theater theme, solid dark background.",
        aspectRatio: "16:9",
    },
    {
        filename: "ui_button_frame.png",
        prompt:
            "A stylish 2D UI game asset of an elegant 1920s Art Deco decorative border frame. The aspect ratio is very wide landscape, like a panoramic banner. The center of the border frame is a completely solid, empty, flat black wide rectangle with absolutely NO TEXT. High quality vector illustration, rich gold intricate geometric linework on the border, plain dark solid background.",
        aspectRatio: "16:9",
    },
    {
        filename: "usher_blue.png",
        prompt:
            "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp blue vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "usher_red.png",
        prompt:
            "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp red vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "usher_green.png",
        prompt:
            "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp green vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "1:1",
    },
    {
        filename: "usher_orange.png",
        prompt:
            "A stylized 2D digital illustration of a cheerful 1920s theater usher wearing a crisp orange vest and matching vintage usher cap. Warm theater lighting. Realistic illustration style but not cartoonish, expressive character design, centered portrait, plain dark background.",
        aspectRatio: "1:1",
    },
];

// ── Generation loop ─────────────────────────────────────────────────

console.log(`Loaded ${ASSETS.length} assets to generate.`);

for (const asset of ASSETS) {
    const outputPath = join(OUTPUT_DIR, asset.filename);
    const base = outputPath.replace(extname(outputPath), "");

    // Skip if the file (or an optimized variant) already exists
    const variants = [outputPath, `${base}.jpg`, `${base}.png`];
    if (variants.some((v) => existsSync(v))) {
        console.log(`Skipping ${asset.filename} - already exists.`);
        continue;
    }

    console.log(`Generating ${asset.filename}...`);
    try {
        const result = await ai.models.generateImages({
            model: MODEL,
            prompt: asset.prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: "image/png",
                aspectRatio: asset.aspectRatio,
                // @ts-ignore – personGeneration is supported by the API but not yet in TS types
                personGeneration: "ALLOW_ADULT",
            },
        });

        const images = result.generatedImages;
        if (!images || images.length === 0) {
            console.log(`Failed: No image returned for ${asset.filename}`);
            continue;
        }

        const imageBytes = images[0].image?.imageBytes;
        if (imageBytes) {
            Deno.writeFileSync(outputPath, Uint8Array.from(atob(imageBytes), (c) => c.charCodeAt(0)));
            console.log(`✅ Saved ${asset.filename}`);
        } else {
            console.log(`Failed: No image bytes for ${asset.filename}`);
        }
    } catch (e) {
        console.error(`❌ Error generating ${asset.filename}: ${e}`);
    }
}

console.log("\nImage generation loop complete!");
