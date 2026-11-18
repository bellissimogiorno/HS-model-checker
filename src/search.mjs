/** Exhaustive bounded DAG extensions. This explores models, not an operational
 * protocol scheduler. A failing finite prefix is never pruned: an extension can
 * discharge an end-of-time or forward-rule obligation. */
import { compileModel, eventKey, normalizeEvent } from './model.mjs';
import { parseFormula } from './parser.mjs';
import { Evaluator, EvaluationLimitError } from './evaluator.mjs';
import { checkTheory } from './theories.mjs';
import {checkCustomTheory,customTheorySpec} from './custom.mjs';

function integer(value, fallback, low, high, name) {
  const n = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(n) || n < low || n > high) throw new Error(`${name} must be an integer between ${low} and ${high}.`);
  return n;
}

/** An exact canonical serialization; no probabilistic hash collisions are used.
 * Input node IDs and topological insertion order have no semantic significance. */
export function historyFingerprint(model, anchoredAliases = []) {
  const ranks = [];
  for (const node of model.nodes) {
    let rank = 0;
    for (const pred of model.nodes) if ((node.past & pred.bit) !== 0n) rank = Math.max(rank, (ranks[pred.index] ?? 0) + 1);
    ranks[node.index] = rank;
  }
  const numbers = new Map();
  const rows = [];
  const maxRank = Math.max(-1, ...ranks);
  for (let rank = 0; rank <= maxRank; rank++) {
    const group = model.nodes.filter(n => ranks[n.index] === rank).map(n => ({
      node: n,
      key: JSON.stringify([n.place, n.event, model.nodes.filter(p => (n.past & p.bit) !== 0n).map(p => numbers.get(p.index)).sort((a,b) => a-b)])
    })).sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    for (const item of group) { numbers.set(item.node.index, rows.length); rows.push(item.key); }
  }
  // Base alias identities matter for time-specific facts during extensions.
  const facts = [];
  for (const alias of anchoredAliases) facts.push([alias,numbers.get(model.aliases.get(alias).index)]);
  facts.sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return JSON.stringify([rows, facts]);
}

export function ideals(model) {
  const output = [];
  const n = model.nodes.length;
  for (let bits = 0; bits < 2 ** n; bits++) {
    const mask = BigInt(bits);
    if (model.nodes.every(node => !(mask & node.bit) || (node.past & mask) === node.past)) output.push(mask);
  }
  return output;
}

export function generators(model, mask) {
  // Every finite ideal is represented by its maximal members.
  return model.nodes.filter(node => (mask & node.bit) !== 0n && !model.nodes.some(other =>
    (mask & other.bit) !== 0n && (other.past & node.bit) !== 0n)).map(node => node.id);
}

export function makePalette(data, palette) {
  const actual = palette ?? [null, ...(data.nodes ?? []).map(n => n.event).filter(e => e !== null)];
  if (!Array.isArray(actual) || actual.length === 0) throw new Error('Search palette must be a nonempty array of ground events or null (†).');
  const unique = new Map();
  for (const label of actual) {
    const event = normalizeEvent(label);
    if (event !== null) {
      if (!data.signature.events.includes(event.symbol)) throw new Error(`Search palette uses undeclared event ${event.symbol}.`);
      if (event.args.some(v => !data.values.includes(v))) throw new Error('Search palette contains a value outside the model domain.');
    }
    unique.set(eventKey(event),event);
  }
  return [...unique.values()];
}

/** Search all DAG extensions up to the stated bound, or return incomplete.
 * onProgress receives compact counts. The returned witness includes a directly
 * reloadable JSON model and both assumption/property check results. */
