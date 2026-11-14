# HBB1 examples: safety, progress and echo choice

These thirteen manifest rows cover the first protocol, **ThyHBB1**, rather than relabelling the HBB2 theory. They exercise its `safe` predicate, the Safe biconditional, the safety conjunct of Vote?, the persistent-safety premise of Vote!, the global safety premise of Liveness 2 and the reporting-quorum premise of Agreement. They also reproduce the literal incorrect Echo! formula from the paper as an overconstraint diagnostic.

The source is Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft **2026-11-07**. Protocol axioms appear in **Figure 7, p. 41 / Definition 6.1.2**; correctness statements appear in **Figure 8, p. 41 / Theorem 6.1.6, p. 43**. These histories are pedagogical finite fixtures, not literal histories printed in the paper. The source comments immediately before every executable declaration distinguish paper axioms, deliberate modifications and scenario assumptions.

Delivery arguments have order `deliver(m,l,v)`: `m` is the reporting learner, `l` is the source/vote learner and `v` is the delivered value. The same finite value domain supplies learner parameters and protocol values, as in the model language.

## Reproduce and interpret the results

The data-driven manifest is [hbb1-cases.json](../examples/hbb1-cases.json). Every row retains the complete dynamic `include ThyLive`, including both Knowledge schemes regenerated for the given history. The three correctness properties are exactly `correctnessProperties('ThyHBB1')`, with all their premises and triggers, evaluated at the end. No experiment silently replaces these properties with unconditional conclusions or local safety assumptions.

Run the independent fixture checks with:

```sh
node --test test/hbb1-examples.test.mjs
```

Run the HBB1 tour and save its checked report, model certificates, counterexample certificates and replay results with:

```sh
node demo.mjs --suite hbb1 --output reports/hbb1-tour
```

Omit `--output` for a read-only tour. The matching JavaScript API is `runWeakeningTour({suite:'hbb1', outputDirectory:'reports/hbb1-tour'})`; `suite:'all'` checks every protocol. The tour reports **Bad Echo!** separately as a diagnostic probe, with its own replayed certificate.

The tests first audit the supplied interpretation against every declared rule, then synthesize predicate interpretations on each **fixed** history with its positive facts pinned. Every consistent row and every counterexample certificate is independently checked by `replayExperiment`. A false correctness conditional is also checked at its recorded failure world and grounded value assignment: its complete premise and trigger are true and its conclusion is false. A live participant witnesses each liveness failure.

In the browser chooser, a rule-removal example starts with its named axiom already omitted. Run **Use this history; find facts** to see that weakening’s outcome. **Keep all axioms** selects the full-theory comparison; **Use example defaults** restores the named omission. Run again after changing the selection. The current omissions are visible and are saved in the run and evidence. For changed-formula pairs, open the full and edited documents.

A plain Markdown import or CLI run uses the source’s complete declarations; specify `--drop NAME` explicitly to reproduce a preset omission. A no-model row means the retained axioms cannot be satisfied on the declared finite history, so all correctness claims remain **Not tested**. It is neither a property proof nor a counterexample. A holds row means no counterexample among the declared finite interpretations. Neither result is an unbounded proof.

For example, **HBB1: remove Echo!** starts with only Echo! omitted: Liveness 1 fails, while Liveness 2 and Agreement hold vacuously because there are no deliveries. Restoring Echo! makes the fixed history incompatible with the full theory, leaving all three properties Not tested.

In the table, **P** means the complete correctness premise and trigger occur together; **A** means that scenario is absent. **Holds / A** is therefore a vacuous conditional in this fixed example, not an exercised progress or agreement guarantee. No-model rows have no scenario report because no retained-theory model was established.

