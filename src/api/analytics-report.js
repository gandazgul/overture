import { buildAnalyticsReportData, crunchAnalytics } from "../../scripts/analytics-crunch.js";
import { ensureParentDir } from "@src/utils.js";
import { ANALYTICS_REPORT_TEMPLATE } from "@src/api/analytics-report-template.js";

const ANALYTICS_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
const ANALYTICS_DB_PATH = Deno.env.get("ANALYTICS_DB_PATH") ?? "/app/data/analytics.sqlite";
const ANALYTICS_BASIC_AUTH_USER = Deno.env.get("ANALYTICS_BASIC_AUTH_USER") ?? "";
const ANALYTICS_BASIC_AUTH_PASS = Deno.env.get("ANALYTICS_BASIC_AUTH_PASS") ?? "";

/**
 * @param {Request} req
 */
function isAuthorized(req) {
    if (!ANALYTICS_BASIC_AUTH_USER || !ANALYTICS_BASIC_AUTH_PASS) {
        return { ok: false, status: 500, reason: "Basic auth credentials are not configured" };
    }

    const header = req.headers.get("authorization") ?? "";
    if (!header.startsWith("Basic ")) {
        return { ok: false, status: 401, reason: "Missing basic auth header" };
    }

    const encoded = header.slice("Basic ".length);
    let decoded = "";
    try {
        decoded = atob(encoded);
    } catch {
        return { ok: false, status: 401, reason: "Invalid basic auth encoding" };
    }

    const separator = decoded.indexOf(":");
    if (separator < 0) {
        return { ok: false, status: 401, reason: "Invalid basic auth format" };
    }

    const user = decoded.slice(0, separator);
    const pass = decoded.slice(separator + 1);

    if (user !== ANALYTICS_BASIC_AUTH_USER || pass !== ANALYTICS_BASIC_AUTH_PASS) {
        return { ok: false, status: 401, reason: "Invalid credentials" };
    }

    return { ok: true, status: 200, reason: "ok" };
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
 * @param {Request} req
 */
async function handleAnalyticsReport(req) {
    if (req.method !== "GET") {
        return new Response("Method not allowed", {
            status: 405,
            headers: { Allow: "GET" },
        });
    }

    const auth = isAuthorized(req);
    if (!auth.ok) {
        const headers = new Headers();
        if (auth.status === 401) {
            headers.set("WWW-Authenticate", 'Basic realm="Overture Analytics"');
        }
        return new Response(auth.reason, {
            status: auth.status,
            headers,
        });
    }

    const url = new URL(req.url);
    const debugFilter = url.searchParams.get("debug");

    await ensureParentDir(ANALYTICS_JSONL_PATH);
    await ensureParentDir(ANALYTICS_DB_PATH);

    const isFiltered = debugFilter !== null;
    const dbPath = isFiltered
        ? `/tmp/analytics_report_${Math.random().toString(36).slice(2)}.sqlite`
        : ANALYTICS_DB_PATH;

    const crunchResult = await crunchAnalytics({
        jsonlPath: ANALYTICS_JSONL_PATH,
        dbPath,
    });

    const reportData = buildAnalyticsReportData({ dbPath });

    if (isFiltered) {
        try {
            await Deno.remove(dbPath);
        } catch {
            // Best effort cleanup for temp DB.
        }
    }

    return new Response(renderReportHtml(reportData, crunchResult, debugFilter), {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

export { handleAnalyticsReport };
