# Simulation & Balance Testing System - PRD

## Objective

Build a CLI tool that automatically runs thousands of headless Overture games (hard AI vs hard AI) with different player counts and layouts, collects detailed game data, and analyzes results to detect imbalances in scoring rules, patron types, traits, and layouts. Use this system as a regression test whenever scoring rules change or new cards/rules are introduced.

## Problem Statement

Overture's scoring system is complex with multiple patron types, traits, layouts, and house rules. Currently, there's no way to:

- Automatically verify that scoring changes don't break game balance
- Detect if certain patron types or traits are systematically over/under-powered
- Compare balance across different player counts and layouts
- Track balance regression over time

Manual playtesting is insufficient to detect subtle imbalances (2-5% effects).

## Resolved Assumptions

| Assumption                 | Resolution                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------- |
| AI for simulation          | Use existing hard AI from `src/ai.js` (pure logic, deterministic, fast). No LLM needed. |
| Player counts              | Support 2, 3, and 4 players                                                             |
| Layouts to test            | All 8 layouts, starting with GrandEmpressLayout for baseline                            |
| Hand size per player count | 2 players: 3 cards, 3-4 players: 2 cards                                                |
| Game rounds                | 14 rounds per game                                                                      |
| Deck                       | 56-card deck from `createDeck()`                                                        |
| Lobby                      | Max 3 cards, refilled from deck when drawn                                              |
| Output format              | JSON files + console summary table                                                      |
| Trigger method             | On-demand CLI command                                                                   |
| Test isolation             | Separate from existing `deno test src/` test suite                                      |

## Technical Approach

### Phase 1: Core Simulation & Analysis

#### 1.1 Project Structure

```
src/sim/
├── config.js          # Configurable parameters (iterations, layouts, thresholds)
├── game-state.js      # Pure game state representation (no Phaser dependency)
├── simulator.js       # Core game loop: init → turns → scoring
├── analyzer.js        # Statistical analysis functions
├── reporter.js        # JSON output + console summary
├── cli.js             # CLI entry point
└── index.js           # Module exports
```

#### 1.2 Game State Representation

Pure JavaScript objects mirroring GameScene state:

```javascript
{
    playerCount: 2 | 3 | 4,
    layout: LayoutMeta,
    deck: CardData[],
    lobby: CardData[],
    playerHands: CardData[][],
    placedPatrons: (CardData | null)[][][],  // [player][row][col]
    currentPlayer: number,
    round: number,
    totalRounds: 14
}
```

#### 1.3 Simulation Loop

1. **Initialize**: Create deck, deal starting hands (1 card each), discard for 2p/3p alignment
2. **Per turn**:
   - Fill lobby if needed (maintain 3 cards)
   - AI draws cards until hand full (`pickDrawAction`)
   - AI places card + optionally discards (`pickCardAndSeat`)
   - Advance to next player
3. **Per round**: After all players go, check if round >= 14 → end game
4. **Scoring**: Call `scorePlayer(grid, layout)` for each player

#### 1.4 Data Collection Per Game

```javascript
{
    gameId: string,
    config: { playerCount, layout, aiDifficulty },
    turns: [
        {
            player: number,
            round: number,
            draws: [{ source: 'lobby' | 'deck', card: CardData }],
            placement: { card: CardData, row: number, col: number },
            discard: CardData | null,
            handAfter: CardData[]
        }
    ],
    finalScores: [
        { player: number, total: number, perSeat: number[][], houseBonus: number }
    ],
    seatBreakdowns: [
        { player, row, col, card: CardData, base, total, modifiers[] }
    ],
    durationMs: number
}
```

#### 1.5 Analysis Functions

**Basic Statistics:**

- Mean, standard deviation, min, max, median, percentiles (25th, 75th, 95th) per patron type
- Win rate by player position (1st, 2nd, 3rd, 4th)
- Average final score per player count

**Patron Type Analysis:**

- Average score per card placed (type breakdown)
- Score distribution histogram per type
- Compare to expected base scores

**Trait Analysis:**

- Average score impact per trait (Tall, Short, Bespectacled, Noisy)
- Trait × Patron type交叉 analysis

**Outlier Detection:**

