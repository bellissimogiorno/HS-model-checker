# Protocol and exploration specification for hbb-disc (draft 2026-11-07)

Source: Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft **2026-11-07**, pp. 37–61, Figures 6–12 and the cited discussion. Figures 6 and 11 were also checked visually. The notation below is ASCII explanatory notation, not a proposed parser contract. [Exact rule, theorem, proof and alias map](PAPER_MAP.md); [incorrect variants and valid alternatives](PAPER_VARIANTS.md).

## Notation

- `past F` = ↓F: some actual tuple at the current participant in the current history satisfies F.
- `allpast F` = ⇓F: every such tuple satisfies F (vacuous on no such tuples).
- `end F` = the paper's end-of-time operator, evaluated at `(currentParticipant, dagger, rootHistory)`.
- `sometime F` = ↕F = `end past F`: some actual tuple at the current participant anywhere in root history satisfies F. It can be before, after, or incomparable to the evaluation time.
- `everytime F` = ⇕F = `end allpast F`.
- `dia[ls] F` = ♢ with learner list ls; `box[ls] F` = its De Morgan dual. Empty list means participant existential/universal, respectively. Both reset current event to dagger.
- `diaPast[ls] F` = `dia[ls] past F`; `boxPast[ls] F` = `box[ls] past F`.
- `corr(l,l')` = the paper's dotted equality. It is an interpreted predicate, entirely distinct from value equality.
- `unique v. F` and `atmostone v. F` have their standard meanings over the entire Value domain.
- Every free variable in a displayed axiom is implicitly universally quantified. All axioms are checked at **all possible worlds**, not only root worlds and not only actual tuples.
- The paper uses one value domain for both learners and values: Learner=Value. Every value has a quorum interpretation. A separate learner sort would change the literal semantics and must be declared as an extension.

## ThyLive — Figure 6

Definition 5.2.4 and Figure 6, p. 38; all-world theory validity is Definition 5.2.1, p. 37.

```
LiveAlways:       live <-> end live
LiveSeq:          live -> seq
KnowledgeDia(E):  end diaPast[] (live & E) -> live -> sometime diaPast[] E
KnowledgeBox(E, ls):
                  end boxPast[ls] (live & E) -> live -> sometime boxPast[ls] E
```

`KnowledgeDia` has no learner list: the diamond is the empty-list global diamond. `KnowledgeBox` ranges over EVERY finite learner list, including repetitions and the empty list. E ranges over every ground Event. This is an axiom scheme, not a single syntactically universally quantified event variable.

LiveActive is **not** in ThyLive: the paper explicitly permits an empty history with live participants (subject to the other model structure and knowledge instances). Forward rules in each HBB theory supply protocol-specific progress.

## ThyHBB1 — Figure 7

Definition 6.1.2, pp. 41–42; Figure 7, p. 41. Delivery argument order is reporting learner, source learner, value (Notation 6.1.3, p. 42).

Includes ThyLive.

```
Echo?:     echo(v) -> diaPast[] propose(v)
Vote?:     vote(l,v) -> (safe(l) & boxPast[l] echo(v))
Deliver?:  deliver(lp,l,v) -> boxPast[lp] vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
Safe:      safe(l) <-> (atmostone v. diaPast[] propose(v))
                       | (forall lp. dia[l,lp] seq)
Echo!:     (live & diaPast[] propose(v)) -> exists vp. sometime echo(vp)
Vote!:     everytime safe(l) -> (live & boxPast[l] echo(v)) -> sometime vote(l,v)
Deliver!:  (live & boxPast[lp] vote(l,v)) -> sometime deliver(lp,l,v)
```

The entire disjunction is the right side of Safe's biconditional. Safe is an ordinary interpreted predicate constrained by this axiom, so it can vary by participant and time. `everytime safe(l)` in Vote! is deliberate.

## ThyHBB2 — Figure 9

Definition 7.1.1, p. 49; Figure 9, p. 50. Delivery retains HBB1's reporting learner, source learner, value order.

Includes ThyLive. Uses the same events as HBB1 but no safe predicate.

```
Echo?:     echo(v) -> diaPast[] propose(v)
Vote?:     vote(l,v) -> boxPast[l] echo(v)
Deliver?:  deliver(lp,l,v) -> boxPast[lp] vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
Echo!:     (live & diaPast[] propose(v)) -> exists vp. sometime echo(vp)
Vote!:     (live & boxPast[l] echo(v)) -> sometime vote(l,v)
Deliver!:  (live & boxPast[lp] vote(l,v)) -> sometime deliver(lp,l,v)
```

## ThyHBB3 — Figure 11

