/** Named, editable protocol theories from hbb-disc, draft 2026-11-18.
 *
 * Theory validity is all-world validity (Definition 5.2.1). Figure 7 uses
 * one learner in KnowledgeBox, rather than a list of quorum intersections.
 * On a finite model only occurring ground events need instances: every other
 * event makes both Knowledge antecedents false. Resource-limited coverage
 * remains explicitly incomplete, never a successful partial validity claim.
 */
import {parseFormula} from './parser.mjs';
import {compileModel, eventKey} from './model.mjs';
import {Evaluator} from './evaluator.mjs';

export class TheoryError extends Error {
  constructor(message) { super(message); this.name = 'TheoryError'; }
}
export const THEORY_NAMES = Object.freeze(['ThyLive', 'HBBSafe', 'HBBSimp', 'HBBCorr']);
const PAPER_TITLE='Heterogeneous trust in reliable broadcast via modal logic and history structures';
const source = (page, figure, definition, definitionPage=page) => ({
  title:PAPER_TITLE,
  draft:'2026-11-18', page, figure, figurePage:page, definition, definitionPage,
});
const liveSource = source(43, 7, '5.2.4');
const quote = JSON.stringify;
const asModel = model => model?.quorums instanceof Map ? model : compileModel(model);
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new TheoryError(`${label} must be a positive safe integer.`);
  return value;
}

/** Figure 7 has one KnowledgeBox scheme for each individual learner.
 * These are the model's finite value domain; the general modal evaluator still
 * handles arbitrary learner lists, but those lists are not ThyLive axioms.
 * Keep the resource option's public key while bounding this exact coverage.
 */
export function knowledgeFamilies(model, {
  maxKnowledgeFamilies=256, maxKnowledgeOperations=250000, maxKnowledgeFamilySize=4096, maxKnowledgeMilliseconds=5000, _deadline=Infinity,
}={}) {
  model = asModel(model);
  positiveInteger(maxKnowledgeFamilies, 'maxKnowledgeFamilies');
  positiveInteger(maxKnowledgeOperations, 'maxKnowledgeOperations');
  positiveInteger(maxKnowledgeFamilySize, 'maxKnowledgeFamilySize');
  positiveInteger(maxKnowledgeMilliseconds, 'maxKnowledgeMilliseconds');
  const families = [], started = Date.now();
  let operations = 0;
  const incomplete = reason => ({families, complete:false, reason, operations});
  for (const learner of model.values) {
    if (Date.now() >= _deadline || Date.now()-started > maxKnowledgeMilliseconds)
      return incomplete('The Knowledge learner-expansion time budget expired.');
    if (families.length >= maxKnowledgeFamilies)
      return incomplete(`Knowledge scheme expansion exceeded ${maxKnowledgeFamilies} learner families.`);
    const masks = model.quorums.get(learner);
    if (masks.length > maxKnowledgeFamilySize)
      return incomplete(`A Knowledge learner family exceeded ${maxKnowledgeFamilySize} minimal quorums.`);
    operations += masks.length;
    if (operations > maxKnowledgeOperations)
      return incomplete(`Knowledge scheme expansion exceeded ${maxKnowledgeOperations} primitive operations.`);
    families.push({masks:[...masks], learners:[learner]});
  }
  return {families, complete:true, operations};
}

/** Exact finite reduction of the event parameter E in Figure 7.
 * If E never occurs, past(live & E) is false at every participant and time.
 * The Diamond antecedent is therefore false. Each learner quorum is nonempty,
 * so the single-learner Box antecedent is false too. Such instances are valid
 * independently of rho, including in an empty history, and can be omitted.
 */
function knowledgeEvents(model) {
  const events = new Map();
  for (const node of model.nodes) if (node.event !== null) events.set(eventKey(node.event), node.event);
  return [...events.values()];
}
function eventFormula(event) { return `${quote(event.symbol)}(${event.args.map(quote).join(',')})`; }
function atom(name, kind, formula, origin, extra={}) {
  return {name, kind, direction:kind, formula, ast:parseFormula(formula), source:origin, ...extra};
}
function requireSignature(model, name) {
  const events = name==='ThyLive' ? [] : ['propose','echo','vote','deliver'];
  const predicates = ['live', ...(name==='HBBSafe' ? ['safe'] : name==='HBBCorr' ? ['corr'] : [])];
  const missing = [
    ...events.filter(s => !model.eventSymbols.has(s)).map(s=>`event ${s}`),
    ...predicates.filter(s => !model.predicateSymbols.has(s)).map(s=>`predicate ${s}`),
  ];
  if (missing.length) throw new TheoryError(`${name} requires ${missing.join(', ')} in the model signature.`);
}

/** Build a complete named theory when exact scheme expansion fits its budget.
 * Each returned axiom is independent editable data with formula, AST, direction,
 * and a precise source reference. The theory includes all of ThyLive by default.
 */
