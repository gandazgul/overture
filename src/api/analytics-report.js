import { timingSafeEqual } from "@std/crypto/timing-safe-equal";
import { buildAnalyticsReportData, crunchAnalytics } from "../../scripts/analytics-crunch.js";
import { ANALYTICS_REPORT_TEMPLATE } from "./analytics-report-template.js";
import { HttpError } from "./http-error.js";

const ANALYTICS_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
const ANALYTICS_DB_PATH = Deno.env.get("ANALYTICS_DB_PATH") ?? "/app/data/analytics.sqlite";
const ANALYTICS_BASIC_AUTH_USER = Deno.env.get("ANALYTICS_BASIC_AUTH_USER") ?? "";
const ANALYTICS_BASIC_AUTH_PASS = Deno.env.get("ANALYTICS_BASIC_AUTH_PASS") ?? "";

/** @type {{ all: string | null, debug0: string | null, debug1: string | null }} */
const cachedReports = {
    all: null,
    debug0: null,
    debug1: null,
};

/**
 * @param {Request} req
 */
function isAuthorized(req) {
    if (!ANALYTICS_BASIC_AUTH_USER || !ANALYTICS_BASIC_AUTH_PASS) {
        throw new HttpError(500, "Basic auth credentials are not configured");
    }

    const header = req.headers.get("authorization") ?? "";
    if (!header.startsWith("Basic ")) {
        throw new HttpError(401, "Missing basic auth header");
    }

    const encoded = header.slice("Basic ".length);
    let decoded = "";
    try {
        decoded = atob(encoded);
    } catch {
        throw new HttpError(401, "Invalid basic auth encoding");
    }

    const separator = decoded.indexOf(":");
    if (separator < 0) {
        throw new HttpError(401, "Invalid basic auth format");
    }

    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);

    let valid = false;
    try {
        const u1 = new TextEncoder().encode(user);
        const u2 = new TextEncoder().encode(ANALYTICS_BASIC_AUTH_USER);
        const p1 = new TextEncoder().encode(pass);
        const p2 = new TextEncoder().encode(ANALYTICS_BASIC_AUTH_PASS);

        if (u1.byteLength === u2.byteLength && p1.byteLength === p2.byteLength) {
            valid = timingSafeEqual(u1, u2) && timingSafeEqual(p1, p2);
        }
    } catch {
        // Ignore crypto errors, will fail below
    }

    if (!valid) {
        throw new HttpError(401, "Invalid credentials");
    }
}

/**
 * @param {unknown} value
 */
function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/**
 * @param {number | null | undefined} ms
 */
