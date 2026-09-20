/// <reference lib="deno.ns" />

import { simulateGame } from "./simulator.js";

for (const layoutId of ["grand-empress", "blackbox"]) {
    Deno.bench(`Hard 2P game / ${layoutId}`, () => {
        simulateGame({
            playerCount: 2,
            layoutId,
            aiDifficulty: "hard",
            opening: "random",
            seed: 42,
        });
    });
}
