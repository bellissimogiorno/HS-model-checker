/** Named, editable protocol theories from hbb-disc, draft 2026-11-07.
 *
 * Theory validity is all-world validity (Definition 5.2.1). KnowledgeBox is an
 * infinite scheme syntactically, but a finite model has only finitely many
 * distinct modal intersection families. We saturate those families exactly,
 * retaining a learner-list witness for each, and explicitly report any budget
 * that prevents completion. An incomplete successful subset never means valid.
 */
import {parseFormula} from './parser.mjs';
import {compileModel, eventKey} from './model.mjs';
import {Evaluator} from './evaluator.mjs';

export class TheoryError extends Error {
  constructor(message) { super(message); this.name = 'TheoryError'; }
}
export const THEORY_NAMES = Object.freeze(['ThyLive', 'ThyHBB1', 'ThyHBB2', 'ThyHBB3']);
const PAPER_TITLE='Heterogeneous trust in reliable broadcast via modal logic and history structures';
const source = (page, figure, definition, definitionPage=page) => ({
  title:PAPER_TITLE,
  draft:'2026-11-07', page, figure, figurePage:page, definition, definitionPage,
});
const liveSource = source(38, 6, '5.2.4');
const quote = JSON.stringify;
const asModel = model => model?.quorums instanceof Map ? model : compileModel(model);
const familyKey = family => family.map(m => m.toString(16)).sort().join(',');
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TheoryError(`${label} must be a positive safe integer.`);
  return value;
}

/** Enumerate the finite commutative monoid of minimal intersection families.
 * The identity is {Pnt}, corresponding to the empty learner list. Multiplication
 * intersects one independently chosen quorum from each factor, then keeps the
 * inclusion-minimal results. Both diamond and box depend only on this antichain.
 */
export function knowledgeFamilies(model, {
  maxKnowledgeFamilies=256, maxKnowledgeOperations=250000, maxKnowledgeFamilySize=4096, maxKnowledgeMilliseconds=5000, _deadline=Infinity,
}={}) {
  model = asModel(model);
  positiveInteger(maxKnowledgeFamilies, 'maxKnowledgeFamilies');
  positiveInteger(maxKnowledgeOperations, 'maxKnowledgeOperations');
  positiveInteger(maxKnowledgeFamilySize, 'maxKnowledgeFamilySize');
  positiveInteger(maxKnowledgeMilliseconds, 'maxKnowledgeMilliseconds');
  const families = [{masks:[model.allPlacesMask], learners:[]}];
  const seen = new Set([familyKey(families[0].masks)]);
  let operations = 0;
  const started = Date.now();
  const tick = () => {
    operations++;
    return operations <= maxKnowledgeOperations && ((operations & 127) !== 0 || (Date.now()-started <= maxKnowledgeMilliseconds && Date.now() < _deadline));
  };
  const budgetReason = () => operations > maxKnowledgeOperations
    ? `Knowledge-family saturation exceeded ${maxKnowledgeOperations} primitive operations.`
    : Date.now() >= _deadline ? 'The total theory time budget expired during knowledge-family saturation.'
    : `Knowledge-family saturation exceeded ${maxKnowledgeMilliseconds} milliseconds.`;
  const incomplete = reason => ({families, complete:false, reason, operations});
  for (let cursor=0; cursor<families.length; cursor++) {
    for (const learner of model.values) {
      const masks = [];
      for (const left of families[cursor].masks) {
        for (const right of model.quorums.get(learner)) {
          if (!tick()) return incomplete(budgetReason());
          const candidate = left & right;
          let subsumed = false;
          for (const mask of masks) {
            if (!tick()) return incomplete(budgetReason());
            if ((candidate & mask) === mask) { subsumed=true; break; }
          }
          if (subsumed) continue;
          for (let i=masks.length-1; i>=0; i--) {
            if (!tick()) return incomplete(budgetReason());
            if ((candidate & masks[i]) === candidate) masks.splice(i,1);
          }
          masks.push(candidate);
          if (masks.length > maxKnowledgeFamilySize) return incomplete(`A knowledge intersection family exceeded ${maxKnowledgeFamilySize} minimal members.`);
        }
      }
      const key = familyKey(masks);
      if (seen.has(key)) continue;
      if (families.length >= maxKnowledgeFamilies) return incomplete(`Knowledge-family saturation exceeded ${maxKnowledgeFamilies} distinct families.`);
      seen.add(key);
      families.push({masks, learners:[...families[cursor].learners, learner]});
    }
  }
  return {families, complete:true, operations};
}

/** Every nonoccurring ground event has the same truth profile in the Knowledge
 * schemes. Include one such representative even when no events have occurred:
 * an empty quorum intersection can make the Box antecedent vacuously true.
 * Event arities are unrestricted in the paper, hence an absent event always
 * exists when the event signature is nonempty and the history is finite.
 */
