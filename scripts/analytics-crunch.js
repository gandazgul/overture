#!/usr/bin/env -S deno run -A
// @ts-check
/// <reference lib="deno.ns" />

import { dirname } from "jsr:@std/path";
import { Database } from "jsr:@db/sqlite";

const DEFAULT_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
const DEFAULT_DB_PATH = Deno.env.get("ANALYTICS_DB_PATH") ?? "/app/data/analytics.sqlite";
const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * @typedef {{
 *   eventType: "game_start" | "game_end",
 *   eventId: string,
 *   gameId: string,
 *   ts?: string,
 *   debug?: boolean,
 *   playerCount?: number,
 *   theater?: { id?: string, name?: string },
 *   durationMs?: number,
 *   players?: any[],
 *   outcome?: { winnerIndexes?: number[], isTie?: boolean, margin?: number }
 * }} AnalyticsEvent
 */

/**
 * @param {string} filePath
 */
async function ensureParentDir(filePath) {
    await Deno.mkdir(dirname(filePath), { recursive: true });
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toTimestampMs(value) {
    if (typeof value !== "string") {
        return null;
    }
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return value;
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function boolToInt(value) {
    return value ? 1 : 0;
}

/**
 * @param {string | undefined} type
 * @param {string | undefined} trait
 */
function makeCardKey(type, trait) {
    if (!type) {
        return null;
    }
    return `${trait ?? "none"}::${type}`;
}

/**
 * @param {string} key
 */
function splitCardKey(key) {
    const [traitPart, patronType] = key.split("::");
    if (!patronType) {
        return { patronType: key, trait: null };
    }
    return {
        patronType,
        trait: traitPart === "none" ? null : traitPart,
    };
}

/**
 * @param {number[]} scores
 * @returns {{ isTie: boolean, margin: number | null, bucket: 'tie' | 'close' | 'blowout' | null, winnerIndexes: number[] }}
 */
function computeOutcome(scores) {
    if (scores.length === 0) {
        return { isTie: false, margin: null, bucket: null, winnerIndexes: [] };
    }

    const max = Math.max(...scores);
    const winnerIndexes = scores
        .map((score, idx) => (score === max ? idx : -1))
        .filter((idx) => idx >= 0);

    const isTie = winnerIndexes.length > 1;
    if (isTie) {
        return { isTie: true, margin: 0, bucket: "tie", winnerIndexes };
    }

    const sorted = [...scores].sort((a, b) => b - a);
    const second = sorted[1] ?? 0;
    const margin = max - second;
    const bucket = margin >= 6 ? "blowout" : "close";

    return { isTie: false, margin, bucket, winnerIndexes };
}

/**
 * @param {Database} db
 */
function initDb(db) {
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;

        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS processed_events (
            event_id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            ts_ms INTEGER NOT NULL,
            debug INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            start_ts_ms INTEGER,
            end_ts_ms INTEGER,
            duration_ms INTEGER,
            player_count INTEGER,
            theater_id TEXT,
            theater_name TEXT,
            start_debug INTEGER NOT NULL DEFAULT 0,
            end_debug INTEGER NOT NULL DEFAULT 0,
            debug_any INTEGER NOT NULL DEFAULT 0,
            is_tie INTEGER,
            win_margin INTEGER,
            outcome_bucket TEXT
        );

        CREATE TABLE IF NOT EXISTS game_players (
            game_id TEXT NOT NULL,
            player_index INTEGER NOT NULL,
            is_ai INTEGER NOT NULL DEFAULT 0,
            ai_difficulty TEXT,
            started_card_key TEXT,
            started_patron TEXT,
            started_trait TEXT,
            total_score INTEGER,
            house_bonus INTEGER,
            is_winner INTEGER NOT NULL DEFAULT 0,
            draws_lobby INTEGER NOT NULL DEFAULT 0,
            draws_deck INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (game_id, player_index)
        );

        CREATE TABLE IF NOT EXISTS game_player_score_types (
            game_id TEXT NOT NULL,
            player_index INTEGER NOT NULL,
            patron_type TEXT NOT NULL,
            vp INTEGER NOT NULL,
            PRIMARY KEY (game_id, player_index, patron_type)
        );

        CREATE TABLE IF NOT EXISTS game_player_picks (
            game_id TEXT NOT NULL,
            player_index INTEGER NOT NULL,
            card_key TEXT NOT NULL,
            patron_type TEXT NOT NULL,
            trait TEXT,
            count INTEGER NOT NULL,
            PRIMARY KEY (game_id, player_index, card_key)
        );

        CREATE INDEX IF NOT EXISTS idx_games_end_ts ON games(end_ts_ms);
        CREATE INDEX IF NOT EXISTS idx_games_start_ts ON games(start_ts_ms);
        CREATE INDEX IF NOT EXISTS idx_games_bucket ON games(outcome_bucket);
        CREATE INDEX IF NOT EXISTS idx_players_is_ai_diff ON game_players(is_ai, ai_difficulty);
        CREATE INDEX IF NOT EXISTS idx_picks_patron ON game_player_picks(patron_type);
        CREATE INDEX IF NOT EXISTS idx_picks_trait ON game_player_picks(trait);
    `);
}

/**
 * @param {Database} db
 * @param {string} key
 * @param {string} fallback
 */
function getMeta(db, key, fallback) {
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get([key]);
    if (!row || typeof row.value !== "string") {
        return fallback;
    }
    return row.value;
}

/**
 * @param {Database} db
 * @param {string} key
 * @param {string} value
 */
function setMeta(db, key, value) {
    db.run(
        `
        INSERT INTO meta(key, value)
        VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
        [key, value],
    );
}

/**
 * @param {Database} db
 */
function resetDataTables(db) {
    db.exec(`
        DELETE FROM processed_events;
        DELETE FROM game_player_picks;
        DELETE FROM game_player_score_types;
        DELETE FROM game_players;
        DELETE FROM games;
    `);
    setMeta(db, "jsonl_last_line", "0");
}

/**
 * @param {Database} db
 * @param {AnalyticsEvent} event
 */
function insertProcessedEvent(db, event) {
    const tsMs = toTimestampMs(event.ts) ?? Date.now();
    db.run(
        `
        INSERT OR IGNORE INTO processed_events(event_id, game_id, event_type, ts_ms, debug)
        VALUES(?, ?, ?, ?, ?)
    `,
        [event.eventId, event.gameId, event.eventType, tsMs, boolToInt(event.debug)],
    );

    return db.changes > 0;
}

/**
 * @param {Database} db
 * @param {AnalyticsEvent} event
 */
function applyGameStart(db, event) {
    const tsMs = toTimestampMs(event.ts) ?? Date.now();
    const playerCount = Number.isInteger(event.playerCount) ? event.playerCount : null;

    db.run(
        `
        INSERT INTO games(
            game_id,
            start_ts_ms,
            player_count,
            theater_id,
            theater_name,
            start_debug,
            debug_any
        )
        VALUES(?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
            start_ts_ms = COALESCE(games.start_ts_ms, excluded.start_ts_ms),
            player_count = COALESCE(excluded.player_count, games.player_count),
            theater_id = COALESCE(excluded.theater_id, games.theater_id),
            theater_name = COALESCE(excluded.theater_name, games.theater_name),
            start_debug = MAX(games.start_debug, excluded.start_debug),
            debug_any = MAX(games.debug_any, excluded.debug_any)
    `,
        [
            event.gameId,
            tsMs,
            playerCount,
            event.theater?.id ?? null,
            event.theater?.name ?? null,
            boolToInt(event.debug),
            boolToInt(event.debug),
        ],
    );

    const players = Array.isArray(event.players) ? event.players : [];

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const startingCard = player?.startingCard ?? null;
        const cardType = typeof startingCard?.type === "string" ? startingCard.type : null;
        const trait = typeof startingCard?.trait === "string" ? startingCard.trait : null;

        db.run(
            `
            INSERT INTO game_players(
                game_id,
                player_index,
                is_ai,
                ai_difficulty,
                started_card_key,
                started_patron,
                started_trait
            )
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_id, player_index) DO UPDATE SET
                is_ai = excluded.is_ai,
                ai_difficulty = COALESCE(excluded.ai_difficulty, game_players.ai_difficulty),
                started_card_key = COALESCE(game_players.started_card_key, excluded.started_card_key),
                started_patron = COALESCE(game_players.started_patron, excluded.started_patron),
                started_trait = COALESCE(game_players.started_trait, excluded.started_trait)
        `,
            [
                event.gameId,
                i,
                boolToInt(player?.isAI),
                typeof player?.aiDifficulty === "string" ? player.aiDifficulty : null,
                makeCardKey(cardType ?? undefined, trait ?? undefined),
                cardType,
                trait,
            ],
        );
    }
}

