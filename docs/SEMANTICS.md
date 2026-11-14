# History Structure Model-checker: independent semantic specification

Source: hbb-disc draft dated 7 November 2026, Sections 2–5; Figures 2–6; additionally Figures 7, 9, 11.

## Semantic data

A finite history is a hereditarily transitive finite set of triples `(place, maybeEvent, history)`. `†` is distinct from every event. It is a valid tuple label and is not itself an event proposition. Participants and values are nonempty domains. Values also serve as learners; there is no separate learner quantifier domain. The paper has no arity restriction, although a practical frontend may declare arities if it clearly states that convention.

Store actual tuples in a DAG. An edge denotes an explicitly supplied predecessor; the time of a node is the set of **all** its ancestors, not merely its direct parents. Taking the closure enforces hereditary transitivity. Node labels are `(place,event-or-†)`. All nodes belong to the full history. Displaying only a transitive reduction is fine provided the evaluator uses full ancestor closure.

Hash-cons times by the canonical set of tuple identities. Hash-cons tuples by `(place, maybeEvent, canonicalTime)`. File node IDs are aliases: two nodes with equal place, event and ancestor sets represent one tuple, even if their IDs or redundant edges differ. Set order and duplicate edges carry no meaning. Cycles are invalid. A topological file ordering does not introduce semantic ordering.

Represented times are exactly the distinct ancestor sets of actual tuples, together with the full history. Do not add arbitrary DAG subsets as possible times. Two nodes can share one represented time. Atomic predicates are interpreted at `(place,time)`, independent of the current maybe-event. Time aliases with contradictory predicate interpretations must be rejected rather than silently overwrite one another.

For each value, quorums form a nonempty up-closed family of nonempty pairwise intersecting participant subsets. Store only its minimal bases. Validate nonempty bases and pairwise intersection; normalize duplicates and remove strict supersets. Up-closure then satisfies Definition 3.3.2.

## Worlds and evaluation

Semantically, `World = Pnt × (Event ∪ {†}) × Time`. Worlds are not restricted to actual tuples. For `w=(p,x,T)`:

| Formula | Truth condition |
| --- | --- |
| `false` | false |
| `φ -> ψ` | material implication |
| `s = t` | equal values under variable valuation |
| `forall a. φ` | all values, including every value used as a learner |
| event `E(args)` | `x=E(args)` **and** exact tuple `(p,E(args),T)` belongs to full history |
| atomic predicate `P(args)` | membership in `rho(p,T)` |
| `past φ` (`↓`) | some actual tuple `w'` in T with the same place p satisfies φ |
| `end φ` | evaluate φ at `(p,†,fullHistory)` |
| `dia[l1,...,ln] φ` | for every independent quorum choice `Qi∈sigma(li)`, some `p'∈intersection(Qi)` satisfies φ at `(p',†,T)` |
| `seq` | every pair of actual tuples at p in T is equal or one belongs to the other's time |

Events at the end of time are always false. An actual tuple is not in its own time. Thus `seq` at an actual tuple examines its strict past and can remain true even when adding that tuple creates a fork. `seq` at the end then detects that fork. Silent `†` nodes count toward sequentiality.

`past` is strictly local to place. Global past is `dia[] past`. A quorum modality changes the place, resets the event to `†`, and preserves the time. In particular, `E -> dia[] E` is not valid.

## Sugar

Boolean sugar and existential quantification have their usual two-valued definitions. At-most-one and exactly-one value quantifiers can be evaluated by counting satisfying values (zero-or-one, exactly-one). Quantifiers bind all the way to the right; modal operators bind tightly. Parenthesized output should make ambiguous combinations explicit.

| Sugar | Definition |
| --- | --- |
| `allpast φ` (`⇓`) | `not past not φ` |
| `sometime φ` (`↕`) | `end past φ` |
| `everytime φ` (`⇕`) | `end allpast φ` |
| `box[L] φ` | `not dia[L] not φ` |
| `diaPast[L] φ` | `dia[L] past φ` |
| `boxPast[L] φ` | `box[L] past φ` |
| `diaAllPast[L] φ` | `dia[L] allpast φ` |
| `boxAllPast[L] φ` | `box[L] allpast φ` |

