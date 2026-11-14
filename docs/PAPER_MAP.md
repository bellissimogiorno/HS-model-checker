# Paper-to-code source map

Source: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, **Murdoch J. Gabbay and Isaac Sheff**, draft **2026-11-07**. Every page below is a printed draft page; those numbers match the PDF pages. The displayed protocol figures and the alternative formulas were checked against the rendered PDF. A figure caption can cite a theorem that appears on a later page: the figure page and theorem page are recorded separately below.

The [executable theories](../examples/theories/) are pedagogical finite scenarios or explicitly identified weakening/alternative experiments. Their histories, facts, and extra scenario assumptions are supplied by this project. An unchanged protocol block translates the paper's theory; the whole example file is not a literal theory copied from the paper. Every executable declaration has an immediately preceding `# Paper:` or `# Scenario:` comment explaining its source and meaning. [Theory syntax](THEORY_FORMAT.md), [protocol formulas](PROTOCOLS.md), and [model semantics](SEMANTICS.md) explain execution.

## Definitions and evaluation scopes

| Subject | Exact draft source | Code interpretation |
| --- | --- | --- |
| History structures | Definition 2.3.5, p. 11 | A tuple's `past` denotes its complete transitive history; silent `null`/† observations are actual tuples. |
| Signatures; learner/value domain | Definitions 3.1.1 and 3.1.3, pp. 17-18 | Learner and value variables range over the same nonempty `values` domain. |
| Quorum systems (semifilters) | Definition 3.3.2, pp. 19-20 | A nonempty upward-closed family of pairwise-intersecting nonempty sets, represented by minimal quorum bases. Closure under intersections is not required. |
| Models and predicate interpretations | Definition 3.3.3, p. 20 | Facts interpret predicates by participant and time; events are fixed history tuples. |
| Possible worlds and accessibility | Definition 3.4.2, p. 22 | Actual history accessibility differs from the full set of possible worlds. |
| Sequentiality | Definition 3.4.9, pp. 23-24 | Local tuples must be ordered by actual history membership, not merely comparable timestamp sets. |
| Validity | Definition 3.4.10 and Figure 3, pp. 24-25 | Protocol axioms use all possible worlds; `[end]` properties use each participant at root/end time. |
| Syntactic sugar | Definition 3.6.1, p. 26; Figures 4 and 5, p. 27 | Defines the derived connectives, modalities and uniqueness quantifiers below. |
| Quorum intersections | Lemma 4.1.1, pp. 32-33; Notation 4.1.2, p. 33 | Every learner occurrence chooses a quorum independently, including repeated occurrences of the same learner. |
| Axiomatic theories | Definition 5.2.1 and Remark 5.2.2, p. 37 | Every axiom is universally closed and must hold at every possible world, not only actual tuples or end time. |

`first-steps.md` illustrates interpreted predicates and uniqueness; `majority.md` and `heterogeneous.md` illustrate semifilters and n-way intersection. Their named claims are educational probes, not HBB axioms or correctness theorems.

## Scalar, quantifier and modal ASCII aliases

The aliases describe formulas, not extra mathematical assumptions. See the definitions and figures cited above.

| Checker syntax | Paper notation | Meaning and source |
| --- | --- | --- |
| `true`, `false` | ⊤, ⊥ | Truth and falsity; Figures 4-5, p. 27. |
| `not`, `&`, `\|`, `->`, `<->` | ¬, ∧, ∨, ⇒, ⇔ | Boolean connectives; Figures 2-5, pp. 17, 24, 27. |
| `v=w` | Value equality | Equality of values, distinct from correlation; Figures 2-3, pp. 17, 24. |
| `forall v.`, `exists v.` | ∀v, ∃v | Universal and existential quantification over the whole value domain; Figures 2-5, pp. 17, 24, 27. |
| `exists1 v.` | ∃₁v | Exactly one value; Figures 4-5, p. 27. |
| `exists01 v.` | ∃₀₁v | At most one value, including none; Figures 4-5, p. 27. |
| `past F` | ↓F | Some actual earlier tuple at the current participant satisfies F; Figures 2-3, pp. 17, 24. |
| `allpast F` | ⇓F | Every actual earlier local tuple satisfies F; Figures 4-5, p. 27. |
| `end F` | Paper's end-of-time operator | Evaluate F at the current participant, †, and root history; Figures 2-3, pp. 17, 24. |
| `sometime F` | ↕F | Some actual local tuple anywhere in the completed run satisfies F; Figures 4-5, p. 27. It need not occur later than the evaluation world. |
| `everytime F` | ⇕F | Every actual local tuple in the completed run satisfies F; Figures 4-5, p. 27. This is not all-world validity. |
| `dia[l,m] F` | ♢ with learner list l,m | Every independently chosen l/m quorum intersection contains a participant satisfying F; Figure 3, p. 24; Lemma 4.1.1, pp. 32-33. |
| `box[l,m] F` | □ with learner list l,m | De Morgan dual of `dia`; Figures 4-5, p. 27. |
| `dia[] F`, `box[] F` | Empty-list ♢, □ | Some participant / every participant at the current time, with event reset to †; Figure 3, p. 24. |
| `dia[ls] past F`, `box[ls] past F` | ♢↓, □↓ with learner list | Quorum modalities composed with local actual-past knowledge; Figures 4-5, p. 27. |
| `seq`, `live`, `safe(l)` | seq, live, safe(l) | Structural sequentiality, liveness predicate, HBB1 safety predicate; Definition 3.4.9, pp. 23-24; Figures 6-7, pp. 38, 41. |
| `corr(l,m)` | $l\mathrel{\dot{=}}m$ | Interpreted correlation predicate, not value equality; Section 8.1, pp. 54-55; Figure 11, p. 56. |