Definition 8.2.1, p. 55; Figure 11, p. 56. `CorrSeq`, `CorrPast`, `CorrSymm`, `CorrTran` are ASCII names for the paper's dotted-equality seq, ⇓, symm, tran labels, respectively.

Includes ThyLive. Delivery arity changes to two. All of the following hold:

```
Echo?:     echo(v) -> diaPast[] propose(v)
Vote?:     vote(l,v) -> (boxPast[l] echo(v)
                         | exists lp. (corr(lp,l) & diaPast[] vote(lp,v)))
Deliver?:  deliver(l,v) -> boxPast[l] vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
VoteNE:    vote(l,v) -> past vote(lp,vp) -> corr(l,lp) -> v=vp
3twined:   dia[l,lp,lpp] true
CorrSeq:   corr(l,lp) -> dia[l,lp] seq
CorrPast:  corr(l,lp) -> allpast corr(l,lp)
CorrSymm:  corr(l,lp) -> corr(lp,l)
CorrTran:  corr(l,lp) -> corr(lp,lpp) -> corr(l,lpp)
Echo!:     (live & diaPast[] propose(v)) -> exists vp. sometime echo(vp)
Vote!:     (live & boxPast[l] echo(v)) -> exists vp. sometime vote(l,vp)
Vote'!:    (live & everytime corr(l,lp) & diaPast[] vote(lp,v))
             -> exists vp. sometime vote(l,vp)
Deliver!:  (live & boxPast[l] vote(l,v)) -> sometime deliver(l,v)
```

Both voting forward rules existentially choose the value. Do **not** replace vp by the antecedent's v. The Vote'! condition `everytime corr(l,lp)` is explicitly weaker than the operational guarantee in Remark 8.2.2(4), which acts on correlation at execution time. Footnote 54 says this distinction is intentional.

Correlation is a **partial** equivalence relation: symmetry + transitivity, no reflexivity axiom. CorrSeq is one-way only. Defining correlation automatically to equal sequential quorum intersection would be wrong in general: the latter need not be transitive. CorrPast only propagates to actual past tuples at the same participant; it is not a condition at every smaller subset or every possible world.

## Correctness properties — Figures 8, 10, 12

HBB1: Figure 8, p. 41; Theorem 6.1.6, p. 43; proofs are Propositions 6.5.3 (Liveness 1, p. 48), 6.4.5 (Liveness 2, p. 47), and 6.3.1 (Agreement, p. 45). HBB2: Figure 10, p. 50; Theorem 7.1.3, p. 51; proofs are Propositions 7.3.3 (Liveness 1, p. 53), 7.3.2 (Liveness 2, pp. 52–53), and 7.3.1 (Agreement, p. 52). HBB3: Figure 12, p. 56; Theorem 8.2.3, p. 57; proofs are Propositions 8.5.1 (Liveness 1, pp. 59–60), 8.4.5 (Liveness 2, p. 59), and 8.3.1 (Agreement, p. 57).

These are root/end-of-time validity checks: `Valid F` means F at every `(p,dagger,root)`.

For HBB1/HBB2:

```
Liveness1(l,v):
  [Valid box[l] live and Valid unique vp. diaPast[] propose(vp)]
   => Valid (diaPast[] (live & diaPast[] propose(v))
             -> live -> sometime deliver(l,l,v))

Liveness2(lp1,lp2,l,v):
  [Valid dia[lp1,lp2] true and Valid box[lp2] live
      and (HBB1 only: Valid safe(l))]
   => Valid (diaPast[] deliver(lp1,l,v)
             -> live -> sometime deliver(lp2,l,v))

Agreement(lp1,l1,v1,lp2,l2,v2):
  [HBB1: Valid dia[lp1,lp2] seq; HBB2: Valid dia[l1,l2] seq]
   => Valid (diaPast[] deliver(lp1,l1,v1)
             -> diaPast[] deliver(lp2,l2,v2) -> v1=v2)
```

For HBB3:

```
Liveness1(l,v):
  [Valid box[l] live and Valid unique vp. diaPast[] propose(vp)]
   => Valid (diaPast[] (live & diaPast[] propose(v))
             -> live -> sometime deliver(l,v))

Liveness2(l1,l2,v):
  [Valid box[] corr(l1,l2) and Valid box[l2] live]
   => Valid (diaPast[] deliver(l1,v) -> live -> sometime deliver(l2,v))

Agreement(l1,v1,l2,v2):
  [Valid box[] corr(l1,l2)]
   => Valid (diaPast[] deliver(l1,v1) -> diaPast[] deliver(l2,v2) -> v1=v2)
```

