import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {serializeDocument} from '../src/document.mjs';
const directory=await mkdtemp(fileURLToPath(new URL('../.cli-audit-',import.meta.url)));
after(()=>rm(directory,{recursive:true,force:true}));
const cli=fileURLToPath(new URL('../src/cli.mjs',import.meta.url));
const model={format:'history-structure-model/v1',name:'Authoritative source model',participants:['p'],values:['red','blue'],signature:{events:[],predicates:['chosen']},nodes:[],quorums:{red:[['p']],blue:[['p']]},facts:[{place:'p',at:'*',atom:{symbol:'chosen',args:['red']}}]};
const sourceMarkdown=serializeDocument({name:'Authoritative source theory',model,includeLive:false,axioms:[{name:'SomeChoice',formula:'exists v. chosen(v)'},{name:'Other',formula:'true'}],properties:[{name:'UniqueChoice',formula:'exists1 v. chosen(v)',scope:'end'},{name:'RedChosen',formula:'chosen("red")',scope:'end'}]});
let serial=0;
async function project(changes={}){const path=join(directory,`project-${++serial}.json`);await writeFile(path,JSON.stringify({format:'history-structure-project/v2',sourceMarkdown,model:{stale:'this parsed copy must never control computation'},options:{mode:'evaluate',droppedAxioms:['SomeChoice'],selectedProperties:[],maxMilliseconds:5000},...changes}));return path;}
function run(...args){const result=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',maxBuffer:32*1024*1024});assert.equal(result.error,undefined);return result;}
function result(...args){const r=run(...args);assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout);}

test('CLI run/list consume current project source and retain saved mode and selections',async()=>{
  const path=await project();const list=result('list',path);assert.equal(list.name,'Authoritative source theory');assert.equal(list.properties.length,2);
  const report=result('run',path);assert.equal(report.mode,'evaluate');assert.equal(report.status,'model');assert.deepEqual(report.selectedProperties,[]);assert.deepEqual(report.droppedAxioms,['SomeChoice']);assert.deepEqual(report.retainedAxioms,['Other']);
});
test('CLI project flags override only their specified saved option',async()=>{
  const path=await project();
  const one=result('run',path,'--property','UniqueChoice');assert.equal(one.mode,'evaluate');assert.deepEqual(one.selectedProperties,['UniqueChoice']);assert.deepEqual(one.droppedAxioms,['SomeChoice']);assert.equal(one.status,'holds');
  const all=result('run',path,'--properties','all');assert.equal(all.mode,'evaluate');assert.deepEqual(all.selectedProperties,['UniqueChoice','RedChosen']);assert.deepEqual(all.droppedAxioms,['SomeChoice']);
  const dropped=result('run',path,'--drop','Other');assert.deepEqual(dropped.selectedProperties,[]);assert.deepEqual(dropped.droppedAxioms,['Other']);assert.deepEqual(dropped.retainedAxioms,['SomeChoice']);assert.equal(dropped.mode,'evaluate');
  const mode=result('run',path,'--mode','synthesize');assert.equal(mode.mode,'synthesize');assert.deepEqual(mode.selectedProperties,[]);assert.deepEqual(mode.droppedAxioms,['SomeChoice']);
});
test('all explicit model commands read the v2 source model rather than its stale parsed copy',async()=>{
  const path=await project();const valid=result('validate',path);assert.equal(valid.valid,true);assert.equal(valid.name,'Authoritative source model');
  const checked=result('check',path,'--formula','exists1 v. chosen(v)');assert.equal(checked.holds,true);
  const legacyPath=join(directory,'legacy.json');await writeFile(legacyPath,JSON.stringify({format:'history-structure-project/v1',model:{invalid:'stale'},modelSource:JSON.stringify(model)}));assert.equal(result('validate',legacyPath).valid,true);
});
test('CLI rejects unapplied v2 JSON drafts with an apply-first instruction',async()=>{
  const path=await project({unappliedModelSource:JSON.stringify({...model,name:'Unapplied model'})});
  for(const command of ['run','list','validate','check']){
    const r=run(command,path,...(command==='check'?['--formula','true']:[]));assert.equal(r.status,2,command);assert.match(r.stderr,/unapplied model JSON edits/);assert.match(r.stderr,/Apply the model to the theory/);assert.equal(r.stdout,'');
  }
});
test('CLI rejects unknown or duplicate saved selections instead of silently selecting none',async()=>{
  for(const options of [{selectedProperties:['Unknown']},{droppedAxioms:['Unknown']},{selectedProperties:['UniqueChoice','UniqueChoice']}]){
    const path=await project({options});
    for(const command of ['run','list','validate']){const r=run(command,path);assert.equal(r.status,2,command);assert.match(r.stderr,/Unknown|duplicate/);assert.equal(r.stdout,'');}
  }
});
test('CLI project runs retain saved solver limits unless that limit is explicitly overridden',async()=>{
  const path=await project({options:{mode:'synthesize',selectedProperties:['UniqueChoice'],droppedAxioms:['SomeChoice'],maxDecisions:0,maxCompilationNodes:1,maxMilliseconds:5000}});
  const limited=run('run',path);assert.equal(limited.status,2,limited.stderr);assert.equal(JSON.parse(limited.stdout).status,'incomplete');
  const overridden=run('run',path,'--compile-nodes','500000','--decisions','100000');assert.equal(overridden.status,1,overridden.stderr);const report=JSON.parse(overridden.stdout);assert.equal(report.status,'counterexample');assert.equal(report.mode,'synthesize');assert.deepEqual(report.droppedAxioms,['SomeChoice']);assert.deepEqual(report.selectedProperties,['UniqueChoice']);
});
