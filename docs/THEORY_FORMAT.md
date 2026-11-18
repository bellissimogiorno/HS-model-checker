# Literate history theories

A theory is a Markdown document: explain the experiment in prose, present each rule beside its formula, and supply a history model. The checker executes only explicitly tagged blocks. The supplied theories use the two-valued history language of the **hbb-disc draft dated 2026-11-18**.

## Read, edit and run

**Read theory** renders the explanations, headings and highlighted formulas. The history-model JSON is folded so that the protocol rules come first. **Edit Markdown** opens the complete source with syntax highlighting; **Save Markdown** preserves that source, including prose.

The examples use Unicode. ASCII input remains valid, and both notations may be mixed in one formula. The editor's symbol buttons insert Unicode. **Use Unicode** and **Use ASCII** explicitly convert executable formulas while preserving names, comments, prose and model JSON. Conversion checks that the parsed formulas retain their meaning; invalid source remains untouched.

Use **Return to previous example** and **Continue to next example** to browse the curated set; Previous is disabled on the first example. Loading another example restores its defaults and clears the previous results and inspected witness. It does not run the new example. Save any report or evidence you want to keep before leaving.

After editing, choose **Update choices**, or press **Ctrl/Cmd+Enter**, to validate the document and refresh the claims and assumptions. Reading a draft previews the current text; it does not make stale choices runnable. Tab inserts two spaces in the editor; Escape then Tab, or Shift+Tab, moves focus out. Syntax highlighting can be switched off without changing the source.

## Executable blocks

A document needs exactly one `hsm-model` fence containing JSON, and one or more `hsm` fences containing declarations. The model may appear before or after the rules. Prose, raw HTML and other code fences do not execute. An `hsm` example quoted inside a longer Markdown fence does not execute either.

This is a complete small theory. The four-backtick outer quotation is only for displaying it in this guide.

````markdown
# Choosing a value

At least one value must be chosen. The assumption also permits both values,
so uniqueness is a property to test.

```hsm
axiom SomeChoice [other]: ∃ v. chosen(v)
property UniqueChoice [end]: ∃=1 v. chosen(v)
```

## History model

There are no protocol events. The empty history still has an end-of-time world.

```hsm-model
{
  "format":"history-structure-model/v1",
  "participants":["p"],
  "values":["red","blue"],
  "signature":{"events":[],"predicates":["chosen"]},
  "nodes":[],
  "quorums":{"red":[["p"]],"blue":[["p"]]},
  "facts":[]
}
```
````

In **Use this history; find facts**, this theory permits both values to be chosen and has a counterexample to `UniqueChoice`. **Evaluate this model** instead treats unlisted facts as false. The run mode matters.

## Unicode and ASCII

| Unicode | ASCII | Meaning |
| --- | --- | --- |
| `⊤`, `⊥` | `true`, `false` | Truth and falsehood |
| `¬`, `∧`, `∨` | `not`, `and`, `or` | Boolean connectives; `!`, `&`, `\|` also work |
| `⇒`, `⇔` | `->`, `<->` | Implication and equivalence |
| `∀`, `∃` | `forall`, `exists` | Every or some value |
| `∃=1`, `∃⩽1` | `exists1`, `exists01` | Exactly one or at most one value |
| `↓`, `⇓` | `past`, `allpast` | Some or every actual local past tuple |
| `↕`, `⇕` | `sometime`, `everytime` | Some or every actual local tuple in the complete history |
| `♢[l,m] φ` | `dia[l,m] φ` | Every l/m quorum intersection has a participant satisfying φ |
| `□[l,m] φ` | `box[l,m] φ` | Some l/m quorum intersection consists of participants satisfying φ |
| `≠` | `!=` | Inequality |

The alternative `∃≤1` and compact `∃¹` / `∃⁰¹` input spellings are accepted too. `seq` and `end` retain their names. `end φ` evaluates at the full history with current event †. `↕` does not impose a future order. `◇` is accepted as an alternative diamond; the displayed examples use the paper's `♢`. See [SEMANTICS.md](SEMANTICS.md) and the [paper map](PAPER_MAP.md) for the precise interpretations.

## Declarations and binding

An axiom is `axiom NAME [DIRECTION]: FORMULA`. Direction is `backward`, `forward` or `other` (the default). It is descriptive metadata: every retained axiom is required at all possible worlds.

A property is `property NAME [SCOPE]: FORMULA`. Scope is `end` (the default) or `all`. End scope uses the full history with current event †, at every participant. All scope checks every possible world through the engine's exact finite representatives. Use the separate model query to inspect one selected world.

Names are unique across declarations and may contain `?`, `!`, apostrophes, hyphens and spaces. JSON-quote a name containing a colon, brackets or quotes, for example `axiom "Vote: alternative!" [forward]: ⊤`. `ThyLive` is reserved for the dynamic include.

Formulas can continue over several lines until the next declaration or fence end. Blank lines and `#` or `//` line comments are allowed. Bind variables explicitly: there is no implicit universal closure. Bound names denote variables; quote literal values when needed. Errors identify the Markdown source line and column.

````markdown
## Echo justification

An echo must be supported by knowledge of a proposal of that value.

```hsm
axiom Echo? [backward]: ∀ v.
  echo(v) ⇒ ♢[] ↓ propose(v)
```

## Echo progress

If a participant has an actual local tuple where it is live and knows a proposal, it must echo some value in the complete run. The outer ↕ is necessary because axioms also apply at hypothetical worlds.

```hsm
axiom Echo! [forward]: ∀ v.
  ↕ (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)
```
````

The model signature declares the event and predicate symbols used in formulas. Learners and values share one domain. Symbols may have arbitrary arity. See [MODEL_FORMAT.md](MODEL_FORMAT.md) for model JSON.

## Dynamic liveness and selections

`include ThyLive` in an `hsm` block requires the complete liveness theory, including both Knowledge schemes. KnowledgeBox has one learner parameter; the language still admits general learner lists in other formulas. The model signature must contain predicate `live`. Instances regenerate for each model searched or replayed; they are not frozen to the history present when the file was saved.

Only `include ThyLive` is supported. The supplied HBB protocol rules remain explicit editable declarations. In **Claims**, ThyLive is one assumption group; other axioms are selected individually. Evidence records retained and omitted names. An empty property selection asks only for a model of the retained assumptions. A no-model result concerns assumption consistency in the selected scope. Its properties are Not tested; it does not establish them.

## Programmatic API

`parseDocument(source)` returns the original `source`, `name`, `model`, `includeLive`, `axioms` and `properties`. Declarations retain their formula string, parsed `ast`, source `line`, name and direction or scope.

`selectTheory(doc,{droppedAxioms,selectedProperties})` applies run selections. Omitted `selectedProperties` selects all; `[]` selects none. Unknown or repeated names are errors. `ThyLive` may be dropped only when included.

`serializeDocument(doc)` reconstructs a semantic document from the current model and declarations. To retain explanations and exact formatting, save the editor text or `doc.source` instead.

`notation.mjs` exports `unicodeFormula`, `asciiFormula`, `unicodeTheorySource` and `asciiTheorySource`. `theory-presentation.mjs` exports lexical highlighting and safe Markdown rendering. These presentation helpers do not change the evaluator or execute Markdown as code.