| Manifest case | Exact change or control | Liveness 1 | Liveness 2 | Agreement |
|---|---|---|---|---|
| `hbb1-complete-baseline` | Completed full HBB1 | Holds / P | Holds / P | Holds / P |
| `hbb1-echo-progress-full` | Stopped before echo; full theory | Not tested: no model | Not tested | Not tested |
| `hbb1-echo-progress-removed` | Omit only Echo! | **Fails / P** | Holds / A | Holds / A |
| `hbb1-vote-progress-full` | Stopped before vote; full theory | Not tested: no model | Not tested | Not tested |
| `hbb1-vote-progress-removed` | Omit only Vote! | **Fails / P** | Holds / A | Holds / A |
| `hbb1-deliver-progress-full` | q never delivers; full theory | Not tested: no model | Not tested | Not tested |
| `hbb1-deliver-progress-removed` | Omit only Deliver! | **Fails at q / P** | **Fails at q / P** | Holds / P |
| `hbb1-safe-full` | Stopped before vote; Safe retained | Not tested: no model | Not tested | Not tested |
| `hbb1-safe-removed` | Omit only Safe | **Fails / P** | Holds / A | Holds / A |
| `hbb1-echo-choice-correct` | Correct existential Echo!; two proposals, one echo | Holds / A | Holds / P | Holds / P |
| `hbb1-echo-choice-wrong` | Replace Echo! by the paper's incorrect universal formula | Not tested: no model | Not tested | Not tested |
| `hbb1-vote-safe-full` | Unsafe votes; full Vote? guard | Not tested: no model | Not tested | Not tested |
| `hbb1-vote-safe-omitted` | Delete only `safe(l)` from Vote? | Holds / A | Holds / A | **Fails / P** |

## Why the individual changes matter

### Forward obligations with safety exercised

[hbb1-echo-progress.md](../examples/theories/hbb1-echo-progress.md), [hbb1-vote-progress.md](../examples/theories/hbb1-vote-progress.md) and [hbb1-deliver-progress.md](../examples/theories/hbb1-deliver-progress.md) use live histories with safety pinned true at every participant and represented time. The at-most-one-proposal disjunct of Safe makes these pins consistent with the exact definition. The vote experiment therefore exercises `everytime safe(l)` rather than disabling HBB1 Vote! by choosing an unsafe interpretation.

Removing Echo! or Vote! stops the unique proposed value from reaching delivery and falsifies Liveness 1. The delivery experiment has live participants p and q, echoes and votes at both, and one delivery at p. Its reporting quorum basis is `{p}`. q observes all real events, including p's delivery, but does not deliver. With Deliver! omitted, Liveness 1 and Liveness 2 both fail at q. Liveness 2's premise is exactly global `box[] safe(l)`, representing the paper's meta-level `Valid safe(l)`, together with its other reporting and live-quorum assumptions. Agreement has a present scenario and holds because all deliveries use the same value.

The final silent tuples are observations of real events, not extra protocol messages. They allow each live participant to acquire the event knowledge required by the complete ThyLive schemes.

### Removing the Safe definition disables HBB1 progress

[hbb1-safe-removed.md](../examples/theories/hbb1-safe-removed.md) uses the same proposal/echo prefix as the vote progress case, but supplies **no positive safe facts**. In the literal interpretation, safe is false everywhere, and the only failed declared rule is Safe. Vote! holds vacuously because `everytime safe(l)` is false.

The full theory forces safe true: zero or one proposed values satisfy the first disjunct of Safe at every represented time. This enables Vote!, making the missing vote inconsistent with the full theory. Omitting only Safe admits an interpretation with false safety and missing votes, and Liveness 1 fails with its full premise and trigger true. This is a deliberate definition-removal experiment rather than one of the paper's explicitly printed incorrect axiom variants. Remark 6.2.2, p. 44 and Lemma 6.5.2, pp. 47–48 explain why this disjunct is used for Liveness 1.

### Dropping the Vote? safety conjunct loses Agreement

[hbb1-vote-safe.md](../examples/theories/hbb1-vote-safe.md) and [hbb1-vote-safe-omitted.md](../examples/theories/hbb1-vote-safe-omitted.md) share exactly the same history, quorum basis and positive facts. The changed formula is:

```text
Correct: forall l,v. vote(l,v) -> (safe(l) & box[l] past echo(v))
Edited:  forall l,v. vote(l,v) -> box[l] past echo(v)
```

