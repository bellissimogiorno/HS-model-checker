# Model format and programmatic API

## JSON representation

```json
{
  "format": "history-structure-model/v1",
  "name": "One event and its later observation",
  "participants": ["p"],
  "values": ["v"],
  "signature": {"events": ["E"], "predicates": ["live"]},
  "nodes": [
    {"id":"h0", "place":"p", "event":{"symbol":"E","args":["v"]}, "past":[]},
    {"id":"h1", "place":"p", "event":null, "past":["h0"]}
  ],
  "quorums": {"v":[["p"]]},
  "facts": [{"place":"p", "at":"*", "atom":"live"}]
}
```

The participant and value arrays must each be nonempty and contain distinct, nonempty strings. They are separate semantic domains: the same label may occur once in each array. Every value has a quorum interpretation. The event/predicate symbol lists are disjoint; symbols have arbitrary arities, matching the paper. Ground atom arguments are strings drawn from `values`. A string atom abbreviates zero arguments. No code strings are executed.

All declared nodes belong to the history. IDs are aliases for mathematical tuples, not independent occurrence identities. Identical `(place,event,closedPast)` triples merge even if named differently. Node order, redundant transitive edges and aliases do not alter the history. Past references can point forward in the file, provided the resulting graph is acyclic. Repeated IDs, cycles, unknown references/values/symbols and unknown schema fields are errors. `nodes` defaults to an empty array if absent; `facts` also defaults to empty, and a node's missing `past` defaults to empty. Duplicate entries inside a set-style array are rejected to catch accidental repetition; repeated learner terms in **formulas**, by contrast, are meaningful and retained.

IDs `end`, `empty`, `*` and every ID beginning with `@` are reserved. The generated represented-time IDs `@t0`, `@t1`, … are display/checking selectors, not durable identities across model edits. A tuple ID selects the time **before** that tuple, rather than a history containing it.

Quorum arrays are generators of an upward-closed family, not a list required to enumerate every quorum. Each learner must have at least one nonempty generator, and its generators must be pairwise intersecting. Redundant superset generators are removed. Different learners need not have intersecting quorums.

Each positive fact has `place`, `at` and `atom`. `at` is one selector or a nonempty array of selectors:

| Selector | Interpretation |
| --- | --- |
| `"*"` | Every represented time |
| `"end"` | Full history |
| `"empty"` | Empty history |
| A node ID | That tuple's closed past |
| `"@tN"` | The displayed represented time, in this compiled model |

Facts are unioned by semantic `(place,time)`. A fact supplied through one alias also holds through every other alias for that same time. All unlisted ground predicates are false. This is an explicit interpretation of predicates, not a rule system inferring truth. There are no negative facts or competing last-write interpretations.

## JavaScript API

The semantic and parsing modules used below work in browsers and Node without third-party dependencies. The application and worker entry points also need their interface environment; use the CLI for command-line work.

```js
import {compileModel} from './src/model.mjs';
import {parseFormula} from './src/parser.mjs';
import {Evaluator} from './src/evaluator.mjs';
import {checkTheory} from './src/theories.mjs';
import {checkCustomTheory} from './src/custom.mjs';
import {explore} from './src/search.mjs';

const model = compileModel(modelJSON);
const evaluator = new Evaluator(model, {maxSteps: 1000000, maxMilliseconds: 10000});
const ast = parseFormula('forall v. echo(v) -> dia[] past propose(v)');
const checked = evaluator.check(ast, {scope:'all'});
const theory = checkTheory(model, 'HBBSimp', {maxKnowledgeFamilies:256});
```

`Evaluator.check(ast,{scope:'end'|'all'|'world',world,maxFailures})` returns `holds`, `complete`, `failures`, `checked`, `totalRepresentatives`, `exhaustive` and statistics. A false result can stop after enough counterexamples; `exhaustive:false` does not make that false result uncertain. A true result checks every required representative. A resource failure throws `EvaluationLimitError`; its code is `INCOMPLETE`. Named/custom theory checking converts incomplete work to `holds:null` unless another axiom has already failed conclusively.

World selection uses `{place:'p',time:'end'|'empty'|nodeID|'@tN',event:null|groundEvent}`. `model.world(...)` resolves this to an internal world. Hypothetical event worlds are allowed; event atoms additionally require actual tuple membership.

`Evaluator.validate(ast,environment={})` validates signature/value/binding use without evaluating. `evaluate(ast,world,environment={})` permits a Map or object valuation for programmatic queries. `explain(ast,world,{maxNodes,maxDepth})` returns a bounded diagnostic tree, including quantified counterexample assignments and temporal/quorum witnesses. Explanation truncation never changes the conclusive result of the formula check. Memo storage is bounded by `maxMemoEntries` (default 100000), evicting cached results without changing semantics.

`checkCustomTheory` accepts a literal axiom array or `{includeLive:true,axioms:[...]}`. Optional axiom `kind` is presentation metadata. All axioms must be closed. Names must be unique and may contain punctuation. With `includeLive:true`, both complete Knowledge schemes are regenerated for the current model, including during exploration: all occurring ground events and each single learner for KnowledgeBox. `maxKnowledgeFamilies` bounds the number of individual learner families, not a learner-list closure.

