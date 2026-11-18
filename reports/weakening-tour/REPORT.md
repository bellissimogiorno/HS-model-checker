# Reproducible protocol and axiom-variant tour

Version 0.7.1; suite all. Each exact declared finite history, value domain and quorum basis; all predicate interpretations with supplied positive facts pinned. No history extensions. These results are not unbounded proofs.

“Holds” means no counterexample in the exact scope above. “Scenario absent” identifies a true conditional whose complete premise and trigger are not jointly exercised. A no-model row establishes inconsistency of that fixed history with the retained assumptions; every correctness claim remains not tested.

| Theory | Case | Assumptions | Happy Termination | Cascade Termination | Agreement |
|---|---|---|---|---|---|
| HBBSafe | HBBSafe completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| HBBSafe | HBBSafe missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe remove Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBSafe | HBBSafe missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe remove Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBSafe | HBBSafe missing deliver, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe remove Deliver! | Model; all retained axioms pass | **Fails; scenario present** | **Fails; scenario present** | Holds; scenario present |
| HBBSafe | HBBSafe missing votes, Safe retained | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe remove Safe definition | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBSafe | HBBSafe choose one of two proposed values | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario present | Holds; scenario present |
| HBBSafe | HBBSafe incorrect universal Echo! | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe end-only knowledge is not actionable | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | Holds; scenario absent |
| HBBSafe | HBBSafe incorrect end-only Echo! | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe unsafe votes, full safety guard | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSafe | HBBSafe omit Vote? safety guard | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBSimp | Completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| HBBSimp | Two values, full EchoNE | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSimp | Remove EchoNE | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBSimp | Restrict EchoNE to live participants | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBSimp | Missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSimp | Remove Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBSimp | Missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSimp | Remove Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBSimp | Missing delivery, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBSimp | Remove Deliver! | Model; all retained axioms pass | **Fails; scenario present** | **Fails; scenario present** | Holds; scenario present |
| HBBCorr | HBBCorr completed full theory | Model; all retained axioms pass | Holds; scenario present | Holds; scenario present | Holds; scenario present |
| HBBCorr | Remove CorrSeq: correlated fork | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBCorr | Remove CorrPast: correlation arrives late | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBCorr | Remove VoteNE: sequential conflicting votes | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | **Fails; scenario present** |
| HBBCorr | Remove 3twined: pairwise overlap only | Model; all retained axioms pass | Holds; scenario absent | **Fails; scenario present** | Holds; scenario present |
| HBBCorr | HBBCorr missing echo, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBCorr | Remove HBBCorr Echo! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBCorr | HBBCorr missing vote, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBCorr | Remove HBBCorr Vote! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBCorr | HBBCorr missing delivery, full theory | No model on fixed history | Not tested | Not tested | Not tested |
| HBBCorr | Remove HBBCorr Deliver! | Model; all retained axioms pass | **Fails; scenario present** | Holds; scenario absent | Holds; scenario absent |
| HBBCorr | Remove Vote'!: correlated target stalls | Model; all retained axioms pass | Holds; scenario absent | **Fails; scenario present** | Holds; scenario present |
| HBBCorr | Correct correlation allows this history | Model; all retained axioms pass | Holds; scenario absent | Holds; scenario absent | Holds; scenario absent |
| HBBCorr | Incorrect correlation equivalence rejects it | No model on fixed history | Not tested | Not tested | Not tested |

47/47 model and counterexample certificates replayed successfully. Every consistent row retains complete dynamic ThyLive. Every failed canonical conditional has its premise and trigger checked at the same failure world and value assignment.

Concrete countermodels establish what the edited theory permits in these histories; they do not show every alternative weakening has the same consequence. Incorrect overstrong axiom candidates are assessed separately: rejecting an otherwise valid behavior is not a counterexample to a baseline correctness theorem.

## Paper-based diagnostic probes

| Theory | Case | Probe | Result |
|---|---|---|---|
| HBBSafe | HBBSafe choose one of two proposed values | Bad Echo! | Candidate/probe is false in a valid retained-theory model |
| HBBSafe | HBBSafe end-only knowledge is not actionable | Bad end-only Echo! | Candidate/probe is false in a valid retained-theory model |
| HBBCorr | Correct correlation allows this history | Incorrect correlation equivalence | Candidate/probe is false in a valid retained-theory model |

