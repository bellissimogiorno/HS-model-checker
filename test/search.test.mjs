import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel} from '../src/model.mjs';
import {explore,historyFingerprint} from '../src/search.mjs';

function empty() { return {format:'history-structure-model/v1',participants:['p'],values:['v'],signature:{events:['E'],predicates:['live']},nodes:[],quorums:{v:[['p']]},facts:[]}; }
test('bounded search finds and returns a reloadable genuine countermodel',async()=>{
  const result=await explore(empty(),{property:'not past E',palette:['E',null],maxAdditionalNodes:1,maxModels:20});
  assert.equal(result.status,'counterexample');
  assert.equal(result.witness.result.holds,false);
  assert.equal(compileModel(result.witness.model).nodes.length,1);
  assert.equal(result.witness.assumptions.holds,true);
});
test('bounded exhaustion is explicit and complete only within the supplied space',async()=>{
  const result=await explore(empty(),{property:'seq',palette:[null],maxAdditionalNodes:2,maxModels:20});
  assert.equal(result.status,'exhausted');
  assert.equal(result.complete,true);
  // With one place and only dagger, exactly one extension exists at each depth.
  assert.equal(result.stats.examined,3);
});
test('a cap gives incomplete, never validity',async()=>{
  const result=await explore(empty(),{property:'true',palette:['E',null],maxAdditionalNodes:3,maxModels:2});
  assert.equal(result.status,'incomplete');
  assert.equal(result.complete,false);
  assert.equal(result.stats.examined,2);
});
test('search rejects property failures in models violating assumptions',async()=>{
  const result=await explore(empty(),{property:'false',assumptions:[{name:'mustHaveE',formula:'end past E'}],palette:[null],maxAdditionalNodes:2,maxModels:20});
  assert.equal(result.status,'exhausted');
  assert.equal(result.stats.modelsSatisfyingAssumptions,0);
});
test('failing prefixes are retained because later tuples can discharge obligations',async()=>{
  const result=await explore(empty(),{property:'false',assumptions:[{name:'eventuallyE',formula:'end past E'}],palette:['E'],maxAdditionalNodes:1,maxModels:20});
  assert.equal(result.status,'counterexample');
  assert.equal(result.stats.modelsSatisfyingAssumptions,1);
  assert.equal(result.witness.model.nodes.length,1);
});
test('canonical fingerprints ignore insertion order and redundant edges',()=>{
  const left=empty(),right=empty();
  left.participants=right.participants=['p','q'];
  left.quorums=right.quorums={v:[['p']]};
  left.nodes=[{id:'a',place:'p',event:'E',past:[]},{id:'b',place:'q',event:null,past:[]},{id:'c',place:'p',event:null,past:['a','b']}];
  right.nodes=[{id:'z',place:'q',event:null,past:[]},{id:'y',place:'p',event:'E',past:[]},{id:'x',place:'p',event:null,past:['z','y']}];
  assert.equal(historyFingerprint(compileModel(left)),historyFingerprint(compileModel(right)));
});
test('zero extension bound checks only the supplied base',async()=>{
  const result=await explore(empty(),{property:'not past E',maxAdditionalNodes:0});
  assert.equal(result.status,'exhausted');
  assert.equal(result.stats.examined,1);
});
test('a certified witness remains decisive when a continuing search hits its cap',async()=>{
  const result=await explore(empty(),{property:'false',stopAfterFirst:false,maxAdditionalNodes:2,maxModels:1});
  assert.equal(result.status,'counterexample');
  assert.equal(result.witness.result.holds,false);
  assert.equal(result.complete,false);
});
test('per-model evaluation step cap is honored during preparation and checking',async()=>{
  const result=await explore(empty(),{property:'not not not true',maxSteps:1,maxAdditionalNodes:0});
  assert.equal(result.status,'incomplete');
  assert.equal(result.witness,null);
});
