import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {buildTheory, checkTheory, correctnessProperties, knowledgeFamilies, TheoryError} from '../src/theories.mjs';

function singleRun(name='ThyHBB2',observe=true) {
  const h3=name==='ThyHBB3';
  const events = [
    {symbol:'propose',args:['x']},
    {symbol:'echo',args:['x']},
    {symbol:'vote',args:['x','x']},
    {symbol:'deliver',args:h3 ? ['x','x'] : ['x','x','x']},
    ...(observe ? [null] : []),
  ];
  return {
    format:'history-structure-model/v1', name:'Completed singleton run',
    participants:['p'],values:['x'],signature:{events:['propose','echo','vote','deliver'],predicates:['live','safe','corr']},
    quorums:{x:[['p']]},
    nodes:events.map((event,i)=>({id:`n${i}`,place:'p',event,past:i ? [`n${i-1}`] : []})),
    facts:[
      {place:'p',at:'*',atom:{symbol:'live',args:[]}},
      {place:'p',at:'*',atom:{symbol:'safe',args:['x']}},
      {place:'p',at:'*',atom:{symbol:'corr',args:['x','x']}},
    ],
  };
}
function majority(live=false,eventSignature=['propose']) {
  return {
    format:'history-structure-model/v1',participants:['a','b','c'],values:['x'],
    signature:{events:eventSignature,predicates:['live']},
    quorums:{x:[['a','b'],['a','c'],['b','c']]},nodes:[],
    facts:live ? ['a','b','c'].map(place=>({place,at:'*',atom:'live'})) : [],
  };
}

for (const name of ['ThyHBB1','ThyHBB2','ThyHBB3']) {
  test(`${name}: a completed singleton run satisfies full theory and all paper properties`,()=>{
    const model=compileModel(singleRun(name));
    const result=checkTheory(model,name);
    assert.equal(result.holds,true,JSON.stringify(result.axioms.filter(a=>a.holds!==true)));
    assert.equal(result.complete,true);
    assert.equal(result.completeness.events,5); // Four occurring plus one absent representative.
    const evaluator=new Evaluator(model);
    for (const property of correctnessProperties(name)) {
      assert.equal(evaluator.check(property.ast,{scope:'end'}).holds,true,property.name);
      assert.equal(evaluator.check(property.nonvacuityAst,{scope:'end'}).holds,true,`${property.name} scenario is exercised`);
    }
  });
}

test('a prefix ending at a real deliver lacks a required knowledge observation',()=>{
  const result=checkTheory(compileModel(singleRun('ThyHBB2',false)),'ThyHBB2');
  assert.equal(result.holds,false);
  assert.ok(result.axioms.some(a=>a.scheme==='KnowledgeDia' && a.event.symbol==='deliver' && a.holds===false));
});

test('exact saturation preserves repeated independent quorum choices',()=>{
  const model=compileModel(majority());
  const result=knowledgeFamilies(model);
  assert.equal(result.complete,true);
  assert.equal(result.families.length,4);
  assert.deepEqual(result.families.map(f=>f.learners.length),[0,1,2,3]);
  assert.deepEqual(result.families[3].masks,[0n]);
});

test('absent event knowledge instance detects empty-intersection live inactivity',()=>{
  const model=compileModel(majority(true));
  const result=checkTheory(model,'ThyLive');
  assert.equal(result.holds,false);
  assert.equal(result.complete,true);
  const failed=result.axioms.filter(a=>a.holds===false);
  assert.ok(failed.some(a=>a.scheme==='KnowledgeBox' && a.learners.length===3));
  assert.ok(failed.every(a=>a.scheme==='KnowledgeBox'));
});

test('an empty event signature has no Knowledge instances and does not impose LiveActive',()=>{
  const model=compileModel(majority(true,[]));
  const result=checkTheory(model,'ThyLive');
  assert.equal(result.holds,true);
  assert.equal(result.complete,true);
  assert.equal(result.completeness.events,0);
  assert.deepEqual(result.axioms.map(a=>a.name),['LiveAlways','LiveSeq']);
});