## Concrete correctness failures

- **HBBSafe remove Echo!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBBSafe remove Vote!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBBSafe remove Deliver!, Happy Termination:** participant q, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBBSafe remove Deliver!, Cascade Termination:** participant q, time end; a="v", b="v", l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBBSafe remove Safe definition, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **HBBSafe omit Vote? safety guard, Agreement:** participant p, time end; a="c", b="c", l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove EchoNE, Agreement:** participant p, time end; a="red", b="red", l="red", m="red", v="red", w="blue". Premise=true, trigger=true, conclusion=false.
- **Restrict EchoNE to live participants, Agreement:** participant p, time end; a="red", b="red", l="red", m="red", v="red", w="blue". Premise=true, trigger=true, conclusion=false.
- **Remove Echo!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Vote!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Deliver!, Happy Termination:** participant q, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Deliver!, Cascade Termination:** participant q, time end; a="v", b="v", l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove CorrSeq: correlated fork, Agreement:** participant p, time end; l="a", m="a", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove CorrPast: correlation arrives late, Agreement:** participant r, time end; l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove VoteNE: sequential conflicting votes, Agreement:** participant r, time end; l="a", m="b", v="a", w="b". Premise=true, trigger=true, conclusion=false.
- **Remove 3twined: pairwise overlap only, Cascade Termination:** participant p, time end; l="a", m="b", v="a". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBBCorr Echo!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBBCorr Vote!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove HBBCorr Deliver!, Happy Termination:** participant p, time end; l="v", v="v". Premise=true, trigger=true, conclusion=false; participant live=true.
- **Remove Vote'!: correlated target stalls, Cascade Termination:** participant p, time end; l="a", m="b", v="a". Premise=true, trigger=true, conclusion=false; participant live=true.

## Source references

