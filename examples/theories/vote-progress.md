# When Vote! is removed

A live participant proposes and echoes the unique value, then never votes. With every axiom retained, this fixed history has no model. The curated browser preset already omits **Vote!**. Run **Use this history; find facts**: the remaining axioms have a model, while **Happy Termination** fails. Its premise and triggering proposal knowledge both hold. Cascade Termination and Agreement hold with absent scenarios because no delivery occurs.

The positive facts pin every participant as live at every time. The final silent † tuples are observations of real events, not extra protocol events. Keep the complete dynamic ThyLive include selected. Every claim below is the full conditional correctness formula from Figure 11 of the draft dated 18 November 2026; a true claim with an absent scenario is vacuous in this particular history.

No model of the full axioms on this fixed history is a consistency result, not a proof of any correctness claim. Run the reproducible comparison with `node demo.mjs`.

**Browser preset:** only **Vote!** is omitted. **Keep all axioms** selects the full-theory comparison; **Use example defaults** restores the omission. Neither action starts a run. The source declares every rule: plain Markdown imports and CLI runs retain them unless you specify `--drop "Vote!"`.

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
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Echo? [backward]:
  ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)
```

### Vote? — backward rule

A vote requires knowledge of a source quorum of prior matching echoes.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Vote? [backward]:
  ∀ l,v. vote(l,v) ⇒ □[l] ↓ echo(v)
```

### Deliver? — backward rule

Delivery requires knowledge of a reporting quorum of matching source-learner votes.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Deliver? [backward]:
  ∀ m,l,v. deliver(m,l,v) ⇒ □[m] ↓ vote(l,v)
```

### EchoNE — other assumption

A participant cannot echo a value different from one at an earlier actual local echo. Incomparable forks are not ordered by this rule.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom EchoNE [other]:
  ∀ v,w. echo(v) ⇒ ↓ echo(w) ⇒ v=w
```

### Echo! — forward rule

If an actual local tuple records a live participant knowing a proposal, that participant must echo some value at an actual local tuple. The value is existentially chosen; end-of-time knowledge alone does not activate the rule.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Echo! [forward]:
  ∀ v. ↕ (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```

### Vote! — forward rule

If an actual local tuple records a live participant knowing the required quorum of echoes, that participant must vote at an actual local tuple. The rule does not impose a time order between those two tuples. The required vote is for the same value.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Vote! [forward]:
  ∀ l,v. ↕ (live ∧ □[l] ↓ echo(v)) ⇒ ↕ vote(l,v)
```

### Deliver! — forward rule

If an actual local tuple records a live participant knowing the required quorum of votes, that participant must deliver at an actual local tuple. Merely learning of those votes at the end of time does not activate the rule.

```hsm
# Paper: Figure 10, p. 57; Definition 7.1.1.
axiom Deliver! [forward]:
  ∀ m,l,v. ↕ (live ∧ □[m] ↓ vote(l,v)) ⇒ ↕ deliver(m,l,v)
```

## Properties to check

Each correctness claim keeps its complete conditional premises. If its premises and trigger never occur together, the claim can hold vacuously. The experiment report records whether that full scenario occurs.

### Happy Termination — correctness claim

Under the displayed live-quorum and unique-proposal premises, the proposal-knowledge trigger requires delivery at each live participant. All premises and triggers are part of the checked formula.

```hsm
# Paper: Figure 11, p. 57; Theorem 7.1.3, p. 57; Proposition 7.3.3, pp. 59–60.
property Happy Termination [end]:
  ∀ l,v. ((□[l] live) ∧ (∃=1 w. ♢[] ↓ propose(w))) ⇒ (♢[] ↓ (live ∧ ♢[] ↓ propose(v)) ⇒
  live ⇒ ↕ deliver(l,l,v))
```

### Cascade Termination — correctness claim

Under the displayed trust and liveness premises, known delivery for the source learner requires delivery for the target learner at each live participant.

```hsm
# Paper: Figure 11, p. 57; Theorem 7.1.3, p. 57; Proposition 7.3.2, pp. 59–60.
property Cascade Termination [end]:
  ∀ a,b,l,v. ((♢[a,b] ⊤) ∧ (□[b] live)) ⇒ (♢[] ↓ deliver(a,l,v) ⇒ live ⇒ ↕
  deliver(b,l,v))
```

### Agreement — correctness claim

Under the displayed trust premise, the two known deliveries must have the same broadcast value.

```hsm
# Paper: Figure 11, p. 57; Theorem 7.1.3, p. 57; Proposition 7.3.1, p. 59.
property Agreement [end]:
  ∀ a,b,l,m,v,w. ((♢[l,m] seq)) ⇒ ((♢[] ↓ deliver(a,l,v)) ∧ (♢[] ↓ deliver(b,m,w)) ⇒
  v=w)
```

## Paper and interpretation

Implementation authorship: this executable theory was AI-generated following prompts by Murdoch J. Gabbay. Automated validation is described in the package; no independent expert audit of this translation is claimed. Source-paper authorship is listed separately.

Paper draft: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, **2026-11-18**. References use the draft's printed page numbers.

Paper basis: **HBBSimp**, Definition 7.1.1, p. 56; Figure 10, p. 57. Correctness: Figure 11, p. 57; Theorem 7.1.3, p. 57. Proofs: Happy Termination: Proposition 7.3.3, pp. 59–60; Cascade Termination: Proposition 7.3.2, pp. 59–60; Agreement: Proposition 7.3.1, p. 59.

Pedagogical weakening experiment based on HBBSimp, not a literal paper theory: every paper formula is initially unchanged. The instructed experiment omits `Vote!` so a live participant can stop after echoing; this tests why that progress axiom is needed on the supplied history.

Code event order: `propose(v)`, `echo(v)`, `vote(l,v)`, and **`deliver(m,l,v)`**: `m` is the reporting learner, `l` the source learner, and `v` the value (Notation 6.2.3 and Remark 6.2.4, p. 47). HBBCorr instead uses the pair `deliver(l,v)`. Learners and values share one domain (Definition 3.1.1, p. 21).

`include ThyLive` keeps Figure 7, p. 43, Definition 5.2.4 dynamic: `LiveAlways`, `LiveSeq`, and both complete Knowledge schemes, over all ground events, with a single learner in each Knowledge□ instance, are checked at all possible worlds (Definition 5.2.1, p. 42). The schemes regenerate when the history changes. [Full source and notation map](../../docs/PAPER_MAP.md); [paper variants and their status](../../docs/PAPER_VARIANTS.md).

Reference PDF: `hbb-disc(20261118-194826).pdf`, SHA-256 `08361854a013fa9ec7928221b9f05896386801b8d6247250a524c27d151199a4`.

## Supplied history

The JSON below fixes participants, values, quorum bases and the DAG. Synthesis searches predicate interpretations on this declared history; history search is a separate bounded mode.

```hsm-model
{
  "format": "history-structure-model/v1",
  "name": "A live participant stops before voting",
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
          "v"
        ]
      },
      "past": []
    },
    {
      "id": "e1",
      "place": "p",
      "event": {
        "symbol": "echo",
        "args": [
          "v"
        ]
      },
      "past": [
        "e0"
      ]
    },
    {
      "id": "e2",
      "place": "p",
      "event": null,
      "past": [
        "e1"
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
    }
  ]
}
```