function formatMs(ms) {
    if (ms == null || !Number.isFinite(ms)) {
        return "—";
    }

    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @param {string[]} columns
 */
function renderTable(rows, columns) {
    if (rows.length === 0) {
        return `<p class="empty">No data yet.</p>`;
    }

    const header = columns
        .map((column) => `<th>${escapeHtml(column)}</th>`)
        .join("");

    const body = rows
        .map((row) => {
            const cells = columns
                .map((column) => `<td>${escapeHtml(row[column])}</td>`)
                .join("");
            return `<tr>${cells}</tr>`;
        })
        .join("");

    return `
        <table>
            <thead><tr>${header}</tr></thead>
            <tbody>${body}</tbody>
        </table>
    `;
}

/**
 * @param {ReturnType<typeof buildAnalyticsReportData>} data
 * @param {{ processedLines: number, appliedEvents: number, duplicateEvents: number, skippedLines: number }} crunchResult
 * @param {string | null} debugFilter
 */
function renderReportHtml(data, crunchResult, debugFilter) {
    const summaryRows = [
        {
            metric: "Games started",
            value: data.summary.started,
        },
        {
            metric: "Games completed",
            value: data.summary.completed,
        },
        {
            metric: "Games abandoned (2h timeout)",
            value: data.summary.abandoned,
        },
        {
            metric: "Completion rate",
            value: `${(data.summary.completionRate * 100).toFixed(1)}%`,
        },
    ];

    const durationRows = [
        {
            metric: "Samples",
            value: data.durationStats.samples,
        },
        {
            metric: "Average duration",
            value: formatMs(data.durationStats.avgMs),
        },
        {
            metric: "p50 duration",
            value: formatMs(data.durationStats.p50Ms),
        },
        {
            metric: "p95 duration",
            value: formatMs(data.durationStats.p95Ms),
        },
    ];

    const drawRows = [
        {
            source: "Lobby",
            picks: data.drawSources?.lobby ?? 0,
        },
        {
            source: "Deck",
            picks: data.drawSources?.deck ?? 0,
        },
    ];

    const scoreRows = [
        {
            metric: "Player score samples",
            value: data.scoreSummary?.samples ?? 0,
        },
        {
            metric: "Average player score",
            value: data.scoreSummary?.avg_score == null ? "—" : Number(data.scoreSummary.avg_score).toFixed(2),
        },
        {
            metric: "Min player score",
            value: data.scoreSummary?.min_score ?? "—",
        },
        {
            metric: "Max player score",
            value: data.scoreSummary?.max_score ?? "—",
        },
    ];

    /** @type {Record<string, string>} */
    const replacements = {
        GENERATED_AT: escapeHtml(data.generatedAt),
        LAST_CRUNCH_TS: escapeHtml(data.lastCrunchTs ?? "—"),
        PROCESSED_LINES: escapeHtml(crunchResult.processedLines),
        APPLIED_EVENTS: escapeHtml(crunchResult.appliedEvents),
        DUPLICATE_EVENTS: escapeHtml(crunchResult.duplicateEvents),
        SKIPPED_LINES: escapeHtml(crunchResult.skippedLines),
        SELECTED_ALL: debugFilter === null ? "selected" : "",
        SELECTED_DEBUG_0: debugFilter === "0" ? "selected" : "",
        SELECTED_DEBUG_1: debugFilter === "1" ? "selected" : "",
        TABLE_SUMMARY: renderTable(summaryRows, ["metric", "value"]),
        TABLE_DURATION: renderTable(durationRows, ["metric", "value"]),
        TABLE_OUTCOMES: renderTable(data.outcomes, ["bucket", "games"]),
        TABLE_DEBUG_SPLIT: renderTable(data.debugSplit, ["debug", "games", "completed"]),
        TABLE_DRAW_SOURCE: renderTable(drawRows, ["source", "picks"]),
        TABLE_PLAYER_COUNT: renderTable(data.byPlayerCount, ["player_count", "games"]),
        TABLE_THEATER: renderTable(data.byTheater, ["theater", "games"]),
        TABLE_AI_WINS: renderTable(data.aiDifficultyWins, ["label", "participants", "wins"]),
        TABLE_SCORE_SUMMARY: renderTable(scoreRows, ["metric", "value"]),
        TABLE_PER_TYPE_SCORES: renderTable(data.perTypeScores, ["patron_type", "total_vp", "avg_vp"]),
        TABLE_PICK_BY_CARD: renderTable(data.pickByCard, ["card_key", "patron_type", "trait", "picks"]),
        TABLE_STARTING_CARDS: renderTable(data.startingCards, ["card_key", "patron_type", "trait", "players"]),
        TABLE_PICK_BY_PATRON: renderTable(data.pickByPatron, ["patron_type", "picks"]),
        TABLE_PICK_BY_TRAIT: renderTable(data.pickByTrait, ["trait", "picks"]),
    };

    let html = ANALYTICS_REPORT_TEMPLATE;
    for (const [key, value] of Object.entries(replacements)) {
        html = html.replaceAll(`{{${key}}}`, value);
    }

    return html;
}

/**
 * @param {string | null} debugFilter
 */
async function generateReportHtml(debugFilter) {
    const isFiltered = debugFilter !== null;
    const dbPath = isFiltered ? `/tmp/analytics_report_${crypto.randomUUID()}.sqlite` : ANALYTICS_DB_PATH;

    const crunchResult = await crunchAnalytics({
        jsonlPath: ANALYTICS_JSONL_PATH,
        dbPath,
        debugFilter,
    });

    const reportData = buildAnalyticsReportData({ dbPath });

    if (isFiltered) {
        try {
            await Deno.remove(dbPath);
        } catch {
            // Best effort cleanup for temp DB.
        }
    }

    return renderReportHtml(reportData, crunchResult, debugFilter);
}

export function setupAnalyticsCron() {
    // Generate initially and fire and forget
    generateReportHtml(null).then((h) => cachedReports.all = h).catch(console.error);
    generateReportHtml("0").then((h) => cachedReports.debug0 = h).catch(console.error);
    generateReportHtml("1").then((h) => cachedReports.debug1 = h).catch(console.error);

    setInterval(async () => {
        try {
            cachedReports.all = await generateReportHtml(null);
            cachedReports.debug0 = await generateReportHtml("0");
            cachedReports.debug1 = await generateReportHtml("1");
        } catch (e) {
            console.error("Cron Report Crunch Error:", e);
        }
    }, 5 * 60 * 1000);
}

/**
 * @param {Request} req
 */
async function handleAnalyticsReport(req) {
    if (req.method !== "GET") {
        throw new HttpError(405, "Method not allowed");
    }

    try {
        isAuthorized(req);
    } catch (e) {
        if (e && e.status === 401) {
            return new Response(e.message, {
                status: 401,
                headers: { 
                    "WWW-Authenticate": 'Basic realm="Overture Analytics"',
                    "Cache-Control": "no-store",
                },
            });
        }
        throw e;
    }

    const url = new URL(req.url);
    const debugFilter = url.searchParams.get("debug");

    let html = cachedReports.all;
    if (debugFilter === "0") html = cachedReports.debug0;
    if (debugFilter === "1") html = cachedReports.debug1;

    if (!html) {
        // If still building on startup or cache is missed, build dynamically
        html = await generateReportHtml(debugFilter);
    }

    return new Response(html, {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

export { handleAnalyticsReport };
