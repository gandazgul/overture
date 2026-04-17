import { ensureParentDir, getClientIp } from "@src/utils.js";

const ANALYTICS_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
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

/**
 * @param {number} nowMs
 */
function cleanupRateBuckets(nowMs) {
    for (const [ip, bucket] of RATE_BUCKETS.entries()) {
        if (nowMs - bucket.windowStartMs > 2 * 60_000) {
            RATE_BUCKETS.delete(ip);
        }
    }
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
 * @param {string | null} origin
 */
function isAllowedOrigin(origin) {
    if (!origin) {
        return false;
    }

    if (BEACON_ALLOWED_ORIGINS.has(origin)) {
        return true;
    }

    try {
        const originUrl = new URL(origin);
        const port = Number(originUrl.port);

        return originUrl.protocol === "http:" &&
            originUrl.hostname === "localhost" &&
            Number.isInteger(port) &&
            port >= LOCALHOST_CORS_PORT_MIN &&
            port <= LOCALHOST_CORS_PORT_MAX;
    } catch {
        return false;
    }
}

/**
 * @param {string} origin
 */
function getBeaconCorsHeaders(origin) {
    return new Headers({
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
    });
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
async function handleAnalyticsBeacon(req) {
    const origin = req.headers.get("origin");
    if (typeof origin !== "string" || !isAllowedOrigin(origin)) {
        return new Response("Origin not allowed", { status: 403 });
    }

    const corsHeaders = getBeaconCorsHeaders(origin);

    /**
     * @param {BodyInit | null} body
     * @param {ResponseInit} init
     */
    const respond = (body, init) => {
        const headers = new Headers(init.headers);
        for (const [key, value] of corsHeaders.entries()) {
            headers.set(key, value);
        }

        return new Response(body, {
            ...init,
            headers,
        });
    };

    if (req.method === "OPTIONS") {
        return respond(null, { status: 204 });
    }

    if (req.method !== "POST") {
        return respond("Method not allowed", {
            status: 405,
            headers: { Allow: "POST, OPTIONS" },
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

    return respond(null, { status: 204 });
}

export { handleAnalyticsBeacon };