function knowledgeEvents(model) {
  const events = new Map();
  for (const node of model.nodes) if (node.event !== null) events.set(eventKey(node.event), node.event);
  if (model.signature.events.length) {
    const symbol = model.signature.events[0];
    for (let arity=0; ; arity++) {
      const event = {symbol, args:Array(arity).fill(model.values[0])};
      if (!events.has(eventKey(event))) { events.set(eventKey(event),event); break; }
    }
  }
  return [...events.values()];
}
function eventFormula(event) { return `${quote(event.symbol)}(${event.args.map(quote).join(',')})`; }
function atom(name, kind, formula, origin, extra={}) {
  return {name, kind, direction:kind, formula, ast:parseFormula(formula), source:origin, ...extra};
}
function requireSignature(model, name) {
  const events = name==='ThyLive' ? [] : ['propose','echo','vote','deliver'];
  const predicates = ['live', ...(name==='ThyHBB1' ? ['safe'] : name==='ThyHBB3' ? ['corr'] : [])];
  const missing = [
    ...events.filter(s => !model.eventSymbols.has(s)).map(s=>`event ${s}`),
    ...predicates.filter(s => !model.predicateSymbols.has(s)).map(s=>`predicate ${s}`),
  ];
  if (missing.length) throw new TheoryError(`${name} requires ${missing.join(', ')} in the model signature.`);
}

/** Build a complete named theory when saturation fits its stated budget.
 * Each returned axiom is independent editable data with formula, AST, direction,
 * and a precise source reference. The theory includes all of ThyLive by default.
 */
export function buildTheory(input, name='ThyHBB2', options={}) {
  if (!THEORY_NAMES.includes(name)) throw new TheoryError(`Unknown theory ${quote(name)}. Choose ${THEORY_NAMES.join(', ')}.`);
  const duration = options.evaluation?.maxMilliseconds ?? options.maxMilliseconds ?? 15000;
  if (!Number.isFinite(duration) || duration <= 0) throw new TheoryError('maxMilliseconds must be a positive finite number.');
  const deadline = options._deadline ?? Date.now()+duration;
  const model = asModel(input);
  requireSignature(model,name);
  const axioms = [
    atom('LiveAlways','other','live <-> end live',liveSource),
    atom('LiveSeq','other','live -> seq',liveSource),
  ];
  const events = knowledgeEvents(model);
  const saturation = events.length ? knowledgeFamilies(model,{...options,_deadline:deadline}) : {families:[],complete:true,operations:0};
  let schemeComplete = saturation.complete;
  const schemeReasons = saturation.reason ? [saturation.reason] : [];
  eventInstances: for (const event of events) {
    if (Date.now() >= deadline) {
      schemeComplete=false; schemeReasons.push('The theory time budget expired while building Knowledge instances.'); break;
    }
    const E = eventFormula(event);
    axioms.push(atom(`KnowledgeDia:${E}`,'other',`(end (dia[] past (live & ${E}))) -> live -> sometime (dia[] past ${E})`,liveSource,{scheme:'KnowledgeDia',event}));
    for (let i=0; i<saturation.families.length; i++) {
      if (Date.now() >= deadline) {
        schemeComplete=false; schemeReasons.push('The theory time budget expired while building Knowledge instances.'); break eventInstances;
      }
      const {learners}=saturation.families[i];
      const ls = learners.map(quote).join(',');
      axioms.push(atom(`KnowledgeBox:${E}:${i}`,'other',`(end (box[${ls}] past (live & ${E}))) -> live -> sometime (box[${ls}] past ${E})`,liveSource,{scheme:'KnowledgeBox',event,learners:[...learners]}));
    }
  }
  if (name!=='ThyLive') {
    const origin = name==='ThyHBB1' ? source(41,7,'6.1.2') : name==='ThyHBB2' ? source(50,9,'7.1.1',49) : source(56,11,'8.2.1',55);
    const add = (n,k,f) => axioms.push(atom(n,k,f,origin));
    add('Echo?','backward','forall v. echo(v) -> dia[] past propose(v)');
    if (name==='ThyHBB3') {
      add('Vote?','backward','forall l,v. vote(l,v) -> ((box[l] past echo(v)) | (exists m. (corr(m,l) & dia[] past vote(m,v))))');
      add('Deliver?','backward','forall l,v. deliver(l,v) -> box[l] past vote(l,v)');
    } else {
      add('Vote?','backward',`forall l,v. vote(l,v) -> ${name==='ThyHBB1' ? '(safe(l) & box[l] past echo(v))' : 'box[l] past echo(v)'}`);
      add('Deliver?','backward','forall m,l,v. deliver(m,l,v) -> box[m] past vote(l,v)');
    }
    add('EchoNE','other','forall v,w. echo(v) -> past echo(w) -> v=w');
    if (name==='ThyHBB1') {
      add('Safe','other','forall l. safe(l) <-> ((exists01 v. dia[] past propose(v)) | (forall m. dia[l,m] seq))');
    }
    if (name==='ThyHBB3') {
      add('VoteNE','other','forall l,m,v,w. vote(l,v) -> past vote(m,w) -> corr(l,m) -> v=w');
      add('3twined','other','forall l,m,n. dia[l,m,n] true');
      add('CorrSeq','other','forall l,m. corr(l,m) -> dia[l,m] seq');
      add('CorrPast','other','forall l,m. corr(l,m) -> allpast corr(l,m)');
      add('CorrSymm','other','forall l,m. corr(l,m) -> corr(m,l)');
      add('CorrTran','other','forall l,m,n. corr(l,m) -> corr(m,n) -> corr(l,n)');
    }
    add('Echo!','forward','forall v. (live & dia[] past propose(v)) -> exists w. sometime echo(w)');
    if (name==='ThyHBB1') add('Vote!','forward','forall l,v. everytime safe(l) -> (live & box[l] past echo(v)) -> sometime vote(l,v)');
    else if (name==='ThyHBB2') add('Vote!','forward','forall l,v. (live & box[l] past echo(v)) -> sometime vote(l,v)');
    else {
      add('Vote!','forward','forall l,v. (live & box[l] past echo(v)) -> exists w. sometime vote(l,w)');
      add("Vote'!",'forward','forall l,m,v. (live & everytime corr(l,m) & dia[] past vote(m,v)) -> exists w. sometime vote(l,w)');
    }
    add('Deliver!','forward',name==='ThyHBB3'
      ? 'forall l,v. (live & box[l] past vote(l,v)) -> sometime deliver(l,v)'
      : 'forall m,l,v. (live & box[m] past vote(l,v)) -> sometime deliver(m,l,v)');
  }
  return {name,axioms,completeness:{complete:schemeComplete,reason:schemeReasons.length ? schemeReasons.join(' ') : undefined,
    families:saturation.families.length,events:events.length,operations:saturation.operations,
    method:'Exact saturation of inclusion-minimal quorum-intersection families; all occurring events plus one absent-event representative.'}};
}

