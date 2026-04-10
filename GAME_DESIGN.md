# Theater Card Game — Game Design Document

> A tableau-building card game for 2–4 players where rival ushers compete to
> seat patrons in their personal theaters for maximum enjoyment—and maximum
> victory points.

---

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Setup](#setup)
4. [Turn Structure](#turn-structure)
5. [Patron Cards](#patron-cards)
   - [Primary Types](#primary-types-6)
   - [Secondary Traits](#secondary-traits-4)
   - [Trait Assignment Rules](#trait-assignment-rules)
6. [Deck Composition](#deck-composition)
7. [Scoring Reference](#scoring-reference)
   - [Primary Type Scoring](#primary-type-scoring)
   - [Trait Scoring](#trait-scoring)
   - [Cross-Type Modifiers](#cross-type-modifiers)
8. [Interesting Trait Combos](#interesting-trait-combos)
9. [Gifting & the Manager's Attention Token](#gifting--the-managers-attention-token)
10. [Theater Layouts](#theater-layouts)
11. [Play Cards](#play-cards)
12. [End of Game](#end-of-game)
13. [Design Principles](#design-principles)

---

## Overview

Each player is a theater usher with their own **4×5 theater grid** (20 seats).
On each turn you draw a patron card and place it in your theater—or "gift" a
disruptive card to an opponent's theater. The game ends when the 56-card patron
deck is exhausted. Each player then tallies victory points (VP) based on how
well their patrons are seated.

**Player count:** 2–4 players
**Turns per player:** 14 (56 cards ÷ 4 players)
**Empty seats at game end:** 6 per player (strategic dead space)

---

## Components

| Component                 | Quantity | Description                                    |
| ------------------------- | -------- | ---------------------------------------------- |
| Theater boards            | 4        | Individual 4×5 grids (one per player)          |
| Patron deck               | 56 cards | 6 primary types, 4 secondary traits            |
| Player markers            | 4 sets   | Colored tokens to identify each player's board |
| Manager's Attention token | 1        | Anti-targeting token (see [Gifting](#gifting--the-managers-attention-token)) |
| Play cards                | 4+       | Session-modifying rule cards                   |

---

## Setup

1. Each player takes a theater board and a set of colored player markers.
2. Shuffle the 56-card patron deck and place it face-down in the center.
3. Draw one **Play card** at random and apply its setup instructions (if any).
   The Play card's rules are in effect for the entire session.
4. Place the **Manager's Attention** token to one side—it enters play when the
   first gift occurs.
5. The first player draws a card and play begins clockwise.

---

## Turn Structure

1. **Draw** — Draw the top card from the patron deck.
2. **Place or Gift** — Either:
   - **Place** the card into any empty seat in *your* theater, or
   - **Gift** the card to an opponent's theater (see [Gifting](#gifting--the-managers-attention-token)).
3. Play passes clockwise.

---

## Patron Cards

Every card has exactly **one primary type** and **zero or one secondary trait**.
The primary type defines the card's core identity and scoring rules. The
optional trait adds a modifier on top.

### Primary Types (6)

| Type        | Emoji | Base VP | Core Mechanic                                           |
| ----------- | ----- | ------- | ------------------------------------------------------- |
| **Standard**  | 🧑    | 3       | Reliable points anywhere. No special conditions.        |
| **VIP**       | ⭐    | 5       | +3 VP in front 2 rows. −3 per adjacent Kid or Noisy-trait patron. |
| **Lovebirds** | 💕    | 0       | +3 VP if adjacent to another Lovebirds. ×2 in back row. |
| **Kid**       | 👦    | 0       | 0 VP unless capped; then 2 VP.                          |
| **Teacher**   | 👩‍🏫   | 1       | +1 VP per adjacent capped Kid.                          |
| **Critic**    | 🎩    | 2       | ×3 VP if in an aisle seat.                              |

### Secondary Traits (4)

| Trait            | Emoji | Effect                                                  |
| ---------------- | ----- | ------------------------------------------------------- |
| **Tall**         | 🦒    | Patron directly behind gets −2 VP.                      |
| **Short**        | 🧒    | +2 VP if no one is directly in front. −3 VP if a Tall-trait patron is directly in front. |
| **Bespectacled** | 🤓    | +2 VP if seated in the front 3 rows.                    |
| **Noisy**        | 📢    | Each orthogonally adjacent patron gets −1 VP (all types, not just Standard). |

### Trait Assignment Rules

- Each card has exactly **1 primary type** and **0 or 1 trait**.
- **Excluded combinations** (for thematic and balance reasons):
  - No **Bespectacled Lovebirds** — Lovebirds want the back row; Bespectacled rewards front rows. Contradictory incentives would create a dead card.
  - No **Short Lovebirds** — Short rewards front-row placement (no one in front); Lovebirds want the back. Same conflict.
  - No **Noisy VIP** — VIPs already penalize *themselves* for adjacent Noisy-trait patrons. A self-penalizing combo would be confusing and incoherent.

---

## Deck Composition

**56 cards total:** 35 clean (no trait) + 21 with traits.

| Primary Type | Clean | Tall | Short | Bespectacled | Noisy | **Total** |
| ------------ | :---: | :--: | :---: | :----------: | :---: | :-------: |
| Standard     | 13    | 2    | 2     | 2            | 2     | **21**    |
| VIP          | 3     | —    | —     | 1            | —     | **4**     |
| Lovebirds    | 8     | 1    | —     | —            | 1     | **10**    |
| Kid          | 5     | 1    | 1     | —            | 1     | **8**     |
| Teacher      | 3     | 1    | 1     | 1            | —     | **6**     |
| Critic       | 3     | 1    | 2     | 1            | —     | **7**     |
| **Totals**   | **35**| **6**| **6** | **5**        | **4** | **56**    |

**Design rationale:**
- **Standard (21)** — Most common; reliable filler that keeps hands playable.
- **Lovebirds (10)** — Enough density for pairs to be a viable strategy.
- **Kid (8) vs Teacher (6)** — Fewer Teachers than Kids creates tension around capping.
- **VIP (4)** — Rare, high-value prize cards. Seeing one is an event.
- **Critic (7)** — Competes for scarce aisle seats. Extra Short Critics reward corner aisle placement.
- **Trait distribution (21/56 ≈ 37.5%)** — Roughly one in three cards has a trait, keeping combos interesting without overwhelming the primary scoring.

---

## Scoring Reference

Scoring is computed in two phases, then cross-type modifiers are applied.

### Primary Type Scoring

#### Standard
- **3 VP** flat. No conditions.

#### VIP
- **5 VP** base.
- **+3 VP** if seated in **row 0 or 1** (front 2 rows).
- **−3 VP** for each orthogonally adjacent **Kid**.
- **−3 VP** for each orthogonally adjacent patron with the **Noisy** trait.

#### Lovebirds
- **0 VP** base.
- **+3 VP** if orthogonally adjacent to at least one other **Lovebirds** card.
- **×2 multiplier** if in the **back row** (row 3) *and* adjacent to another Lovebirds.

#### Kid
- **0 VP** if uncapped.
- **2 VP** if **capped** — the Kid belongs to a contiguous horizontal group of
  Kids that has a **Teacher** at both the left and right ends.

#### Teacher
- **1 VP** base.
- **+1 VP** per orthogonally adjacent **capped Kid**.

#### Critic
- **2 VP** base.
- **×3 multiplier** if seated in an **aisle seat** (columns 0 or 4 on the default layout).

### Trait Scoring

Traits modify the card's VP *on top of* primary type scoring.

#### Tall 🦒
- The patron seated **directly behind** (one row back, same column) receives **−2 VP**.
- The Tall patron itself has no self-modifier.

#### Short 🧒
- **+2 VP** if the seat directly in front is **empty** (or the patron is in row 0).
- **−3 VP** if the seat directly in front contains a **Tall-trait** patron.
- *(If a non-Short patron is behind a Tall patron, the standard Tall behind-penalty of −2 VP applies instead.)*

#### Bespectacled 🤓
- **+2 VP** if seated in the **front 3 rows** (rows 0, 1, or 2).

#### Noisy 📢
- Each **orthogonally adjacent patron** (any type) receives **−1 VP**.
- This affects *all* patron types—not only Standard.

### Cross-Type Modifiers

These apply to **any** patron regardless of their own type:

1. **Tall-behind penalty:** If the seat directly in front contains a Tall-trait
   patron and this patron is *not* Short (Short has its own penalty), this
   patron receives **−2 VP**.
2. **Noisy adjacency penalty:** For each orthogonally adjacent Noisy-trait
   patron, this patron receives **−1 VP**.

---

## Interesting Trait Combos

The trait system creates cards with layered strategic identities:

| Combo                  | Why It's Interesting                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| **Bespectacled VIP**   | Front-row double bonus. The rarest prize card in the deck—only 1 exists. Dream placement: front row, away from Kids. |
| **Tall Kid**           | Blocks the patron behind *and* is a liability if uncapped. Excellent gift card for opponents.          |
| **Noisy Lovebirds**    | Big points in the back row when paired, but hurts all neighbors. Place carefully at the edge.          |
| **Bespectacled Teacher** | Front-row trait bonus while also needing to cap Kids. Creates tension between optimal row and duty.  |
| **Short Critic**       | Dream placement: front-row corner aisle seat. +2 (Short empty front) on top of 2×3 (Critic aisle) = 8 VP from one card. |
| **Noisy Kid**          | Pure disruption. Worth 0 VP uncapped *and* hurts neighbors. The ultimate gift card.                   |
| **Tall Lovebirds**     | Wants the back row for ×2 scoring but blocks whoever sits behind. In row 3 (back), no one is behind—safe spot. |
| **Short Kid**          | Front-row bonus if uncapped feels wasted; capping in the front row means Teachers compete with VIPs for premium seats. |

---

## Gifting & the Manager's Attention Token

### The Gift Rule

When you draw a card, you may **place it in an opponent's theater** instead of
your own. This turns disruptive cards (Tall, Noisy, uncapped Kids) into
strategic weapons—but the recipient gains partial control by choosing *where*
in their grid the card goes.

**Design philosophy:** Gifts are a *hindrance*, not a devastating blow. They
force suboptimal placements and create new puzzles, but should not single-handedly
ruin a player's game.

### The Manager's Attention Token

To prevent repeated targeting of one player:

1. When you gift a card to an opponent, place the **Manager's Attention** token
   on that opponent's board.
2. **No player may gift a card to the player holding the token.**
3. The token moves only when a different opponent receives a gift.

**Example (4-player game — Alice, Bob, Carol, Dave):**
- Alice gifts a Tall Kid to Bob → token goes to Bob.
- Carol draws a Noisy Patron. She *cannot* target Bob. She gifts it to Dave →
  token moves to Dave.
- Now Dave is protected; Bob, Alice, and Carol are all valid targets.

---

## Theater Layouts

Each game uses one of several theater board layouts. All are 4×5 grids (20
seats) but differ in aisle placement, special seats, and row structure. The
chosen layout combines with a Play card to create a unique session.

### Layout A: The Grand Empress *(Default)*
- **Structure:** Wide theater with two side aisles (columns 0 and 4). No center aisle.
- **Strategic feel:** Plentiful aisle seats make the Critic a strong pick. Wide
  rows are effective for horizontal Kid groups.

### Layout B: The Blackbox
- **Structure:** Deep, narrow theater with a single center aisle. The back
  "row" has only 2 seats.
- **Strategic feel:** Aisle seats are rare and contested. The tiny back row
  makes Lovebirds placement a challenge. Tall patrons are extra impactful in
  the long, narrow shape.

### Layout C: The Royal Theatre
- **Structure:** Standard shape with two **Royal Box** seats that count as
  *both* an aisle seat and a front-row seat for scoring.
- **Strategic feel:** The Royal Boxes are the most valuable seats on the board.
  A VIP or Critic in a Royal Box scores massive points.

### Layout D: The Amphitheater
- **Structure:** Curved, tiered rows—6 seats in front, then 5, 4, 3, and 2 in
  the back. No aisles.
- **Strategic feel:** No aisle seats makes the Critic much weaker. Tiered rows
  create interesting Tall/Short line-of-sight puzzles. The tiny back rows are
  high-risk, high-reward for Lovebirds.

---

## Play Cards

At the start of each session, draw one Play card at random. Its rules apply to
all players for the entire game. Play cards fall into three categories:

### Rule Changes

**"Opening Night Gala"**
> All VIP patrons are worth an additional +3 VP. All Standard Patrons are now
> considered Bespectacled Patrons and score accordingly.

### Board Modifications

**"Fire Safety Inspection"**
> **Setup:** Place a "Velvet Rope" token on each aisle seat of your theater.
> These seats cannot be used.
> **Effect:** At the start of the final round, remove all Velvet Rope tokens.
> Aisle seats open up for a frantic endgame rush.

**"Structural Survey"**
> **Setup:** Place two "Obstructed View" tokens on the seats marked with a star
> icon on your layout board. These seats are permanently unusable.
> **Effect:** Creates dead spots that players must build around all game.

### Hybrid (Rule Change + Board Modification)

**"Sold-Out Show"**
> **Setup:** Place two Standard Patron cards from the box (not the deck) in the
> two center-most seats of your middle row.
> **Effect:** Your theater starts partially filled—two fewer seats to work with,
> but the pre-placed Standards still score.

---

## End of Game

1. The game ends immediately when the last card is drawn from the patron deck.
2. Each player scores their theater grid:
   - Phase 1: Primary type scoring for every occupied seat.
   - Phase 2: Trait scoring for every card with a trait.
   - Phase 3: Cross-type modifiers (Tall-behind, Noisy adjacency).
3. The player with the **highest total VP** wins.
4. **Tiebreaker:** The player with the most occupied seats wins. If still tied,
   the player with the fewest gifted cards in their theater wins.

---

## Design Principles

These guiding principles shaped the game's design and should inform future
expansions:

1. **Hindrance, not harm.** Gifted cards are a nuisance, not a knockout punch.
   They create new puzzles, not hopeless situations.
2. **Layered decisions.** The primary/trait split means every card has a
   dual identity. A "Tall Kid" isn't just a Kid—it's a blocking liability
   *and* a capping puzzle.
3. **Scarcity creates tension.** Fewer Teachers than Kids, only 4 VIPs, limited
   aisle seats—constraints force meaningful trade-offs.
4. **Modular replayability.** Layouts × Play cards = exponential variety. Each
   combination shifts the meta without changing the core rules.
5. **Constructive core.** The game feels like building something—your theater
   is a personal puzzle you're proud of—with just enough interaction to keep
   everyone engaged.
6. **Expansion-ready.** The system is designed for growth: new layouts, new Play
   cards, and potentially a shared-theater competitive/cooperative mode.
