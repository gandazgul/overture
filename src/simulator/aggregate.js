/** @typedef {import('../types.js').CardData} CardData */

/**
 * @typedef {Object} PlayerSimulationResult
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
 * @typedef {Object} SimulationGameResult
 * @property {PlayerSimulationResult[]} players
 * @property {(CardData | null)[]} startingCards
 */

/**
 * @typedef {Object} SimulationAggregate
 * @property {number} games
 * @property {number[]} wins
 * @property {number[]} playerScoresTotal
 * @property {number[]} firstTurnsTotal
 * @property {{lobby: number, deck: number}[]} drawsTotal
 * @property {number} ties
 * @property {number} totalScore
 * @property {Record<string, number>} typeScores
 * @property {Record<string, number>} typeCounts
 * @property {Record<string, number>} typeScoresDetailed
 * @property {Record<string, number>} typeCountsDetailed
 * @property {Record<string, number>[]} lobbyPicksByPlayer
 * @property {Record<string, number>[]} lobbyPicksDetailedByPlayer
 * @property {Record<string, number>[]} discardsByPlayer
 * @property {Record<string, number>[]} discardsDetailedByPlayer
 * @property {Record<string, number>[]} startingCardsByPlayer
 */

/**
 * @param {number} playerCount
 * @returns {SimulationAggregate}
 */
export function createAggregate(playerCount) {
    return {
        games: 0,
        wins: Array(playerCount).fill(0),
        playerScoresTotal: Array(playerCount).fill(0),
        firstTurnsTotal: Array(playerCount).fill(0),
        drawsTotal: Array.from({ length: playerCount }, () => ({ lobby: 0, deck: 0 })),
        ties: 0,
        totalScore: 0,
        typeScores: {},
        typeCounts: {},
        typeScoresDetailed: {},
        typeCountsDetailed: {},
        lobbyPicksByPlayer: Array.from({ length: playerCount }, () => ({})),
        lobbyPicksDetailedByPlayer: Array.from({ length: playerCount }, () => ({})),
        discardsByPlayer: Array.from({ length: playerCount }, () => ({})),
        discardsDetailedByPlayer: Array.from({ length: playerCount }, () => ({})),
        startingCardsByPlayer: Array.from({ length: playerCount }, () => ({})),
    };
}

/**
 * @param {CardData | null} card
 * @returns {string}
 */
export function formatCardKey(card) {
    if (!card) return "None";
    return card.trait ? `${card.trait} ${card.type}` : `${card.type} (Plain)`;
}

/**
 * @param {Record<string, number>} target
 * @param {Record<string, number>} source
 */
function addRecordCounts(target, source) {
    for (const key of Object.keys(source)) {
        target[key] = (target[key] || 0) + source[key];
    }
}

/**
 * @param {Record<string, number>} target
 * @param {string} key
 * @param {number} amount
 */
function incrementRecord(target, key, amount) {
    target[key] = (target[key] || 0) + amount;
}

/**
 * Add one completed game result to an aggregate report.
 *
 * @param {SimulationAggregate} aggregate
 * @param {SimulationGameResult} game
 */
export function addGameToAggregate(aggregate, game) {
    aggregate.games++;

    const scores = game.players.map((p) => p.total);
    const maxScore = Math.max(...scores);
    let winners = scores.map((score, idx) => score === maxScore ? idx : -1).filter((idx) => idx !== -1);

    if (winners.length > 1) {
        const maxNoisy = Math.max(...winners.map((idx) => game.players[idx].noisyCount));
        winners = winners.filter((idx) => game.players[idx].noisyCount === maxNoisy);

        if (winners.length > 1) {
            const maxUnique = Math.max(...winners.map((idx) => game.players[idx].uniqueTypesCount));
            winners = winners.filter((idx) => game.players[idx].uniqueTypesCount === maxUnique);
        }
    }

    if (winners.length > 1) aggregate.ties++;
    else aggregate.wins[winners[0]]++;

    aggregate.totalScore += scores.reduce((sum, score) => sum + score, 0);

    for (let idx = 0; idx < game.players.length; idx++) {
        const player = game.players[idx];
        aggregate.playerScoresTotal[idx] += player.total;
        aggregate.firstTurnsTotal[idx] += player.firstTurns;
        aggregate.drawsTotal[idx].lobby += player.draws.lobby;
        aggregate.drawsTotal[idx].deck += player.draws.deck;

        for (const type of Object.keys(player.typeBreakdown)) {
            const data = player.typeBreakdown[type];
            incrementRecord(aggregate.typeScores, type, data.vp);
            incrementRecord(aggregate.typeCounts, type, data.count);
        }

        for (const cardKey of Object.keys(player.typeBreakdownDetailed)) {
            const data = player.typeBreakdownDetailed[cardKey];
            incrementRecord(aggregate.typeScoresDetailed, cardKey, data.vp);
            incrementRecord(aggregate.typeCountsDetailed, cardKey, data.count);
        }

        addRecordCounts(aggregate.lobbyPicksByPlayer[idx], player.lobbyPicks);
        addRecordCounts(aggregate.lobbyPicksDetailedByPlayer[idx], player.lobbyPicksDetailed);
        addRecordCounts(aggregate.discardsByPlayer[idx], player.discards);
        addRecordCounts(aggregate.discardsDetailedByPlayer[idx], player.discardsDetailed);
        incrementRecord(aggregate.startingCardsByPlayer[idx], formatCardKey(player.startingCard), 1);
    }
}

/**
 * @param {SimulationAggregate} target
 * @param {SimulationAggregate} source
 * @returns {SimulationAggregate}
 */
export function mergeAggregate(target, source) {
    target.games += source.games;
    target.ties += source.ties;
    target.totalScore += source.totalScore;

    for (let i = 0; i < target.wins.length; i++) {
        target.wins[i] += source.wins[i] || 0;
        target.playerScoresTotal[i] += source.playerScoresTotal[i] || 0;
        target.firstTurnsTotal[i] += source.firstTurnsTotal[i] || 0;
        target.drawsTotal[i].lobby += source.drawsTotal[i]?.lobby || 0;
        target.drawsTotal[i].deck += source.drawsTotal[i]?.deck || 0;
        addRecordCounts(target.lobbyPicksByPlayer[i], source.lobbyPicksByPlayer[i] || {});
        addRecordCounts(target.lobbyPicksDetailedByPlayer[i], source.lobbyPicksDetailedByPlayer[i] || {});
        addRecordCounts(target.discardsByPlayer[i], source.discardsByPlayer[i] || {});
        addRecordCounts(target.discardsDetailedByPlayer[i], source.discardsDetailedByPlayer[i] || {});
        addRecordCounts(target.startingCardsByPlayer[i], source.startingCardsByPlayer[i] || {});
    }

    addRecordCounts(target.typeScores, source.typeScores);
    addRecordCounts(target.typeCounts, source.typeCounts);
    addRecordCounts(target.typeScoresDetailed, source.typeScoresDetailed);
    addRecordCounts(target.typeCountsDetailed, source.typeCountsDetailed);

    return target;
}

/**
 * @param {SimulationAggregate} aggregate
 * @param {number} playerCount
 * @returns {number}
 */
export function calculateGlobalAverageScore(aggregate, playerCount) {
    return aggregate.games > 0 ? aggregate.totalScore / (aggregate.games * playerCount) : 0;
}
