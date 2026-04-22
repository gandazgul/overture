import pino from "pino";
import { getClientIp } from "../utils.js";

const logger = pino({
    level: Deno.env.get("LOG_LEVEL") ?? "info",
    base: {
        service: "overture-server",
    },
});

const APACHE_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * @param {number} value
 */
function pad2(value) {
    return String(value).padStart(2, "0");
}

/**
 * @param {Date} date
 */
function formatApacheTime(date) {
    const day = pad2(date.getDate());
    const month = APACHE_MONTHS[date.getMonth()] ?? "Jan";
    const year = date.getFullYear();
    const hours = pad2(date.getHours());
    const minutes = pad2(date.getMinutes());
    const seconds = pad2(date.getSeconds());

    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad2(Math.floor(absOffset / 60));
    const offsetMins = pad2(absOffset % 60);

    return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} ${sign}${offsetHours}${offsetMins}`;
}

/**
 * @param {Response} response
 */
function getBodyBytesSent(response) {
    const contentLength = response.headers.get("content-length");
    if (!contentLength) {
        return null;
    }

    const parsed = Number(contentLength);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {Request} req
 */
function getRequestTarget(req) {
    const url = new URL(req.url);
    return `${url.pathname}${url.search}`;
}

/**
 * @param {{ req: Request, response: Response, route: string, startedAtMs: number, info?: Deno.ServeHandlerInfo }} args
 */
function logAccess({ req, response, route, startedAtMs, info }) {
    const ua = req.headers.get("user-agent") ?? "-";
    // dont log the kube probe
    if (ua.startsWith('kube-probe/')) {
        return;
    }

    const now = new Date();
    const durationMs = Number((performance.now() - startedAtMs).toFixed(2));
    const bodyBytesSent = getBodyBytesSent(response);

    logger.info({
        type: "access",
        route,
        remote_addr: getClientIp(req, info),
        remote_user: "-",
        time_local: formatApacheTime(now),
        request: `${req.method} ${getRequestTarget(req)} HTTP/1.1`,
        status: response.status,
        body_bytes_sent: bodyBytesSent,
        http_referer: req.headers.get("referer") ?? "-",
        http_user_agent: ua,
        duration_ms: durationMs,
    });
}

/**
 * @param {{ req: Request, error: unknown, route: string, info?: Deno.ServeHandlerInfo }} args
 */
function logRequestError({ req, error, route, info }) {
    logger.error({
        type: "request_error",
        route,
        method: req.method,
        url: req.url,
        remote_addr: getClientIp(req, info),
        err: error,
    }, "Unhandled request error");
}

export { logAccess, logRequestError };
