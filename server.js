/// <reference lib="deno.ns" />

import { handleAnalyticsBeacon } from "@src/api/analytics-beacon.js";
import { handleAnalyticsReport } from "@src/api/analytics-report.js";
import { handleIndex } from "@src/api/index.js";
import { logAccess, logRequestError } from "@src/api/logger.js";
import { handleRules } from "@src/api/rules.js";
import { handleStatic } from "@src/api/static.js";

const PORT = Number(Deno.env.get("PORT") ?? "8080");
const HOSTNAME = "0.0.0.0";

/**
 * @param {Request} req
 * @returns {Promise<{ route: string, response: Response }>}
 */
async function dispatchRoute(req) {
    const url = new URL(req.url);

    if (url.pathname === "/api/analytics/beacon") {
        return {
            route: "analytics_beacon",
            response: await handleAnalyticsBeacon(req),
        };
    }

    if (url.pathname === "/api/analytics/report") {
        return {
            route: "analytics_report",
            response: await handleAnalyticsReport(req),
        };
    }

    if (url.pathname === "/rules" || url.pathname === "/rules/") {
        return {
            route: "rules",
            response: await handleRules(req),
        };
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
        return {
            route: "index",
            response: await handleIndex(req),
        };
    }

    return {
        route: "static",
        response: await handleStatic(req),
    };
}

Deno.serve({ port: PORT, hostname: HOSTNAME }, async (/** @type {Request} */ req) => {
    const startedAtMs = performance.now();
    let route = "unmatched";

    try {
        const dispatched = await dispatchRoute(req);
        route = dispatched.route;

        logAccess({
            req,
            response: dispatched.response,
            route,
            startedAtMs,
        });

        return dispatched.response;
    } catch (error) {
        route = route === "unmatched" ? "dispatch_error" : route;

        logRequestError({
            req,
            error,
            route,
        });

        const response = new Response("Internal Server Error", { status: 500 });

        logAccess({
            req,
            response,
            route,
            startedAtMs,
        });

        return response;
    }
});
