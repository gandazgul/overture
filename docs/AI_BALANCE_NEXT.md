# Next First-Player Balance Experiments

**Release decision (after confirmation):** The user accepted the fresh 100K result
and approved promotion. Live **2-player** games now use VP, most Noisy, then later
original player. Three- and four-player games retain diversity. The historical
experiment descriptions below record the rules at the time each run occurred.
`src/winner.js` now keeps the game and both simulators consistent; the explicit
`diversity-later` experiment option preserves the old 2P control.

Promotion verification: all 187 tests and the production build pass. The shared
live resolver exactly matches all 100,000 archived confirmation game summaries,
and its historical override reproduces the 50,969-win control. A production-browser
smoke test confirms a tied 2P game announces Player 2 and awards only Player 2 a
trophy. A worker smoke run confirms snapshots include the new shared module.

## Promotion

The user approved promoting blind-first on 2026-09-20. Live 2P Hard and the
standard simulator now use it by default. The conditions are unchanged from the
validated candidate: one card in hand, at least two deck cards, and a 2P Hard
exploitation decision. The next draw is evaluated normally. Easy/Medium,
3P/4P, legal draw rules, fixed turn order, and all live tiebreaks are unchanged.

`AIConfig.playerCount` is supplied by GameScene and the simulator, not inferred
from hand size. `blindFirst: false` retains a control for future experiments.
The experiment CLI supports that override independently for each policy.

Promotion verification: `deno task ci` passed all 179 tests, and the production
build passed (existing Phaser chunk-size warning). Exact draw/placement traces
and full game results matched the frozen pre-promotion runtime plus its tested
wrapper in 48 comparisons: all eight layouts, 2P Hard with fixed/rotating order,
3P/4P Hard, and 2P Easy/Medium. These checks establish implementation parity,
not new strength or balance evidence on unmeasured layouts.

## Tested Candidate: Earlier Later-Player Tiebreak

Keep fixed turn order and random openings. Test this winner order:

1. Highest VP.
2. Most Noisy patrons.
3. Later original player index.

This removes only the diversity tiebreak, putting the existing later-player
compensation one step earlier. It preserves Noisy as a meaningful tiebreak.
It was simulator-only during testing and was promoted to live 2P after confirmation.

Rescoring the saved 50,000-game blind-first fixed-order run gives:

| Winner rule                           | P1 wins | Exploratory 95% Wilson interval |
| ------------------------------------- | ------: | ------------------------------- |
| Existing rules                        | 51.264% | 50.826-51.702%                  |
| VP, Noisy, later player               | 50.066% | 49.628-50.504%                  |
| All VP ties awarded to P2             | 48.762% | 48.324-49.200%                  |
| P2 receives +1 VP, existing tiebreaks | 45.076% | 44.640-45.512%                  |

The proposed rule changes 599 P1 wins to P2 wins in that archive. Giving P2 every
VP tie or a whole bonus point appears too strong, so those are lower priorities.
With rotating order, the proposed Noisy-then-later rule instead gives P1 49.496%
(49.058-49.934%): the fixed-order variant is the cleaner first candidate.

These are **post-hoc, same-trajectory rescoring results**, not fresh confirmation.
Hard's current decisions do not inspect winner tiebreak rules, so replay is useful
for screening these alternatives. It does not establish behavior for players who
adapt to the new tiebreak, and selection among alternatives makes independent
confirmation important. Intervals are pointwise, not simultaneous guarantees.

Source archives under `sim-results/`:

- Fixed: `experiment_2026-09-20T05-55-00-757Z_83bc9132/samples.jsonl`
- Rotating: `experiment_2026-09-20T06-13-40-004Z_77e68208/samples.jsonl`

## Fresh 100,000-Game Confirmation

Prespecified on 2026-09-20, before running any confirmation outcomes:

- 100,000 games, seeds 20,000,001 through 20,100,000, without early stopping.
- Grand Empress, two promoted Hard players, epsilon 0, random openings, fixed order.
- Primary rule: VP, Noisy, later original player (`--tiebreak noisy-later`).
- Pass only if the entire 95% P1-win interval is inside 49-51% **and** the entire
  mean P1-minus-P2 VP interval is inside -0.5 to +0.5 VP.
- Secondary descriptive control: rescore the same completed games with the live
  diversity tiebreak. The frozen AI does not use these winner rules in decisions.
- No AI tuning, live-rule changes, or expansion of the sample after seeing results.

```sh
deno run -A src/simulator/experiment-cli.js --mode balance --samples 100000 --seed 20000001 --workers 12 --layout grand-empress --opening random --turn-order fixed --tiebreak noisy-later --win-tolerance 0.01 --score-tolerance 0.5
```

### Results: Passed Both Prespecified Targets

All 100,000 games completed in 1,072 seconds (17.9 minutes), without early stopping
or extending the sample. The promoted AI ran with its native defaults, not the
historical blind-first wrapper.

