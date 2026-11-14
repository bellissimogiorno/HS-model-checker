# HSM semantic contract

HSM implements the two-valued language of *Heterogeneous trust in reliable broadcast via modal logic and history structures*, Murdoch J. Gabbay and Isaac Sheff, draft **2026-11-07**. The paper's definitions determine the semantics. The 3μQL implementation supplies engineering techniques and interface conventions.

This is the short checking contract. [SEMANTICS.md](SEMANTICS.md) gives the reduction arguments; [PAPER_MAP.md](PAPER_MAP.md) maps notation, rules and correctness statements to the draft.

## Models and contexts

A model has finite nonempty participant and value domains, a finite history, a quorum semifilter for every value, and an interpretation of ordinary predicates. Values also serve as learners; every value quantifier ranges over that same domain.

A history is a hereditarily transitive finite set of triples `(participant, maybe-event, history)`. The JSON DAG stores generators of each tuple's past. The engine takes complete ancestor closure, rejects cycles and merges equal mathematical triples. File IDs are aliases, not additional mathematical distinctions. Empty histories and silent `†` tuples are allowed.

Represented times are exactly the distinct tuple pasts and the full history. Arbitrary downward-closed DAG subsets are not automatically represented times. Possible worlds are `(participant, maybe-event, represented time)`, including hypothetical worlds that are not actual tuples.

Each learner's quorums form a nonempty up-closed family of nonempty pairwise-intersecting participant subsets. JSON lists minimal bases; redundant supersets and repeated bases do not add semantics. Different learners need not have intersecting quorums. Pairwise intersection does not imply triple intersection.

An ordinary predicate's truth depends on participant, time and arguments, independently of the current maybe-event. A completed JSON model uses a sparse **total** interpretation: listed predicate facts are true and all unlisted facts are false. Synthesis uses a different interpretation of the input facts, described below.

## Truth and operators

Truth values are **false and true**, with only true satisfying an obligation. Implication is material implication. Equality compares values under the current valuation. Bound variables have lexical scope and may shadow outer variables; closed checking queries reject free variables. `∃`, `∃¹` and `∃⁰¹` mean existence, exactly one and at most one satisfying value respectively. Unicode and ASCII spellings parse to the same trees.

| Construct | Meaning at `(p,x,T)` |
| --- | --- |
| Event `E(args)` | `x` is that event and the exact tuple `(p,E(args),T)` occurs in the full history. Matching a hypothetical event label alone is insufficient. |
| `↓ φ` | Some actual tuple in `T` at participant `p` satisfies `φ`. |
| `⇓ φ` | Every actual tuple in `T` at participant `p` satisfies `φ`. |
| `end φ` | Evaluate at `(p,†,full history)`. |
| `↕ φ` / `⇕ φ` | Some / every actual local tuple in the complete history satisfies `φ`. These operators impose no future ordering. |
| `♢[l₁,…,lₙ] φ` | For every independent choice of one quorum per listed learner, its intersection contains a participant satisfying `φ` at current time and event `†`. |
| `□[l₁,…,lₙ] φ` | Some such quorum intersection consists entirely of participants satisfying `φ` at current time and event `†`. |
| `seq` | Actual local tuples in `T` are pairwise equal or ordered by membership in one another's pasts. |

The empty learner list has one quorum choice with intersection equal to all participants: `♢[]` is existential and `□[]` universal over participants. Repeated learners make independent choices and must not be deduplicated. An empty intersection makes diamond false and box true. Empty local pasts make `↓` false and `⇓` true. Events at the full-history world with current event `†` are false.

`safe`, `corr` and `live` are interpreted predicates constrained by axioms. They are not special semantic operations. In particular, correlation is distinct from equality and is not automatically reflexive. HSM adds no terminal stutter, numeric successor time or fixed-point semantics.

## Axiom and property obligations

Every retained theory axiom must hold at **all possible worlds**. `include ThyLive` retains its complete dynamic theory, including both Knowledge schemes; it is not a saved finite instance list.

Theory properties have an explicit `end` or `all` validity scope; the default is `end`. End validity checks every participant at `(p,†,full history)`. All validity checks every possible world. A separate supplied-model query may select one exact world. Rule directions `backward`, `forward` and `other` are descriptive metadata; they do not change axiom validity.