This is an exploratory weakening of Figure 7 Vote?, not one of the paper's named incorrect-axiom formulas. **Safe remains intact.** Its exact truth before both proposals is materialized as positive facts; after both proposals it is false because the relevant quorum intersections are empty.

| Learner | Quorum basis | Role in the witness |
|---|---|---|
| a | `{q}` | q echoes value a; p votes for source learner a |
| b | `{r}` | r echoes value b; p votes for source learner b |
| c | `{p}` | p reports both source learners' distinct values |

The scenario-only `NoLive: not live` axiom makes the forward obligations vacuous and is retained in both documents. EchoNE holds: q echoes only a and r echoes only b. p has quorum support for both votes and both deliveries. In the correct source, the sole failed rule is Vote?, because the source learners are unsafe. The weakened source satisfies every retained rule, including Safe and all of ThyLive.

The Agreement counterexample instantiates its reporting learners as c,c: their intersection contains sequential p. It instantiates the source learners as a,b and delivered values as a,b. Thus the **actual HBB1 reporting-intersection premise is true** while the delivered values differ. This case isolates the use of Vote?'s safety conjunct and Safe in the proof of Agreement, Proposition 6.3.1, p. 45.

### The incorrect Echo! overconstrains value choice

[hbb1-echo-choice.md](../examples/theories/hbb1-echo-choice.md) has one live sequential participant, proposals a and b, only echo(a), votes for both learners with value a, and all corresponding deliveries of a. Sequential quorum intersections satisfy the second Safe disjunct. The correct Echo! allows choosing one value:

```text
forall v. (live & dia[] past propose(v)) -> exists w. sometime echo(w)
```

Remark 6.2.3(2), p. 44 instead prints the incorrect formula with an unbound `v′` in its conclusion. Definition 5.2.1(3), p. 37 universally closes open axioms, so the exact DSL translation is:

```text
forall v,w. (live & dia[] past propose(v)) -> sometime echo(w)
```

The conclusion value is independently universal. After any observed proposal, this formula demands an echo of **every domain value**, including values that might not have been proposed. In this two-proposal singleton it demands both echoes, contradicting the choice permitted by the correct rule and, if both occurred, EchoNE plus live sequentiality.

The correct fixture adds a separate all-world diagnostic property named **Bad Echo!**. Its replayable counterexample demonstrates that the precise bad formula fails in a model of the correct complete theory. This probe is not a fourth correctness theorem. [hbb1-echo-choice-wrong.md](../examples/theories/hbb1-echo-choice-wrong.md) replaces only the Echo! axiom by that formula; the fixed history then has no model, so none of the three correctness properties is tested.

The stronger EchoNE′ suggested in Remark 6.2.4, p. 45 is a valid alternative design, not an incorrect axiom. These examples do not misclassify it as a weakening or a failed correctness guarantee.

## Source map

| Executable declarations or experiment | Paper basis |
|---|---|
| Complete dynamic ThyLive | Figure 6, p. 38; Definition 5.2.4 |
| Echo?, Vote?, Deliver?, EchoNE, Safe, Echo!, Vote!, Deliver! | Figure 7, p. 41; Definition 6.1.2 |
| All three exact conditional correctness properties | Figure 8, p. 41; Theorem 6.1.6, p. 43 |
| Agreement and the safety-guard investigation | Proposition 6.3.1, p. 45 |
| Liveness 2 and global source-learner safety premise | Proposition 6.4.5, p. 47 |
| Liveness 1 | Proposition 6.5.3, p. 48 |
| Safe's unique-proposal disjunct | Remark 6.2.2, p. 44; Lemma 6.5.2, pp. 47–48 |
| Literal incorrect Echo! and implicit closure | Remark 6.2.3(2), p. 44; Definition 5.2.1(3), p. 37 |
| Stronger, valid EchoNE′ alternative | Remark 6.2.4, p. 45 |

For source-level differences between deliberate weakenings, literal paper variants and legitimate design alternatives, see [PAPER_VARIANTS.md](PAPER_VARIANTS.md).
