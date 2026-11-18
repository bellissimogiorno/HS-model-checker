# Protocol and exploration specification for hbb-disc (draft 2026-11-18)

Source: Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft **18 November 2026**, supplied as `hbb-disc(20261118-194826).pdf`. The current protocol names are **HBBSafe**, **HBBSimp** and **HBBCorr**. [PAPER_MAP.md](PAPER_MAP.md) gives precise figure, definition and proof references; [PAPER_VARIANTS.md](PAPER_VARIANTS.md) distinguishes incorrect formulas from valid alternatives. Rule labels and the meta-level `Valid` notation below are explanatory; formula bodies use accepted ASCII spellings. When entering a complete axiom, add the explicit value quantifiers and declaration syntax shown in the literate theory files.

## Notation

- `past F` = ↓F: some actual tuple at the current participant in the current history satisfies F.
- `allpast F` = ⇓F: every such tuple satisfies F (vacuous on no such tuples).
- `end F` = the paper's end-of-time operator, evaluated at `(currentParticipant, dagger, rootHistory)`.
- `sometime F` = ↕F = `end past F`: some actual tuple at the current participant anywhere in root history satisfies F. It can be before, after, or incomparable to the evaluation time.
- `everytime F` = ⇕F = `end allpast F`.
- `dia[ls] F` = ♢ with learner list ls; `box[ls] F` = its De Morgan dual. Empty list means participant existential/universal, respectively. Both reset current event to dagger.
- `dia[ls] past F` and `box[ls] past F` compose a quorum modality with local past.
- `corr(l,l')` = the paper's dotted equality. It is an interpreted predicate, entirely distinct from value equality.
- `exists1 v. F` and `exists01 v. F` have their standard meanings over the entire Value domain.
- Every free variable in a displayed axiom is implicitly universally quantified. All axioms are checked at **all possible worlds**, not only root worlds and not only actual tuples.
- The paper uses one value domain for both learners and values: Learner=Value. Every value has a quorum interpretation. A separate learner sort would change the literal semantics and must be declared as an extension.

## ThyLive — Figure 7, p. 43

Definition 5.2.4, p. 43; all-world theory validity is Definition 5.2.1, p. 42.

```text
LiveAlways:       live <-> end live
LiveSeq:          live -> seq
KnowledgeDia(E):  end (dia[] past (live & E)) -> live -> sometime (dia[] past E)
KnowledgeBox(E):  forall l.
                    end (box[l] past (live & E)) -> live -> sometime (box[l] past E)
```

E ranges over ground events, rather than arbitrary predicates or value variables. KnowledgeDia has the empty-list global diamond. KnowledgeBox ranges over **each single learner**. General finite learner lists remain part of the formula language but are not extra KnowledgeBox instances.

For each finite candidate, the checker dynamically instantiates all occurring ground events and all learners. Absent-event antecedents are false: an event needs an actual tuple, and one learner's quorums are nonempty. The full scheme therefore needs no arbitrary-list saturation or absent-event representative. LiveActive is not an axiom (Remark 5.2.12, p. 45); empty histories remain allowed.

## HBBSafe — Figure 8, p. 48

Definition 6.2.2, p. 47; Figure 8, p. 48. Delivery argument order is reporting learner, source learner, value (Notation 6.2.3, p. 47).

Includes ThyLive.

```
Echo?:     echo(v) -> dia[] past propose(v)
Vote?:     vote(l,v) -> (safe(l) & box[l] past echo(v))
Deliver?:  deliver(lp,l,v) -> box[lp] past vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
Safe:      safe(l) <-> ((exists01 v. dia[] past propose(v))
                        | (forall lp. dia[l,lp] seq))
Echo!:     sometime (live & dia[] past propose(v)) -> exists vp. sometime echo(vp)
Vote!:     everytime safe(l) -> sometime (live & box[l] past echo(v)) -> sometime vote(l,v)
Deliver!:  sometime (live & box[lp] past vote(l,v)) -> sometime deliver(lp,l,v)
```

The entire disjunction is the right side of Safe's biconditional. Safe is an ordinary interpreted predicate, so it can vary by participant and time. `everytime safe(l)` remains a separate premise of Vote!. Each main forward guard has an outer `sometime`: the live-and-knowledge condition must hold at an actual local tuple, not merely at a hypothetical world or the full-history world (Remark 6.3.3(3), p. 51).

## HBBSimp — Figure 10, p. 57

Definition 7.1.1, p. 56; Figure 10, p. 57. Delivery retains HBBSafe's reporting learner, source learner, value order.

Includes ThyLive. Uses the same events as HBBSafe but no safe predicate.

