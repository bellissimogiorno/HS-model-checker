import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {sha256,canonicalJSON,createRunSnapshot} from '../src/run-identity.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {parseDocument} from '../src/document.mjs';

const model={format:'history-structure-model/v1',participants:['p','q'],values:['v'],signature:{events:['E'],predicates:['mark']},nodes:[],quorums:{v:[['p']]},facts:[]};
const source=`# Same displayed name\n\nUnicode: ∀ ∃¹ ♢ ↓.\n\n\`\`\`hsm-model\n${JSON.stringify(model)}\n\`\`\`\n\n\`\`\`hsm\naxiom Empty: true\nproperty Sequence: seq\nproperty Tautology: true\nproperty Failure: false\n\`\`\`\n`;

test('portable source digests match independent SHA-256 on bytes, Unicode and block boundaries',()=>{
  const strings=['','abc','∀ ∃⁰¹ ♢[] ↓ E\r\n😀','a'.repeat(55),'a'.repeat(56),'a'.repeat(64),'a'.repeat(100000),'\ud800','\ufffd'];
  for(const text of strings)assert.equal(sha256(text),createHash('sha256').update(text,'utf8').digest('hex'));
  assert.equal(canonicalJSON({b:2,a:{d:4,c:3}}),canonicalJSON({a:{c:3,d:4},b:2}));
  assert.notEqual(canonicalJSON(['a','b']),canonicalJSON(['b','a']));
  assert.throws(()=>canonicalJSON({x:Infinity}),/finite/);
  const cyclic={};cyclic.self=cyclic;assert.throws(()=>canonicalJSON(cyclic),/finite JSON/);
  assert.equal(canonicalJSON(Array(2)),'[null,null]');
});

test('run identity binds the full source, exact selections, backend and operational bounds',async()=>{
  const settings={selectedProperties:['Tautology'],maxMilliseconds:30000};
  const original=await runExperiment(source,settings),same=await runExperiment(source,{maxMilliseconds:30000,selectedProperties:['Tautology']});
  assert.equal(original.snapshot.id,same.snapshot.id);
  assert.equal(original.sourceMarkdown,source);
  assert.equal(original.snapshot.sourceSha256,sha256(source));
  assert.equal(original.snapshot.engine.version,'0.6.9');
  assert.equal(original.snapshot.backend,'builtin-cdcl/tseitin');
  assert(Object.isFrozen(original.snapshot));
  for(const [text,options]of[
    [source+'\nA changed explanation.\n',settings],
    [source,{...settings,selectedProperties:[]}],
    [source,{...settings,droppedAxioms:['Empty']}],
    [source,{...settings,pinFacts:false}],
    [source,{...settings,maxDecisions:100001}],
    [source,{...settings,mode:'evaluate'}],
  ]) {
    const changed=await runExperiment(text,options);
    assert.notEqual(changed.snapshot.id,original.snapshot.id);
  }
  const sourceOnlyA=createRunSnapshot('bad\ud800',{bounds:{mode:'evaluate'},selectedProperties:[],droppedAxioms:[]});
  const sourceOnlyB=createRunSnapshot('bad\ufffd',{bounds:{mode:'evaluate'},selectedProperties:[],droppedAxioms:[]});
  assert.notEqual(sourceOnlyA.id,sourceOnlyB.id,'Different JS strings remain distinguished even when UTF-8 replaces an unpaired surrogate.');
});

test('a running history search owns its source and nested options before any observer can mutate them',async()=>{
  const settings={mode:'search',selectedProperties:['Sequence','Tautology'],droppedAxioms:[],maxMilliseconds:30000,maxAdditionalNodes:2,maxModels:100,palette:[null,{symbol:'E',args:[]}]};
  const expected=await runExperiment(source,structuredClone(settings));
  const input=parseDocument(source);let mutated=false;
  const run=await runExperiment(input,settings,()=>{
    if(mutated)return;mutated=true;
    settings.selectedProperties.splice(0,2,'Missing');
    settings.droppedAxioms.push('Empty');
    settings.palette[1].symbol='NotDeclared';
    settings.palette.push({symbol:'AlsoNotDeclared',args:[]});
    input.source='broken replacement';
    input.model.values.push('changed');
  });
  assert.equal(mutated,true);
  assert.equal(run.complete,true);
  assert.equal(run.snapshot.id,expected.snapshot.id);
  assert.deepEqual(run.properties.map(p=>p.status),expected.properties.map(p=>p.status));
  assert.deepEqual(run.selectedProperties,['Sequence','Tautology']);
  assert.deepEqual(run.droppedAxioms,[]);
  assert.equal(run.sourceMarkdown,source);
  assert.deepEqual(run.snapshot.bounds.palette,[null,{symbol:'E',args:[]}]);
  assert.equal(replayExperiment(run.properties[0].evidence).verified,true);
});

test('evidence retains original multi-claim identity and rejects changed provenance without trusting hashes as proofs',async()=>{
  const run=await runExperiment(source,{selectedProperties:['Tautology','Failure'],maxMilliseconds:30000});
  const evidence=run.properties.find(p=>p.name==='Failure').evidence;
  assert.equal(evidence.snapshot.id,run.snapshot.id);
  assert.deepEqual(evidence.snapshot.selectedProperties,['Tautology','Failure']);
  assert.equal(replayExperiment(evidence).verified,true);
  assert.equal(replayExperiment(run.consistency.evidence).verified,true);
  for(const mutate of[
    e=>{e.sourceMarkdown+='\nChanged prose.\n';},
    e=>{e.snapshot.id='sha256:'+'0'.repeat(64);},
    e=>{e.snapshot.sourceSha256='0'.repeat(64);},
    e=>{e.snapshot.engine.version='0.0.0';},
    e=>{e.snapshot.backend='different-solver';},
    e=>{e.snapshot.selectedProperties=['Failure'];},
    e=>{e.bounds.maxModels++;},
    e=>{e.snapshot.selectedProperties=[];},
  ]) {
    const changed=structuredClone(evidence);mutate(changed);
    assert.throws(()=>replayExperiment(changed),/snapshot|selected/i);
  }
  // A matching digest does not certify a model. Concrete evaluation still
  // rejects a false claim that has been changed to a true interpretation.
  const chosen=source.replace('property Failure: false','property Failure: mark');
  const other=await runExperiment(chosen,{selectedProperties:['Failure']});
  const invalid=structuredClone(other.properties[0].evidence);
  invalid.model.facts=[{place:'p',at:'*',atom:'mark'},{place:'q',at:'*',atom:'mark'}];
  assert.equal(replayExperiment(invalid).verified,false);
});

test('evidence without optional snapshot metadata remains replayable and an empty property selection remains model-only',async()=>{
  const run=await runExperiment(source,{selectedProperties:[]});
  assert.equal(run.status,'model');assert.deepEqual(run.snapshot.selectedProperties,[]);
  assert.equal(replayExperiment(run.consistency.evidence).verified,true);
  const legacy=structuredClone(run.consistency.evidence);delete legacy.snapshot;legacy.version='0.0.0';
  assert.equal(replayExperiment(legacy).verified,true);
});
