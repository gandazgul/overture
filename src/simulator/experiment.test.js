/// <reference lib="deno.ns" />
import { assert, assertAlmostEquals, assertEquals, assertThrows } from "@std/assert";
import * as current from "../ai.js";
import { parseExperimentArgs } from "./experiment-cli.js";
import { meanInterval, runUnit, summarizeExperiment, summarizeGame, wilsonInterval } from "./experiment.js";
import { simulateGame } from "./simulator.js";

/** @typedef {import('./experiment.js').UnitResult} UnitResult */
/** @typedef {import('./experiment.js').GameSummary} GameSummary */

/** @param {number} winner @param {number} margin @returns {GameSummary} */
function game(winner, margin) {
    return {
        winner,
        scores: [60 + margin, 60],
        noisy: [0, 0],
        uniqueTypes: [4, 4],
        scoreTie: margin === 0,
        orderTiebreak: margin === 0,
    };
}

/** @param {number} seed @param {GameSummary[]} games @returns {UnitResult} */
function unit(seed, games) {
    const timing = { drawMs: 0, draws: 0, placementMs: 0, placements: 0 };
    return { seed, games, candidateTiming: { ...timing }, baselineTiming: { ...timing } };
}

Deno.test("Experiment CLI rejects typos, wrapping seeds, and invalid settings", () => {
    assertThrows(() => parseExperimentArgs(["--pairs", "5000"]));
    assertThrows(() => parseExperimentArgs(["--samples", "1.5"]));
    assertThrows(() => parseExperimentArgs(["--workers", "0"]));
    assertThrows(() => parseExperimentArgs(["--seed", "4294967295", "--samples", "2"]));
    assertThrows(() => parseExperimentArgs(["--samples"]));
    assertThrows(() => parseExperimentArgs(["--win-tolerance", "NaN"]));
    assertThrows(() => parseExperimentArgs(["--potential-scale", "NaN"]));
    assertThrows(() => parseExperimentArgs(["--future-weight", "-1"]));
    assertThrows(() => parseExperimentArgs(["--blind-first", "yes"]));
    assertThrows(() => parseExperimentArgs(["--baseline-potential-scale", "NaN"]));
    assertThrows(() => parseExperimentArgs(["--mode", "balance", "--baseline-blind-first", "true"]));
    assertThrows(() => parseExperimentArgs(["--turn-order", "random"]));
    assertThrows(() => parseExperimentArgs(["--tiebreak", "later"]));
    assertEquals(parseExperimentArgs([]).tiebreak, "live");
    assertEquals(parseExperimentArgs(["--tiebreak", "noisy-later"]).tiebreak, "noisy-later");
    assertEquals(parseExperimentArgs(["--tiebreak", "diversity-later"]).tiebreak, "diversity-later");
    assertEquals(parseExperimentArgs(["--turn-order", "rotating"]).turnOrder, "rotating");
    assertEquals(parseExperimentArgs(["--mode", "balance", "--turn-order", "rotating"]).turnOrder, "rotating");
});

Deno.test("Recorded experimental policy can be reproduced on the baseline side", () => {
    const config = parseExperimentArgs([
        "--samples",
        "1",
        "--blind-first",
        "true",
        "--baseline-blind-first",
        "true",
        "--potential-scale",
        "1",
        "--baseline-potential-scale",
        "1",
        "--future-weight",
        "0.5",
        "--baseline-future-weight",
        "0.5",
    ]);
    const result = runUnit(config, 0, current, current);
    assertEquals(result.games[0], result.games[1]);
});

Deno.test("Experiment false switch reaches promoted Hard on either side", () => {
    const config = parseExperimentArgs(["--samples", "1", "--blind-first", "false", "--baseline-blind-first", "false"]);
    let calls = 0;
    /** @type {import('./simulator.js').AIStrategy} */
    const strategy = {
        ...current,
        pickDrawAction(...args) {
            assertEquals(args[6]?.blindFirst, false);
            assertEquals(args[6]?.playerCount, 2);
            calls++;
            return current.pickDrawAction(...args);
        },
    };
    const result = runUnit(config, 0, strategy, strategy);
    assert(calls > 0);
    assertEquals(result.games[0], result.games[1]);
});

