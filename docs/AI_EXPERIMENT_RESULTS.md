# AI Experiments: 2026-09-20

**Subsequent promotion:** After this experiment report, the user approved promoting
blind-first into live 2P Hard on 2026-09-20. The results below retain their original
policy names: "current Hard" means the pre-promotion baseline, not today's live
default. The user later approved the 2P Noisy-then-later tiebreak after a separate
fresh 100K confirmation. Rotating order was not promoted. See
[confirmation and release decision](AI_BALANCE_NEXT.md).

## Outcome

**Stronger AI found; strict balance target not yet established.** The simulator-only
blind-first candidate beats current Hard on held-out comparisons under both fixed
and rotating turn order, with roughly 24% less measured decision time. None of
the three 50,000-game self-play configurations passed the prespecified 49-51%
P1 win-rate interval criterion. All passed the plus/minus 0.5 VP criterion.

| Policy and order      | P1 wins | 95% win interval | Mean P1-minus-P2 VP |
| --------------------- | ------: | ---------------- | ------------------: |
| Current Hard, fixed   | 50.694% | 50.256-51.132%   |            +0.19424 |
| Blind-first, fixed    | 51.264% | 50.826-51.702%   |            +0.26724 |
| Blind-first, rotating | 50.648% | 50.210-51.086%   |            +0.20014 |

The rotating candidate's measured P1 advantage is small, with an upper 95%
interval endpoint about 1.09 percentage points above 50%, but it is not zero and
has not been bounded below the stricter one-point target. These are conditional
simulation results, not proof about optimal players or all layouts. Experimental
AI and rule changes had **not** been promoted when these experiments concluded.

## Scope and Acceptance Rules

Primary tests use Grand Empress, two deterministic Hard players, random opening
cards, fixed turn order, and the live Noisy/diversity/later-player tiebreaks.
These results cannot establish optimal play, human balance, or balance on every
layout and player count.

- Strength: 5,000 independent seeds, each played twice with policies swapping
  positions. Success requires the candidate's seed-pair 95% win interval above 50%.
- Balance: 50,000 independent self-play games. Both 95% intervals must be entirely
  within 49-51% P1 wins and -0.5 to +0.5 mean P1-minus-P2 VP.
- These sample sizes and tolerances were declared before the confirmatory runs.
  An interval overlapping neutrality is not sufficient evidence of equivalence.
- Intervals are pointwise 95% intervals, not a simultaneous confidence guarantee
  across every configuration and metric in this report.
- Development used separate seeds. Only the selected blind-first candidate was
  submitted to the new-policy confirmatory test. All development results appear
  below, including unsuccessful variants.

The runner, commands, interval methods, and isolation guarantees are documented
in [AI_EXPERIMENTS.md](AI_EXPERIMENTS.md). Reports and source snapshots live under
`sim-results/`, which is intentionally ignored by Git and formatting tools.

## Confirmatory Results

### Current Hard Versus Historical Hard

Seeds 3000001-3005000, 5,000 swapped-position pairs, historical baseline `a53fc75`:

| Measure               | Estimate | 95% seed-pair interval |
| --------------------- | -------: | ---------------------- |
| Current Hard win rate |   49.87% | 49.44-50.30%           |
| Current-minus-old VP  |  +0.0189 | -0.0160 to +0.0538     |

**No demonstrated strength improvement.** Correctness fixes and removing known
search omissions do not automatically make a heuristic stronger. Current Hard
used 1,203.98 seconds of measured decision time versus 3,097.86 seconds for old
Hard (2.57x faster in this matchup). This includes all workers and is not elapsed
wall time; concurrent jobs and different board trajectories affect timing.

Report: `experiment_2026-09-20T05-41-06-618Z_80b93a5b/report.json`.

### Blind-First Versus Current Hard

Held-out seeds 6000001-6005000, 5,000 swapped-position pairs:

| Measure                      | Estimate | 95% seed-pair interval |
| ---------------------------- | -------: | ---------------------- |
| Blind-first win rate         |   52.29% | 51.65-52.93%           |
| Blind-first-minus-current VP |  +0.3682 | +0.3014 to +0.4350     |

**Passed the prespecified strength criterion.** The candidate won 52.40% as P1
and 52.18% as P2, so its combined improvement is not just a favorable assignment
to the first seat. Position-specific rates are descriptive, not separate
confirmatory tests. Total measured decision time was 1,035.18 seconds versus
1,354.13 seconds for current Hard: 23.6% less in this matchup.

