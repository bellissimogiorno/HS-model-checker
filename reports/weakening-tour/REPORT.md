# Reproducible protocol and axiom-variant tour

Version 0.6.9; suite all. Each exact declared finite history, value domain and quorum basis; all predicate interpretations with supplied positive facts pinned. No history extensions. These results are not unbounded proofs.

“Holds” means no counterexample in the exact scope above. “Scenario absent” identifies a true conditional whose complete premise and trigger are not jointly exercised. A no-model row establishes inconsistency of that fixed history with the retained assumptions; every correctness claim remains not tested.

| Theory | Case | Assumptions | Liveness 1 | Liveness 2 | Agreement |
|---|---|---|---|---|---|
| ThyHBB1 | HBB1 completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| ThyHBB1 | HBB1 missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 remove Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB1 | HBB1 missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 remove Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB1 | HBB1 missing deliver, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 remove Deliver! | Model; all retained axioms pass | **Fails; scenario present** | **Fails; scenario present** | Holds; scenario present |
| ThyHBB1 | HBB1 missing votes, Safe retained | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 remove Safe definition | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB1 | HBB1 choose one of two proposed values | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario present | Holds; scenario present |
| ThyHBB1 | HBB1 incorrect universal Echo! | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 unsafe votes, full safety guard | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB1 | HBB1 omit Vote? safety guard | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB2 | Completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| ThyHBB2 | Two values, full EchoNE | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB2 | Remove EchoNE | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB2 | Restrict EchoNE to live participants | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB2 | Missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB2 | Remove Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB2 | Missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB2 | Remove Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB2 | Missing delivery, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB2 | Remove Deliver! | Model; all retained axioms pass | **Fails; scenario present** | **Fails; scenario present** | Holds; scenario present |
| ThyHBB3 | HBB3 completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| ThyHBB3 | Remove CorrSeq: correlated fork | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB3 | Remove CorrPast: correlation arrives late | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB3 | Remove VoteNE: sequential conflicting votes | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| ThyHBB3 | Remove 3twined: pairwise overlap only | Model; all retained axioms pass | Holds; scenario absent | **Fails; scenario present** | Holds; scenario present |
| ThyHBB3 | HBB3 missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB3 | Remove HBB3 Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB3 | HBB3 missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB3 | Remove HBB3 Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB3 | HBB3 missing delivery, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| ThyHBB3 | Remove HBB3 Deliver! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| ThyHBB3 | Remove Vote'!: correlated target stalls | Model; all retained axioms pass | Holds; scenario absent | **Fails; scenario present** | Holds; scenario present |
| ThyHBB3 | Correct correlation allows this history | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | Holds; scenario absent |
| ThyHBB3 | Incorrect correlation equivalence rejects it | No model on fixed history | Not tested | Not tested | Not tested |

45/45 model and counterexample certificates replayed successfully. Every consistent row retains complete dynamic ThyLive. Every failed canonical conditional has its premise and trigger checked at the same failure world and value assignment.

Concrete countermodels establish what the edited theory permits in these histories; they do not show every alternative weakening has the same consequence. Incorrect overstrong axiom candidates are assessed separately: rejecting an otherwise valid behavior is not a counterexample to a baseline correctness theorem.

## Paper-based diagnostic probes

| Theory | Case | Probe | Result |
|---|---|---|---|
| ThyHBB1 | HBB1 choose one of two proposed values | Bad Echo! | Candidate/probe is false in a valid retained-theory model |
| ThyHBB3 | Correct correlation allows this history | Incorrect correlation equivalence | Candidate/probe is false in a valid retained-theory model |

## Concrete correctness failures

- **HBB1 remove Echo!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBB1 remove Vote!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBB1 remove Deliver!, Liveness 1:** participant q, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBB1 remove Deliver!, Liveness 2:** participant q, time end; a="v", b="v", l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBB1 remove Safe definition, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBB1 omit Vote? safety guard, Agreement:** participant p, time end; a="c", b="c", l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove EchoNE, Agreement:** participant p, time end; a="red", b="red", l="red", m="red", v="red", w="blue". Premise=true, trigger=true, conclusion=false.
- **Restrict EchoNE to live participants, Agreement:** participant p, time end; a="red", b="red", l="red", m="red", v="red", w="blue". Premise=true, trigger=true, conclusion=false.
- **Remove Echo!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Vote!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Deliver!, Liveness 1:** participant q, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Deliver!, Liveness 2:** participant q, time end; a="v", b="v", l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove CorrSeq: correlated fork, Agreement:** participant p, time end; l="a", m="a", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove CorrPast: correlation arrives late, Agreement:** participant r, time end; l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove VoteNE: sequential conflicting votes, Agreement:** participant r, time end; l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove 3twined: pairwise overlap only, Liveness 2:** participant p, time end; l="a", m="b", v="a". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBB3 Echo!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBB3 Vote!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBB3 Deliver!, Liveness 1:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Vote'!: correlated target stalls, Liveness 2:** participant p, time end; l="a", m="b", v="a". Premise=true, trigger=true, conclusion=false; participant live=true.

