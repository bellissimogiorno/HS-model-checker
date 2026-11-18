/** Curated sources and visible initial experiment choices. Sources retain all
 * declarations; preset omissions are applied to checkboxes and saved in evidence. */
export const EXAMPLE_GROUPS = ['Getting started', 'HBBSafe', 'HBBSimp', 'HBBCorr', 'Quorum diagnostics'];

export const DEFAULT_EXAMPLE_OPTIONS = {
  mode: 'synthesize',
  pinFacts: true,
  droppedAxioms: [],
  maxMilliseconds: 10000,
  maxAdditionalNodes: 2,
  maxModels: 1000,
  maxKnowledgeFamilies: 256,
  maxCompilationNodes: 500000,
  maxDecisions: 100000,
  maxSteps: 1000000
};

export const EXAMPLES = [
  {
    file: 'first-steps.md', group: 'Getting started',
    label: 'First steps · existence does not imply uniqueness',
    description: "Run the intended uniqueness counterexample and inspect its two chosen values. Then strengthen existence to exactly one. Definition 3.6.1 and Figure 5, pp. 31–32."
  },
  {
    file: 'hbb1.md', group: 'HBBSafe',
    label: 'Completed broadcast · safe learners',
    description: "Check a completed run with the Safe predicate and all three conditional correctness claims. HBBSafe: Figures 8–9, p. 48; Theorem 6.2.6."
  },
  {
    file: 'hbb1-echo-progress.md', group: 'HBBSafe',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 8, p. 48; Proposition 6.6.3.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'hbb1-vote-progress.md', group: 'HBBSafe',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 8, p. 48; Proposition 6.6.3.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'hbb1-deliver-progress.md', group: 'HBBSafe',
    label: 'Remove Deliver! · an observer never delivers',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figures 8–9, p. 48; Theorem 6.2.6.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb1-safe-removed.md', group: 'HBBSafe',
    label: 'Remove the Safe definition',
    description: "Starts with Safe unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 8, p. 48; Remark 6.3.2.",
    options: {"droppedAxioms": ["Safe"]}
  },
  {
    file: 'hbb1-echo-choice.md', group: 'HBBSafe',
    label: 'Choose one echo value from two proposals',
    description: "A live participant may choose one of two proposed values; compare the separate Bad Echo! diagnostic and the incorrect companion. Remark 6.3.3(2), p. 51.",
    options: {"selectedProperties": ["Happy Termination", "Cascade Termination", "Agreement"]}
  },
  {
    file: 'hbb1-echo-choice-wrong.md', group: 'HBBSafe',
    label: 'Incorrect universal Echo! overconstrains choice',
    description: "Compare the same one-echo history under the incorrect universally closed Echo! formula; consistency fails before correctness is tested. Remark 6.3.3(2), p. 51.",
    initialNoModel: true
  },
  {
    file: 'hbb1-echo-end-only.md', group: 'HBBSafe',
    label: 'Knowing a proposal only at the end is not actionable',
    description: 'Run the three correctness claims and the separate Bad end-only Echo! diagnostic. Only that diagnostic fails: seeing a proposal at the end does not make it actionable. Compare the incorrect companion. Remark 6.3.3(3), p. 51.',
    options: {"selectedProperties": ["Happy Termination", "Cascade Termination", "Agreement", "Bad end-only Echo!"]}
  },
  {
    file: 'hbb1-echo-end-only-wrong.md', group: 'HBBSafe',
    label: 'Incorrect end-only Echo! forces an impossible action',
    description: 'The source replaces Echo! by a formula missing the sometime antecedent. End-of-time visibility alone makes this fixed history inconsistent; its correctness properties are Not tested. Remark 6.3.3(3), p. 51.',
    initialNoModel: true
  },
  {
    file: 'hbb1-vote-safe.md', group: 'HBBSafe',
    label: 'Full Vote? rejects unsafe votes',
    description: "With the full safety guard, this fixed history has no model and its properties are Not tested. Compare the omitted-guard companion. Figure 8, p. 48; Proposition 6.4.1.",
    initialNoModel: true
  },
  {
    file: 'hbb1-vote-safe-omitted.md', group: 'HBBSafe',
    label: 'Omit only the safety guard from Vote?',
    description: "The source already omits the safety guard from Vote?. Keep every declared rule and run for an Agreement counterexample. Figure 8, p. 48; Proposition 6.4.1."
  },
  {
    file: 'hbb2.md', group: 'HBBSimp',
    label: 'Completed broadcast · direct quorum voting',
    description: "Check direct quorum voting with all three conditional correctness claims. HBBSimp: Figures 10–11, p. 57; Theorem 7.1.3."
  },
  {
    file: 'echo-ne.md', group: 'HBBSimp',
    label: 'What EchoNE rules out',
    description: "Starts with EchoNE unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 10, p. 57; Proposition 7.3.1.",
    options: {"droppedAxioms": ["EchoNE"]}
  },
  {
    file: 'echo-ne-live-only.md', group: 'HBBSimp',
    label: 'Weaken EchoNE · live participants only',
    description: "The source restricts EchoNE to live participants; keep all declared rules and test Agreement on the non-live sequential history. Figure 10, p. 57; Proposition 7.3.1."
  },
  {
    file: 'echo-progress.md', group: 'HBBSimp',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 10, p. 57; Proposition 7.3.3.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'vote-progress.md', group: 'HBBSimp',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 10, p. 57; Proposition 7.3.3.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'deliver-progress.md', group: 'HBBSimp',
    label: 'Remove Deliver! · an observer never delivers',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 10, p. 57; Propositions 7.3.2–7.3.3.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb3.md', group: 'HBBCorr',
    label: 'Completed broadcast · correlated learners',
    description: "Check dotted correlation and existential voting progress with all three conditional correctness claims. HBBCorr: Figures 12–13, p. 63; Theorem 8.2.3."
  },
  {
    file: 'hbb3-echo-progress.md', group: 'HBBCorr',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.5.1.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'hbb3-vote-progress.md', group: 'HBBCorr',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.5.1.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'hbb3-deliver-progress.md', group: 'HBBCorr',
    label: 'Remove Deliver! · a vote without delivery',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.5.1.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb3-vote-prime-progress.md', group: 'HBBCorr',
    label: 'Remove Vote\'! · correlation propagation stalls',
    description: "Starts with Vote'! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.4.5.",
    options: {"droppedAxioms": ["Vote'!"]}
  },
  {
    file: 'hbb3-corr-seq.md', group: 'HBBCorr',
    label: 'Remove CorrSeq · a correlated fork',
    description: "Starts with CorrSeq unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.3.1.",
    options: {"droppedAxioms": ["CorrSeq"]}
  },
  {
    file: 'hbb3-corr-past.md', group: 'HBBCorr',
    label: 'Remove CorrPast · correlation arrives late',
    description: "Starts with CorrPast unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.3.1.",
    options: {"droppedAxioms": ["CorrPast"]}
  },
  {
    file: 'hbb3-vote-ne.md', group: 'HBBCorr',
    label: 'Remove VoteNE · sequential conflicting votes',
    description: "Starts with VoteNE unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 12, p. 63; Proposition 8.3.1.",
    options: {"droppedAxioms": ["VoteNE"]}
  },
  {
    file: 'hbb3-three-twined.md', group: 'HBBCorr',
    label: 'Pairwise overlap cannot replace 3twined',
    description: "Starts with 3twined unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Section 8.4; Remark 8.6.2(4), p. 67.",
    options: {"droppedAxioms": ["3twined"], "maxCompilationNodes": 1000000, "maxMilliseconds": 60000}
  },
  {
    file: 'hbb3-corr-definition.md', group: 'HBBCorr',
    label: 'Sequential intersection is not correlation',
    description: "Check the valid correlation rules and the separate incorrect-equivalence diagnostic on the same nontransitive intersection profile. Figure 12, p. 63; Remark 8.6.4, p. 68.",
    options: {"selectedProperties": ["Happy Termination", "Cascade Termination", "Agreement"]}
  },
  {
    file: 'hbb3-corr-definition-wrong.md', group: 'HBBCorr',
    label: 'Incorrect correlation definition rejects the DAG',
    description: "Compare the same history when the source replaces CorrSeq and CorrPast by an incorrect equivalence; consistency fails. Figure 12, p. 63; Remark 8.6.4, p. 68.",
    initialNoModel: true
  },
  {
    file: 'majority.md', group: 'Quorum diagnostics',
    label: 'Repeated learners · pairwise versus triple overlap',
    description: "Compare pairwise and triple intersection when repeated learner occurrences choose quorums independently. Lemma 4.1.1 and Notation 4.1.2, pp. 37–38."
  },
  {
    file: 'heterogeneous.md', group: 'Quorum diagnostics',
    label: 'Heterogeneous learners · distinct trust assumptions',
    description: "Inspect individually valid learner trust systems whose cross-learner quorums can be disjoint. Definition 3.3.2, p. 23; Lemma 4.1.1, p. 37."
  }
];

/** Fresh defaults prevent limits and omissions from leaking between examples. */
export function exampleOptions(file) {
  return structuredClone({...DEFAULT_EXAMPLE_OPTIONS, ...EXAMPLES.find(example => example.file === file)?.options});
}
