# Overture — Context Overview

**Overture** is a 2–4 player theater-seating strategy card game built with Phaser 3. Players are rival ushers placing patron cards into their personal theater grids to earn victory points (VP). The game features 7 primary patron types, 4 secondary traits, 8 unique theater layouts, and a pure-function scoring engine with zero framework dependencies.

---

## Language & Tooling

- **Runtime:** Deno 2.x
- **Game framework:** Phaser 3.86
- **Build tool:** Vite 5
- **Language:** 100% pure JavaScript (.js) with JSDoc type annotations — **no TypeScript files allowed**
- **Testing:** Deno built-in test runner + `@std/assert`
- **Logging:** pino (server-side)
- **Image processing:** sharp
- **Linting:** `deno lint`
- **Formatting:** `deno fmt` (4-space indent, 120 line width, semicolons, double quotes)

---

## Key Concepts

| Term           | Definition                                                                                                                                       | Aliases to avoid                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| **CardData**   | Immutable object `{ type: string, trait?: string, label: string }` representing a patron card                                                    | "card object", "patron object"        |
| **LayoutMeta** | Frozen configuration object defining a theater's grid geometry, seat masks, aisles, adjacency rules, house rules, and auto-generated seat labels | "layout config", "theater definition" |
| **Patron**     | One of 7 patron identities: Standard, VIP, Lovebirds, Kid, Teacher, Critic, Friends                                                              | "patron type", "main type"            |
| **Trait**      | One of 4 secondary modifiers: Tall, Short, Bespectacled, Noisy                                                                                   | "secondary trait", "modifier"         |
| **SeatLabel**  | Auto-generated tag per seat: "front", "back", "aisle", "box" — used by `hasSeatLabel()`                                                          | "seat tag", "seat flag"               |
| **House Rule** | Layout-specific scoring bonus (e.g. "intimate-venue", "royal-approval", "panorama", "full-tables")                                               | "special rule", "bonus rule"          |
| **VP**         | Victory Points — the game's scoring currency                                                                                                     | "points", "victory points"            |
| **Capping**    | Teacher–Kid mechanic: Kids score 3 VP when bracketed by Teachers horizontally or vertically                                                      | "enclosing", "trapping"               |
| **Lobby**      | Face-up row of known cards available before drawing blind from the deck                                                                          | "market", "display"                   |
| **DPR**        | Device Pixel Ratio — `config.js` scales all coordinates by `DPR` for Retina support                                                              | —                                     |

---

## Key Files

