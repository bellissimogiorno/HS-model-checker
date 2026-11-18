import test from 'node:test';
import assert from 'node:assert/strict';
import {correctnessProperties,TheoryError} from '../src/theories.mjs';

test('property requests reject unknown theory names rather than returning a vacuous empty list',()=>{
  for(const name of ['Bogus','HBBsafe','HBBSimple','HBBCORR','', ' HBBSafe']) {
    assert.throws(()=>correctnessProperties(name),error=>
      error instanceof TheoryError && /Unknown theory/.test(error.message) &&
      /HBBSafe, HBBSimp, HBBCorr/.test(error.message),JSON.stringify(name));
  }
});

test('property requests reject missing and malformed names through the documented error class',()=>{
  const cyclic={};cyclic.self=cyclic;
  for(const name of [undefined,null,false,0,1n,Symbol('HBBSafe'),{},[],['HBBSafe'],cyclic]) {
    assert.throws(()=>correctnessProperties(name),error=>
      error instanceof TheoryError && /name must be a string/.test(error.message));
  }
  assert.throws(()=>correctnessProperties(),TheoryError);
});

test('each protocol has exactly the three paper correctness claims while ThyLive validly has none',()=>{
  for(const name of ['HBBSafe','HBBSimp','HBBCorr']) {
    const properties=correctnessProperties(name);
    assert.deepEqual(properties.map(p=>p.name),['Happy Termination','Cascade Termination','Agreement']);
    assert(properties.every(p=>p.scope==='end'&&p.ast&&p.source?.draft==='2026-11-18'));
  }
  assert.deepEqual(correctnessProperties('ThyLive'),[]);
});