```
Echo?:     echo(v) -> dia[] past propose(v)
Vote?:     vote(l,v) -> box[l] past echo(v)
Deliver?:  deliver(lp,l,v) -> box[lp] past vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
Echo!:     sometime (live & dia[] past propose(v)) -> exists vp. sometime echo(vp)
Vote!:     sometime (live & box[l] past echo(v)) -> sometime vote(l,v)
Deliver!:  sometime (live & box[lp] past vote(l,v)) -> sometime deliver(lp,l,v)
```

## HBBCorr — Figure 12, p. 63

Definition 8.2.1, p. 62; Figure 12, p. 63. `CorrSeq`, `CorrPast`, `CorrSymm`, `CorrTran` are ASCII names for the paper's dotted-equality seq, ⇓, symm, tran labels, respectively.

Includes ThyLive. Delivery arity changes to two. All of the following hold:

```
Echo?:     echo(v) -> dia[] past propose(v)
Vote?:     vote(l,v) -> (box[l] past echo(v)
                         | exists lp. (corr(lp,l) & dia[] past vote(lp,v)))
Deliver?:  deliver(l,v) -> box[l] past vote(l,v)
EchoNE:    echo(v) -> past echo(vp) -> v=vp
VoteNE:    vote(l,v) -> past vote(lp,vp) -> corr(l,lp) -> v=vp
3twined:   dia[l,lp,lpp] true
CorrSeq:   corr(l,lp) -> dia[l,lp] seq
CorrPast:  corr(l,lp) -> allpast corr(l,lp)
CorrSymm:  corr(l,lp) -> corr(lp,l)
CorrTran:  corr(l,lp) -> corr(lp,lpp) -> corr(l,lpp)
Echo!:     sometime (live & dia[] past propose(v)) -> exists vp. sometime echo(vp)
Vote!:     sometime (live & box[l] past echo(v)) -> exists vp. sometime vote(l,vp)
Vote'!:    sometime (live & everytime corr(l,lp) & dia[] past vote(lp,v))
             -> exists vp. sometime vote(l,vp)
Deliver!:  sometime (live & box[l] past vote(l,v)) -> sometime deliver(l,v)
```

Both voting forward rules existentially choose the value. Do **not** replace vp by the antecedent's v. The persistent-correlation premise `everytime corr(l,lp)` is stronger than the operational step's correlation-at-execution-time test in Remark 8.2.2(4), so the axiom supplies a weaker progress guarantee. Footnote 64, p. 62, says this distinction is intentional.

Correlation is a **partial** equivalence relation: symmetry + transitivity, no reflexivity axiom. CorrSeq is one-way only. Defining correlation automatically to equal sequential quorum intersection would be wrong in general: the latter need not be transitive. CorrPast only propagates to actual past tuples at the same participant; it is not a condition at every smaller subset or every possible world.

## Correctness properties — Figures 9, 11 and 13

The checker's names are **Happy Termination**, **Cascade Termination** and **Agreement**. The latter abbreviates the paper's **Soundness / Agreement**. The complete formulas and their premises are retained.

| Theory | Collected statement | Happy Termination proof | Cascade Termination proof | Agreement proof |
| --- | --- | --- | --- | --- |
| HBBSafe | Figure 9, p. 48; Theorem 6.2.6, p. 49 | Proposition 6.6.3, pp. 54–55 | Proposition 6.5.5, pp. 53–54 | Proposition 6.4.1, p. 52 |
| HBBSimp | Figure 11, p. 57; Theorem 7.1.3, p. 57 | Proposition 7.3.3, pp. 59–60 | Proposition 7.3.2, pp. 59–60 | Proposition 7.3.1, p. 59 |
| HBBCorr | Figure 13, p. 63; Theorem 8.2.3, p. 64 | Proposition 8.5.1, p. 66 | Proposition 8.4.5, pp. 65–66 | Proposition 8.3.1, p. 64 |

These are root/end-of-time validity checks: `Valid F` means F at every `(p,dagger,root)`.

For HBBSafe/HBBSimp:

```
HappyTermination(l,v):
  [Valid box[l] live and Valid exists1 vp. dia[] past propose(vp)]
   => Valid (dia[] past (live & dia[] past propose(v))
             -> live -> sometime deliver(l,l,v))

CascadeTermination(lp1,lp2,l,v):
  [Valid dia[lp1,lp2] true and Valid box[lp2] live
      and (HBBSafe only: Valid safe(l))]
   => Valid (dia[] past deliver(lp1,l,v)
             -> live -> sometime deliver(lp2,l,v))

Agreement(lp1,l1,v1,lp2,l2,v2):
  [HBBSafe: Valid dia[lp1,lp2] seq; HBBSimp: Valid dia[l1,l2] seq]
   => Valid (dia[] past deliver(lp1,l1,v1)
             -> dia[] past deliver(lp2,l2,v2) -> v1=v2)
```

