/** Predicate-interpretation synthesis over a fixed history structure.
 *
 * The history, value domain and quorum semifilters are fixed. Ordinary atoms
 * rho(p,T) are Boolean variables; events, causal accessibility and seq remain
 * the exact history semantics. Tseitin circuits avoid enumerating 2^rho truth
 * assignments. Every returned model is independently replayed by evaluator.mjs.
 */
import {Circuit, solve} from './sat.mjs';
import {SEMANTICS_PROFILE} from './run-identity.mjs';
import {compileModel, eventKey, minimizeMasks} from './model.mjs';
import {parseFormula} from './parser.mjs';
import {Evaluator, EvaluationLimitError} from './evaluator.mjs';
import {buildTheory} from './theories.mjs';
import {customTheorySpec} from './custom.mjs';

export class SynthesisLimitError extends Error {
  constructor(message) { super(message); this.name='SynthesisLimitError'; this.code='INCOMPLETE'; }
}

function positive(value, fallback, label) {
  const n=value??fallback;
  if(!Number.isSafeInteger(n)||n<1) throw new Error(`${label} must be a positive safe integer.`);
  return n;
}
function finitePositive(value,fallback,label) {
  const n=value??fallback;
  if(!Number.isFinite(n)||n<=0) throw new Error(`${label} must be a finite positive number.`);
  return n;
}

/** Boolean compilation is intentionally independent of Evaluator._eval. The
 * evaluator is used only to validate syntax/signature and replay SAT witnesses. */
