# HBBCorr — completed broadcast

This is a completed one-participant run of HBBCorr, using the axioms and correctness statements from the draft of 18 November 2026. Choose **Use this history; find facts** first. The given positive facts pin liveness and correlation; the retained axioms constrain the remaining predicate interpretation.

The final silent † tuple records knowledge of delivery. It is not an extra protocol event. Removing that observation can violate the Knowledge scheme, even though delivery itself has occurred.

The correctness formulas include their stated premises. A true implication may be vacuous. For a direct non-vacuity investigation, the API supplies the corresponding scenario formulas through `correctnessProperties("HBBCorr")`. In this completed singleton example all three scenarios occur.

Read the rules below, choose **Continue to claims**, review the selected properties and assumptions, then continue to the run settings and run the check. Use **Edit Markdown** to change a rule; Unicode and ASCII spellings have identical semantics. The supplied history JSON is at the end.

## Shared liveness assumptions

The complete dynamic `ThyLive` theory includes `LiveAlways`, `LiveSeq`, and both Knowledge schemes. The schemes are generated for the current history; every included assumption is checked at all possible worlds.

```hsm
# Paper: Figure 7, p. 43, Definition 5.2.4; full dynamic LiveAlways, LiveSeq and both Knowledge schemes, checked at all possible worlds (Definition 5.2.1, p. 42).
include ThyLive
```

## Assumptions and protocol rules

### Echo? — backward rule

An echo must be justified by knowledge of a proposal of that value.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires either quorum echoes of that value, or knowledge of a matching vote for a currently correlated learner.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ ((□[l] ↓ echo(v)) ∨ (∃ m. (corr(m,l) ∧ ♢[] ↓ vote(m,v))))
```

### Deliver? — backward rule

Delivery requires knowledge of a quorum of matching votes for the same learner.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Deliver? [backward]:
  ∀ l,v. deliver(l,v) ⇒ □[l] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### VoteNE — other assumption

An actual local vote and an earlier local vote for correlated learners must carry the same value.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom VoteNE [other]:
  ∀ l,m,v,w. vote(l,v) ⇒ ↓ vote(m,w) ⇒ corr(l,m) ⇒ v=w
```

### 3twined — other assumption

Every triple of independently chosen learner quorums must have a common participant. Repeated learner names still make independent quorum choices.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom 3twined [other]:
  ∀ l,m,n. ♢[l,m,n] ⊤
```

### CorrSeq — other assumption

For every choice of one quorum from each correlated learner, their intersection must contain a sequential participant.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom CorrSeq [other]:
  ∀ l,m. corr(l,m) ⇒ ♢[l,m] seq
```

### CorrPast — other assumption

Correlation persists to every actual earlier local tuple. Its temporal operator ranges over recorded local tuples, rather than every hypothetical world.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom CorrPast [other]:
  ∀ l,m. corr(l,m) ⇒ ⇓ corr(l,m)
```

### CorrSymm — other assumption

Correlation is symmetric. Reflexivity is not an additional assumption.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom CorrSymm [other]:
  ∀ l,m. corr(l,m) ⇒ corr(m,l)
```

### CorrTran — other assumption

Correlation is transitive.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom CorrTran [other]:
  ∀ l,m,n. corr(l,m) ⇒ corr(m,n) ⇒ corr(l,n)
```

### Echo! — forward rule

If an actual local tuple records a live participant knowing a proposal, that participant must echo some value at an actual local tuple. The value is existentially chosen; end-of-time knowledge alone does not activate the rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Echo! [forward]:
  ∀ v. ↕ (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

If an actual local tuple records a live participant knowing the required quorum of echoes, that participant must vote at an actual local tuple. The rule does not impose a time order between those two tuples. The vote value remains existentially chosen.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Vote! [forward]:
  ∀ l,v. ↕ (live ∧ □[l] ↓ echo(v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Vote'! — forward rule

If an actual local tuple records a live participant knowing a correlated source vote, and correlation holds at every actual local tuple, that participant must vote for some value at an actual local tuple. The existential value choice is retained.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Vote'! [forward]:
  ∀ l,m,v. ↕ (live ∧ ⇕ corr(l,m) ∧ ♢[] ↓ vote(m,v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Deliver! — forward rule

If an actual local tuple records a live participant knowing the required quorum of votes, that participant must deliver at an actual local tuple. Merely learning of those votes at the end of time does not activate the rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1.
axiom Deliver! [forward]:
  ∀ l,v. ↕ (live ∧ □[l] ↓ vote(l,v)) ⇒ ↕ deliver(l,v)
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Happy Termination — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 13, p. 63; Theorem 8.2.3, p. 64; Proposition 8.5.1, p. 66.
property Happy Termination [end]:
  ∀ l,v. ((□[l] live) ∧ (∃=1 w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,v))
```

### Cascade Termination — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant.

```hsm
# Paper: Figure 13, p. 63; Theorem 8.2.3, p. 64; Proposition 8.4.5, pp. 65–66.
property Cascade Termination [end]:
  ∀ l,m,v. ((□[] corr(l,m)) ∧ (□[m] live)) ⇒ (♢[] ↓ deliver(l,v) ⇒ live ⇒ ↕
  deliver(m,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 13, p. 63; Theorem 8.2.3, p. 64; Proposition 8.3.1, p. 64.
property Agreement [end]:
  ∀ l,m,v,w. ((□[] corr(l,m))) ⇒ ((♢[] ↓ deliver(l,v)) ∧ (♢[] ↓ deliver(m,w)) ⇒ v=w)
```

## Paper and interpretation

The paper writes correlation as `l ≐ m`. In Figure 12, p. 63, `CorrSeq`, `CorrPast`, `CorrSymm` and `CorrTran` denote `≐seq`, `≐⇓`, `≐symm` and `≐tran`. The executable predicate is `corr(l,m)`. Correlation is distinct from value equality; both voting forward rules retain the paper’s existential value choice.

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-18**. References use the draft's printed page numbers.

Paper basis: **HBBCorr**, Definition 8.2.1, p. 62; Figure 12, p. 63. Correctness: Figure 13, p. 63; Theorem 8.2.3, p. 64. Proofs: Happy Termination: Proposition 8.5.1, p. 66; Cascade Termination: Proposition 8.4.5, pp. 65–66; Agreement: Proposition 8.3.1, p. 64.

Pedagogical completed-run scenario: the protocol axioms and conditional correctness formulas in this document are unmodified translations of the paper. The singleton history, positive facts and final observation are supplied for this example; they are not a literal paper theory or a proof over all histories.

Code event order: `propose(v)`, `echo(v)`, `vote(l,v)`, and **`deliver(l,v)`**, with learner first and value second (Figure 12, p. 63). HBBSafe/HBBSimp instead use `deliver(reportingLearner,sourceLearner,value)` (Notation 6.2.3, p. 47). Learners and values share one domain (Definition 3.1.1, p. 21).

`include ThyLive` keeps Figure 7, p. 43, Definition 5.2.4 dynamic: `LiveAlways`, `LiveSeq`, and both complete Knowledge schemes, over all ground events, with a single learner in each Knowledge□ instance, are checked at all possible worlds (Definition 5.2.1, p. 42). The schemes regenerate when the history changes. [Full source and notation map](../../docs/PAPER_MAP.md); [paper variants and their status](../../docs/PAPER_VARIANTS.md).

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Completed HBBCorr: proposal to delivery",
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
      "corr"
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
        "symbol": "corr",
        "args": [
          "v",
          "v"
        ]
      }
    }
  ]
}
```
