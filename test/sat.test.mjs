/** Independent truth-table audits of the upstream-derived SAT kernel. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Circuit,solve,_Solver} from '../src/sat.mjs';

function holds(clauses,assignment) {
  return clauses.every(clause=>clause.some(literal=>assignment.get(Math.abs(literal))===(literal>0)));
}
function brute(nvars,clauses) {
  for(let row=0;row<2**nvars;row++) {
    const assignment=new Map(Array.from({length:nvars},(_,i)=>[i+1,Boolean(row&(2**i))]));
    if(holds(clauses,assignment))return assignment;
  }
  return null;
}
function *tuples(values,width,prefix=[]) {
  if(!width) {yield prefix;return;}
  for(const value of values)yield*tuples(values,width-1,[...prefix,value]);
}
function *combinations(items,count,start=0,prefix=[]) {
  if(!count){yield prefix;return;}
  for(let i=start;i<=items.length-count;i++)yield*combinations(items,count-1,i+1,[...prefix,items[i]]);
}
function assertMatches(nvars,clauses) {
  const copy=structuredClone(clauses),expected=brute(nvars,clauses);
  const result=solve(nvars,clauses,{maxMilliseconds:Infinity});
  assert.equal(result.status,expected?'sat':'unsat',JSON.stringify(clauses));
  assert.deepEqual(clauses,copy,'Solver mutated the caller CNF.');
  if(result.status==='sat') {
    assert.equal(result.assignment.size,nvars);
    assert(holds(clauses,result.assignment));
  }else assert.equal(result.assignment.size,0);
  return result;
}
function rng(seed) {
  let state=seed>>>0;
  return n=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state%n;};
}

test('Circuit constants, duality, canonical sharing and fresh names match upstream',()=>{
  const c=new Circuit(),a=c.newVar('a'),b=c.newVar('b');
  assert.equal(c.and(),c.true);assert.equal(c.or(),c.false);
  assert.equal(c.and(a,a,c.true),a);
  assert.equal(c.and(a,-a),c.false);assert.equal(c.or(a,-a),c.true);
  assert.equal(c.and(a,b),c.and(b,a,a));
  assert.equal(c.or(-a,-b),-c.and(a,b));
  assert.equal(c.iff(a,b),c.iff(-b,-a));
  assert.equal(c.iff(a,-b),-c.iff(a,b));
  assert.notEqual(c.newVar('same'),c.newVar('same'));
  assert.equal(c.names.get(a),'a');
});

test('gate Tseitin encodings have exactly one correct extension, checked without SAT',()=>{
  const literals=[1,-1,2,-2,3,-3,4,-4];
  for(const operation of ['and','or','iff','implies']) {
    const widths=['iff','implies'].includes(operation)?[2]:[0,1,2,3];
    for(const width of widths)for(const inputs of tuples(literals,width)) {
      const c=new Circuit();for(let i=0;i<3;i++)c.newVar();
      const output=c[operation](...inputs);
      for(let row=0;row<8;row++) {
        const base=new Map([[1,true],[2,Boolean(row&1)],[3,Boolean(row&2)],[4,Boolean(row&4)]]);
        const args=inputs.map(literal=>base.get(Math.abs(literal))===(literal>0));
        const expected=operation==='and'?args.every(Boolean):operation==='or'?args.some(Boolean):operation==='iff'?args[0]===args[1]:!args[0]||args[1];
        let count=0;
        for(let aux=0;aux<2**(c.nvars-4);aux++) {
          const assignment=new Map(base);
          for(let v=5;v<=c.nvars;v++)assignment.set(v,Boolean(aux&(2**(v-5))));
          if(holds(c.clauses,assignment)) {
            count++;
            assert.equal(assignment.get(Math.abs(output))===(output>0),expected,`${operation} ${inputs}`);
          }
        }
        assert.equal(count,1,`${operation} ${inputs}`);
      }
    }
  }
});

test('clause simplification preserves literal validation and contradictions',()=>{
  const c=new Circuit(),a=c.newVar();
  c.addClause(a,-a);c.addClause(c.true);
  assert.deepEqual(c.clauses,[[1]]);
  c.addClause(c.false,a,a);assert.deepEqual(c.clauses.at(-1),[a]);
  for(const operation of ['addClause','and','or'])assert.throws(()=>c[operation](c.true,100),/literal/i);
  c.addClause();assert.equal(solve(c.nvars,c.clauses).status,'unsat');
});

test('solver handles empty, unit, duplicate and tautological clauses with complete assignments',()=>{
  assert.equal(solve(0,[]).status,'sat');
  assert.equal(solve(0,[[]]).status,'unsat');
  assert.equal(solve(1,[[1],[-1]]).status,'unsat');
  assert.deepEqual(solve(3,[[1],[-1,2],[-2,3]]).assignment,new Map([[1,true],[2,true],[3,true]]));
  assert.deepEqual(solve(3,[[1,-1]]).assignment,new Map([[1,false],[2,false],[3,false]]));
  assertMatches(4,[[1,1,1],[-1,2,2],[-2,-3,4],[-4,3]]);
});

test('all two-variable CNFs agree with exhaustive truth tables',()=>{
  const possible=[[]];
  for(const width of [1,2])for(const clause of combinations([1,-1,2,-2],width))if(!clause.some(literal=>clause.includes(-literal)))possible.push(clause);
  assert.equal(possible.length,9);
  for(let mask=0;mask<2**possible.length;mask++)assertMatches(2,possible.filter((_,i)=>mask&(2**i)));
});

test('every three-variable CNF with up to three distinct non-tautological clauses agrees',()=>{
  const clauses=[...tuples([-1,0,1],3)].map(signs=>signs.flatMap((sign,i)=>sign?[sign*(i+1)]:[]));
  for(let width=0;width<=3;width++)for(const formula of combinations(clauses,width))assertMatches(3,formula);
});

test('seeded mixed and three-SAT CNFs agree with an independent brute-force oracle',()=>{
  const random=rng(20261107);
  for(let n=1;n<=10;n++)for(let trial=0;trial<100;trial++) {
    const clauses=[];
    for(let i=0,count=random(7*n+1);i<count;i++) {
      const clause=[];
      for(let j=0,width=1+random(Math.min(5,n+1));j<width;j++)clause.push((1+random(n))*(random(2)?1:-1));
      clauses.push(clause);
    }
    assertMatches(n,clauses);
  }
});

test('watched propagation handles long unit chains without decisions',()=>{
  const clauses=[[1],...Array.from({length:4999},(_,i)=>[-i-1,i+2])];
  const result=solve(5000,clauses,{maxDecisions:0});
  assert.equal(result.status,'sat');assert.equal(result.decisions,0);
  assert.equal(result.assignment.size,5000);
  assert([...result.assignment.values()].every(Boolean));
});

test('pigeonhole contradiction exercises conflict learning, backtracking and restarts',()=>{
  const pigeons=7,holes=6,v=(p,h)=>p*holes+h+1;
  const clauses=Array.from({length:pigeons},(_,p)=>Array.from({length:holes},(_,h)=>v(p,h)));
  for(let h=0;h<holes;h++)for(let p=0;p<pigeons;p++)for(let q=p+1;q<pigeons;q++)clauses.push([-v(p,h),-v(q,h)]);
  const result=solve(pigeons*holes,clauses,{maxMilliseconds:10000});
  assert.equal(result.status,'unsat');
  assert(result.stats.conflicts>=100);
  assert(result.stats.restarts>=1);
});

test('activity underflow cannot remove occurring variables from branching',()=>{
  const solver=new _Solver(4,Infinity,20),clauses=[[1,2],[3,4]];
  for(const clause of clauses)solver.add([...clause]);
  for(let v=1;v<=4;v++){solver.activity[v]=1;solver.heap.push([-1,v]);}
  for(let i=0;i<4;i++){solver.increment=1e101;solver.bump(3);}
  assert.equal(solver.activity[1],0);assert.equal(solver.activity[2],0);
  const result=solver.run();assert.equal(result.status,'sat');assert(holds(clauses,result.assignment));
});

test('decision exhaustion is unknown, while zero decisions still permit unit proofs',()=>{
  for(const budget of [0,1,2]) {
    const result=solve(6,[[1,2],[3,4],[5,6]],{maxDecisions:budget});
    assert.equal(result.status,'unknown');assert.equal(result.decisions,budget);assert.equal(result.assignment.size,0);
  }
  assert.equal(solve(2,[[1],[-1,2]],{maxDecisions:0}).status,'sat');
  assert.equal(solve(1,[[1],[-1]],{maxDecisions:0}).status,'unsat');
});

test('expired budgets never allocate a huge solver or claim unsatisfiability',()=>{
  const result=solve(Number.MAX_SAFE_INTEGER,[],{maxMilliseconds:0});
  assert.equal(result.status,'unknown');assert.equal(result.assignment.size,0);
  assert.equal(solve(1,[[1],[-1]],{deadline:Date.now()-1}).status,'unknown');
});

test('time expiry during input and search stages always returns unknown',()=>{
  const originalNow=Date.now;
  let tick=0;
  try {
    Date.now=()=>tick;
    function *input(){yield[1];tick=2;yield[-1];}
    assert.equal(solve(1,input(),{maxMilliseconds:1}).status,'unknown');
    const clauses=[[1,2],[1,-2],[-1,2],[-1,-2]];
    for(const stage of ['propagate','analyze','backtrack','choose']) {
      tick=0;
      const original=_Solver.prototype[stage];
      let entered=false;
      _Solver.prototype[stage]=function(...args){entered=true;tick=2;return original.apply(this,args);};
      try {
        const result=solve(2,clauses,{maxMilliseconds:1});
        assert(entered,stage);assert.equal(result.status,'unknown',stage);assert.equal(result.assignment.size,0);
      }finally{_Solver.prototype[stage]=original;}
    }
  }finally{Date.now=originalNow;}
});

test('all public inputs are validated even after tautology or contradiction',()=>{
  for(const [nvars,clauses] of [[-1,[]],[1,[[0]]],[1,[[2]]],[1,[[true]]],[1,[[1,-1,0]]],[1,[[],[2]]],[1,[[1],[-1],[true]]]])assert.throws(()=>solve(nvars,clauses));
  for(const options of [{maxMilliseconds:-1},{maxMilliseconds:NaN},{maxMilliseconds:true},{maxDecisions:-1},{maxDecisions:0.5},{deadline:NaN},{onProgress:true}])assert.throws(()=>solve(1,[],options));
  assert.throws(()=>solve(1,null));assert.throws(()=>solve(1,[null]));
});

test('SAT solutions are deterministic and progress is compact data',()=>{
  const clauses=Array.from({length:100},(_,i)=>[i+1,i+101]);
  const first=solve(200,clauses),second=solve(200,clauses);
  assert.equal(first.status,'sat');assert.deepEqual(first.assignment,second.assignment);
  assert.equal(first.decisions,second.decisions);
});
