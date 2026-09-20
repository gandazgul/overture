import { simulateGame } from "./simulator.js";
import { resolveWinner } from "../winner.js";

/** @typedef {import('./simulator.js').AIStrategy} AIStrategy */
/** @typedef {import('./simulator.js').SimulationResult} SimulationResult */
/** @typedef {Pick<import('../ai.js').AIConfig, 'potentialScale' | 'futureWeight' | 'blindFirst'>} StrategyOptions */
/**
 * @typedef {Object} ExperimentConfig
 * @property {'compare' | 'balance'} mode
 * @property {number} samples Seed pairs in compare mode; games in balance mode.
 * @property {number} seed
 * @property {string} layout
 * @property {'random' | 'fixed'} opening
 * @property {'fixed' | 'rotating'} turnOrder
 * @property {import('../winner.js').TiebreakRule} [tiebreak] Defaults to current live rules; diversity-later restores old 2P rules.
 * @property {number} winTolerance Absolute probability, e.g. 0.01 = one percentage point.
 * @property {number} scoreTolerance VP.
 * @property {StrategyOptions} [candidateOptions]
 * @property {StrategyOptions} [baselineOptions]
 */
/**
 * @typedef {Object} Timing
 * @property {number} drawMs
 * @property {number} draws
 * @property {number} placementMs
 * @property {number} placements
 */
/**
 * @typedef {Object} GameSummary
 * @property {number[]} scores
 * @property {number[]} noisy
 * @property {number[]} uniqueTypes
 * @property {number} winner
 * @property {boolean} scoreTie
 * @property {boolean} orderTiebreak
 */
/**
 * @typedef {Object} UnitResult
 * @property {number} seed
 * @property {GameSummary[]} games Candidate P1 then candidate P2; one self-play game in balance mode.
 * @property {Timing} candidateTiming
 * @property {Timing} baselineTiming
 */

/** @returns {Timing} */
function newTiming() {
    return { drawMs: 0, draws: 0, placementMs: 0, placements: 0 };
}

/** @param {AIStrategy} strategy @param {Timing} timing @param {ExperimentConfig['candidateOptions']} [options] @returns {AIStrategy} */
function timed(strategy, timing, options) {
    const { blindFirst, ...aiOptions } = options ?? {};
    return {
        pickDrawAction(...args) {
            if (options) args[6] = { ...args[6], ...options };
            const start = performance.now();
            // Retain the wrapper for historical AI snapshots that predate promotion.
            // Explicit false also reaches current AI to disable its new default.
            const result = blindFirst && args[1] >= 2 && args[5]?.length === 1
                ? /** @type {const} */ ({ source: "deck" })
                : strategy.pickDrawAction(...args);
            timing.drawMs += performance.now() - start;
            timing.draws++;
            return result;
        },
        pickCardAndSeat(...args) {
            if (options) args[5] = { ...args[5], ...aiOptions };
            const start = performance.now();
            const result = strategy.pickCardAndSeat(...args);
            timing.placementMs += performance.now() - start;
            timing.placements++;
            return result;
        },
    };
}

/** @param {SimulationResult} result @param {ExperimentConfig['tiebreak']} [tiebreak] @returns {GameSummary} */
export function summarizeGame(result, tiebreak = "live") {
    if (result.players.length !== 2) throw new Error("Strength experiments require two players");
    const [a, b] = result.players;
    const { winner, scoreTie, orderTiebreak } = resolveWinner(result.players, tiebreak);
    return {
        scores: [a.total, b.total],
        noisy: [a.noisyCount, b.noisyCount],
        uniqueTypes: [a.uniqueTypesCount, b.uniqueTypesCount],
        winner,
        scoreTie,
        orderTiebreak,
    };
}

/**
 * Both games reset to the same deck seed. Swapping policies, not just labels,
 * gives each policy both opening cards and both positions in the pair.
 * @param {ExperimentConfig} config
 * @param {number} index Global sample index, independent of worker partition.
 * @param {AIStrategy} candidate
 * @param {AIStrategy} baseline
 * @returns {UnitResult}
 */
