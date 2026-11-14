import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {parseDocument,serializeDocument,replaceModelBlock,selectTheory,TheoryDocumentError} from '../src/document.mjs';

function model() {return {format:'history-structure-model/v1',name:'Fixture',participants:['p'],values:['red','blue'],signature:{events:['echo'],predicates:['chosen','live']},nodes:[],quorums:{red:[['p']],blue:[['p']]},facts:[]};}
function source(declarations,extra='') {return '# A literal theory\n\n'+extra+'\n```hsm-model\n'+JSON.stringify(model(),null,2)+'\n```\n\n```hsm\n'+declarations+'\n```\n';}

test('only explicitly tagged executable fences are read; prose and nested examples do not execute',()=>{
  const outside='axiom Prose: false\n\n````markdown\n```hsm\naxiom Hidden: false\n```\n````\n\n```js\nthrow new Error("never executed");\n```\n';
  const doc=parseDocument(source('axiom Keep?: true\nproperty Claim!: exists v. chosen(v)',outside));
  assert.equal(doc.name,'A literal theory');
  assert.deepEqual(doc.axioms.map(a=>a.name),['Keep?']);
  assert.deepEqual(doc.properties.map(a=>a.name),['Claim!']);
});
test('declarations carry direction, scope, punctuation and original source lines',()=>{
  const input=source('include ThyLive\naxiom Vote\'!-relay? [forward]: forall v.\n  echo(v) ->\n  sometime echo(v)\nproperty Agreement [all]: forall v. v=v');
  const doc=parseDocument(input);
  assert.equal(doc.includeLive,true);
  assert.equal(doc.axioms[0].kind,'forward');
  assert.equal(doc.axioms[0].name,"Vote'!-relay?");
  assert.equal(doc.properties[0].scope,'all');
  assert.equal(input.split('\n')[doc.axioms[0].line-1].startsWith('axiom'),true);
  assert.match(doc.axioms[0].formula,/\n  echo/);
});
test('model validation, closed formula validation and declaration errors identify source locations',()=>{
  const input=source('axiom Good: true\nproperty Broken: forall v.\n  chosen(\n');
  assert.throws(()=>parseDocument(input),error=>error instanceof TheoryDocumentError&&Number.isInteger(error.line)&&error.line>1&&Number.isInteger(error.column));
  assert.throws(()=>parseDocument(source('property Unbound: chosen(?v)')),/Free variable/);
  assert.throws(()=>parseDocument(source('property Unknown: missing')),/unknown symbol/);
  assert.throws(()=>parseDocument(source('banana Invalid: true')),/Expected include, axiom or property/);
  assert.throws(()=>parseDocument(source('include ThyHBB2')),/Only include ThyLive/);
  assert.throws(()=>parseDocument(source('axiom X [future]: true')),/direction/);
  assert.throws(()=>parseDocument(source('property X [world]: true')),/scope/);
});
test('duplicate names, duplicate includes, invalid JSON and duplicate model blocks are rejected',()=>{
  assert.throws(()=>parseDocument(source('axiom X: true\nproperty X: true')),/Duplicate declaration/);
  assert.throws(()=>parseDocument(source('include ThyLive\ninclude ThyLive')),/Duplicate include/);
  assert.throws(()=>parseDocument(source('axiom ThyLive: true')),/reserved/);
  assert.throws(()=>parseDocument(source('property P: true').replace('"participants": [','"particiPants": [')),/Invalid history model/);
  assert.throws(()=>parseDocument(source('property P: true')+'\n```hsm-model\n{}\n```'),/exactly one/);
  assert.throws(()=>parseDocument('```hsm-model\n{\n}\n```\n```hsm\n```'),/Invalid history model/);
  assert.throws(()=>parseDocument('```hsm-model\n{trailing}\n```\n```hsm\n```'),/Invalid model JSON/);
});
test('fence rules prevent accidental execution and report unterminated executable input',()=>{
  assert.throws(()=>parseDocument('```hsm\naxiom X: true'),/Unclosed hsm/);
  assert.throws(()=>parseDocument(source('property P: true').replace('```hsm\n','```hsm extra\n')),/extra parameters/);
  const tilde=source('property P: true').replaceAll('```','~~~');
  assert.equal(parseDocument(tilde).properties[0].name,'P');
  assert.throws(()=>parseDocument('# prose only'),/exactly one/);
});
test('semantic serialization round-trips Unicode, multiline formulas, quoted names and source-independent edits',()=>{
  const doc=parseDocument(source('include ThyLive\naxiom "Rule: unusual [name]" [backward]: ∀ v.\n  echo(v) ⇒ ↕echo(v)\nproperty Unique: exists1 v. chosen(v)'));
  doc.properties[0].formula='exists01 v. chosen(v)';
  const again=parseDocument(serializeDocument(doc));
  assert.equal(again.axioms[0].name,'Rule: unusual [name]');
  assert.equal(again.axioms[0].kind,'backward');
  assert.equal(again.properties[0].formula,'exists01 v. chosen(v)');
  assert.equal(again.includeLive,true);
  assert.deepEqual(again.model,doc.model);
});
test('selection retains exactly named axioms and properties; ThyLive remains a dynamic grouped include',()=>{
  const doc=parseDocument(source('include ThyLive\naxiom A?: true\naxiom B!: true\nproperty P: true\nproperty Q: false'));
  const selected=selectTheory(doc,{droppedAxioms:['A?'],selectedProperties:['Q']});
  assert.deepEqual(selected.theory,{includeLive:true,axioms:[{name:'B!',kind:'other',formula:'true'}]});
  assert.deepEqual(selected.properties.map(p=>p.name),['Q']);
  assert.equal(selectTheory(doc,{droppedAxioms:['ThyLive']}).theory.includeLive,false);
  assert.equal(selectTheory(doc).properties.length,2);
  assert.equal(selectTheory(doc,{selectedProperties:[]}).properties.length,0);
  assert.throws(()=>selectTheory(doc,{droppedAxioms:['typo']}),/Unknown/);
  assert.throws(()=>selectTheory(doc,{selectedProperties:['P','P']}),/duplicate/);
});
test('all curated literate theories parse and preserve exact selections through serialization',async()=>{
  const directory=new URL('../examples/theories/',import.meta.url);
  const files=(await readdir(directory)).filter(name=>name.endsWith('.md'));
  for(const name of ['first-steps.md','hbb1.md','hbb2.md','hbb3.md','echo-ne.md','majority.md','heterogeneous.md']) assert(files.includes(name),name);
  for(const file of files) {
    const doc=parseDocument(await readFile(new URL(file,directory),'utf8'));
    const second=parseDocument(serializeDocument(doc));
    assert.deepEqual(selectTheory(second).theory,selectTheory(doc).theory,file);
    assert.deepEqual(second.properties.map(p=>[p.name,p.scope,p.formula]),doc.properties.map(p=>[p.name,p.scope,p.formula]),file);
  }
});


