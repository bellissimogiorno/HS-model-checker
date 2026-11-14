import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel,ModelError} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';
import {parseDocument,serializeDocument,selectTheory,TheoryDocumentError} from '../src/document.mjs';
import {checkCustomTheory,customTheorySpec} from '../src/custom.mjs';
import {synthesize} from '../src/synthesis.mjs';

const data=()=>({format:'history-structure-model/v1',participants:['p'],values:['v'],
  signature:{events:['E'],predicates:['live','flag']},
  nodes:[{id:'event',place:'p',event:'E',past:[]}],quorums:{v:[['p']]},facts:[]});
const source=(declarations,newline='\n')=>`# API boundary\n\n\`\`\`hsm-model\n${JSON.stringify(data())}\n\`\`\`\n\n\`\`\`hsm\n${declarations}\n\`\`\`\n`.replaceAll('\n',newline);

test('public worlds reject malformed explicit indices instead of silently checking end',()=>{
  const model=compileModel(data()),evaluator=new Evaluator(model),event=parseFormula('E');
  // At the actual tuple the event is true; at the default end world it is false.
  assert.equal(evaluator.evaluate(event,{place:'p',timeIndex:model.resolveTime('event').index,event:'E'}),true);
  assert.equal(evaluator.evaluate(event),false);
  for(const timeIndex of ['0',0.5,NaN,Infinity,-1,model.times.length,undefined]) {
    assert.throws(()=>evaluator.evaluate(event,{place:'p',timeIndex,event:'E'}),ModelError);
  }
  for(const invalid of [null,[],0,'event',false]) {
    assert.throws(()=>evaluator.evaluate(event,invalid),/World must be an object/);
    assert.throws(()=>model.world(invalid),/world must be an object/);
  }
  assert.equal(evaluator.evaluate(event,model.world({place:'p',time:'event',event:'E'})),true);
});

test('public AST validation rejects array nodes and malformed models while retaining arbitrary arities',()=>{
  assert.throws(()=>new Evaluator(data()),/compiled HistoryModel/);
  const evaluator=new Evaluator(compileModel(data()));
  assert.throws(()=>evaluator.validate(Object.assign([],{type:'true'})),/Malformed/);
  assert.throws(()=>evaluator.validate({type:'eq',left:Object.assign([],{type:'value',value:'v'}),right:{type:'value',value:'v'}}),/Malformed formula term/);
  const cyclic={type:'not'};cyclic.body=cyclic;
  assert.throws(()=>evaluator.validate(cyclic),/cyclic|deep/);
  assert.equal(evaluator.validate(parseFormula('flag and flag("v") and flag("v","v","v")')),true);
  for(const learners of ['v',new Set(['v']),null,undefined]) assert.throws(()=>evaluator.intersectionFamily(learners),/Learners must be an array/);
  assert.deepEqual(evaluator.intersectionFamily(['v']),[1n]);
});

test('programmatic theory selection reparses current formulas rather than trusting supplied trees',()=>{
  const doc=parseDocument(source('axiom A? [backward]: true\nproperty P [end]: true'));
  doc.properties[0].ast={type:'false'};
  const selected=selectTheory(doc);
  assert.equal(new Evaluator(compileModel(doc.model)).check(selected.properties[0].ast).holds,true);
  // Current formula text is authoritative, even for a manually built document.
  delete doc.properties[0].ast;doc.properties[0].formula='flag';
  assert.equal(new Evaluator(compileModel(doc.model)).check(selectTheory(doc).properties[0].ast).holds,false);
  assert.equal(doc.properties[0].ast,undefined,'selection does not mutate its input document');
  doc.properties[0].formula='missing';
  assert.throws(()=>selectTheory(doc),/unknown symbol/);
});

test('programmatic documents and custom theories enforce the same name, scope and direction contracts',()=>{
  const base=parseDocument(source('axiom A?! [backward]: true\nproperty P [end]: true'));
  for(const mutate of [
    d=>{d.includeLive='false';},d=>{d.axioms[0].name='   ';},d=>{d.axioms[0].name='A\nB';},
    d=>{d.axioms[0].kind='future';},d=>{d.properties[0].scope='world';},
    d=>{d.properties[0].name=d.axioms[0].name;},d=>{d.axioms[0].name='ThyLive';},
  ]) {
    const doc=structuredClone(base);mutate(doc);assert.throws(()=>selectTheory(doc));
  }
  assert.throws(()=>serializeDocument({...base,includeLive:'false'}),/includeLive/);
  assert.throws(()=>serializeDocument({...base,axioms:[null]}),/Invalid axiom data/);
  for(const name of ['','   ','A\nB','ThyLive']) assert.throws(()=>customTheorySpec([{name,formula:'true'}]));
  assert.throws(()=>customTheorySpec([{name:'Forward!!',kind:'future',formula:'true'}]),/direction/);
  assert.equal(customTheorySpec([{name:'Forward!!',kind:'forward',formula:'true'}]).axioms[0].name,'Forward!!');
  const duplicate={includeLive:true,axioms:[{name:'LiveAlways',formula:'true'}]};
  assert.throws(()=>checkCustomTheory(data(),duplicate),/duplicates an included ThyLive axiom/);
  assert.throws(()=>synthesize(data(),{theory:duplicate}),/duplicates an included ThyLive axiom/);
});

test('quoted declaration labels round-trip exactly, including boundary spaces and repeated punctuation',()=>{
  const doc=parseDocument(source('axiom " Echo!! " [forward]: true\nproperty " Claim?! " [all]: true'));
  const again=parseDocument(serializeDocument(doc));
  assert.equal(again.axioms[0].name,' Echo!! ');assert.equal(again.properties[0].name,' Claim?! ');
  assert.deepEqual(selectTheory(again,{droppedAxioms:[' Echo!! '],selectedProperties:[' Claim?! ']}).droppedAxioms,[' Echo!! ']);
});

test('formula and model JSON diagnostics report Unicode-code-point columns on every newline convention',()=>{
  const declaration='property "Claim 😀" [end]: true and @';
  for(const newline of ['\n','\r\n','\r']) {
    const text=source(declaration,newline),line=text.split(/\r\n?|\n/).findIndex(row=>row===declaration)+1;
    assert.throws(()=>parseDocument(text),error=>error instanceof TheoryDocumentError&&error.line===line&&error.column===Array.from(declaration.slice(0,declaration.indexOf('@'))).length+1);
    const invalid='{"name":"😀",}';
    const json=`# Invalid JSON${newline}\`\`\`hsm-model${newline}${invalid}${newline}\`\`\`${newline}\`\`\`hsm${newline}property P: true${newline}\`\`\`${newline}`;
    assert.throws(()=>parseDocument(json),error=>error instanceof TheoryDocumentError&&error.line===3&&error.column===Array.from(invalid.slice(0,invalid.lastIndexOf('}'))).length+1);
  }
});