## Source references

- **hbb1-complete-baseline:** examples/theories/hbb1.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-echo-progress-full:** examples/theories/hbb1-echo-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-echo-progress-removed:** examples/theories/hbb1-echo-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-vote-progress-full:** examples/theories/hbb1-vote-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-vote-progress-removed:** examples/theories/hbb1-vote-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-deliver-progress-full:** examples/theories/hbb1-deliver-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-deliver-progress-removed:** examples/theories/hbb1-deliver-progress.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive).
- **hbb1-safe-full:** examples/theories/hbb1-safe-removed.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Remark 6.2.2, p. 44; Lemma 6.5.2, pp. 47–48 (unique-proposal safety).
- **hbb1-safe-removed:** examples/theories/hbb1-safe-removed.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Remark 6.2.2, p. 44; Lemma 6.5.2, pp. 47–48 (unique-proposal safety).
- **hbb1-echo-choice-correct:** examples/theories/hbb1-echo-choice.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Remark 6.2.3(2), p. 44 (literal incorrect Echo!); Definition 5.2.1(3), p. 37 (implicit universal closure of open axioms).
- **hbb1-echo-choice-wrong:** examples/theories/hbb1-echo-choice-wrong.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Remark 6.2.3(2), p. 44 (literal incorrect Echo!); Definition 5.2.1(3), p. 37 (implicit universal closure of open axioms).
- **hbb1-vote-safe-full:** examples/theories/hbb1-vote-safe.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Proposition 6.3.1, p. 45 (Agreement proof uses Vote? safety and Safe).
- **hbb1-vote-safe-omitted:** examples/theories/hbb1-vote-safe-omitted.md; Figure 7, p. 41; Definition 6.1.2 (ThyHBB1); Figure 8, p. 41; Theorem 6.1.6, p. 43 (conditional correctness); Figure 6, p. 38; Definition 5.2.4 (complete ThyLive); Proposition 6.3.1, p. 45 (Agreement proof uses Vote? safety and Safe).
- **complete-baseline:** examples/theories/hbb2.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **echo-ne-full:** examples/theories/echo-ne.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **echo-ne-removed:** examples/theories/echo-ne.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **echo-ne-live-only:** examples/theories/echo-ne-live-only.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **echo-progress-full:** examples/theories/echo-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **echo-progress-removed:** examples/theories/echo-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **vote-progress-full:** examples/theories/vote-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **vote-progress-removed:** examples/theories/vote-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **deliver-progress-full:** examples/theories/deliver-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **deliver-progress-removed:** examples/theories/deliver-progress.md; Definition 7.1.1, p. 49; Figure 9, p. 50; Theorem 7.1.3, p. 51; Figure 10, p. 50; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-complete-baseline:** examples/theories/hbb3.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-corr-seq-removed:** examples/theories/hbb3-corr-seq.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-corr-past-removed:** examples/theories/hbb3-corr-past.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-vote-ne-removed:** examples/theories/hbb3-vote-ne.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-three-twined-removed:** examples/theories/hbb3-three-twined.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38; Remark 8.6.2, pp. 60-61; Lemma 8.4.3, p. 58.
- **hbb3-echo-progress-full:** examples/theories/hbb3-echo-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-echo-progress-removed:** examples/theories/hbb3-echo-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-vote-progress-full:** examples/theories/hbb3-vote-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-vote-progress-removed:** examples/theories/hbb3-vote-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-deliver-progress-full:** examples/theories/hbb3-deliver-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-deliver-progress-removed:** examples/theories/hbb3-deliver-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38.
- **hbb3-vote-prime-progress-removed:** examples/theories/hbb3-vote-prime-progress.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38; Remark 8.2.2(4) and footnote 54, p. 57.
- **hbb3-corr-definition-valid:** examples/theories/hbb3-corr-definition.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38; Remark 8.6.4, p. 61; Remark 8.1.1(2), pp. 54-55.
- **hbb3-corr-definition-wrong:** examples/theories/hbb3-corr-definition-wrong.md; Definition 8.2.1, p. 55; Figure 11, p. 56; Theorem 8.2.3, p. 57; Figure 12, p. 56; Definition 5.2.4 and Figure 6, p. 38; Remark 8.6.4, p. 61; Remark 8.1.1(2), pp. 54-55.

## Saved evidence

Each case has `run.json`; consistent cases have a model certificate and certificates for false correctness properties or diagnostic probes. Replay with:

```sh
node src/cli.mjs replay OUTPUT_DIRECTORY/CASE_ID/PROPERTY.evidence.json
```

