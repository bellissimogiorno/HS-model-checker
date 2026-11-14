/** Editable protocols can include the full model-dependent ThyLive schemes.
 * A flat array is a literal finite theory. The wrapper {includeLive:true,axioms}
 * preserves the infinite scheme's exact finite reduction as models change. */
import {compileModel} from './model.mjs';
import {parseFormula} from './parser.mjs';
import {Evaluator,EvaluationLimitError} from './evaluator.mjs';
import {checkTheory} from './theories.mjs';

export function customTheorySpec(spec) {
  const wrapper=Array.isArray(spec)?{includeLive:false,axioms:spec}:spec;
  if (!wrapper || typeof wrapper!=='object' || !Array.isArray(wrapper.axioms)) throw new Error('Custom theory must be an axiom array or {includeLive:boolean,axioms:[...]}.');
  for (const key of Object.keys(wrapper)) if (!['includeLive','axioms'].includes(key)) throw new Error(`Unknown custom theory field ${key}.`);
  if (wrapper.includeLive!==undefined && typeof wrapper.includeLive!=='boolean') throw new Error('includeLive must be true or false.');
  const names=new Set();
  const axioms=wrapper.axioms.map((a,i)=>{
    if (!a || typeof a!=='object' || Array.isArray(a) || typeof a.name!=='string' || !a.name.trim() || /[\r\n]/.test(a.name) || typeof a.formula!=='string') throw new Error(`Custom axiom ${i+1} needs a nonempty single-line name and a formula string.`);
    for (const key of Object.keys(a)) if (!['name','formula','kind'].includes(key)) throw new Error(`Custom axiom ${a.name} has unknown field ${key}.`);
    if (names.has(a.name)) throw new Error(`Duplicate custom axiom name ${a.name}.`);
    if (a.name==='ThyLive') throw new Error('ThyLive is reserved for the dynamic include; choose another axiom name.');
    if (a.kind!==undefined&&!['backward','forward','other'].includes(a.kind)) throw new Error(`Custom axiom ${a.name} direction must be backward, forward or other.`);
    names.add(a.name);
    return {...a,ast:parseFormula(a.formula)};
  });
  return {includeLive:wrapper.includeLive??false,axioms};
}

export function checkCustomTheory(input,spec,options={}) {
  const started=Date.now();
  const model=input?.quorums instanceof Map?input:compileModel(input);
  const parsed=customTheorySpec(spec);
  const maxMilliseconds=options.maxMilliseconds??15000;
  const maxSteps=options.maxSteps??5000000;
  // Constructor validates budgets even for an empty custom theory.
  new Evaluator(model,{...options,maxMilliseconds,maxSteps});
  let steps=0,complete=true,reason;
  const axioms=[];
  if (parsed.includeLive) {
    const remaining=maxMilliseconds-(Date.now()-started);
    if (remaining<=0) {complete=false;reason='Time budget reached while preparing custom theory.';}
    else {
      const live=checkTheory(model,'ThyLive',{...options,maxMilliseconds:remaining,maxSteps});
      const includedNames=new Set(live.axioms.map(a=>a.name));
      for(const axiom of parsed.axioms) if(includedNames.has(axiom.name)) throw new Error(`Custom axiom ${axiom.name} duplicates an included ThyLive axiom.`);
      axioms.push(...live.axioms);
      steps+=live.stats.steps;
      complete=live.complete;
      reason=live.reason;
    }
  }
  for (const axiom of parsed.axioms) {
    const remaining=maxMilliseconds-(Date.now()-started);
    if (remaining<=0 || steps>=maxSteps) {
      complete=false;
      reason??='Custom theory evaluation resource budget reached.';
      axioms.push({...axiom,holds:null,complete:false,failures:[],error:reason});
      continue;
    }
    try {
      const evaluator=new Evaluator(model,{...options,maxMilliseconds:remaining,maxSteps:maxSteps-steps});
      const checked=evaluator.check(axiom.ast,{scope:'all',maxFailures:options.maxFailures??3});
      steps+=checked.stats.steps;
      axioms.push({...axiom,...checked});
    } catch(error) {
      if (!(error instanceof EvaluationLimitError)) throw error;
      complete=false;
      reason??=error.message;
      steps+=error.stats?.steps??0;
      axioms.push({...axiom,holds:null,complete:false,failures:[],error:error.message});
    }
  }
  return {name:'Custom theory',holds:axioms.some(a=>a.holds===false)?false:complete?true:null,complete,reason,includeLive:parsed.includeLive,axioms,
    counts:{total:axioms.length,passed:axioms.filter(a=>a.holds===true).length,failed:axioms.filter(a=>a.holds===false).length,inconclusive:axioms.filter(a=>a.holds===null).length},stats:{steps,elapsedMs:Date.now()-started}};
}