export async function explore(modelData, options = {}, onProgress = () => {}) {
  const start = Date.now();
  // The operation yields while enumerating histories. Own its mathematical
  // request before that first yield: caller edits must not mix assumptions
  // between candidates or rewrite the scope recorded with the result. The
  // progress callback is intentionally retained as a function, separately from
  // the data snapshot. All nested option data used here is in these two fields.
  modelData = structuredClone(modelData);
  options = {...options,
    assumptions: structuredClone(options.assumptions ?? 'none'),
    palette: options.palette === undefined ? undefined : structuredClone(options.palette),
  };
  const base = compileModel(modelData);
  for (const fact of modelData.facts ?? []) {
    const selectors = Array.isArray(fact.at) ? fact.at : [fact.at];
    if (selectors.some(selector => typeof selector === 'string' && selector.startsWith('@'))) {
      throw new Error('Exploration requires stable fact time selectors. Replace @tN fact selectors with a base node ID (its past), end, empty, or *. Generated time indices can change as a history grows.');
    }
  }
  const maxAdditionalNodes = integer(options.maxAdditionalNodes,2,0,8,'maxAdditionalNodes');
  if (base.nodes.length + maxAdditionalNodes > 16) throw new Error('Bounded exploration supports at most 16 total canonical tuples. Checking a supplied model has no such search bound.');
  const maxModels = integer(options.maxModels,1000,1,1000000,'maxModels');
  const maxMilliseconds = integer(options.maxMilliseconds,5000,1,3600000,'maxMilliseconds');
  const maxKnowledgeFamilies = integer(options.maxKnowledgeFamilies,256,1,100000,'maxKnowledgeFamilies');
  const maxSteps = integer(options.maxSteps,1000000,1,100000000,'maxSteps');
  const scope = options.scope ?? 'end';
  if (!['end','all'].includes(scope)) throw new Error('Exploration property scope must be end or all.');
  if (typeof options.property !== 'string' || !options.property.trim()) throw new Error('Supply a property formula for exploration.');
  const property = parseFormula(options.property);
  const assumptions = options.assumptions ?? 'none';
  const isCustom=assumptions!==null && typeof assumptions==='object';
  if (!(assumptions === 'none' || ['ThyLive','HBBSafe','HBBSimp','HBBCorr'].includes(assumptions) || isCustom)) throw new Error('Unknown exploration assumptions.');
  const custom = isCustom?customTheorySpec(assumptions):null;
  const palette = makePalette(modelData,options.palette);
  const limits = {maxAdditionalNodes,maxModels,maxMilliseconds,maxKnowledgeFamilies,maxSteps,palette,scope,assumptions};
  const stats = {examined:0,generated:1,duplicates:0,modelsSatisfyingAssumptions:0,maxAdditionalNodes,maxDepth:0,incompleteAssumptions:0};
  const elapsed = () => Date.now() - start;
  const coverage = 'All extensions of the supplied base history with fixed participants, values, quorum bases and fact rules; new tuples use the selected finite event palette and any downward-closed past. This is a finite search, not a proof for unbounded histories.';
  const result = (status,reason,witness=null) => ({status:witness?'counterexample':status,complete:status==='exhausted',reason:witness&&status==='incomplete'?`${reason} A certified counterexample had already been found.`:reason,stats:{...stats,elapsedMilliseconds:elapsed()},witness,limits,coverage});
  try {
    // Validate the whole language even if no candidate satisfies assumptions,
    // without spending a separate unbudgeted model check on the base.
    const validator = new Evaluator(base,{maxSteps,maxMilliseconds:Math.max(1,maxMilliseconds-elapsed())});
    validator.validate(property);
    if (custom) for (const axiom of custom.axioms) validator.validate(axiom.ast);
  } catch (error) {
    if (error instanceof EvaluationLimitError) return result('incomplete',error.message);
    throw error;
  }
  if (elapsed() >= maxMilliseconds) return result('incomplete','Time budget reached during preparation.');
  let frontier = [{data:structuredClone({...modelData,nodes:modelData.nodes??[]}),model:base}];
  const anchoredAliases = [...base.aliases.keys()];
  const seen = new Set([historyFingerprint(base,anchoredAliases)]);
  let serial = 0;
  let savedWitness = null;
  let generationLimited = false;
  for (let depth = 0; depth <= maxAdditionalNodes; depth++) {
    const next = [];
    for (const candidate of frontier) {
      if (stats.examined >= maxModels) return result('incomplete','Model budget reached.',savedWitness);
      if (elapsed() >= maxMilliseconds) return result('incomplete','Time budget reached.',savedWitness);
      stats.examined++;
      stats.maxDepth = Math.max(stats.maxDepth,depth);
      let assumptionResult;
      try {
        const remaining = Math.max(1,maxMilliseconds-elapsed());
        if (assumptions === 'none') assumptionResult = {holds:true,complete:true,axioms:[]};
        else if (custom) assumptionResult=checkCustomTheory(candidate.model,assumptions,{maxSteps,maxKnowledgeFamilies,maxMilliseconds:remaining,maxFailures:1});
        else assumptionResult = checkTheory(candidate.model,assumptions,{maxSteps,maxKnowledgeFamilies,maxMilliseconds:remaining,maxFailures:1});
        if (assumptionResult.holds === false) { /* A definite failure excludes this candidate. */ }
        else if (!assumptionResult.complete || assumptionResult.holds === null) stats.incompleteAssumptions++;
        else if (assumptionResult.holds) {
          stats.modelsSatisfyingAssumptions++;
          const stepsLeft=maxSteps-(assumptionResult.stats?.steps??0);
          if (stepsLeft<1) return result('incomplete','Per-model evaluation step budget reached before checking the target.',savedWitness);
          const propertyResult = new Evaluator(candidate.model,{maxSteps:stepsLeft,maxMilliseconds:Math.max(1,maxMilliseconds-elapsed())}).check(property,{scope,maxFailures:1});
          if (!propertyResult.holds) {
            savedWitness ??= {model:candidate.data,result:propertyResult,assumptions:assumptionResult};
            if (options.stopAfterFirst !== false) return result('counterexample','A model satisfying the assumptions falsifies the property.',savedWitness);
          }
        }
      } catch (error) {
        if (error instanceof EvaluationLimitError) return result('incomplete',error.message,savedWitness);
        throw error;
      }
      if (depth < maxAdditionalNodes && !generationLimited) {
        const pasts = ideals(candidate.model);
        extensions:
        for (const past of pasts) for (const place of candidate.model.participants) for (const event of palette) {
          if (elapsed() >= maxMilliseconds) return result('incomplete','Time budget reached while generating extensions.',savedWitness);
          // An identical tuple adds no element to a set-valued history.
          if (candidate.model.nodes.some(n => n.place===place && n.past===past && eventKey(n.event)===eventKey(event))) continue;
          let id;
          do { id = `__hs_search_${serial++}`; } while (candidate.data.nodes.some(n => n.id===id));
          const data = {...candidate.data,nodes:[...candidate.data.nodes,{id,place,event,past:generators(candidate.model,past)}]};
          const model = compileModel(data);
          const key = historyFingerprint(model,anchoredAliases);
          if (seen.has(key)) { stats.duplicates++; continue; }
          // Bound memory as well as evaluations; a stopped generation is incomplete.
          if (seen.size >= maxModels) { generationLimited = true; break extensions; }
          seen.add(key); stats.generated++;
          next.push({data,model});
        }
      }
      if (stats.examined % 16 === 0) { onProgress({...stats,elapsedMilliseconds:elapsed()}); await new Promise(resolve => setTimeout(resolve,0)); }
    }
    frontier = next;
  }
  if (savedWitness) return result('counterexample',generationLimited ? 'A counterexample was found; other extensions remain.' : 'A counterexample was found; the bounded space was also exhausted.',savedWitness);
  if (generationLimited) return result('incomplete','Candidate budget reached; the queued models were checked, but other extensions remain.');
  if (stats.incompleteAssumptions) return result('incomplete','Some candidates could not be classified because assumption checking was incomplete.');
  return result('exhausted','No counterexample exists within the explicit finite extension bounds.');
}
