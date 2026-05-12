/// <reference lib="deno.ns" />

import { handleAnalyticsBeacon } from "./api/analytics-beacon.js";
import { handleAnalyticsReport, setupAnalyticsCron } from "./api/analytics-report.js";
import { handleIndex } from "./api/index.js";
import { logAccess, logRequestError } from "./api/logger.js";
import { handleRules } from "./api/rules.js";
import { handleStatic } from "./api/static.js";
import { ensureParentDir } from "./utils.js";
import { HttpError } from "./api/http-error.js";

const PORT = Number(Deno.env.get("PORT") ?? "8080");
const HOSTNAME = "0.0.0.0";
const ANALYTICS_JSONL_PATH = Deno.env.get("ANALYTICS_JSONL_PATH") ?? "/app/data/analytics.jsonl";
const ANALYTICS_DB_PATH = Deno.env.get("ANALYTICS_DB_PATH") ?? "/app/data/analytics.sqlite";

const routes = [
    {
        pattern: new URLPattern({ pathname: "/api/analytics/beacon" }),
        handler: handleAnalyticsBeacon,
        name: "analytics_beacon",
    },
    {
        pattern: new URLPattern({ pathname: "/api/analytics/report" }),
        handler: handleAnalyticsReport,
        name: "analytics_report",
    },
    { pattern: new URLPattern({ pathname: "/rules{/}?" }), handler: handleRules, name: "rules" },
    { pattern: new URLPattern({ pathname: "/{index.html}?" }), handler: handleIndex, name: "index" },
];

/**
 * @param {Request} req
 * @param {Deno.ServeHandlerInfo} info
 * @returns {Promise<{ route: string, response: Response }>}
 */
async function dispatchRoute(req, info) {
    for (const route of routes) {
        if (route.pattern.test(req.url)) {
            return {
                route: route.name,
                response: await route.handler(req, info),
            };
        }
    }

    return {
        route: "static",
        response: await handleStatic(req),
    };
}

// Initialization
await ensureParentDir(ANALYTICS_JSONL_PATH);
await ensureParentDir(ANALYTICS_DB_PATH);
setupAnalyticsCron();

Deno.serve({ port: PORT, hostname: HOSTNAME }, async (/** @type {Request} */ req, info) => {
    const startedAtMs = performance.now();
    let route = "unmatched";
    const isApiRoute = new URL(req.url).pathname.startsWith("/api/");

    try {
        const dispatched = await dispatchRoute(req, info);
        route = dispatched.route;

        if (isApiRoute) {
            dispatched.response.headers.set("Cache-Control", "no-store");
        }

        logAccess({
            req,
            response: dispatched.response,
            route,
            startedAtMs,
            info,
        });

        return dispatched.response;
    } catch (error) {
        route = route === "unmatched" ? "dispatch_error" : route;

        logRequestError({
            req,
            error,
            route,
            info,
        });

        const status = error instanceof HttpError ? error.status : 500;
        const message = error instanceof HttpError ? error.message : "Internal Server Error";
        const response = new Response(message, { status });

        if (isApiRoute) {
            response.headers.set("Cache-Control", "no-store");
        }

        logAccess({
            req,
            response,
            route,
            startedAtMs,
            info,
        });

        return response;
    }
});