For the requested class `S`, retained axiom set `A` and selected property `P`, the checking obligation is:

```text
axioms_valid(M) = every A is true at every all-world axiom context
consistency     = find M ∈ S with axioms_valid(M)
counterexample  = find M ∈ S with axioms_valid(M)
                 and P false at some context required by P's scope
```

Consistency is established before validity is reported. Selecting no properties asks only for a model of the retained axioms. Inconsistent assumptions leave properties untested. A verified counterexample remains a refutation even when another property or part of the requested search is incomplete.

## What each mode searches

| Mode | Requested class `S` and interpretation of input facts |
| --- | --- |
| Evaluate the supplied model | The one supplied history and complete predicate interpretation. Unlisted facts are false. A `no-model` result means this interpretation violates assumptions; it does not exclude a different interpretation on that history. |
| Use this history; find facts | Fixed participants, values, history and quorum bases; search all ordinary predicate interpretations relevant to the obligations. Listed positive facts are pinned by default; unlisted atoms are free. Disabling pins releases those positive constraints. |
| Search histories and valuations | Extend the declared history within the explicit tuple bound and event palette, and search predicate interpretations on each candidate. Participants, values and quorums stay fixed. |

History search permits at most eight additional and sixteen total canonical tuples. Candidate, compiler, solver, Knowledge-family and time budgets can stop a run before mathematical bounds are exhausted. A generation cap is not exhaustion. A failing prefix is not discarded merely because a forward obligation could be discharged by an extension. Canonicalization preserves named participants, values and base tuple anchors.

`*` fact pins apply at every represented time of each candidate; `end` follows its full history; a base tuple alias retains its past. Search rejects ordinal `@tN` pins because insertion can change their meanings. The full history/value/trust/palette scope is part of the result.

## Exact encoding and its limits

The fixed-frame Boolean encoding uses the following exact reductions:

- Canonical DAG tuples represent the finite histories above without depending on file order or redundant edges.
- At each participant/time pair, `†` and occurring matching event labels represent all possible current events. Other labels make every event proposition false and are indistinguishable from `†` in this language.
- Minimal intersection antichains represent quorum modality truth, retaining learner multiplicities.
- Finite saturation of those antichains represents every finite learner list in the Knowledge scheme. Occurring events plus an absent-event representative cover its event instances. Failure to complete saturation is incomplete checking.

Each admissible predicate interpretation assigns the encoded ground atoms and therefore induces a Boolean assignment satisfying their semantic equations. Conversely, decoding a satisfying assignment and assigning irrelevant unlisted atoms false gives a complete interpretation on the legal fixed frame. The direct evaluator checks every retained axiom and claimed failure in each decoded witness. [SEMANTICS.md](SEMANTICS.md) explains why the structural reductions preserve these obligations.

The concrete evaluator does not use the SAT compiler's truth calculations. A replay reconstructs the source, selection, frame and interpretation; validates scope and pins; checks all retained axioms; and checks the saved failing world. Saved truth flags are not proof. Source/run fingerprints identify content; they do not authenticate it or establish logical correctness.

A counterexample is checked directly. An UNSAT or exhausted no-counterexample conclusion still depends on the encoding, reductions and solver. This release does not emit independently checkable UNSAT proof certificates. Small exhaustive, oracle and mutation tests provide empirical evidence, not a formal verification of the implementation.

Successful finite checking is not an unbounded protocol theorem. A finite countermodel refutes the corresponding paper claim only when it is an admissible instance of that claim with the same assumptions and validity context. No broader operational or natural-number-time interpretation is inferred.

## Result and resource contract

`counterexample`, `holds`, `no-model`, `incomplete`, and input errors remain distinct. Read `complete`, consistency and per-property fields together: a whole run can be incomplete while containing verified property counterexamples. No-model histories encountered during partial enumeration do not establish inconsistency over the entire requested class.

The experiment budget starts on entry to the checking call and covers its preparation and phases. Runtime startup is separate. Expensive phases have cooperative checks; the browser can terminate its worker for a harder stop. Progress reports observed work, not invented percentages or model counts inferred from SAT decisions. Interrupted progress alone is neither a witness nor an exhaustion certificate.
