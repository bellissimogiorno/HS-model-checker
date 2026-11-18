# Correlation propagation without Vote'!

This is a pedagogical **Vote'! omission**, specifically exercising Cascade Termination. The two live participants propose different values and each echoes only its own value. Learner a has quorum {p}; learner b has quorum {p,q}. Both participants vote for and deliver a’s value, with final silent observations ensuring the complete Knowledge schemes hold. Every learner is correlated everywhere, and all local histories are sequential. The mixed echo quorum {p,q} never unanimously supports any value, so Vote! cannot initiate a b-vote.

The source a-vote activates Vote'!, which is the sole failed original rule. Omitting it prevents any b-delivery, so Cascade Termination fails with correlation, a live b-quorum, and source delivery all present. Happy Termination’s unique-proposal scenario is absent; Agreement holds with a delivery scenario present. The rule’s role is discussed in Proposition 8.4.5, pp. 65–66, and footnote 64, p. 62: the paper’s `⇕ corr` premise is deliberate.

**Browser preset:** only **Vote'!** is omitted. **Keep all axioms** selects the full-theory comparison; **Use example defaults** restores the omission. Neither action starts a run. The source declares every rule: plain Markdown imports and CLI runs retain them unless you specify `--drop "Vote'!"`.

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
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires either quorum echoes of that value, or knowledge of a matching vote for a currently correlated learner.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ ((□[l] ↓ echo(v)) ∨ (∃ m. (corr(m,l) ∧ ♢[] ↓ vote(m,v))))
```

### Deliver? — backward rule

Delivery requires knowledge of a quorum of matching votes for the same learner.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Deliver? [backward]:
  ∀ l,v. deliver(l,v) ⇒ □[l] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### VoteNE — other assumption

An actual local vote and an earlier local vote for correlated learners must carry the same value.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom VoteNE [other]:
  ∀ l,m,v,w. vote(l,v) ⇒ ↓ vote(m,w) ⇒ corr(l,m) ⇒ v=w
```

### 3twined — other assumption

Every triple of independently chosen learner quorums must have a common participant. Repeated learner names still make independent quorum choices.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom 3twined [other]:
  ∀ l,m,n. ♢[l,m,n] ⊤
```

### CorrSeq — other assumption

For every choice of one quorum from each correlated learner, their intersection must contain a sequential participant.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom CorrSeq [other]:
  ∀ l,m. corr(l,m) ⇒ ♢[l,m] seq
```

### CorrPast — other assumption

Correlation persists to every actual earlier local tuple. Its temporal operator ranges over recorded local tuples, rather than every hypothetical world.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom CorrPast [other]:
  ∀ l,m. corr(l,m) ⇒ ⇓ corr(l,m)
```

### CorrSymm — other assumption

Correlation is symmetric. Reflexivity is not an additional assumption.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom CorrSymm [other]:
  ∀ l,m. corr(l,m) ⇒ corr(m,l)
```

### CorrTran — other assumption

Correlation is transitive.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom CorrTran [other]:
  ∀ l,m,n. corr(l,m) ⇒ corr(m,n) ⇒ corr(l,n)
```

### Echo! — forward rule

If an actual local tuple records a live participant knowing a proposal, that participant must echo some value at an actual local tuple. The value is existentially chosen; end-of-time knowledge alone does not activate the rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Echo! [forward]:
  ∀ v. ↕ (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

If an actual local tuple records a live participant knowing the required quorum of echoes, that participant must vote at an actual local tuple. The rule does not impose a time order between those two tuples. The vote value remains existentially chosen.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Vote! [forward]:
  ∀ l,v. ↕ (live ∧ □[l] ↓ echo(v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Vote'! — forward rule

If an actual local tuple records a live participant knowing a correlated source vote, and correlation holds at every actual local tuple, that participant must vote for some value at an actual local tuple. The existential value choice is retained.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
axiom Vote'! [forward]:
  ∀ l,m,v. ↕ (live ∧ ⇕ corr(l,m) ∧ ♢[] ↓ vote(m,v)) ⇒ ∃ w. ↕ vote(l,w)
```

### Deliver! — forward rule

If an actual local tuple records a live participant knowing the required quorum of votes, that participant must deliver at an actual local tuple. Merely learning of those votes at the end of time does not activate the rule.