/** Check a named theory at all possible worlds. False is conclusive even if a
 * different scheme remains incomplete; null means no failure was established
 * but the required coverage or an evaluation did not finish.
 */
export function checkTheory(input,name='ThyHBB2',options={}) {
  const started=Date.now();
  const evaluatorOptions=options.evaluation ?? options;
  const totalMilliseconds=evaluatorOptions.maxMilliseconds ?? 15000;
  const totalSteps=evaluatorOptions.maxSteps ?? 5_000_000;
  if (!Number.isFinite(totalMilliseconds) || totalMilliseconds<=0) throw new TheoryError('maxMilliseconds must be a positive finite number.');
  const deadline=started+totalMilliseconds;
  const model = asModel(input);
  const evaluator = new Evaluator(model,evaluatorOptions); // Validates all numerical limits.
  const theory = buildTheory(model,name,{...options,_deadline:deadline});
  let steps=0;
  let complete = theory.completeness.complete;
  const reasons = theory.completeness.reason ? [theory.completeness.reason] : [];
  const axioms = [];
  for (const axiom of theory.axioms) {
    const millisecondsLeft=deadline-Date.now(), stepsLeft=totalSteps-steps;
    if (millisecondsLeft<=0 || stepsLeft<=0) {
      complete=false;
      const message=millisecondsLeft<=0 ? 'The total theory time budget expired.' : 'The total theory evaluation-step budget expired.';
      reasons.push(message);
      for (const rest of theory.axioms.slice(axioms.length)) axioms.push({...rest,holds:null,failures:[],error:message});
      break;
    }
    evaluator.maxMilliseconds=millisecondsLeft;
    evaluator.maxSteps=stepsLeft;
    try {
      const result = evaluator.check(axiom.ast,{scope:'all',maxFailures:options.maxFailures ?? 3});
      steps += result.stats.steps;
      axioms.push({...axiom,...result});
    } catch (error) {
      if (error.name!=='EvaluationLimitError') throw error;
      steps += error.stats?.steps ?? 0;
      complete=false;
      reasons.push(`${axiom.name}: ${error.message}`);
      axioms.push({...axiom,holds:null,error:error.message,failures:[]});
      // Reusing an evaluator whose resource budget is exhausted would create
      // many identical errors. Preserve the unperformed checks explicitly.
      for (const rest of theory.axioms.slice(axioms.length)) axioms.push({...rest,holds:null,failures:[],error:'Not checked after evaluation resource limit.'});
      break;
    }
  }
  const failed = axioms.some(a=>a.holds===false);
  return {name,holds:failed ? false : complete ? true : null,axioms,complete,
    reason:reasons.length ? reasons.join(' ') : undefined,
    completeness:{...theory.completeness,complete,reason:reasons.length ? reasons.join(' ') : undefined},
    stats:{steps,elapsedMs:Date.now()-started},
    counts:{total:axioms.length,passed:axioms.filter(a=>a.holds===true).length,failed:axioms.filter(a=>a.holds===false).length,inconclusive:axioms.filter(a=>a.holds===null).length}};
}