Deno.test("Blind-first candidate defers the Lobby decision without changing baseline calls", () => {
    const config = parseExperimentArgs(["--samples", "1", "--blind-first", "true"]);
    let candidateDraws = 0;
    let baselineFirstDraws = 0;
    /** @type {import('./simulator.js').AIStrategy} */
    const candidate = {
        ...current,
        pickDrawAction(...args) {
            assert(!(args[1] >= 2 && args[5]?.length === 1));
            candidateDraws++;
            return current.pickDrawAction(...args);
        },
    };
    /** @type {import('./simulator.js').AIStrategy} */
    const baseline = {
        ...current,
        pickDrawAction(...args) {
            if (args[1] >= 2 && args[5]?.length === 1) baselineFirstDraws++;
            return current.pickDrawAction(...args);
        },
    };
    const result = runUnit(config, 0, candidate, baseline);
    assert(candidateDraws > 0 && baselineFirstDraws > 0);
    assertEquals(result.candidateTiming.draws, 48);
    assertEquals(result.baselineTiming.draws, 48);
});

Deno.test("Explicit default tuning preserves live behavior and options reach only the candidate", () => {
    const config = parseExperimentArgs(["--samples", "1", "--potential-scale", "1", "--future-weight", "0.8"]);
    assertEquals(runUnit(config, 0, current, current).games[0], runUnit(config, 0, current, current).games[1]);
    let draws = 0;
    let placements = 0;
    /** @type {import('./simulator.js').AIStrategy} */
    const candidate = {
        ...current,
        pickDrawAction(...args) {
            assertEquals(args[6]?.potentialScale, 0);
            assertEquals(args[6]?.futureWeight, 1);
            assert((args[6]?.turnsRemaining ?? 0) > 0);
            draws++;
            return current.pickDrawAction(...args);
        },
        pickCardAndSeat(...args) {
            assertEquals(args[5]?.potentialScale, 0);
            assertEquals(args[5]?.futureWeight, 1);
            assert((args[5]?.turnsRemaining ?? 0) > 0);
            placements++;
            return current.pickCardAndSeat(...args);
        },
    };
    /** @type {import('./simulator.js').AIStrategy} */
    const baseline = {
        ...current,
        pickDrawAction(...args) {
            assertEquals(args[6]?.potentialScale, undefined);
            return current.pickDrawAction(...args);
        },
    };
    runUnit({ ...config, candidateOptions: { potentialScale: 0, futureWeight: 1 } }, 0, candidate, baseline);
    assert(draws > 0 && placements > 0);
});

Deno.test("Identical policies yield identical paired games and exactly 50% candidate wins", () => {
    const config = parseExperimentArgs(["--samples", "2"]);
    const results = [runUnit(config, 0, current, current), runUnit(config, 1, current, current)];
    for (const result of results) assertEquals(result.games[0], result.games[1]);
    const summary = summarizeExperiment(config, results);
    assertEquals(summary.games, 4);
    assertEquals(summary.independentSamples, 2);
    assertEquals(summary.winRate.mean, 0.5);
    assertEquals(summary.scoreMargin.mean, 0);
    assertEquals(summary.winRate.ci95, null);
    assertEquals(summary.improved, false);
});

Deno.test("Pair uncertainty uses independent seed pairs, not twice as many independent games", () => {
    const config = parseExperimentArgs([]);
    const results = Array.from(
        { length: 100 },
        (_, i) => i < 50 ? unit(i, [game(0, 4), game(1, -4)]) : unit(i, [game(1, -2), game(0, 2)]),
    );
    const summary = summarizeExperiment(config, results);
    assertEquals(summary.winRate.mean, 0.5);
    assertEquals(summary.scoreMargin.mean, 1);
    const expectedHalfWidth = 1.959963984540054 * Math.sqrt((25 / 99) / 100);
    assertAlmostEquals(summary.winRate.ci95?.[1] ?? 0, 0.5 + expectedHalfWidth);
    assertEquals(summary.byPosition.map((p) => p.wins), [50, 50]);
    assertEquals(summary.improved, false);
});

Deno.test("Balance requires the entire interval inside prespecified tolerances", () => {
    const config = parseExperimentArgs(["--mode", "balance", "--win-tolerance", "0.01"]);
    const results = Array.from({ length: 20000 }, (_, i) => unit(i, [game(i % 2, i % 2 ? -1 : 1)]));
    const summary = summarizeExperiment(config, results);
    assert(summary.practicallyBalanced);
    const tooStrict = summarizeExperiment({ ...config, winTolerance: 0.001 }, results);
    assertEquals(tooStrict.practicallyBalanced, false);
    assertEquals(summarizeExperiment(config, results.slice(0, 100)).practicallyBalanced, false);
    assertEquals(summarizeExperiment(config, []).practicallyBalanced, false);
});