class Encoder {
  constructor(model,{deadline,maxCompilationNodes,pinFacts}) {
    this.model=model;
    this.deadline=deadline;
    this.limit=maxCompilationNodes;
    this.pinFacts=pinFacts;
    this.work=0;
    this.circuit=new Circuit();
    this.atoms=new Map();
    this.memo=new Map();
    this.astIds=new WeakMap();
    this.nextAst=0;
    this.families=new Map([[JSON.stringify([]),[model.allPlacesMask]]]);
  }
  tick() {
    if(++this.work>this.limit) throw new SynthesisLimitError(`Compilation exceeded ${this.limit} work nodes.`);
    if(this.circuit.nvars>this.limit)throw new SynthesisLimitError(`Compilation exceeded ${this.limit} Boolean variables.`);
    if((this.work&63)===1&&Date.now()>=this.deadline) throw new SynthesisLimitError('Synthesis time budget expired during compilation.');
  }
  constant(value) {return value?this.circuit.true:this.circuit.false;}
  term(t,env) {return t.type==='value'?t.value:env.get(t.name);}
  and(items) {
    let out=this.circuit.true;
    for(const item of items) {this.tick();out=this.circuit.and(out,item);if(out===this.circuit.false)break;}
    return out;
  }
  or(items) {
    let out=this.circuit.false;
    for(const item of items) {this.tick();out=this.circuit.or(out,item);if(out===this.circuit.true)break;}
    return out;
  }
  family(learners) {
    const key=JSON.stringify([...learners].sort());
    if(this.families.has(key))return this.families.get(key);
    let family=[this.model.allPlacesMask];
    for(const learner of learners) {
      const intersections=[];
      for(const left of family)for(const right of this.model.quorums.get(learner)) {this.tick();intersections.push(left&right);}
      family=minimizeMasks(intersections,()=>this.tick());
      if(family.length===1&&family[0]===0n)break;
    }
    this.families.set(key,family);return family;
  }
  atom(place,timeIndex,atom) {
    if(this.pinFacts&&this.model.hasFact(place,timeIndex,atom))return this.circuit.true;
    const key=JSON.stringify([place,timeIndex,eventKey(atom)]);
    if(!this.atoms.has(key))this.atoms.set(key,{place,timeIndex,atom,literal:this.circuit.newVar(key)});
    return this.atoms.get(key).literal;
  }
  /** Linear-size exact at-most-one circuit, including the zero-value case. */
  unique(literals,exactly) {
    let seen=this.circuit.false,valid=this.circuit.true;
    for(const literal of literals) {
      this.tick();
      valid=this.circuit.and(valid,-this.circuit.and(seen,literal));
      seen=this.circuit.or(seen,literal);
    }
    return exactly?this.circuit.and(valid,seen):valid;
  }
  compile(ast,world,env=new Map()) {
    this.tick();
    let id=this.astIds.get(ast);if(id===undefined){id=this.nextAst++;this.astIds.set(ast,id);}
    const key=JSON.stringify([id,world.place,world.timeIndex,eventKey(world.event),[...env].sort(([a],[b])=>a<b?-1:a>b?1:0)]);
    if(this.memo.has(key))return this.memo.get(key);
    const c=this.circuit,m=this.model;
    const atNode=n=>({place:n.place,timeIndex:n.timeIndex,event:n.event});
    const sub=(a,w=world,e=env)=>this.compile(a,w,e);
    let out;
    switch(ast.type) {
      case 'true':out=c.true;break;
      case 'false':out=c.false;break;
      case 'seq':out=this.constant(m.isSequential(world.timeIndex,world.place));break;
      case 'eq':out=this.constant(this.term(ast.left,env)===this.term(ast.right,env));break;
      case 'atom': {
        const atom={symbol:ast.symbol,args:ast.args.map(t=>this.term(t,env))};
        out=m.eventSymbols.has(ast.symbol)?this.constant(eventKey(world.event)===eventKey(atom)&&m.hasTuple(world.place,world.timeIndex,atom)):this.atom(world.place,world.timeIndex,atom);
        break;
      }
      case 'not':out=-sub(ast.body);break;
      case 'and':out=c.and(sub(ast.left),sub(ast.right));break;
      case 'or':out=c.or(sub(ast.left),sub(ast.right));break;
      case 'implies':out=c.implies(sub(ast.left),sub(ast.right));break;
      case 'iff':out=c.iff(sub(ast.left),sub(ast.right));break;
      case 'past':case 'allpast':case 'sometime':case 'everytime': {
        const time=['sometime','everytime'].includes(ast.type)?m.fullTime.index:world.timeIndex;
        const literals=m.nodesAt(time,world.place).map(n=>sub(ast.body,atNode(n)));
        out=['past','sometime'].includes(ast.type)?this.or(literals):this.and(literals);break;
      }
      case 'end':out=sub(ast.body,{place:world.place,timeIndex:m.fullTime.index,event:null});break;
      case 'forall':case 'exists':case 'exists01':case 'exists1': {
        const literals=[];
        for(const value of m.values){const bound=new Map(env);bound.set(ast.variable,value);literals.push(sub(ast.body,world,bound));}
        out=ast.type==='forall'?this.and(literals):ast.type==='exists'?this.or(literals):this.unique(literals,ast.type==='exists1');break;
      }
      case 'dia':case 'box': {
        const family=this.family(ast.learners.map(t=>this.term(t,env)));
        if(family.length===1&&family[0]===0n){out=ast.type==='box'?c.true:c.false;break;}
        const bodies=new Map(),choices=[];
        for(const intersection of family){
          const literals=[];
          for(let p=0;p<m.participants.length;p++)if(intersection&(1n<<BigInt(p))){
            if(!bodies.has(p))bodies.set(p,sub(ast.body,{place:m.participants[p],timeIndex:world.timeIndex,event:null}));
            literals.push(bodies.get(p));
          }
          choices.push(ast.type==='dia'?this.or(literals):this.and(literals));
        }
        out=ast.type==='dia'?this.and(choices):this.or(choices);break;
      }
      default:throw new Error(`Unsupported formula node ${JSON.stringify(ast.type)}.`);
    }
    // Gate sharing survives memo eviction, while temporary environment keys
    // remain bounded during deeply quantified compilations.
    if(this.memo.size>=100000)this.memo.clear();
    this.memo.set(key,out);return out;
  }
  validity(ast,scope) {
    const literals=[];
    for(const world of this.model.worlds(scope))literals.push(this.compile(ast,world));
    return this.and(literals);
  }
}

function prepareTheory(model,theory,options) {
  if(typeof theory==='string')return buildTheory(model,theory,options);
  const parsed=customTheorySpec(theory??[]);
  const live=parsed.includeLive?buildTheory(model,'ThyLive',options):{axioms:[],completeness:{complete:true}};
  const names=new Set(live.axioms.map(a=>a.name));
  for(const axiom of parsed.axioms){if(names.has(axiom.name))throw new Error(`Custom axiom ${axiom.name} duplicates an included ThyLive axiom.`);names.add(axiom.name);}
  return {name:'Custom theory',axioms:[...live.axioms,...parsed.axioms],completeness:live.completeness};
}