- Games with extreme total scores (> 3 std devs)
- Games with negative scores (shouldn't happen, but detect)
- Individual seat scores > 3 std devs from mean

**Layout Analysis (Phase 1 limited):**

- Score distributions for GrandEmpressLayout only
- Flag if any player position has > 55% win rate

#### 1.6 CLI Interface

```bash
deno run src/sim/cli.js --games 1000 --layout GrandEmpress --players 2,3,4 --output ./results/
```

Parameters:

| Flag            | Description                              | Default        |
| --------------- | ---------------------------------------- | -------------- |
| `--games`       | Number of games to simulate              | 1000           |
| `--layout`      | Layout ID (GrandEmpress, Blackbox, etc.) | GrandEmpress   |
| `--players`     | Comma-separated player counts            | 2,3,4          |
| `--output`      | Output directory for JSON files          | ./sim-results/ |
| `--seed`        | Random seed for reproducibility          | random         |
| `--concurrency` | Games to run in parallel                 | 1              |

#### 1.7 Config (src/sim/config.js)

```javascript
export const DEFAULT_CONFIG = {
    iterations: {
        quick: 1000, // Fast check for major issues
        standard: 10000, // Standard balance testing
        detailed: 100000, // Subtle effect detection
    },
    analysis: {
        confidenceLevel: 0.95,
        outlierThresholdStd: 3,
        minSampleSize: 30,
    },
    output: {
        saveFullGames: false, // Set true for debugging
        saveSummaries: true,
    },
};
```

### Phase 2: Baseline Comparison & Dashboard

#### 2.1 Baseline System

**Capture Baseline:**

```bash
deno run src/sim/cli.js --games 10000 --output ./baseline/ --capture-as baseline
```

**Compare to Baseline:**

```bash
deno run src/sim/cli.js --games 10000 --compare-to ./baseline/
```

Output: Side-by-side comparison with delta percentages and statistical significance (t-test).

**Auto-detected Changes:**

- Any patron type with > 5% score change from baseline
- Any trait with > 10% effect change
- Win rate shift > 3% for any position
- New outliers or score distribution shape changes

#### 2.2 Dashboard

**Tech Stack**: Simple HTML + vanilla JS with d3.js for charts (single file or minimal setup)

**Features:**

1. **Run History**: List of past simulation runs with timestamps, config, and key metrics
2. **Comparison View**: Select two runs to compare side-by-side
3. **Visualizations**:
   - Bar chart: Mean score per patron type
   - Box plot: Score distributions per patron type
   - Heatmap: Win rate by player position
   - Line chart: Score trend over time (if tracking changes)
4. **Alerts**: Highlight statistically significant changes from baseline
5. **Export**: Download reports as JSON/CSV

**UI Mockup:**

```
┌─────────────────────────────────────────────────────────────┐
│ Overture Balance Dashboard                                   │
├─────────────────────────────────────────────────────────────┤
│ [Run 2025-05-11 v1000] [Run 2025-05-10 v10000] [+ New Run] │
├─────────────────────────────────────────────────────────────┤
│ Patron Type Analysis    │ Comparison: v1000 vs v10000       │
│ ┌───────────────────┐   │ ┌─────────────────────────────┐   │
│ │ VIP ████████ 8.2  │   │ │ VIP: +2.1% (significant)   │   │
│ │ STD ██████ 5.1    │   │ │ STD: -0.8% (stable)         │   │
│ │ CRIT ███████ 7.4  │   │ │ CRIT: +5.2% (⚠️ OVERPOWERED)│   │
│ │ ...               │   │ │ ...                         │   │
│ └───────────────────┘   │ └─────────────────────────────┘   │
│                         │                                   │
│ Win Rates (2-player)    │ [Export CSV] [View Details]      │
│ P1: 48%  P2: 52%        │                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3 CI Integration (Optional)

```yaml
# .github/workflows/balance-test.yml
on: [push, pull_request]
jobs:
  balance-test:
    runs-on: ubuntu-latest
    steps:
      - uses: deno-land/setup-deno@v1
      - run: deno run src/sim/cli.js --games 1000 --compare-to ./baseline/
      - uses: actions/upload-artifact@v4
        with: name: balance-report
          path: sim-results/
```

## Out of Scope

| Item | Reason |a
|------|--------|
| LLM-based AI | Existing hard AI is deterministic and fast enough |
| Phaser UI | Headless simulation using pure JS objects |
| Automated rule suggestion | Just detect issues, don't fix them |
| Real-time dashboard updates | On-demand runs only |
| Multi-layout parallel testing | Run one layout at a time for isolation |

## Success Criteria

### Phase 1

- [ ] CLI runs 1000 games in < 30 seconds on standard hardware
- [ ] Output JSON contains per-game data and summary statistics
- [ ] Console shows summary table with key metrics
- [ ] Analysis detects known imbalances (if any exist in current scoring)
- [ ] Config file allows changing iteration counts and thresholds

### Phase 2

- [ ] Can capture baseline and compare future runs to it
- [ ] Dashboard loads JSON files and displays visualizations
- [ ] Comparison highlights statistically significant changes
- [ ] Run history persists between CLI invocations

## Future Considerations

- Add support for testing with specific card distributions (instead of random deck)
- Add "stress test" mode: force specific rare scenarios
- Add "market simulation": track how card draws affect outcomes
- Consider integrating with existing analytics beacon data for real-world distribution validation
