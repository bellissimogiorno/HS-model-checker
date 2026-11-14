# Paper references and axiom variants

This guide refers to *Heterogeneous trust in reliable broadcast via modal logic
and history structures*, by Murdoch J. Gabbay and Isaac Sheff, the supplied draft
`hbb-disc(20261107-111315).pdf`, dated 7 November 2026. Page numbers are the
printed page numbers, which also match the PDF page numbers. The displayed
formulas in Remarks 6.2.3, 6.2.4, 8.3.2 and 8.6.2-8.6.4 were checked against
the rendered PDF, including the prime on the incorrect Echo! conclusion.

The executable theory files contain the complete baseline axiom sets:
[ThyHBB1](../examples/theories/hbb1.md),
[ThyHBB2](../examples/theories/hbb2.md), and
[ThyHBB3](../examples/theories/hbb3.md).
[Paper map](PAPER_MAP.md), [protocol formulas](PROTOCOLS.md),
[semantics](SEMANTICS.md), and [theory-file syntax](THEORY_FORMAT.md) explain
the translation to the checker.

## Baseline source map

| Checker declaration or claim | Paper reference | Page |
| --- | --- | --- |
| Every axiom has explicit universal closure in the file and is checked at all possible worlds | Definition 5.2.1(1)-(4); Remark 5.2.2 | 37 |
| `include ThyLive`: LiveAlways, LiveSeq, KnowledgeDia and KnowledgeBox schemes | Definition 5.2.4; Figure 6 | 38 |
| HBB1 event and predicate signature; full theory | Definition 6.1.2; Figure 7 | 41-42 |
| HBB1 `Echo?`, `Vote?`, `Deliver?`, `EchoNE`, `Safe`, `Echo!`, `Vote!`, `Deliver!` | Figure 7 | 41 |
| HBB1 correctness statements: Liveness 1, Liveness 2, Agreement | Figure 8; Theorem 6.1.6 | 41, 43 |
| HBB1 Agreement | Proposition 6.3.1 | 45 |
| HBB1 Liveness 2, including the safe-source-learner premise | Proposition 6.4.5 | 47 |
| HBB1 Liveness 1 | Proposition 6.5.3 | 48 |
| HBB1 unique-proposal echo and at-most-one-proposal safety lemmas | Lemmas 6.5.1 and 6.5.2 | 47-48 |
| HBB3 signature and full theory | Definition 8.2.1; Figure 11 | 55-56 |
| HBB3 `Echo?`, `Vote?`, `Deliver?`, `EchoNE`, `VoteNE`, `3twined`, correlation axioms, `Echo!`, `Vote!`, `Vote'!`, `Deliver!` | Figure 11 | 56 |
| HBB3 correctness statements: Liveness 1, Liveness 2, Agreement | Figure 12; Theorem 8.2.3 | 56-57 |
| HBB3 Agreement | Proposition 8.3.1 | 57 |
| HBB3 Liveness 2 | Proposition 8.4.5 | 59 |
| HBB3 Liveness 1 | Proposition 8.5.1 | 59-60 |
| Triple-quorum intersection used to establish agreement of echo/vote values under a sequential quorum | Lemma 8.4.3; Remark 8.6.2 | 58, 60-61 |

HBB1 delivery has three arguments: `deliver(reportingLearner,sourceLearner,value)`
(Notation 6.1.3 and Remark 6.1.4, p. 42). HBB3 delivery has two arguments:
`deliver(learner,value)` (Figure 11, p. 56). Learners and values use the same
value domain; choosing different variable names does not introduce sorts.

The checker uses `corr` for the paper's dotted equality, an interpreted binary
predicate distinct from value equality. In [the HBB3 file](../examples/theories/hbb3.md):

| Checker name | Paper name in Figure 11 | Formula |
| --- | --- | --- |
| `CorrSeq` | dotted-equality seq | `forall l,m. corr(l,m) -> dia[l,m] seq` |
| `CorrPast` | dotted-equality past-all | `forall l,m. corr(l,m) -> allpast corr(l,m)` |
| `CorrSymm` | dotted-equality symm | `forall l,m. corr(l,m) -> corr(m,l)` |
| `CorrTran` | dotted-equality tran | `forall l,m,n. corr(l,m) -> corr(m,n) -> corr(l,n)` |

The last two make correlation a partial equivalence relation. Reflexivity is
not assumed (Remark 8.1.1, pp. 54-55; Remark 8.6.1, p. 60).

## Which variants are incorrect?

Only the first and last rows below are expressly called wrong in the paper.
The other rows describe deliberate alternatives or an intentional difference
between an operational rule and an axiom.