function stableSelector(model,timeIndex) {
  if(timeIndex===model.fullTime.index)return 'end';
  return model.nodes.find(node=>node.timeIndex===timeIndex)?.id??'empty';
}

/** Synthesize rho on exactly this history/domain/trust structure. Positive
 * supplied facts are pinned by default; absent facts are free in this mode. */
export function synthesize(modelJSON,options={}) {
  const started=Date.now();
  const maxMilliseconds=finitePositive(options.maxMilliseconds,10000,'maxMilliseconds');
  const maxCompilationNodes=positive(options.maxCompilationNodes,500000,'maxCompilationNodes');
  if(options.maxSteps!==undefined&&(!Number.isSafeInteger(options.maxSteps)||options.maxSteps<1))throw new Error('maxSteps must be a positive safe integer.');
  // Explicit Evaluation steps controls concrete witness verification. Keep the
  // historical compiler-scaled allowance when no step limit was requested.
  const replayMaxSteps=positive(options.maxSteps,Math.min(Number.MAX_SAFE_INTEGER,Math.max(500000,maxCompilationNodes*4)),'maxSteps');
  const maxKnowledgeFamilies=positive(options.maxKnowledgeFamilies,256,'maxKnowledgeFamilies');
  const maxDecisions=options.maxDecisions??100000;
  if(!Number.isSafeInteger(maxDecisions)||maxDecisions<0)throw new Error('maxDecisions must be a nonnegative safe integer.');
  if(options.pinFacts!==undefined&&typeof options.pinFacts!=='boolean')throw new Error('pinFacts must be true or false.');
  if(options.deadline!==undefined&&!Number.isFinite(options.deadline))throw new Error('deadline must be a finite epoch-millisecond number.');
  const deadline=Math.min(started+maxMilliseconds,options.deadline??Infinity);
  const pinFacts=options.pinFacts??true;
  const scope=options.scope??'end';
  if(!['end','all'].includes(scope))throw new Error('Synthesis property scope must be end or all.');
  if(options.property!==undefined&&options.property!==null&&typeof options.property!=='string')throw new Error('property must be a formula string or null.');
  const property=options.property==null?null:parseFormula(options.property);
  const model=compileModel(modelJSON);
  const encoder=new Encoder(model,{deadline,maxCompilationNodes,pinFacts});
  const stats={compilationNodes:0,predicateVariables:0,variables:1,clauses:1,decisions:0,consistencyDecisions:0,targetDecisions:0,elapsedMilliseconds:0};
  let consistent=null,consistencyWitness=null;
  const update=()=>Object.assign(stats,{compilationNodes:encoder.work,predicateVariables:encoder.atoms.size,variables:encoder.circuit.nvars,clauses:encoder.circuit.clauses.length,elapsedMilliseconds:Date.now()-started});
  const remaining=()=>{const n=deadline-Date.now();if(n<=0)throw new SynthesisLimitError('Synthesis time budget expired.');return n;};
  const result=(status,reason,witness=null)=>{
    // A solver or the final replay may finish between its last periodic time
    // check and this classification. Every conclusive exit shares this guard.
    if(status!=='incomplete')remaining();
    return {status,complete:status!=='incomplete',consistent,reason,witness,stats:{...update()},coverage:'All predicate interpretations on the supplied fixed finite history, participant/value domains and quorum semifilters; supplied positive facts are pinned when pinFacts is enabled.'};
  };
  const progress=phase=>{
    if(typeof options.onProgress==='function')options.onProgress({phase,...update()});
    remaining();
  };
  let theory;
  const experiment={format:'history-structure-synthesis/v1',semantics:SEMANTICS_PROFILE,theory:structuredClone(options.theory??[]),property:options.property??null,scope,pinFacts,limits:{maxMilliseconds,maxCompilationNodes,maxKnowledgeFamilies,maxDecisions,maxSteps:replayMaxSteps},seedModel:structuredClone(modelJSON)};
  const replay=(assignment,checkProperty)=>{
    progress('Replaying model');
    const completed=structuredClone(modelJSON);
    completed.facts=pinFacts?structuredClone(modelJSON.facts??[]):[];
    for(const atom of encoder.atoms.values())if(assignment.get(atom.literal)===true)completed.facts.push({place:atom.place,at:stableSelector(model,atom.timeIndex),atom:atom.atom});
    const compiled=compileModel(completed),axioms=[];
    let assumptionSteps=0;
    for(const axiom of theory.axioms){
      const stepsLeft=options.maxSteps===undefined?replayMaxSteps:replayMaxSteps-assumptionSteps;
      if(stepsLeft<=0)throw new EvaluationLimitError(`Retained-assumption replay stopped after ${replayMaxSteps} steps; result is incomplete.`,{steps:assumptionSteps});
      const checked=new Evaluator(compiled,{maxMilliseconds:remaining(),maxSteps:stepsLeft}).check(axiom.ast,{scope:'all',maxFailures:1});
      assumptionSteps+=checked.stats.steps;
      remaining();
      if(!checked.holds)throw new Error(`SAT witness failed independent replay of axiom ${axiom.name}.`);
      axioms.push({name:axiom.name,kind:axiom.kind,formula:axiom.formula,...checked});
    }
    const assumptions={name:theory.name,holds:true,complete:true,axioms,counts:{total:axioms.length,passed:axioms.length,failed:0,inconclusive:0}};
    const propertyResult=checkProperty?new Evaluator(compiled,{maxMilliseconds:remaining(),maxSteps:replayMaxSteps}).check(property,{scope,maxFailures:1}):null;
    remaining();
    if(checkProperty&&propertyResult.holds)throw new Error('SAT counterexample failed independent property replay.');
    const witness={model:completed,assumptions,result:propertyResult,experiment:structuredClone(experiment),verified:true};
    remaining();
    return witness;
  };
  try{
    remaining();progress('Preparing theory');
    theory=prepareTheory(model,options.theory??[],{...options,maxKnowledgeFamilies,_deadline:deadline});
    if(!theory.completeness.complete)return result('incomplete',theory.completeness.reason??'Knowledge scheme saturation was incomplete.');
    const validator=new Evaluator(model,{maxMilliseconds:remaining(),maxSteps:maxCompilationNodes});
    for(const axiom of theory.axioms){validator.validate(axiom.ast);encoder.work+=validator.stats.steps;encoder.tick();}
    if(property){validator.validate(property);encoder.work+=validator.stats.steps;encoder.tick();}
    progress('Compiling assumptions');
    for(const axiom of theory.axioms)encoder.circuit.addClause(encoder.validity(axiom.ast,'all'));
    remaining();progress('Checking assumption consistency');
    const initial=solve(encoder.circuit.nvars,encoder.circuit.clauses,{deadline,maxMilliseconds:remaining(),maxDecisions});
    stats.decisions=stats.consistencyDecisions=initial.decisions;
    if(initial.status==='unknown')return result('incomplete',initial.reason??'Consistency solving reached a resource limit.');
    if(initial.status==='unsat'){consistent=false;return result('no-model','The retained assumptions have no predicate interpretation on this fixed history.');}
    consistencyWitness=replay(initial.assignment,false);consistent=true;
    if(!property)return result('model','A predicate interpretation satisfying every retained assumption was found and replayed.',consistencyWitness);
    progress('Compiling property');
    encoder.circuit.addClause(-encoder.validity(property,scope));
    remaining();progress('Searching for a counterexample');
    const target=solve(encoder.circuit.nvars,encoder.circuit.clauses,{deadline,maxMilliseconds:remaining(),maxDecisions:Math.max(0,maxDecisions-stats.consistencyDecisions)});
    stats.targetDecisions=target.decisions;stats.decisions+=target.decisions;
    if(target.status==='unknown')return result('incomplete',target.reason??'Counterexample solving reached a resource limit.',consistencyWitness);
    if(target.status==='unsat')return result('holds','The assumptions have a model and every permitted predicate interpretation on this fixed history satisfies the property.',consistencyWitness);
    const witness=replay(target.assignment,true);
    return result('counterexample','A predicate interpretation satisfies the retained assumptions and falsifies the property; both judgements were independently replayed.',witness);
  }catch(error){
    if(error instanceof SynthesisLimitError||error instanceof EvaluationLimitError||error.code==='INCOMPLETE')return result('incomplete',error.message,consistencyWitness);
    throw error;
  }
}
