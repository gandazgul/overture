#!/usr/bin/env -S deno run -A

import { ensureParentDir } from "../utils.js";
import { PatronTypeOrder } from "../types.js";
import { calculateGlobalAverageScore, createAggregate, mergeAggregate } from "./aggregate.js";
import { SIMULATOR_EXPERIMENT } from "./simulator.js";

/** @typedef {import('./aggregate.js').SimulationAggregate} SimulationAggregate */

/**
 * @typedef {Object} CliConfig
 * @property {number} games
 * @property {string} layout
 * @property {number} players
 * @property {number} seed
 * @property {number} concurrency
 * @property {string} output
 */

/**
 * @param {string[]} args
 * @returns {CliConfig}
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
console.log("🚀 Overture Balance Simulator");
console.log("=========================================");
if (config.players === 2) {
    console.log(`Experiment: ${SIMULATOR_EXPERIMENT.description}`);
}

const startMs = performance.now();

const workersCount = Math.min(config.concurrency, config.games);
const baseChunk = Math.floor(config.games / workersCount);
let remainder = config.games % workersCount;
/** @type {Promise<SimulationAggregate>[]} */
const workerPromises = [];

/** @type {Record<number, number>} */
const completedCounts = {};
const totalGamesInProgress = config.games;

/**
 * Write a string to stderr without a trailing newline.
 * @param {string} text
 */
function stderrWrite(text) {
    Deno.stderr.writeSync(new TextEncoder().encode(text));
}

/**
 * Clear the progress bar line from the terminal.
 */
function clearProgressBar() {
    stderrWrite("\r" + " ".repeat(70) + "\r");
}

/**
 * Render a single-line progress bar on stderr (no trailing newline, uses \r for in-place update).
 * @param {number} completed Total games completed across all workers.
 * @param {number} total Total games to simulate.
 */
function renderProgressBar(completed, total) {
    const pct = Math.min(100, (completed / total) * 100);
    const barWidth = 40;
    const filled = Math.round((pct / 100) * barWidth);
    const empty = barWidth - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    stderrWrite(
        `\r[${bar}] ${completed.toLocaleString()} / ${total.toLocaleString()} games (${pct.toFixed(0)}%)`,
    );
}

for (let i = 0; i < workersCount; i++) {
    const gamesForWorker = baseChunk + (remainder > 0 ? 1 : 0);
    remainder--;
    if (gamesForWorker <= 0) continue;

    const workerUrl = new URL("./worker.js", import.meta.url).href;
    const worker = new Worker(workerUrl, { type: "module" });

    const promise = new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
            const data = /** @type {{ type: string, workerId?: number, completed?: number, aggregate?: SimulationAggregate }} */
                (e.data);
            if (data.type === "progress" && data.workerId !== undefined && data.completed !== undefined) {
                completedCounts[data.workerId] = data.completed;
                const totalDone = Object.values(completedCounts).reduce((a, b) => a + b, 0);
                renderProgressBar(totalDone, totalGamesInProgress);
            } else if (data.type === "done" && data.aggregate) {
                resolve(data.aggregate);
            }
        };
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

/**
 * Format a duration in milliseconds into a human-friendly string.
 * @param {number} ms
 * @returns {string}
 */
