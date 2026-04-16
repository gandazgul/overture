#!/usr/bin/env -S deno run -A
// @ts-check

import { chromium } from "npm:playwright";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { LayoutOrder } from "../src/types.js";

const VIEWPORT = { width: 1280, height: 720 };
const OUTPUT_DIR = join("public", "assets", "rules");
const PORT_START = 8080;
const PORT_END = 8090;

/**
 * Theater screenshot filenames keyed by layout id.
 * Example: grand-empress -> docs/images/theater-grand-empress.png
 */
const screenshotTargets = LayoutOrder.map((layoutId) => ({
    layoutId,
    fileName: `theater-${layoutId}.png`,
    outPath: join(OUTPUT_DIR, `theater-${layoutId}.png`),
}));

const missingTargets = screenshotTargets.filter((t) => !existsSync(t.outPath));

console.log("=== Capture missing theater screenshots ===");
console.log(`Output dir: ${OUTPUT_DIR}`);
console.log(`Total layouts: ${screenshotTargets.length}`);
console.log(`Missing screenshots: ${missingTargets.length}`);

if (missingTargets.length === 0) {
    console.log("Nothing missing. Exiting.");
    Deno.exit(0);
}

console.log("Missing:", missingTargets.map((t) => t.fileName).join(", "));

// Start Vite dev server
const devServer = new Deno.Command("deno", {
    args: ["task", "dev"],
    stdout: "piped",
    stderr: "piped",
}).spawn();

let browser;

try {
    const baseUrl = await waitForServerOnPortRange(PORT_START, PORT_END, 30_000);
    console.log(`Dev server detected at ${baseUrl}`);

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: VIEWPORT });

    await page.goto(baseUrl, { waitUntil: "networkidle" });

    for (const target of missingTargets) {
        await page.evaluate((layoutId) => {
            const game = window.__PHASER_GAME__;
            if (!game) {
                throw new Error("window.__PHASER_GAME__ not found");
            }
            game.scene.start("GameScene", {
                playerCount: 2,
                layoutId,
                // Exactly one human => pass screen is auto-skipped for human turns.
                aiConfig: [null, "easy"],
                playerColorMap: [0, 1],
            });
        }, target.layoutId);

        await page.waitForFunction(() => {
            const game = window.__PHASER_GAME__;
            if (!game) return false;
            const scene = game.scene.getScene("GameScene");
            return !!scene
                && scene.scene.isActive()
                && !!scene.theaterGrid
                && scene.turnPhase === "play"
                && !scene.passOverlay;
        }, { timeout: 15_000 });

        // Allow an extra beat for textures/UI to settle
        await page.waitForTimeout(350);

        await page.screenshot({
            path: target.outPath,
            type: "png",
            fullPage: false,
        });

        console.log(`Wrote ${target.outPath}`);
    }

    console.log("Done.");
} catch (err) {
    console.error("Capture failed:", err);
    console.error("If Playwright browser is missing, run: npx playwright install");
    Deno.exitCode = 1;
} finally {
    try {
        await browser?.close();
    } catch {
        // ignore
    }

    try {
        devServer.kill("SIGTERM");
    } catch {
        // ignore
    }

    // Do not await stdout/stderr drains here: Vite can keep streams open briefly
    // and block script shutdown after successful capture.
}

/**
 * Wait until HTTP server responds on one of the ports in range.
 * @param {number} portStart
 * @param {number} portEnd
 * @param {number} timeoutMs
 * @returns {Promise<string>} Base URL (e.g. http://127.0.0.1:8081)
 */
async function waitForServerOnPortRange(portStart, portEnd, timeoutMs) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        for (let port = portStart; port <= portEnd; port++) {
            const url = `http://127.0.0.1:${port}`;
            try {
                const res = await fetch(url);
                if (res.ok || res.status === 404) {
                    return url;
                }
            } catch {
                // not listening on this port yet
            }
        }
        await new Promise((r) => setTimeout(r, 300));
    }

    throw new Error(
        `Timed out waiting for dev server on ports ${portStart}-${portEnd}`,
    );
}
