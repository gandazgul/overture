# Overture - Game Design Document

> A tableau-building card game for 2-4 players where rival ushers compete to
> seat patrons in their personal theaters for maximum enjoyment-and maximum
> victory points.

---

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
3. [Setup](#setup)
4. [Turn Structure](#turn-structure)
5. [The Lobby](#the-lobby)
6. [Patron Cards](#patron-cards)
   - [Primary Types](#primary-types-6)
   - [Secondary Traits](#secondary-traits-4)
   - [Trait Assignment Rules](#trait-assignment-rules)
7. [Deck Composition](#deck-composition)
8. [Scoring Reference](#scoring-reference)
   - [Primary Type Scoring](#primary-type-scoring)
   - [Trait Scoring](#trait-scoring)
   - [Cross-Type Modifiers](#cross-type-modifiers)
9. [Interesting Trait Combos](#interesting-trait-combos)
10. [Gifting & the Manager's Attention Token](#gifting--the-managers-attention-token)
11. [Theater Cards](#theater-cards)
12. [Play Cards](#play-cards)
13. [Season Deck](#season-deck)
14. [End of Game](#end-of-game)
15. [Art Direction & Visual Style](#art-direction--visual-style)
16. [Design Principles](#design-principles)

---

## Overview

Each player is a theater usher with their own theater grid (layout varies by
Theater card). On each turn you draw a patron card from the deck or take one
from the **Lobby** (a shared face-up market), then place it in your theater-or
"gift" a disruptive card to an opponent's theater. The game ends when the
56-card patron deck is exhausted. Each player then tallies victory points (VP)
based on how well their patrons are seated.

**Player count:** 2-4 players **Game setup:** Draw 1 Theater card + 1 Play card
from the Season Deck. The Theater defines your grid layout and house rule; the
Play defines the session's scoring twist and any extra cards shuffled into the
patron deck.

---

## Components

| Component                 | Quantity | Description                                                                  |
| ------------------------- | -------- | ---------------------------------------------------------------------------- |
| Theater boards            | 4        | Individual grids (layout defined by Theater card)                            |
| Patron deck               | 56 cards | 6 primary types, 4 secondary traits                                          |
| Season deck               | varies   | Theater cards, Play cards, Role cards, Demand cards, Understudy cards        |
| Player markers            | 4 sets   | Colored tokens to identify each player's board                               |
| Manager's Attention token | 1        | Anti-targeting token (see [Gifting](#gifting--the-managers-attention-token)) |

---

## Setup

1. **Draw a Theater card** from the Season Deck. All players use the same
   theater layout. Apply any setup instructions on the card.
2. **Draw a Play card** from the Season Deck. Read its rules aloud. If the Play
   adds extra cards to the patron deck (e.g., Understudy cards, Role cards),
   find them in the Season Deck and follow the Play's setup instructions.
3. Each player takes a theater board and configures it to match the Theater
   card's layout.
4. Shuffle the 56-card patron deck (plus any extra cards from the Play) and
   place it face-down in the center.
5. **Set up the Lobby:** Draw 3 cards from the patron deck and place them
   face-up in a row beside the deck.
6. Place the **Manager's Attention** token to one side-it enters play when the
   first gift occurs.
7. The first player takes their turn and play proceeds clockwise.

---

## Turn Structure

1. **Draw** - Either:
   - Draw the **top card** from the patron deck (blind), or
   - Take **one card** from the Lobby (known).
2. **Place or Gift** - Either:
   - **Place** the card into any empty seat in _your_ theater, or
   - **Gift** the card to an opponent's theater (see
     [Gifting](#gifting--the-managers-attention-token)).
3. **Refill the Lobby** - If you took from the Lobby, refill it to 3 cards from
   the top of the patron deck. _(If the deck is empty, the Lobby simply
   shrinks.)_
4. Play passes clockwise.

---

## The Lobby

The Lobby is a shared face-up market of 3 patron cards, available to all
players. It is a **universal mechanic** present in every game regardless of
Theater or Play card.

### Why the Lobby Exists

Without the Lobby, each turn is a blind draw followed by an often-obvious
placement. The Lobby adds:

- **Visible information** - Everyone can see what's available. You know what
  your opponents might want.
- **Racing** - "I need that Lovebirds before Carol takes it." Taking a card from
  the Lobby denies it to others.
- **Risk vs. reward** - Take a known card from the Lobby, or gamble on a blind
  draw that might be better (or worse)?
- **Strategic denial** - Sometimes you take a card from the Lobby not because
  you want it, but because an opponent needs it.

### Lobby Rules

1. The Lobby always starts with 3 face-up cards (dealt during setup).
2. On your turn, you may take one Lobby card instead of drawing from the deck.
3. After taking from the Lobby, immediately refill to 3 from the deck.
4. Cards taken from the Lobby follow the same Place or Gift rules as drawn
   cards.
5. If the patron deck is empty, the Lobby cannot refill. Players may still take
   from whatever remains in the Lobby.

---

## Patron Cards

Every card has exactly **one primary type** and **zero or one secondary trait**.
The primary type defines the card's core identity and scoring rules. The
optional trait adds a modifier on top.

### Primary Types (7)

| Type          | Base VP | Core Mechanic                                                     |
| ------------- | ------- | ----------------------------------------------------------------- |
| **Standard**  | 3       | Reliable points anywhere. No special conditions.                  |
| **VIP**       | 3       | +3 VP in front 2 rows. −3 per adjacent Kid or Noisy-trait patron. |
| **Lovebirds** | 1       | +3 VP if horizontally paired. +2 VP in back row. Pairs only.      |
| **Kid**       | 1       | 1 VP uncapped; 3 VP when capped.                                  |
| **Teacher**   | 3       | +1 VP per adjacent capped Kid.                                    |
| **Critic**    | 3       | +3 VP in aisle seat. Noisy neighbors nullify the bonus.           |
| **Friends**   | 3       | +1 VP per orthogonally adjacent Friend.                           |

### Secondary Traits (4)

| Trait            | Effect                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------- |
| **Tall**         | Patron directly behind gets -2 VP.                                                       |
| **Short**        | +2 VP if no one is directly in front. -3 VP if a Tall-trait patron is directly in front. |
| **Bespectacled** | +2 VP unless seated in the back row.                                                     |
| **Noisy**        | Each orthogonally adjacent patron gets -1 VP (all types, not just Standard).             |

### Trait Assignment Rules

- Each card has exactly **1 primary type** and **0 or 1 trait**.
- **Excluded combinations** (for thematic and balance reasons):
  - No **Bespectacled Lovebirds** - Lovebirds want the back row; Bespectacled
    rewards front rows. Contradictory incentives would create a dead card.
  - No **Short Lovebirds** - Short rewards front-row placement (no one in
    front); Lovebirds want the back. Same conflict.
  - No **Noisy VIP** - VIPs already penalize _themselves_ for adjacent
    Noisy-trait patrons. A self-penalizing combo would be confusing and
    incoherent.
  - No **Noisy Friends** - Friends gain +1 VP per adjacent Friend, but Noisy
    inflicts -1 VP on each adjacent patron. The bonus and penalty cancel out,
    making the card pointless.

---

## Deck Composition

**56 cards total:** 27 clean (no trait) + 24 with traits.

| Primary Type | Clean  | Tall  | Short | Bespectacled | Noisy | **Total** |
| ------------ | :----: | :---: | :---: | :----------: | :---: | :-------: |
| Standard     |   5    |   2   |   2   |      2       |   2   |  **13**   |
| VIP          |   3    |   -   |   -   |      1       |   -   |   **4**   |
| Lovebirds    |   8    |   1   |   -   |      -       |   1   |  **10**   |
| Kid          |   5    |   1   |   1   |      -       |   1   |   **8**   |
| Teacher      |   3    |   1   |   1   |      1       |   -   |   **6**   |
| Critic       |   3    |   1   |   2   |      1       |   -   |   **7**   |
| Friends      |   5    |   1   |   1   |      1       |   -   |   **8**   |
| **Totals**   | **32** | **7** | **7** |    **6**     | **4** |  **56**   |

**Design rationale:**

- **Standard (13)** - Most common; reliable filler that keeps hands playable.
- **Lovebirds (10)** - Enough density for pairs to be a viable strategy.
- **Friends (8)** - Rewards clustering in any direction. Safe 3 VP floor when isolated.
- **Kid (8) vs Teacher (6)** - Fewer Teachers than Kids creates tension around
  capping.
- **VIP (4)** - Rare, high-value prize cards. Seeing one is an event.
- **Critic (7)** - Competes for scarce aisle seats. Extra Short Critics reward
  corner aisle placement.
- **Trait distribution (24/56 ≈ 43%)** - Nearly half the cards have a
  trait, keeping combos interesting without overwhelming the primary scoring.

---

## Scoring Reference

Scoring is computed in two phases, then cross-type modifiers are applied.

### Primary Type Scoring

#### Standard

- **3 VP** flat. No conditions.

#### VIP

- **3 VP** base.
- **+3 VP** if seated in **row 0 or 1** (front 2 rows).
- **-3 VP** for each orthogonally adjacent **Kid**.
- **-3 VP** for each orthogonally adjacent patron with the **Noisy** trait.

#### Lovebirds

- **1 VP** base.
- **+3 VP** if **horizontally paired** — adjacent to another Lovebirds in the
  same row (left or right). Only **strict pairs** count: the first two adjacent
  Lovebirds in a row form a pair; a third adjacent Lovebird is unpaired. Four
  adjacent Lovebirds form two pairs.
- **+2 VP** bonus if in the **back row** _and_ paired.

#### Kid

- **1 VP** if uncapped.
- **3 VP** if **capped** — the Kid belongs to a contiguous horizontal group of
  Kids that has a **Teacher** at both the left and right ends.

#### Teacher

- **3 VP** base.
- **+1 VP** per orthogonally adjacent **capped Kid**.

#### Critic

- **3 VP** base.
- **+3 VP** if seated in an **aisle seat** (columns 0 or 4 on the default
  layout), **unless** any orthogonally adjacent patron has the **Noisy** trait.
  A Noisy neighbor nullifies the aisle bonus entirely.

#### Friends

- **3 VP** base.
- **+1 VP** per orthogonally adjacent **Friends**. Counts all four directions
  (left, right, front, back). A Friends in a 2×2 block gets +2 VP (5 total).
  Maximum possible: +4 VP with 4 adjacent Friends (7 total, very rare).

### Trait Scoring

Traits modify the card's VP _on top of_ primary type scoring.

#### Tall

- The patron seated **directly behind** (one row back, same column) receives
  **-2 VP**.
- The Tall patron itself has no self-modifier.

#### Short

- **+2 VP** if the seat directly in front is **empty** (or the patron is in row
  0).
- **-3 VP** if the seat directly in front contains a **Tall-trait** patron.
- _(If a non-Short patron is behind a Tall patron, the standard Tall
  behind-penalty of -2 VP applies instead.)_

#### Bespectacled

- **+2 VP** unless seated in the **back row**.

#### Noisy

- Each **orthogonally adjacent patron** (any type) receives **-1 VP**.
- This affects _all_ patron types-not only Standard.

### Cross-Type Modifiers

These apply to **any** patron regardless of their own type:

1. **Tall-behind penalty:** If the seat directly in front contains a Tall-trait
   patron and this patron is _not_ Short (Short has its own penalty), this
   patron receives **-2 VP**.
2. **Noisy adjacency penalty:** For each orthogonally adjacent Noisy-trait
   patron, this patron receives **-1 VP**.

---

## Interesting Trait Combos

The trait system creates cards with layered strategic identities:

| Combo                    | Why It's Interesting                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **Bespectacled VIP**     | Front-row double bonus. The rarest prize card in the deck—only 1 exists. Dream placement: front row, away from Kids. 3+3+2=8 VP.   |
| **Tall Kid**             | Blocks the patron behind _and_ is a liability if uncapped. Excellent gift card for opponents.                           |
| **Noisy Lovebirds**      | Big points in the back row when paired, but hurts all neighbors. Place carefully at the edge.                           |
| **Bespectacled Teacher** | Front-row trait bonus while also needing to cap Kids. Creates tension between optimal row and duty.                     |
| **Short Critic**         | Dream placement: front-row corner aisle seat. +2 (Short empty front) on top of 3+3 (Critic aisle) = 8 VP from one card. |
| **Noisy Kid**            | Worth 1 VP uncapped _and_ hurts neighbors. The ultimate gift card. Noisy also nullifies any adjacent Critic's aisle bonus. |
| **Tall Lovebirds**       | Wants the back row for +2 bonus but blocks whoever sits behind. In the back row, no one is behind—safe spot.            |
| **Short Kid**            | Front-row bonus if uncapped feels wasted; capping in the front row means Teachers compete with VIPs for premium seats.  |
| **Tall Friends**         | Blocks the patron behind, but great in the back row where there's no one behind and the Friends cluster grows safely.   |
| **Short Friends**        | +2 VP if no one is in front. Place at the front edge of a Friends cluster for the Short bonus on top of group VP.       |
| **Bespectacled Friends** | +2 VP unless in the back row. Encourages Friends clusters in the front/middle rows rather than the back.                |

---

## Gifting & the Manager's Attention Token

### The Gift Rule

When you draw a card, you may **place it in an opponent's theater** instead of
your own. This turns disruptive cards (Tall, Noisy, uncapped Kids) into
strategic weapons-but the recipient gains partial control by choosing _where_ in
their grid the card goes.

**Design philosophy:** Gifts are a _hindrance_, not a devastating blow. They
force suboptimal placements and create new puzzles, but should not
single-handedly ruin a player's game.

### The Manager's Attention Token

To prevent repeated targeting of one player:

1. When you gift a card to an opponent, place the **Manager's Attention** token
   on that opponent's board.
2. **No player may gift a card to the player holding the token.**
3. The token moves only when a different opponent receives a gift.

**Example (4-player game - Alice, Bob, Carol, Dave):**

- Alice gifts a Tall Kid to Bob → token goes to Bob.
- Carol draws a Noisy Patron. She _cannot_ target Bob. She gifts it to Dave →
  token moves to Dave.
- Now Dave is protected; Bob, Alice, and Carol are all valid targets.

---

## Theater Cards

Each game uses one Theater card drawn from the Season Deck. The Theater defines
the **grid layout** (seat positions, aisle locations, special seats) and a
**house rule** unique to that venue. All players use the same Theater.

The house rule is a passive effect or audience demand baked into the venue-it
changes what "good placement" means and creates tension with the standard
scoring rules.

### 🎭 The Grand Empress _(Default)_

```
    Col 0  1  2  3  4
Row 0: [A][ ][ ][ ][A]    A = Aisle seat
Row 1: [A][ ][ ][ ][A]    20 seats total
Row 2: [A][ ][ ][ ][A]    8 aisle seats
Row 3: [A][ ][ ][ ][A]
```

**House Rule: "The Classics"** - No special demand. Vanilla scoring. This is the
learning theater.

**Strategic feel:** Generous aisles make Critics strong. Wide rows are great for
Kid-Teacher chains. The baseline experience.

---

### 🎭 The Blackbox

```
    Col 0  1  2  3
Row 0: [ ][A][A][ ]       20 seats total
Row 1: [ ][A][A][ ]       the aisle seats are in the center
Row 2: [ ][A][A][ ]       4 columns, 5 rows deep
Row 3: [ ][A][A][ ]
Row 4: [ ][A][A][ ]
```

**House Rule: “Intimate Venue”** — Each patron adjacent to 3+ other patrons
(orthogonally surrounded) gets +1 VP.

**Strategic feel:** Narrow and deep with 5 rows. Aisle seats are center-only,
making Critic placement unintuitive. 5 rows deep means Tall chains are
devastating. The dense packing bonus creates tension: you _want_ neighbors for
+1 VP, but Noisy patrons punish exactly that. Noisy also nullifies Critic aisle
bonuses.

---

### 🎭 The Royal Theatre

```
    Col 0  1  2  3  4
Row 0: [B][F][F][F][B]    B = Royal Box (counts as aisle + front row) and they are not adjacent to the front row seats
Row 1: [A][ ][ ][ ][A]    20 seats, 8 aisle seats, 2 Royal Boxes
Row 2: [A][ ][ ][ ][A]
Row 3: [A][ ][ ][ ][A]
```

**House Rule: "Royal Approval"** - The single highest-scoring patron in your
theater gets +3 VP. Tiebreaker: front-most, then left-most.

**Strategic feel:** The Royal Boxes are the most contested seats—a Bespectacled
VIP in a Box scores 3+3+2+3 = 11 VP. "Royal Approval" also incentivizes building
one mega-patron _anywhere_. Do you put your best card in the Box, or does the
Box itself make the card your best?

---

### 🎭 The Amphitheater

```
    Col 0  1  2  3  4  5
Row 0:     [F][F][F]         Tiered: 3-4-5-6 = 18 seats
Row 1:    [ ][ ][ ][ ]       NO aisle seats at all
Row 2:  [ ][ ][ ][ ][ ]      Rows widen toward the back
Row 3: [ ][ ][ ][ ][ ][ ]
```

**House Rule: "The Panorama"** - +2 VP bonus for each completely filled row.

**Strategic feel:** Zero aisles means Critics are nearly dead (base 3 VP only,
no aisle bonus).
Widening rows create a natural wedge shape-the narrow front (3 seats) is easy to
fill for Panorama bonus but scarce for VIPs. The wide back row (6 seats) is
Lovebirds paradise but hard to fill completely. Do you complete the easy small
rows or go for the big back row?

---

### 🎭 The Cabaret

```
  Col   0  1     2  3     4  5
Row 0: [F][F]   [F][F]   [F][F]    "Tables" of 2×2
Row 1: [ ][ ]   [ ][ ]   [ ][ ]    with gaps between them
       ─── horizontal gap ───      24 seats, 3 tables per row-pair
Row 2: [ ][ ]   [ ][ ]   [ ][ ]    No aisles, but gaps break adjacency
Row 3: [ ][ ]   [ ][ ]   [ ][ ]    Kids and Teachers want to cluster at tables; Noisy patrons are less punishing with gaps.
```

**House Rule: "Full Tables"** - +3 VP for each 2×2 table where all 4 seats are
occupied.

**Cabaret Capping Rule:** Kids cannot be capped by the normal horizontal chain
rule (tables are only 2 seats wide). Instead, a Kid is **capped if any Teacher
is seated at the same 2×2 table**. One Teacher can cap up to 3 Kids at their
table.

**Strategic feel:** Gaps between tables break adjacency-a Noisy patron only
hurts tablemates, not the next table over. The horizontal gap between row-pairs
further isolates the top 3 tables from the bottom 3. Lovebirds want to share a
table. Filling a full table for +3 VP means you might place a mediocre card just
to complete it. The table capping rule makes Teachers valuable—one Teacher can
supervise an entire table of Kids—but you sacrifice seats that could hold
higher-scoring patrons. Critics score only 3 VP base (no aisle seats exist).

---

### 🎭 The Balcony

```
  Col   0  1  2  3  4
Row 0: [B][F][F][F][B]    Balcony (elevated, separate)
      ────────────────    Gap: no adjacency between row 0 and row 1
Row 1: [A][F][F][F][A]    Main floor, both the balcony and Row 1 are front rows for VIPs
Row 2: [A][ ][ ][ ][A]    B = Box seat (counts as aisle + front row) but they are adjacent to the balcony seats
Row 3: [A][ ][ ][ ][A]
```

**House Rule: "Bird's Eye View"** - Patrons in the balcony (row 0) are NOT
adjacent to row 1. Balcony patrons with the Tall trait don't penalize anyone.
Short patrons in the balcony always get their +2 VP (no one in front).

**Strategic feel:** The balcony is a safe haven for problem cards-Tall patrons,
Noisy patrons, misfits. But it's also "front row" for VIP/Bespectacled scoring.
Do you waste premium front-row real estate on damage control, or pack it with
your best scorers and deal with Tall/Noisy problems below?

---

### 🎭 The Promenade

```
  Col 0  1  2  3  4
Row 0: [A][F][F][F][A]    Staggered aisles:
Row 1: [ ][ ][A][ ][ ]    different columns each row
Row 2: [A][ ][ ][ ][A]    20 seats, 8 aisle seats
Row 3: [ ][ ][A][ ][ ]
```

**House Rule: "Wandering Critics"** - Critics score their +3 aisle bonus in any aisle
seat (as normal), but aisle seats change every row. +1 VP per Critic if you have
3+ Critics in aisle seats.

**Strategic feel:** Every row has different aisle columns, so "aisle strategy"
isn't a single column anymore. Tall patrons in aisles block different positions
than expected. The stagger means you can't just fill column 0 with Critics.
Forces spread-out thinking.

---

### 🎪 The Rotunda

```
  Col 0  1  2  3  4
Row 0:    [F][F][F]        Hollow ring: 16 seats
Row 1: [A][F]   [F][A]    Center = stage (no seats)
Row 2: [A]         [A]    F = Front (stage-side)
Row 3: [A][F]   [F][A]    A = Aisle (outer ring)
Row 4:    [F][F][F]        No back row at all
```

**House Rule: "In the Round"** — No back row. Stage-side seats (inner ring)
count as front row. Outer-ring seats are aisles.

**Strategic feel:** Theater-in-the-round completely redefines the geometry. The
10 inner-ring seats are all "front row," making VIPs strong almost everywhere.
Bespectacled gets +2 VP on every seat (no back row to exclude them). But
Lovebirds lose their back-row +2 bonus entirely—they're capped at 4 VP
per pair. Critics have only 6 outer-ring aisle seats to compete for. The hollow
center breaks adjacency across the stage — patrons on opposite sides of the ring
can't see each other. Short patrons love the inner ring: many seats face the
empty stage, triggering the +2 VP empty-front bonus. The ring shape also limits
max neighbors to 2-3 per seat, making Noisy patrons slightly less punishing.

---

## Play Cards

Each game uses one Play card drawn from the Season Deck. The Play defines a
**scoring twist** or **rule modification** for the session, and optionally adds
**extra cards** from the Season Deck into the patron deck at setup.

### 🎬 The Casting Call

**Rule:** At setup, deal one **Role card** to each player at random. Each Role
gives a unique ability for the entire game. Role cards are played face-up-
everyone knows everyone's advantage.

**Extra cards:** 6 Role cards (deal one per player, return unused to the Season
Deck):

| Role                 | Ability                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **The Veteran**      | Once per game, put your drawn card on the bottom of the deck and draw again.                          |
| **The Architect**    | Once per game, after placing a patron, swap two adjacent patrons in your theater.                     |
| **The Collector**    | End-game: +1 VP per unique primary type in your theater (max +6).                                     |
| **The Director**     | Once per game, look at the top 3 cards before drawing. Take one, return two in any order.             |
| **The Understudy**   | Once per game, place a drawn card face-down. It scores as a Standard (3 VP) regardless of what it is. |
| **The Patron Saint** | End-game: your 3 lowest-scoring patrons each get +1 VP.                                               |

**Why it's interesting:** Three "once per game" roles (Veteran, Architect,
Director) create timing tension-when do you spend your ability? Three passive
roles (Collector, Understudy, Patron Saint) are simpler but still warp strategy.
Face-up roles mean opponents can plan around your ability. 6 roles for max 4
players means you never see all roles in one game.

---

### 🎬 The Understudy

**Rule:** Normal scoring.

**Extra cards:** Shuffle 3 **Understudy patron cards** into the patron deck (59
cards total). Understudies have no primary type and no trait. At end-game, each
Understudy scores as whatever primary type would earn the most VP in its current
seat. (It does NOT gain a trait.)

**Why it's interesting:** Every Understudy placement is a puzzle. An aisle seat
makes it a Critic (6 VP). A front-row seat away from Kids makes it a VIP (6 VP).
Next to another Lovebirds in the back row makes it Lovebirds (6 VP). But it
resolves at _end-game_, so the best seat depends on what you place around it
later. Rewards long-term planning and flexible positioning.

---

### 🎬 The Dress Rehearsal

**Rule:** **Draft-and-pass.** Each turn, draw 2 cards from the deck. Place one
(in your theater or gift it). The other goes face-up into the next player's
(clockwise) **offer pile**. On your turn, before drawing, you may take a card
from your offer pile instead of drawing 2.

- The Lobby is still available: you may take from the Lobby instead of drawing 2
  or taking from your offer pile.
- Your offer pile is visible to all players.
- If you take from your offer pile, you place that single card normally (no
  second card, no pass).

**Extra cards:** None.

**Why it's interesting:** Every draw is a split decision-and you're feeding your
neighbor. "Do I keep the VIP and pass them the Lovebirds they clearly need, or
keep the Lovebirds defensively and pass them the VIP?" The offer pile also
interacts with the Lobby: sometimes the Lobby has what you need, so you skip
your offer pile-but that card stays there, growing your neighbor's options.

---

### 🎬 Sold-Out Show

**Rule:** At setup, each player draws 2 patron cards from the deck and places
them face-up in any seats in their theater. These pre-placed patrons score
normally.

**Extra cards:** None.

**Why it's interesting:** You start with constraints AND information. Those 2
pre-placed cards define your early strategy, but now 8 cards (in a 4-player
game) are out of the deck and visible to everyone. Changes the math on what's
left.

---

### 🎬 The Matinee

**Rule:** **Intermission.** After round 7 (half the deck is drawn), pause and
score rows 0 and 1 only. Those points are banked. At end-game, score the full
theater (including rows 0-1 again). Front-row patrons effectively score _twice_.

**Extra cards:** None.

**Why it's interesting:** Massively inflates front-row value. VIPs and
Bespectacled patrons become even more premium. But if you rush to fill the front
rows by round 7, you might place suboptimal cards just for the double-score. Do
you stack the front for intermission points or build the back row for a stronger
end-game?

---

### 🎬 The Avant-Garde

**Rule:** At end-game, each **empty seat** that is orthogonally adjacent to at
least 2 occupied seats scores +2 VP. Empty seats are no longer dead space-
they're "breathing room."

**Extra cards:** None.

**Why it's interesting:** Completely inverts the default "fill as many seats as
possible" instinct. Now you're intentionally leaving gaps. A checkerboard
pattern might outscore a packed theater. Noisy patrons become less punishing
because you want gaps anyway. In the Cabaret (Full Tables house rule), this
creates a direct contradiction-fill tables or leave breathing room?

---

### 🎬 The Mystery

**Rule:** At setup, shuffle the 10 Demand cards and deal 3 face-down. Reveal one
after round 4, one after round 8, and one after round 12. Demands are end-game
bonus VP conditions visible to all players once revealed.

**Extra cards:** 10 **Demand cards** in the Season Deck:

| Demand                  | Bonus                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| _"Standing Ovation"_    | +5 VP if your back row is completely filled.                       |
| _"No Children Allowed"_ | +4 VP if you have 0 Kids in your theater.                          |
| _"The Ensemble"_        | +3 VP if you have 4+ different primary types in your theater.      |
| _"Quiet Please"_        | +4 VP if you have 0 Noisy-trait patrons in your theater.           |
| _"Critic's Choice"_     | +3 VP if you have 3+ Critics in your theater.                      |
| _"Packed House"_        | +1 VP per occupied seat (max +14).                                 |
| _"Front Row Royalty"_   | +5 VP if every seat in row 0 is occupied.                          |
| _"The Odd Couple"_      | +4 VP if you have at least one VIP orthogonally adjacent to a Kid. |
| _"Lovebirds' Nest"_     | +4 VP if you have 3+ Lovebirds in the back row.                    |
| _"Teacher's Pet"_       | +3 VP if all Kids in your theater are capped.                      |

**Why it's interesting:** The staged reveal forces adaptation. You build for 4
rounds blind, then a demand reveals that might reward or punish what you've
already built. By round 8 you have two demands to juggle. The third comes too
late to react to fully-it's a gamble. Demands also interact with the Lobby: when
"Critic's Choice" is revealed, suddenly every Critic in the Lobby becomes hotly
contested.

---

### 🎬 The Double Feature

**Rule:** The game is played in two halves. After round 7, each player gets a
**second theater board** (same layout as their first). For the remaining 7
rounds, you place into either theater. At end-game, score both theaters
separately; your final score is the **lower** of the two.

**Extra cards:** None.

**Why it's interesting:** You can't just stack one theater. If you dump all good
cards into Theater A and neglect Theater B, your low score from B is what
counts. Forces balanced play. Gifting becomes more agonizing-which of their two
theaters do you target?

---

## Season Deck

The Season Deck is a separate deck of cards used during setup to configure each
game session. It contains all Theater cards, Play cards, and any extra cards
referenced by specific Plays.

### Season Deck Composition

| Card Type               | Count  | Used By                |
| ----------------------- | ------ | ---------------------- |
| Theater cards           | 8      | Setup: draw 1 per game |
| Play cards              | 7      | Setup: draw 1 per game |
| Role cards              | 6      | The Casting Call play  |
| Demand cards            | 10     | The Mystery play       |
| Understudy patron cards | 3      | The Understudy play    |
| **Total**               | **34** |                        |

### Notable Theater × Play Combos

| Combo                                | Why It's Spicy                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Amphitheater + The Avant-Garde**   | "Fill rows for +2 VP" vs. "leave gaps for +2 VP." Direct contradiction forces hard choices every turn.                   |
| **Cabaret + The Mystery**            | Table layout fragments adjacency; demand cards might require cross-table planning.                                       |
| **Blackbox + The Understudy**        | Only 16 seats, almost full. Understudies in a cramped space with tons of adjacency-their flex value is huge.             |
| **Balcony + The Matinee**            | Balcony IS row 0, scores twice at intermission. But it's disconnected from row 1. Stack it or protect it?                |
| **Promenade + The Dress Rehearsal**  | Staggered aisles + draft-and-pass. You can see what your neighbor needs AND deny them the right aisle-seat card.         |
| **Royal Theatre + The Casting Call** | The Collector role loves the Royal Boxes (diverse types for +6 VP). The Architect can swap a patron INTO a Box mid-game. |
| **Grand Empress + The Mystery**      | Vanilla layout lets you focus purely on demand adaptation. Good for learning The Mystery without layout complexity.      |
| **Rotunda + The Avant-Garde**        | Empty stage center already breaks adjacency; leaving outer-ring gaps for +2 VP each compounds the breathing-room bonus. |
| **Rotunda + The Matinee**            | Every inner-ring seat is "front row" and scores twice at intermission. VIPs and Bespectacled patrons are strong.        |

---

## End of Game

1. The game ends immediately when the last card is drawn from the patron deck
   (and the Lobby is empty, if applicable).
2. Each player scores their theater grid:
   - Phase 1: Primary type scoring for every occupied seat.
   - Phase 2: Trait scoring for every card with a trait.
   - Phase 3: Cross-type modifiers (Tall-behind, Noisy adjacency).
   - Phase 4: Theater house rule bonuses (if any).
   - Phase 5: Play card bonuses (Demand cards, Role card passives, etc.).
3. The player with the **highest total VP** wins.
4. **Tiebreaker:** The player with the most occupied seats wins. If still tied,
   the player with the fewest gifted cards in their theater wins.

---

## Art Direction & Visual Style

The game uses a **1920s Art Deco theater** aesthetic throughout.

### Color Palette

| Role           | Hex / Value   | Usage                                       |
| -------------- | ------------- | ------------------------------------------- |
| Gold bright    | `#DAA520`     | Primary accent, borders, icons, crown motifs |
| Gold light     | `#F5C518`     | Highlights, hover states, house-rule text    |
| Gold dark      | `#B48214`     | Secondary accents, inner details             |
| Navy deep      | `#0F0F1C`     | Panel backgrounds (95 % opacity)             |
| Navy mid       | `#1A1A2E`     | Seat fills (regular), UI circles             |
| Navy seat      | `#1A1A3E`     | Seat fills (default empty)                   |
| Navy aisle     | `#1E1E38`     | Aisle seat fills                             |
| Purple box     | `#2A2040`     | Royal Box seat fills                         |
| Stroke default | `#3A3A5E`     | Regular seat border                          |
| Stroke aisle   | `#8A7A3E`     | Aisle seat border (gold-tinted)              |
| Hover fill     | `#2A2A5E`     | Seat hover highlight                         |
| Heading gold   | `#D4AF37`     | HUD headings, stage border stroke            |
| Subtext        | `#AAAACC`     | Muted lavender for secondary info            |

### Patron Card Art

Illustrated character portraits in a semi-realistic cartoon style with muted
theatrical colors and dark, moody lighting. Each primary type has a distinct
silhouette (e.g., VIP in furs and pearls, Critic in tuxedo with notepad, Kid in
cap and suspenders). Cards are rendered at display size ~100 × 100 px in-game.

### Badges & Tags (64 × 64 PNG)

Small overlay icons placed on cards or seats:

- **Trait badges** — dark semi-transparent _circular_ background with gold
  iconography (top hat for Tall, glasses for Bespectacled, megaphone for Noisy,
  red suitcase for Short).
- **Seat tags** — dark semi-transparent _pill-shaped_ or circular background
  with gold icon or text (crown for Royal Box, "AISLE" text for aisle seats).

All badges/tags use the same gold-on-dark palette and share a consistent 64 × 64
canvas size with transparent outer region for clean compositing.

### UI Elements

- **Font:** Georgia, serif throughout (headings bold, body regular, rules
  italic).
- **Panels:** Dark navy rectangles (`#0F0F1C` at 95 % opacity) with gold border
  stroke (`#D4AF37`, 3 px).
- **Stage banner:** Ornate Art Deco geometric patterns in gold and dark mahogany,
  wide horizontal strip above the seating grid.
- **Player colors:** Light blue `#4FC3F7`, Red `#EF5350`, Green `#66BB6A`,
  Orange `#FFA726`.

---

## Design Principles

These guiding principles shaped the game's design and should inform future
expansions:

1. **Hindrance, not harm.** Gifted cards are a nuisance, not a knockout punch.
   They create new puzzles, not hopeless situations.
2. **Layered decisions.** The primary/trait split means every card has a dual
   identity. A "Tall Kid" isn't just a Kid-it's a blocking liability _and_ a
   capping puzzle.
3. **Scarcity creates tension.** Fewer Teachers than Kids, only 4 VIPs, limited
   aisle seats-constraints force meaningful trade-offs.
4. **Modular replayability.** Theaters × Plays = exponential variety. Each
   combination shifts the meta without changing the core rules. 8 theaters × 7
   plays = 56 unique session configurations.
5. **Constructive core.** The game feels like building something-your theater is
   a personal puzzle you're proud of-with just enough interaction to keep
   everyone engaged.
6. **Cards, not components.** New mechanics are delivered through cards (Season
   Deck), not tokens or boards. This keeps production simple and expansion easy.
7. **Universal Lobby.** The shared face-up market is always in play, ensuring
   every game has visible information, racing, and denial-regardless of Theater
   or Play card.
8. **Expansion-ready.** The Season Deck is designed for growth: new Theaters,
   new Plays, new Role cards, new Demand cards. Each addition multiplies variety
   without touching the core patron deck.
