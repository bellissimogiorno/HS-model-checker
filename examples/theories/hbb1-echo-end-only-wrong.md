# HBBSafe: the incorrect end-only Echo! demands an untriggered action

This example has exactly the participants, history, facts, quorums and correctness formulas of [the valid end-only-knowledge model](hbb1-echo-end-only.md). It changes only **Echo!**, replacing the paper’s actual-local antecedent by the explicitly incorrect formula in Remark 6.3.3(3), p. 51.

At p’s end-of-time world, `live ∧ ♢[] ↓ propose(v)` holds. The replacement therefore requires an actual local echo, but p has no actual tuples. No interpretation can satisfy this edited theory on the supplied history, so every correctness claim remains **Not tested**. This is overconstraint by a candidate axiom, rather than a protocol correctness counterexample. Restoring the correct Echo! admits the model.

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
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires both current `safe(l)` and knowledge of a quorum of prior matching echoes.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ (safe(l) ∧ □[l] ↓ echo(v))
```

### Deliver? — backward rule

Delivery requires knowledge of a reporting quorum of matching source-learner votes.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Deliver? [backward]:
  ∀ m,l,v. deliver(m,l,v) ⇒ □[m] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### Safe — other assumption

Safety is a biconditional: at most one proposal value is known, or every learner has a sequential witness in every relevant quorum intersection.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Safe [other]:
  ∀ l. safe(l) ⇔ ((∃⩽1 v. ♢[] ↓ propose(v)) ∨ (∀ m. ♢[l,m] seq))
```

### Echo! — forward rule

This deliberately incorrect candidate omits the antecedent’s outer ↕. It makes knowledge at a hypothetical or end-of-time world demand an actual local echo, even when the participant has no actionable observation tuple.

```hsm
# Paper: Remark 6.3.3(3), p. 51. Deliberately incorrect replacement of Figure 8 Echo!.
axiom Echo! [forward]:
  ∀ v. (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

If an actual local tuple records a live participant knowing the required quorum of echoes, that participant must vote at an actual local tuple. The rule does not impose a time order between those two tuples. Its separate ⇕ safe(l) guard requires safety at every actual local tuple; the required vote is for the same value.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Vote! [forward]:
  ∀ l,v. ⇕ safe(l) ⇒ ↕ (live ∧ □[l] ↓ echo(v)) ⇒ ↕ vote(l,v)
```

### Deliver! — forward rule

If an actual local tuple records a live participant knowing the required quorum of votes, that participant must deliver at an actual local tuple. Merely learning of those votes at the end of time does not activate the rule.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Deliver! [forward]:
  ∀ m,l,v. ↕ (live ∧ □[m] ↓ vote(l,v)) ⇒ ↕ deliver(m,l,v)
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Happy Termination — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 9, p. 48; Theorem 6.2.6, p. 49; Proposition 6.6.3, pp. 54–55.
property Happy Termination [end]:
  ∀ l,v. ((□[l] live) ∧ (∃=1 w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,l,v))
```

### Cascade Termination — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant. The source learner must also be safe at every participant at the end of time.

```hsm
# Paper: Figure 9, p. 48; Theorem 6.2.6, p. 49; Proposition 6.5.5, pp. 53–54.
property Cascade Termination [end]:
  ∀ a,b,l,v. ((♢[a,b] ⊤) ∧ (□[b] live) ∧ (□[] safe(l))) ⇒ (♢[] ↓ deliver(a,l,v) ⇒ live ⇒
  ↕ deliver(b,l,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 9, p. 48; Theorem 6.2.6, p. 49; Proposition 6.4.1, p. 52.
property Agreement [end]:
  ∀ a,b,l,m,v,w. ((♢[a,b] seq)) ⇒ ((♢[] ↓ deliver(a,l,v)) ∧ (♢[] ↓ deliver(b,m,w)) ⇒
  v=w)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-18**. References use the draft's printed page numbers.

Paper basis: **HBBSafe**, Definition 6.2.2, p. 47; Figure 8, p. 48. Correctness: Figure 9, p. 48; Theorem 6.2.6, p. 49. Proofs: Happy Termination: Proposition 6.6.3, pp. 54–55; Cascade Termination: Proposition 6.5.5, pp. 53–54; Agreement: Proposition 6.4.1, p. 52.

Pedagogical finite scenario: the protocol rules and full correctness conditionals are unmodified translations of the paper. The participants, history, quorums and positive facts are supplied to test the candidate axiom; this is not a literal history printed in the paper or an unbounded proof.

Code event order: `propose(v)`, `echo(v)`, `vote(l,v)`, and **`deliver(m,l,v)`**: `m` is the reporting learner, `l` the source learner, and `v` the value (Notation 6.2.3 and Remark 6.2.4, p. 47). HBBCorr instead uses the pair `deliver(l,v)`. Learners and values share one domain (Definition 3.1.1, p. 21).

`include ThyLive` keeps Figure 7, p. 43, Definition 5.2.4 dynamic: `LiveAlways`, `LiveSeq`, and both complete Knowledge schemes, over all ground events, with a single learner in each Knowledge□ instance, are checked at all possible worlds (Definition 5.2.1, p. 42). The schemes regenerate when the history changes. [Full source and notation map](../../docs/PAPER_MAP.md); [paper variants and their status](../../docs/PAPER_VARIANTS.md).

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "HBBSafe: end-only knowledge does not activate Echo!",
  "participants": [
    "p",
    "q"
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
      "place": "q",
      "event": {
        "symbol": "propose",
        "args": [
          "v"
        ]
      },
      "past": []
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
    },
    {
      "place": "q",
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
