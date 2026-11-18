# History Structure Model-checker

**Use the model-checker immediately in your browser, with no installation: [Open HSmc](https://bellissimogiorno.github.io/HS-model-checker/).**

You can also [read the executable theories](https://bellissimogiorno.github.io/HS-model-checker/theories.html).

Explore broadcast protocols over finite history structures. Read a theory, choose its assumptions and claims, run a check, then inspect a model or counterexample. The checker runs in your browser and includes 31 curated examples for HBBSafe, HBBSimp, HBBCorr and quorum diagnostics.

This package was vibe-coded following prompts by Murdoch J. Gabbay. It is a proof-of-concept based on joint work with Isaac Sheff: *Heterogeneous trust in reliable broadcast via modal logic and history structures*, by Murdoch J. Gabbay and Isaac Sheff (draft, 2026-11-18). The checker’s top-right **About** link gives authorship and paper information. The package version is stated in [VERSION](VERSION).

## Try an example

Open the checker and start with **First steps**. Follow **Theory → Claims → Run → Results** to run its selected check. Its assumption requires at least one chosen value; its property requires exactly one. Choosing both values satisfies the assumption and refutes the property, so this example deliberately finds a counterexample.

Use **Return to previous example** and **Continue to next example** before or after a run. Previous is disabled on First steps; the last example offers a restart. These navigation controls return to and focus the chooser. Loading an example restores its defaults, opens reading view and clears the preceding results and inspected witness. Run it to obtain a fresh result, and save reports or replayable evidence before leaving if you want to keep an outcome.

The protocol theories are **HBBSafe**, **HBBSimp** and **HBBCorr**, with **Happy Termination**, **Cascade Termination** and **Agreement** as their correctness claims. Each theory combines explanation, paper references, editable Unicode formulas and a finite history DAG. ASCII spellings are also accepted. Axiom-removal examples start with the named axiom omitted; **Keep all axioms** selects the comparison, and **Use example defaults** restores the omission. Select the configuration, then run.

A counterexample includes a concrete model and replayable evidence. **Holds within the selected scope** means that the completed finite search found no counterexample in its stated scope. **No model** means that no interpretation satisfies the retained assumptions in that scope; its properties are **Not tested**. Finite checking does not prove unbounded protocol correctness.

Read the [semantic contract](docs/SEMANTIC_CONTRACT.md), [paper map](docs/PAPER_MAP.md), [theory syntax](docs/THEORY_FORMAT.md), [model format](docs/MODEL_FORMAT.md), and [axiom experiments](docs/WEAKENING.md). The [HBBSafe](docs/HBB1_EXAMPLES.md) and [HBBCorr](docs/HBB3_EXAMPLES.md) guides explain their controlled weakenings and incorrect-axiom diagnostics.

## Run a local copy

Download or clone this repository, then run this command from its directory with Python 3.10 or later:

```sh
python3 serve.py --open
```

The server opens `http://127.0.0.1:8765/` and binds only to your computer. Stop it with Ctrl+C. Use `--port 0` if that port is occupied. The interactive checker needs the local server; the separate [theories.html](theories.html) reader can also be opened directly without one.

Use a current browser with module-worker and BigInt support. Checking uses the supplied files, with no external runtime or third-party service required. No npm installation is needed.

## Use the command line

With Node 20 or later:

```sh
node src/cli.mjs run examples/theories/first-steps.md
node demo.mjs --suite all
```

The first command deliberately finds a counterexample and exits with code 1. The second runs the controlled axiom experiments. Use `node src/cli.mjs --help` for commands and exit codes.

To save a separate copy of the tour’s reports and replayable evidence, run `node demo.mjs --suite all --output ../hsm-results`.

## Run the checks

The repository includes regression tests and saved evidence. To verify a checkout:

```sh
node --test
python3 -m unittest discover -s test -p 'test_*.py'
node tools/verify-package.mjs --replay
```

## Status and licence

The implementation has not received an independent expert audit. Direct witness replay checks a particular model or property failure; exhausted results still rely on the encoder and solver, and no independently checkable UNSAT certificate is produced.

The interface and SAT kernel adapt [3μQL](https://github.com/bellissimogiorno/3muQL-model-checker). See [UPSTREAM.md](UPSTREAM.md), the retained [MIT licence](LICENSE), and the [bundled font licence](assets/FONT-LICENSE.txt).