function fmtDuration(ms) {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
        return `${totalSeconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    if (minutes < 60) {
        return `${minutes}m ${seconds}s`;
    }
    const hours = Math.floor(minutes / 60);
    const remainMin = minutes % 60;
    return `${hours}h ${remainMin}m ${seconds}s`;
}

try {
    const allWorkerAggregates = await Promise.all(workerPromises);
    const aggregate = createAggregate(config.players);
    for (const workerAggregate of allWorkerAggregates) {
        mergeAggregate(aggregate, workerAggregate);
    }

    const durationMs = performance.now() - startMs;
    const globalAvgScore = calculateGlobalAverageScore(aggregate, config.players);
    const gamesPerSecond = Math.round(config.games / (durationMs / 1000));

    // ── Output ──
    const summary = aggregate.wins.map((winCount, idx) => ({
        "Player": `Player ${idx + 1}`,
        "Win Rate": `${((winCount / config.games) * 100).toFixed(1)}%`,
        "Avg Score": (aggregate.playerScoresTotal[idx] / config.games).toFixed(2),
        "First Count": aggregate.firstTurnsTotal[idx].toLocaleString(),
        "Lobby Draws": aggregate.drawsTotal[idx].lobby.toLocaleString(),
        "Deck Draws": aggregate.drawsTotal[idx].deck.toLocaleString(),
    }));

    summary.push({
        "Player": "Ties",
        "Win Rate": `${((aggregate.ties / config.games) * 100).toFixed(1)}%`,
        "Avg Score": "—",
        "First Count": "—",
        "Lobby Draws": "—",
        "Deck Draws": "—",
    });

    clearProgressBar();
    console.table(summary);

    if (config.players === 2) {
        console.log("\n🎭 Hardcoded Starting Cards:");
        for (let p = 0; p < aggregate.startingCardsByPlayer.length; p++) {
            const cards = Object.entries(aggregate.startingCardsByPlayer[p])
                .sort((a, b) => b[1] - a[1])
                .map(([card, count]) => `${card}: ${count.toLocaleString()}`)
                .join(", ");
            console.log(`Player ${p + 1}: ${cards}`);
        }
    }

    console.log("\n📊 Patron Type Averages (VP per placement):");
    for (const type of PatronTypeOrder) {
        if (aggregate.typeCounts[type]) {
            const avg = aggregate.typeScores[type] / aggregate.typeCounts[type];
            console.log(`- ${type.padEnd(10)}: ${avg.toFixed(2)} VP`);
        }
    }

    console.log("\n📊 Detailed Type + Trait Averages (VP per placement):");
    const sortedDetailedScores = Object.keys(aggregate.typeCountsDetailed).sort((a, b) => {
        return (aggregate.typeScoresDetailed[b] / aggregate.typeCountsDetailed[b]) -
            (aggregate.typeScoresDetailed[a] / aggregate.typeCountsDetailed[a]);
    });
    for (const key of sortedDetailedScores) {
        if (aggregate.typeCountsDetailed[key]) {
            const avg = aggregate.typeScoresDetailed[key] / aggregate.typeCountsDetailed[key];
            console.log(`- ${key.padEnd(25)}: ${avg.toFixed(2)} VP`);
        }
    }

    console.log("\n🛍️ Top 3 Lobby Picks by Player (By Type):");
    for (let p = 0; p < config.players; p++) {
        const sortedPicks = Object.entries(aggregate.lobbyPicksByPlayer[p])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        console.log(`Player ${p + 1}:`);
        for (const [card, count] of sortedPicks) {
            console.log(`  - ${card.padEnd(20)}: ${count} times`);
        }
    }

    console.log("\n🛍️ Top 3 Lobby Picks by Player (Detailed):");
    for (let p = 0; p < config.players; p++) {
        const sortedPicks = Object.entries(aggregate.lobbyPicksDetailedByPlayer[p])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        console.log(`Player ${p + 1}:`);
        for (const [card, count] of sortedPicks) {
            console.log(`  - ${card.padEnd(25)}: ${count} times`);
        }
    }

    if (config.players === 2) {
        console.log("\n🗑️ Top 3 Discards by Player (By Type):");
        for (let p = 0; p < config.players; p++) {
            const sortedDiscards = Object.entries(aggregate.discardsByPlayer[p])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            console.log(`Player ${p + 1}:`);
            for (const [card, count] of sortedDiscards) {
                console.log(`  - ${card.padEnd(20)}: ${count} times`);
            }
        }

        console.log("\n🗑️ Top 3 Discards by Player (Detailed):");
        for (let p = 0; p < config.players; p++) {
            const sortedDiscards = Object.entries(aggregate.discardsDetailedByPlayer[p])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            console.log(`Player ${p + 1}:`);
            for (const [card, count] of sortedDiscards) {
                console.log(`  - ${card.padEnd(25)}: ${count} times`);
            }
        }
    }

    console.log("\n📈 Additional Stats:");
    console.log(`- Global Avg Score: ${globalAvgScore.toFixed(2)} VP`);
    console.log(`- Total Ties:       ${aggregate.ties} (${((aggregate.ties / config.games) * 100).toFixed(1)}%)`);
    console.log(`- Time Elapsed:     ${fmtDuration(durationMs)} (${gamesPerSecond} games/sec)`);

    // ── File Export ──
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = `${config.output}run_${timestamp}.json`;
    await ensureParentDir(outPath);

    const report = {
        config: {
            ...config,
            experiment: config.players === 2 ? SIMULATOR_EXPERIMENT : null,
        },
        stats: {
            wins: aggregate.wins,
            ties: aggregate.ties,
            globalAvgScore,
            durationMs,
            gamesPerSecond,
            firstTurnsTotal: aggregate.firstTurnsTotal,
        },
        aggregates: {
            typeScores: aggregate.typeScores,
            typeCounts: aggregate.typeCounts,
            typeScoresDetailed: aggregate.typeScoresDetailed,
            typeCountsDetailed: aggregate.typeCountsDetailed,
            lobbyPicksByPlayer: aggregate.lobbyPicksByPlayer,
            lobbyPicksDetailedByPlayer: aggregate.lobbyPicksDetailedByPlayer,
            discardsByPlayer: aggregate.discardsByPlayer,
            discardsDetailedByPlayer: aggregate.discardsDetailedByPlayer,
            startingCardsByPlayer: aggregate.startingCardsByPlayer,
        },
    };

    await Deno.writeTextFile(outPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Saved full report to ${outPath}\n`);
} catch (err) {
    console.error("Simulation failed:", err);
    Deno.exit(1);
}
