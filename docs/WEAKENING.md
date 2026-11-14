# Reproducible axiom weakening experiments

Run the complete tour from the release directory with Node.js 20 or newer:

```sh
node demo.mjs
node demo.mjs --suite hbb1
node demo.mjs --suite hbb2 --output ./weakening-results
node demo.mjs --suite hbb3
```

The tour is dependency free. Its default `all` suite checks 37 cases across HBB1, HBB2 and HBB3, the three canonical correctness claims in every case, and two separately classified diagnostic probes of incorrect paper axioms. All 45 model/counterexample certificates are independently replayed. `--suite hbb1`, `--suite hbb2` and `--suite hbb3` run 13, 10 and 14 cases respectively. The HBB2-only suite retains its ten original controls/variants and twelve certificates. The exit status is zero only when every expected result, complete retained-theory check, scenario check and replay succeeds. An unexpected result, incomplete check or replay failure produces a nonzero exit status.

`--output` saves a readable `REPORT.md`, the checked matrix in `report.json`, each full experiment in `CASE_ID/run.json`, and separate `*.evidence.json` and `*.replay.json` files for each consistent model and each failed claim. A previously executed report and all 45 evidence certificates are included in [reports/weakening-tour](../reports/weakening-tour/REPORT.md). The [suite registry](../examples/experiment-suites.json) selects the expectation files: [HBB1](../examples/hbb1-cases.json), [HBB2](../examples/weakening-cases.json), and [HBB3](../examples/hbb3-cases.json). A rerun can save a new set of checked results in your chosen directory.

The programmatic entry point is:

```js
import {runWeakeningTour} from './demo.mjs';
const report = await runWeakeningTour({suite:'hbb1',outputDirectory:'./weakening-results'});
```

Omit `outputDirectory` for a read-only run. Omit `suite`, or use `suite:'all'`, for all three protocols. Per-case `maxCompilationNodes` entries raise the allowance for the larger fixed-history examples; the default per-experiment/replay time budget is 60 seconds. Each returned case records all retained and dropped axiom names, the three claim outcomes, whether each scenario occurs, the exact original rules that fail in the supplied interpretation, and every replay result. The API throws when a check fails. `maxMilliseconds` sets the budget for each individual experiment or replay, not a new history-search bound.

The remainder of this guide details the HBB2 subset. See [HBB1_EXAMPLES.md](HBB1_EXAMPLES.md) and [HBB3_EXAMPLES.md](HBB3_EXAMPLES.md) for their own checked matrices, and [PAPER_MAP.md](PAPER_MAP.md) for every rule and claim source.

## HBB2 expected results

Every consistent row retains the **complete dynamic ThyLive theory**, including LiveAlways, LiveSeq and both Knowledge schemes. “Present” means that the complete scenario supplied by `correctnessProperties('ThyHBB2')` occurs. “Absent” identifies a vacuous true conditional in this history.

| Change and source | Retained assumptions | Liveness 1 | Liveness 2 | Agreement |
|---|---|---|---|---|
| [Completed baseline](../examples/theories/hbb2.md) | Full ThyHBB2 | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| [Remove EchoNE](../examples/theories/echo-ne.md) | ThyHBB2 minus EchoNE, plus NoLive | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| [Restrict EchoNE to live participants](../examples/theories/echo-ne-live-only.md) | Edited EchoNE, every other rule, NoLive | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| [Remove Echo!](../examples/theories/echo-progress.md) | ThyHBB2 minus Echo! | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| [Remove Vote!](../examples/theories/vote-progress.md) | ThyHBB2 minus Vote! | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| [Remove Deliver!](../examples/theories/deliver-progress.md) | ThyHBB2 minus Deliver! | **Fails; scenario present** | **Fails; scenario present** | Holds; scenario present |

The four original full-axiom controls use `echo-ne.md`, `echo-progress.md`, `vote-progress.md` and `deliver-progress.md` without an omission. Each gives **no model on that exact fixed history**, with every property **not tested**. No model is a consistency result, not a proof of any correctness claim. The completed baseline confirms that the original theory also has a consistent model exercising all three scenarios.

“Holds” in this tour means no counterexample among the predicate interpretations of the exact declared finite history, value domain and quorum basis, with supplied positive facts pinned. The tour does not search arbitrary history extensions and does not prove an unbounded theorem. A countermodel shows that the edited assumption set permits the exhibited bad behavior. It does not show that every other weakening, or every alternative assumption set, has the same consequence.

## What the witnesses show

**EchoNE.** The singleton participant is sequential and proposes, echoes, votes for and delivers both red and blue. The additional closed axiom `NoLive: not live` fixes every possible world as non-live, so the forward progress implications do not force additional events. ThyLive allows a non-live participant to remain sequential. The original EchoNE excludes the second echo. Removing it admits two conflicting deliveries despite the sequential quorum-intersection premise. Replacing its formula by

```text
forall v,w. live -> echo(v) -> past echo(w) -> v=w
```

also admits the same exact history. This makes the prohibition conditional on liveness, while Agreement's stated sequentiality premise still applies. Every other axiom and NoLive are identical in the two sources. The failed Agreement binding is `a=b=l=m=red`, `v=red`, `w=blue` at participant p, end of time. Its premise and delivery trigger are both true; `red=blue` is false. Both liveness scenarios are absent, including their live-quorum premise.

