/** Cancellable worker bridge. The experiment and CLI share the same engine. */
import {
  compileModel
} from './model.mjs';
import {
  parseFormula
} from './parser.mjs';
import {
  Evaluator
} from './evaluator.mjs';
import {
  buildTheory,
  checkTheory
} from './theories.mjs';
import {
  checkCustomTheory
} from './custom.mjs';
import {
  explore
} from './search.mjs';
import {
  runExperiment,
  replayExperiment
} from './experiment.mjs';
function explainFailure(model, ast, result) {
  if (!result.failures?.length) return;
  try {
    const evaluator = new Evaluator(model, {
      maxSteps: 50000,
      maxMilliseconds: 1000
    });
    const first = result.failures[0];
    result.explanation = evaluator.explain(ast, {
      place: first.place,
      time: first.time,
      event: first.event
    }, {
      maxNodes: 80,
      maxDepth: 12
    });
  } catch (error) {
    result.explanation = {
      partial: true,
      reason: error.message
    };
  }
}
self.onmessage = async( {
  data
}) => {
  const {
    id,
    action,
    options = {}
  } = data,
  started = performance.now();
  try {
    let result;
    const progress = progress => self.postMessage( {
      id,
      type: 'progress',
      progress
    });
    if (action === 'experiment') {
      result = await runExperiment(data.sourceMarkdown ?? data.document, options, progress);
      const failed = result.properties?.find(row => row.status === 'counterexample' && row.witness?.result?.failures?.length);
      if (failed) {
        const checked = failed.witness.result;
        explainFailure(compileModel(failed.witness.model), parseFormula(failed.formula), checked);
        failed.explanation = checked.explanation;
      }
    } else if (action === 'replay') result = await replayExperiment(data.evidence, options);
    else if (action === 'explore') result = await explore(data.model, options, stats => self.postMessage( {
      id,
      type: 'progress',
      stats
    }));
    else {
      const model = compileModel(data.model);
      if (action === 'formula') {
        const ast = parseFormula(data.formula);
        result = new Evaluator(model, options).check(ast, {
          scope: options.scope,
          world: options.world,
          maxFailures: 3
        });
        explainFailure(model, ast, result);
      } else if (action === 'theory') {
        result = data.theory === 'custom' ? checkCustomTheory(model, data.axioms, options): checkTheory(model, data.theory, options);
        const first = result.axioms?.find(row => row.holds === false && row.failures?.length);
        if (first) explainFailure(model, parseFormula(first.formula), first);
      } else if (action === 'copyTheory') {
        const built = buildTheory(model, data.theory, options);
        result = {
          includeLive: true,
          axioms: built.axioms.filter(a => !a.scheme && !['LiveAlways',
          'LiveSeq'].includes(a.name)).map(( {
            name,
            kind,
            formula
          }) =>( {
            name,
            kind,
            formula
          }))
        };
      } else throw new Error('Unknown operation: ' + action);
    }
    self.postMessage( {
      id,
      type: 'result',
      action,
      result,
      elapsed: performance.now() - started
    });
  } catch (error) {
    self.postMessage( {
      id,
      type: 'error',
      action,
      error: {
        name: error.name,
        message: error.message,
        line: error.line,
        column: error.column,
        incomplete: error.code === 'INCOMPLETE' || /limit|budget|incomplete/i.test(error.name ?? '') || error.incomplete === true
      },
      elapsed: performance.now() - started
    });
  }
};