```hsm
# Paper: Figure 12, p. 63; Definition 8.2.1, p. 62.
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

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Source: Murdoch J. Gabbay and Isaac Sheff, *Heterogeneous trust in reliable broadcast via modal logic and history structures*, draft 18 November 2026 (`2026-11-18`; the supplied `hbb-disc` draft).

The protocol rules are Figure 12, p. 63, Definition 8.2.1, p. 62. The three conditional claims are Figure 13, p. 63, Theorem 8.2.3, p. 64: Agreement is proved in Proposition 8.3.1, p. 64; Cascade Termination in Proposition 8.4.5, pp. 65–66; Happy Termination in Proposition 8.5.1, p. 66. The executable names `CorrSeq`, `CorrPast`, `CorrSymm`, and `CorrTran` denote the paper’s dotted-equality rules (≐seq), (≐⇓), (≐symm), and (≐tran). Here `vote(l,v)` and `deliver(l,v)` have two arguments: learner first, broadcast value second.

This document is a pedagogical scenario/experiment, not a literal paper theory listing. Choose **Use this history; find facts** to search predicate interpretations on the declared DAG, with the supplied positive facts pinned. The matrix applies exactly the omission or replacement described above; every other protocol axiom and the complete dynamic `ThyLive` include remain selected. A no-model result concerns this exact history and is not a proof of a correctness theorem. Every false conditional is checked with its full premise and trigger true at the recorded failure binding. A true claim with an absent scenario is vacuous here. See the [paper map](../../docs/PAPER_MAP.md) and [paper variants](../../docs/PAPER_VARIANTS.md) for the complete source correspondence. HBBSafe and HBBSimp use three-argument deliveries, whereas this HBBCorr example uses `deliver(l,v)`.

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "Echoes disagree across a live reporting quorum",
  "participants": [
    "p",
    "q"
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
      "corr"
    ]
  },
  "nodes": [
    {
      "id": "pa",
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
      "id": "pe",
      "place": "p",
      "event": {
        "symbol": "echo",
        "args": [
          "a"
        ]
      },
      "past": [
        "pa"
      ]
    },
    {
      "id": "qb",
      "place": "q",
      "event": {
        "symbol": "propose",
        "args": [
          "b"
        ]
      },
      "past": []
    },
    {
      "id": "qe",
      "place": "q",
      "event": {
        "symbol": "echo",
        "args": [
          "b"
        ]
      },
      "past": [
        "qb"
      ]
    },
    {
      "id": "pv",
      "place": "p",
      "event": {
        "symbol": "vote",
        "args": [
          "a",
          "a"
        ]
      },
      "past": [
        "pe"
      ]
    },
    {
      "id": "qv",
      "place": "q",
      "event": {
        "symbol": "vote",
        "args": [
          "a",
          "a"
        ]
      },
      "past": [
        "qe",
        "pv"
      ]
    },
    {
      "id": "pd",
      "place": "p",
      "event": {
        "symbol": "deliver",
        "args": [
          "a",
          "a"
        ]
      },
      "past": [
        "pv"
      ]
    },
    {
      "id": "qd",
      "place": "q",
      "event": {
        "symbol": "deliver",
        "args": [
          "a",
          "a"
        ]
      },
      "past": [
        "qv",
        "pd"
      ]
    },
    {
      "id": "po",
      "place": "p",
      "event": null,
      "past": [
        "qd"
      ]
    },
    {
      "id": "qo",
      "place": "q",
      "event": null,
      "past": [
        "po"
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
        "p",
        "q"
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
          "a",
          "a"
        ]
      }
    },
    {
      "place": "p",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "a",
          "b"
        ]
      }
    },
    {
      "place": "p",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "b",
          "a"
        ]
      }
    },
    {
      "place": "p",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "b",
          "b"
        ]
      }
    },
    {
      "place": "q",
      "at": "*",
      "atom": "live"
    },
    {
      "place": "q",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "a",
          "a"
        ]
      }
    },
    {
      "place": "q",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "a",
          "b"
        ]
      }
    },
    {
      "place": "q",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "b",
          "a"
        ]
      }
    },
    {
      "place": "q",
      "at": "*",
      "atom": {
        "symbol": "corr",
        "args": [
          "b",
          "b"
        ]
      }
    }
  ]
}
```
