# Incorrect axioms, controlled weakenings and valid alternatives

This guide follows Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft **18 November 2026**, `hbb-disc(20261118-194826).pdf`. [PAPER_MAP.md](PAPER_MAP.md) gives the complete rule and correctness map. The distinction below matters when interpreting experiments: a changed formula can weaken a guarantee, strengthen assumptions, or reject legitimate runs.

## Read the experiment's obligation

Every retained axiom holds at **all possible worlds**, including hypothetical worlds. Every canonical correctness property has end-of-time scope and retains its full conditional premise. `safe`, `live` and `corr` are interpreted predicates constrained by their axioms; they are not derived facts silently supplied by the evaluator.

A counterexample needs one model satisfying the retained assumptions and falsifying the selected property. A **No model** result instead means no interpretation on that fixed history satisfies those assumptions; its properties remain **Not tested**. An overstrong incorrect axiom may reject a legitimate history without refuting a correctness theorem. Diagnostic properties deliberately test such formulas separately from Happy Termination, Cascade Termination and Agreement.

## Current protocol distinctions

HBBSafe has a `safe(l)` predicate and a three-argument delivery `deliver(reportingLearner,sourceLearner,value)`. HBBSimp uses the same delivery order without safety. HBBCorr uses `deliver(learner,value)` and interpreted correlation, with symmetric and transitive laws but no reflexivity axiom.

The Safe biconditional in HBBSafe has the whole disjunction on its right:

```text
forall l. safe(l) <->
  ((exists01 v. dia[] past propose(v)) | (forall m. dia[l,m] seq))
```

HBBSafe Vote! retains `everytime safe(l)` as a separate premise. HBBCorr Vote! and Vote'! existentially choose their output value; replacing that choice by the antecedent's value changes the theory. Vote'! keeps `everytime corr(l,m)` inside its actual-tuple guard. Correlation is not value equality and need not equal sequential quorum intersection.

Every main forward guard has outer `sometime` (`↕`). It asks for an actual local tuple where the live-and-knowledge condition holds. Because all-world validity also visits hypothetical/end worlds, dropping that guard can require actions from knowledge that was never actionable at a local tuple.

## Classification in the draft

| Source | Proposed formula or change | Status |
| --- | --- | --- |
| Remark 6.3.3(2), p. 51 | Echo! without existential value choice | **Incorrect.** Universal closure forces every domain value to be echoed after a triggering observation. |
| Remark 6.3.3(3), p. 51 | Echo! without outer ↕ on the live/knowledge guard | **Incorrect.** Hypothetical or end-only knowledge can trigger an action without an actual qualifying local tuple. |
| Remark 6.3.3(4), p. 51 | Commute existential choice and ↕ in the Echo! conclusion | Correct and equivalent; the paper prefers quantifiers outside modalities. |
| Remark 6.3.4, pp. 51–52 | Stronger EchoNE' using global past | Valid stronger design; the paper says its correctness proofs still work. |
| Remark 8.2.2(4), footnote 64, p. 62 | Operational correlated vote with current-time correlation | A permitted operational step can have a weaker precondition than the axiomatic progress guarantee; this distinction is intentional. |
| Remark 8.3.2, p. 64 | End-of-time correlation antecedent with an all-world consequent | Valid alternative to CorrPast; the two directions of comparison differ. |
| Remark 8.6.2, equation (4), p. 67 | Behavior-dependent sequential-quorum condition | Valid weaker replacement for structural 3twined. |
| Remark 8.6.3, p. 68 | AltVote? and AltVote! | Alternative theory with a weaker progress guarantee for learners lacking self-correlation. |
| Remark 8.6.4, p. 68 | Correlation equal to sequential quorum intersection | **Incorrect.** The forced relation need not be transitive and can conflict with retained CorrTran. |

## Exact formulas

The snippets use accepted ASCII input. Free value variables in the paper are implicitly universally closed; snippets write that closure explicitly. E in a Knowledge scheme is a ground event, not an arbitrary predicate.

### Correct and incorrect Echo! choice

The current rule is:

```text
forall v. sometime (live & dia[] past propose(v)) ->
  exists w. sometime echo(w)
```

The missing-existential variant from Remark 6.3.3(2) is:

```text
forall v,w. sometime (live & dia[] past propose(v)) ->
  sometime echo(w)
```

The conclusion value is independently universal. After one triggering observation, this demands an echo of every domain value, even one never proposed. The two-proposal one-choice history in [hbb1-echo-choice.md](../examples/theories/hbb1-echo-choice.md) is allowed by the correct rule and fails that diagnostic. [The replacement](../examples/theories/hbb1-echo-choice-wrong.md) rejects the same fixed history. `Bad Echo!` is a separate diagnostic property, not a fourth correctness theorem.

### Incorrect Echo! without the actual-tuple guard

Remark 6.3.3(3) gives:

