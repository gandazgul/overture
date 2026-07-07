/// <reference lib="deno.ns" />

import { assert, assertEquals } from "@std/assert";
import { AIDifficulty } from "../ai.js";
import { PatronType } from "../types.js";
import { setGlobalSeed } from "../utils.js";
import { addGameToAggregate, createAggregate, mergeAggregate } from "./aggregate.js";
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
