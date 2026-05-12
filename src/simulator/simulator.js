// src/simulator/simulator.js
import { createDeck, Layouts, Trait } from "../types.js";
import { scorePlayer } from "../scoring.js";
import { pickCardAndSeat, pickDrawAction } from "../ai.js";

/** @typedef {import('../types.js').CardData} CardData */
/** @typedef {import('../types.js').LayoutMeta} LayoutMeta */

/**
 * @typedef {Object} SimulatorConfig
 * @property {number} playerCount
 * @property {string} layoutId
 * @property {string} aiDifficulty
 * @property {number} [epsilon]
 */

/**
 * @typedef {Object} PlayerResult
 * @property {number} total
 * @property {Record<string, {vp: number, count: number}>} typeBreakdown
 * @property {Record<string, number>} lobbyPicks
 * @property {number} firstTurns
 * @property {number} noisyCount
 * @property {number} uniqueTypesCount
 * @property {{lobby: number, deck: number}} draws
 */

/**
 * Executes a single headless game of Overture.
 *
 * @param {SimulatorConfig} config
 * @returns {{ players: PlayerResult[] }}
 */
export function simulateGame(config) {
    const firstPlayerCounts = Array(config.playerCount).fill(0);

    /** @type {LayoutMeta} */
    const layout = Layouts[config.layoutId];
    if (!layout) throw new Error(`Unknown layout: ${config.layoutId}`);

    /** @type {CardData[]} */
    const deck = createDeck();

    /** @type {CardData[]} */
    const lobby = [];

    /** @type {CardData[][]} */
    const hands = Array.from({ length: config.playerCount }, () => []);

    /** @type {(CardData | null)[][][]} */
    const grids = Array.from(
        { length: config.playerCount },
        () => Array.from({ length: layout.rows }, () => Array(layout.cols).fill(null)),
    );

    /** @type {Record<string, number>[]} */
    const lobbyPicks = Array.from({ length: config.playerCount }, () => ({}));

    /** @type {{lobby: number, deck: number}[]} */
    const draws = Array.from({ length: config.playerCount }, () => ({ lobby: 0, deck: 0 }));

    /**
     * Helper to keep the lobby at 3 cards from the deck.
     */
    const fillLobby = () => {
        while (lobby.length < 3 && deck.length > 0) {
            const card = deck.pop();
            if (card) lobby.unshift(card);
        }
    };

    // ── Setup ───────────────────────────────────────────────────────────

    // 1. Deal starting hand, 1 card per player blind from deck
    const drawTarget = config.playerCount === 2 ? 3 : 2;
    for (let p = 0; p < config.playerCount; p++) {
        hands[p] = [];

        const c = deck.pop();

        if (c) hands[p].push(c);
    }

    // For 3 players, ghost "4th player" was also dealt and discards
    if (config.playerCount === 3 && deck.length > 0) {
        deck.pop();
    }

    // 2. Fill the lobby
    fillLobby();

    // ── Core Loop ───────────────────────────────────────────────────────
    let round = 1;
    while (round <= 12) {
        // In the game, the first player stays the same.
        const firstPlayerThisRound = 0;
        firstPlayerCounts[firstPlayerThisRound]++;

        for (let i = 0; i < config.playerCount; i++) {
            const p = (firstPlayerThisRound + i) % config.playerCount;

            fillLobby();

            // 1. Draw Phase
            while (hands[p].length < drawTarget && (deck.length > 0 || lobby.length > 0)) {
                const action = pickDrawAction(lobby, deck.length, config.aiDifficulty, grids[p], layout, hands[p]);
                if (!action) break;

                if (action.source === "lobby" && action.index !== undefined) {
                    draws[p].lobby++;
                    const card = lobby.splice(action.index, 1)[0];
                    hands[p].push(card);

                    const key = card.trait ? `${card.trait} ${card.type}` : card.type;
                    lobbyPicks[p][key] = (lobbyPicks[p][key] || 0) + 1;

                    // Replicates GameScene.js sliding mechanic
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
                const action = pickCardAndSeat(grids[p], hands[p], config.playerCount, layout, config.aiDifficulty);
                if (action) {
                    grids[p][action.play.row][action.play.col] = action.play.cardData;
                    hands[p] = hands[p].filter((c) => c !== action.play.cardData);

                    if (action.discard) {
                        const discardTarget = action.discard.cardData;
                        hands[p] = hands[p].filter((c) => c !== discardTarget);
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

                    if (card.trait === Trait.NOISY) noisyCount++;
                    uniqueTypes.add(card.type);
                }
            }
        }

        return {
            total: score.total,
            typeBreakdown,
            lobbyPicks: lobbyPicks[p],
            firstTurns: firstPlayerCounts[p],
            noisyCount,
            uniqueTypesCount: uniqueTypes.size,
            draws: draws[p],
        };
    });

    return { players: playerResults };
}
