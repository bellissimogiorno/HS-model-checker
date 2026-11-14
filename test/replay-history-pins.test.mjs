import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeDocument} from '../src/document.mjs';
import {runExperiment,replayExperiment} from '../src/experiment.mjs';
import {compileModel} from '../src/model.mjs';

function fixture() {
  const model={format:'history-structure-model/v1',participants:['p','q'],values:['v'],signature:{events:['E'],predicates:['mark']},
    nodes:[{id:'P',place:'p',event:'E',past:[]},{id:'Q',place:'q',event:'E',past:[]},{id:'OP',place:'p',event:null,past:['P']},{id:'OQ',place:'q',event:null,past:['Q']}],
    quorums:{v:[['p']]},facts:[{place:'p',at:'@t1',atom:'mark'}]};
  return serializeDocument({name:'Ordinal pin identity',model,includeLive:false,axioms:[],properties:[{name:'Absent',scope:'all',formula:'not mark'}]});
}
const reorder=nodes=>[nodes[1],nodes[0],nodes[3],nodes[2]];
test('saved failing contexts use stable semantic histories, not local time numbers',async()=>{
  const run=await runExperiment(fixture(),{mode:'synthesize'});
  const evidence=run.properties[0].evidence;
  assert(!evidence.failure.time.startsWith('@'));
  assert.equal(replayExperiment(evidence).verified,true);
});
test('replay cannot migrate an ordinal source pin by permuting an isomorphic DAG',async()=>{
  const run=await runExperiment(fixture(),{mode:'synthesize',selectedProperties:[]});
  const evidence=structuredClone(run.consistency.evidence);
  evidence.model.nodes=reorder(evidence.model.nodes);
  const changed=compileModel(evidence.model);
  assert.equal(changed.hasFact('p',changed.resolveTime('OP').index,{symbol:'mark',args:[]}),false);
  assert.throws(()=>replayExperiment(evidence),/pinned predicate fact/);
});
test('an equivalent reordered certificate is valid when the fact retains its semantic history',async()=>{
  const run=await runExperiment(fixture(),{mode:'synthesize'});
  const evidence=structuredClone(run.properties[0].evidence);
  evidence.model.nodes=reorder(evidence.model.nodes);
  evidence.model.facts=evidence.model.facts.map(f=>({...f,at:f.at==='@t1'?'OP':f.at}));
  assert.equal(replayExperiment(evidence).verified,true);
});
test('replay rejects a misleading history annotation on a true failure world',async()=>{
  const run=await runExperiment(fixture(),{mode:'synthesize'});
  const evidence=structuredClone(run.properties[0].evidence);
  evidence.failure.history=['Q'];
  assert.throws(()=>replayExperiment(evidence),/failure history disagrees/);
});
