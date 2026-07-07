/// <reference lib="deno.worker" />

import { setGlobalSeed } from "../utils.js";
import { AIDifficulty } from "../ai.js";
import { addGameToAggregate, createAggregate } from "./aggregate.js";
import { simulateGame } from "./simulator.js";

self.onmessage = (e) => {
    const data = /** @type {{ games: number, layout: string, players: number, baseSeed: number, workerId: number }} */
        (e.data);
    const { games, layout, players, baseSeed, workerId } = data;
    setGlobalSeed(baseSeed + workerId);

    const aggregate = createAggregate(players);
    const progressInterval = Math.max(1, Math.min(1000, Math.ceil(games / 10)));
    let lastProgress = 0;

    for (let i = 0; i < games; i++) {
        const result = simulateGame({
            playerCount: players,
            layoutId: layout,
            aiDifficulty: AIDifficulty.HARD,
        });
        addGameToAggregate(aggregate, result);

        // Send periodic progress updates to the main thread.
        const completed = i + 1;
        if (completed - lastProgress >= progressInterval) {
            self.postMessage({ type: "progress", workerId, completed });
            lastProgress = completed;
        }
    }

    self.postMessage({ type: "done", workerId, aggregate });
    self.close();
};