| File                                  | Role                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/main.js`                         | Entry point — creates Phaser game, registers 6 scenes                                                                                                                                                        |
| `src/config.js`                       | DPR-aware scaling (`s()`, `px()`, `DPR`, `GAME_WIDTH`, `GAME_HEIGHT`)                                                                                                                                        |
| `src/types.js`                        | **Central hub** — all enums (`PatronType`, `Trait`), `PatronInfo`, `TraitInfo`, all 8 `LayoutMeta` objects, `CardData`/`SeatPosition` typedefs, `hasSeatLabel()`, `createDeck()`, `buildSeatLabels()`        |
| `src/scoring.js`                      | **Pure scoring engine** — `scorePlayer()`, `scoreSeat()`, `scoreSeatBreakdown()`, `getOrthogonalNeighbors()`, `buildKidCappingData()`, `buildLovebirdsPairMap()`, `scoreHouseRule()`. Zero Phaser dependency |
| `src/ai.js`                           | **Pure AI logic** — `AIDifficulty` enum, `pickSeat()`, `pickCardAndSeat()`, `pickDrawAction()`, `evaluateSeat()`, `scoreAllSeats()`, `applyHeuristics()`. Zero Phaser dependency                             |
| `src/server.js`                       | Deno HTTP server — routing, analytics beacon ingestion, static file serving, request logging                                                                                                                 |
| `src/analytics.js`                    | Client-side beacon: `sendAnalyticsBeacon()`, `makeAnalyticsCardKey()`                                                                                                                                        |
| `src/settings.js`                     | localStorage persistence for `showAllScores` via Phaser registry                                                                                                                                             |
| `src/constants.js`                    | `SEAT_SIZE`, `SEAT_GAP`, `AISLE_GAP` (all DPR-scaled)                                                                                                                                                        |
| `src/scenes/BootScene.js`             | Minimal loading scene with progress bar                                                                                                                                                                      |
| `src/scenes/TitleScene.js`            | Main menu — player count selection, settings toggle                                                                                                                                                          |
| `src/scenes/PlayerSetupScene.js`      | Player configuration — human/AI toggle, difficulty, color swatches                                                                                                                                           |
| `src/scenes/TheaterSelectionScene.js` | Theater selection — visual cards with thumbnails, house rule preview modal                                                                                                                                   |
| `src/scenes/GameScene.js`             | **Largest scene** — turn management, card drawing, placement, scoring, AI turn execution, analytics                                                                                                          |
| `src/scenes/EndGameScene.js`          | Scorecard display — per-type breakdown, winner announcement, replay option                                                                                                                                   |
| `src/objects/TheaterGrid.js`          | **Largest object** — grid geometry computation, seat rendering, guidance overlays, placed-card visuals                                                                                                       |
| `src/objects/Card.js`                 | Phaser Container for hand cards — selection animation, trait badge                                                                                                                                           |
| `src/objects/TheaterOverlay.js`       | Modal to view all players' theaters mid-game or post-game                                                                                                                                                    |
| `src/objects/GameInfoPanel.js`        | Right-side HUD — round, deck count, per-player scores                                                                                                                                                        |
| `src/objects/SpeechBubble.js`         | Tooltip following a target game object                                                                                                                                                                       |
| `src/objects/ActivePlayerAvatar.js`   | Bottom-right HUD showing current player's usher portrait                                                                                                                                                     |
| `src/objects/DrawReminderBanner.js`   | Transient notification banner                                                                                                                                                                                |
| `src/objects/ProgressBar.js`          | Loading progress bar                                                                                                                                                                                         |
| `src/factories/Button.js`             | Reusable styled button factory                                                                                                                                                                               |
| `src/factories/Logo.js`               | Overture logo renderer with fallback                                                                                                                                                                         |
| `src/api/index.js`                    | Serves `dist/index.html`                                                                                                                                                                                     |
| `src/api/rules.js`                    | Serves generated rules page                                                                                                                                                                                  |
| `src/api/static.js`                   | Serves `dist/` static files                                                                                                                                                                                  |
| `src/api/analytics-beacon.js`         | POST endpoint for game analytics (rate-limited, CORS-aware)                                                                                                                                                  |
| `src/api/analytics-report.js`         | Analytics aggregation report (with cron)                                                                                                                                                                     |
| `src/api/logger.js`                   | Apache Combined Log format access/error logging via pino                                                                                                                                                     |
| `src/api/http-error.js`               | `HttpError` class for HTTP error responses                                                                                                                                                                   |
| `vite.config.js`                      | Vite config — dev server, Phaser chunk splitting, rules page generation plugin                                                                                                                               |
| `deno.json`                           | Import maps, Deno tasks, formatting config                                                                                                                                                                   |
| `Containerfile`                       | Multi-stage Docker build (Debian builder → distroless runtime)                                                                                                                                               |

---

## Patterns & Conventions

### Coding Style

- **JSDoc-only typing** — `@type`, `@typedef`, `@param`, `@returns` on all public APIs. No TypeScript syntax (no `.ts` files, no `interface`, no `type` aliases in executable code).
- **Frozen enum objects** — `PatronType`, `Trait`, `AIDifficulty` are created via `Object.freeze()` on plain objects with string values.
- **Pure modules** — `scoring.js` and `ai.js` have zero Phaser imports and can be tested/run independently.
- **DPR-aware rendering** — All pixel values go through `s(n)` (integer scale) or `px(n)` (CSS string). Raw pixel literals are forbidden.

### Scoring Architecture

- **Two-phase scoring:** Phase 1 = primary type scoring, Phase 2 = trait scoring, Phase 3 = cross-type modifiers (Tall behind penalty, Noisy adjacency), Phase 4 = house rule bonuses.
- **`scoreSeatBreakdown()`** returns `{ base, total, modifiers[] }` where each modifier has `{ label, value, applied, reason? }`.
- **`hasSeatLabel(row, col, label, layout)`** is the universal checker for seat properties (front, back, aisle, box).

### State Management

- **Game state** lives entirely in `GameScene` class properties: `placedPatrons[player][row][col]`, `playerHands[player][]`, `lobbyCards[]`, `deck[]`.
- **Settings** use Phaser's `Data.DataManager` (registry) with localStorage sync via `loadSettings()`/`saveSettings()`.
- **Undo snapshots** are created in `placeSeatCard()` via `createTurnSnapshot()` and restored in `undoTurn()`.

### AI Architecture

- **Three difficulty levels:** `AIDifficulty.EASY` (random), `MEDIUM` (greedy max VP), `HARD` (greedy + positional heuristics + jitter).
- **Simulated evaluation** — AI uses `cloneGrid()` + `scorePlayer()` to evaluate every possible placement without mutating game state.
- **Two-phase AI turn:** First determine draw action (`pickDrawAction`), then placement/discard (`pickCardAndSeat`), executed sequentially with animated delays.

### Error Handling

- **Server:** `HttpError` class with `status` + `message`. Central `dispatchRoute()` catches and logs all errors.
- **Client:** try/catch around `localStorage` with graceful fallback to defaults.
- **Analytics:** Best-effort beacon (no error propagation to user).

### Testing

- **Framework:** Deno built-in test runner + `@std/assert`.
- **Test helpers** defined inline: `emptyGrid(layout)`, `card(type, trait?)`, `place(grid, row, col, type, trait?)`.
- **Run:** `deno test src/` (runs both `scoring.test.js` and `ai.test.js`).

### CI/CD

- **GitHub Actions:** lint → format check → type check → test → (on push to main) build + deploy to GitHub Pages + build Docker image → (on v* tag) release to Itch.io via Butler.
- **Docker:** Multi-stage `Containerfile` — Debian builder for `deno task build`, then distroless CC runtime.
- **Release tags:** `vYYYY.M.D.N` format pushed to origin.

### Debug Shortcuts (all scenes)

| Shortcut  | Action                                                 |
| --------- | ------------------------------------------------------ |
| `Shift+D` | Skip to next scene / end game                          |
| `Shift+S` | Cycle scenes without Title                             |
| `Shift+H` | (GameScene) Deal debug hand — one of each type + trait |
| `Shift+T` | (GameScene) Cycle theater layout                       |
| `Shift+G` | (GameScene) Copy `gameId` to clipboard                 |

### Component Coupling

- **`types.js` ↔ `scoring.js` ↔ `ai.js`** form the core data–logic triangle. `types.js` is the leaf dependency; `scoring.js` and `ai.js` never import from each other's consumers.
- **`GameScene`** is the heaviest module — it imports from nearly every subsystem (objects, factories, scoring, AI, analytics, settings, types).
- **`TheaterGrid`** and **`TheaterOverlay`** both construct `TheaterGrid` instances but with different callbacks (interactive vs. view-only).
- **Layouts** are tightly coupled with `scoring.js` (house rules, seat labels, adjacency breaks) and `TheaterGrid.js` (visual rendering, seat masks, stagger offsets).