An empty learner list has one quorum-product choice and intersection equal to all participants: `dia[] φ` is existence of a participant satisfying φ at † and current time; `box[] φ` is universal satisfaction there.

Repeated learners are **independent** quorum choices. Never deduplicate learner lists. Pairwise intersections within one learner do not guarantee triple intersections. Empty intersections make diamond false and box true, including when their body is false. `allpast` and `everytime` are vacuously true if their corresponding local tuple sets are empty. `sometime true` is false at inactive participants.

## Validity and exact finite reduction

World validity concerns one selected world. End validity checks `(p,†,fullHistory)` for every participant. All-world validity checks the full semantic product. Every theory axiom uses all-world validity. A model's end-validity results alone do not establish that it satisfies its protocol theory.

Exact all-world checking can avoid enumerating the possibly infinite Event domain: at each `(p,T)`, check `†` and each actual ground event label E for which `(p,E,T)` belongs to full history. Every other x makes all event propositions false and is indistinguishable from †. This is exact for this language, including arbitrary event arities, since predicates ignore x and all modalities reset or ignore x.

The paper conventionally universally closes free value variables in theory axioms. Executable HSM theory files write those quantifiers explicitly; there is no implicit closure in the input language. Closed user queries reject unbound variables; programmatic evaluation can instead supply a valuation explicitly. Binding and shadowing must be handled consistently before memoization, and cache keys must contain the relevant value valuation.

## Quorum optimization

For a fixed learner list, calculate all intersections of minimal base choices, then discard duplicate intersections and strict supersets. Both diamond and box can be evaluated from this minimal intersection antichain: for the set S of places satisfying the body, diamond asks that every minimal intersection meet S, while box asks that some minimal intersection be a subset of S. Keep provenance for explanatory witnesses/counterexamples.

Intersect families incrementally, pruning dominated intersections at every step. Cache by evaluated learner list or normalized multiset with multiplicity. If ∅ occurs, the antichain is `{∅}` and the modality truth is immediately determined.

## ThyLive (Figure 6)

Verified visually against PDF page 38:

- `LiveAlways: live <-> end live`
- `LiveSeq: live -> seq`
- `KnowledgeDia[E]: end dia[] past (live and E) -> live -> sometime dia[] past E`
- `KnowledgeBox[E,L]: end box[L] past (live and E) -> live -> sometime box[L] past E`

`KnowledgeDia` has no learner parameter. `KnowledgeBox` ranges over arbitrary finite learner lists, rather than just lists of length one or two. Both range over all ground events.

An exact finite-model implementation of the unbounded list schema can enumerate the finite closure of intersection antichain families. Start with `{Pnt}` (empty list). Repeatedly multiply each reached family by every learner's base family (pairwise set intersections followed by minimal-antichain normalization), adding unseen families until closure. Each reachable family corresponds to some finite list and captures exactly the modality behavior of every list in that equivalence class. Check the schema for every reached family. An explicit state/resource cap is reasonable, but exhaustion must yield **incomplete/unknown**, never a validity claim.

For events, testing only actual events is generally insufficient for this schema: if a reachable family contains ∅, `box[L] past(live and E)` is true even when E never occurs. The conclusion then forces live participants to possess some actual local tuple (so that `sometime` can hold). Include one representative absent ground event when the signature has any absent events. All absent events have equivalent behavior for this scheme. If ESym is empty, Event is empty and the schemes have no event instances at all.

An empty model can satisfy ThyLive, e.g. with no live participants, with an empty event signature, or with no empty intersection families. Do not automatically impose LiveActive: paper Remark 5.2.12 deliberately omits it.

## Protocol-specific distinctions

`safe(l)` in HBB1 and the dotted equality/correlation in HBB3 are ordinary atomic predicates, subject to axioms. Dotted correlation is distinct from built-in value equality. It is local to place and time; symmetry and transitivity do not imply reflexivity. Its past persistence is an axiom, not a semantic definition. `live` likewise is time-invariant because of LiveAlways, not because predicate semantics special-cases it.

HBB1 Vote! has the `everytime safe(l)` premise. HBB3 Vote! and Vote'! conclude existence of **some** voted value; they do not force the value in the premise. HBB3 Vote'! requires `everytime corr(l,l')`, not just correlation at the current time.

## High-value regression examples

