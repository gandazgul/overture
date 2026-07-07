---
classification: "FEATURE"
complexity: "MEDIUM"
summary: "Implement a pre-game 'draft' phase in the simulator. This involves creating a specific pool of 4 special cards (Bespectacled Critic, Short Teacher, Tall Lovebirds, Plain Kid), distributing them to players in reverse order (last player first). This happens before the standard card draw and game loop."
affectedPaths:
    - "src/simulator/simulator.js"
createdAt: "Mon May 11 2026 20:00:00 GMT-0400 (Eastern Daylight Time)"
updatedAt: "2026-05-13T03:58:25.220Z"
status: "completed"
origin: "internal"
---

## Goal

Implement a "Special Draft" phase at the start of the simulation. This allows the AI to pick from a predefined set of high-value cards before the main game loop begins.

## Special Cards Pool

- Bespectacled Critic
- Short Teacher
- Tall Lovebirds
- Kid (Plain)

## Draft Logic

1. **Pool Creation**:
   - Identify the 4 special candidates from the deck: Bespectacled Critic, Short Teacher, Tall Lovebirds, and Plain Kid.
   - Pull these cards from the generated deck to form the draft pool.
   - If the game is 4-player: use all 4 cards.
   - If the game is 3-player: pick 3 of these 4 at random (ramdomly remove 1).
   - If the game is 2-player: pick 2 of these 4 at random (randomly remove 2).
   - The cards _not_ selected for the pool are returned to the deck immediately and the deck is reshuffled.
2. **Order**: Reverse player order (e.g., in a 3-player game: Player 3 -> Player 2 -> Player 1).
3. **Selection**:
   - Players pick the "best" card for them from the available pool. (Use a heuristic based solely on card base score (Critic=3+aisle, Teacher=3+kids, Lovebirds=pairs, Kid=1))
   - Each player in the draft order gets exactly 1 card.
   - The first player is the last to pick
   - The total number of cards in the pool equals the number of players.
4. **Integration**: These cards should be added to the players' initial hands.

## Execution Steps

- [ ] **Define Special Pool**: In `simulateGame`, define the `specialPool` array with the requested `CardData` objects.
- [ ] **Implement Draft Logic**:
  - Create a loop that iterates through players in reverse order (`config.playerCount - 1` down to `0`).
  - For each player, call `pickDrawAction` or a similar evaluation method using the available special pool to select the best card.
  - Remove the picked card from the pool and add it to the player's hand.
- [ ] **Adjust Initial Hand Logic**: Ensure the subsequent "Deal starting hand" logic accounts for the fact that players already have cards from the draft.
- [ ] **Verify Simulator Weights**: Ensure `lobbyPicks` and `draws` statistics in the simulator results reflect these draft picks separately from regular draws.

## Verification Plan

- Run the simulator and verify that the `lobbyPicksDetailed` or final grid contains the special cards.
- Compare results with and without the draft to see the impact on total scores.
