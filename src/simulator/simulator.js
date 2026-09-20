// src/simulator/simulator.js
import { createDeck, Layouts, PatronType, Trait } from "../types.js";
import { scorePlayer } from "../scoring.js";
import { pickCardAndSeat, pickDrawAction } from "../ai.js";
import { setGlobalSeed } from "../utils.js";

/** @typedef {import('../types.js').CardData} CardData */
/** @typedef {import('../types.js').LayoutMeta} LayoutMeta */
/** @typedef {{pickCardAndSeat: typeof pickCardAndSeat, pickDrawAction: typeof pickDrawAction}} AIStrategy */

export const SIMULATOR_EXPERIMENT = Object.freeze({
    id: "fixed-2p-opening-cards",
    description: "2P balance experiment: fixed starting cards",
    fixedStartingCards: [
        { player: 1, type: PatronType.STANDARD, trait: null },
        { player: 2, type: PatronType.FRIENDS, trait: null },
    ],
});

/**
 * @typedef {Object} SimulatorConfig
 * @property {number} playerCount
 * @property {string} layoutId
 * @property {string} aiDifficulty
 * @property {number} [epsilon]
 * @property {'random' | 'fixed'} [opening] Defaults to the live random opening.
 * @property {'fixed' | 'rotating'} [turnOrder] Defaults to the live fixed order.
 * @property {number} [seed] Independent seed for this game, not its worker.
 * @property {AIStrategy[]} [strategies] Optional per-player simulator-only AI implementations.
 */

/**
 * @typedef {Object} PlayerResult
 * @property {number} total
 * @property {Record<string, {vp: number, count: number}>} typeBreakdown
 * @property {Record<string, {vp: number, count: number}>} typeBreakdownDetailed
 * @property {Record<string, number>} lobbyPicks
 * @property {Record<string, number>} lobbyPicksDetailed
 * @property {number} firstTurns
 * @property {number} noisyCount
 * @property {number} uniqueTypesCount
 * @property {{lobby: number, deck: number}} draws
 * @property {Record<string, number>} discards
 * @property {Record<string, number>} discardsDetailed
 * @property {CardData | null} startingCard
 */

/**
 * @typedef {Object} SimulationResult
 * @property {PlayerResult[]} players
 * @property {(CardData | null)[]} startingCards
 * @property {typeof SIMULATOR_EXPERIMENT | null} experiment
 */

/**
 * Remove and return the first exact card matching type and trait from the deck.
 * Plain cards omit `trait`, so matching normalizes missing traits to null.
 *
 * @param {CardData[]} deck
 * @param {string} type
 * @param {string | null} trait
 * @returns {CardData}
 */
export function takeExactCard(deck, type, trait) {
    const idx = deck.findIndex((card) => card.type === type && (card.trait ?? null) === trait);
    if (idx < 0) {
        const cardName = trait ? `${trait} ${type}` : `${type} (Plain)`;
        throw new Error(`Unable to find required starting card: ${cardName}`);
    }
    return deck.splice(idx, 1)[0];
}

/**
 * Executes a single headless game of Overture.
 *
 * @param {SimulatorConfig} config
 * @returns {SimulationResult}
 */