**Echo!.** A live singleton p proposes v and records a final silent observation, but never echoes. Its sole quorum is {p}. The proposal is unique, a live quorum exists, and p knows that a live participant observed the proposal. Liveness 1 fails at p with `l=v`, `v=v`, because no delivery occurs. In the supplied interpretation the full theory fails exactly Echo!; all other rules, including every ThyLive instance, pass.

**Vote!.** The same live singleton proposes and echoes v, then records its observation without voting. Liveness 1 again fails at p with `l=v`, `v=v`. The supplied interpretation fails exactly Vote! before omission. Liveness 2 and Agreement have no delivery scenario in either singleton progress example.

**Deliver!.** Both p and q are live. The only declared quorum basis is {p}. A strict global chain contains these tuples:

1. p proposes v.
2. p echoes v, then q echoes v.
3. p votes `(v,v)`, then q votes `(v,v)`.
4. p delivers `(v,v,v)`.
5. p records a silent observation, then q records a silent observation.

Both silent observations contain every real event, satisfying the complete Knowledge schemes. Participant q knows of the unique proposal and of p's delivery but never delivers. Both liveness claims fail at q with every learner/value parameter equal to v, while q is live. Their quorum premises and proposal/delivery triggers are true at that same world. Agreement's scenario is present and its claim holds. The supplied interpretation fails exactly Deliver! before omission.

## Exact claims and non-vacuity

The executable claims are the full closed conditional formulas from Figure 10 (p. 50) and Theorem 7.1.3 (p. 51), of the supplied draft dated 7 November 2026. The tour compares their parsed syntax to `correctnessProperties('ThyHBB2')`; it never substitutes an unconditional delivery assertion.

```text
Liveness 1:
forall l,v. ((box[l] live) & (exists1 w. dia[] past propose(w))) ->
  (dia[] past (live & dia[] past propose(v)) -> live -> sometime deliver(l,l,v))

Liveness 2:
forall a,b,l,v. ((dia[a,b] true) & (box[b] live)) ->
  (dia[] past deliver(a,l,v) -> live -> sometime deliver(b,l,v))

Agreement:
forall a,b,l,m,v,w. ((dia[l,m] seq)) ->
  ((dia[] past deliver(a,l,v)) & (dia[] past deliver(b,m,w)) -> v=w)
```

All claims have end-of-time scope, checked at every participant with current event †. Every protocol axiom has all-world scope, including real-event worlds and silent worlds. Events remain fixed by the input history; facts describe predicate interpretations.

For each false claim, the tour extracts an actual value binding at its recorded failure world and separately checks **premise=true, trigger=true, conclusion=false**. For a failed liveness claim it also checks that the affected participant is live. These grounded checks are saved alongside a bounded explanation tree. The explanation tree is supplementary; the complete direct evaluation and independent evidence replay establish the truth values even if an explanation branch is truncated. Scenario results also appear for claims that hold, so vacuous success is visible.

## Reproduce an individual case

In the browser choose the matching example and **Use this history; find facts**. Removal examples now start with the named rule already omitted, so their first run demonstrates the titled weakening. **Keep all axioms** restores the full-theory comparison; when that fixed history cannot satisfy the full rules, the result is **No model** and every claim is **Not tested**. **Use example defaults** restores the preset omission. For the live-only EchoNE example, the source formula itself is already edited, so its default keeps every displayed assumption checked. Keep ThyLive selected in all experiments.

The source Markdown remains a complete editable theory. Importing it directly or invoking the generic CLI does not apply chooser presets: retain all source declarations for the control, or supply the named `--drop` flag for the weakening. Every saved run and evidence certificate records the actual retained and omitted rules.

The CLI uses exact axiom names:

```sh
node src/cli.mjs run examples/theories/echo-ne.md --drop EchoNE --evidence ./echo-results
node src/cli.mjs run examples/theories/echo-progress.md --drop 'Echo!' --evidence ./echo-progress-results
node src/cli.mjs run examples/theories/vote-progress.md --drop 'Vote!' --evidence ./vote-progress-results
node src/cli.mjs run examples/theories/deliver-progress.md --drop 'Deliver!' --evidence ./deliver-progress-results
node src/cli.mjs run examples/theories/echo-ne-live-only.md --evidence ./echo-live-results
```

These successful counterexample runs intentionally use CLI exit status **1**. A complete no-model control uses status **3**. `node demo.mjs` treats these expected logical outcomes as a passed demonstration and exits **0** after verification. Use `node src/cli.mjs --help` for all CLI outcome codes.

Replay a tour certificate in a fresh process:

```sh
node src/cli.mjs replay ./weakening-results/deliver-progress-removed/liveness-2.evidence.json
```

Replay reparses the saved source and recorded omissions, reconstructs the model and finite ThyLive reduction, checks every retained axiom, and checks the false property at its saved failure context. It does not accept cached success fields as proof. The HBB2 regression independently invokes this CLI replay on its twelve certificates; the combined tour replays all 45 certificates through the same interpreter.
