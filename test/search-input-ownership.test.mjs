import test from 'node:test';
import assert from 'node:assert/strict';
import {explore} from '../src/search.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';

const seed=()=>({format:'history-structure-model/v1',participants:['p'],values:['v'],
  signature:{events:['E'],predicates:[]},nodes:[],quorums:{v:[['p']]},facts:[]});
const options=assumptions=>({property:'not seq or sometime past true',assumptions,
  palette:[null,'E'],maxAdditionalNodes:3,maxModels:1000,maxMilliseconds:30000});
function observable(result) {
  const {elapsedMilliseconds,...stats}=result.stats;
  return JSON.parse(JSON.stringify({status:result.status,complete:result.complete,reason:result.reason,stats,
    limits:result.limits,witness:result.witness},(key,value)=>key.startsWith('elapsed')?undefined:value));
}

test('progress callbacks cannot change the retained custom theory halfway through exploration',async()=>{
  // This target is false on the empty history, and true on every local history
  // with at least two distinct tuples: they either form a chain or fail seq.
  // Mixing false assumptions on early candidates with true on later candidates
  // would wrongly report exhaustion under the recorded true assumptions.
  const assumptions=[{name:'Constraint',formula:'false'}];
  const request=options(assumptions);
  const expected=await explore(seed(),structuredClone(request));
  let progress=0;
  const actual=await explore(seed(),request,()=>{
    progress++;
    assumptions[0].formula='true';
  });
  assert(progress>0,'the fixture must reach an asynchronous progress boundary');
  assert.deepEqual(observable(actual),observable(expected));
  assert.equal(actual.stats.examined,24);
  assert.equal(actual.stats.modelsSatisfyingAssumptions,0);
  assert.equal(actual.limits.assumptions[0].formula,'false');
  assert.equal(new Evaluator(compileModel(seed())).check(parseFormula(request.property)).holds,false);
  const genuinelyTrue=await explore(seed(),options([{name:'Constraint',formula:'true'}]));
  assert.equal(genuinelyTrue.status,'counterexample','true assumptions must expose the empty-history failure');
});

test('caller changes after promise creation cannot replace a yielded exploration request',async()=>{
  const model=seed(),assumptions={includeLive:false,axioms:[{name:'Constraint',formula:'false'}]};
  const request=options(assumptions),snapshot=structuredClone(request);
  const promise=explore(model,request);
  // explore has checked its first sixteen candidates and yielded, but still
  // has later candidates to classify. These are all caller-owned objects.
  assumptions.axioms[0].formula='true';
  assumptions.axioms[0].name='Changed';
  assumptions.includeLive=true;
  model.participants.push('outside');
  model.nodes.push({id:'unwanted',place:'p',event:'E',past:[]});
  request.palette.push('undeclared');
  request.maxAdditionalNodes=0;
  request.maxModels=1;
  const actual=await promise;
  const expected=await explore(seed(),snapshot);
  assert.deepEqual(observable(actual),observable(expected));
});

test('a continuing search keeps its captured stop policy despite caller edits',async()=>{
  const request={...options([]),property:'false',stopAfterFirst:false};
  const expected=await explore(seed(),structuredClone(request));
  let progress=0;
  const actual=await explore(seed(),request,()=>{progress++;request.stopAfterFirst=true;});
  assert(progress>0);
  assert.equal(actual.stats.examined,24);
  assert.deepEqual(observable(actual),observable(expected));
});

test('separate explorations own independent theory and result snapshots',async()=>{
  const assumptions=[{name:'Constraint',formula:'false'}],request=options(assumptions);
  const before=structuredClone(request);
  const first=explore(seed(),request),second=explore(seed(),request);
  assumptions[0].formula='true';
  const [left,right]=await Promise.all([first,second]);
  assert.deepEqual(left.limits.assumptions,before.assumptions);
  assert.deepEqual(right.limits.assumptions,before.assumptions);
  left.limits.assumptions[0].formula='independent result edit';
  assert.equal(right.limits.assumptions[0].formula,'false');
  assert.equal(assumptions[0].formula,'true');
});

test('caller edits after completion cannot rewrite limits or the concrete witness',async()=>{
  const model=seed(),assumptions=[{name:'Constraint',formula:'true'}],request=options(assumptions);
  const result=await explore(model,request),snapshot=structuredClone(result);
  assumptions[0].formula='false';
  request.palette.length=0;
  model.nodes.push({id:'unwanted',place:'p',event:'E',past:[]});
  model.values.push('outside');
  assert.deepEqual(result,snapshot);
  assert.equal(result.status,'counterexample');
  assert.equal(result.witness.assumptions.holds,true);
});

test('capturing an include retains full model-dependent liveness on each extension',async()=>{
  const model=seed();
  model.signature.predicates=['live'];
  model.facts=[{place:'p',at:'*',atom:'live'}];
  const result=await explore(model,{property:'not sometime E',assumptions:{includeLive:true,axioms:[]},
    palette:['E',null],maxAdditionalNodes:2,maxModels:100,maxMilliseconds:30000});
  assert.equal(result.status,'counterexample');
  assert.equal(result.witness.model.nodes.length,2,'a single E tuple cannot yet observe its own occurrence');
  assert(result.witness.assumptions.axioms.some(row=>row.scheme==='KnowledgeDia'));
  assert(result.witness.assumptions.axioms.every(row=>row.holds===true));
  assert.equal(result.limits.assumptions.includeLive,true);
});