`explore(modelJSON,{property,assumptions,maxAdditionalNodes,maxModels,maxMilliseconds,palette,scope,maxKnowledgeFamilies},onProgress)` is asynchronous and returns a finite-search status plus a JSON witness if found. `assumptions` can be `'none'`, one of `'ThyLive'`, `'HBBSafe'`, `'HBBSimp'`, `'HBBCorr'`, or either custom-theory form. Search defaults to end validity and accepts `scope:'all'`. See README for its exact search space and incomplete-result interpretation.

Compiled models expose canonical `nodes`, represented `times`, `fullTime`, `aliases`, `quorums` and supporting methods. Recompile after editing model JSON. Treat compiled models as read-only. Internal BigInt masks are deliberately not JSON serializable; export the source JSON or a returned witness instead.

Explicit-model projects use `history-structure-project/v1`. Their `modelSource` text, when present, remains authoritative in the CLI; `model` is a convenient parsed copy. The UI imports that model without silently turning custom-theory fields into Markdown declarations.

## Theory-first synthesis and evidence

For the main four-step workflow, use `document.mjs` and `experiment.mjs`. `parseDocument(markdown)` returns the model block and named declarations; `runExperiment(sourceOrParsedDocument,options,onProgress)` handles exact selected assumptions and properties. Its modes are `synthesize`, `search`, and `evaluate`. In the first two, absent predicate atoms are free SAT variables; explicit positive facts are pinned by default. In `evaluate`, the original closed-world supplied interpretation is used.

`createEvidence(document,options,resultRow)` saves the full source, retained assumptions, omissions, concrete model, property/scope, exact failure world and scope bounds. `replayExperiment(evidence,limits)` checks this data again, independently of cached result flags. A valid certificate has `verified:true`; an invalid or incomplete replay never does. Replay success means the saved model satisfies the retained theory and, for a counterexample, falsifies the exact recorded property at its recorded context.

Projects saved by this interface use **`history-structure-project/v3`**. A validated project records `semantics: "hbb-disc/2026-11-18"`, authoritative `sourceMarkdown` and saved run `options`. It preserves the editable source, selected properties and omitted axioms. The parsed `model` copy is informational; the source model block controls UI and CLI computation. The UI and CLI also accept `history-structure-project/v2` input under the semantic-profile review rules below. Explicit-model `history-structure-project/v1` input retains the model handling described above.

The CLI accepts current projects with `run` and `list`, and with explicit-model commands such as `validate` and `check`. A project run uses its saved options by default; each explicitly supplied CLI flag overrides only its corresponding option. For example, `--property Agreement` changes the property selection while preserving the saved mode and omitted axioms. `--drop NAME` replaces the saved omission list with the names explicitly given on that command. Unknown or duplicate selection names are errors in both the UI and CLI.

An unfinished JSON edit is saved as `unappliedModelSource` so the UI can restore it without losing the draft. The CLI rejects projects containing that field: apply the JSON to the theory in the interface and save the project before checking it. This prevents a CLI run from silently choosing between two different model versions.

`runExperiment.stats.historiesWithModels` counts histories with at least one satisfying predicate interpretation. Its compatibility field `modelsSatisfyingAssumptions` has the same count; neither enumerates all rho valuations. `synthesisQueries` counts calls to fixed-history synthesis. Actual SAT decisions and compilation sizes appear in each synthesis result's statistics.

## Semantic identity and reviewed imports

Current runs, validated v3 projects and evidence identify `semantics: "hbb-disc/2026-11-18"`. Unvalidated drafts retain their review status instead of claiming an accepted profile. This metadata matters when `include ThyLive` is retained, because its axioms are generated dynamically rather than stored as literal formulas.

A project retaining implicit ThyLive without the matching profile opens in the browser as an **unvalidated draft**, with neutral results and Run disabled. Its source, options and unfinished JSON are preserved. Review the theory, choose **Update choices** (or Ctrl/Cmd+Enter), then save and run it under the current profile. Automatic draft saving before acceptance does not declare that review complete. The CLI refuses such a project until its source has been explicitly reviewed and saved, or the reviewed Markdown is run directly.

A certificate with a missing or different implicit-ThyLive profile can be inspected but is not verified by current-profile replay. Run the reviewed theory and export fresh evidence. A fully literal theory, or a request explicitly dropping ThyLive, does not depend on that implicit axiom generator; concrete replay still checks its source, core semantics, selections, pins and failure context.

Evaluation evidence preserves the supplied predicate interpretation over mathematical histories. Ordinal selectors such as `@t1` are local to one compilation order; replay aligns histories through stable tuple aliases before comparing true facts. Reordering a DAG does not authorize changing where a fact holds. Equivalent fact encodings with the same interpretation remain valid.

Each fact supplies an explicit `at` selector. Optional node, fact and past arrays may be omitted or supplied as `[]` when empty. Reserve `null` for the † maybe-event label.
