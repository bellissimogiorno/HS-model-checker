# Paper-to-code source map

Source: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, **Murdoch J. Gabbay and Isaac Sheff**, draft **18 November 2026**, supplied as `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`. Page numbers below are printed draft pages and match PDF pages. Definition text and its displayed figure sometimes occupy different pages; both are identified where useful.

The [executable theories](../examples/theories/) combine the paper's axioms with pedagogical finite histories, explicit scenario assumptions and controlled changes. A file is not a literal run copied from the paper. Every executable declaration has an immediately preceding `# Paper:` or `# Scenario:` comment. The protocol rules remain editable; `include ThyLive` regenerates the complete liveness theory for each candidate history. See [theory syntax](THEORY_FORMAT.md), [protocol formulas](PROTOCOLS.md), [semantics](SEMANTICS.md) and [axiom variants](PAPER_VARIANTS.md).

## Definitions and evaluation scopes

| Subject | Draft source | Implementation |
| --- | --- | --- |
| Histories | Definitions 2.3.1–2.3.5, pp. 14–15 | Complete ancestor closure and canonical set-valued tuples; silent `null`/† observations are actual tuples. |
| Signatures and values | Definitions 3.1.1 and 3.1.3, p. 21; Figure 3, p. 22 | Learners and values share one nonempty `values` domain; event and predicate arities are unrestricted by the mathematics. |
| Quorum systems | Definition 3.3.2, pp. 23–24 | Nonempty up-closed families of nonempty, pairwise-intersecting participant sets, represented by minimal bases. Intersection closure is not assumed. |
| Models and interpretations | Definition 3.3.3, p. 24 | Predicate truth depends on participant and represented time; history tuples fix event occurrence. |
| Worlds and accessibility | Definition 3.4.2, p. 27 | Represented times are tuple pasts plus the full history. Possible worlds include hypothetical worlds outside the actual tuples. |
| Sequentiality | Definition 3.4.9, p. 28 | Actual local tuples are equal or ordered by membership in one another's pasts. Comparable timestamp sets alone are insufficient. |
| Validity | Definition 3.4.10, p. 28; Figure 4, p. 29 | All-world validity for axioms; end validity for the canonical correctness properties. |
| Syntactic sugar | Definition 3.6.1, p. 31; Figures 5–6, p. 32 | Derived Boolean operators, cardinality quantifiers and modalities. |
| Quorum intersections | Lemma 4.1.1, p. 37; Notation 4.1.2, p. 38 | Each learner occurrence makes an independent quorum choice, including repetitions. |
| Axiomatic theories | Definition 5.2.1, p. 42 | Paper axioms are universally closed and checked at every possible world. Executable input writes its value quantifiers explicitly. |

`first-steps.md` illustrates predicate interpretations and uniqueness. `majority.md` and `heterogeneous.md` illustrate semifilters and multi-learner intersections. Their educational claims are not protocol correctness theorems.

## Notation and input aliases

These spellings express formulas; they add no assumptions.

| Checker syntax | Paper notation | Meaning |
| --- | --- | --- |
| `true`, `false` | ⊤, ⊥ | Truth and falsity; Figures 5–6, p. 32. |
| `not`, `&`, `\|`, `->`, `<->` | ¬, ∧, ∨, ⇒, ⇔ | Boolean connectives; Figures 3–6, pp. 22, 29, 32. |
| `v=w` | Value equality | Equality under the value valuation, distinct from correlation. |
| `forall v.`, `exists v.` | ∀v, ∃v | Quantification over the whole value/learner domain. |
| `exists1 v.` | ∃=1 v | Exactly one satisfying value. |
| `exists01 v.` | ∃⩽1 v | At most one satisfying value. `∃≤1` and the compact input aliases are also accepted. |
| `past F` | ↓F | Some actual earlier local tuple satisfies F; Figure 4, p. 29. |
| `allpast F` | ⇓F | Every actual earlier local tuple satisfies F; Figures 5–6, p. 32. |
| `end F` | End-of-time operator | Evaluate F at the same participant, † and the full history. |
| `sometime F` | ↕F | Some actual local tuple in the complete run satisfies F. This does not impose a future ordering. |
| `everytime F` | ⇕F | Every actual local tuple in the complete run satisfies F; this is not all-world validity. |
| `dia[l,m] F` | ♢ with learner list l,m | Every independently chosen quorum intersection contains a participant satisfying F. |
| `box[l,m] F` | □ with learner list l,m | Some such intersection consists entirely of participants satisfying F. |
| `dia[] F`, `box[] F` | Empty-list ♢, □ | Some participant / every participant at the current time, with current event reset to †. |
| `dia[ls] past F`, `box[ls] past F` | Composed quorum/past modalities | Quorum modalities followed by local actual-past knowledge. |
| `seq`, `live`, `safe(l)` | seq, live, safe(l) | Structural sequentiality and interpreted liveness/safety predicates. |
| `corr(l,m)` | Dotted correlation | An interpreted relation, distinct from equality; Section 8.1, pp. 60–62. |