| Measure                                  | Estimate | 95% interval         | Target                                        |
| ---------------------------------------- | -------: | -------------------- | --------------------------------------------- |
| P1 wins, proposed rule                   |  49.795% | 49.485-50.105%       | Entire interval inside 49-51%: **pass**       |
| P1-minus-P2 VP                           | +0.26520 | +0.22502 to +0.30538 | Entire interval inside -0.5 to +0.5: **pass** |
| P1 wins, live-rule rescoring (secondary) |  50.969% | 50.659-51.279%       | Does not fit inside 49-51%                    |

Proposed-rule wins: **P1 49,795; P2 50,205**. Of 6,103 raw VP ties, 3,469 reached
the later-player rule after Noisy. Skipping diversity transferred 1,174 wins from
P1 to P2 compared with live-rule rescoring: a matched change of **-1.174 percentage
points**, with a 95% Wilson-derived interval of -1.243 to -1.109 points. This
secondary comparison uses the same trajectories, not another independent run.

This confirms practical awarded-win balance under the declared tolerance for
**2P promoted Hard self-play on Grand Empress, random openings, fixed order**.
The win interval includes 50%, but that is not proof of exactly zero advantage.
P1 retains a small, statistically detectable VP edge; the tiebreak compensates for
it rather than changing score production. Other layouts, 3P/4P, different policies,
and humans adapting to the rule remain unvalidated. Live rules were unchanged
during the run; the later promotion is recorded at the top of this document.

Run directory: `sim-results/experiment_2026-09-20T13-08-34-535Z_54f1bb3b/`.

- `manifest.json` records settings and thresholds before outcomes.
- `source/` contains eight hashed runtime files; promoted AI SHA-256:
  `d379c2d1c758eda7dc0755be83542cd8a294de519a7ca9619b1366564473e284`.
- `samples.jsonl` and `report.json` preserve all seed-level outcomes and the summary.
- `audit.js` and `audit.json` reproduce the independent winner/interval checks and
  live-rule rescoring. All 100,000 expected unique seeds, all eight source hashes,
  every winner/tie flag, and the complete summary were verified. The fresh seed
  range was checked against 98 prior recorded ranges without overlap.

```sh
deno run -A sim-results/experiment_2026-09-20T13-08-34-535Z_54f1bb3b/audit.js
```

Implementation verification: all 181 tests pass, including a known development
seed where removing diversity changes the winner but leaves game outcomes
otherwise identical in both balance and comparison modes. The new option is
`--tiebreak live|noisy-later`, defaults to live, and exists only in the experiment
runner. No game-scene, AI, scoring, or rulebook changes were needed for this run.

## Other Candidates

- **Opening Lobby access:** P1's first turn takes both draws blind; P2 gets the
  first chance to choose from the Lobby. All later turns are normal. This targets
  the shared resource directly; theaters remain personal. It needs new simulation
  because decisions and card allocations change, and may overcompensate.
- **Patron/Friends opening:** Retest the user's existing P1 Patron / P2 Friends
  idea using the promoted AI. Screen random versus fixed openings and fixed
  versus rotating order as a 2-by-2 experiment, keeping all other rules fixed.
  Do not assume the earlier, weaker policy's results transfer.
- **AI-bias control:** Independently test opponent-specific remaining-turn
  estimates. Current denial evaluation uses the acting player's horizon for
  opponents too; on P2's final turn P1 has already finished. Charging a denial
  cost for that player could create policy-specific bias. This is an AI
  hypothesis to test separately, not evidence that it explains the whole edge.

## Confirmation Protocol

1. Freeze the promoted policy and rules for the control and each variant. Use
   matching seed sets to compare rule effects; analyze per-seed differences,
   not overlapping confidence intervals from separate summaries.
2. First confirm the fixed-order Noisy-then-later tiebreak on **100,000 fresh
   game seeds**, with sample count chosen before outcomes. Keep the previous
   acceptance criterion: the entire 95% P1-win interval within 49-51% and the
   entire mean VP-margin interval within -0.5 to +0.5 VP. Rescoring never changes
   the raw VP margin for the tiebreak-only proposal.
3. Validate other layouts and then 3P/4P independently. Equal-share win rates are
   1/3 and 1/4 there, not 50%; examine every original seat. The existing paired
   experiment runner is 2P-only, so multiplayer needs seat-level reporting.
4. Check against additional policies and human games before treating it as a
   general game-balance solution. Keep the unsuccessful configurations in the
   report and do not stop early or keep extending a run until a target passes.

Fresh held-out confirmation follows the distinction between exploratory and
prespecified comparisons in [NIST's multiple-comparison guidance](https://www.itl.nist.gov/div898/handbook/prc/section4/prc47.htm).
More samples can narrow uncertainty; they cannot eliminate a real advantage or
prove exactly zero advantage.
