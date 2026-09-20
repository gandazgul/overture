/// <reference lib="deno.worker" />
import { runUnit } from "./experiment.js";

/**
 * @typedef {Object} Job
 * @property {import('./experiment.js').ExperimentConfig} config
 * @property {number} start
 * @property {number} count
 * @property {string} candidateUrl
 * @property {string} baselineUrl
 */

self.onmessage = async (event) => {
    try {
        const { config, start, count, candidateUrl, baselineUrl } = /** @type {Job} */ (event.data);
        const candidate = await import(candidateUrl);
        const baseline = await import(baselineUrl);
        for (const strategy of [candidate, baseline]) {
            if (typeof strategy.pickDrawAction !== "function" || typeof strategy.pickCardAndSeat !== "function") {
                throw new Error("A strategy must export pickDrawAction and pickCardAndSeat");
            }
        }
        let batch = [];
        for (let i = 0; i < count; i++) {
            batch.push(runUnit(config, start + i, candidate, baseline));
            if (batch.length === 25 || i === count - 1) {
                self.postMessage({ type: "batch", units: batch });
                batch = [];
            }
        }
        self.postMessage({ type: "done" });
    } catch (error) {
        self.postMessage({ type: "error", message: error instanceof Error ? error.stack : String(error) });
    } finally {
        self.close();
    }
};