This establishes improvement against this baseline on this layout, not perfect
play or universal superiority. Blind-first was simulator-only for these runs;
its later promotion was explicitly approved by the user.

Report: `experiment_2026-09-20T05-54-59-594Z_5adcd40b/report.json`.

### Current Hard Self-Play Balance

Seeds 4000001-4050000, 50,000 games:

| Measure         | Estimate | 95% interval         | Prespecified criterion |
| --------------- | -------: | -------------------- | ---------------------- |
| P1 awarded wins |  50.694% | 50.256-51.132%       | 49-51%: **not met**    |
| P1-minus-P2 VP  | +0.19424 | +0.13717 to +0.25131 | -0.5 to +0.5: met      |

There is evidence of a **small P1 advantage**, not zero advantage. The point
estimate is +0.694 percentage points above 50%, but the upper confidence bound
exceeds the one-percentage-point target. Do not relabel this a pass or widen the
target after observing the result. There were 3,061 raw VP ties and 597 games
decided by the final later-player tiebreak.

The later-player rule is doing useful compensation here: splitting those 597
final ties as half a win per player would give P1 a 51.291% win share on the same
trajectories, versus the actual 50.694%. Awarding them to P2 reduces P1's share by
0.597 percentage points. This is a post-hoc accounting comparison, not a separate
strategy test with different tiebreak-aware policies.

Report: `experiment_2026-09-20T05-41-05-405Z_f4cfd329/report.json`.

### Blind-First Self-Play Balance

Seeds 7000001-7050000, 50,000 games, fixed turn order:

| Measure         | Estimate | 95% interval         | Prespecified criterion |
| --------------- | -------: | -------------------- | ---------------------- |
| P1 awarded wins |  51.264% | 50.826-51.702%       | 49-51%: **not met**    |
| P1-minus-P2 VP  | +0.26724 | +0.21042 to +0.32406 | -0.5 to +0.5: met      |

The stronger policy does **not** establish practical balance under fixed turn
order. Its score advantage is small, but its P1 win interval fails the declared
target. There were 3,039 raw VP ties and 565 final later-player tiebreaks.

The current and blind-first balance runs use different seed sets. Do not infer a
statistically established change in bias merely from their point estimates;
neither passed the prescribed win-rate criterion.

Report: `experiment_2026-09-20T05-55-00-757Z_83bc9132/report.json`.

### Rotating-Starter Follow-Up

After the fixed-order balance failures, a new test was prescribed: 50,000
blind-first self-play games, seeds 11000001-11050000, random openings, rotating
starter, and unchanged original-player-index tiebreaks. The same 49-51% and
plus/minus 0.5 VP acceptance bands apply. This tests the user's proposed rule
compensation, not a retest or extension of the failed fixed-order configuration.

The completed self-play run returned P1 wins of **50.648%**, Wilson 95% interval
**50.210-51.086%**, and a mean VP margin of **+0.20014** (95% interval +0.14335 to
+0.25693). The VP criterion passed; the win-rate criterion **did not pass**.
There were 2,954 raw VP ties and 608 final later-player tiebreaks. Original P1
remains the reporting identity even though each player starts six rounds.

Report: `experiment_2026-09-20T06-13-40-004Z_77e68208/report.json`.

The lower point estimate versus blind-first with fixed order does not itself
prove a reduction in bias. These are independent seed sets, not a paired
rule-effect experiment. Do not widen the acceptance target or claim zero bias
because this result narrowly misses the target. A larger, separately planned
confirmation could resolve whether the true edge is below one percentage point.

A separate strength check uses 2,000 fresh swapped-position pairs, seeds
12000001-12002000, with rotating order for **both** policies, random openings,
and unchanged tiebreaks. Its criterion remains a paired 95% win interval above
50%. The earlier fixed-order strength result is not assumed to transfer to a
different rule configuration.

The rotating-order strength check **passed**: blind-first won 51.35%, with a
paired 95% interval of 50.30-52.40%, and gained +0.27425 VP per game (95% interval
+0.16779 to +0.38071). It used 24.6% less measured decision time in this matchup.
Report: `experiment_2026-09-20T06-15-18-293Z_33b13e96/report.json`.

## Development Screening