1. Empty history, one participant: `seq` is true; `past true` is false; `allpast false` is true; `sometime true` is false; `everytime false` is true; every event proposition is false.
2. One tuple `(p,E,∅)`: `E` is true at that tuple; `dia[] E` is false there; `box[] not E` is true there; `past E` is false there; `end past E` is true there.
3. Two incomparable tuples `(p,E,∅)` and `(p,F,∅)`: seq true at each tuple, seq false at end; end past E and end past F true; no event knows the other.
4. Tuple `(p,E,∅)` and later silent tuple at q knowing it: at the silent tuple local past E false but `dia[] past E` true.
5. Quorum bases `{p,q}`, `{p,r}`, `{q,r}`: one learner's pairwise intersection property passes; `dia[l,l] true` true, `dia[l,l,l] true` false; `box[l,l,l] false` true.
6. Canonically duplicate tuples and redundant predecessor edges must not alter any result, represented-time count, or sequentiality.
7. Predicate truth must agree between all worlds with equal place and time even if their current event differs.
8. A nonoccurring hypothetical event world must evaluate like † at the same place/time; validate the exact all-world representative reduction against explicit finite Event products on small models.

## Justification of exact reductions

**World representatives.** Fix a place p and represented time T. If x is not the label of an actual tuple `(p,x,T)` with x an event, every event proposition is false at `(p,x,T)`. It is also false at `(p,†,T)`. Predicate atoms and seq depend only on p,T; value equality depends only on the valuation. Every primitive modality either disregards the incoming x when selecting actual past tuples or replaces it with †. Structural induction on a formula, with the same valuation on both sides, therefore proves equivalence of these worlds. Quantification preserves that equivalence for every valuation. Each actual event label at p,T must be retained, because its matching event atom distinguishes it from †. The reduced world set consequently gives exactly the same all-world validity judgement as the full, possibly infinite product.

**Canonical DAG.** Process input nodes in a topological order. Assume every predecessor already denotes a unique canonical tuple and its complete canonical time set. Define a node's time as the union, over its predecessor aliases, of that predecessor tuple and all tuples in its time. This is a finite set, is transitively closed, and contains no tuple whose time contains the current node (acyclicity). Intern that set, then intern the triple consisting of place, maybe-event and interned time. Induction proves that equal semantic triples receive one identity and every tuple's time is the exact full-information history denoted by its ancestor closure. Duplicate aliases and redundant edges therefore do not affect the result. The union of all resulting tuples is a history, and the distinct node-time sets together with that union give exactly Definition 3.4.2's represented times.

**Minimal quorum bases.** Every quorum in a finite up-closed family contains a minimal base. Replacing each chosen quorum by such a base shrinks its intersection. If all minimal-base intersections meet the body-truth set S, all larger quorum intersections meet S too. Conversely, minimal bases are themselves allowed quorums. Thus diamond is exact on base products. If some larger intersection is contained in S, its contained minimal-base intersection is also contained in S; conversely every base choice is allowed. Thus box is exact too. Given a product family, a strict superset intersection J of some intersection I is redundant for both questions: I meeting S implies J meets S, and J being contained in S implies I is contained in S.

**Unbounded list saturation.** Associate each learner list L with the minimal antichain A(L) of intersections obtainable from independently chosen minimal bases. The empty list has A([])={Pnt}. Appending learner l maps A to the normalized family `{I∩Q : I∈A, Q a base of l}`. Discarded supersets remain redundant under subsequent intersections, since I⊆J implies I∩Q⊆J∩Q. This update therefore gives exactly A(L appended l). Breadth-first closure reaches every finite list by induction on length; every reached state conversely has a witnessing list. There are finitely many antichains of subsets of finite Pnt, so closure terminates in principle. The two quorum modalities depend only on A(L), so checking one representative per reached antichain checks every list instance of KnowledgeBox exactly. This is a finite-model fact, not a fixed small bound on list length. A search stopped by any resource quota has not established saturation.

**Absent events.** If a ground event E does not label any actual tuple, E is false at every world: even a world whose current label is E fails the occurrence condition. The same is true for any other absent ground event F. Structural induction therefore permits replacing E by F in the Knowledge schemes without changing any instance's truth. One absent representative suffices, alongside all occurring events. It cannot always be omitted: a quorum family containing the empty intersection makes the Box antecedent true independently of its event body.
