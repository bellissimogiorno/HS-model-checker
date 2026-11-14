import test from 'node:test';
import assert from 'node:assert/strict';
import {runExperiment} from '../src/experiment.mjs';

const model={format:'history-structure-model/v1',participants:['p'],values:['a'],signature:{events:[],predicates:[]},nodes:[],quorums:{a:[['p']]},facts:[]};
const source=`# Deadline certificate\n\n\`\`\`hsm-model\n${JSON.stringify(model)}\n\`\`\`\n\n\`\`\`hsm\naxiom Empty: true\nproperty Failure: false\n\`\`\`\n`;

test('certificate preparation cannot outlive the experiment deadline and report completion',async()=>{
  const originalNow=Date.now,originalClone=globalThis.structuredClone;
  try {
    for(const mode of ['synthesize','evaluate'])for(const modelOnly of [true,false]) {
      let clock=1000,certificates=0;
      Date.now=()=>clock;
      globalThis.structuredClone=function(value) {
        const cloned=originalClone(value);
        // Simulate certificate serialization using the remaining time. The
        // first model clone belongs to the consistency certificate; a second
        // belongs to a property counterexample certificate.
        if(value?.format==='history-structure-model/v1'&&new Error().stack.includes('at createEvidence')) {
          certificates++;
          if(certificates===(modelOnly?1:2))clock=2000;
        }
        return cloned;
      };
      const result=await runExperiment(source,{mode,maxMilliseconds:10,...(modelOnly?{selectedProperties:[]}:{})});
      assert.equal(certificates,modelOnly?1:2,`${mode}/${modelOnly}`);
      assert.equal(result.status,'incomplete',`${mode}/${modelOnly}`);
      assert.equal(result.complete,false,`${mode}/${modelOnly}`);
      assert.equal(result.consistency.consistent,true,'The earlier consistency certificate remains valid.');
      if(!modelOnly)assert.equal(result.properties[0].status,'counterexample','The already verified counterexample remains available.');
    }
  } finally {Date.now=originalNow;globalThis.structuredClone=originalClone;}
});