/**
 * @param {Database} db
 * @param {string} gameId
 * @param {number} playerIndex
 * @param {Record<string, unknown>} pickedByCard
 */
function replacePlayerPicks(db, gameId, playerIndex, pickedByCard) {
    db.run("DELETE FROM game_player_picks WHERE game_id = ? AND player_index = ?", [gameId, playerIndex]);

    for (const [key, value] of Object.entries(pickedByCard)) {
        const count = Number(value);
        if (!Number.isFinite(count) || count <= 0) {
            continue;
        }
        const parsed = splitCardKey(key);
        db.run(
            `
            INSERT INTO game_player_picks(game_id, player_index, card_key, patron_type, trait, count)
            VALUES(?, ?, ?, ?, ?, ?)
        `,
            [gameId, playerIndex, key, parsed.patronType, parsed.trait, Math.round(count)],
        );
    }
}

/**
 * @param {Database} db
 * @param {string} gameId
 * @param {number} playerIndex
 * @param {Record<string, unknown>} typeBreakdown
 */
function replacePlayerTypeScores(db, gameId, playerIndex, typeBreakdown) {
    db.run(
        "DELETE FROM game_player_score_types WHERE game_id = ? AND player_index = ?",
        [gameId, playerIndex],
    );

    for (const [patronType, value] of Object.entries(typeBreakdown)) {
        const vp = Number(value);
        if (!Number.isFinite(vp)) {
            continue;
        }
        db.run(
            `
            INSERT INTO game_player_score_types(game_id, player_index, patron_type, vp)
            VALUES(?, ?, ?, ?)
        `,
            [gameId, playerIndex, patronType, Math.round(vp)],
        );
    }
}