| Source | Classification | What the example should establish |
| --- | --- | --- |
| Remark 6.2.3(2), p. 44 | Incorrect replacement of `Echo!` | The missing existential forces every domain value to be echoed; a legitimate one-choice history can be rejected. |
| Remark 6.2.4, p. 45: `EchoNE'` | Valid, stronger assumption | A history may satisfy baseline `EchoNE` and fail `EchoNE'`; the paper says the correctness results still hold under the stronger assumption. |
| Remark 8.2.2(4), footnote 54, p. 57 | Correct baseline axiom with a weaker progress guarantee than the operational rule | `Vote'!` assumes correlation at every local event. A current-time operational step can be permitted without being required by this axiom. |
| Remark 8.3.2, pp. 57-58 | Valid alternative to `CorrPast` | The end-of-time antecedent and all-possible-world consequent differ from the actual-history persistence axiom; the paper says either works in its proofs. |
| Remark 8.6.2, equation (4), p. 61 | Valid, weaker replacement for `3twined` | Sequential-quorum-dependent intersection suffices for the proofs, though it depends on behavior as well as quorum structure. |
| Remark 8.6.3, p. 61: `AltVote?` and `AltVote!` | Alternative theory with a weaker liveness guarantee | Progress requires the relevant correlation; full baseline progress for non-self-correlating learners cannot be assumed. |
| Remark 8.6.4, p. 61: dotted-equality wrong | Incorrect identification of correlation with sequential quorum intersection | Sequential quorum intersection need not be transitive. Forcing correlation to equal it can conflict with `CorrTran` or reject a legitimate baseline correlation choice. |

A stronger incorrect axiom need not produce a counterexample to Agreement or
Liveness. It can exclude an otherwise valid protocol history, or leave no
predicate valuation on a fixed history. In the provided correlation pair, `CorrTran` is retained. The actual theory admits a partial equivalence relation, while the proposed equivalence forces a nontransitive relation and leaves no model on that history. This diagnoses the replacement without claiming a failure of the baseline correctness theorem.

## Literal translations of the variants

The blocks below use ordinary `text` fences so this guide is not itself an
executable theory file. The example theory files explicitly bind variables,
while the paper elides top-level universal quantifiers (Definition 5.2.1(3),
p. 37).

### Incorrect Echo!: Remark 6.2.3(2), p. 44

The PDF prints a **primed** value in the conclusion and no existential:

```text
forall v,w. (live & dia[] past propose(v)) -> sometime echo(w)
```

The correct baseline declaration is:

```text
forall v. (live & dia[] past propose(v)) -> exists w. sometime echo(w)
```

Thus the incorrect version quantifies the echoed value universally,
independently of the observed proposal. It must not be silently transcribed
as `echo(v)`. On a two-value run with a live participant that knows proposals
but selects only one value to echo, the baseline axiom can hold while the
incorrect formula fails. Forcing the bad formula together with baseline
non-equivocation and sequential liveness can make that history inconsistent.
Even an unproposed domain value can be forced by the literal bad formula and
then conflict with `Echo?`.

Under the additional premise that exactly one value is proposed globally,
Lemma 6.5.1 (p. 47) derives echoing that value from baseline `Echo!` and
`Echo?`. That conditional result does not justify changing the baseline axiom.

### Stronger EchoNE': Remark 6.2.4, p. 45

```text
forall v,w. echo(v) -> dia[] past echo(w) -> v=w
```

Baseline `EchoNE` has local `past echo(w)` in place of `dia[] past echo(w)`.
The alternative prohibits a distinct echo that the participant knows about
anywhere in its current history, even if that prior echo was at another
participant. The paper's separating history has a `p` proposal/echo of 0,
followed by a `q` proposal/echo of 1. It satisfies baseline `EchoNE` because
neither participant locally echoes two values. At `q`'s final echo, the
history contains `p`'s echo, so the stronger rule fails. This is a valid
stronger design choice, not an incorrect axiom.

### End-of-time correlation persistence: Remark 8.3.2, pp. 57-58

```text
forall l,m. end corr(l,m) -> corr(l,m)
```

This can replace baseline `CorrPast`:

```text
forall l,m. corr(l,m) -> allpast corr(l,m)
```

Both are checked at all possible worlds. The alternative only has an
end-of-time antecedent, but its consequent applies even at worlds that are
not actual history tuples. Baseline `allpast` only ranges over actual local
history tuples. The paper discusses these two directions of comparison and
states that either axiom works in its proofs; it does not classify this
alternative as simply stronger or simply weaker.

### Weaker intersection condition: Remark 8.6.2(4), p. 61

```text
forall l,m,n. box[l] seq -> dia[m,n] seq
```

This replaces `forall l,m,n. dia[l,m,n] true`. It says that existence of a
sequential `l`-quorum forces sequential intersections for every `m,n` pair.
The baseline structural `3twined` assumption implies it: a sequential quorum
and any two chosen quorums intersect. The converse need not hold. The paper
states that its proofs continue to work with this weaker condition.

### Alternative voting: Remark 8.6.3, p. 61

```text
AltVote?: forall l,v.
  vote(l,v) -> exists m. (corr(m,l) & box[m] past echo(v))

AltVote!: forall l,m,v.
  (live & everytime corr(m,l) & box[m] past echo(v))
    -> exists w. sometime vote(l,w)
```

