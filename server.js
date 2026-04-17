/// <reference lib="deno.ns" />

import { serveDir, serveFile } from "jsr:@std/http/file-server";
import { dirname } from "jsr:@std/path";
import { buildAnalyticsReportData, crunchAnalytics } from "./scripts/analytics-crunch.js";

const PORT = Number(Deno.env.get("PORT") ?? "8080");
const HOSTNAME = "0.0.0.0";

const ANALYTICS_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
const ANALYTICS_DB_PATH = Deno.env.get("ANALYTICS_DB_PATH") ?? "/app/data/analytics.sqlite";
const ANALYTICS_BASIC_AUTH_USER = Deno.env.get("ANALYTICS_BASIC_AUTH_USER") ?? "";
const ANALYTICS_BASIC_AUTH_PASS = Deno.env.get("ANALYTICS_BASIC_AUTH_PASS") ?? "";
const RATE_LIMIT_PER_MINUTE = Number(Deno.env.get("ANALYTICS_RATE_LIMIT_PER_MINUTE") ?? "30");
const MAX_BEACON_BYTES = Number(Deno.env.get("ANALYTICS_MAX_BEACON_BYTES") ?? "65536");
const BEACON_ALLOWED_ORIGINS = new Set([
    "https://gandazgul.itch.io",
    "https://html-classic.itch.zone",
    "https://overture.dumbhome.uk",
]);
const LOCALHOST_CORS_PORT_MIN = 8080;
const LOCALHOST_CORS_PORT_MAX = 8090;

/** @type {Map<string, { windowStartMs: number, count: number }>} */
const RATE_BUCKETS = new Map();

function cleanupRateBuckets(/** @type {number} */ nowMs) {
    for (const [ip, bucket] of RATE_BUCKETS.entries()) {
        if (nowMs - bucket.windowStartMs > 2 * 60_000) {
            RATE_BUCKETS.delete(ip);
        }
    }
}

/**
 * @param {Request} req
 */
function getClientIp(req) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) {
            return first;
        }
    }

    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
        return realIp;
    }

    const cfIp = req.headers.get("cf-connecting-ip");
    if (cfIp) {
        return cfIp;
    }

    return "unknown";
}

/**
 * @param {string} ip
 */
function consumeRateLimit(ip) {
    const nowMs = Date.now();
    let bucket = RATE_BUCKETS.get(ip);

    if (!bucket || nowMs - bucket.windowStartMs >= 60_000) {
        bucket = {
            windowStartMs: nowMs,
            count: 0,
        };
    }

    if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
        RATE_BUCKETS.set(ip, bucket);
        return false;
    }

    bucket.count++;
    RATE_BUCKETS.set(ip, bucket);

    if (Math.random() < 0.01) {
        cleanupRateBuckets(nowMs);
    }

    return true;
}

/**
 * @param {string} path
 */
async function ensureParentDir(path) {
    await Deno.mkdir(dirname(path), { recursive: true });
}

/**
 * @param {unknown} payload
 */
