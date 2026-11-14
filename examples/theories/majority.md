# Repeated learners — pairwise versus triple intersection

Each minimal quorum contains two of the three participants. Every pair of quorums intersects, so this is a valid semifilter and Pairwise intersection holds. Three independently chosen quorums can have empty intersection, so Triple intersection has a counterexample.

Repeating a learner means making another independent quorum choice. It cannot be replaced by one occurrence of that learner. The empty history is sufficient: this distinction concerns the trust structure itself.

Read the properties below, choose **Continue to claims**, review the selection, then continue to the run settings and run the check. Use **Edit Markdown** to change a rule; Unicode and ASCII spellings have identical semantics. The supplied history JSON is at the end.

## Properties to check

These claims test the declared finite scenario. Their validity scope is shown on each property.

### Pairwise intersection — property

Every two independently chosen quorums for the indicated learner must intersect.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Lemma 4.1.1(2), pp. 32-33.
property Pairwise intersection [end]:
  ♢["l","l"] ⊤
```

### Triple intersection — property

Every three independently chosen quorums for this learner must intersect. Pairwise intersection alone does not imply this claim.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Lemma 4.1.1(2), pp. 32-33.
property Triple intersection [end]:
  ♢["l","l","l"] ⊤
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-07**. References use the draft's printed page numbers.

Sections 2-4 supply the semantics: history structures (Definition 2.3.5, p. 11), semifilters (Definition 3.3.2, pp. 19-20), models (Definition 3.3.3, p. 20), modal validity (Definition 3.4.10 and Figure 3, pp. 24-25), and independent n-way quorum intersections (Lemma 4.1.1 and Notation 4.1.2, pp. 32-33).

Pedagogical quorum diagnostic, not a literal paper theory: the two named properties are probes of the supplied majority trust structure. No protocol axioms are omitted or modified, and no HBB correctness theorem is asserted. Repeated occurrences of a learner choose quorums independently.

[Full paper source and ASCII notation map](../../docs/PAPER_MAP.md).

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Repeated learner: pairwise is weaker than triple intersection",
  "participants": [
    "a",
    "b",
    "c"
  ],
  "values": [
    "l"
  ],
  "signature": {
    "events": [],
    "predicates": [
      "live"
    ]
  },
  "nodes": [],
  "quorums": {
    "l": [
      [
        "a",
        "b"
      ],
      [
        "a",
        "c"
      ],
      [
        "b",
        "c"
      ]
    ]
  },
  "facts": []
}
```