These replace the baseline vote rules; the remaining rules, explicitly
including `VoteNE`, are unchanged. As a forward obligation, `AltVote!` is
conditional on persistent correlation. The paper contrasts this with
baseline `Vote!`, which can require progress for a learner without any
self-correlation premise. A stalled non-self-correlating learner illustrates
the alternate theory's weaker guarantee; it does not refute the baseline
theorem, whose baseline forward rules were replaced.

### Incorrect correlation definition: Remark 8.6.4, p. 61

```text
forall l,m. corr(l,m) <-> dia[l,m] seq
```

The paper proposes this as a tempting replacement of both `CorrSeq` and
`CorrPast`, then rejects it. The baseline has only the forward implication
from correlation to sequential quorum intersection. Remark 8.1.1(2)
(pp. 54-55) explains why the converse can conflict with transitivity: after
learning that two learners are incompatible, a participant may need to stop
correlating another pair even while that pair still has sequential quorum
intersections. The baseline leaves room to choose a partial equivalence
relation inside the sequential-intersection relation.

In the concrete diagnostic, learner quorums are `L={p,a}`, `M={p,a,b}`,
and `N={p,b}`. Participant `p` has an observed fork; `a` and `b` are
sequential. Every triple quorum intersection contains `p`, so `3twined`
holds. Sequential intersections exist for `L,M` (witness `a`) and `M,N`
(witness `b`), but not `L,N` (intersection only `p`). Empty correlation is
a valid baseline partial equivalence relation; the incorrect equivalence
instead forces this nontransitive relation.

With `CorrTran` retained, the incorrect biconditional can make a history
unsatisfiable. With `CorrTran` omitted, it can force a nontransitive relation.
Neither outcome is a violation of Agreement in a model satisfying the
complete baseline theory.

## Executable examples and controls

The supplied files retain explicit, editable protocol declarations and the
complete dynamic `ThyLive` include. The incorrect-axiom pairs differ in the
specified replacement only. Rule-removal experiments retain the source
axioms in the document and use the run's omitted-rule selection, unless the
file expressly declares a replacement.

| Experiment | Theory files | Intended comparison |
| --- | --- | --- |
| Literal incorrect Echo! | [Baseline choice](../examples/theories/hbb1-echo-choice.md), [incorrect replacement](../examples/theories/hbb1-echo-choice-wrong.md) | Full HBB1 permits choosing one echo value. The diagnostic bad-axiom probe fails; installing that formula rejects the fixed history. |
| HBB1 progress | [Echo](../examples/theories/hbb1-echo-progress.md), [vote](../examples/theories/hbb1-vote-progress.md), [delivery](../examples/theories/hbb1-deliver-progress.md) | Omitting the named forward rule admits a stopped history with a realized Liveness 1 failure; the full theory rejects that history. |
| HBB1 Safe definition | [Safe removed](../examples/theories/hbb1-safe-removed.md) | Omitting `Safe` can disable the persistent-safety premise of `Vote!`, giving a Liveness 1 counterexample to the weakened theory. |
| HBB1 Vote? safety guard | [Full guard](../examples/theories/hbb1-vote-safe.md), [guard omitted](../examples/theories/hbb1-vote-safe-omitted.md) | An exploratory weakening of Figure 7's backward voting rule admits conflicting deliveries that the complete baseline rule excludes. |
| Literal incorrect correlation definition | [Baseline correlation choice](../examples/theories/hbb3-corr-definition.md), [incorrect replacement](../examples/theories/hbb3-corr-definition-wrong.md) | A nontransitive sequential-intersection profile has a valid baseline partial equivalence relation, but forcing equality to that profile conflicts with retained transitivity. |
| HBB3 agreement assumptions | [CorrSeq](../examples/theories/hbb3-corr-seq.md), [CorrPast](../examples/theories/hbb3-corr-past.md), [VoteNE](../examples/theories/hbb3-vote-ne.md) | Omitting the named assumption admits an Agreement counterexample to the weakened theory; the complete theory excludes that fixed history. |
| HBB3 progress | [Echo](../examples/theories/hbb3-echo-progress.md), [vote](../examples/theories/hbb3-vote-progress.md), [delivery](../examples/theories/hbb3-deliver-progress.md), [correlated vote propagation](../examples/theories/hbb3-vote-prime-progress.md) | Omitting the named forward rule admits a realized Liveness failure on the stopped fixed history. |

The valid design alternatives listed above are documented to prevent their
being mistaken for the paper's incorrect axioms. The example catalog does
not claim to supply a separate executable fixture for every alternative.

## Reading the example results

Keep the following questions separate:

1. Is the history structure valid?
2. Does some predicate valuation satisfy every retained axiom at every
   possible world?
3. Is the queried property true in that valuation, at its declared scope?
4. Are the correctness theorem's premises actually realized?

A false `[all]` probe can identify the world at which a proposed replacement
axiom fails while all baseline axioms hold. Installing that same probe as an
axiom may produce no model on the fixed history. A true correctness
implication whose premise is false is vacuous. The final silent observation
in completed live histories records knowledge of the last real event, as
required by the full ThyLive schemes; it is not an additional protocol event.
