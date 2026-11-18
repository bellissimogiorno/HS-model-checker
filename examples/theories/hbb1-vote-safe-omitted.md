# HBBSafe: omit only the safety guard from Vote?

Source learners a and b have disjoint singleton quorums {q} and {r}; reporting learner c has the sequential singleton quorum {p}. Participant q echoes a and r echoes b without local equivocation. Participant p votes for the two different source learners and delivers both values via reporter c. The exact Safe definition is retained; positive facts record its true instances at the declared prefixes. After both proposals, the disjoint intersections make these learners unsafe. A scenario-only **NoLive** axiom keeps all participants non-live, so the forward obligations are vacuous. The example therefore isolates safety from liveness.

**This edited theory has an Agreement counterexample**: it deletes only the `safe(l)` conjunct from Vote?, leaving quorum support, EchoNE, Safe and all ThyLive schemes intact. The [full-guard control](hbb1-vote-safe.md) on the same history has no model because that conjunct is false at the offending votes.

In that counterexample, both reporting variables of Agreement are assigned learner c, its source variables l and m are assigned learners a and b, and the delivered values are the distinct a and b. HBBSafe Agreement constrains reporting intersections; the distinct source quorums need not intersect. Both liveness scenarios are absent. This deliberate local weakening is not claimed to be one of the paper's incorrect examples; its relevance follows from Figure 8 and the Agreement proof, Proposition 6.4.1, p. 52.

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
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

This experimental weakening removes only the `safe(l)` guard. Knowledge of a quorum of prior matching echoes is still required.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim. Figure 8.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ □[l] ↓ echo(v)
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
# Paper: Figure 8, p. 48; Definition 6.2.2; Remark 6.3.2, pp. 50–51.
axiom Safe [other]:
  ∀ l. safe(l) ⇔ ((∃⩽1 v. ♢[] ↓ propose(v)) ∨ (∀ m. ♢[l,m] seq))
```

### Echo! — forward rule

If an actual local tuple records a live participant knowing a proposal, that participant must echo some value at an actual local tuple. The value is existentially chosen; end-of-time knowledge alone does not activate the rule.

```hsm
# Paper: Figure 8, p. 48; Definition 6.2.2.
axiom Echo! [forward]:
  ∀ v. ↕ (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
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

### NoLive — other assumption

This scenario assumption makes every participant non-live at every possible world. It isolates the safety question from liveness obligations.

```hsm
# Scenario: added for this experiment; not a paper axiom or correctness claim.
axiom NoLive [other]:
  ¬ live
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

All rules and complete conditional correctness properties in this document are sourced to Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft dated 18 November 2026 (**2026-11-18**). Figure 8, p. 48 and Definition 6.2.2 give HBBSafe; Figure 9, p. 48 and Theorem 6.2.6, p. 49 give its correctness statements.

This is a pedagogical finite model, not a literal history from the paper. Delivery arguments are ordered deliver(m,l,v): m is the reporting learner, l is the source/vote learner and v is the value.

The model, value domain, quorum basis, facts and any scenario-only axiom are choices of this finite experiment. Every experiment retains the complete dynamic ThyLive include: LiveAlways, LiveSeq and both Knowledge schemes are checked at all possible worlds, covering all ground events and each single learner for the quorum Knowledge scheme. See the [paper map](../../docs/PAPER_MAP.md) and [paper variants](../../docs/PAPER_VARIANTS.md) for the exact source mapping and classification.

Results concern this fixed finite history and all predicate interpretations extending its positive facts. They are not unbounded correctness or axiom-independence proofs.

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "HBBSafe Vote? safety guard: disjoint echo quorums, sequential reporter",
  "participants": [
    "p",
    "q",
    "r"
  ],
  "values": [
    "a",
    "b",
    "c"
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
      "place": "q",
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
      "place": "r",
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
      "place": "q",
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
      "place": "r",
      "event": {
        "symbol": "echo",
        "args": [
          "b"
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
          "a",
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
        "symbol": "vote",
        "args": [
          "b",
          "b"
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
          "c",
          "a",
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
          "c",
          "b",
          "b"
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
    "a": [
      [
        "q"
      ]
    ],
    "b": [
      [
        "r"
      ]
    ],
    "c": [
      [
        "p"
      ]
    ]
  },
  "facts": [
    {
      "place": "p",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "p",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "p",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    },
    {
      "place": "q",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "q",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "q",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    },
    {
      "place": "r",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "r",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "r",
      "at": "empty",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    },
    {
      "place": "p",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "p",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "p",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    },
    {
      "place": "q",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "q",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "q",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    },
    {
      "place": "r",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "a"
        ]
      }
    },
    {
      "place": "r",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "b"
        ]
      }
    },
    {
      "place": "r",
      "at": "e1",
      "atom": {
        "symbol": "safe",
        "args": [
          "c"
        ]
      }
    }
  ]
}
```