- **hbb1-complete-baseline:** examples/theories/hbb1.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-echo-progress-full:** examples/theories/hbb1-echo-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-echo-progress-removed:** examples/theories/hbb1-echo-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-vote-progress-full:** examples/theories/hbb1-vote-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-vote-progress-removed:** examples/theories/hbb1-vote-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-deliver-progress-full:** examples/theories/hbb1-deliver-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-deliver-progress-removed:** examples/theories/hbb1-deliver-progress.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive).
- **hbb1-safe-full:** examples/theories/hbb1-safe-removed.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.2, pp. 50–51; Lemma 6.6.2, p. 54–48 (unique-proposal safety).
- **hbb1-safe-removed:** examples/theories/hbb1-safe-removed.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.2, pp. 50–51; Lemma 6.6.2, p. 54–48 (unique-proposal safety).
- **hbb1-echo-choice-correct:** examples/theories/hbb1-echo-choice.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.3(2), p. 51 (literal incorrect Echo!); Definition 5.2.1(3), p. 42 (implicit universal closure of open axioms).
- **hbb1-echo-choice-wrong:** examples/theories/hbb1-echo-choice-wrong.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.3(2), p. 51 (literal incorrect Echo!); Definition 5.2.1(3), p. 42 (implicit universal closure of open axioms).
- **hbb1-echo-end-only-correct:** examples/theories/hbb1-echo-end-only.md; Figure 8, p. 48; Definition 6.2.2, p. 47 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (full conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.3(3), p. 51 (explicitly incorrect missing-sometime Echo!); Remark 5.2.12, pp. 45–46 (LiveActive is optional).
- **hbb1-echo-end-only-wrong:** examples/theories/hbb1-echo-end-only-wrong.md; Figure 8, p. 48; Definition 6.2.2, p. 47 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (full conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Remark 6.3.3(3), p. 51 (explicitly incorrect missing-sometime Echo!); Remark 5.2.12, pp. 45–46 (LiveActive is optional).
- **hbb1-vote-safe-full:** examples/theories/hbb1-vote-safe.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Proposition 6.4.1, p. 52 (Agreement proof uses Vote? safety and Safe).
- **hbb1-vote-safe-omitted:** examples/theories/hbb1-vote-safe-omitted.md; Figure 8, p. 48; Definition 6.2.2 (HBBSafe); Figure 9, p. 48; Theorem 6.2.6, p. 49 (conditional correctness); Figure 7, p. 43; Definition 5.2.4 (complete ThyLive); Proposition 6.4.1, p. 52 (Agreement proof uses Vote? safety and Safe).
- **complete-baseline:** examples/theories/hbb2.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **echo-ne-full:** examples/theories/echo-ne.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **echo-ne-removed:** examples/theories/echo-ne.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **echo-ne-live-only:** examples/theories/echo-ne-live-only.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **echo-progress-full:** examples/theories/echo-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **echo-progress-removed:** examples/theories/echo-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **vote-progress-full:** examples/theories/vote-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **vote-progress-removed:** examples/theories/vote-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **deliver-progress-full:** examples/theories/deliver-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **deliver-progress-removed:** examples/theories/deliver-progress.md; Definition 7.1.1, p. 56; Figure 10, p. 57; Theorem 7.1.3, p. 57; Figure 11, p. 57; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-complete-baseline:** examples/theories/hbb3.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-corr-seq-removed:** examples/theories/hbb3-corr-seq.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-corr-past-removed:** examples/theories/hbb3-corr-past.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-vote-ne-removed:** examples/theories/hbb3-vote-ne.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-three-twined-removed:** examples/theories/hbb3-three-twined.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43; Remark 8.6.2, p. 67; Lemma 8.4.3, p. 58.
- **hbb3-echo-progress-full:** examples/theories/hbb3-echo-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-echo-progress-removed:** examples/theories/hbb3-echo-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-vote-progress-full:** examples/theories/hbb3-vote-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-vote-progress-removed:** examples/theories/hbb3-vote-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-deliver-progress-full:** examples/theories/hbb3-deliver-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-deliver-progress-removed:** examples/theories/hbb3-deliver-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43.
- **hbb3-vote-prime-progress-removed:** examples/theories/hbb3-vote-prime-progress.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43; Remark 8.2.2(4) and footnote 64, p. 62.
- **hbb3-corr-definition-valid:** examples/theories/hbb3-corr-definition.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43; Remark 8.6.4, p. 68; Remark 8.1.1(2), pp. 60–61.
- **hbb3-corr-definition-wrong:** examples/theories/hbb3-corr-definition-wrong.md; Definition 8.2.1, p. 62; Figure 12, p. 63; Theorem 8.2.3, p. 64; Figure 13, p. 63; Definition 5.2.4 and Figure 7, p. 43; Remark 8.6.4, p. 68; Remark 8.1.1(2), pp. 60–61.

## Saved evidence

Each case has `run.json`; consistent cases have a model certificate and certificates for false correctness properties or diagnostic probes. Replay with:

```sh
node src/cli.mjs replay OUTPUT_DIRECTORY/CASE_ID/PROPERTY.evidence.json
```

- [hbb1-complete-baseline: model.evidence.json](hbb1-complete-baseline/model.evidence.json)
- [hbb1-echo-progress-removed: model.evidence.json](hbb1-echo-progress-removed/model.evidence.json)
- [hbb1-echo-progress-removed: happy-termination.evidence.json](hbb1-echo-progress-removed/happy-termination.evidence.json)
- [hbb1-vote-progress-removed: model.evidence.json](hbb1-vote-progress-removed/model.evidence.json)
- [hbb1-vote-progress-removed: happy-termination.evidence.json](hbb1-vote-progress-removed/happy-termination.evidence.json)
- [hbb1-deliver-progress-removed: model.evidence.json](hbb1-deliver-progress-removed/model.evidence.json)
- [hbb1-deliver-progress-removed: happy-termination.evidence.json](hbb1-deliver-progress-removed/happy-termination.evidence.json)
- [hbb1-deliver-progress-removed: cascade-termination.evidence.json](hbb1-deliver-progress-removed/cascade-termination.evidence.json)
- [hbb1-safe-removed: model.evidence.json](hbb1-safe-removed/model.evidence.json)
- [hbb1-safe-removed: happy-termination.evidence.json](hbb1-safe-removed/happy-termination.evidence.json)
- [hbb1-echo-choice-correct: model.evidence.json](hbb1-echo-choice-correct/model.evidence.json)
- [hbb1-echo-choice-correct: diagnostic-bad-echo.evidence.json](hbb1-echo-choice-correct/diagnostic-bad-echo.evidence.json)
- [hbb1-echo-end-only-correct: model.evidence.json](hbb1-echo-end-only-correct/model.evidence.json)
- [hbb1-echo-end-only-correct: diagnostic-bad-end-only-echo.evidence.json](hbb1-echo-end-only-correct/diagnostic-bad-end-only-echo.evidence.json)
- [hbb1-vote-safe-omitted: model.evidence.json](hbb1-vote-safe-omitted/model.evidence.json)
- [hbb1-vote-safe-omitted: agreement.evidence.json](hbb1-vote-safe-omitted/agreement.evidence.json)
- [complete-baseline: model.evidence.json](complete-baseline/model.evidence.json)
- [echo-ne-removed: model.evidence.json](echo-ne-removed/model.evidence.json)
- [echo-ne-removed: agreement.evidence.json](echo-ne-removed/agreement.evidence.json)
- [echo-ne-live-only: model.evidence.json](echo-ne-live-only/model.evidence.json)
- [echo-ne-live-only: agreement.evidence.json](echo-ne-live-only/agreement.evidence.json)
- [echo-progress-removed: model.evidence.json](echo-progress-removed/model.evidence.json)
- [echo-progress-removed: happy-termination.evidence.json](echo-progress-removed/happy-termination.evidence.json)
- [vote-progress-removed: model.evidence.json](vote-progress-removed/model.evidence.json)
- [vote-progress-removed: happy-termination.evidence.json](vote-progress-removed/happy-termination.evidence.json)
- [deliver-progress-removed: model.evidence.json](deliver-progress-removed/model.evidence.json)
- [deliver-progress-removed: happy-termination.evidence.json](deliver-progress-removed/happy-termination.evidence.json)
- [deliver-progress-removed: cascade-termination.evidence.json](deliver-progress-removed/cascade-termination.evidence.json)
- [hbb3-complete-baseline: model.evidence.json](hbb3-complete-baseline/model.evidence.json)
- [hbb3-corr-seq-removed: model.evidence.json](hbb3-corr-seq-removed/model.evidence.json)
- [hbb3-corr-seq-removed: agreement.evidence.json](hbb3-corr-seq-removed/agreement.evidence.json)
- [hbb3-corr-past-removed: model.evidence.json](hbb3-corr-past-removed/model.evidence.json)
- [hbb3-corr-past-removed: agreement.evidence.json](hbb3-corr-past-removed/agreement.evidence.json)
- [hbb3-vote-ne-removed: model.evidence.json](hbb3-vote-ne-removed/model.evidence.json)
- [hbb3-vote-ne-removed: agreement.evidence.json](hbb3-vote-ne-removed/agreement.evidence.json)
- [hbb3-three-twined-removed: model.evidence.json](hbb3-three-twined-removed/model.evidence.json)
- [hbb3-three-twined-removed: cascade-termination.evidence.json](hbb3-three-twined-removed/cascade-termination.evidence.json)
- [hbb3-echo-progress-removed: model.evidence.json](hbb3-echo-progress-removed/model.evidence.json)
- [hbb3-echo-progress-removed: happy-termination.evidence.json](hbb3-echo-progress-removed/happy-termination.evidence.json)
- [hbb3-vote-progress-removed: model.evidence.json](hbb3-vote-progress-removed/model.evidence.json)
- [hbb3-vote-progress-removed: happy-termination.evidence.json](hbb3-vote-progress-removed/happy-termination.evidence.json)
- [hbb3-deliver-progress-removed: model.evidence.json](hbb3-deliver-progress-removed/model.evidence.json)
- [hbb3-deliver-progress-removed: happy-termination.evidence.json](hbb3-deliver-progress-removed/happy-termination.evidence.json)
- [hbb3-vote-prime-progress-removed: model.evidence.json](hbb3-vote-prime-progress-removed/model.evidence.json)
- [hbb3-vote-prime-progress-removed: cascade-termination.evidence.json](hbb3-vote-prime-progress-removed/cascade-termination.evidence.json)
- [hbb3-corr-definition-valid: model.evidence.json](hbb3-corr-definition-valid/model.evidence.json)
- [hbb3-corr-definition-valid: diagnostic-incorrect-correlation-equivalence.evidence.json](hbb3-corr-definition-valid/diagnostic-incorrect-correlation-equivalence.evidence.json)
