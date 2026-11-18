// Exercise the actual browser worker's message contract using Node's worker
// runtime. This checks modules/messages/structured-cloning, not browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {checkCustomTheory} from '../src/custom.mjs';

const example=async(name='hbb2-complete')=>JSON.parse(await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));
function request(payload) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`
      const {parentPort,workerData}=require('node:worker_threads');
      globalThis.self={postMessage:value=>parentPort.postMessage(value)};
      import(workerData.url).then(()=>parentPort.on('message',data=>self.onmessage({data}))).catch(error=>{throw error;});
    `,{eval:true,workerData:{url:new URL('../src/worker.mjs',import.meta.url).href}});
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('Worker integration timed out.'));},10000);
    worker.on('error',error=>{clearTimeout(timer);worker.terminate();reject(error);});
    worker.on('message',data=>{
      if(data.type==='progress')return;
      clearTimeout(timer);worker.terminate();resolve(data);
    });
    worker.postMessage({id:7,...payload});
  });
}
test('module worker checks formula scopes and returns explanatory quantified assignments',async()=>{
  const model=await example();
  const result=await request({action:'formula',model,formula:'forall v. not echo(v)',options:{scope:'all'}});
  assert.equal(result.id,7);assert.equal(result.type,'result');
  assert.equal(result.result.holds,false);
  assert(result.result.explanation);
  assert.match(JSON.stringify(result.result.explanation),/counterexampleBinding/);
});
test('module worker reports all-world named and dynamic custom theories',async()=>{
  const model=await example();
  const built=await request({action:'theory',model,theory:'HBBSimp'});
  assert.equal(built.result.holds,true);
  const custom=await request({action:'theory',model,theory:'custom',axioms:{includeLive:true,axioms:[{name:'Custom?',formula:'true'}]}});
  assert.equal(custom.result.holds,true);
  assert(custom.result.axioms.some(a=>a.scheme==='KnowledgeBox'));
});
test('copied editable theories retain dynamic schemes rather than finite snapshots',async()=>{
  const model=await example('hbb1-complete');
  const copied=await request({action:'copyTheory',model,theory:'HBBSafe'});
  assert.equal(copied.result.includeLive,true);
  assert.equal(copied.result.axioms.length,8);
  assert(copied.result.axioms.every(a=>!a.name.startsWith('Knowledge')));
  assert.equal(checkCustomTheory(model,copied.result).holds,true);
});
test('worker errors distinguish invalid syntax and incomplete evaluation',async()=>{
  const model=await example();
  const syntax=await request({action:'formula',model,formula:'forall .',options:{scope:'all'}});
  assert.equal(syntax.type,'error');assert.equal(syntax.error.incomplete,false);
  assert.equal(typeof syntax.error.line,'number');
  const limit=await request({action:'formula',model,formula:'seq',options:{scope:'all',maxSteps:1}});
  assert.equal(limit.type,'error');assert.equal(limit.error.incomplete,true);
});
test('worker exploration returns a model with a certified property failure',async()=>{
  const model=await example('fork');
  const searched=await request({action:'explore',model,options:{property:'seq',assumptions:'HBBSimp',maxAdditionalNodes:0}});
  assert.equal(searched.type,'result');assert.equal(searched.result.status,'counterexample');
  assert.equal(searched.result.witness.assumptions.holds,true);
  assert.equal(searched.result.witness.result.holds,false);
});

test('four-step worker experiment exports complete evidence and replays it independently',async()=>{
  const sourceMarkdown=await readFile(new URL('../examples/theories/first-steps.md',import.meta.url),'utf8');
  const run=await request({action:'experiment',sourceMarkdown,options:{mode:'synthesize',selectedProperties:['UniqueChoice']}});
  assert.equal(run.type,'result');assert.equal(run.result.status,'counterexample');
  const evidence=run.result.properties[0].evidence;
  assert.equal(evidence.format,'history-structure-evidence/v1');
  assert.equal(evidence.property.name,'UniqueChoice');assert(evidence.failure);
  const replay=await request({action:'replay',evidence});
  assert.equal(replay.type,'result');assert.equal(replay.result.verified,true);
  evidence.model.facts=evidence.model.facts.slice(0,1);
  const changed=await request({action:'replay',evidence});
  assert(changed.type==='error'||changed.result.verified===false);
});
test('four-step worker distinguishes impossible assumptions and a weakened-protocol counterexample',async()=>{
  const sourceMarkdown=await readFile(new URL('../examples/theories/echo-ne.md',import.meta.url),'utf8');
  const full=await request({action:'experiment',sourceMarkdown,options:{mode:'synthesize'}});
  assert.equal(full.result.status,'no-model');
  assert.equal(full.result.properties[0].status,'not-tested');
  const weak=await request({action:'experiment',sourceMarkdown,options:{mode:'synthesize',droppedAxioms:['EchoNE'],selectedProperties:['Agreement']}});
  assert.equal(weak.result.status,'counterexample');
  assert.deepEqual(weak.result.droppedAxioms,['EchoNE']);
  const evidence=weak.result.properties[0].evidence;
  assert(!evidence.retainedAxioms.includes('EchoNE'));
  assert.equal((await request({action:'replay',evidence})).result.verified,true);
});
