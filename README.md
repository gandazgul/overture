# 🎭 Theater Ushers

A digital card game where players act as theater ushers, seating patrons to maximize victory points and manage theater chaos.

## 🚀 Play the Game

```bash
# Run the development server
deno task dev

# Open http://localhost:5173 in your browser
```

## 📋 How to Play

1. **Start** — Click "Start Game" on the title screen
2. **Select** — Click a card from your hand (bottom of screen)
3. **Place** — Click an empty seat in the theater grid to place that patron
4. **Score** — The game ends when the deck runs out (scoring is simplified in this version)

### The Goal
Seat patrons strategically to earn victory points. Different patron types have special placement rules and synergies!

### Patron Types
| Type | Emoji | Strategy |
|------|-------|----------|
| Standard | 🧑 | Worth 1 VP anywhere |
| Bespectacled | 🤓 | Bonus VP in front rows |
| VIP | ⭐ | High VP in front, penalty near Kids/Noisy |
| Lovebirds | 💕 | Score only if adjacent to another Lovebirds |
| Kid | 👦 | Negative VP unless capped by Teachers |
| Teacher | 👩‍🏫 | Scores VP for each adjacent Kid capped |
| Tall | 🦒 | Patron behind gets -2 VP |
| Short | 🧒 | Bonus if no one in front |
| Critic | 🎩 | Triple VP in aisle seats |
| Noisy | 📢 | Adjacent patrons get -2 VP |

## 🛠️ Tech Stack

- **Runtime**: [Deno](https://deno.land/) — Modern JavaScript runtime with built-in TypeScript support
- **Bundler**: [Vite 5](https://vitejs.dev/) — Fast HMR and builds
- **Language**: JavaScript with JSDoc — Type-safe JS without compilation
- **Engine**: [Phaser 3](https://phaser.io/) — Popular 2D game framework

## 🏗️ Project Structure

```
theater-card-game/
├── src/
│   ├── main.js          # Game entry point & config
│   ├── types.js         # Card data, patron types, deck creation
│   ├── scenes/
│   │   ├── TitleScene.js   # Title/menu screen
│   │   └── GameScene.js    # Main gameplay
│   └── objects/
│       └── Card.js        # Card game object (Container)
├── index.html           # HTML entry point
├── deno.json            # Deno config & tasks
├── vite.config.js       # Vite configuration
├── GAME_DESIGN.md       # Full game design document
└── README.md            # This file
```

## 🎮 Current Features

- ✅ **Title Screen** — Animated start button with hover effects
- ✅ **Game Grid** — 4×5 theater seating layout with row labels
- ✅ **Card Hand** — Draw 3 cards per turn, visual selection
- ✅ **Turn System** — 2-player pass-and-play supported
- ✅ **Card Placement** — Click seat to place selected card
- ✅ **Visual Feedback** — Tweens, hover effects, color changes
- ✅ **Game Over** — End screen with "Play Again" button
- ✅ **Full Deck** — 56 cards with all patron types implemented
- ✅ **Responsive** — Scales to fit browser window

## 📝 Notes

- **No scoring yet** — The game tracks turns and seats patrons, but the full VP scoring system (VIP bonuses, Teacher/Kid capping, adjacency effects) is not yet implemented
- **Geometric shapes** — Uses Phaser rectangles/text instead of sprites
- **No audio** — Sound effects not yet added

## 🚧 Roadmap

### Next Up
- [ ] **Scoring Engine** — Implement VIP bonuses, Teacher/Kid capping, adjacency debuffs
- [ ] **Victory Points Display** — Show running score during gameplay

### Future
- [ ] **Visual Assets** — Replace rectangles with 2D sprites
- [ ] **Audio** — Ambient theater sounds and placement effects
- [ ] **More Players** — Support 3-4 player games
- [ ] **Play Variants** — Different theater layouts and "plays" with special rules

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