export function buildTheory(input, name='HBBSimp', options={}) {
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
  // Validate stated resource options even when every Knowledge instance is
  // vacuous and event expansion can be skipped altogether.
  for (const [key,fallback] of [['maxKnowledgeFamilies',256],['maxKnowledgeOperations',250000],['maxKnowledgeFamilySize',4096],['maxKnowledgeMilliseconds',5000]])
    positiveInteger(options[key]??fallback,key);
  const events = knowledgeEvents(model);
  const coverage = events.length ? knowledgeFamilies(model,{...options,_deadline:deadline}) : {families:[],complete:true,operations:0};
  let schemeComplete = coverage.complete;
  const schemeReasons = coverage.reason ? [coverage.reason] : [];
  eventInstances: for (const event of events) {
    if (Date.now() >= deadline) {
      schemeComplete=false; schemeReasons.push('The theory time budget expired while building Knowledge instances.'); break;
    }
    const E = eventFormula(event);
    axioms.push(atom(`KnowledgeDia:${E}`,'other',`(end (dia[] past (live & ${E}))) -> live -> sometime (dia[] past ${E})`,liveSource,{scheme:'KnowledgeDia',event}));
    for (let i=0; i<coverage.families.length; i++) {
      if (Date.now() >= deadline) {
        schemeComplete=false; schemeReasons.push('The theory time budget expired while building Knowledge instances.'); break eventInstances;
      }
      const {learners}=coverage.families[i];
      const ls = learners.map(quote).join(',');
      axioms.push(atom(`KnowledgeBox:${E}:${i}`,'other',`(end (box[${ls}] past (live & ${E}))) -> live -> sometime (box[${ls}] past ${E})`,liveSource,{scheme:'KnowledgeBox',event,learners:[...learners]}));
    }
  }
  if (name!=='ThyLive') {
    const origin = name==='HBBSafe' ? source(48,8,'6.2.2',47) : name==='HBBSimp' ? source(57,10,'7.1.1',56) : source(63,12,'8.2.1',62);
    const add = (n,k,f) => axioms.push(atom(n,k,f,origin));
    add('Echo?','backward','forall v. echo(v) -> dia[] past propose(v)');
    if (name==='HBBCorr') {
      add('Vote?','backward','forall l,v. vote(l,v) -> ((box[l] past echo(v)) | (exists m. (corr(m,l) & dia[] past vote(m,v))))');
      add('Deliver?','backward','forall l,v. deliver(l,v) -> box[l] past vote(l,v)');
    } else {
      add('Vote?','backward',`forall l,v. vote(l,v) -> ${name==='HBBSafe' ? '(safe(l) & box[l] past echo(v))' : 'box[l] past echo(v)'}`);
      add('Deliver?','backward','forall m,l,v. deliver(m,l,v) -> box[m] past vote(l,v)');
    }
    add('EchoNE','other','forall v,w. echo(v) -> past echo(w) -> v=w');
    if (name==='HBBSafe') {
      add('Safe','other','forall l. safe(l) <-> ((exists01 v. dia[] past propose(v)) | (forall m. dia[l,m] seq))');
    }
    if (name==='HBBCorr') {
      add('VoteNE','other','forall l,m,v,w. vote(l,v) -> past vote(m,w) -> corr(l,m) -> v=w');
      add('3twined','other','forall l,m,n. dia[l,m,n] true');
      add('CorrSeq','other','forall l,m. corr(l,m) -> dia[l,m] seq');
      add('CorrPast','other','forall l,m. corr(l,m) -> allpast corr(l,m)');
      add('CorrSymm','other','forall l,m. corr(l,m) -> corr(m,l)');
      add('CorrTran','other','forall l,m,n. corr(l,m) -> corr(m,n) -> corr(l,n)');
    }
    add('Echo!','forward','forall v. sometime (live & dia[] past propose(v)) -> exists w. sometime echo(w)');
    if (name==='HBBSafe') add('Vote!','forward','forall l,v. everytime safe(l) -> sometime (live & box[l] past echo(v)) -> sometime vote(l,v)');
    else if (name==='HBBSimp') add('Vote!','forward','forall l,v. sometime (live & box[l] past echo(v)) -> sometime vote(l,v)');
    else {
      add('Vote!','forward','forall l,v. sometime (live & box[l] past echo(v)) -> exists w. sometime vote(l,w)');
      add("Vote'!",'forward','forall l,m,v. sometime (live & everytime corr(l,m) & dia[] past vote(m,v)) -> exists w. sometime vote(l,w)');
    }
    add('Deliver!','forward',name==='HBBCorr'
      ? 'forall l,v. sometime (live & box[l] past vote(l,v)) -> sometime deliver(l,v)'
      : 'forall m,l,v. sometime (live & box[m] past vote(l,v)) -> sometime deliver(m,l,v)');
  }
  return {name,axioms,completeness:{complete:schemeComplete,reason:schemeReasons.length ? schemeReasons.join(' ') : undefined,
    families:coverage.families.length,events:events.length,operations:coverage.operations,
    method:'Exact Figure 7 instantiation: each individual learner and each occurring ground event; absent events have false antecedents because learner quorums are nonempty.'}};
}

