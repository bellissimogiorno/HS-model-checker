import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeDocument,parseDocument} from '../src/document.mjs';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {createEvidence,replayExperiment,runExperiment} from '../src/experiment.mjs';

function fixture({aliases=false,mixed=false,formula='mark -> past E'}={}) {
  const model={format:'history-structure-model/v1',participants:['p','q'],values:['v'],
    signature:{events:['E'],predicates:['mark','guard','other','unused']},
    nodes:[{id:'P',place:'p',event:'E',past:[]},{id:'Q',place:'q',event:'E',past:[]},
      {id:'OP',place:'p',event:null,past:['P']},{id:'OQ',place:'q',event:null,past:['Q']}],
    quorums:{v:[['p']]},facts:[{place:'p',at:mixed?['@t1','OP']:'@t1',atom:'mark'}]};
  if(aliases)model.nodes.push({id:'OP2',place:'p',event:null,past:['P']});
  if(mixed)model.facts.push({place:'q',at:'*',atom:{symbol:'guard',args:['v']}},{place:'p',at:['end','empty'],atom:'other'});
  const source=serializeDocument({name:'Fixed supplied interpretation',model,includeLive:false,axioms:[],properties:[{name:'Claim',formula,scope:'all'}]});
  return parseDocument(source);
}
function reordered(model) {
  const byId=new Map(model.nodes.map(row=>[row.id,row]));
  return {...structuredClone(model),nodes:['Q','P','OQ',...(byId.has('OP2')?['OP2']:[]),'OP'].map(id=>structuredClone(byId.get(id)))};
}
function certificate(doc,model) {
  const property=doc.properties[0];
  const checked=new Evaluator(compileModel(model)).check(property.ast,{scope:property.scope});
  return createEvidence(doc,{mode:'evaluate'},{...property,witness:{model,result:checked}});
}

test('evaluation replay refuses an ordinal-selector drift that fabricates a counterexample to a true supplied claim',()=>{
  const doc=fixture(),base=compileModel(doc.model),model=reordered(doc.model);
  assert.equal(new Evaluator(base).check(doc.properties[0].ast,{scope:'all'}).holds,true);
  assert.deepEqual(base.resolveTime('@t1').nodeIds,['P']);
  assert.deepEqual(compileModel(model).resolveTime('@t1').nodeIds,['Q']);
  assert.deepEqual(model.facts,doc.model.facts,'Identical fact JSON can denote different interpretations.');
  const forged=certificate(doc,model);
  assert.throws(()=>replayExperiment(forged),/supplied predicate interpretation/);
});

test('an equivalent reordered evaluation witness can use stable semantic selectors instead of source ordinals',async()=>{
  const doc=fixture({formula:'not mark'});
  const run=await runExperiment(doc.source,{mode:'evaluate'});
  assert.equal(run.status,'counterexample');
  const evidence=structuredClone(run.properties[0].evidence);
  evidence.model=reordered(evidence.model);
  evidence.model.facts=[{place:'p',at:'OP',atom:{symbol:'mark',args:[]}}];
  assert.equal(replayExperiment(evidence).verified,true);
});

test('mixed wildcard, ordinal, array, empty, full and duplicate silent-tuple aliases preserve the same interpretation',()=>{
  const doc=fixture({aliases:true,mixed:true,formula:'false'}),model=reordered(doc.model);
  model.facts=[
    {place:'p',at:['empty','end'],atom:'other'},
    {place:'q',at:['end','OP2','OQ','empty'],atom:{symbol:'guard',args:['v']}},
    {place:'p',at:['OP2','OP'],atom:'mark'},
    {place:'p',at:'OP',atom:{symbol:'mark',args:[]}},
  ];
  assert.equal(compileModel(model).nodes.length,4,'The two silent tuple IDs are aliases of one tuple.');
  assert.equal(replayExperiment(certificate(doc,model)).verified,true);
  const original=certificate(doc,model);
  for(const mutate of [
    e=>{e.model.facts[0].at=['end'];},
    e=>{e.model.facts[1].at=['end','OP2','empty'];},
    e=>{e.model.facts.push({place:'p',at:'end',atom:{symbol:'unused',args:['v']}});},
    e=>{e.model.facts.push({place:'p',at:'OP',atom:{symbol:'mark',args:['v']}});},
  ]) {
    const changed=structuredClone(original);mutate(changed);
    assert.throws(()=>replayExperiment(changed),/supplied predicate interpretation/);
  }
});

test('empty-history evaluation still treats omitted and empty fact arrays as the same total false interpretation',()=>{
  const model={format:'history-structure-model/v1',participants:['p'],values:['v'],signature:{events:[],predicates:['mark']},nodes:[],quorums:{v:[['p']]}};
  const doc=parseDocument(serializeDocument({model,includeLive:false,axioms:[],properties:[{name:'Claim',scope:'end',formula:'false'}]}));
  const evidence=certificate(doc,{...model,facts:[]});
  assert.equal(replayExperiment(evidence).verified,true);
});
