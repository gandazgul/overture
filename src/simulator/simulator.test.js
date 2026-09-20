/// <reference lib="deno.ns" />

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { AIDifficulty, pickCardAndSeat, pickDrawAction } from "../ai.js";
import { PatronType } from "../types.js";
import { setGlobalSeed } from "../utils.js";
import { addGameToAggregate, calculateFirstPlayerStats, createAggregate, mergeAggregate } from "./aggregate.js";
import { simulateGame, SIMULATOR_EXPERIMENT, takeExactCard } from "./simulator.js";

/** @typedef {import('../types.js').CardData} CardData */
/** @typedef {import('./aggregate.js').PlayerSimulationResult} PlayerSimulationResult */
/** @typedef {import('./aggregate.js').SimulationGameResult} SimulationGameResult */

/**
 * @param {string} type
 * @param {string | null} trait
 * @returns {CardData}
 */
function card(type, trait) {
    /** @type {CardData} */
    const c = { type, label: trait ? `${trait} ${type}` : type };
    if (trait) c.trait = trait;
    return c;
}

/**
 * @param {number} total
 * @param {CardData} startingCard
 * @returns {PlayerSimulationResult}
 */
function playerResult(total, startingCard) {
    return {
        total,
        typeBreakdown: {
            [startingCard.type]: { vp: total, count: 1 },
        },
        typeBreakdownDetailed: {
            [startingCard.trait ? `${startingCard.trait} ${startingCard.type}` : `${startingCard.type} (Plain)`]: {
                vp: total,
                count: 1,
            },
        },
        lobbyPicks: {},
        lobbyPicksDetailed: {},
        firstTurns: 0,
        noisyCount: 0,
        uniqueTypesCount: 1,
        draws: { lobby: 0, deck: 1 },
        discards: {},
        discardsDetailed: {},
        startingCard,
    };
}

Deno.test("takeExactCard removes a plain card by exact type and null trait", () => {
    const patron = card(PatronType.STANDARD, null);
    const teacher = card(PatronType.TEACHER, null);
    const deck = [patron, teacher];

    const taken = takeExactCard(deck, PatronType.STANDARD, null);

    assertEquals(taken, patron);
    assertEquals(deck, [teacher]);
});

Deno.test("simulateGame gives fixed 2P starting cards and then runs normal first-turn draws", () => {
    setGlobalSeed(12345);

    const result = simulateGame({
        playerCount: 2,
        layoutId: "grand-empress",
        aiDifficulty: AIDifficulty.HARD,
        opening: "fixed",
    });

    for (const def of SIMULATOR_EXPERIMENT.fixedStartingCards) {
        const startingCard = result.startingCards[def.player - 1];
        assertEquals(startingCard?.type, def.type);
        assertEquals(startingCard?.trait ?? null, def.trait);
    }
    assertEquals(result.players[0].startingCard, result.startingCards[0]);
    assertEquals(result.players[1].startingCard, result.startingCards[1]);
    assert(!("draftPicks" in result.players[0]));
    assert(!("draftPicks" in result.players[1]));

    for (const player of result.players) {
        assertEquals(player.draws.lobby + player.draws.deck, 24);
    }
});

Deno.test("Simulator random opening and fixed turn order match live defaults for 2-4 players", () => {
    for (const playerCount of [2, 3, 4]) {
        const result = simulateGame({
            playerCount,
            layoutId: "grand-empress",
            aiDifficulty: AIDifficulty.EASY,
            seed: 12345,
        });
        assertEquals(result.experiment, null);
        assertEquals(result.players.map((p) => p.firstTurns), [12, ...Array(playerCount - 1).fill(0)]);
        for (const player of result.players) {
            assertEquals(Object.values(player.typeBreakdown).reduce((n, type) => n + type.count, 0), 12);
        }
        const rotating = simulateGame({
            playerCount,
            layoutId: "grand-empress",
            aiDifficulty: AIDifficulty.EASY,
            seed: 12345,
            turnOrder: "rotating",
        });
        assertEquals(rotating.players.map((p) => p.firstTurns), Array(playerCount).fill(12 / playerCount));
    }
});

