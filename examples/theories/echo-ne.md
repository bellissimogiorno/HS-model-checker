# What EchoNE rules out

This deliberately unsuitable history is a single sequential chain: red and blue are proposed, both are echoed, and both are voted for and delivered. NoLive makes the participant non-live; it remains sequential.

The curated browser preset omits **EchoNE**. Run **Use this history; find facts** to find a model in which Agreement is false: its sequential quorum-intersection premise holds, but the two delivered values differ.

Choose **Keep all axioms** for the comparison. EchoNE then rejects the real conflicting echoes, and changing predicate truth values cannot repair this fixed history. The result is **no model**, with all correctness claims **Not tested**; it is not an Agreement proof. In the omission run, both liveness claims hold with absent scenarios: NoLive excludes their live-quorum premise, and two distinct values are proposed. The saved evidence records the omission and can be replayed. All three full correctness formulas are checked by `node demo.mjs`.

**Browser preset:** only **EchoNE** is omitted. **Keep all axioms** selects the full-theory comparison; **Use example defaults** restores the omission. Neither action starts a run. The source declares every rule: plain Markdown imports and CLI runs retain them unless you specify `--drop "EchoNE"`.

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
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires knowledge of a source quorum of prior matching echoes.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ □[l] ↓ echo(v)
```

### Deliver? — backward rule

Delivery requires knowledge of a reporting quorum of matching source-learner votes.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Deliver? [backward]:
  ∀ m,l,v. deliver(m,l,v) ⇒ □[m] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### Echo! — forward rule

A live participant that knows a proposal must echo some value somewhere in its actual local run. The value is existentially chosen.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Echo! [forward]:
  ∀ v. (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

A live participant with quorum echoes must vote for that value somewhere in its actual local run.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Vote! [forward]:
  ∀ l,v. (live ∧ □[l] ↓ echo(v)) ⇒ ↕ vote(l,v)
```

### Deliver! — forward rule

A live participant with a reporting quorum of votes must deliver the indicated reporting learner, source learner and value somewhere in its actual local run.

```hsm
# Paper: Figure 9, p. 50; Definition 7.1.1.
axiom Deliver! [forward]:
  ∀ m,l,v. (live ∧ □[m] ↓ vote(l,v)) ⇒ ↕ deliver(m,l,v)
```

### NoLive — other assumption

This scenario assumption makes every participant non-live at every possible world. It isolates the safety question from liveness obligations.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim.
axiom NoLive [other]:
  ¬ live
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Liveness 1 — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 10, p. 50; Theorem 7.1.3, p. 51; Proposition 7.3.3, p. 53.
property Liveness 1 [end]:
  ∀ l,v. ((□[l] live) ∧ (∃¹ w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,l,v))
```

### Liveness 2 — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant.

```hsm
# Paper: Figure 10, p. 50; Theorem 7.1.3, p. 51; Proposition 7.3.2, p. 52.
property Liveness 2 [end]:
  ∀ a,b,l,v. ((♢[a,b] ⊤) ∧ (□[b] live)) ⇒ (♢[] ↓ deliver(a,l,v) ⇒ live ⇒ ↕
  deliver(b,l,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 10, p. 50; Theorem 7.1.3, p. 51; Proposition 7.3.1, p. 52.
property Agreement [end]:
  ∀ a,b,l,m,v,w. ((♢[l,m] seq)) ⇒ ((♢[] ↓ deliver(a,l,v)) ∧ (♢[] ↓ deliver(b,m,w)) ⇒
  v=w)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-07**. References use the draft's printed page numbers.

Paper basis: **ThyHBB2**, Definition 7.1.1, p. 49; Figure 9, p. 50. Correctness: Figure 10, p. 50; Theorem 7.1.3, p. 51. Proofs: Liveness 1: Proposition 7.3.3, p. 53; Liveness 2: Proposition 7.3.2, p. 52; Agreement: Proposition 7.3.1, p. 52.

Pedagogical weakening experiment based on ThyHBB2, not a literal paper theory: the file initially retains every paper axiom and adds the scenario assumption `NoLive`. The instructed experiment omits `EchoNE` to admit conflicting sequential echoes and deliveries; it does not change a paper correctness formula.

Code event order: `propose(v)`, `echo(v)`, `vote(l,v)`, and **`deliver(m,l,v)`**: `m` is the reporting learner, `l` the source learner, and `v` the value (Notation 6.1.3 and Remark 6.1.4, p. 42). HBB3 instead uses the pair `deliver(l,v)`. Learners and values share one domain (Definition 3.1.1, p. 17).

`include ThyLive` keeps Figure 6, p. 38, Definition 5.2.4 dynamic: `LiveAlways`, `LiveSeq`, and both complete Knowledge schemes, over all ground events and all finite learner lists (including empty lists and repetitions), are checked at all possible worlds (Definition 5.2.1, p. 37). The schemes regenerate when the history changes. [Full source and notation map](../../docs/PAPER_MAP.md); [paper variants and their status](../../docs/PAPER_VARIANTS.md).

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Two values echoed sequentially",
  "participants": [
    "p"
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
      "id": "e0",
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
      "id": "e1",
      "place": "p",
      "event": {
        "symbol": "propose",
        "args": [
          "blue"
        ]
      },
      "past": [
        "e0"
      ]
    },
    {
      "id": "e2",
      "place": "p",
      "event": {
        "symbol": "echo",
        "args": [
          "red"
        ]
      },
      "past": [
        "e1"
      ]
    },
    {
      "id": "e3",
      "place": "p",
      "event": {
        "symbol": "echo",
        "args": [
          "blue"
        ]
      },
      "past": [
        "e2"
      ]
    },
    {
      "id": "e4",
      "place": "p",
      "event": {
        "symbol": "vote",
        "args": [
          "red",
          "red"
        ]
      },
      "past": [
        "e3"
      ]
    },
    {
      "id": "e5",
      "place": "p",
      "event": {
        "symbol": "vote",
        "args": [
          "red",
          "blue"
        ]
      },
      "past": [
        "e4"
      ]
    },
    {
      "id": "e6",
      "place": "p",
      "event": {
        "symbol": "deliver",
        "args": [
          "red",
          "red",
          "red"
        ]
      },
      "past": [
        "e5"
      ]
    },
    {
      "id": "e7",
      "place": "p",
      "event": {
        "symbol": "deliver",
        "args": [
          "red",
          "red",
          "blue"
        ]
      },
      "past": [
        "e6"
      ]
    },
    {
      "id": "e8",
      "place": "p",
      "event": null,
      "past": [
        "e7"
      ]
    }
  ],
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
