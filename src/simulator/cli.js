#!/usr/bin/env -S deno run -A

/** @typedef {import('../types.js').CardData} CardData */

import { ensureParentDir } from "../utils.js";
import { PatronTypeOrder } from "../types.js";

/**
 * @param {string[]} args
 * @returns {{ games: number, layout: string, players: number, seed: number, concurrency: number, output: string }}
 */
function parseArgs(args) {
    const config = {
        games: 1000,
        layout: "grand-empress",
        players: 2,
        seed: Date.now() >>> 0,
        concurrency: globalThis.navigator?.hardwareConcurrency || 4,
        output: "./sim-results/",
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--games" && args[i + 1]) config.games = parseInt(args[++i], 10);
        if (args[i] === "--layout" && args[i + 1]) config.layout = args[++i];
        if (args[i] === "--players" && args[i + 1]) config.players = parseInt(args[++i], 10);
        if (args[i] === "--seed" && args[i + 1]) config.seed = parseInt(args[++i], 10) >>> 0;
        if (args[i] === "--concurrency" && args[i + 1]) config.concurrency = parseInt(args[++i], 10);
    }
    return config;
}

const config = parseArgs(Deno.args);

console.log("=========================================");
console.log(`🚀 Overture Balance Simulator`);
console.log("=========================================");

const startMs = performance.now();

const workersCount = Math.min(config.concurrency, config.games);
const baseChunk = Math.floor(config.games / workersCount);
let remainder = config.games % workersCount;
const workerPromises = [];

for (let i = 0; i < workersCount; i++) {
    const gamesForWorker = baseChunk + (remainder > 0 ? 1 : 0);
    remainder--;
    if (gamesForWorker <= 0) continue;

    const workerUrl = new URL("./worker.js", import.meta.url).href;
    const worker = new Worker(workerUrl, { type: "module" });

    const promise = new Promise((resolve, reject) => {
        worker.onmessage = (e) => resolve(e.data.results);
        worker.onerror = (err) => reject(err);
        worker.postMessage({
            games: gamesForWorker,
            layout: config.layout,
            players: config.players,
            baseSeed: config.seed,
            workerId: i,
        });
    });
    workerPromises.push(promise);
}

try {
    const allWorkerResults = await Promise.all(workerPromises);

    const wins = Array(config.players).fill(0);
    let ties = 0;
    let totalScore = 0;

    // Analytics aggregations
    /** @type {Object.<string, number>} */
    const typeScores = {};
    /** @type {Object.<string, number>} */
    const typeCounts = {};
    /** @type {Object.<string, number>[]} */
    const lobbyPicksByPlayer = Array.from({ length: config.players }, () => ({}));

    for (const chunk of allWorkerResults) {
        for (const game of chunk) {
            /** @type {number[]} */
            const scores = game.players.map((/** @type {{total: number}} */ p) => p.total);
            const maxScore = Math.max(...scores);
            /** @type {number[]} */
            const winners = scores.map((/** @type {number} */ s, /** @type {number} */ idx) =>
                s === maxScore ? idx : -1
            ).filter((/** @type {number} */ idx) => idx !== -1);

            if (winners.length > 1) ties++;
            else wins[winners[0]]++;

            totalScore += scores.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0);

            // Aggregate Data
            game.players.forEach((/** @type {any} */ p, /** @type {number} */ idx) => {
                // Type Scores
                for (const [type, data] of Object.entries(p.typeBreakdown)) {
                    typeScores[type] = (typeScores[type] || 0) + data.vp;
                    typeCounts[type] = (typeCounts[type] || 0) + data.count;
                }
                // Lobby Picks
                for (const [card, count] of Object.entries(p.lobbyPicks)) {
                    lobbyPicksByPlayer[idx][card] = (lobbyPicksByPlayer[idx][card] || 0) + count;
                }
            });
        }
    }

    const durationMs = performance.now() - startMs;
    const avgScore = totalScore / (config.games * config.players);

    // ── Output ──
    const summary = wins.map((winCount, idx) => ({
        "Player": `Player ${idx + 1}`,
        "Win Rate": `${((winCount / config.games) * 100).toFixed(1)}%`,
        "Avg Score": (totalScore / config.games / config.players).toFixed(1), // Rough approx for table
    }));

    console.table(summary);

    console.log(`\n📊 Patron Type Averages (VP per placement):`);
    for (const type of PatronTypeOrder) {
        if (typeCounts[type]) {
            const avg = typeScores[type] / typeCounts[type];
            console.log(`- ${type.padEnd(10)}: ${avg.toFixed(2)} VP`);
        }
    }

    console.log(`\n🛍️ Top 3 Lobby Picks by Player:`);
    for (let p = 0; p < config.players; p++) {
        const sortedPicks = Object.entries(lobbyPicksByPlayer[p])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        console.log(`Player ${p + 1}:`);
        for (const [card, count] of sortedPicks) {
            console.log(`  - ${card.padEnd(20)}: ${count} times`);
        }
    }

    console.log(
        `\n⏱️  Time Elapsed: ${durationMs.toFixed(2)} ms (${Math.round(config.games / (durationMs / 1000))} games/sec)`,
    );

    // ── File Export ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `${config.output}run_${timestamp}.json`;
    await ensureParentDir(outPath);

    const report = {
        config,
        stats: {
            wins,
            ties,
            avgScore,
            durationMs,
        },
        aggregates: {
            typeScores,
            typeCounts,
            lobbyPicksByPlayer,
        },
    };

    await Deno.writeTextFile(outPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Saved full report to ${outPath}\n`);
} catch (err) {
    console.error("Simulation failed:", err);
    Deno.exit(1);
}
