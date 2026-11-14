import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {EXAMPLES,EXAMPLE_GROUPS,DEFAULT_EXAMPLE_OPTIONS,exampleOptions} from '../src/example-catalog.mjs';
import {parseDocument,selectTheory} from '../src/document.mjs';

test('curated catalog exposes every theory source once in a named group',async()=>{
  const files=(await readdir(new URL('../examples/theories/',import.meta.url))).filter(file=>file.endsWith('.md')).sort();
  assert.deepEqual(EXAMPLES.map(example=>example.file).sort(),files);
  assert.equal(new Set(EXAMPLES.map(example=>example.file)).size,EXAMPLES.length);
  assert.deepEqual(EXAMPLE_GROUPS,['Getting started','HBB1','HBB2','HBB3','Quorum diagnostics']);
  for(const example of EXAMPLES) {
    assert.ok(EXAMPLE_GROUPS.includes(example.group),example.file);
    assert.ok(example.label.length>0&&example.label.length<90,example.file);
    assert.match(example.description,/(?:Figures?|Definition|Lemma|Remark|Proposition|Section) \d/,example.file);
    const source=await readFile(new URL('../examples/theories/'+example.file,import.meta.url),'utf8');
    const options=exampleOptions(example.file),doc=parseDocument(source),selection=selectTheory(doc,options);
    assert.deepEqual(selection.droppedAxioms,options.droppedAxioms,example.file+': named preset omissions are real declarations');
    assert.ok(!options.droppedAxioms.includes('ThyLive'),example.file+': curated weakening retains complete liveness');
    if(options.selectedProperties)assert.deepEqual(selection.properties.map(p=>p.name),options.selectedProperties,example.file+': explicit default claims exist');
  }
});

test('catalog compilation budgets cover the maximum requested by each file manifest',async()=>{
  const maximum=new Map();
  for(const manifest of ['hbb1-cases.json','hbb3-cases.json','weakening-cases.json']) {
    const {cases}=JSON.parse(await readFile(new URL('../examples/'+manifest,import.meta.url),'utf8'));
    for(const spec of cases) {
      assert.ok(EXAMPLES.some(example=>example.file===spec.file),spec.file);
      maximum.set(spec.file,Math.max(maximum.get(spec.file)??0,spec.maxCompilationNodes??DEFAULT_EXAMPLE_OPTIONS.maxCompilationNodes));
    }
  }
  for(const [file,budget] of maximum) {
    const options=exampleOptions(file);
    assert.equal(options.maxCompilationNodes,budget,file);
    if(budget>500000){assert.ok(options.maxCompilationNodes>=1000000,file);assert.ok(options.maxMilliseconds>=60000,file);}
  }
  const original=exampleOptions('hbb3-three-twined.md');
  const changed=exampleOptions('hbb3-three-twined.md');changed.droppedAxioms.push('CorrTran');changed.maxCompilationNodes=1;
  assert.deepEqual(exampleOptions('first-steps.md'),DEFAULT_EXAMPLE_OPTIONS);
  assert.deepEqual(exampleOptions('hbb3-three-twined.md'),original,'editing one returned options object cannot mutate the preset');
  const probes=exampleOptions('hbb1-echo-choice.md'),expected=structuredClone(probes);
  probes.selectedProperties.push('Bad Echo!');
  assert.deepEqual(exampleOptions('hbb1-echo-choice.md'),expected,'default property arrays are owned by each returned options object');
});
