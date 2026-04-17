// @ts-check

/**
 * @typedef {{ type?: string, trait?: string | null }} AnalyticsCardLike
 */

const ANALYTICS_ENDPOINT = "https://overture.dumbhome.uk/api/analytics/beacon"

/**
 * Create canonical card key used for analytics aggregation.
 * Example: "Tall::Kid" or "none::Friends".
 *
 * @param {AnalyticsCardLike | null | undefined} card
 * @returns {string | null}
 */
export function makeAnalyticsCardKey(card) {
    if (!card?.type) {
        return null;
    }
    return `${card.trait ?? "none"}::${card.type}`;
}

/**
 * Beacon-friendly analytics post.
 * Uses navigator.sendBeacon when available and falls back to fetch keepalive.
 *
 * @param {Record<string, unknown>} payload
 */
export function sendAnalyticsBeacon(payload) {
    const body = JSON.stringify(payload);

    try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([body], { type: "application/json" });
            const ok = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
            if (ok) {
                return;
            }
        }
    } catch {
        // Fallback below
    }

    void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
    }).catch(() => {
        // Best effort only.
    });
}