## ThyLive: every included axiom and scheme

Definition **5.2.4**, Figure **6**, p. **38**. `include ThyLive` dynamically regenerates the full schemes when an example changes. All four rows use all-world validity (Definition 5.2.1, p. 37).

| Code name | Paper label | Meaning |
| --- | --- | --- |
| `LiveAlways` | LiveAlways | A participant's liveness is independent of time. |
| `LiveSeq` | LiveSeq | A live participant is sequential. |
| `KnowledgeDia` | Knowledge♢↓ | A live participant eventually knows an event that occurred at some live participant. E ranges over every ground event. |
| `KnowledgeBox` | Knowledge□↓ | A live participant eventually knows an event known throughout an appropriate live quorum intersection. E ranges over every ground event and the scheme ranges over every finite learner list, including the empty list and repetitions. |

Finite implementation saturation identifies equivalent learner-intersection families and checks a representative of absent events; it does not replace the schemes by a bounded subset. Exhausted saturation reports inconclusive. `LiveActive` is not an axiom of Figure 6 (Remark 5.2.12, pp. 39-40).

## ThyHBB1: every canonical rule

Definition **6.1.2**, pp. **41-42**; Figure **7**, p. **41**, including ThyLive above. Event order is `propose(value)`, `echo(value)`, `vote(sourceLearner,value)`, **`deliver(reportingLearner,sourceLearner,value)`** (Notation 6.1.3 and Remark 6.1.4, p. 42).

| Code / paper label | Meaning in Figure 7, p. 41 |
| --- | --- |
| `Echo?` | An echo requires knowledge of a proposal of that value. |
| `Vote?` | A vote requires a safe source learner and knowledge of its quorum of matching echoes. |
| `Deliver?` | A delivery requires knowledge of a reporting-learner quorum of matching source-learner votes. |
| `EchoNE` | A current echo and an actual earlier local echo must have equal values; incomparable fork echoes are not compared. |
| `Safe` | Safety holds exactly when at most one proposal value is known, or the source learner has sequential quorum intersections with every learner. |
| `Echo!` | A live participant knowing a proposal must sometime echo an existentially chosen value. |
| `Vote!` | If the source learner is safe at every actual local event, a live participant knowing matching quorum echoes must sometime cast that vote. |
| `Deliver!` | A live participant knowing matching reporting-quorum votes must sometime make the corresponding delivery. |

## ThyHBB2: every canonical rule

Definition **7.1.1**, p. **49**; Figure **9**, p. **50**, including ThyLive. Event argument order is the HBB1 triple described above; HBB2 has no `safe` predicate.

| Code / paper label | Meaning in Figure 9, p. 50 |
| --- | --- |
| `Echo?` | An echo requires knowledge of a proposal of that value. |
| `Vote?` | A vote requires knowledge of a source-learner quorum of matching echoes. |
| `Deliver?` | A delivery requires knowledge of a reporting-learner quorum of matching source-learner votes. |
| `EchoNE` | A current echo and an actual earlier local echo must have equal values. |
| `Echo!` | A live participant knowing a proposal must sometime echo an existentially chosen value. |
| `Vote!` | A live participant knowing matching source-quorum echoes must sometime cast that vote. |
| `Deliver!` | A live participant knowing matching reporting-quorum votes must sometime make the corresponding delivery. |

## ThyHBB3: every canonical rule and dotted label

Definition **8.2.1**, p. **55**; Figure **11**, p. **56**, including ThyLive. `propose(v)`, `echo(v)` and `vote(l,v)` keep their order; delivery becomes the pair **`deliver(learner,value)`**. The source learner can be hidden within a correlated chain of votes (Remark 8.2.2, pp. 55, 57).

