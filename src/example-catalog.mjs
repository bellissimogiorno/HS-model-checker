/** Curated sources and visible initial experiment choices. Sources retain all
 * declarations; preset omissions are applied to checkboxes and saved in evidence. */
export const EXAMPLE_GROUPS = ['Getting started', 'HBB1', 'HBB2', 'HBB3', 'Quorum diagnostics'];

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
    description: 'Run the intended uniqueness counterexample and inspect its two chosen values. Then strengthen existence to exactly one. Definition 3.6.1 and Figure 5, pp. 26–27.'
  },
  {
    file: 'hbb1.md', group: 'HBB1',
    label: 'Completed broadcast · safe learners',
    description: 'Check a completed run with the Safe predicate and all three conditional correctness claims. ThyHBB1: Figures 7–8, p. 41; Theorem 6.1.6, p. 43.'
  },
  {
    file: 'hbb1-echo-progress.md', group: 'HBB1',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 7, p. 41; Proposition 6.5.3, p. 48.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'hbb1-vote-progress.md', group: 'HBB1',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 7, p. 41; Proposition 6.5.3, p. 48.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'hbb1-deliver-progress.md', group: 'HBB1',
    label: 'Remove Deliver! · an observer never delivers',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figures 7–8, p. 41; Theorem 6.1.6, p. 43.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb1-safe-removed.md', group: 'HBB1',
    label: 'Remove the Safe definition',
    description: "Starts with Safe unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 7, p. 41; Lemma 6.5.2, pp. 47–48.",
    options: {"droppedAxioms": ["Safe"]}
  },
  {
    file: 'hbb1-echo-choice.md', group: 'HBB1',
    label: 'Choose one echo value from two proposals',
    description: 'A live participant may choose one of two proposed values; compare the separate Bad Echo! diagnostic and the incorrect companion. Remark 6.2.3(2), p. 44.',
    options: {"selectedProperties": ["Liveness 1", "Liveness 2", "Agreement"]}
  },
  {
    file: 'hbb1-echo-choice-wrong.md', group: 'HBB1',
    label: 'Incorrect universal Echo! overconstrains choice',
    description: 'Compare the same one-echo history under the incorrect universally closed Echo! formula; consistency fails before correctness is tested. Remark 6.2.3(2), p. 44.',
    initialNoModel: true
  },
  {
    file: 'hbb1-vote-safe.md', group: 'HBB1',
    label: 'Full Vote? rejects unsafe votes',
    description: 'With the full safety guard, this fixed history has no model and its properties are Not tested. Compare the omitted-guard companion. Figure 7, p. 41; Proposition 6.3.1, p. 45.',
    initialNoModel: true
  },
  {
    file: 'hbb1-vote-safe-omitted.md', group: 'HBB1',
    label: 'Omit only the safety guard from Vote?',
    description: 'The source already omits the safety guard from Vote?. Keep every declared rule and run for an Agreement counterexample. Figure 7, p. 41; Proposition 6.3.1, p. 45.'
  },
  {
    file: 'hbb2.md', group: 'HBB2',
    label: 'Completed broadcast · direct quorum voting',
    description: 'Check the second broadcast theory with all three conditional correctness claims. ThyHBB2: Figures 9–10, p. 50; Theorem 7.1.3, p. 51.'
  },
  {
    file: 'echo-ne.md', group: 'HBB2',
    label: 'What EchoNE rules out',
    description: "Starts with EchoNE unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 9, p. 50; Proposition 7.3.1, p. 52.",
    options: {"droppedAxioms": ["EchoNE"]}
  },
  {
    file: 'echo-ne-live-only.md', group: 'HBB2',
    label: 'Weaken EchoNE · live participants only',
    description: 'The source restricts EchoNE to live participants; keep all declared rules and test Agreement on the non-live sequential history. Figure 9, p. 50; Proposition 7.3.1, p. 52.'
  },
  {
    file: 'echo-progress.md', group: 'HBB2',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 9, p. 50; Proposition 7.3.3, p. 53.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'vote-progress.md', group: 'HBB2',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 9, p. 50; Proposition 7.3.3, p. 53.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'deliver-progress.md', group: 'HBB2',
    label: 'Remove Deliver! · an observer never delivers',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 9, p. 50; Propositions 7.3.2–7.3.3, pp. 52–53.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb3.md', group: 'HBB3',
    label: 'Completed broadcast · correlated learners',
    description: 'Check dotted correlation and existential voting progress with all three conditional claims. ThyHBB3: Figures 11–12, p. 56; Theorem 8.2.3, p. 57.'
  },
  {
    file: 'hbb3-echo-progress.md', group: 'HBB3',
    label: 'Remove Echo! · a proposal without an echo',
    description: "Starts with Echo! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.5.1, pp. 59–60.",
    options: {"droppedAxioms": ["Echo!"]}
  },
  {
    file: 'hbb3-vote-progress.md', group: 'HBB3',
    label: 'Remove Vote! · an echo without a vote',
    description: "Starts with Vote! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.5.1, pp. 59–60.",
    options: {"droppedAxioms": ["Vote!"]}
  },
  {
    file: 'hbb3-deliver-progress.md', group: 'HBB3',
    label: 'Remove Deliver! · a vote without delivery',
    description: "Starts with Deliver! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.5.1, pp. 59–60.",
    options: {"droppedAxioms": ["Deliver!"]}
  },
  {
    file: 'hbb3-vote-prime-progress.md', group: 'HBB3',
    label: 'Remove Vote\'! · correlation propagation stalls',
    description: "Starts with Vote'! unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Proposition 8.4.5, p. 59; footnote 54, p. 57.",
    options: {"droppedAxioms": ["Vote'!"]}
  },
  {
    file: 'hbb3-corr-seq.md', group: 'HBB3',
    label: 'Remove CorrSeq · a correlated fork',
    description: "Starts with CorrSeq unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.3.1, p. 57.",
    options: {"droppedAxioms": ["CorrSeq"]}
  },
  {
    file: 'hbb3-corr-past.md', group: 'HBB3',
    label: 'Remove CorrPast · correlation arrives late',
    description: "Starts with CorrPast unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.3.1, p. 57.",
    options: {"droppedAxioms": ["CorrPast"]}
  },
  {
    file: 'hbb3-vote-ne.md', group: 'HBB3',
    label: 'Remove VoteNE · sequential conflicting votes',
    description: "Starts with VoteNE unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Figure 11, p. 56; Proposition 8.3.1, p. 57.",
    options: {"droppedAxioms": ["VoteNE"]}
  },
  {
    file: 'hbb3-three-twined.md', group: 'HBB3',
    label: 'Pairwise overlap cannot replace 3twined',
    description: "Starts with 3twined unchecked. Run the omission experiment; select Keep all axioms and rerun for the full-theory comparison. Section 8.4, pp. 58–59; Remark 8.6.2(4), p. 61.",
    options: {"droppedAxioms": ["3twined"], "maxCompilationNodes": 1000000, "maxMilliseconds": 60000}
  },
  {
    file: 'hbb3-corr-definition.md', group: 'HBB3',
    label: 'Sequential intersection is not correlation',
    description: 'Check the valid correlation rules and the separate incorrect-equivalence diagnostic on the same nontransitive intersection profile. Figure 11, p. 56; Remark 8.6.4, p. 61.',
    options: {"selectedProperties": ["Liveness 1", "Liveness 2", "Agreement"]}
  },
  {
    file: 'hbb3-corr-definition-wrong.md', group: 'HBB3',
    label: 'Incorrect correlation definition rejects the DAG',
    description: 'Compare the same history when the source replaces CorrSeq and CorrPast by an incorrect equivalence; consistency fails. Figure 11, p. 56; Remark 8.6.4, p. 61.',
    initialNoModel: true
  },
  {
    file: 'majority.md', group: 'Quorum diagnostics',
    label: 'Repeated learners · pairwise versus triple overlap',
    description: 'Compare pairwise and triple intersection when repeated learner occurrences choose quorums independently. Lemma 4.1.1 and Notation 4.1.2, pp. 32–33.'
  },
  {
    file: 'heterogeneous.md', group: 'Quorum diagnostics',
    label: 'Heterogeneous learners · distinct trust assumptions',
    description: 'Inspect individually valid learner trust systems whose cross-learner quorums can be disjoint. Definition 3.3.2, pp. 19–20; Lemma 4.1.1, pp. 32–33.'
  }
];

/** Fresh defaults prevent limits and omissions from leaking between examples. */
export function exampleOptions(file) {
  return structuredClone({...DEFAULT_EXAMPLE_OPTIONS, ...EXAMPLES.find(example => example.file === file)?.options});
}