Report whether each antecedent is satisfied. If an implication is true only because its preconditions are unmet, the result is vacuous: it does not exercise delivery or agreement behaviour.

## Making full ThyLive finite and exact

The raw scheme is infinite, but its relevant finite-model checks can be reduced without weakening it.

1. The modalities depend only on each learner's family of inclusion-minimal quorum intersections. Upward-closed quorums may be stored by inclusion-minimal bases; pairwise intersection of the bases is required by the semifilter definition. Do not add closure under intersections.
2. Learner-list permutation changes nothing. Repetition **does** matter: `dia[l,l]` means independent choices of two quorums from l, not a single quorum, and three quorums can have empty intersection despite all pairs intersecting.
3. Let N be the number of participants. For a fixed learner l, the family of intersections of k independently selected l-quorums stabilises by k=N (N>=1). Every such intersection can be represented by at most N factors: choose one factor excluding each missing participant; if the result is all participants, one factor suffices. Extra factors can repeat an existing one. Thus each learner multiplicity can be capped at N. There are at most `(N+1)^|Value|` count vectors, including empty list, before deduplication of identical intersection families. A cap below this is only a selected scheme subset, not full ThyLive.
4. Knowledge instances for different ground events absent from root history are semantically identical. It suffices to check every distinct occurring ground event and ONE absent ground-event representative, if such an event exists. Do not omit the absent representative: an empty quorum intersection makes `end boxPast[ls](live & E)` vacuously true, even for absent E, and its conclusion can require an inactive live participant to become active. If Event is empty, both knowledge schemes have no instances.
5. If the implementation uses a declared finite set of event arities, full ground events over finite Value are finite. Missing/extra arities relative to the paper should be documented as a practical signature convention.

When full closure would be large, compute distinct intersection families with a resource budget and return **inconclusive / resource limit** if exhausted. Never label a bounded partial scheme check as complete.

## Small, useful models

### A completed one-participant HBB run

Take participants `{p}`, Value `{v}` (v also serves as the learner), learner quorum basis `[{p}]`, and live(p,H)=true at every time. Use a strictly chained DAG:

```
propose(v) -> echo(v) -> vote(v,v) -> deliver(v,v,v) -> dagger
```

Each tuple's time is the transitive closure of earlier tuples in the chain; root is all five tuples. For HBB1, safe(v) is true at every participant/time. For HBB3, use `deliver(v,v)` and corr(v,v)=true everywhere.

The final dagger/null observation is necessary in this completed live example: every real event at a live source, including the last deliver, must eventually be known at one of that participant’s actual tuples to satisfy ThyLive. The synthetic root world is not itself such a tuple. This finite run satisfies the full schemes, unlike a chain ending at a real deliver with no later observation.

### Fork / equivocation diagnostic

Have a participant p perform two distinct tuples with equal empty past, e.g. `echo(0)` and `echo(1)`. In the root, p is nonsequential because neither tuple belongs to the other's time. Do not infer sequentiality by merely comparing timestamps/subsets: these times are equal, but the tuples are distinct and unordered. For a valid HBB backward-rule example, place distinct proposes in each fork's past first.

### Empty and minimal models

An empty root H is permitted. Sequentiality holds vacuously. An empty event signature has no Knowledge instances. A canonical minimal nonempty model has one p and one dagger tuple with empty past; no real events occur. These are useful checks of vacuity and inactive-participant UI.

### Majority quorum diagnostic

Three participants with a learner basis `{ab,bc,ac}` form a valid semifilter. Pairwise quorum intersections are nonempty but the triple intersection may be empty. This exercises learner repetition, the difference between HBB1/2 and HBB3, and Knowledge-box vacuity.

## Exploration boundaries

- This is finite-model checking. A found valid countermodel refutes the requested implication in its stated finite scope. Failure to find one under a search bound is not a proof over unbounded histories.
- A finite prefix with a pending obligation may fail a forward/liveness axiom while having a valid extension. Label these violations as obligations of this completed finite model, not evidence that the protocol can never progress.
- A generator implementing the informal operational algorithm explores one subset of models of the axioms. In particular, enforcing Vote'! operationally at the current time is stronger than the axiom's guarantee. Record generator restrictions, schedules, domain, event bound, quorum choices, and seeds with every search result.
- Model validation, axiom validity, correctness preconditions, and desired property validity should be displayed separately. A property failure in a model that violates the selected theory is not a countermodel to that theory's correctness claim.
- Preserve a machine-readable model format, deterministic CLI/API and seeded generation. Protocol designs should be data (named editable axiom sets), rather than compiled cases hidden in the evaluator.
