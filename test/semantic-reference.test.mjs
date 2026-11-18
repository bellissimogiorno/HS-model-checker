/** Independent finite set semantics. Deliberately uses recursively serialized
 * sets and complete upward-closed quorum families, not engine bitsets,
 * hash-consing, reduced world enumeration, or minimal intersection pruning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileModel} from '../src/model.mjs';
import {Evaluator} from '../src/evaluator.mjs';
import {parseFormula} from '../src/parser.mjs';

const atom = e => e === null ? null : typeof e === 'string' ? {symbol:e,args:[]} : e;
const ekey = e => e === null ? null : JSON.stringify([e.symbol,...e.args]);
const tkey = members => JSON.stringify([...members].sort());
const tuplekey = (p,e,time) => JSON.stringify([p,ekey(e),tkey(time)]);

function reference(data) {
  const raw = new Map(data.nodes.map(n=>[n.id,n]));
  const aliases = new Map(), nodes = new Map();
  function visit(id) {
    if (aliases.has(id)) return aliases.get(id);
    const n=raw.get(id), time=new Set();
    for (const parent of n.past??[]) {
      const prior=visit(parent);
      time.add(prior.key);
      for (const earlier of prior.time) time.add(earlier);
    }
    const e=atom(n.event), key=tuplekey(n.place,e,time);
    const result=nodes.get(key)??{key,place:n.place,event:e,time};
    nodes.set(key,result);aliases.set(id,result);return result;
  }
  data.nodes.forEach(n=>visit(n.id));
  const full=new Set(nodes.keys()),times=new Map();
  [...nodes.values()].forEach(n=>times.set(tkey(n.time),n.time));
  times.set(tkey(full),full);
  const quorums=new Map();
  for(const v of data.values) {
    const family=[];
    for(let mask=1;mask<2**data.participants.length;mask++) {
      const subset=new Set(data.participants.filter((_,i)=>mask&(2**i)));
      if(data.quorums[v].some(base=>base.every(p=>subset.has(p)))) family.push(subset);
    }
    quorums.set(v,family);
  }
  const facts=new Set();
  for(const f of data.facts??[]) {
    const at=Array.isArray(f.at)?f.at:[f.at];
    for(const sel of at) {
      const selected=sel==='*'?[...times.values()]:[sel==='end'?full:sel==='empty'?new Set():aliases.get(sel).time];
      for(const time of selected) facts.add(JSON.stringify([f.place,tkey(time),ekey(atom(f.atom))]));
    }
  }
  const term=(t,env)=>t.type==='var'?env.get(t.name):t.value;
  const worlds=[];
  // Include absent event labels and events of several arities. All formulas
  // below only mention these arities, so this is a full distinguishing set
  // for their semantic event atoms, plus a deliberately irrelevant arity.
  const events=[null];
  for(const symbol of data.signature.events) {
    events.push({symbol,args:[]},{symbol,args:['a']},{symbol,args:['b']},{symbol,args:['a','a']});
  }
  for(const n of nodes.values())if(n.event&&!events.some(e=>ekey(e)===ekey(n.event)))events.push(n.event);
  for(const time of times.values())for(const place of data.participants)for(const event of events)worlds.push({place,time,event});
  function evaluate(n,w,env=new Map()) {
    const local=()=>[...w.time].map(k=>nodes.get(k)).filter(p=>p.place===w.place);
    switch(n.type) {
      case 'true':return true;
      case 'false':return false;
      case 'eq':return term(n.left,env)===term(n.right,env);
      case 'atom':{
        const e={symbol:n.symbol,args:n.args.map(t=>term(t,env))};
        return data.signature.events.includes(n.symbol)
          ?ekey(w.event)===ekey(e)&&nodes.has(tuplekey(w.place,e,w.time))
          :facts.has(JSON.stringify([w.place,tkey(w.time),ekey(e)]));
      }
      case 'not':return !evaluate(n.body,w,env);
      case 'and':return evaluate(n.left,w,env)&&evaluate(n.right,w,env);
      case 'or':return evaluate(n.left,w,env)||evaluate(n.right,w,env);
      case 'implies':return !evaluate(n.left,w,env)||evaluate(n.right,w,env);
      case 'iff':return evaluate(n.left,w,env)===evaluate(n.right,w,env);
      case 'forall':case 'exists':case 'exists01':case 'exists1':{
        let count=0;
        for(const v of data.values){const next=new Map(env);next.set(n.variable,v);if(evaluate(n.body,w,next))count++;}
        return n.type==='forall'?count===data.values.length:n.type==='exists'?count>0:n.type==='exists01'?count<=1:count===1;
      }
      case 'past':return local().some(q=>evaluate(n.body,q,env));
      case 'allpast':return local().every(q=>evaluate(n.body,q,env));
      case 'end':return evaluate(n.body,{place:w.place,event:null,time:full},env);
      case 'sometime':return evaluate({type:'past',body:n.body},{place:w.place,event:null,time:full},env);
      case 'everytime':return evaluate({type:'allpast',body:n.body},{place:w.place,event:null,time:full},env);
      case 'seq':{
        const localNodes=local();
        return localNodes.every(a=>localNodes.every(b=>a===b||a.time.has(b.key)||b.time.has(a.key)));
      }
      case 'dia':case 'box':{
        let products=[new Set(data.participants)];
        for(const l of n.learners) {
          const next=[];
          for(const old of products)for(const q of quorums.get(term(l,env))) next.push(new Set([...old].filter(p=>q.has(p))));
          products=next;
        }
        const holds=p=>evaluate(n.body,{place:p,event:null,time:w.time},env);
        return n.type==='dia'?products.every(q=>[...q].some(holds)):products.some(q=>[...q].every(holds));
      }
      default:throw new Error(`reference unsupported ${n.type}`);
    }
  }
  return {nodes,aliases,times,full,worlds,evaluate};
}

let seed=0x49a231b;
function rnd(n){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;}
function randomModel(index) {
  const participants=['p','q','r'].slice(0,1+rnd(3));
  const data={format:'history-structure-model/v1',name:`reference ${index}`,participants,values:['a','b'],signature:{events:['e','f'],predicates:['P','Q']},nodes:[],quorums:{},facts:[]};
  for(const v of data.values) {
    // A common anchor guarantees pairwise intersection, while independently
    // adding bases and then using full upward closure exercises redundancy.
    const anchor=participants[rnd(participants.length)];
    data.quorums[v]=Array.from({length:1+rnd(3)},()=>participants.filter(p=>p===anchor||rnd(2)));
  }
  for(let i=0,n=rnd(7);i<n;i++) {
    const old=data.nodes.length&&rnd(5)===0?data.nodes[rnd(data.nodes.length)]:null;
    data.nodes.push(old?{...old,id:`n${i}`}:{id:`n${i}`,place:participants[rnd(participants.length)],event:rnd(3)===0?null:{symbol:rnd(2)?'e':'f',args:rnd(2)?[]:[rnd(2)?'a':'b']},past:data.nodes.filter(()=>rnd(3)===0).map(n=>n.id)});
  }
  for(const place of participants)for(const symbol of ['P','Q']) {
    if(rnd(2))data.facts.push({place,at:'*',atom:symbol==='P'?{symbol,args:['a']}:symbol});
    for(const n of data.nodes)if(rnd(4)===0)data.facts.push({place,at:n.id,atom:symbol==='P'?{symbol,args:['b']}:symbol});
  }
  return data;
}
function randomFormula(depth) {
  const leaves=['true','false','seq','e','f','e("a")','f("b")','P("a")','P("b")','Q','"a" = "b"'];
  if(depth===0||rnd(4)===0)return leaves[rnd(leaves.length)];
  if(rnd(3)===0)return `(${randomFormula(depth-1)} ${['and','or','->','<->'][rnd(4)]} ${randomFormula(depth-1)})`;
  const prefix=['not','past','allpast','end','sometime','everytime','dia[]','box[]','dia["a"]','box["a","b"]','dia["a","a","a"]'][rnd(11)];
  return `${prefix}(${randomFormula(depth-1)})`;
}

const fixed=[
  'true','false','seq','past true','allpast false','sometime true','everytime false',
  'e -> dia[] e','box[] not e','end past e','past Q','dia[] past e','box["a"] past e',
  'dia["a","a","a"] true','box["a","a","a"] false',
  'forall x. P(x) -> sometime e(x)',
  'exists x. dia[x] past e(x)',
  'exists01 x. e(x) or P(x)',
  'exists1 x. x = "a"',
  'forall x. exists x. x = "b"',
  'forall x. (exists x. x = "a") and x = x',
  'forall x. box[x,x] (allpast e(x) or not seq)',
];

test('independent set evaluator matches compiled DAG semantics and exact world reduction',()=>{
  for(let i=0;i<25;i++) {
    const data=randomModel(i),ref=reference(data),model=compileModel(data),engine=new Evaluator(model);
    assert.equal(model.nodes.length,ref.nodes.size,`canonical tuples model ${i}`);
    assert.equal(model.times.length,ref.times.size,`represented times model ${i}`);
    const formulas=[...fixed,...Array.from({length:15},()=>randomFormula(3))];
    for(const source of formulas) {
      const ast=parseFormula(source);
      for(const scope of ['all','end']) {
        const worlds=scope==='all'?ref.worlds:data.participants.map(place=>({place,event:null,time:ref.full}));
        const expected=worlds.every(w=>ref.evaluate(ast,w));
        const actual=engine.check(ast,{scope}).holds;
        assert.equal(actual,expected,`model ${i}, ${scope}: ${source}`);
      }
      // Compare the value at every actual tuple as well; global validity alone
      // can conceal errors which happen to preserve one counterexample.
      for(const n of model.nodes) {
        const naive=ref.aliases.get(n.id);
        const world={place:n.place,event:n.event,timeIndex:n.timeIndex};
        assert.equal(engine.evaluate(ast,world),ref.evaluate(ast,naive),`model ${i}, tuple ${n.id}: ${source}`);
      }
    }
  }
});

test('triple quorum intersection and hypothetical-event worlds preserve vacuity and event reset',()=>{
  const data={format:'history-structure-model/v1',participants:['p','q','r'],values:['a'],signature:{events:['e'],predicates:[]},nodes:[{id:'e0',place:'p',event:'e',past:[]}],quorums:{a:[['p','q'],['p','r'],['q','r']]},facts:[]};
  const model=compileModel(data),engine=new Evaluator(model);
  assert.equal(engine.check(parseFormula('dia[a,a] true'),{scope:'all'}).holds,true);
  assert.equal(engine.check(parseFormula('dia[a,a,a] true'),{scope:'all'}).holds,false);
  assert.equal(engine.check(parseFormula('box[a,a,a] false'),{scope:'all'}).holds,true);
  const w=model.world({place:'p',time:'e0',event:'e'});
  assert.equal(engine.evaluate(parseFormula('e'),w),true);
  assert.equal(engine.evaluate(parseFormula('dia[] e'),w),false);
  assert.equal(engine.evaluate(parseFormula('box[] not e'),w),true);
});

// Figure 7 instantiates one learner at a time. General quorum-list modal
// semantics remain independent and still include repeated/empty intersections.
const {knowledgeFamilies,checkTheory}=await import('../src/theories.mjs');

test('ThyLive permits empty histories even when repeated quorum intersections are empty',()=>{
  const base={format:'history-structure-model/v1',participants:['p','q','r'],values:['a'],signature:{events:['e'],predicates:['live']},nodes:[],quorums:{a:[['p','q'],['p','r'],['q','r']]},facts:[{place:'p',at:'*',atom:'live'}]};
  const checked=checkTheory(compileModel(base),'ThyLive');
  assert.equal(checked.holds,true);
  assert.equal(checked.complete,true);
  assert.equal(checked.completeness.events,0);
  assert.deepEqual(checked.axioms.map(a=>a.name),['LiveAlways','LiveSeq']);
  const model=compileModel(base),evaluator=new Evaluator(model);
  assert.equal(evaluator.check(parseFormula('box[a,a,a] false'),{scope:'all'}).holds,true,
    'The underlying general modality still retains vacuous empty intersections.');
  const families=knowledgeFamilies(model);
  assert.equal(families.complete,true);
  assert.deepEqual(families.families.map(f=>f.learners),[['a']]);
});

test('general modal quorum families equal complete full-quorum list products on three places',()=>{
  const data={format:'history-structure-model/v1',participants:['p','q','r'],values:['a','b'],signature:{events:[],predicates:[]},nodes:[],quorums:{a:[['p','q'],['p','r'],['q','r']],b:[['p','q'],['q','r']]},facts:[]};
  const model=compileModel(data),evaluator=new Evaluator(model,{maxSteps:10000000,maxMilliseconds:30000});
  const canonical=family=>[...new Set(family)].filter(m=>!family.some(n=>n!==m&&(n&m)===n)).sort((a,b)=>a-b).join(',');
  const full=new Map();
  for(const value of data.values) {
    const quorums=[];
    for(let mask=1;mask<8;mask++)if(data.quorums[value].some(base=>base.every(p=>mask&(1<<data.participants.indexOf(p)))))quorums.push(mask);
    full.set(value,quorums);
  }
  // Check the actual modal evaluator on every learner list of length <=6,
  // comparing against upward-closed full quorum families, not minimal bases.
  function lists(learners,product,depth) {
    assert.equal(canonical(evaluator.intersectionFamily(learners).map(Number)),canonical(product),learners.join(','));
    if(depth===6)return;
    for(const value of data.values)lists([...learners,value],[...new Set(product.flatMap(a=>full.get(value).map(b=>a&b)))],depth+1);
  }
  lists([],[7],0);
});

const {explore}=await import('../src/search.mjs');
test('exploration rejects unstable ordinal fact times while ordinary model checking permits them',async()=>{
  const data={format:'history-structure-model/v1',participants:['p'],values:['a'],signature:{events:['e'],predicates:['P']},nodes:[{id:'n',place:'p',event:'e',past:[]}],quorums:{a:[['p']]},facts:[{place:'p',at:'@t1',atom:'P'}]};
  assert.equal(new Evaluator(compileModel(data)).check(parseFormula('P'),{scope:'end'}).holds,true);
  await assert.rejects(()=>explore(data,{property:'P',maxAdditionalNodes:1}),/@t|ordinal|represented/i);
});
