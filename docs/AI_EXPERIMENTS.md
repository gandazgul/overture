# AI and Balance Experiments

See [the 2026-09-20 experiment report](AI_EXPERIMENT_RESULTS.md) for the paired
strength tests, practical-balance checks, and unsuccessful tuning experiments.
The subsequent [fresh 100,000-game tiebreak confirmation](AI_BALANCE_NEXT.md#fresh-100000-game-confirmation)
passed the declared 2P Grand Empress balance targets. The user subsequently approved
the Noisy-then-later tiebreak for live 2P games; 3P/4P retain diversity.

## Current Behavior

As of the user-approved 2026-09-20 promotion, 2P Hard draws blind first when it
has one card in hand and the deck has at least two cards. The second draw uses
normal evaluation with that card now known. Live and simulator callers provide
explicit `AIConfig.playerCount`. This does not change Easy/Medium, 3P/4P Hard,
turn order or scoring. The later 2P tiebreak promotion is separate from the AI change. Explicit epsilon exploration still takes
precedence. See [next balance experiments](AI_BALANCE_NEXT.md).

Hard is a deterministic one-card-lookahead heuristic, not a solved-game player.
It evaluates every possible first seat. Scores combine immediate VP, a discounted
future placement, and fixed combo estimates. On the last placement, it uses actual
VP only. The live scene and simulator both supply the remaining turn count.

Two-card scores are cached within a decision and reused in both play orders. The
cache is discarded before the board changes. House-rule layouts use the full
scoring engine; other layouts use the tested incremental scorer. The exhaustive
reference tests cover every layout, duplicate cards, and board restoration.

Run correctness tests separately from large balance samples:

```sh
deno test src/ai.test.js src/scoring.test.js src/simulator/simulator.test.js
deno bench src/simulator/simulator.bench.js
```

## Test First-Player Advantage

Start with two identical Hard policies, random openings, and fixed turn order.
This is the live-game baseline. Every player owns a separate theater; any advantage
must come from shared-card access, turn timing, or tiebreakers, not occupied seats
on another player's board.

```sh
deno run -A src/simulator/cli.js --games 10000 --players 2 --seed 900001 --concurrency 4 --opening random --turn-order fixed
```

Test each proposed compensation independently, then together:

```sh
deno run -A src/simulator/cli.js --games 10000 --players 2 --seed 900001 --concurrency 4 --opening fixed --turn-order fixed
deno run -A src/simulator/cli.js --games 10000 --players 2 --seed 900001 --concurrency 4 --opening random --turn-order rotating
deno run -A src/simulator/cli.js --games 10000 --players 2 --seed 900001 --concurrency 4 --opening fixed --turn-order rotating
```

- `--opening fixed` preserves the compensation experiment: P1 receives a plain
  Patron, P2 a plain Friends. Cards are removed from the shuffled deck. Friends
  starts at 3 VP; its intended compensation comes from later clustering, not a
  guaranteed 5-VP opening. Change `SIMULATOR_EXPERIMENT.fixedStartingCards` to try
  another fixed assignment. This option requires two players.
- `--turn-order rotating` rotates the starter each round, including in 2P games.
  Live play retains fixed order. In rotating reports, P1 means original Player 1,
  not whoever starts a particular round.
- `--epsilon 0` is deterministic Hard; `--epsilon 1` forces random decisions.
  Intermediate values test robustness to mistakes without editing the live AI.
- Final ties follow live play: most Noisy, then most distinct patron types in
  **3P/4P only**, then latest original player index. Two-player games skip diversity.
  The last tiebreaker stays tied to original player
  order even in the rotating-starter experiment.

Reports are written to `sim-results/`. They include:

- P1 awarded-win rate and a 95% Wilson interval.
- Mean P1-minus-P2 VP and an approximate 95% normal interval.
- VP ties before tiebreakers, and wins decided by the final later-player rule.
- Opening, turn-order, epsilon, seed, layout, and other run settings.

A win-rate interval entirely above 50% is evidence of a P1 win advantage **for
that AI and configuration**. A score-margin interval entirely above zero indicates
a scoring advantage. Read both: the later-player tiebreaker can offset an otherwise
small scoring edge. An interval containing the neutral value is inconclusive,
not proof of perfect balance. The normal score interval needs a substantial sample;
use small runs only as smoke tests. The Wilson calculation follows the
[NIST confidence-interval reference](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm).

At 10,000 independent games, a near-50% win rate has roughly a one-percentage-point
95% margin. Choose the sample size before inspecting the results; do not stop
as soon as a favored result becomes significant. Confirm promising settings with
new seeds, other layouts, different AI policies, and human games. Two-player
findings do not establish three- or four-player balance.

Each game's seed is `baseSeed + gameIndex`, independent of worker count. The deck
is shuffled before a separate exploration seed is installed. Identical run settings
produce the same aggregates regardless of concurrency. Same seeds across variants
start with the same shuffled decks, but different picks change which cards are
revealed; fixed openings also remove different cards. These are not identical
information histories. Cross-variant confidence intervals are not paired-effect
intervals.

## Isolate Strategy Experiments

The simulator accepts a `strategies` array with one strategy per original player.
Each strategy exports `pickDrawAction` and `pickCardAndSeat` with the live API.
Missing entries use the live AI. Keep candidate implementations under
`src/simulator/strategies/` and pass them to `simulateGame`; do not edit `src/ai.js`
until ready to promote. The standard CLI uses live Hard for all players.

The paired runner automates baseline/candidate and candidate/baseline on each
seed, defaulting to random openings and fixed order. A sample is **two games**, but only
one independent statistical unit. Default baseline `a53fc75` is the old Hard;
both policies use the same current scoring rules and simulator.

`--opening` and `--turn-order` apply identically to both policies and both games
in every pair. This also permits strength validation under a proposed rule
variant, such as rotating order; label those results separately from live rules.

The experiment runner accepts `--tiebreak live|noisy-later|diversity-later`
(default `live`). `noisy-later` awards wins by VP, most Noisy, then later original
player, skipping diversity; this now matches live 2P rules. `diversity-later`
restores the historical 2P rule for comparisons. Overrides affect only experiment
winner summaries, not AI decisions or live rules. Raw scores, Noisy counts, and
diversity are retained for matched rescoring. The standard simulator CLI uses live
tiebreaks. Old frozen runs preserve their original meaning of `live`; check their
source snapshot and manifest rather than applying today's defaults to old reports.

```sh
deno run -A src/simulator/experiment-cli.js --mode compare --samples 5000 --seed 3000001 --workers 8 --baseline-ref a53fc75
deno run -A src/simulator/experiment-cli.js --mode balance --samples 50000 --seed 4000001 --workers 8 --win-tolerance 0.01 --score-tolerance 0.5
```

Comparison reports candidate win rate averaged across both positions and paired
VP margin. Large-sample normal 95% intervals use the variance of seed-pair means,
not the individual games. Balance reports use Wilson win intervals and normal
VP intervals over independent game seeds. Runs below 100 samples report no
interval or positive verdict. A candidate passes the strength test only when its
win interval is entirely above 50%. The paired-observation approach follows
[NIST's paired-data guidance](https://www.itl.nist.gov/div898/handbook/prc/section3/prc311.htm).
Zero-variance samples also suppress normal intervals rather than claiming exact
certainty from a finite sample.

Balance requires **both entire intervals** inside the declared bands: by default
49–51% P1 wins and -0.5 to +0.5 VP. These are practical equivalence targets, not
proof of exactly zero advantage. They apply only to the tested layout, rules,
and policies. Fix the sample count and thresholds before observing results.

Every run creates `sim-results/experiment_<timestamp>_<id>/` containing:

- `manifest.json`: settings and acceptance bands written before outcomes.
- `source/`: frozen AI, simulator, scoring, and deck/RNG modules, with SHA-256
  hashes in the manifest. Editing the workspace cannot change an active run.
- `samples.jsonl`: seed-level games with scores, tiebreak counts, winners, and
  decision timings. Arrival order depends on worker scheduling; key by seed.
- `report.json`: final summary, runtime, source provenance, and verdicts.
- `failure.json` on a failed run; incomplete runs have no final report.

The runner requests Hard with `epsilon: 0`; the built-in strategies are
deterministic. Custom strategies must honor that configuration or use the shared
seeded RNG from `utils.js`, not `Math.random()`, for reproducible experiments.
Repeating a deterministic run with a different worker count preserves game
outcomes, not wall-clock timing. Timing ratios are workload observations, not
isolated microbenchmarks.

### Candidate Tuning Without Promotion

Live defaults remain combo potential scale 1 and next-placement weight 0.8.
Override these only for the experimental candidate:

```sh
deno run -A src/simulator/experiment-cli.js --mode compare --samples 500 --seed 5000001 --baseline-file sim-results/EXISTING_RUN/source/ai.js --potential-scale 0 --future-weight 1
```

`--blind-first true` explicitly selects the now-promoted **2P Hard strategy**: with a
one-card hand and at least two cards in the deck, draw blind before evaluating
the remaining draw. This defers the Lobby decision until the new card is known.
With fewer than two deck cards it uses the normal policy, because deck exhaustion
changes Lobby legality. Current `src/ai.js` enables this by default when the
caller supplies `playerCount: 2`; GameScene and the standard simulator do so.
The experiment wrapper remains for historical snapshots that predate promotion.
`--blind-first false` disables the current policy's new default, and
`--baseline-blind-first false` does the same for a current-source baseline.
Omitting the flag uses the selected module's own default, so freeze source and
record options rather than assuming omission always means the older behavior.

```sh
deno run -A src/simulator/experiment-cli.js --mode compare --samples 5000 --seed 6000001 --baseline-file sim-results/EXISTING_RUN/source/ai.js --blind-first true
deno run -A src/simulator/experiment-cli.js --mode balance --samples 50000 --seed 7000001 --blind-first true
```

`--baseline-file` freezes an existing policy instead of reading Git. The baseline
does not receive candidate tuning. In balance mode both players receive the same
candidate settings. `--candidate FILE` accepts a standalone AI module with the
same root-relative imports as `src/ai.js` (`./scoring.js`, `./types.js`,
`./utils.js`); it is copied into that position in the snapshot. It does not bundle
arbitrary strategy dependencies. For more complex strategies, use the simulator's
in-process injection API until a snapshot dependency manifest is added.

To reproduce a previously tested **experimental** baseline, its AI file alone is
not enough: restore its recorded options with `--baseline-potential-scale`,
`--baseline-future-weight`, and/or `--baseline-blind-first`. For example, comparing
another candidate to the validated blind-first policy requires its frozen AI
file **and** `--baseline-blind-first true`. Candidate and baseline options are
recorded separately; baseline options are rejected in self-play balance mode.

The blind-first promotion was explicitly approved after the original report.
The pure AI now contains its guarded draw behavior; the browser does not import
the Deno experiment runner. Future promotions remain separate changes and should
be checked against frozen experimental decisions before replacing live Hard.

Use development seeds for screening, then **new held-out seeds** to confirm the
one selected candidate. Screening multiple settings and reporting only the best
screening interval overstates evidence. Record unsuccessful experiments too.
Keep the tested baseline snapshot: comparing only new self-play scores cannot
establish stronger play. Run a fresh balance test for a newly selected policy;
the old policy's balance result does not automatically transfer.

Shared scoring and deck definitions still live in `src/scoring.js` and
`src/types.js`. Editing those changes the game. Strategy injection isolates AI
experiments, not arbitrary scoring-rule edits. Promotion is an explicit source
change with regression tests, never a simulator setting that silently changes live play.

## Initial Measurements (2026-09-09)

Grand Empress, 2 players, updated Hard versus itself, epsilon 0, seed 900001,
2,000 games per configuration, four workers. All runs include the live
later-player final tiebreaker. P1 denotes original Player 1.

| Opening          | Starter  | P1 wins | 95% win-rate interval | Mean P1 - P2 VP | 95% VP-margin interval |
| ---------------- | -------- | ------: | --------------------- | --------------: | ---------------------- |
| Random           | Fixed    |   51.3% | 49.11% to 53.49%      |         +0.2595 | -0.0305 to +0.5495     |
| Patron / Friends | Fixed    |   48.6% | 46.41% to 50.79%      |         -0.0175 | -0.3032 to +0.2682     |
| Random           | Rotating |   49.6% | 47.41% to 51.79%      |         +0.0340 | -0.2474 to +0.3154     |

None of these runs establishes a statistically significant departure from 50%
awarded wins or zero mean VP margin. The compensation variants move the point
estimates toward P2, but this is not a paired significance test of their effect.
No three- or four-player balance conclusion was measured. Combining both
compensations was not measured here.

The three JSON run IDs in `sim-results/` are `2026-09-09T22-30-48-620Z`,
`2026-09-09T22-33-33-789Z`, and `2026-09-09T22-34-53-880Z`, in table order.
The runs had 117/132/123 VP ties, respectively; 23/23/22 games were decided by
the final later-player tiebreaker.

On this Apple M4 Pro with Deno 2.9.4, a sequential 30-game fixed-opening batch
(seeds 0 through 29, after three warmups) fell from 7.55 seconds before the fixes
to 2.89 seconds afterward, about 2.6 times faster. This measures the combined
effect of caching, forced-draw fast paths, and horizon handling, not caching in
isolation. The standalone fixed-seed benchmark measured 86.0 ms/game for Grand
Empress and 338.9 ms/game for Blackbox; house-rule scoring is still more expensive.
Large-sample runs completed around 30 games/second with four workers. Hardware,
layout, and board trajectory affect these timings.

## Making Hard Stronger

Recommended sequence, to test as candidate strategies rather than assume improves play:

1. Model remaining turns for every player, legal draw order, remembered own
   discards, and actual tiebreak outcomes. Optimize winning probability, not just
   isolated VP or a constant opponent-denial penalty.
2. Replace fixed Kid/Lovebirds potential with estimates conditioned on remaining
   cards, available combo seats, and turns left. Do not treat hidden cards as known.
3. Search complete turns, including both 2P draws, play, discard, and keep. Drawing
   blind first reveals information before spending the one Lobby pick; evaluating
   each draw independently does not account for that option value.
4. Add bounded sampled continuations, then consider information-set Monte Carlo
   tree search. Sample only hidden states consistent with the player's knowledge;
   future decisions must not receive the sampled hidden deck as visible input.
   [Cowling, Powley, and Whitehouse's ISMCTS paper](https://eprints.whiterose.ac.uk/id/eprint/75048/)
   addresses game-tree search under hidden information and uncertainty.
5. Use exact endgame search when the remaining relevant state is small and known;
   use chance-aware evaluation when draws remain hidden. Budget the search, reuse
   evaluations, and run expensive browser searches in a worker.

Perfect play means optimal decisions given available information, not predicting
the shuffled deck or winning every game. Current improvements remove verified
mistakes and search omissions; they do not prove optimal play.
