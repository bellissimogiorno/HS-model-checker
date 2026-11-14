# A live quorum vote stops before delivery

This is a pedagogical **Deliver! omission**. The complete protocol chain would be proposal → echo → vote → delivery. This supplied history has one live sequential participant and stops after the vote. The final silent † tuple observes the latest real event and supplies the eventual knowledge required by ThyLive; it is not an additional protocol action.

Deliver! is the sole failed original rule. Removing it leaves a quorum vote for the known unique value but no delivery, so Liveness 1 fails nonvacuously. Liveness 2 and Agreement have absent scenarios because no source delivery occurs. The progress rules are Figure 11; compare Liveness 1’s proof in Proposition 8.5.1, pp. 59–60.

**Browser preset:** only **Deliver!** is omitted. **Keep all axioms** selects the full-theory comparison; **Use example defaults** restores the omission. Neither action starts a run. The source declares every rule: plain Markdown imports and CLI runs retain them unless you specify `--drop "Deliver!"`.

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
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires either quorum echoes of that value, or knowledge of a matching vote for a currently correlated learner.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ ((□[l] ↓ echo(v)) ∨ (∃ m. (corr(m,l) ∧ ♢[] ↓ vote(m,v))))
```

### Deliver? — backward rule

Delivery requires knowledge of a quorum of matching votes for the same learner.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Deliver? [backward]:
  ∀ l,v. deliver(l,v) ⇒ □[l] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### VoteNE — other assumption

An actual local vote and an earlier local vote for correlated learners must carry the same value.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom VoteNE [other]:
  ∀ l,m,v,w. vote(l,v) ⇒ ↓ vote(m,w) ⇒ corr(l,m) ⇒ v=w
```

### 3twined — other assumption

Every triple of independently chosen learner quorums must have a common participant. Repeated learner names still make independent quorum choices.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom 3twined [other]:
  ∀ l,m,n. ♢[l,m,n] ⊤
```

### CorrSeq — other assumption

For every choice of one quorum from each correlated learner, their intersection must contain a sequential participant.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom CorrSeq [other]:
  ∀ l,m. corr(l,m) ⇒ ♢[l,m] seq
```

### CorrPast — other assumption

Correlation persists to every actual earlier local tuple. Its temporal operator ranges over recorded local tuples, rather than every hypothetical world.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom CorrPast [other]:
  ∀ l,m. corr(l,m) ⇒ ⇓ corr(l,m)
```

### CorrSymm — other assumption

Correlation is symmetric. Reflexivity is not an additional assumption.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom CorrSymm [other]:
  ∀ l,m. corr(l,m) ⇒ corr(m,l)
```

### CorrTran — other assumption

Correlation is transitive.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom CorrTran [other]:
  ∀ l,m,n. corr(l,m) ⇒ corr(m,n) ⇒ corr(l,n)
```

### Echo! — forward rule

A live participant that knows a proposal must echo some value somewhere in its actual local run. The value is existentially chosen.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Echo! [forward]:
  ∀ v. (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

A live participant with quorum echoes must vote for some value for that learner somewhere in its actual local run. The chosen value remains existential.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Vote! [forward]:
  ∀ l,v. (live ∧ □[l] ↓ echo(v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Vote'! — forward rule

With correlation at every actual local tuple and knowledge of a correlated learner’s vote, a live participant must vote for some value for the target learner somewhere in its actual local run.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Vote'! [forward]:
  ∀ l,m,v. (live ∧ ⇕ corr(l,m) ∧ ♢[] ↓ vote(m,v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Deliver! — forward rule

A live participant with quorum votes must deliver that learner and value somewhere in its actual local run.

```hsm
# Paper: Figure 11, p. 56; Definition 8.2.1, p. 55.
axiom Deliver! [forward]:
  ∀ l,v. (live ∧ □[l] ↓ vote(l,v)) ⇒ ↕ deliver(l,v)
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Liveness 1 — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 12, p. 56; Theorem 8.2.3, p. 57; Proposition 8.5.1, pp. 59–60.
property Liveness 1 [end]:
  ∀ l,v. ((□[l] live) ∧ (∃¹ w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,v))
```

### Liveness 2 — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant.

```hsm
# Paper: Figure 12, p. 56; Theorem 8.2.3, p. 57; Proposition 8.4.5, p. 59.
property Liveness 2 [end]:
  ∀ l,m,v. ((□[] corr(l,m)) ∧ (□[m] live)) ⇒ (♢[] ↓ deliver(l,v) ⇒ live ⇒ ↕
  deliver(m,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 12, p. 56; Theorem 8.2.3, p. 57; Proposition 8.3.1, p. 57.
property Agreement [end]:
  ∀ l,m,v,w. ((□[] corr(l,m))) ⇒ ((♢[] ↓ deliver(l,v)) ∧ (♢[] ↓ deliver(m,w)) ⇒ v=w)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Source: Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft 7 November 2026 (`2026-11-07`; the supplied `hbb-disc` draft).

The protocol rules are Figure 11, p. 56, Definition 8.2.1, p. 55. The three conditional claims are Figure 12, p. 56, Theorem 8.2.3, p. 57: Agreement is proved in Proposition 8.3.1, p. 57; Liveness 2 in Proposition 8.4.5, p. 59; Liveness 1 in Proposition 8.5.1, pp. 59–60. The executable names `CorrSeq`, `CorrPast`, `CorrSymm`, and `CorrTran` denote the paper’s dotted-equality rules (≐seq), (≐⇓), (≐symm), and (≐tran). Here `vote(l,v)` and `deliver(l,v)` have two arguments: learner first, broadcast value second.

This document is a pedagogical scenario/experiment, not a literal paper theory listing. Choose **Use this history; find facts** to search predicate interpretations on the declared DAG, with the supplied positive facts pinned. The matrix applies exactly the omission or replacement described above; every other protocol axiom and the complete dynamic `ThyLive` include remain selected. A no-model result concerns this exact history and is not a proof of a correctness theorem. Every false conditional is checked with its full premise and trigger true at the recorded failure binding. A true claim with an absent scenario is vacuous here. See the [paper map](../../docs/PAPER_MAP.md) and [paper variants](../../docs/PAPER_VARIANTS.md) for the complete source correspondence. HBB1 and HBB2 use three-argument deliveries, whereas this HBB3 example uses `deliver(l,v)`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "A live quorum vote stops before delivery",
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
      "id": "observed",
      "place": "p",
      "event": null,
      "past": [
        "voted"
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
