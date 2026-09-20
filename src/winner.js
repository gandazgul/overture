/**
 * @typedef {Object} PlayerStanding
 * @property {number} total
 * @property {number} noisyCount
 * @property {number} uniqueTypesCount
 */
/** @typedef {'live' | 'noisy-later' | 'diversity-later'} TiebreakRule */

/**
 * Resolve among original player indices, never among a reordered shortlist.
 * Live 2P skips diversity; 3P/4P retain it. Explicit rules support experiments.
 * @param {PlayerStanding[]} players
 * @param {TiebreakRule} [rule]
 */
export function resolveWinner(players, rule = "live") {
    if (players.length < 2 || players.length > 4) throw new Error("Expected two to four players");
    if (!["live", "noisy-later", "diversity-later"].includes(rule)) throw new Error(`Unknown tiebreak: ${rule}`);
    const maxScore = Math.max(...players.map((player) => player.total));
    let winners = players.map((player, index) => player.total === maxScore ? index : -1)
        .filter((index) => index >= 0);
    const scoreTie = winners.length > 1;
    let reason = "";
    if (scoreTie) {
        const maxNoisy = Math.max(...winners.map((index) => players[index].noisyCount));
        winners = winners.filter((index) => players[index].noisyCount === maxNoisy);
        reason = "Most noisy patrons";
    }
    const useDiversity = rule === "diversity-later" || (rule === "live" && players.length > 2);
    if (winners.length > 1 && useDiversity) {
        const maxUnique = Math.max(...winners.map((index) => players[index].uniqueTypesCount));
        winners = winners.filter((index) => players[index].uniqueTypesCount === maxUnique);
        reason = "Most unique primary types";
    }
    const orderTiebreak = winners.length > 1;
    if (orderTiebreak) reason = "Last player in order";
    return { winner: Math.max(...winners), reason, scoreTie, orderTiebreak };
}