Each row is 500 seed pairs (1,000 games), seeds 5000001-5000500, against the same
frozen current Hard. Intervals are exploratory and unadjusted for selecting among
multiple candidates. Defaults are potential scale 1 and future weight 0.8.

| Potential | Future | Blind first | Candidate wins | 95% paired win interval | Mean candidate VP margin |
| --------: | -----: | :---------: | -------------: | ----------------------- | -----------------------: |
|         0 |    0.8 |     No      |          43.4% | 41.19-45.61%            |                   -1.230 |
|         1 |      1 |     No      |          47.4% | 45.25-49.55%            |                   -0.741 |
|         0 |      1 |     No      |          41.9% | 39.45-44.35%            |                   -1.653 |
|         1 |    0.5 |     No      |          50.4% | 48.58-52.22%            |                   +0.035 |
|       1.5 |    0.8 |     No      |          42.0% | 39.65-44.35%            |                   -1.215 |
|       1.5 |    0.5 |     No      |          41.8% | 39.46-44.14%            |                   -1.144 |
|         1 |    0.8 |     Yes     |          51.9% | 49.77-54.03%            |                   +0.309 |

No weight-only change established improvement. Blind-first had a positive
screening VP interval (+0.100 to +0.518), but its win interval still included 50%.
It was selected for held-out validation, not declared stronger from this screen.

Blind-first is a 2P-only experiment: draw blind from a deck with at least two
cards while holding one card, then make the second draw decision with the revealed
card in hand. This preserves the opportunity to select a complementary Lobby
card. It does not inspect hidden cards or change legal draws. No live game imports
the experimental strategy wrapper.

Development run directories, in table order, under `sim-results/`:

1. `experiment_2026-09-20T05-46-23-609Z_ffe8839d`
2. `experiment_2026-09-20T05-46-24-768Z_08e8b3ee`
3. `experiment_2026-09-20T05-46-25-941Z_9865761c`
4. `experiment_2026-09-20T05-50-03-306Z_21721254`
5. `experiment_2026-09-20T05-50-04-474Z_a6cd054e`
6. `experiment_2026-09-20T05-50-05-648Z_dbde37cb`
7. `experiment_2026-09-20T05-53-40-478Z_75a1471b`

## Multiplayer Pilots

These use unmodified current Hard, not blind-first. There are only 1,000 games per
player count, so the intervals are too wide to establish negligible imbalance.

| Players | Seat win rates             | P1 95% Wilson interval | Equal-share win rate | Seed     |
| ------: | -------------------------- | ---------------------- | -------------------- | -------- |
|       3 | 35.9%, 33.8%, 30.3%        | 32.99-38.92%           | 33.33%               | 9000001  |
|       4 | 27.6%, 24.1%, 23.5%, 24.8% | 24.92-30.45%           | 25%                  | 10000001 |

Both point estimates favor P1, but both P1 intervals include the equal-share
rate. Neither pilot rules out a meaningful advantage. Reports are
`run_2026-09-20T05-52-19-997Z.json` and `run_2026-09-20T05-52-43-363Z.json`.

## Reproducibility Checks

- Identical-policy swapped pairs yield identical games, exactly 50% candidate
  wins, and zero paired VP margin.
- Explicit default tuning produces the same decisions as omitted settings.
- Candidate-only options do not reach the baseline strategy.
- Four identical seed pairs run with one and three workers produced identical
  per-seed scores, tiebreak data, and winners. Timing is deliberately excluded.
- The runner saves the entire relevant pure runtime, source hashes, seed-level
  results, and a manifest written before outcomes. Concurrent source edits cannot
  change a running experiment.
- All six confirmatory/follow-up reports were independently re-aggregated from
  their raw JSONL data; summaries, full unique seed coverage, and all frozen
  source hashes matched exactly.

## Verification and Next Gate

`deno task ci` passed: type checks, formatting, lint, and 176 tests. The production
build passed with the existing large-Phaser-chunk warning. The final runner also
reproduced four recorded held-out pairs exactly after the baseline-option support
was added. There were 183,000 substantive simulation games, plus 216 smoke and
worker-consistency games; correctness tests are separate.

No promotion or commit was made by this experiment. Before promotion, validate
other layouts, run adequately powered 3P/4P balance tests, and decide whether the
remaining roughly one-percentage-point bound is acceptable or needs a tighter,
new confirmatory experiment. Keep failed results in view rather than treating
the best observed configuration as proof of perfect balance.