General learner lists remain part of the language. The `KnowledgeBox` axiom below uses **one** learner, rather than an arbitrary list.

## ThyLive

Definition **5.2.4** and Figure **7**, p. **43**. Every row uses all-world validity (Definition 5.2.1, p. 42). `include ThyLive` dynamically regenerates both Knowledge schemes for each model.

| Code name | Paper label | Exact reading |
| --- | --- | --- |
| `LiveAlways` | LiveAlways | `live ⇔ end live`: liveness is independent of time. |
| `LiveSeq` | LiveSeq | `live ⇒ seq`: live participants are sequential. |
| `KnowledgeDia` | Knowledge♢↓ | `end (♢[] ↓ (live ∧ E)) ⇒ live ⇒ ↕ (♢[] ↓ E)`, for every ground event E. |
| `KnowledgeBox` | Knowledge□↓ | `end (□[l] ↓ (live ∧ E)) ⇒ live ⇒ ↕ (□[l] ↓ E)`, for every ground event E and every single learner l. |

An absent event makes both antecedents false, because event truth requires an actual tuple and each single learner's quorums are nonempty. The finite implementation therefore instantiates all distinct occurring ground events and every learner. It does not strengthen ThyLive by adding arbitrary-list KnowledgeBox instances. `LiveActive` is not an axiom: empty histories remain allowed (Remark 5.2.12, p. 45).

## HBBSafe

Definition **6.2.2**, p. **47**; Figure **8**, p. **48**, including ThyLive. Event order is `propose(value)`, `echo(value)`, `vote(sourceLearner,value)` and **`deliver(reportingLearner,sourceLearner,value)`** (Notation 6.2.3, p. 47).

| Code / paper label | Meaning in Figure 8 |
| --- | --- |
| `Echo?` | An echo requires knowledge of a proposal of that value. |
| `Vote?` | A vote requires a safe source learner and knowledge of its quorum of matching echoes. |
| `Deliver?` | A delivery requires knowledge of a reporting-learner quorum of matching source-learner votes. |
| `EchoNE` | A current echo and an actual earlier local echo have equal values; incomparable forks are not compared. |
| `Safe` | Safety holds exactly when at most one proposal value is known, or the source learner has sequential quorum intersections with every learner. |
| `Echo!` | If an actual local tuple is live and knows a proposal, the participant echoes an existentially chosen value somewhere in the complete run. |
| `Vote!` | With safety at every actual local tuple, an actual live tuple knowing matching quorum echoes requires the matching vote somewhere in the run. |
| `Deliver!` | An actual live tuple knowing matching reporting-quorum votes requires the corresponding delivery somewhere in the run. |

## HBBSimp

Definition **7.1.1**, p. **56**; Figure **10**, p. **57**, including ThyLive. Delivery has the same reporting/source/value order as HBBSafe. There is no `safe` predicate.

| Code / paper label | Meaning in Figure 10 |
| --- | --- |
| `Echo?` | An echo requires knowledge of a proposal of that value. |
| `Vote?` | A vote requires knowledge of a source-learner quorum of matching echoes. |
| `Deliver?` | A delivery requires knowledge of a reporting-learner quorum of matching votes. |
| `EchoNE` | A current echo and an actual earlier local echo have equal values. |
| `Echo!` | An actual live proposal-observing tuple requires an echo of some value in the complete run. |
| `Vote!` | An actual live tuple knowing matching source-quorum echoes requires the matching vote in the complete run. |
| `Deliver!` | An actual live tuple knowing matching reporting-quorum votes requires the corresponding delivery in the complete run. |

## HBBCorr

Definition **8.2.1**, p. **62**; Figure **12**, p. **63**, including ThyLive. Vote remains `vote(learner,value)`; delivery becomes **`deliver(learner,value)`**. Correlated vote chains can hide the source learner (Remark 8.2.2, p. 62).