test('a capped scheme subset cannot produce a validity claim',()=>{
  const model=compileModel(majority(false));
  const result=checkTheory(model,'ThyLive',{maxKnowledgeFamilies:1});
  assert.equal(result.holds,null);
  assert.equal(result.complete,false);
  assert.match(result.reason,/exceeded 1 distinct families/);
  assert.ok(result.axioms.every(a=>a.holds===true));
});

test('a failed axiom remains conclusively false even if scheme saturation was incomplete',()=>{
  const data=majority(false);
  data.nodes=[{id:'fork1',place:'a',event:null,past:[]},{id:'fork2',place:'a',event:{symbol:'propose',args:[]},past:[]}];
  data.facts=[{place:'a',at:'*',atom:'live'}];
  const result=checkTheory(compileModel(data),'ThyLive',{maxKnowledgeFamilies:1});
  assert.equal(result.holds,false);
  assert.equal(result.complete,false);
  assert.ok(result.axioms.some(a=>a.name==='LiveSeq' && a.holds===false));
});

test('quoted event symbols round-trip in Knowledge-scheme formulas',()=>{
  const data=majority(false,['past']);
  const theory=buildTheory(compileModel(data),'ThyLive');
  assert.ok(theory.axioms.some(a=>a.formula.includes('"past"()')));
  assert.equal(checkTheory(data,'ThyLive').holds,true);
});

test('evaluation budgets report inconclusive rather than passing',()=>{
  const result=checkTheory(singleRun(),'ThyHBB2',{maxSteps:1});
  assert.equal(result.holds,null);
  assert.equal(result.complete,false);
  assert.ok(result.axioms.some(a=>a.holds===null));
});

test('theories require their signature and reject invalid scheme budgets',()=>{
  assert.throws(()=>buildTheory(majority(),'ThyHBB3'),TheoryError);
  assert.throws(()=>knowledgeFamilies(compileModel(majority()),{maxKnowledgeFamilies:0}),TheoryError);
});

test('the step budget is shared across axioms rather than renewed per row',()=>{
  const result=checkTheory(singleRun(),'ThyHBB2',{maxSteps:400});
  assert.equal(result.holds,null);
  assert.equal(result.complete,false);
  assert.ok(result.stats.steps<=401);
  assert.ok(result.axioms.some(a=>a.holds===true));
});

test('the total time budget includes building knowledge schemes',()=>{
  const result=checkTheory(singleRun(),'ThyHBB2',{maxMilliseconds:0.0001});
  assert.equal(result.holds,null);
  assert.equal(result.complete,false);
  assert.match(result.reason,/time budget/);
});

test('HBB3 Vote! preserves its existential value choice',()=>{
  const data=singleRun('ThyHBB3');
  data.values=['A','B'];
  data.quorums={A:[['p']],B:[['p']]};
  const events=[
    {symbol:'propose',args:['A']},{symbol:'echo',args:['A']},
    {symbol:'propose',args:['B']},{symbol:'echo',args:['B']},
    {symbol:'vote',args:['A','B']},{symbol:'vote',args:['B','B']},null,
  ];
  data.nodes=events.map((event,i)=>({id:`n${i}`,place:'p',event,past:i?[`n${i-1}`]:[]}));
  data.facts=[{place:'p',at:'*',atom:'live'}];
  const model=compileModel(data);
  const rule=buildTheory(model,'ThyHBB3').axioms.find(a=>a.name==='Vote!');
  const evaluator=new Evaluator(model);
  assert.equal(evaluator.check(rule.ast,{scope:'all'}).holds,true);
  assert.equal(evaluator.check(parseFormula('forall l,v. (live & box[l] past echo(v)) -> sometime vote(l,v)'),{scope:'all'}).holds,false);
});
