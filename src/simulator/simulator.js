// src/simulator/simulator.js
import { createDeck, Layouts, PatronType, Trait } from "../types.js";
import { scorePlayer } from "../scoring.js";
import { randomInt } from "../utils.js";
import { pickBestCardFromPool, pickCardAndSeat, pickDrawAction } from "../ai.js";

/** @typedef {import('../types.js').CardData} CardData */
/** @typedef {import('../types.js').LayoutMeta} LayoutMeta */

// Toggle the special draft phase. Set to false to skip drafting and deal
// starting hands purely from the shuffled deck.
const DRAFT_ENABLED = false;

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
 * @property {Record<string, number>} lobbyPicksDetailed
 * @property {Record<string, number>} draftPicks
 * @property {number} firstTurns
 * @property {number} noisyCount
 * @property {number} uniqueTypesCount
 * @property {{lobby: number, deck: number}} draws
 * @property {Record<string, number>} discards
 * @property {Record<string, number>} discardsDetailed
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
    /** @type {Record<string, number>[]} */
    const lobbyPicksDetailed = Array.from({ length: config.playerCount }, () => ({}));

    /** @type {Record<string, number>[]} */
    const draftPicks = Array.from({ length: config.playerCount }, () => ({}));

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
            if (card) lobby.unshift(card);
        }
    };

    // ── Setup ───────────────────────────────────────────────────────────

    // 0. Special Draft Phase — extract candidates from deck, pick N, reshuffle rest
    if (DRAFT_ENABLED) {
        const candidateDefs = [
            { type: PatronType.CRITIC, trait: Trait.BESPECTACLED },
            { type: PatronType.TEACHER, trait: Trait.SHORT },
            { type: PatronType.LOVEBIRDS, trait: Trait.TALL },
            { type: PatronType.KID, trait: null },
        ];

        /** @type {{type: string, trait: string | null, card: CardData}[]} */
        const candidates = [];
        for (const def of candidateDefs) {
            const idx = deck.findIndex(
                (card) => card.type === def.type && card.trait === def.trait,
            );
            if (idx >= 0) {
                candidates.push({ ...def, card: deck.splice(idx, 1)[0] });
            }
        }

        const poolSize = config.playerCount;
        const toRemove = candidates.length - poolSize; // 0 for 4P, 1 for 3P, 2 for 2P
        for (let i = 0; i < toRemove; i++) {
            const dropIdx = randomInt(candidates.length - 1);
            deck.push(candidates.splice(dropIdx, 1)[0].card); // return to deck
        }

        // Reshuffle deck (now contains unselected candidates)
        for (let i = deck.length - 1; i > 0; i--) {
            const j = randomInt(i);
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        // Draft picks — reverse order (last player picks first)
        const draftPool = candidates.map((c) => c.card);
        for (let playerIndex = config.playerCount - 1; playerIndex >= 0; playerIndex--) {
            if (draftPool.length === 0) break;
            const card = pickBestCardFromPool(draftPool, config.aiDifficulty);
            if (!card) break;
            hands[playerIndex].push(card);

            // Track in draftPicks analytics
            const cardKey = card.trait ? `${card.trait} ${card.type}` : `${card.type} (Plain)`;
            draftPicks[playerIndex][cardKey] = (draftPicks[playerIndex][cardKey] || 0) + 1;
        }
    }

    // 1. Deal starting hand — draw remaining cards to reach target
    const drawTarget = config.playerCount === 2 ? 3 : 2;
    for (let p = 0; p < config.playerCount; p++) {
        const cardsToDraw = drawTarget - hands[p].length;
        for (let d = 0; d < cardsToDraw; d++) {
            const c = deck.pop();
            if (c) hands[p].push(c);
        }
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
        // In the game, the first player stays the same for 2 players, but rotates for 3 or 4 players.
        const firstPlayerThisRound = config.playerCount > 2 ? (round - 1) % config.playerCount : 0;
        firstPlayerCounts[firstPlayerThisRound]++;

        for (let i = 0; i < config.playerCount; i++) {
            const p = (firstPlayerThisRound + i) % config.playerCount;

            fillLobby();

            // 1. Draw Phase
            let lobbyDrawsThisTurn = 0;
            while (hands[p].length < drawTarget && (deck.length > 0 || lobby.length > 0)) {
                const canDrawLobby = config.playerCount !== 2 || deck.length === 0 || lobbyDrawsThisTurn < 1;
                const availableLobby = canDrawLobby ? lobby : [];

                const opponentGrids = grids.filter((_, idx) => idx !== p);
                const action = pickDrawAction(
                    availableLobby,
                    deck.length,
                    config.aiDifficulty,
                    grids[p],
                    layout,
                    hands[p],
                    {},
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
            draftPicks: draftPicks[p],
            firstTurns: firstPlayerCounts[p],
            noisyCount,
            uniqueTypesCount: uniqueTypes.size,
            draws: draws[p],
            discards: discards[p],
            discardsDetailed: discardsDetailed[p],
        };
    });

    return { players: playerResults };
}