/**
 * @param {Database} db
 * @param {AnalyticsEvent} event
 */
function applyGameEnd(db, event) {
    const tsMs = toTimestampMs(event.ts) ?? Date.now();
    const durationMs = toFiniteNumber(event.durationMs);
    const players = Array.isArray(event.players) ? event.players : [];

    /** @type {number[]} */
    const totals = [];
    for (const player of players) {
        totals.push(toFiniteNumber(player?.totalScore) ?? 0);
    }

    const outcome = computeOutcome(totals);

    db.run(
        `
        INSERT INTO games(
            game_id,
            end_ts_ms,
            duration_ms,
            player_count,
            theater_id,
            theater_name,
            end_debug,
            debug_any,
            is_tie,
            win_margin,
            outcome_bucket
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id) DO UPDATE SET
            end_ts_ms = COALESCE(excluded.end_ts_ms, games.end_ts_ms),
            duration_ms = COALESCE(excluded.duration_ms, games.duration_ms),
            player_count = COALESCE(excluded.player_count, games.player_count),
            theater_id = COALESCE(excluded.theater_id, games.theater_id),
            theater_name = COALESCE(excluded.theater_name, games.theater_name),
            end_debug = MAX(games.end_debug, excluded.end_debug),
            debug_any = MAX(games.debug_any, excluded.debug_any),
            is_tie = excluded.is_tie,
            win_margin = excluded.win_margin,
            outcome_bucket = excluded.outcome_bucket
    `,
        [
            event.gameId,
            tsMs,
            durationMs,
            Number.isInteger(event.playerCount) ? event.playerCount : null,
            event.theater?.id ?? null,
            event.theater?.name ?? null,
            boolToInt(event.debug),
            boolToInt(event.debug),
            boolToInt(outcome.isTie),
            outcome.margin,
            outcome.bucket,
        ],
    );

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const winner = outcome.winnerIndexes.includes(i);

        const startedCard = player?.startedCard ?? null;
        const startedType = typeof startedCard?.type === "string" ? startedCard.type : null;
        const startedTrait = typeof startedCard?.trait === "string" ? startedCard.trait : null;

        db.run(
            `
            INSERT INTO game_players(
                game_id,
                player_index,
                is_ai,
                ai_difficulty,
                started_card_key,
                started_patron,
                started_trait,
                total_score,
                house_bonus,
                is_winner,
                draws_lobby,
                draws_deck
            )
            VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(game_id, player_index) DO UPDATE SET
                is_ai = excluded.is_ai,
                ai_difficulty = COALESCE(excluded.ai_difficulty, game_players.ai_difficulty),
                started_card_key = COALESCE(game_players.started_card_key, excluded.started_card_key),
                started_patron = COALESCE(game_players.started_patron, excluded.started_patron),
                started_trait = COALESCE(game_players.started_trait, excluded.started_trait),
                total_score = excluded.total_score,
                house_bonus = excluded.house_bonus,
                is_winner = excluded.is_winner,
                draws_lobby = excluded.draws_lobby,
                draws_deck = excluded.draws_deck
        `,
            [
                event.gameId,
                i,
                boolToInt(player?.isAI),
                typeof player?.aiDifficulty === "string" ? player.aiDifficulty : null,
                makeCardKey(startedType ?? undefined, startedTrait ?? undefined),
                startedType,
                startedTrait,
                toFiniteNumber(player?.totalScore),
                toFiniteNumber(player?.houseBonus),
                boolToInt(winner),
                toFiniteNumber(player?.drawsFromLobby) ?? 0,
                toFiniteNumber(player?.drawsFromDeck) ?? 0,
            ],
        );

        const typeBreakdown = (player?.typeBreakdown && typeof player.typeBreakdown === "object")
            ? /** @type {Record<string, unknown>} */ (player.typeBreakdown)
            : {};
        replacePlayerTypeScores(db, event.gameId, i, typeBreakdown);

        const pickedByCard = (player?.pickedByCard && typeof player.pickedByCard === "object")
            ? /** @type {Record<string, unknown>} */ (player.pickedByCard)
            : {};
        replacePlayerPicks(db, event.gameId, i, pickedByCard);
    }
}

