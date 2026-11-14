import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesize} from '../src/synthesis.mjs';
import {Evaluator} from '../src/evaluator.mjs';

const model=()=>({format:'history-structure-model/v1',participants:['p'],values:['a'],signature:{events:[],predicates:['flag']},nodes:[],quorums:{a:[['p']]},facts:[]});

test('large valid compilation budgets do not overflow the derived replay step budget',()=>{
  const theory=[{name:'True',formula:'true'}];
  const options={theory,maxCompilationNodes:Number.MAX_SAFE_INTEGER};
  assert.equal(synthesize(model(),options).status,'model');
  assert.equal(synthesize(model(),{...options,property:'false'}).status,'counterexample');
});

test('a model-only replay with no axioms cannot outlive the synthesis deadline',()=>{
  const originalNow=Date.now;
  let clock=1000;
  Date.now=()=>clock;
  try {
    const result=synthesize(model(),{theory:[],maxMilliseconds:10,onProgress:event=>{
      if(event.phase==='Replaying model')clock=2000;
    }});
    assert.equal(result.status,'incomplete');
    assert.equal(result.complete,false);
    assert.equal(result.consistent,null);
    assert.equal(result.witness,null);
  } finally {Date.now=originalNow;}
});

test('a counterexample replay cannot renew the absolute synthesis deadline',()=>{
  const originalNow=Date.now;
  let clock=1000,replays=0;
  Date.now=()=>clock;
  try {
    const result=synthesize(model(),{theory:[],property:'flag',maxMilliseconds:10000,deadline:1010,onProgress:event=>{
      if(event.phase==='Replaying model'&&++replays===2)clock=2000;
    }});
    assert.equal(replays,2);
    assert.equal(result.status,'incomplete');
    assert.equal(result.complete,false);
    assert.equal(result.consistent,true);
    assert.equal(result.witness.result,null,'Only the earlier, completed consistency replay is retained.');
  } finally {Date.now=originalNow;}
});

test('the final axiom and property checks must complete within the shared deadline',()=>{
  const originalNow=Date.now,originalCheck=Evaluator.prototype.check;
  try {
    for(const property of [null,'flag']) {
      let clock=1000;
      Date.now=()=>clock;
      Evaluator.prototype.check=function(...args) {
        const checked=originalCheck.apply(this,args);
        clock=2000;
        return checked;
      };
      const theory=property?[]:[{name:'True',formula:'true'}];
      const result=synthesize(model(),{theory,property,maxMilliseconds:10});
      assert.equal(result.status,'incomplete',property??'model only');
      assert.equal(result.complete,false);
      assert.equal(result.consistent,property?true:null);
    }
  } finally {Date.now=originalNow;Evaluator.prototype.check=originalCheck;}
});

test('every progress phase observes the shared deadline after its observer returns',()=>{
  const originalNow=Date.now;
  try {
    for(const phase of ['Preparing theory','Compiling assumptions','Checking assumption consistency','Replaying model','Compiling property','Searching for a counterexample']) {
      let clock=1000,observed=false;
      Date.now=()=>clock;
      const result=synthesize(model(),{theory:[],property:'flag',maxMilliseconds:10,onProgress:event=>{
        if(event.phase===phase){observed=true;clock=1010;}
      }});
      assert.equal(observed,true,phase);
      assert.equal(result.status,'incomplete',phase);
      assert.equal(result.complete,false,phase);
    }
  } finally {Date.now=originalNow;}
});
