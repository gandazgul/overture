/// <reference lib="deno.worker" />

import { setGlobalSeed } from "../utils.js";
import { AIDifficulty } from "../ai.js";
import { simulateGame } from "./simulator.js";

self.onmessage = (e) => {
    const { games, layout, players, baseSeed, workerId } = e.data;
    setGlobalSeed(baseSeed + workerId);

    const results = [];
    for (let i = 0; i < games; i++) {
        const result = simulateGame({
            playerCount: players,
            layoutId: layout,
            aiDifficulty: AIDifficulty.HARD,
        });
        results.push(result);
    }

    self.postMessage({ workerId, results });
    self.close();
};