function validateBeaconPayload(payload) {
    if (!payload || typeof payload !== "object") {
        return "Payload must be a JSON object";
    }

    const event = /** @type {Record<string, unknown>} */ (payload);

    const eventType = event.eventType;
    if (eventType !== "game_start" && eventType !== "game_end") {
        return "eventType must be game_start or game_end";
    }

    if (typeof event.eventId !== "string" || event.eventId.length < 5 || event.eventId.length > 128) {
        return "eventId must be a string between 5 and 128 chars";
    }

    if (typeof event.gameId !== "string" || event.gameId.length < 5 || event.gameId.length > 128) {
        return "gameId must be a string between 5 and 128 chars";
    }

    if (event.ts !== undefined && typeof event.ts !== "string") {
        return "ts must be a string timestamp";
    }

    if (event.playerCount !== undefined && !Number.isInteger(event.playerCount)) {
        return "playerCount must be an integer";
    }

    if (event.players !== undefined && !Array.isArray(event.players)) {
        return "players must be an array when present";
    }

    return null;
}

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

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Overture Analytics Report</title>
  <style>
    :root {
      --bg: #0f0f1c;
      --panel: #17172b;
      --text: #ece6d2;
      --accent: #d4af37;
      --muted: #9ea0bb;
      --line: #2d2f4f;
    }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, system-ui, -apple-system, sans-serif;
      line-height: 1.4;
      padding: 20px;
    }
    h1, h2 {
      color: var(--accent);
      margin-top: 0;
    }
    .meta {
      color: var(--muted);
      margin-bottom: 20px;
      font-size: 14px;
    }
    .filter-panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 20px;
      display: flex;
      gap: 20px;
      align-items: center;
      font-size: 14px;
    }
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .filter-group label {
      color: var(--muted);
      font-weight: 600;
    }
    select, input {
      background: #0a0a1a;
      color: var(--text);
      border: 1px solid var(--line);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 14px;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 8px 6px;
      text-align: left;
      vertical-align: top;
    }
    th {
      color: var(--accent);
      font-weight: 600;
    }
    .empty {
      color: var(--muted);
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>Overture Analytics Report</h1>
  <p class="meta">
    Generated: ${escapeHtml(data.generatedAt)}<br/>
    Last crunch: ${escapeHtml(data.lastCrunchTs ?? "—")}<br/>
    Crunch run: processed lines=${escapeHtml(crunchResult.processedLines)}, applied=${
        escapeHtml(crunchResult.appliedEvents)
    }, duplicates=${escapeHtml(crunchResult.duplicateEvents)}, skipped=${escapeHtml(crunchResult.skippedLines)}
  </p>

  <div class="filter-panel">
    <div class="filter-group">
      <label>Debug Games:</label>
      <select onchange="location.href = this.value">
        <option value="/api/analytics/report" ${debugFilter === null ? "selected" : ""}>All</option>
        <option value="/api/analytics/report?debug=0" ${debugFilter === "0" ? "selected" : ""}>Normal Only</option>
        <option value="/api/analytics/report?debug=1" ${debugFilter === "1" ? "selected" : ""}>Debug Only</option>
      </select>
    </div>
  </div>

  <div class="grid">
    <section>
      <h2>Summary</h2>
      ${renderTable(summaryRows, ["metric", "value"])}
    </section>

    <section>
      <h2>Duration</h2>
      ${renderTable(durationRows, ["metric", "value"])}
    </section>

    <section>
      <h2>Outcome buckets</h2>
      ${renderTable(data.outcomes, ["bucket", "games"])}
    </section>

    <section>
      <h2>Debug vs Normal</h2>
      ${renderTable(data.debugSplit, ["debug", "games", "completed"])}
    </section>

    <section>
      <h2>Draw source</h2>
      ${renderTable(drawRows, ["source", "picks"])}
    </section>

    <section>
      <h2>Player count distribution</h2>
      ${renderTable(data.byPlayerCount, ["player_count", "games"])}
    </section>

    <section>
      <h2>Theater frequency</h2>
      ${renderTable(data.byTheater, ["theater", "games"])}
    </section>

    <section>
      <h2>AI/Human participation & wins</h2>
      ${renderTable(data.aiDifficultyWins, ["label", "participants", "wins"])}
    </section>

    <section>
      <h2>Score summary</h2>
      ${renderTable(scoreRows, ["metric", "value"])}
    </section>

    <section>
      <h2>Per-type VP totals</h2>
      ${renderTable(data.perTypeScores, ["patron_type", "total_vp", "avg_vp"])}
    </section>

    <section>
      <h2>Top picks (patron+trait)</h2>
      ${renderTable(data.pickByCard, ["card_key", "patron_type", "trait", "picks"])}
    </section>

    <section>
      <h2>Starting card frequency</h2>
      ${renderTable(data.startingCards, ["card_key", "patron_type", "trait", "players"])}
    </section>

    <section>
      <h2>Pick frequency by patron</h2>
      ${renderTable(data.pickByPatron, ["patron_type", "picks"])}
    </section>

    <section>
      <h2>Pick frequency by trait</h2>
      ${renderTable(data.pickByTrait, ["trait", "picks"])}
    </section>
  </div>
</body>
</html>`;
}

/**
 * @param {Request} req
 */
function getBeaconCorsHeaders(req) {
    const origin = req.headers.get("origin");
    console.log(`CORS: got origin header:`, origin);
    if (!origin) {
        console.log(`CORS: would have denied because no origin`);
    }

    if (!BEACON_ALLOWED_ORIGINS.has(origin)) {
        try {
            const originUrl = new URL(origin);
            const port = Number(originUrl.port);
            const isAllowedLocalhost = originUrl.protocol === "http:" && originUrl.hostname === "localhost" &&
                Number.isInteger(port) &&
                port >= LOCALHOST_CORS_PORT_MIN &&
                port <= LOCALHOST_CORS_PORT_MAX;

            if (!isAllowedLocalhost) {
                console.log(`CORS: would have denied`)
            }
        } catch {
            console.log(`CORS: would have denied`)
        }
    }

    return new Headers({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    });
}

/**
 * @param {HeadersInit | undefined} baseHeaders
 * @param {Headers | null} corsHeaders
 */
function mergeResponseHeaders(baseHeaders, corsHeaders) {
    const headers = new Headers(baseHeaders);
    if (corsHeaders) {
        for (const [key, value] of corsHeaders.entries()) {
            headers.set(key, value);
        }
    }

    return headers;
}

/**
 * @param {Request} req
 */
async function handleBeacon(req) {
    const corsHeaders = getBeaconCorsHeaders(req);

    /**
     * @param {BodyInit | null} body
     * @param {ResponseInit} init
     */
    const respond = (body, init) => {
        return new Response(body, {
            ...init,
            headers: mergeResponseHeaders(init.headers, corsHeaders),
        });
    };

    if (req.method === "OPTIONS") {
        return respond(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (req.method !== "POST") {
        return respond("Method not allowed", {
            status: 405,
            headers: { "Allow": "POST, OPTIONS" },
        });
    }

    const ip = getClientIp(req);
    if (!consumeRateLimit(ip)) {
        return respond("Rate limit exceeded", { status: 429 });
    }

    const rawBody = await req.text();
    const bodyBytes = new TextEncoder().encode(rawBody).byteLength;
    if (bodyBytes > MAX_BEACON_BYTES) {
        return respond("Payload too large", { status: 413 });
    }

    let parsed;
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        return respond("Invalid JSON", { status: 400 });
    }

    const validationError = validateBeaconPayload(parsed);
    if (validationError) {
        return respond(validationError, { status: 400 });
    }

    await ensureParentDir(ANALYTICS_JSONL_PATH);

    const envelope = {
        ...parsed,
        receivedAt: new Date().toISOString(),
    };

    await Deno.writeTextFile(
        ANALYTICS_JSONL_PATH,
        `${JSON.stringify(envelope)}\n`,
        { append: true, create: true },
    );

    return respond(null, {
        status: 204,
    });
}

/**
 * @param {Request} req
 */
async function handleReport(req) {
    if (req.method !== "GET") {
        return new Response("Method not allowed", {
            status: 405,
            headers: { "Allow": "GET" },
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
    const lC = url.searchParams;
    const debugFilter = lC.get("debug");

    await ensureParentDir(ANALYTICS_JSONL_PATH);
    await ensureParentDir(ANALYTICS_DB_PATH);

    // If filter is active, we can't use the incremental crunch a single-run,
    // because the DB already contains aggregates of all games.
    // Instead, we do a full re-crunch from the JSONL for the filtered view.
    const isFiltered = debugFilter !== null;
    const dbPath = isFiltered
        ? `/tmp/analytics_report_${Math.random().toString(36).slice(2)}.sqlite`
        : ANALYTICS_DB_PATH;

    const crunchResult = await crunchAnalytics({
        jsonlPath: ANALYTICS_JSONL_PATH,
        dbPath: dbPath,
    });

    const reportData = buildAnalyticsReportData({ dbPath: dbPath });

    if (isFiltered) {
        try {
            await Deno.remove(dbPath);
        } catch {}
    }

    return new Response(renderReportHtml(reportData, crunchResult, debugFilter), {
        status: 200,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

Deno.serve({ port: PORT, hostname: HOSTNAME }, async (/** @type {Request} */ req) => {
    const url = new URL(req.url);

    if (url.pathname === "/api/analytics/beacon") {
        return handleBeacon(req);
    }

    if (url.pathname === "/api/analytics/report") {
        return handleReport(req);
    }

    // Friendly rulebook route: /rules should resolve without /index.html.
    if (url.pathname === "/rules" || url.pathname === "/rules/") {
        return serveFile(req, "dist/rules/index.html");
    }

    return serveDir(req, {
        fsRoot: "dist",
        quiet: true,
    });
});
