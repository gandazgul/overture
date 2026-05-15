/// <reference lib="deno.worker" />

import { setGlobalSeed } from "../utils.js";
import { AIDifficulty } from "../ai.js";
import { simulateGame } from "./simulator.js";

self.onmessage = (e) => {
    const { games, layout, players, baseSeed, workerId } = e.data;
    setGlobalSeed(baseSeed + workerId);

    const results = [];
    const progressInterval = Math.max(1, Math.min(1000, Math.ceil(games / 10)));
    let lastProgress = 0;

    for (let i = 0; i < games; i++) {
        const result = simulateGame({
            playerCount: players,
            layoutId: layout,
            aiDifficulty: AIDifficulty.HARD,
        });
        results.push(result);

        // Send periodic progress updates to the main thread
        const completed = i + 1;
        if (completed - lastProgress >= progressInterval) {
            self.postMessage({ type: "progress", workerId, completed });
            lastProgress = completed;
        }
    }

    self.postMessage({ type: "done", workerId, results });
    self.close();
};
