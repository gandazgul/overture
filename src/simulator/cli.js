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
            const data = e.data;
            if (data.type === "progress") {
                completedCounts[data.workerId] = data.completed;
                const totalDone = Object.values(completedCounts).reduce((a, b) => a + b, 0);
                renderProgressBar(totalDone, totalGamesInProgress);
            } else if (data.type === "done") {
                resolve(data.results);
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

try {
    const allWorkerResults = await Promise.all(workerPromises);

    /** @type {number[]} */
    const wins = Array(config.players).fill(0);
    /** @type {number[]} */
    const playerScoresTotal = Array(config.players).fill(0);
    /** @type {number[]} */
    const firstTurnsTotal = Array(config.players).fill(0); // Track parity
    /** @type {{lobby: number, deck: number}[]} */
    const drawsTotal = Array.from({ length: config.players }, () => ({ lobby: 0, deck: 0 }));
    let ties = 0;
    let totalScore = 0;

    // Analytics aggregations
    /** @type {Object.<string, number>} */
    const typeScores = {};
    /** @type {Object.<string, number>} */
    const typeCounts = {};
    /** @type {Object.<string, number>} */
    const typeScoresDetailed = {};
    /** @type {Object.<string, number>} */
    const typeCountsDetailed = {};

    /** @type {Object.<string, number>[]} */
    const lobbyPicksByPlayer = Array.from({ length: config.players }, () => ({}));
    /** @type {Object.<string, number>[]} */
    const lobbyPicksDetailedByPlayer = Array.from({ length: config.players }, () => ({}));

    /** @type {Object.<string, number>[]} */
    const discardsByPlayer = Array.from({ length: config.players }, () => ({}));
    /** @type {Object.<string, number>[]} */
    const discardsDetailedByPlayer = Array.from({ length: config.players }, () => ({}));

    for (const chunk of allWorkerResults) {
        for (const game of chunk) {
            /** @type {number[]} */
            const scores = game.players.map((/** @type {{total: number}} */ p) => p.total);
            const maxScore = Math.max(...scores);
            /** @type {number[]} */
            let winners = scores.map((/** @type {number} */ s, /** @type {number} */ idx) => s === maxScore ? idx : -1)
                .filter((/** @type {number} */ idx) => idx !== -1);

            if (winners.length > 1) {
                // Tiebreaker 1: Most Noisy
                const maxNoisy = Math.max(...winners.map((/** @type {number} */ idx) => game.players[idx].noisyCount));
                winners = winners.filter((/** @type {number} */ idx) => game.players[idx].noisyCount === maxNoisy);

                if (winners.length > 1) {
                    // Tiebreaker 2: Most unique types
                    const maxUnique = Math.max(
                        ...winners.map((/** @type {number} */ idx) => game.players[idx].uniqueTypesCount),
                    );
                    winners = winners.filter((/** @type {number} */ idx) =>
                        game.players[idx].uniqueTypesCount === maxUnique
                    );

                    // if (winners.length > 1) {
                    //     // Tiebreaker 3: Last player in order wins
                    //     const lastPlayerIdx = Math.max(...winners);
                    //     winners = [lastPlayerIdx];
                    // }
                }
            }

            if (winners.length > 1) ties++;
            else wins[winners[0]]++;

            totalScore += scores.reduce((/** @type {number} */ a, /** @type {number} */ b) => a + b, 0);

            // Aggregate Data
            game.players.forEach((/** @type {any} */ p, /** @type {number} */ idx) => {
                playerScoresTotal[idx] += p.total;
                firstTurnsTotal[idx] += p.firstTurns; // Aggregate first turns
                drawsTotal[idx].lobby += p.draws.lobby;
                drawsTotal[idx].deck += p.draws.deck;

                // Type Scores
                for (const [type, data] of Object.entries(p.typeBreakdown)) {
                    typeScores[type] = (typeScores[type] || 0) + data.vp;
                    typeCounts[type] = (typeCounts[type] || 0) + data.count;
                }
                for (const [keyDetailed, data] of Object.entries(p.typeBreakdownDetailed)) {
                    typeScoresDetailed[keyDetailed] = (typeScoresDetailed[keyDetailed] || 0) + data.vp;
                    typeCountsDetailed[keyDetailed] = (typeCountsDetailed[keyDetailed] || 0) + data.count;
                }

                // Lobby Picks
                for (const [card, count] of Object.entries(p.lobbyPicks)) {
                    lobbyPicksByPlayer[idx][card] = (lobbyPicksByPlayer[idx][card] || 0) + count;
                }
                for (const [card, count] of Object.entries(p.lobbyPicksDetailed)) {
                    lobbyPicksDetailedByPlayer[idx][card] = (lobbyPicksDetailedByPlayer[idx][card] || 0) + count;
                }

                // Discards
                if (p.discards) {
                    for (const [card, count] of Object.entries(p.discards)) {
                        discardsByPlayer[idx][card] = (discardsByPlayer[idx][card] || 0) + count;
                    }
                }
                if (p.discardsDetailed) {
                    for (const [card, count] of Object.entries(p.discardsDetailed)) {
                        discardsDetailedByPlayer[idx][card] = (discardsDetailedByPlayer[idx][card] || 0) + count;
                    }
                }
            });
        }
    }

    const durationMs = performance.now() - startMs;
    const globalAvgScore = totalScore / (config.games * config.players);

    // ── Output ──
    const summary = wins.map((winCount, idx) => ({
        "Player": `Player ${idx + 1}`,
        "Win Rate": `${((winCount / config.games) * 100).toFixed(1)}%`,
        "Avg Score": (playerScoresTotal[idx] / config.games).toFixed(2),
        "First Count": firstTurnsTotal[idx].toLocaleString(), // Verify parity
        "Lobby Draws": drawsTotal[idx].lobby.toLocaleString(),
        "Deck Draws": drawsTotal[idx].deck.toLocaleString(),
    }));

    summary.push({
        "Player": "Ties",
        "Win Rate": `${((ties / config.games) * 100).toFixed(1)}%`,
        "Avg Score": "—",
        "First Count": "—",
        "Lobby Draws": "—",
        "Deck Draws": "—",
    });

    clearProgressBar();
    console.table(summary);

    console.log(`\n📊 Patron Type Averages (VP per placement):`);
    for (const type of PatronTypeOrder) {
        if (typeCounts[type]) {
            const avg = typeScores[type] / typeCounts[type];
            console.log(`- ${type.padEnd(10)}: ${avg.toFixed(2)} VP`);
        }
    }

    console.log(`\n📊 Detailed Type + Trait Averages (VP per placement):`);
    const sortedDetailedScores = Object.keys(typeCountsDetailed).sort((a, b) => {
        return (typeScoresDetailed[b] / typeCountsDetailed[b]) - (typeScoresDetailed[a] / typeCountsDetailed[a]);
    });
    for (const key of sortedDetailedScores) {
        if (typeCountsDetailed[key]) {
            const avg = typeScoresDetailed[key] / typeCountsDetailed[key];
            console.log(`- ${key.padEnd(25)}: ${avg.toFixed(2)} VP`);
        }
    }

    console.log(`\n🛍️ Top 3 Lobby Picks by Player (By Type):`);
    for (let p = 0; p < config.players; p++) {
        const sortedPicks = Object.entries(lobbyPicksByPlayer[p])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        console.log(`Player ${p + 1}:`);
        for (const [card, count] of sortedPicks) {
            console.log(`  - ${card.padEnd(20)}: ${count} times`);
        }
    }

    console.log(`\n🛍️ Top 3 Lobby Picks by Player (Detailed):`);
    for (let p = 0; p < config.players; p++) {
        const sortedPicks = Object.entries(lobbyPicksDetailedByPlayer[p])
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        console.log(`Player ${p + 1}:`);
        for (const [card, count] of sortedPicks) {
            console.log(`  - ${card.padEnd(25)}: ${count} times`);
        }
    }

    if (config.players === 2) {
        console.log(`\n🗑️ Top 3 Discards by Player (By Type):`);
        for (let p = 0; p < config.players; p++) {
            const sortedDiscards = Object.entries(discardsByPlayer[p])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            console.log(`Player ${p + 1}:`);
            for (const [card, count] of sortedDiscards) {
                console.log(`  - ${card.padEnd(20)}: ${count} times`);
            }
        }

        console.log(`\n🗑️ Top 3 Discards by Player (Detailed):`);
        for (let p = 0; p < config.players; p++) {
            const sortedDiscards = Object.entries(discardsDetailedByPlayer[p])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);

            console.log(`Player ${p + 1}:`);
            for (const [card, count] of sortedDiscards) {
                console.log(`  - ${card.padEnd(25)}: ${count} times`);
            }
        }
    }

    console.log(`\n📈 Additional Stats:`);
    console.log(`- Global Avg Score: ${globalAvgScore.toFixed(2)} VP`);
    console.log(`- Total Ties:       ${ties} (${((ties / config.games) * 100).toFixed(1)}%)`);
    /**
     * Format a duration in milliseconds into a human-friendly string.
     * @param {number} ms
     * @returns {string}
     */
    const fmtDuration = (ms) => {
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
    };
    console.log(
        `- Time Elapsed:     ${fmtDuration(durationMs)} (${Math.round(config.games / (durationMs / 1000))} games/sec)`,
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
            globalAvgScore,
            durationMs,
            firstTurnsTotal,
        },
        aggregates: {
            typeScores,
            typeCounts,
            typeScoresDetailed,
            typeCountsDetailed,
            lobbyPicksByPlayer,
            lobbyPicksDetailedByPlayer,
            discardsByPlayer,
            discardsDetailedByPlayer,
        },
    };

    await Deno.writeTextFile(outPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Saved full report to ${outPath}\n`);
} catch (err) {
    console.error("Simulation failed:", err);
    Deno.exit(1);
}