export function runUnit(config, index, candidate, baseline) {
    const seed = config.seed + index;
    const candidateTiming = newTiming();
    const baselineTiming = newTiming();
    const next = timed(candidate, candidateTiming, config.candidateOptions);
    const old = timed(baseline, baselineTiming, config.baselineOptions);
    const common = {
        playerCount: 2,
        layoutId: config.layout,
        aiDifficulty: "hard",
        epsilon: 0,
        seed,
        opening: config.opening,
        turnOrder: config.turnOrder,
    };
    const games = config.mode === "compare"
        ? [
            summarizeGame(simulateGame({ ...common, strategies: [next, old] }), config.tiebreak),
            summarizeGame(simulateGame({ ...common, strategies: [old, next] }), config.tiebreak),
        ]
        : [summarizeGame(simulateGame({ ...common, strategies: [next, next] }), config.tiebreak)];
    return { seed, games, candidateTiming, baselineTiming };
}

/**
 * Large-sample interval over independent seed-level observations, not games.
 * @param {number[]} values
 */
export function meanInterval(values) {
    const count = values.length;
    if (count === 0) return { mean: null, ci95: null };
    const mean = values.reduce((sum, x) => sum + x, 0) / count;
    if (count < 100) return { mean, ci95: null };
    const variance = values.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (count - 1);
    // An unvarying finite sample is not proof that the population has zero variance.
    if (variance === 0) return { mean, ci95: null };
    const half = 1.959963984540054 * Math.sqrt(variance / count);
    return { mean, ci95: [mean - half, mean + half] };
}

/** @param {number} wins @param {number} count */
export function wilsonInterval(wins, count) {
    if (count < 100) return null;
    const z = 1.959963984540054;
    const p = wins / count;
    const denominator = 1 + z * z / count;
    const center = (p + z * z / (2 * count)) / denominator;
    const half = z * Math.sqrt(p * (1 - p) / count + z * z / (4 * count * count)) / denominator;
    return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** @param {number[] | null} interval @param {number} center @param {number} tolerance */
function contained(interval, center, tolerance) {
    return interval !== null && interval[0] > center - tolerance && interval[1] < center + tolerance;
}

/** @param {ExperimentConfig} config @param {UnitResult[]} units */
export function summarizeExperiment(config, units) {
    const paired = config.mode === "compare";
    const winSamples = units.map((unit) =>
        unit.games.reduce((sum, game, position) => sum + Number(game.winner === (paired ? position : 0)), 0) /
        unit.games.length
    );
    const marginSamples = units.map((unit) =>
        unit.games.reduce((sum, game, position) => {
            const p = paired ? position : 0;
            return sum + game.scores[p] - game.scores[1 - p];
        }, 0) / unit.games.length
    );
    const winRate = meanInterval(winSamples);
    if (!paired) winRate.ci95 = wilsonInterval(winSamples.reduce((sum, x) => sum + x, 0), units.length);
    if (winRate.ci95) winRate.ci95 = winRate.ci95.map((x) => Math.max(0, Math.min(1, x)));
    const scoreMargin = meanInterval(marginSamples);
    const candidateTiming = newTiming();
    const baselineTiming = newTiming();
    let scoreTies = 0;
    let orderTiebreaks = 0;
    for (const unit of units) {
        for (const field of /** @type {const} */ (["drawMs", "draws", "placementMs", "placements"])) {
            candidateTiming[field] += unit.candidateTiming[field];
            baselineTiming[field] += unit.baselineTiming[field];
        }
        for (const game of unit.games) {
            scoreTies += Number(game.scoreTie);
            orderTiebreaks += Number(game.orderTiebreak);
        }
    }
    const byPosition = Array.from({ length: paired ? 2 : 1 }, (_, position) => {
        const p = paired ? position : 0;
        const wins = units.reduce((sum, unit) => sum + Number(unit.games[position].winner === p), 0);
        return { player: p + 1, wins, games: units.length, winRate: units.length ? wins / units.length : null };
    });
    return {
        independentSamples: units.length,
        games: units.length * (paired ? 2 : 1),
        subject: paired ? "candidate" : "original-player-1",
        intervalMethod: paired ? "normal-95-over-independent-seed-pair-means" : "Wilson-95-wins; normal-95-VP",
        winRate,
        scoreMargin,
        byPosition,
        scoreTies,
        orderTiebreaks,
        candidateTiming,
        baselineTiming,
        improved: paired && winRate.ci95 !== null && winRate.ci95[0] > 0.5,
        winRateWithinTolerance: !paired && contained(winRate.ci95, 0.5, config.winTolerance),
        scoreWithinTolerance: !paired && contained(scoreMargin.ci95, 0, config.scoreTolerance),
        practicallyBalanced: !paired && contained(winRate.ci95, 0.5, config.winTolerance) &&
            contained(scoreMargin.ci95, 0, config.scoreTolerance),
    };
}