Deno.test("Intervals have known values and do not claim small-sample certainty", () => {
    assertEquals(meanInterval([1, 2]).ci95, null);
    assertEquals(meanInterval(Array(100).fill(1)).ci95, null);
    assertEquals(wilsonInterval(1, 2), null);
    const interval = wilsonInterval(5054, 10000);
    assert(interval);
    assertAlmostEquals(interval[0], 0.495600559437186);
    assertAlmostEquals(interval[1], 0.5151952933804107);
});

Deno.test("Live winner summary respects score, Noisy, and later-order tiebreaks", () => {
    const result = simulateGame({
        playerCount: 2,
        layoutId: "grand-empress",
        aiDifficulty: "easy",
        seed: 8,
        epsilon: 1,
    });
    for (const player of result.players) {
        player.total = 10;
        player.noisyCount = 0;
        player.uniqueTypesCount = 3;
    }
    assertEquals(summarizeGame(result).winner, 1);
    assertEquals(summarizeGame(result).orderTiebreak, true);
    result.players[0].noisyCount = 1;
    assertEquals(summarizeGame(result).winner, 0);
    result.players[1].total = 11;
    assertEquals(summarizeGame(result).winner, 1);
    result.players[1].total = 10;
    result.players[1].noisyCount = 1;
    result.players[0].uniqueTypesCount = 4;
    assertEquals(summarizeGame(result).winner, 1);
    assertEquals(summarizeGame(result).orderTiebreak, true);
    assertEquals(summarizeGame(result, "diversity-later").winner, 0);
    assertEquals(summarizeGame(result, "diversity-later").orderTiebreak, false);
});

Deno.test("Experimental tiebreak skips diversity but preserves VP and Noisy precedence", () => {
    const result = simulateGame({ playerCount: 2, layoutId: "grand-empress", aiDifficulty: "easy", seed: 8 });
    const [a, b] = result.players;
    a.total = b.total = 10;
    a.noisyCount = b.noisyCount = 1;
    a.uniqueTypesCount = 7;
    b.uniqueTypesCount = 2;
    assertEquals(summarizeGame(result, "diversity-later").winner, 0);
    assertEquals(summarizeGame(result), summarizeGame(result, "noisy-later"));
    assertEquals(summarizeGame(result, "noisy-later").winner, 1);
    assertEquals(summarizeGame(result, "noisy-later").orderTiebreak, true);
    a.noisyCount = 2;
    assertEquals(summarizeGame(result, "noisy-later").winner, 0);
    assertEquals(summarizeGame(result, "noisy-later").orderTiebreak, false);
    b.total = 11;
    assertEquals(summarizeGame(result, "noisy-later").winner, 1);
    a.total = 12;
    b.noisyCount = 3;
    assertEquals(summarizeGame(result, "noisy-later").winner, 0);
});

Deno.test("Experiment runner applies the selected tiebreak without changing game trajectories", () => {
    // An archived development seed ties VP/Noisy but gives P1 greater diversity.
    const config = parseExperimentArgs(["--samples", "1", "--seed", "7012519"]);
    for (const mode of /** @type {const} */ (["balance", "compare"])) {
        const legacy = runUnit({ ...config, mode, tiebreak: "diversity-later" }, 0, current, current);
        const live = runUnit({ ...config, mode }, 0, current, current);
        const experimental = runUnit({ ...config, mode, tiebreak: "noisy-later" }, 0, current, current);
        assertEquals(live.games, experimental.games);
        for (const [index, game] of experimental.games.entries()) {
            assertEquals(legacy.games[index].winner, 0);
            assertEquals(game.winner, 1);
            assertEquals(legacy.games[index].orderTiebreak, false);
            assertEquals(game.orderTiebreak, true);
            assertEquals(game.scores, legacy.games[index].scores);
            assertEquals(game.noisy, legacy.games[index].noisy);
            assertEquals(game.uniqueTypes, legacy.games[index].uniqueTypes);
            const difference = game.scores[0] - game.scores[1] || game.noisy[0] - game.noisy[1];
            assertEquals(game.winner, difference > 0 ? 0 : 1);
            assertEquals(game.orderTiebreak, difference === 0);
        }
    }
});
