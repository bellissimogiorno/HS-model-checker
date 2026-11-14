import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runExperiment} from '../src/experiment.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const cli=join(root,'src/cli.mjs'),sourcePath=join(root,'examples/theories/first-steps.md');
const invoke=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8',timeout:30000});

test('CLI step limits constrain both supplied-model checks and synthesized witness verification',()=>{
  for(const mode of ['evaluate','synthesize']) {
    const result=invoke('run',sourcePath,'--mode',mode,'--steps','1');
    assert.equal(result.status,2,result.stderr);
    assert.equal(JSON.parse(result.stdout).status,'incomplete');
  }
  const bad=invoke('run',sourcePath,'--steps','0');
  assert.equal(bad.status,2);assert.match(bad.stderr,/maxSteps/);
});

test('CLI replay budgets are local work limits and do not rewrite the saved request',async()=>{
  const directory=await mkdtemp(join(root,'.cli-step-limits-'));
  try {
    const source=await readFile(sourcePath,'utf8'),run=await runExperiment(source,{maxMilliseconds:30000});
    const evidence=run.properties[0].evidence,path=join(directory,'evidence.json');
    await writeFile(path,JSON.stringify(evidence));
    const tiny=invoke('replay',path,'--steps','1');
    assert.equal(tiny.status,2,tiny.stderr);assert.equal(JSON.parse(tiny.stdout).status,'incomplete');
    const enough=invoke('replay',path,'--steps','1000000');
    assert.equal(enough.status,0,enough.stderr);assert.equal(JSON.parse(enough.stdout).verified,true);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),evidence);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