/** Check a named theory at all possible worlds. False is conclusive even if a
 * different scheme remains incomplete; null means no failure was established
 * but the required coverage or an evaluation did not finish.
 */
export function checkTheory(input,name='HBBSimp',options={}) {
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
 * ThyLive has no protocol correctness claims and returns an empty list.
 * Unknown or malformed names are errors, never an empty successful selection.
 */
export function correctnessProperties(name) {
  if (typeof name!=='string') throw new TheoryError(`Theory name must be a string. Choose ${THEORY_NAMES.join(', ')}.`);
  if (!THEORY_NAMES.includes(name)) throw new TheoryError(`Unknown theory ${quote(name)}. Choose ${THEORY_NAMES.join(', ')}.`);
  if (name==='ThyLive') return [];
  const h3 = name==='HBBCorr';
  const origin = h3
    ? {title:PAPER_TITLE,draft:'2026-11-18',page:63,figure:13,figurePage:63,theorem:'8.2.3',theoremPage:64}
    : name==='HBBSafe'
      ? {title:PAPER_TITLE,draft:'2026-11-18',page:48,figure:9,figurePage:48,theorem:'6.2.6',theoremPage:49}
      : {title:PAPER_TITLE,draft:'2026-11-18',page:57,figure:11,figurePage:57,theorem:'7.1.3',theoremPage:57};
  const proofs = h3
    ? {'Happy Termination':['8.5.1',66],'Cascade Termination':['8.4.5',65],'Agreement':['8.3.1',64]}
    : name==='HBBSafe'
      ? {'Happy Termination':['6.6.3',54],'Cascade Termination':['6.5.5',53],'Agreement':['6.4.1',52]}
      : {'Happy Termination':['7.3.3',59],'Cascade Termination':['7.3.2',59],'Agreement':['7.3.1',59]};
  const delivery = (m,l,v) => h3 ? `deliver(${l},${v})` : `deliver(${m},${l},${v})`;
  const make = (propertyName,parameters,preconditions,trigger,conclusion) => {
    const premise = preconditions.map(p=>`(${p.formula})`).join(' & ');
    const formula = `forall ${parameters.join(',')}. (${premise}) -> (${trigger} -> ${conclusion})`;
    const nonvacuity = `exists ${parameters.join(',')}. (${premise}) & (${trigger})`;
    return {name:propertyName,formula,ast:parseFormula(formula),scope:'end',kind:'correctness',source:{...origin,proposition:proofs[propertyName][0],propositionPage:proofs[propertyName][1]},
      parameters,preconditions,nonvacuity,nonvacuityAst:parseFormula(nonvacuity)};
  };
  const properties = [];
  properties.push(make('Happy Termination',['l','v'],[
    {label:'A live l-quorum exists',formula:'box[l] live'},
    {label:'Precisely one value is proposed',formula:'exists1 w. dia[] past propose(w)'},
  ],'dia[] past (live & dia[] past propose(v))',`live -> sometime ${delivery('l','l','v')}`));
  if (h3) {
    properties.push(make('Cascade Termination',['l','m','v'],[
      {label:'The learners correlate at every participant at the end',formula:'box[] corr(l,m)'},
      {label:'A live reporting quorum exists',formula:'box[m] live'},
    ],'dia[] past deliver(l,v)','live -> sometime deliver(m,v)'));
    properties.push(make('Agreement',['l','m','v','w'],[
      {label:'The learners correlate at every participant at the end',formula:'box[] corr(l,m)'},
    ],'(dia[] past deliver(l,v)) & (dia[] past deliver(m,w))','v=w'));
  } else {
    properties.push(make('Cascade Termination',['a','b','l','v'],[
      {label:'Reporting quorum intersections are nonempty',formula:'dia[a,b] true'},
      {label:'A live reporting quorum exists',formula:'box[b] live'},
      ...(name==='HBBSafe' ? [{label:'The source learner is safe at every participant',formula:'box[] safe(l)'}] : []),
    ],'dia[] past deliver(a,l,v)','live -> sometime deliver(b,l,v)'));
    properties.push(make('Agreement',['a','b','l','m','v','w'],[
      {label:name==='HBBSafe' ? 'Reporting quorum intersections contain a sequential participant' : 'Source quorum intersections contain a sequential participant',formula:name==='HBBSafe' ? 'dia[a,b] seq' : 'dia[l,m] seq'},
    ],'(dia[] past deliver(a,l,v)) & (dia[] past deliver(b,m,w))','v=w'));
  }
  return properties;
}