export function simulateGame(config) {
    if (![2, 3, 4].includes(config.playerCount)) throw new Error("playerCount must be 2, 3, or 4");
    if (config.epsilon !== undefined && !(config.epsilon >= 0 && config.epsilon <= 1)) {
        throw new Error("epsilon must be between 0 and 1");
    }
    const opening = config.opening ?? "random";
    const turnOrder = config.turnOrder ?? "fixed";
    if (!["random", "fixed"].includes(opening)) throw new Error("Unknown opening");
    if (!["fixed", "rotating"].includes(turnOrder)) throw new Error("Unknown turn order");
    if (opening === "fixed" && config.playerCount !== 2) throw new Error("Fixed opening requires 2 players");
    const firstPlayerCounts = Array(config.playerCount).fill(0);

    /** @type {LayoutMeta} */
    const layout = Layouts[config.layoutId];
    if (!layout) throw new Error(`Unknown layout: ${config.layoutId}`);

    if (config.seed !== undefined) setGlobalSeed(config.seed);
    /** @type {CardData[]} */
    const deck = createDeck();
    // Exploration must not change another game's shuffled deck.
    if (config.seed !== undefined) setGlobalSeed(config.seed ^ 0xA17E5EED);

    /** @type {CardData[]} */
    const lobby = [];

    /** @type {CardData[][]} */
    const hands = Array.from({ length: config.playerCount }, () => []);

    /** @type {(CardData | null)[]} */
    const startingCards = Array.from({ length: config.playerCount }, () => null);

    /** @type {(CardData | null)[][][]} */
    const grids = Array.from(
        { length: config.playerCount },
        () => Array.from({ length: layout.rows }, () => Array(layout.cols).fill(null)),
    );

    /** @type {Record<string, number>[]} */
    const lobbyPicks = Array.from({ length: config.playerCount }, () => ({}));
    /** @type {Record<string, number>[]} */
    const lobbyPicksDetailed = Array.from({ length: config.playerCount }, () => ({}));

    /** @type {Record<string, number>[]} */
    const discards = Array.from({ length: config.playerCount }, () => ({}));
    /** @type {Record<string, number>[]} */
    const discardsDetailed = Array.from({ length: config.playerCount }, () => ({}));

    /** @type {{lobby: number, deck: number}[]} */
    const draws = Array.from({ length: config.playerCount }, () => ({ lobby: 0, deck: 0 }));

    /**
     * Helper to keep the lobby at 3 cards from the deck.
     */
    const fillLobby = () => {
        while (lobby.length < 3 && deck.length > 0) {
            const card = deck.pop();
            if (card) lobby.push(card);
        }
    };

    // ── Setup ───────────────────────────────────────────────────────────

    if (opening === "fixed") {
        // Optional first-player compensation experiment, not the live baseline.
        for (const def of SIMULATOR_EXPERIMENT.fixedStartingCards) {
            const playerIndex = def.player - 1;
            const card = takeExactCard(deck, def.type, def.trait);
            startingCards[playerIndex] = card;
            hands[playerIndex].push(card);
        }
    } else {
        // Live setup: each player receives one random starting card.
        for (let p = 0; p < config.playerCount; p++) {
            const card = deck.pop() ?? null;
            startingCards[p] = card;
            if (card) hands[p].push(card);
        }
    }

    // For 3 players, ghost "4th player" was also dealt and discards.
    if (config.playerCount === 3 && deck.length > 0) {
        deck.pop();
    }

    fillLobby();

    // ── Core Loop ───────────────────────────────────────────────────────
    const drawTarget = config.playerCount === 2 ? 3 : 2;
    const totalRounds = 12;
    let round = 1;
    while (round <= totalRounds) {
        const firstPlayerThisRound = turnOrder === "rotating" ? (round - 1) % config.playerCount : 0;
        firstPlayerCounts[firstPlayerThisRound]++;
        const aiConfig = {
            epsilon: config.epsilon,
            turnsRemaining: totalRounds - round + 1,
            playerCount: config.playerCount,
        };

        for (let i = 0; i < config.playerCount; i++) {
            const p = (firstPlayerThisRound + i) % config.playerCount;
            const strategy = config.strategies?.[p] ?? { pickDrawAction, pickCardAndSeat };

            fillLobby();

            // 1. Draw Phase. opponentGrids is invariant across this turn's draws
            // (grids only mutate in the Play Phase below), so hoist it out of the loop.
            const opponentGrids = grids.filter((_, idx) => idx !== p);

            let lobbyDrawsThisTurn = 0;
            while (hands[p].length < drawTarget && (deck.length > 0 || lobby.length > 0)) {
                const canDrawLobby = config.playerCount !== 2 || deck.length === 0 || lobbyDrawsThisTurn < 1;
                const availableLobby = canDrawLobby ? lobby : [];

                const action = strategy.pickDrawAction(
                    availableLobby,
                    deck.length,
                    config.aiDifficulty,
                    grids[p],
                    layout,
                    hands[p],
                    aiConfig,
                    opponentGrids,
                );
                if (!action) break;

                if (action.source === "lobby" && action.index !== undefined) {
                    lobbyDrawsThisTurn++;
                    draws[p].lobby++;
                    const card = lobby.splice(action.index, 1)[0];
                    hands[p].push(card);

                    lobbyPicks[p][card.type] = (lobbyPicks[p][card.type] || 0) + 1;
                    const keyDetailed = card.trait ? `${card.trait} ${card.type}` : `${card.type} (Plain)`;
                    lobbyPicksDetailed[p][keyDetailed] = (lobbyPicksDetailed[p][keyDetailed] || 0) + 1;

                    // Replicates GameScene.js sliding mechanic after a Lobby draw.
                    if (deck.length > 0) {
                        const refill = deck.pop();
                        if (refill) lobby.unshift(refill);
                    }
                } else {
                    draws[p].deck++;
                    const card = deck.pop();
                    if (card) hands[p].push(card);
                }
            }

            // 2. Play Phase
            if (hands[p].length > 0) {
                const action = strategy.pickCardAndSeat(
                    grids[p],
                    hands[p],
                    config.playerCount,
                    layout,
                    config.aiDifficulty,
                    aiConfig,
                );
                if (action) {
                    grids[p][action.play.row][action.play.col] = action.play.cardData;
                    // Identity-based removal (deck cards are unique object references):
                    // findIndex+splice avoids the per-call array allocation of `.filter`.
                    const playIdx = hands[p].indexOf(action.play.cardData);
                    if (playIdx >= 0) hands[p].splice(playIdx, 1);

                    if (action.discard) {
                        const discardTarget = action.discard.cardData;
                        const discardIdx = hands[p].indexOf(discardTarget);
                        if (discardIdx >= 0) hands[p].splice(discardIdx, 1);

                        discards[p][discardTarget.type] = (discards[p][discardTarget.type] || 0) + 1;
                        const keyDetailed = discardTarget.trait
                            ? `${discardTarget.trait} ${discardTarget.type}`
                            : `${discardTarget.type} (Plain)`;
                        discardsDetailed[p][keyDetailed] = (discardsDetailed[p][keyDetailed] || 0) + 1;
                    }
                }
            }
        }

        if (config.playerCount === 3 && deck.length > 0) {
            deck.pop();
        }

        round++;
    }

    // ── Scoring & Breakdown ─────────────────────────────────────────────
    /** @type {PlayerResult[]} */
    const playerResults = grids.map((grid, p) => {
        const score = scorePlayer(grid, layout);
        // score.total += p; // FPA compensation (+0, +1, +2, +3)

        /** @type {Record<string, {vp: number, count: number}>} */
        const typeBreakdown = {};
        /** @type {Record<string, {vp: number, count: number}>} */
        const typeBreakdownDetailed = {};

        let noisyCount = 0;
        const uniqueTypes = new Set();

        for (let r = 0; r < layout.rows; r++) {
            for (let c = 0; c < layout.cols; c++) {
                const card = grid[r][c];
                if (card) {
                    if (!typeBreakdown[card.type]) {
                        typeBreakdown[card.type] = { vp: 0, count: 0 };
                    }
                    typeBreakdown[card.type].vp += score.perSeat[r][c];
                    typeBreakdown[card.type].count += 1;

                    const keyDetailed = card.trait ? `${card.trait} ${card.type}` : `${card.type} (Plain)`;
                    if (!typeBreakdownDetailed[keyDetailed]) {
                        typeBreakdownDetailed[keyDetailed] = { vp: 0, count: 0 };
                    }
                    typeBreakdownDetailed[keyDetailed].vp += score.perSeat[r][c];
                    typeBreakdownDetailed[keyDetailed].count += 1;

                    if (card.trait === Trait.NOISY) noisyCount++;
                    uniqueTypes.add(card.type);
                }
            }
        }

        return {
            total: score.total,
            typeBreakdown,
            typeBreakdownDetailed,
            lobbyPicks: lobbyPicks[p],
            lobbyPicksDetailed: lobbyPicksDetailed[p],
            firstTurns: firstPlayerCounts[p],
            noisyCount,
            uniqueTypesCount: uniqueTypes.size,
            draws: draws[p],
            discards: discards[p],
            discardsDetailed: discardsDetailed[p],
            startingCard: startingCards[p],
        };
    });

    return {
        players: playerResults,
        startingCards,
        experiment: opening === "fixed" ? SIMULATOR_EXPERIMENT : null,
    };
}