/** The paper's finite-model correctness statements, with their meta-level
 * premises incorporated in closed end-of-time formulas. In particular, a
 * premise `Valid safe(l)` is represented by `box[] safe(l)`, not local safe(l).
 * `nonvacuity` is a separate existential scenario check for the UI/search API.
 */
export function correctnessProperties(name) {
  if (!THEORY_NAMES.includes(name) || name==='ThyLive') return [];
  const h3 = name==='ThyHBB3';
  const origin = h3
    ? {title:PAPER_TITLE,draft:'2026-11-07',page:56,figure:12,figurePage:56,theorem:'8.2.3',theoremPage:57}
    : name==='ThyHBB1'
      ? {title:PAPER_TITLE,draft:'2026-11-07',page:41,figure:8,figurePage:41,theorem:'6.1.6',theoremPage:43}
      : {title:PAPER_TITLE,draft:'2026-11-07',page:50,figure:10,figurePage:50,theorem:'7.1.3',theoremPage:51};
  const proofs = h3
    ? {'Liveness 1':['8.5.1',59],'Liveness 2':['8.4.5',59],'Agreement':['8.3.1',57]}
    : name==='ThyHBB1'
      ? {'Liveness 1':['6.5.3',48],'Liveness 2':['6.4.5',47],'Agreement':['6.3.1',45]}
      : {'Liveness 1':['7.3.3',53],'Liveness 2':['7.3.2',52],'Agreement':['7.3.1',52]};
  const delivery = (m,l,v) => h3 ? `deliver(${l},${v})` : `deliver(${m},${l},${v})`;
  const make = (propertyName,parameters,preconditions,trigger,conclusion) => {
    const premise = preconditions.map(p=>`(${p.formula})`).join(' & ');
    const formula = `forall ${parameters.join(',')}. (${premise}) -> (${trigger} -> ${conclusion})`;
    const nonvacuity = `exists ${parameters.join(',')}. (${premise}) & (${trigger})`;
    return {name:propertyName,formula,ast:parseFormula(formula),scope:'end',kind:'correctness',source:{...origin,proposition:proofs[propertyName][0],propositionPage:proofs[propertyName][1]},
      parameters,preconditions,nonvacuity,nonvacuityAst:parseFormula(nonvacuity)};
  };
  const properties = [];
  properties.push(make('Liveness 1',['l','v'],[
    {label:'A live l-quorum exists',formula:'box[l] live'},
    {label:'Precisely one value is proposed',formula:'exists1 w. dia[] past propose(w)'},
  ],'dia[] past (live & dia[] past propose(v))',`live -> sometime ${delivery('l','l','v')}`));
  if (h3) {
    properties.push(make('Liveness 2',['l','m','v'],[
      {label:'The learners correlate at every participant at the end',formula:'box[] corr(l,m)'},
      {label:'A live reporting quorum exists',formula:'box[m] live'},
    ],'dia[] past deliver(l,v)','live -> sometime deliver(m,v)'));
    properties.push(make('Agreement',['l','m','v','w'],[
      {label:'The learners correlate at every participant at the end',formula:'box[] corr(l,m)'},
    ],'(dia[] past deliver(l,v)) & (dia[] past deliver(m,w))','v=w'));
  } else {
    properties.push(make('Liveness 2',['a','b','l','v'],[
      {label:'Reporting quorum intersections are nonempty',formula:'dia[a,b] true'},
      {label:'A live reporting quorum exists',formula:'box[b] live'},
      ...(name==='ThyHBB1' ? [{label:'The source learner is safe at every participant',formula:'box[] safe(l)'}] : []),
    ],'dia[] past deliver(a,l,v)','live -> sometime deliver(b,l,v)'));
    properties.push(make('Agreement',['a','b','l','m','v','w'],[
      {label:name==='ThyHBB1' ? 'Reporting quorum intersections contain a sequential participant' : 'Source quorum intersections contain a sequential participant',formula:name==='ThyHBB1' ? 'dia[a,b] seq' : 'dia[l,m] seq'},
    ],'(dia[] past deliver(a,l,v)) & (dia[] past deliver(b,m,w))','v=w'));
  }
  return properties;
}