/**
 * @param {unknown} raw
 * @returns {AnalyticsEvent | null}
 */
function parseEvent(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const event = /** @type {AnalyticsEvent} */ (raw);
    if (event.eventType !== "game_start" && event.eventType !== "game_end") {
        return null;
    }
    if (typeof event.eventId !== "string" || event.eventId.length === 0) {
        return null;
    }
    if (typeof event.gameId !== "string" || event.gameId.length === 0) {
        return null;
    }

    return event;
}

/**
 * @param {{ jsonlPath?: string, dbPath?: string }} [options]
 */
export async function crunchAnalytics(options = {}) {
    const jsonlPath = options.jsonlPath ?? DEFAULT_JSONL_PATH;
    const dbPath = options.dbPath ?? DEFAULT_DB_PATH;

    await ensureParentDir(dbPath);

    const db = new Database(dbPath);
    initDb(db);

    let text = "";
    try {
        text = await Deno.readTextFile(jsonlPath);
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            setMeta(db, "jsonl_last_line", "0");
            setMeta(db, "last_crunch_ts", `${Date.now()}`);
            db.close();
            return { processedLines: 0, appliedEvents: 0, duplicateEvents: 0, skippedLines: 0 };
        }
        db.close();
        throw err;
    }

    const lines = text.length === 0 ? [] : text.split(/\r?\n/).filter((line) => line.trim().length > 0);

    let lastLine = Number(getMeta(db, "jsonl_last_line", "0"));
    if (!Number.isFinite(lastLine) || lastLine < 0) {
        lastLine = 0;
    }

    if (lastLine > lines.length) {
        resetDataTables(db);
        lastLine = 0;
    }

    let appliedEvents = 0;
    let duplicateEvents = 0;
    let skippedLines = 0;

    db.exec("BEGIN TRANSACTION");
    try {
        for (let i = lastLine; i < lines.length; i++) {
            const line = lines[i];
            let raw;
            try {
                raw = JSON.parse(line);
            } catch {
                skippedLines++;
                continue;
            }

            const event = parseEvent(raw);
            if (!event) {
                skippedLines++;
                continue;
            }

            const isNew = insertProcessedEvent(db, event);
            if (!isNew) {
                duplicateEvents++;
                continue;
            }

            if (event.eventType === "game_start") {
                applyGameStart(db, event);
            } else {
                applyGameEnd(db, event);
            }
            appliedEvents++;
        }

        setMeta(db, "jsonl_last_line", `${lines.length}`);
        setMeta(db, "last_crunch_ts", `${Date.now()}`);
        db.exec("COMMIT");
    } catch (err) {
        db.exec("ROLLBACK");
        db.close();
        throw err;
    }

    db.close();

    return {
        processedLines: Math.max(0, lines.length - lastLine),
        appliedEvents,
        duplicateEvents,
        skippedLines,
    };
}

