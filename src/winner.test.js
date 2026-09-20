import { assertEquals, assertThrows } from "@std/assert";
import { resolveWinner } from "./winner.js";

/** @param {number} total @param {number} noisyCount @param {number} uniqueTypesCount */
function player(total = 10, noisyCount = 0, uniqueTypesCount = 3) {
    return { total, noisyCount, uniqueTypesCount };
}

Deno.test("Winner uses VP before all tiebreaks for every player count", () => {
    for (const count of [2, 3, 4]) {
        const players = Array.from({ length: count }, () => player(9, 4, 7));
        players[0] = player(10, 0, 1);
        assertEquals(resolveWinner(players), { winner: 0, reason: "", scoreTie: false, orderTiebreak: false });
    }
});

Deno.test("Noisy outranks diversity and later order for every player count", () => {
    for (const count of [2, 3, 4]) {
        const players = Array.from({ length: count }, () => player(10, 0, 7));
        players[0] = player(10, 1, 1);
        assertEquals(resolveWinner(players), {
            winner: 0,
            reason: "Most noisy patrons",
            scoreTie: true,
            orderTiebreak: false,
        });
    }
});

Deno.test("Live 2P skips diversity while the historical experiment remains available", () => {
    const players = [player(10, 1, 7), player(10, 1, 2)];
    const before = structuredClone(players);
    assertEquals(resolveWinner(players), {
        winner: 1,
        reason: "Last player in order",
        scoreTie: true,
        orderTiebreak: true,
    });
    assertEquals(resolveWinner(players), resolveWinner(players, "noisy-later"));
    assertEquals(resolveWinner(players, "diversity-later"), {
        winner: 0,
        reason: "Most unique primary types",
        scoreTie: true,
        orderTiebreak: false,
    });
    assertEquals(players, before);
});

Deno.test("Live 3P/4P retain diversity even when only two players tie for first", () => {
    for (const count of [3, 4]) {
        const players = Array.from({ length: count }, () => player(9, 4, 7));
        players[0] = player(10, 1, 6);
        players[count - 1] = player(10, 1, 2);
        assertEquals(resolveWinner(players).winner, 0);
        assertEquals(resolveWinner(players).reason, "Most unique primary types");
        assertEquals(resolveWinner(players, "noisy-later").winner, count - 1);
    }
});

Deno.test("Final tiebreak uses the latest original index among eligible players", () => {
    const players = [player(10, 1, 6), player(9, 4, 7), player(10, 1, 6), player(10, 0, 7)];
    assertEquals(resolveWinner(players), {
        winner: 2,
        reason: "Last player in order",
        scoreTie: true,
        orderTiebreak: true,
    });
});

Deno.test("Winner rejects unsupported player counts", () => {
    assertThrows(() => resolveWinner([]));
    assertThrows(() => resolveWinner([player()]));
    assertThrows(() => resolveWinner(Array.from({ length: 5 }, () => player())));
});