- [hbb1-complete-baseline: model.evidence.json](hbb1-complete-baseline/model.evidence.json)
- [hbb1-echo-progress-removed: model.evidence.json](hbb1-echo-progress-removed/model.evidence.json)
- [hbb1-echo-progress-removed: liveness-1.evidence.json](hbb1-echo-progress-removed/liveness-1.evidence.json)
- [hbb1-vote-progress-removed: model.evidence.json](hbb1-vote-progress-removed/model.evidence.json)
- [hbb1-vote-progress-removed: liveness-1.evidence.json](hbb1-vote-progress-removed/liveness-1.evidence.json)
- [hbb1-deliver-progress-removed: model.evidence.json](hbb1-deliver-progress-removed/model.evidence.json)
- [hbb1-deliver-progress-removed: liveness-1.evidence.json](hbb1-deliver-progress-removed/liveness-1.evidence.json)
- [hbb1-deliver-progress-removed: liveness-2.evidence.json](hbb1-deliver-progress-removed/liveness-2.evidence.json)
- [hbb1-safe-removed: model.evidence.json](hbb1-safe-removed/model.evidence.json)
- [hbb1-safe-removed: liveness-1.evidence.json](hbb1-safe-removed/liveness-1.evidence.json)
- [hbb1-echo-choice-correct: model.evidence.json](hbb1-echo-choice-correct/model.evidence.json)
- [hbb1-echo-choice-correct: diagnostic-bad-echo.evidence.json](hbb1-echo-choice-correct/diagnostic-bad-echo.evidence.json)
- [hbb1-vote-safe-omitted: model.evidence.json](hbb1-vote-safe-omitted/model.evidence.json)
- [hbb1-vote-safe-omitted: agreement.evidence.json](hbb1-vote-safe-omitted/agreement.evidence.json)
- [complete-baseline: model.evidence.json](complete-baseline/model.evidence.json)
- [echo-ne-removed: model.evidence.json](echo-ne-removed/model.evidence.json)
- [echo-ne-removed: agreement.evidence.json](echo-ne-removed/agreement.evidence.json)
- [echo-ne-live-only: model.evidence.json](echo-ne-live-only/model.evidence.json)
- [echo-ne-live-only: agreement.evidence.json](echo-ne-live-only/agreement.evidence.json)
- [echo-progress-removed: model.evidence.json](echo-progress-removed/model.evidence.json)
- [echo-progress-removed: liveness-1.evidence.json](echo-progress-removed/liveness-1.evidence.json)
- [vote-progress-removed: model.evidence.json](vote-progress-removed/model.evidence.json)
- [vote-progress-removed: liveness-1.evidence.json](vote-progress-removed/liveness-1.evidence.json)
- [deliver-progress-removed: model.evidence.json](deliver-progress-removed/model.evidence.json)
- [deliver-progress-removed: liveness-1.evidence.json](deliver-progress-removed/liveness-1.evidence.json)
- [deliver-progress-removed: liveness-2.evidence.json](deliver-progress-removed/liveness-2.evidence.json)
- [hbb3-complete-baseline: model.evidence.json](hbb3-complete-baseline/model.evidence.json)
- [hbb3-corr-seq-removed: model.evidence.json](hbb3-corr-seq-removed/model.evidence.json)
- [hbb3-corr-seq-removed: agreement.evidence.json](hbb3-corr-seq-removed/agreement.evidence.json)
- [hbb3-corr-past-removed: model.evidence.json](hbb3-corr-past-removed/model.evidence.json)
- [hbb3-corr-past-removed: agreement.evidence.json](hbb3-corr-past-removed/agreement.evidence.json)
- [hbb3-vote-ne-removed: model.evidence.json](hbb3-vote-ne-removed/model.evidence.json)
- [hbb3-vote-ne-removed: agreement.evidence.json](hbb3-vote-ne-removed/agreement.evidence.json)
- [hbb3-three-twined-removed: model.evidence.json](hbb3-three-twined-removed/model.evidence.json)
- [hbb3-three-twined-removed: liveness-2.evidence.json](hbb3-three-twined-removed/liveness-2.evidence.json)
- [hbb3-echo-progress-removed: model.evidence.json](hbb3-echo-progress-removed/model.evidence.json)
- [hbb3-echo-progress-removed: liveness-1.evidence.json](hbb3-echo-progress-removed/liveness-1.evidence.json)
- [hbb3-vote-progress-removed: model.evidence.json](hbb3-vote-progress-removed/model.evidence.json)
- [hbb3-vote-progress-removed: liveness-1.evidence.json](hbb3-vote-progress-removed/liveness-1.evidence.json)
- [hbb3-deliver-progress-removed: model.evidence.json](hbb3-deliver-progress-removed/model.evidence.json)
- [hbb3-deliver-progress-removed: liveness-1.evidence.json](hbb3-deliver-progress-removed/liveness-1.evidence.json)
- [hbb3-vote-prime-progress-removed: model.evidence.json](hbb3-vote-prime-progress-removed/model.evidence.json)
- [hbb3-vote-prime-progress-removed: liveness-2.evidence.json](hbb3-vote-prime-progress-removed/liveness-2.evidence.json)
- [hbb3-corr-definition-valid: model.evidence.json](hbb3-corr-definition-valid/model.evidence.json)
- [hbb3-corr-definition-valid: diagnostic-incorrect-correlation-equivalence.evidence.json](hbb3-corr-definition-valid/diagnostic-incorrect-correlation-equivalence.evidence.json)
