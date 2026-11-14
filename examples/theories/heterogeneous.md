# Heterogeneous learners — individually valid trust

The red and blue learners each have a valid pairwise-intersecting quorum system. Their trust choices differ: a red quorum and a blue quorum can be disjoint.

The first two properties hold on this fixed history/trust structure; Cross-learner intersection is false. The recorded tuples illustrate separate knowledge histories, but no HBB protocol is asserted by this diagnostic. Domain values also serve as learner names, as required by the paper.

Read the properties below, choose **Continue to claims**, review the selection, then continue to the run settings and run the check. Use **Edit Markdown** to change a rule; Unicode and ASCII spellings have identical semantics. The supplied history JSON is at the end.

## Properties to check

These claims test the declared finite scenario. Their validity scope is shown on each property.

### Red self-intersection — property

Every two independently chosen red quorums must intersect.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Definition 3.3.2, pp. 19-20.
property Red self-intersection [end]:
  ♢["red","red"] ⊤
```

### Blue self-intersection — property

Every two independently chosen blue quorums must intersect.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Definition 3.3.2, pp. 19-20.
property Blue self-intersection [end]:
  ♢["blue","blue"] ⊤
```

### Cross-learner intersection — property

Every red quorum and blue quorum must intersect. Separate validity of the two learner trust systems does not imply this claim.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Lemma 4.1.1(2), pp. 32-33.
property Cross-learner intersection [end]:
  ♢["red","blue"] ⊤
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-07**. References use the draft's printed page numbers.

Sections 2-4 supply the semantics: history structures (Definition 2.3.5, p. 11), the shared learner/value domain (Definition 3.1.1, p. 17), individually pairwise-intersecting semifilters (Definition 3.3.2, pp. 19-20), learner interpretations (Definition 3.3.3(4), p. 20), and cross-learner intersections (Lemma 4.1.1 and Notation 4.1.2, pp. 32-33).

Pedagogical heterogeneous-trust diagnostic, not a literal paper theory: the named properties test this supplied trust structure. No protocol axioms are omitted or modified, and no HBB correctness theorem is asserted. A learner's own semifilter validity does not impose intersections with another learner's quorums.

[Full paper source and ASCII notation map](../../docs/PAPER_MAP.md).

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Heterogeneous trust: compatible within each learner",
  "participants": [
    "p",
    "q",
    "r",
    "s"
  ],
  "values": [
    "red",
    "blue"
  ],
  "signature": {
    "events": [
      "propose",
      "echo",
      "vote",
      "deliver"
    ],
    "predicates": [
      "live"
    ]
  },
  "nodes": [
    {
      "id": "redProposal",
      "place": "p",
      "event": {
        "symbol": "propose",
        "args": [
          "red"
        ]
      },
      "past": []
    },
    {
      "id": "blueProposal",
      "place": "s",
      "event": {
        "symbol": "propose",
        "args": [
          "blue"
        ]
      },
      "past": []
    },
    {
      "id": "redEcho",
      "place": "q",
      "event": {
        "symbol": "echo",
        "args": [
          "red"
        ]
      },
      "past": [
        "redProposal"
      ]
    },
    {
      "id": "blueEcho",
      "place": "r",
      "event": {
        "symbol": "echo",
        "args": [
          "blue"
        ]
      },
      "past": [
        "blueProposal"
      ]
    },
    {
      "id": "redObserved",
      "place": "p",
      "event": null,
      "past": [
        "redEcho"
      ]
    },
    {
      "id": "blueObserved",
      "place": "s",
      "event": null,
      "past": [
        "blueEcho"
      ]
    }
  ],
  "quorums": {
    "red": [
      [
        "p",
        "q"
      ],
      [
        "p",
        "r"
      ]
    ],
    "blue": [
      [
        "q",
        "s"
      ],
      [
        "r",
        "s"
      ]
    ]
  },
  "facts": []
}
```