| Code name | Exact paper label in Figure 11, p. 56 | Meaning |
| --- | --- | --- |
| `Echo?` | Echo? | An echo requires knowledge of a proposal of that value. |
| `Vote?` | Vote? | A vote requires matching quorum echoes or knowledge of a matching vote for a currently correlated learner. |
| `Deliver?` | Deliver? | Delivery for a learner requires knowledge of its quorum of matching votes. |
| `EchoNE` | EchoNE | A current echo and an actual earlier local echo must have equal values. |
| `VoteNE` | VoteNE | A current vote and an actual earlier local vote for correlated learners must have equal values. |
| `3twined` | 3twined | Every triple of independently chosen quorums intersects; learner names may repeat. |
| `CorrSeq` | $(\dot{=}\mathrm{seq})$ | Correlated learners have sequential quorum intersections. |
| `CorrPast` | $(\dot{=}\Downarrow)$, printed dotted-equality **⇓** | Correlation persists to actual earlier local tuples; this does not quantify over every possible world. |
| `CorrSymm` | $(\dot{=}\mathrm{symm})$ | Correlation is symmetric. |
| `CorrTran` | $(\dot{=}\mathrm{tran})$ | Correlation is transitive. Together with symmetry this gives a partial equivalence relation; reflexivity is not required. |
| `Echo!` | Echo! | A live participant knowing a proposal must sometime echo an existentially chosen value. |
| `Vote!` | Vote! | A live participant knowing matching quorum echoes must sometime vote for some existentially chosen value. |
| `Vote'!` | Vote’! | Correlation at every actual local event, plus knowledge of a correlated vote, requires a live participant sometime to vote for some existentially chosen value. |
| `Deliver!` | Deliver! | A live participant knowing a quorum of matching votes must sometime deliver for that learner. |

The existential choices in both HBB3 voting forward rules are deliberate. The paper's informal operational `Vote'!` step assumes current-time correlation, while the axiom assumes correlation at every local event; footnote 54, p. 57, explicitly permits this distinction.

## Every canonical correctness property

Each executable formula retains the complete theorem premises and uses `[end]`. The scenario/non-vacuity probe is separate: an implication that holds because its premise or trigger is absent does not demonstrate delivery behavior. A failed property on a history that violates retained axioms is not a countermodel to the retained theory.

| Theory / code property | Statement figure | Theorem | Proof | Distinguishing premise |
| --- | --- | --- | --- | --- |
| HBB1 `Liveness 1` | Figure 8, p. 41 | 6.1.6, p. 43 | Proposition 6.5.3, p. 48 | Live l-quorum, exactly one proposed value, and proposal knowledge at a live participant; delivers `(l,l,v)`. |
| HBB1 `Liveness 2` | Figure 8, p. 41 | 6.1.6, p. 43 | Proposition 6.4.5, p. 47 | Reporting learners intersect, target reporting quorum is live, source learner is safe everywhere at end time. |
| HBB1 `Agreement` | Figure 8, p. 41 | 6.1.6, p. 43 | Proposition 6.3.1, p. 45 | Sequential intersection of the **reporting** learners. |
| HBB2 `Liveness 1` | Figure 10, p. 50 | 7.1.3, p. 51 | Proposition 7.3.3, p. 53 | Live l-quorum, exactly one proposed value, and proposal knowledge at a live participant; delivers `(l,l,v)`. |
| HBB2 `Liveness 2` | Figure 10, p. 50 | 7.1.3, p. 51 | Proposition 7.3.2, pp. 52-53 | Reporting learners intersect and target reporting quorum is live; no safety premise. |
| HBB2 `Agreement` | Figure 10, p. 50 | 7.1.3, p. 51 | Proposition 7.3.1, p. 52 | Sequential intersection of the **source** learners. |
| HBB3 `Liveness 1` | Figure 12, p. 56 | 8.2.3, p. 57 | Proposition 8.5.1, pp. 59-60 | Live l-quorum, exactly one proposed value, and proposal knowledge at a live participant; delivers `(l,v)`. |
| HBB3 `Liveness 2` | Figure 12, p. 56 | 8.2.3, p. 57 | Proposition 8.4.5, p. 59 | The two learners are correlated at every participant at end time and the target learner has a live quorum. |
| HBB3 `Agreement` | Figure 12, p. 56 | 8.2.3, p. 57 | Proposition 8.3.1, p. 57 | The two learners are correlated at every participant at end time. |

In particular, **7.2.1 is a discussion remark, not a correctness proof**. Theorem 7.1.3 cites Propositions 7.3.3, 7.3.2, and 7.3.1; there is no Proposition 7.4.1 in this draft.

## Incorrect variants versus valid alternatives

The paper explicitly rejects the universally closed Echo! replacement missing its existential choice (Remark 6.2.3(2), p. 44) and the definition of correlation as exactly sequential quorum intersection (Remark 8.6.4, p. 61). Stronger `EchoNE'` (Remark 6.2.4, p. 45), end-of-time correlation persistence (Remark 8.3.2, pp. 57-58), the weaker intersection premise (Remark 8.6.2, equation (4), p. 61), and alternative voting (Remark 8.6.3, p. 61) have different, explicitly stated statuses; a difference from the baseline does not itself make an alternative wrong. [Paper variants and axiom experiments](PAPER_VARIANTS.md) gives their literal formulas, qualifications, and executable file links.

## Programmatic source metadata

Built-in axiom records distinguish `figurePage` from `definitionPage`: HBB2's definition starts on p. 49 while Figure 9 is on p. 50, and HBB3's definition starts on p. 55 while Figure 11 is on p. 56. Correctness records use `theorem`/`theoremPage` and `proposition`/`propositionPage`; their `page` and `figurePage` identify the statement figure. This avoids conflating a figure's location with the later theorem statement or proof. Formula syntax and semantics are unchanged.
