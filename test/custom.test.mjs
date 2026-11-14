import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkCustomTheory,customTheorySpec} from '../src/custom.mjs';
import {buildTheory} from '../src/theories.mjs';
import {compileModel} from '../src/model.mjs';
import {explore} from '../src/search.mjs';

const example=async()=>JSON.parse(await readFile(new URL('../examples/hbb2-complete.json',import.meta.url),'utf8'));
test('editable protocol copies regenerate full liveness schemes for the current model',async()=>{
  const data=await example();
  const built=buildTheory(compileModel(data),'ThyHBB2');
  const spec={includeLive:true,axioms:built.axioms.filter(a=>!a.scheme&&!['LiveAlways','LiveSeq'].includes(a.name)).map(({name,formula,kind})=>({name,formula,kind}))};
  assert.equal(checkCustomTheory(data,spec).holds,true);
  data.nodes.pop(); // Final real deliver now lacks a later observation.
  const result=checkCustomTheory(data,spec);
  assert.equal(result.holds,false);
  assert(result.axioms.some(a=>a.scheme && a.holds===false));
});
test('literal empty theory is distinguished from inclusion of ThyLive',async()=>{
  const data=await example();
  data.nodes.pop();
  assert.equal(checkCustomTheory(data,[]).holds,true);
  assert.equal(checkCustomTheory(data,{includeLive:true,axioms:[]}).holds,false);
});
test('custom names retain punctuation and malformed fields are rejected',async()=>{
  const data=await example();
  assert.equal(checkCustomTheory(data,[{name:"Echo'?!",formula:'true'}]).axioms[0].name,"Echo'?!");
  assert.throws(()=>customTheorySpec({includeLive:'true',axioms:[]}),/includeLive/);
  assert.throws(()=>customTheorySpec([{name:'x',formula:'true',formlua:'false'}]),/unknown field/);
  assert.throws(()=>customTheorySpec([{name:'x',formula:'true'},{name:'x',formula:'false'}]),/Duplicate/);
});
test('exploration accepts editable theories with dynamic full ThyLive',async()=>{
  const data=await example();
  const result=await explore(data,{property:'true',assumptions:{includeLive:true,axioms:[]},maxAdditionalNodes:0,maxModels:10});
  assert.equal(result.status,'exhausted');
  assert.equal(result.stats.modelsSatisfyingAssumptions,1);
});
