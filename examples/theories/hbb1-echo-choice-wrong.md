# HBB1: the incorrect universal Echo! overconstrains choice

This example has exactly the history, facts, quorums and correctness properties of [the valid one-echo choice model](hbb1-echo-choice.md). It changes only **Echo!**, replacing its existentially chosen conclusion by the incorrect formula printed in Remark 6.2.3(2), p. 44, with both free variables universally closed.

The live participant knows proposals a and b but echoes only a. The bad axiom demands eventual echo(b) as well; this fixed history has no model. All three correctness claims are **Not tested** after that consistency failure. This is an overconstraint demonstration, not a correctness counterexample. In an extension that echoes both distinct values at the singleton, EchoNE would also forbid that choice. The valid example separately probes this precise bad formula and supplies a replayable counterexample to the probe.

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
# Paper: Figure 7, p. 41; Definition 6.1.2; Remark 6.2.2, p. 44.
axiom Safe [other]:
  ∀ l. safe(l) ⇔ ((∃⁰¹ v. ♢[] ↓ propose(v)) ∨ (∀ m. ♢[l,m] seq))
```

### Echo! — forward rule

This deliberately incorrect rule requires every domain value to be echoed. It removes the existential value choice from the paper’s correct rule.

```hsm
# Paper: Remark 6.2.3(2), p. 44; Definition 5.2.1(3), p. 37; Figure 7. Deliberately incorrect variant.
axiom Echo! [forward]:
  ∀ v,w. (live ∧ ♢[] ↓ propose(v)) ⇒ ↕ echo(w)
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

All rules and complete conditional correctness properties in this document are sourced to Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft dated 7 November 2026 (**2026-11-07**). Figure 7, p. 41 and Definition 6.1.2 give ThyHBB1; Figure 8, p. 41 and Theorem 6.1.6, p. 43 give its correctness statements.

This is a pedagogical finite model, not a literal history from the paper. Delivery arguments are ordered deliver(m,l,v): m is the reporting learner, l is the source/vote learner and v is the value.

The model, value domain, quorum basis, facts and any scenario-only axiom are choices of this finite experiment. Every experiment retains the complete dynamic ThyLive include: LiveAlways, LiveSeq and both Knowledge schemes are checked at all possible worlds, covering all ground events and all finite learner lists, including repeated learners and the empty list. See the [paper map](../../docs/PAPER_MAP.md) and [paper variants](../../docs/PAPER_VARIANTS.md) for the exact source mapping and classification.

Results concern this fixed finite history and all predicate interpretations extending its positive facts. They are not unbounded correctness or axiom-independence proofs.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "HBB1 echo choice: two proposals, one chosen echo",
  "participants": [
    "p"
  ],
  "values": [
    "a",
    "b"
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
      "id": "e0",
      "place": "p",
      "event": {
        "symbol": "propose",
        "args": [
          "a"
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
          "b"
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
          "a"
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
        "symbol": "vote",
        "args": [
          "a",
          "a"
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
          "b",
          "a"
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
        "symbol": "deliver",
        "args": [
          "a",
          "a",
          "a"
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
          "a",
          "b",
          "a"
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
          "b",
          "a",
          "a"
        ]
      },
      "past": [
        "e6"
      ]
    },
    {
      "id": "e8",
      "place": "p",
      "event": {
        "symbol": "deliver",
        "args": [
          "b",
          "b",
          "a"
        ]
      },
      "past": [
        "e7"
      ]
    },
    {
      "id": "e9",
      "place": "p",
      "event": null,
      "past": [
        "e8"
      ]
    }
  ],
  "quorums": {
    "a": [
      [
        "p"
      ]
    ],
    "b": [
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
          "a"
        ]
      }
    },
    {
      "place": "p",
      "at": "*",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    }
  ]
}
```