/**
 * @param {Database} db
 * @param {string | null} debugFilter
 */
function applyReportsFilter(db, debugFilter) {
    if (debugFilter === null) {
        return;
    }
    const isDebug = debugFilter === "1";
    db.exec(`
        DELETE FROM processed_events WHERE debug != ${boolToInt(isDebug)};
        DELETE FROM game_players WHERE game_id NOT IN (SELECT game_id FROM processed_events);
        DELETE FROM game_player_picks WHERE game_id NOT IN (SELECT game_id FROM processed_events);
        DELETE FROM game_player_score_types WHERE game_id NOT IN (SELECT game_id FROM processed_events);
        DELETE FROM games WHERE game_id NOT IN (SELECT game_id FROM processed_events);
    `);
}

/**
 * @param {number[]} sortedValues
 * @param {number} percentile
 */
function percentileFromSorted(sortedValues, percentile) {
    if (sortedValues.length === 0) {
        return null;
    }

    const rank = Math.ceil((percentile / 100) * sortedValues.length);
    const idx = Math.min(sortedValues.length - 1, Math.max(0, rank - 1));
    return sortedValues[idx];
}

/**
 * @param {{ dbPath?: string, nowMs?: number }} [options]
 */
export function buildAnalyticsReportData(options = {}) {
    const dbPath = options.dbPath ?? DEFAULT_DB_PATH;
    const nowMs = options.nowMs ?? Date.now();
    const abandonCutoffMs = nowMs - ABANDON_AFTER_MS;

    const db = new Database(dbPath);
    initDb(db);

    const started = Number(
        db.prepare("SELECT COUNT(*) AS value FROM games WHERE start_ts_ms IS NOT NULL").get()?.value ?? 0,
    );
    const completed = Number(
        db.prepare("SELECT COUNT(*) AS value FROM games WHERE end_ts_ms IS NOT NULL").get()?.value ?? 0,
    );
    const abandoned = Number(
        db.prepare(
            "SELECT COUNT(*) AS value FROM games WHERE start_ts_ms IS NOT NULL AND end_ts_ms IS NULL AND start_ts_ms <= ?",
        ).get([abandonCutoffMs])?.value ?? 0,
    );

    const debugSplit = db.prepare(`
        SELECT
            debug_any AS debug,
            COUNT(*) AS games,
            SUM(CASE WHEN end_ts_ms IS NOT NULL THEN 1 ELSE 0 END) AS completed
        FROM games
        WHERE start_ts_ms IS NOT NULL
        GROUP BY debug_any
        ORDER BY debug_any DESC
    `).all();

    const byPlayerCount = db.prepare(`
        SELECT player_count, COUNT(*) AS games
        FROM games
        WHERE end_ts_ms IS NOT NULL
        GROUP BY player_count
        ORDER BY player_count
    `).all();

    const byTheater = db.prepare(`
        SELECT
            COALESCE(theater_name, theater_id, 'Unknown') AS theater,
            COUNT(*) AS games
        FROM games
        WHERE end_ts_ms IS NOT NULL
        GROUP BY theater
        ORDER BY games DESC, theater ASC
    `).all();

    const outcomes = db.prepare(`
        SELECT
            COALESCE(outcome_bucket, 'unknown') AS bucket,
            COUNT(*) AS games
        FROM games
        WHERE end_ts_ms IS NOT NULL
        GROUP BY bucket
        ORDER BY games DESC
    `).all();

    const aiDifficultyWins = db.prepare(`
        SELECT
            CASE
                WHEN gp.is_ai = 0 THEN 'Human'
                WHEN gp.ai_difficulty IS NULL OR gp.ai_difficulty = '' THEN 'AI (unspecified)'
                ELSE 'AI (' || gp.ai_difficulty || ')'
            END AS label,
            COUNT(*) AS participants,
            SUM(gp.is_winner) AS wins
        FROM game_players gp
        JOIN games g ON g.game_id = gp.game_id
        WHERE g.end_ts_ms IS NOT NULL
        GROUP BY label
        ORDER BY wins DESC, participants DESC
    `).all();

    const scoreSummary = db.prepare(`
        SELECT
            COUNT(*) AS samples,
            AVG(total_score) AS avg_score,
            MIN(total_score) AS min_score,
            MAX(total_score) AS max_score
        FROM game_players gp
        JOIN games g ON g.game_id = gp.game_id
        WHERE g.end_ts_ms IS NOT NULL AND gp.total_score IS NOT NULL
    `).get();

    const perTypeScores = db.prepare(`
        SELECT
            patron_type,
            SUM(vp) AS total_vp,
            AVG(vp) AS avg_vp
        FROM game_player_score_types
        GROUP BY patron_type
        ORDER BY total_vp DESC, patron_type ASC
    `).all();

    const pickByCard = db.prepare(`
        SELECT
            card_key,
            patron_type,
            trait,
            SUM(count) AS picks
        FROM game_player_picks
        GROUP BY card_key, patron_type, trait
        ORDER BY picks DESC, card_key ASC
        LIMIT 50
    `).all();

    const startingCards = db.prepare(`
        SELECT
            COALESCE(started_card_key, 'unknown') AS card_key,
            COALESCE(started_patron, 'unknown') AS patron_type,
            COALESCE(started_trait, 'none') AS trait,
            COUNT(*) AS players
        FROM game_players gp
        JOIN games g ON g.game_id = gp.game_id
        WHERE g.start_ts_ms IS NOT NULL
        GROUP BY COALESCE(started_card_key, 'unknown'), COALESCE(started_patron, 'unknown'), COALESCE(started_trait, 'none')
        ORDER BY players DESC, card_key ASC
    `).all();

    const pickByPatron = db.prepare(`
        SELECT
            patron_type,
            SUM(count) AS picks
        FROM game_player_picks
        GROUP BY patron_type
        ORDER BY picks DESC, patron_type ASC
    `).all();

    const pickByTrait = db.prepare(`
        SELECT
            COALESCE(trait, 'none') AS trait,
            SUM(count) AS picks
        FROM game_player_picks
        GROUP BY COALESCE(trait, 'none')
        ORDER BY picks DESC, trait ASC
    `).all();

    const drawSources = db.prepare(`
        SELECT
            SUM(draws_lobby) AS lobby,
            SUM(draws_deck) AS deck
        FROM game_players gp
        JOIN games g ON g.game_id = gp.game_id
        WHERE g.end_ts_ms IS NOT NULL
    `).get();

    const durations = db.prepare(`
        SELECT duration_ms
        FROM games
        WHERE end_ts_ms IS NOT NULL AND duration_ms IS NOT NULL
        ORDER BY duration_ms ASC
    `).all().map((row) => Number(row.duration_ms));

    const durationStats = {
        samples: durations.length,
        avgMs: durations.length === 0 ? null : Math.round(durations.reduce((sum, v) => sum + v, 0) / durations.length),
        p50Ms: percentileFromSorted(durations, 50),
        p95Ms: percentileFromSorted(durations, 95),
    };

    const lastCrunchTs = Number(getMeta(db, "last_crunch_ts", "0"));

    db.close();

    return {
        generatedAt: new Date(nowMs).toISOString(),
        lastCrunchTs: Number.isFinite(lastCrunchTs) && lastCrunchTs > 0 ? new Date(lastCrunchTs).toISOString() : null,
        summary: {
            started,
            completed,
            abandoned,
            completionRate: started === 0 ? 0 : completed / started,
        },
        debugSplit,
        byPlayerCount,
        byTheater,
        outcomes,
        aiDifficultyWins,
        scoreSummary,
        perTypeScores,
        pickByCard,
        startingCards,
        pickByPatron,
        pickByTrait,
        drawSources,
        durationStats,
    };
}

/**
 * @param {string[]} args
 */
function parseArgs(args) {
    /** @type {{ jsonlPath?: string, dbPath?: string }} */
    const out = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--jsonl" && args[i + 1]) {
            out.jsonlPath = args[i + 1];
            i++;
            continue;
        }
        if (arg === "--db" && args[i + 1]) {
            out.dbPath = args[i + 1];
            i++;
        }
    }

    return out;
}

if (import.meta.main) {
    const options = parseArgs(Deno.args);
    const result = await crunchAnalytics(options);
    console.log(JSON.stringify(result, null, 2));
}
