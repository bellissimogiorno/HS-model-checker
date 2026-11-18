# First steps — why uniqueness needs an assumption

This example deliberately starts with a counterexample: existence does not imply uniqueness. In **Use this history; find facts** mode, the checker chooses truth values for `chosen(red)` and `chosen(blue)`. **SomeChoice** requires at least one, but permits both; **UniqueChoice** requires exactly one. A model with both values chosen therefore satisfies the assumption and falsifies the property. No protocol events or intermediate time stages are needed: even the empty history has its end-of-time world.

To supply the missing guarantee, choose **Edit Markdown**, change the formula of **SomeChoice** to `∃=1 v. chosen(v)`, choose **Update choices**, and run again. With the starting selections, **UniqueChoice** then holds within the selected scope. A supplied-model check has a different task: it evaluates the explicit facts, treating absent facts as false.

Use **Return to previous example** and **Continue to next example** to browse the curated set. Loading another example clears the preceding results; it does not run the new example automatically.

Read the rules below, choose **Continue to claims**, review the selected properties and assumptions, then continue to the run settings and run the check. Use **Edit Markdown** to change a rule; Unicode and ASCII spellings have identical semantics. The supplied history JSON is at the end.

## Assumptions and protocol rules

### SomeChoice — other assumption

At least one domain value is chosen. Both values may still be chosen.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Definition 3.3.3, p. 24.
axiom SomeChoice [other]:
  ∃ v. chosen(v)
```

## Properties to check

These claims test the declared finite scenario. Their validity scope is shown on each property.

### UniqueChoice — property

Exactly one domain value is chosen. The existential assumption above does not supply uniqueness.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Definition 3.6.1, p. 31; Figure 5, p. 31.
property UniqueChoice [end]:
  ∃=1 v. chosen(v)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-18**. References use the draft's printed page numbers.

Sections 2-4 supply the semantics, not these example claims: history structures (Definition 2.3.5, p. 15), syntax/signatures (Definitions 3.1.1 and 3.1.3, p. 21), models and interpreted predicates (Definition 3.3.3, p. 24), validity (Definition 3.4.10 and Figure 4, p. 28), and uniqueness sugar (Definition 3.6.1 and Figures 5 and 6, pp. 31–32).

Pedagogical logic scenario, not a literal paper theory: `chosen`, `SomeChoice`, and `UniqueChoice` are introduced only here. No HBB axioms or correctness theorem are asserted. The proposed edit strengthens `∃` to `∃=1` to supply the uniqueness that ordinary existence lacks.

[Full paper source and ASCII notation map](../../docs/PAPER_MAP.md).

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "First steps: two possible choices",
  "participants": [
    "p"
  ],
  "values": [
    "red",
    "blue"
  ],
  "signature": {
    "events": [],
    "predicates": [
      "chosen"
    ]
  },
  "nodes": [],
  "quorums": {
    "red": [
      [
        "p"
      ]
    ],
    "blue": [
      [
        "p"
      ]
    ]
  },
  "facts": []
}
```
