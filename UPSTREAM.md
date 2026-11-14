# Upstream provenance

The [3μQL model-checker](https://github.com/bellissimogiorno/3muQL-model-checker) supplies the interface conventions and SAT-kernel design adapted by this project.

| Source | Adaptation |
| --- | --- |
| `web/style.css` | The stylesheet base in `src/style.css`, with history-specific additions |
| `web/index.html` and its workflow | The four-step interface in `index.html` and `src/app.mjs` |
| `muql/sat.py` | The circuit and watched-literal CDCL solver in `src/sat.mjs` |
| `LICENSE` | The complete upstream MIT notice retained in [LICENSE](LICENSE) |

Copyright (c) 2026 MuQL contributors. Modification and redistribution are permitted subject to the retained MIT notice. The language, history DAG representation, evaluator, theories and finite-history search implement the paper's two-valued semantics. There is no dependency on a running upstream service, Pyodide or a runtime CDN.

This package was vibe-coded following prompts by Murdoch J. Gabbay. The source paper is *Heterogeneous trust in reliable broadcast via modal logic and history structures*, by Murdoch J. Gabbay and Isaac Sheff.
