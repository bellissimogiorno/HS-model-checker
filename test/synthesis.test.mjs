import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {synthesize} from '../src/synthesis.mjs';
import {compileModel} from '../src/model.mjs';
import {parseFormula} from '../src/parser.mjs';
import {Evaluator} from '../src/evaluator.mjs';

function base(changes={}) {return {format:'history-structure-model/v1',participants:['p'],values:['a','b'],signature:{events:[],predicates:['chosen','flag']},nodes:[],quorums:{a:[['p']],b:[['p']]},facts:[],...changes};}
function theorem(...formulas){return formulas.map((formula,i)=>({name:`Rule${i}?`,formula}));}
function brute(data,atoms,assumptions,property,scope='end') {
  let consistent=false,counterexample=false;
  for(let mask=0;mask<2**atoms.length;mask++){
    const model=compileModel({...data,facts:atoms.filter((_,i)=>mask&(1<<i))});
    if(!assumptions.every(a=>new Evaluator(model).check(parseFormula(a.formula),{scope:'all'}).holds))continue;
    consistent=true;
    if(property&&!new Evaluator(model).check(parseFormula(property),{scope}).holds)counterexample=true;
  }
  return !consistent?'no-model':property?counterexample?'counterexample':'holds':'model';
}
test('first-steps choice synthesis finds a replayed two-value counterexample',()=>{
  const data=base();
  const result=synthesize(data,{theory:theorem('exists v. chosen(v)'),property:'exists1 v. chosen(v)'});
  assert.equal(result.status,'counterexample');assert.equal(result.consistent,true);assert.equal(result.witness.verified,true);
  const model=compileModel(result.witness.model);
  assert.equal(new Evaluator(model).check(parseFormula('forall v. chosen(v)')).holds,true);
  assert.equal(result.witness.result.holds,false);
});
test('contradictory assumptions produce no-model rather than vacuous property success',()=>{
  const result=synthesize(base(),{theory:theorem('flag','not flag'),property:'false'});
  assert.equal(result.status,'no-model');assert.equal(result.consistent,false);assert.equal(result.witness,null);
});
test('property success first establishes a replayed consistent assumption interpretation',()=>{
  const result=synthesize(base(),{theory:theorem('exists1 v. chosen(v)'),property:'exists v. chosen(v)'});
  assert.equal(result.status,'holds');assert.equal(result.consistent,true);
  assert.equal(result.witness.assumptions.holds,true);assert.equal(result.witness.result,null);
});
test('SAT encoding agrees with exhaustive Boolean interpretations for finite value logic',()=>{
  const data=base(),atoms=[{place:'p',at:'end',atom:'flag'},...data.values.map(v=>({place:'p',at:'end',atom:{symbol:'chosen',args:[v]}}))];
  const cases=[
    [[], 'flag'], [theorem('flag'),'flag'],[theorem('not flag'),'flag'],
    [theorem('exists v. chosen(v)'),'exists1 v. chosen(v)'],
    [theorem('exists01 v. chosen(v)'),'exists1 v. chosen(v)'],
    [theorem('exists1 v. chosen(v)'),'exists01 v. chosen(v)'],
    [theorem('forall v. chosen(v)'),'exists1 v. chosen(v)'],
    [theorem('flag <-> (exists v. chosen(v))'),'flag -> exists v. chosen(v)'],
    [theorem('forall a. exists a. a="b"'),'forall v. v=v'],
    [theorem('exists1 v. chosen(v)','not exists v. chosen(v)'), 'true'],
  ];
  for(const [assumptions,property] of cases)assert.equal(synthesize(data,{theory:assumptions,property}).status,brute(data,atoms,assumptions,property),property);
});
test('SAT encoding agrees with exhaustive rho at all represented histories and event worlds',()=>{
  const data=base({values:['v'],signature:{events:['E'],predicates:['flag']},quorums:{v:[['p']]},nodes:[{id:'event',place:'p',event:{symbol:'E',args:['v']},past:[]},{id:'observe',place:'p',event:null,past:['event']}]});
  const atoms=['event','observe','end'].map(at=>({place:'p',at,atom:'flag'}));
  const cases=[
    [[], 'past flag'], [[], 'allpast flag'],[[], 'sometime flag'],[[], 'everytime flag'],
    [theorem('flag <-> end flag'),'past flag -> flag'],
    [theorem('E("v") -> flag'),'sometime flag'],
    [theorem('E("v") -> flag'),'past (E("v") and flag)'],
    [[], 'E("v") -> dia[] E("v")'],
    [theorem('allpast flag'),'flag'],
    [theorem('sometime E("v")'),'end past E("v")'],
  ];
  for(const [assumptions,property] of cases)for(const scope of ['end','all'])assert.equal(synthesize(data,{theory:assumptions,property,scope}).status,brute(data,atoms,assumptions,property,scope),`${scope}: ${property}`);
});
test('quorum compilation preserves repeated learners, vacuity, and global reset',()=>{
  const data=base({participants:['p','q','r'],values:['l'],signature:{events:[],predicates:['flag']},quorums:{l:[['p','q'],['p','r'],['q','r']]}});
  const atoms=data.participants.map(place=>({place,at:'end',atom:'flag'}));
  for(const property of ['dia["l","l"] flag','box["l","l"] flag','dia["l","l","l"] flag','box["l","l","l"] false','dia[] flag -> box[] flag'])for(const assumptions of [[],theorem('dia[] flag'),theorem('box[] flag')])assert.equal(synthesize(data,{theory:assumptions,property}).status,brute(data,atoms,assumptions,property),property);
});
test('positive seed facts pin truth while unlisted atoms remain free',()=>{
  const data=base({facts:[{place:'p',at:'*',atom:'flag'}]});
  assert.equal(synthesize(data,{theory:theorem('not flag')}).status,'no-model');
  const unpinned=synthesize(data,{theory:theorem('not flag'),pinFacts:false});
  assert.equal(unpinned.status,'model');assert.equal(unpinned.witness.model.facts.length,0);
  const free=synthesize(data,{theory:theorem('exists v. chosen(v)')});
  assert.equal(free.status,'model');assert(free.witness.model.facts.some(f=>f.atom==='flag'));
  assert(free.witness.model.facts.some(f=>typeof f.atom==='object'&&f.atom.symbol==='chosen'));
});
test('synthesized time facts use stable source selectors and shared alias times',()=>{
  const data=base({values:['v'],quorums:{v:[['p']]},signature:{events:['E'],predicates:['flag']},nodes:[{id:'e',place:'p',event:'E',past:[]},{id:'copy',place:'p',event:'E',past:[]},{id:'s',place:'p',event:null,past:['e']}]});
  const result=synthesize(data,{theory:theorem('E -> flag'),property:'everytime not flag'});
  assert.equal(result.status,'counterexample');
  assert(result.witness.model.facts.every(f=>!String(f.at).startsWith('@')));
  const model=compileModel(result.witness.model);
  assert.equal(model.hasFact('p',model.resolveTime('copy').index,{symbol:'flag',args:[]}),true);
});
test('arbitrary predicate arities are synthesized rather than silently constrained',()=>{
  const data=base();
  const result=synthesize(data,{theory:theorem('chosen','chosen("a","b","a")'),property:'chosen("a")'});
  assert.equal(result.status,'counterexample');
  assert.equal(result.witness.model.facts.filter(f=>typeof f.atom==='object'&&f.atom.symbol==='chosen').length,2);
});
test('full ThyLive schemes constrain synthesized rho when events first occur',()=>{
  const data=base({values:['v'],quorums:{v:[['p']]},signature:{events:['E'],predicates:['live']},nodes:[{id:'e',place:'p',event:'E',past:[]}],facts:[{place:'p',at:'*',atom:'live'}]});
  assert.equal(synthesize(data,{theory:'ThyLive'}).status,'no-model');
  const free=synthesize(data,{theory:'ThyLive',pinFacts:false});assert.equal(free.status,'model');
  data.nodes.push({id:'s',place:'p',event:null,past:['e']});
  assert.equal(synthesize(data,{theory:'ThyLive'}).status,'model');
});
test('completed paper theories synthesize and preserve their correctness properties',async()=>{
  const data=JSON.parse(await readFile(new URL('../examples/hbb2-complete.json',import.meta.url),'utf8'));
  const result=synthesize(data,{theory:'HBBSimp',property:'seq'});
  assert.equal(result.status,'holds');assert.equal(result.consistent,true);
});
test('scheme or compilation exhaustion is incomplete and invalid language is an error',()=>{
  assert.equal(synthesize(base(),{property:'flag',maxCompilationNodes:1}).status,'incomplete');
  const data=base({participants:['p','q'],values:['v','w'],quorums:{v:[['p']],w:[['q']]},signature:{events:['E'],predicates:['live']},nodes:[{id:'e',place:'p',event:'E',past:[]}]});
  assert.equal(synthesize(data,{theory:'ThyLive',maxKnowledgeFamilies:1}).status,'incomplete');
  assert.throws(()=>synthesize(base(),{property:'missing'}),/unknown symbol/);
  assert.throws(()=>synthesize(base(),{property:'chosen(?x)'}),/Free variable/);
  assert.throws(()=>synthesize(base(),{maxDecisions:-1}),/maxDecisions/);
  assert.throws(()=>synthesize(base(),{pinFacts:1}),/pinFacts/);
});
test('a solver decision cap yields incomplete rather than no-model',()=>{
  const result=synthesize(base(),{theory:theorem('chosen("a") or chosen("b")'),maxDecisions:0});
  assert.equal(result.status,'incomplete');assert.equal(result.consistent,null);
});