| Code name | Paper label | Meaning in Figure 12 |
| --- | --- | --- |
| `Echo?` | Echo? | An echo requires knowledge of a matching proposal. |
| `Vote?` | Vote? | A vote requires matching quorum echoes or a known matching vote for a currently correlated learner. |
| `Deliver?` | Deliver? | A delivery requires matching votes known throughout a learner quorum. |
| `EchoNE` | EchoNE | Local actual echo non-equivocation. |
| `VoteNE` | VoteNE | Current and actual earlier local votes for correlated learners have equal values. |
| `3twined` | 3twined | Every triple of independently chosen quorums intersects; learner names may repeat. |
| `CorrSeq` | Dotted-equality seq | Correlated learners have sequential quorum intersections. |
| `CorrPast` | Dotted-equality ⇓ | Correlation persists to actual earlier local tuples. |
| `CorrSymm` | Dotted-equality symm | Correlation is symmetric. |
| `CorrTran` | Dotted-equality tran | Correlation is transitive; reflexivity is not required. |
| `Echo!` | Echo! | An actual live proposal-observing tuple requires an echo of some value. |
| `Vote!` | Vote! | An actual live tuple knowing matching quorum echoes requires a vote for an existentially chosen value. |
| `Vote'!` | Vote’! | An actual live tuple, with correlation at every local event and knowledge of a correlated vote, requires a vote for some value. |
| `Deliver!` | Deliver! | An actual live tuple knowing matching quorum votes requires the corresponding delivery. |

All forward main guards include **↕**. That guard matters because axioms hold at hypothetical worlds too: end-of-time knowledge without an actual qualifying local tuple does not itself trigger progress. Remark **6.3.3(3)**, p. **51**, explains the incorrect Echo! obtained by omitting it. HBBCorr's Vote'! still uses **⇕corr** inside that guard; its distinction from a current-correlation operational step is deliberate (Remark 8.2.2(4), footnote 64, p. 62).

## Correctness properties and proofs

The executable properties are the complete conditional statements, with their premises and triggers, at end-of-time scope. **Agreement** is the checker's concise label for the paper's **Soundness / Agreement**. Learner/value quantifiers range over the same value domain.

| Theory | Property | Figure and collected statement | Proof |
| --- | --- | --- | --- |
| HBBSafe | `Happy Termination` | Figure 9, p. 48; Theorem 6.2.6, p. 49 | Proposition 6.6.3, pp. 54–55 |
| HBBSafe | `Cascade Termination` | Same | Proposition 6.5.5, pp. 53–54 |
| HBBSafe | `Agreement` | Same | Proposition 6.4.1, p. 52 |
| HBBSimp | `Happy Termination` | Figure 11, p. 57; Theorem 7.1.3, p. 57 | Proposition 7.3.3, pp. 59–60 |
| HBBSimp | `Cascade Termination` | Same | Proposition 7.3.2, pp. 59–60 |
| HBBSimp | `Agreement` | Same | Proposition 7.3.1, p. 59 |
| HBBCorr | `Happy Termination` | Figure 13, p. 63; Theorem 8.2.3, p. 64 | Proposition 8.5.1, p. 66 |
| HBBCorr | `Cascade Termination` | Same | Proposition 8.4.5, pp. 65–66 |
| HBBCorr | `Agreement` | Same | Proposition 8.3.1, p. 64 |

Happy Termination assumes a live learner quorum and a uniquely proposed value. HBBSafe Cascade Termination additionally assumes global safety for the source learner. Its Agreement uses sequential **reporting-learner** intersections; HBBSimp uses sequential **source-learner** intersections. HBBCorr Cascade Termination and Agreement use global correlation. These premises must remain in an experiment; replacing them with unconditional delivery or equality changes the claim.

The tour records whether each premise and trigger occur together. A true conditional with an absent scenario is labelled vacuous. A false property in a model violating a retained axiom is not a counterexample to that retained theory.

## Incorrect axioms and valid design alternatives

[The variant guide](PAPER_VARIANTS.md) distinguishes the draft's incorrect formulas from valid alternatives. Executable diagnostics cover missing existential echo choice (Remark 6.3.3(2), p. 51), missing actual-tuple guard (Remark 6.3.3(3), p. 51), and forcing correlation to equal sequential intersection (Remark 8.6.4, p. 68). Other proposed alternatives are documented with their precise status rather than called errors.