Deno.test("Simulator forwards epsilon and the remaining horizon to injected strategies", () => {
    /** @type {number[]} */
    const drawTurns = [];
    /** @type {number[]} */
    const playTurns = [];
    /** @type {import('./simulator.js').AIStrategy} */
    const strategy = {
        pickDrawAction(...args) {
            assertEquals(args[6]?.epsilon, 1);
            assertEquals(args[6]?.playerCount, 2);
            drawTurns.push(args[6]?.turnsRemaining ?? -1);
            return pickDrawAction(...args);
        },
        pickCardAndSeat(...args) {
            assertEquals(args[5]?.epsilon, 1);
            playTurns.push(args[5]?.turnsRemaining ?? -1);
            return pickCardAndSeat(...args);
        },
    };
    const config = { playerCount: 2, layoutId: "grand-empress", aiDifficulty: AIDifficulty.HARD, seed: 12345 };
    const random = simulateGame({ ...config, epsilon: 1, strategies: [strategy, strategy] });
    assertEquals(playTurns, Array.from({ length: 12 }, (_, i) => [12 - i, 12 - i]).flat());
    assert(drawTurns.includes(12) && drawTurns.includes(1));
    const greedy = simulateGame({ ...config, epsilon: 0 });
    assertNotEquals(random.players, greedy.players);
    assertEquals(random.startingCards, greedy.startingCards);
    assertEquals(simulateGame({ ...config, epsilon: 1 }), random);
});

Deno.test("Per-game seeds produce the same aggregate across worker partitions", () => {
    const run = (/** @type {number[]} */ seeds) => {
        const result = createAggregate(2);
        for (const seed of seeds) {
            addGameToAggregate(
                result,
                simulateGame({
                    playerCount: 2,
                    layoutId: "grand-empress",
                    aiDifficulty: AIDifficulty.EASY,
                    seed,
                }),
            );
        }
        return result;
    };
    assertEquals(mergeAggregate(run([2, 4]), run([1, 3])), run([1, 2, 3, 4]));
});

Deno.test("Aggregation matches live tiebreakers and separates raw VP ties", () => {
    const start = card(PatronType.STANDARD, null);
    const aggregate = createAggregate(2);
    const players = [playerResult(10, start), playerResult(10, start)];
    addGameToAggregate(aggregate, { players, startingCards: [start, start] });
    assertEquals(aggregate.wins, [0, 1]);
    assertEquals(aggregate.lateOrderTiebreaks, 1);
    players[0].noisyCount = 1;
    addGameToAggregate(aggregate, { players, startingCards: [start, start] });
    assertEquals(aggregate.wins, [1, 1]);
    players[0].noisyCount = 0;
    players[0].uniqueTypesCount = 2;
    addGameToAggregate(aggregate, { players, startingCards: [start, start] });
    assertEquals(aggregate.wins, [1, 2]);
    assertEquals(aggregate.lateOrderTiebreaks, 2);
    assertEquals(aggregate.scoreTies, 3);
    assertEquals(aggregate.ties, 0);
    const stats = calculateFirstPlayerStats(aggregate);
    assert(stats);
    assertEquals(stats.scoreMarginCI95, [0, 0]);
    assertEquals(stats.firstPlayerWinRate, 1 / 3);
    assert(stats.winRateCI95[0] < 0.5 && stats.winRateCI95[1] > 0.5);
});

Deno.test("simulateGame keeps 3P setup to one random starting card per player", () => {
    setGlobalSeed(12345);

    const result = simulateGame({
        playerCount: 3,
        layoutId: "grand-empress",
        aiDifficulty: AIDifficulty.HARD,
    });

    assertEquals(result.experiment, null);
    assertEquals(result.startingCards.length, 3);
    for (const startingCard of result.startingCards) {
        assert(startingCard);
    }
});

Deno.test("mergeAggregate matches aggregating the same games directly", () => {
    const patron = card(PatronType.STANDARD, null);
    const lovebirds = card(PatronType.LOVEBIRDS, null);
    /** @type {SimulationGameResult} */
    const gameOne = {
        players: [playerResult(10, patron), playerResult(8, lovebirds)],
        startingCards: [patron, lovebirds],
    };
    /** @type {SimulationGameResult} */
    const gameTwo = {
        players: [playerResult(7, patron), playerResult(12, lovebirds)],
        startingCards: [patron, lovebirds],
    };

    const direct = createAggregate(2);
    addGameToAggregate(direct, gameOne);
    addGameToAggregate(direct, gameTwo);

    const left = createAggregate(2);
    const right = createAggregate(2);
    addGameToAggregate(left, gameOne);
    addGameToAggregate(right, gameTwo);

    const merged = createAggregate(2);
    mergeAggregate(merged, left);
    mergeAggregate(merged, right);

    assertEquals(merged, direct);
});
