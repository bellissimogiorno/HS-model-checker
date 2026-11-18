import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {compileModel,ModelError} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {parseDocument} from '../src/document.mjs';

const base=()=>({format:'history-structure-model/v1',participants:['p'],values:['v'],
  signature:{events:['E'],predicates:['flag']},quorums:{v:[['p']]}});

test('omitted model arrays retain their documented empty defaults',()=>{
  const implicit=compileModel(base());
  const explicit=compileModel({...base(),nodes:[],facts:[]});
  assert.equal(implicit.nodes.length,0);
  assert.equal(implicit.times.length,explicit.times.length);
  assert.equal(new Evaluator(implicit).check(parseFormula('not flag and not sometime true')).holds,true);
  const omittedPast=compileModel({...base(),nodes:[{id:'e',place:'p',event:'E'}]});
  assert.equal(omittedPast.nodes[0].past,0n);
  assert.equal(new Evaluator(omittedPast).evaluate(parseFormula('E'),{place:'p',time:'e',event:'E'}),true);
});

test('explicit null or non-array history fields are errors rather than empty models or pasts',()=>{
  for(const value of [null,undefined,'',{},0,false]) {
    assert.throws(()=>compileModel({...base(),nodes:value}),ModelError,'nodes '+String(value));
    assert.throws(()=>compileModel({...base(),facts:value}),ModelError,'facts '+String(value));
    assert.throws(()=>compileModel({...base(),nodes:[{id:'e',place:'p',event:'E',past:value}]}),ModelError,'past '+String(value));
  }
});

test('every predicate fact must explicitly select its time',()=>{
  const nodes=[{id:'e',place:'p',event:'E',past:[]}];
  const fact={place:'p',atom:'flag'};
  assert.throws(()=>compileModel({...base(),nodes,facts:[fact]}),/fact\.at is required/);
  for(const at of [undefined,null,[undefined],[null],[],{},0])
    assert.throws(()=>compileModel({...base(),nodes,facts:[{...fact,at}]}),ModelError);
  const atEnd=compileModel({...base(),nodes,facts:[{...fact,at:'end'}]});
  const beforeEvent=compileModel({...base(),nodes,facts:[{...fact,at:'e'}]});
  assert.equal(new Evaluator(atEnd).check(parseFormula('flag')).holds,true);
  assert.equal(new Evaluator(beforeEvent).check(parseFormula('flag')).holds,false);
  assert.equal(new Evaluator(beforeEvent).evaluate(parseFormula('flag'),{place:'p',time:'e'}),true);
});

test('all shipped literate model blocks remain valid under strict input validation',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  const files=(await readdir(directory)).filter(name=>name.endsWith('.md'));
  assert(files.length>0);
  for(const name of files){
    const doc=parseDocument(await readFile(new URL(name,directory),'utf8'));
    const model=compileModel(doc.model);
    assert(model.nodes.length<=(doc.model.nodes??[]).length,name);
  }
});