```text
forall v. (live & dia[] past propose(v)) ->
  exists w. sometime echo(w)
```

At the full-history world, all actual tuples are in the current history. A participant can therefore know about a proposal there without ever having a local tuple at which it learned about it. The correct outer `sometime` excludes that end-only trigger. This is not a future-time condition: `sometime` ranges over actual local tuples anywhere in the complete run.

The [actual-observation diagnostic](../examples/theories/hbb1-echo-end-only.md) and [incorrect replacement](../examples/theories/hbb1-echo-end-only-wrong.md) separate these cases. The diagnostic false formula identifies overconstraint; it does not manufacture a failed baseline termination claim.

### Equivalent choice placement

Remark 6.3.3(4) permits:

```text
forall v. sometime (live & dia[] past propose(v)) ->
  sometime (exists w. echo(w))
```

Both the value domain and complete run are fixed when choosing a witness, so moving the existential across the `sometime` in this conclusion preserves meaning. Do not confuse this equivalent form with deleting the quantifier or deleting the antecedent's `sometime`.

### Stronger EchoNE'

Remark 6.3.4, pp. 51–52:

```text
forall v,w. echo(v) -> dia[] past echo(w) -> v=w
```

The current EchoNE uses local `past echo(w)`. The alternative also compares a known echo by another participant. In the paper's separating history, p proposes and echoes 0, then q proposes and echoes 1. Each participant locally echoes one value, so EchoNE holds; q knows p's different echo, so EchoNE' fails. This is a valid stronger assumption, not an incorrect axiom.

### End-of-time correlation persistence

Remark 8.3.2, p. 64 proposes replacing CorrPast by:

```text
forall l,m. end corr(l,m) -> corr(l,m)
```

Current CorrPast is:

```text
forall l,m. corr(l,m) -> allpast corr(l,m)
```

The alternative consults end-of-time correlation in its antecedent, while its consequent applies at every possible world. Current `allpast` only visits actual local tuples. The paper says either form works in its proofs; it does not classify one as simply stronger or weaker.

### Weaker quorum condition

Remark 8.6.2, equation (4), p. 67:

```text
forall l,m,n. box[l] seq -> dia[m,n] seq
```

This can replace `forall l,m,n. dia[l,m,n] true`. The structural 3twined condition implies it: every sequential l-quorum meets each chosen pair of quorums. The replacement can hold without triple intersection and depends on behavior, whereas 3twined depends only on quorum structure. The paper states that its proofs still work.

### Alternative voting

Remark 8.6.3, p. 68:

```text
AltVote?: forall l,v.
  vote(l,v) -> exists m. (corr(m,l) & box[m] past echo(v))

AltVote!: forall l,m,v.
  sometime (live & everytime corr(m,l) & box[m] past echo(v)) ->
    exists w. sometime vote(l,w)
```

These replace the three current voting rules **Vote?**, **Vote!** and **Vote'!** with **AltVote?** and **AltVote!**. Other assumptions, including VoteNE, remain. The alternative progress obligation depends on persistent correlation. It does not supply the current Vote! guarantee for a learner that does not correlate with itself. A failure under the alternate assumptions is not automatically a failure of the current theory's theorem.

### Incorrect correlation definition

Remark 8.6.4, p. 68:

```text
forall l,m. corr(l,m) <-> dia[l,m] seq
```

This is offered as a tempting replacement of CorrSeq and CorrPast, then rejected. The current theory requires only the forward implication from correlation to sequential intersection. The converse can force a nontransitive relation (Remark 8.1.1(2), p. 61).

In the concrete diagnostic, L, M and N trust `{p,a}`, `{p,a,b}` and `{p,b}`. Participant p has an observed fork, while a and b are sequential. Every triple quorum intersection contains p. Sequential intersections hold for L–M, witnessed by a, and M–N, witnessed by b, but fail for L–N, whose intersection contains only p. Empty correlation is a valid partial equivalence relation; forcing the biconditional conflicts with retained CorrTran. The [correct correlation choice](../examples/theories/hbb3-corr-definition.md) and [incorrect replacement](../examples/theories/hbb3-corr-definition-wrong.md) isolate that overconstraint.

## Other controlled weakenings

The curated examples also remove forward rules, remove Safe, delete Vote?'s safety conjunct, or remove selected correlation/agreement assumptions. These are explicit protocol-design experiments; they are not all formulas the paper calls incorrect. Each retains the complete dynamic ThyLive theory and the full canonical correctness properties. Run selections and evidence record the actual omissions.

See the [HBBSafe examples](HBB1_EXAMPLES.md), [HBBCorr examples](HBB3_EXAMPLES.md) and [HBBSimp tour guide](WEAKENING.md) for the complete fixed-history matrices, no-model comparators, non-vacuity checks and replay commands. The valid alternatives above are documented accurately even where no separate executable fixture is supplied.
