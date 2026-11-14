# ThyHBB1 — completed broadcast

This is a completed one-participant run of ThyHBB1, using the axioms and correctness statements from the draft of 7 November 2026. Choose **Use this history; find facts** first. The given positive facts pin liveness and safety; the retained axioms constrain the remaining predicate interpretation.

The final silent † tuple records knowledge of delivery. It is not an extra protocol event. Removing that observation can violate the Knowledge scheme, even though delivery itself has occurred.

The correctness formulas include their stated premises. A true implication may be vacuous. For a direct non-vacuity investigation, the API supplies the corresponding scenario formulas through `correctnessProperties("ThyHBB1")`. In this completed singleton example all three scenarios occur.

Read the rules below, choose **Continue to claims**, review the selected properties and assumptions, then continue to the run settings and run the check. Use **Edit Markdown** to change a rule; Unicode and ASCII spellings have identical semantics. The supplied history JSON is at the end.

## Shared liveness assumptions

The complete dynamic `ThyLive` theory includes `LiveAlways`, `LiveSeq`, and both Knowledge schemes. The schemes are generated for the current history; every included assumption is checked at all possible worlds.

```hsm
# Paper: Figure 6, p. 38, Definition 5.2.4; full dynamic LiveAlways, LiveSeq and both Knowledge schemes, checked at all possible worlds (Definition 5.2.1, p. 37).
include ThyLive
```

## Assumptions and protocol rules

### Echo? — backward rule

An echo must be justified by knowledge of a proposal of that value.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires both current `safe(l)` and knowledge of a quorum of prior matching echoes.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ (safe(l) ∧ □[l] ↓ echo(v))
```

### Deliver? — backward rule

Delivery requires knowledge of a reporting quorum of matching source-learner votes.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Deliver? [backward]:
  ∀ m,l,v. deliver(m,l,v) ⇒ □[m] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### Safe — other assumption

Safety is a biconditional: at most one proposal value is known, or every learner has a sequential witness in every relevant quorum intersection.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Safe [other]:
  ∀ l. safe(l) ⇔ ((∃⁰¹ v. ♢[] ↓ propose(v)) ∨ (∀ m. ♢[l,m] seq))
```

### Echo! — forward rule

A live participant that knows a proposal must echo some value somewhere in its actual local run. The value is existentially chosen.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Echo! [forward]:
  ∀ v. (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

If safety holds at every actual local tuple, a live participant with quorum echoes must vote for that value somewhere in its actual local run.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Vote! [forward]:
  ∀ l,v. ⇕ safe(l) ⇒ (live ∧ □[l] ↓ echo(v)) ⇒ ↕ vote(l,v)
```

### Deliver! — forward rule

A live participant with a reporting quorum of votes must deliver the indicated reporting learner, source learner and value somewhere in its actual local run.

```hsm
# Paper: Figure 7, p. 41; Definition 6.1.2.
axiom Deliver! [forward]:
  ∀ m,l,v. (live ∧ □[m] ↓ vote(l,v)) ⇒ ↕ deliver(m,l,v)
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Liveness 1 — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 8, p. 41; Theorem 6.1.6, p. 43; Proposition 6.5.3, p. 48.
property Liveness 1 [end]:
  ∀ l,v. ((□[l] live) ∧ (∃¹ w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,l,v))
```

### Liveness 2 — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant. The source learner must also be safe at every participant at the end of time.

```hsm
# Paper: Figure 8, p. 41; Theorem 6.1.6, p. 43; Proposition 6.4.5, p. 47.
property Liveness 2 [end]:
  ∀ a,b,l,v. ((♢[a,b] ⊤) ∧ (□[b] live) ∧ (□[] safe(l))) ⇒ (♢[] ↓ deliver(a,l,v) ⇒ live ⇒
  ↕ deliver(b,l,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 8, p. 41; Theorem 6.1.6, p. 43; Proposition 6.3.1, p. 45.
property Agreement [end]:
  ∀ a,b,l,m,v,w. ((♢[a,b] seq)) ⇒ ((♢[] ↓ deliver(a,l,v)) ∧ (♢[] ↓ deliver(b,m,w)) ⇒
  v=w)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-07**. References use the draft's printed page numbers.

Paper basis: **ThyHBB1**, Definition 6.1.2, pp. 41-42; Figure 7, p. 41. Correctness: Figure 8, p. 41; Theorem 6.1.6, p. 43. Proofs: Liveness 1: Proposition 6.5.3, p. 48; Liveness 2: Proposition 6.4.5, p. 47; Agreement: Proposition 6.3.1, p. 45.

Pedagogical completed-run scenario: the protocol axioms and conditional correctness formulas in this document are unmodified translations of the paper. The singleton history, positive facts and final observation are supplied for this example; they are not a literal paper theory or a proof over all histories.

Code event order: `propose(v)`, `echo(v)`, `vote(l,v)`, and **`deliver(m,l,v)`**: `m` is the reporting learner, `l` the source learner, and `v` the value (Notation 6.1.3 and Remark 6.1.4, p. 42). HBB3 instead uses the pair `deliver(l,v)`. Learners and values share one domain (Definition 3.1.1, p. 17).

`include ThyLive` keeps Figure 6, p. 38, Definition 5.2.4 dynamic: `LiveAlways`, `LiveSeq`, and both complete Knowledge schemes, over all ground events and all finite learner lists (including empty lists and repetitions), are checked at all possible worlds (Definition 5.2.1, p. 37). The schemes regenerate when the history changes. [Full source and notation map](../../docs/PAPER_MAP.md); [paper variants and their status](../../docs/PAPER_VARIANTS.md).

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Completed HBB1: proposal to delivery",
  "participants": [
    "p"
  ],
  "values": [
    "v"
  ],
  "signature": {
    "events": [
      "propose",
      "echo",
      "vote",
      "deliver"
    ],
    "predicates": [
      "live",
      "safe"
    ]
  },
  "nodes": [
    {
      "id": "proposal",
      "place": "p",
      "event": {
        "symbol": "propose",
        "args": [
          "v"
        ]
      },
      "past": []
    },
    {
      "id": "echoed",
      "place": "p",
      "event": {
        "symbol": "echo",
        "args": [
          "v"
        ]
      },
      "past": [
        "proposal"
      ]
    },
    {
      "id": "voted",
      "place": "p",
      "event": {
        "symbol": "vote",
        "args": [
          "v",
          "v"
        ]
      },
      "past": [
        "echoed"
      ]
    },
    {
      "id": "delivered",
      "place": "p",
      "event": {
        "symbol": "deliver",
        "args": [
          "v",
          "v",
          "v"
        ]
      },
      "past": [
        "voted"
      ]
    },
    {
      "id": "observed",
      "place": "p",
      "event": null,
      "past": [
        "delivered"
      ]
    }
  ],
  "quorums": {
    "v": [
      [
        "p"
      ]
    ]
  },
  "facts": [
    {
      "place": "p",
      "at": "*",
      "atom": "live"
    },
    {
      "place": "p",
      "at": "*",
      "atom": {
        "symbol": "safe",
        "args": [
          "v"
        ]
      }
    }
  ]
}
```