For HBBCorr:

```
HappyTermination(l,v):
  [Valid box[l] live and Valid exists1 vp. dia[] past propose(vp)]
   => Valid (dia[] past (live & dia[] past propose(v))
             -> live -> sometime deliver(l,v))

CascadeTermination(l1,l2,v):
  [Valid box[] corr(l1,l2) and Valid box[l2] live]
   => Valid (dia[] past deliver(l1,v) -> live -> sometime deliver(l2,v))

Agreement(l1,v1,l2,v2):
  [Valid box[] corr(l1,l2)]
   => Valid (dia[] past deliver(l1,v1) -> dia[] past deliver(l2,v2) -> v1=v2)
```

Report whether each antecedent is satisfied. If an implication is true only because its preconditions are unmet, the result is vacuous: it does not exercise delivery or agreement behaviour.

## Making full ThyLive finite and exact

The semantic event domain can be large, but finite histories need only the distinct occurring ground events. Every absent ground event is false at every world, and all its Knowledge antecedents are false. Each single learner's quorum family is read from its minimal bases, so KnowledgeBox checks every learner directly. Hitting a learner/event or time resource cap reports incomplete checking.

Quorum products in arbitrary user formulas still use an exact minimal-intersection antichain. Repeated learners make independent choices and cannot be deduplicated. This general modal optimization does not add multi-learner instances to KnowledgeBox.

The model signature can declare finite arities as a practical input convention. Ground events over finite values and declared finite arities are finite; the mathematical occurrence-based reduction also explains why an absent-event enumeration is unnecessary.

## Small, useful models

### A completed one-participant HBB run

Take participants `{p}`, Value `{v}` (v also serves as the learner), learner quorum basis `[{p}]`, and live(p,H)=true at every time. Use a strictly chained DAG:

```
propose(v) -> echo(v) -> vote(v,v) -> deliver(v,v,v) -> dagger
```

Each tuple's time is the transitive closure of earlier tuples in the chain; root is all five tuples. For HBBSafe, safe(v) is true at every participant/time. For HBBCorr, use `deliver(v,v)` and corr(v,v)=true everywhere.

The final dagger/null observation is necessary in this completed live example: every real event at a live source, including the last deliver, must eventually be known at one of that participant’s actual tuples to satisfy ThyLive. The synthetic root world is not itself such a tuple. This finite run satisfies the full schemes, unlike a chain ending at a real deliver with no later observation.

### Fork / equivocation diagnostic

Have a participant p perform two distinct tuples with equal empty past, e.g. `echo(0)` and `echo(1)`. In the root, p is nonsequential because neither tuple belongs to the other's time. Do not infer sequentiality by merely comparing timestamps/subsets: these times are equal, but the tuples are distinct and unordered. For a valid HBB backward-rule example, place distinct proposes in each fork's past first.

### Empty and minimal models

An empty root H is permitted. Sequentiality holds vacuously. An empty event signature has no Knowledge instances. A canonical minimal nonempty model has one p and one dagger tuple with empty past; no real events occur. These are useful checks of vacuity and inactive-participant UI.

### Majority quorum diagnostic

Three participants with a learner basis `{ab,bc,ac}` form a valid semifilter. Pairwise quorum intersections are nonempty but the triple intersection may be empty. This exercises learner repetition, the difference between HBBSafe/HBBSimp and HBBCorr, and general quorum-box vacuity. KnowledgeBox itself has a single learner, whose quorums are nonempty.

## Exploration boundaries

- This is finite-model checking. A found valid countermodel refutes the requested implication in its stated finite scope. Failure to find one under a search bound is not a proof over unbounded histories.
- A finite prefix with a pending obligation may fail a forward/liveness axiom while having a valid extension. Label these violations as obligations of this completed finite model, not evidence that the protocol can never progress.
- A generator implementing the informal operational algorithm explores one subset of models of the axioms. In particular, enforcing Vote'! operationally at the current time is stronger than the axiom's guarantee. Record generator restrictions, schedules, domain, event bound, quorum choices, and seeds with every search result.
- Model validation, axiom validity, correctness preconditions, and desired property validity should be displayed separately. A property failure in a model that violates the selected theory is not a countermodel to that theory's correctness claim.
- Preserve a machine-readable model format, deterministic CLI/API and seeded generation. Protocol designs should be data (named editable axiom sets), rather than compiled cases hidden in the evaluator.

Named API queries validate their theory name. `HBBSafe`, `HBBSimp` and `HBBCorr` each provide the three correctness claims above; `ThyLive` has no protocol-specific claim list. Unknown or misspelled names raise an error.