test('model-only replacement preserves exact surrounding prose, declarations, unrelated fences and CRLF',()=>{
  const before='# A literate theory\r\n\r\nOpening prose.\r\n\r\n````markdown\r\n```hsm-model\r\nnot an executable model\r\n```\r\n````\r\n\r\n   ~~~~hsm-model\r\n';
  const after='   ~~~~~\r\n\r\n<!-- keep this comment -->\r\n\r\n```hsm\r\n# Preserve comments and spacing.\r\nproperty P [end]: chosen("red")\r\n```\r\n\r\nClosing prose without a final newline.';
  const original=before+JSON.stringify(model())+'\r\n'+after;
  const replacement={...model(),name:'Edited model',facts:[{place:'p',at:'end',atom:{symbol:'chosen',args:['red']}}]};
  const result=replaceModelBlock(original,replacement);
  assert.equal(result,before+JSON.stringify(replacement,null,2).replaceAll('\n','\r\n')+'\r\n'+after);
  assert.deepEqual(parseDocument(result).model,replacement);
  assert.equal(parseDocument(result).properties[0].formula,'chosen("red")');
});

test('model-only replacement rejects models incompatible with the declarations',()=>{
  const original=source('property P: chosen("red")');
  const incompatible={...model(),signature:{events:['echo'],predicates:['live']}};
  assert.throws(()=>replaceModelBlock(original,incompatible),/unknown symbol/);
  assert.equal(parseDocument(original).model.signature.predicates.includes('chosen'),true);
});
