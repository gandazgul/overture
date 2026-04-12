<p align="center">
  <img src="./public/assets/ui_logo.png" alt="Overture" width="400" />
</p>

A digital card game where players act as theater ushers, seating patrons to
maximize victory points and manage theater chaos.

## The Goal

Seat patrons strategically to earn victory points. Different patron types have
special placement rules and synergies!

## 🚀 Play the Game

```bash
# Run the development server
deno task dev

# Open http://localhost:8080 in your browser
```

1. **Start** — Click "Start Game" on the title screen
2. **Select a Theater** — Click a theater board to select it, or hit Random
   Theater
3. **Select** — Click a card from your hand (bottom of screen)
4. **Place** — Click an empty seat in the theater grid to place that patron
5. **Score** — The game ends when the deck runs out (56 cards, 14 turns)

### Primary Patrons

| Type          | Strategy                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| **Standard**  | Worth 3 VP anywhere.                                                      |
| **VIP**       | 5 VP base; +3 VP in front rows. Penalty near Kids and Noisy patrons.      |
| **Lovebirds** | 0 VP base; +3 VP if adjacent to another Lovebird. **×2 VP** in back rows. |
| **Kid**       | 0 VP base; 2 VP only if capped by Teachers on both ends of a group.       |
| **Teacher**   | 1 VP base; +1 VP for each adjacent capped Kid.                            |
| **Critic**    | 2 VP base; **×3 VP** if seated in an aisle seat.                          |

### Secondary Traits

Traits can be applied to any patron type, adding unique bonuses or penalties.

| Trait            | Effect                                                               |
| ---------------- | -------------------------------------------------------------------- |
| **Bespectacled** | +2 VP unless seated in the back row.                                  |
| **Tall**         | Patron directly behind this seat gets −2 VP.                         |
| **Short**        | +2 VP if no one is in front; −3 VP if a **Tall** patron is in front. |
| **Noisy**        | Each adjacent patron (any type) gets −1 VP.                          |

## 🛠️ Tech Stack

- **Runtime**: [Deno](https://deno.land/) — Modern JavaScript runtime with
  built-in TypeScript support
- **Bundler**: [Vite 5](https://vitejs.dev/) — Fast HMR and builds
- **Language**: JavaScript with JSDoc — Type-safe JS without compilation
- **Engine**: [Phaser 3](https://phaser.io/) — Popular 2D game framework

### 🧰 Available Tasks

All tasks are defined in `deno.json` and run via `deno task <name>`:

| Task      | Command                          | Description                                           |
| --------- | -------------------------------- | ----------------------------------------------------- |
| `dev`     | `deno run -A npm:vite@5`         | Start the Vite dev server with HMR                    |
| `build`   | `deno run -A npm:vite@5 build`   | Production build to `dist/`                           |
| `preview` | `deno run -A npm:vite@5 preview` | Preview the production build locally                  |
| `check`   | `deno check --doc src/**/*.js`   | Type-check JS files (validates JSDoc code blocks too) |
| `lint`    | `deno lint src/`                 | Lint source files with Deno's built-in linter         |
| `test`    | `deno test src/`                 | Run all unit tests                                    |
| `ci`      | `check → lint → test`            | Run the full CI pipeline sequentially                 |

### Running CI Locally

```bash
# Run all checks in one command (type-check → lint → test)
deno task ci

# Or run individually
deno task check
deno task lint
deno task test
```

## 🏗️ Project Structure

```
overture/
├── src/
│   ├── main.js            # Game entry point & Phaser config
│   ├── config.js          # Layout constants & responsive scaling
│   ├── types.js           # Card data, patron types, deck creation
│   ├── scoring.js         # Scoring engine — pure functions, no Phaser dependency
│   ├── scoring.test.js    # Unit tests for scoring & deck logic
│   ├── settings.js        # Runtime game settings
│   ├── scenes/
│   │   ├── TitleScene.js  # Title/menu screen
│   │   └── GameScene.js   # Main gameplay
│   └── objects/
│       └── Card.js        # Card game object (Container)
├── index.html             # HTML entry point
├── deno.json              # Deno config, tasks & import map
├── vite.config.js         # Vite configuration
├── GAME_DESIGN.md         # Full game design document
└── README.md              # This file
```

## 🎮 Current Features

- ✅ **Title Screen** — Animated start button with hover effects
- ✅ **Game Grid** — 4×5 theater seating layout with row labels
- ✅ **Card Hand** — Draw 3 cards per turn, visual selection
- ✅ **Turn System** — 2-player pass-and-play supported
- ✅ **Card Placement** — Click seat to place selected card
- ✅ **Visual Feedback** — Tweens, hover effects, color changes
- ✅ **Game Over** — End screen with "Play Again" button
- ✅ **Full Deck** — 56 cards with all 6 patrons and 4 traits implemented
- ✅ **Responsive** — Scales to fit browser window
- ✅ **Scoring Engine** — Implement VIP bonuses, Teacher/Kid capping, adjacency
  debuffs
- ✅ **Victory Points Display** — Show running score during gameplay, with
  settings to toggle on/off

## 🧪 Testing

The project uses **Deno's built-in test runner** — no extra test framework
needed.

```bash
deno task test
```

**Coverage**: 93.5% branch / 99.2% line across `scoring.js` and `types.js` (39
tests).

Tests live alongside source files (`src/scoring.test.js`) and cover:

- All 6 patron types and 4 traits scoring rules (Standard, VIP, Lovebirds,
  Kid/Teacher capping, Critic; plus Tall, Short, Bespectacled, and Noisy
  modifiers)
- Edge cases: empty grids, unknown types, overlapping debuffs, back-row
  multipliers
- Deck creation: correct card count, patron distribution, and metadata

The scoring engine (`src/scoring.js`) is intentionally kept as **pure functions
with no Phaser dependency**, making it straightforward to test in isolation.

## 📝 Notes

- **No audio** — Sound effects not yet added
- **JSDoc types** — All type annotations via JSDoc; `deno task check` validates
  them including code blocks in doc comments

## 🚧 Roadmap

### Next Up

- [ ] **Play Variants** — Different "plays" with special rules
- [ ] **Audio** — Ambient theater sounds and placement effects

## 📚 Learning Phaser?

This codebase includes extensive JSDoc comments explaining Phaser concepts:

- **Scenes** — `src/scenes/TitleScene.js`, `src/scenes/GameScene.js`
- **Game Objects** — `src/objects/Card.js`
- **Configuration** — `src/main.js`

Check the code comments for explanations of:

- Scene lifecycle (init, preload, create, update)
- Interactive objects and events
- Containers for grouping elements
- Tweens for animations
- Grid-based game object placement
