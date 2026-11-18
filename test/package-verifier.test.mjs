import test from 'node:test';
import assert from 'node:assert/strict';
import {cp, mkdtemp, readFile, writeFile, rm, mkdir} from 'node:fs/promises';
import {join, resolve, relative, dirname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const ROOT = fileURLToPath(new URL('../',import.meta.url));
const VERIFY = fileURLToPath(new URL('../tools/verify-package.mjs',import.meta.url));
const SHA = value => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const directory = await mkdtemp(resolve(ROOT,'../.hsm-package-'));
  const root = join(directory,'independent-extraction');
  // Copy only named inputs rather than walking ROOT: parallel Python/CLI
  // tests can remove scratch directories between readdir and lstat.
  await mkdir(root,{recursive:true});
  const inputs=['src','test','tools','docs','assets','examples','reports','audit','templates',
    'VERSION','package.json','index.html','theories.html','README.md','LICENSE','UPSTREAM.md',
    'demo.mjs','serve.py','start.sh','PUBLICATION.json','PUBLIC_RELEASE.json',
    'sync_repo.py','generate_repo.py','make_handover.py'];
  for(const name of inputs) {
    try { await cp(join(ROOT,name),join(root,name),{recursive:true}); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
  }
  await rm(join(root,'MANIFEST.sha256'),{force:true});
  // Release metadata is written last by packaging. Tests exercise all actual
  // links with a harmless placeholder if packaging has not run yet.
  try { await readFile(join(root,'docs/VALIDATION.json')); }
  catch { await writeFile(join(root,'docs/VALIDATION.json'),'{}\n'); }
  return {root,cleanup:()=>rm(directory,{recursive:true,force:true})};
}

function run(root,...args) {
  return spawnSync(process.execPath,[VERIFY,'--root',root,...args],{cwd:dirname(ROOT),encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
}

test('package verification works against a fresh independent directory and reports its actual checks',async()=>{
  const {root,cleanup} = await fixture();
  try {
    const result = run(root);
    assert.equal(result.error,undefined);
    assert.equal(result.status,0,result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.status,'passed');assert.equal(report.version,'0.7.1');
    assert.equal(report.theories,31);assert.equal(report.offlineReader.theories,31);
    assert.equal(report.offlineReader.status,'current');assert.equal(report.semanticFingerprints,'verified');
    assert.equal(report.manifest.status,'not present');assert.equal(report.evidence.status,'not requested');
    assert(report.moduleSyntaxChecks>20);assert(report.htmlIds>100);assert(report.markdownLinks>30);
    assert.equal(report.browserRuntime,'not checked by this command');
  } finally { await cleanup(); }
});

test('package verification detects missing assets and stale generated reader bytes',async()=>{
  const {root,cleanup} = await fixture();
  try {
    const readerPath = join(root,'theories.html'), reader = await readFile(readerPath);
    await writeFile(readerPath,Buffer.concat([reader,Buffer.from('\n<!-- edited -->\n')]));
    let result = run(root);assert.equal(result.status,1);assert.match(result.stderr,/Offline reader is stale/);
    await writeFile(readerPath,reader);
    await rm(join(root,'assets/history-mono.woff'));
    result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/Missing package file.*history-mono\.woff/);
  } finally { await cleanup(); }
});

test('manifest verification rejects byte changes, duplicate paths and traversal without rejecting extra user output',async()=>{
  const {root,cleanup} = await fixture();
  try {
    const version = await readFile(join(root,'VERSION'));
    const manifest=join(root,'MANIFEST.sha256'), line=SHA(version)+'  VERSION\n';
    await writeFile(manifest,line);
    await writeFile(join(root,'my-output.json'),'{}\n');
    const backups=join(root,'.hsm-patches','fixture','originals','src');
    await mkdir(backups,{recursive:true});
    await writeFile(join(backups,'old.mjs'),"import './not-an-active-module.mjs';\n");
    const syncBackups=join(root,'.hsm-sync','fixture');
    await mkdir(syncBackups,{recursive:true});
    await writeFile(join(syncBackups,'old.mjs'),"import './not-an-active-module.mjs';\n");
    let result=run(root);assert.equal(result.status,0,result.stderr);
    let report=JSON.parse(result.stdout);assert.equal(report.manifest.verifiedFiles,1);assert(report.manifest.unlistedFiles.includes('my-output.json'));
    assert(!report.manifest.unlistedFiles.some(file=>file.startsWith('.hsm-patches/')),'undo bookkeeping is excluded from active release verification');
    assert(!report.manifest.unlistedFiles.some(file=>file.startsWith('.hsm-sync/')),'checkout-sync bookkeeping is excluded from active release verification');
    await writeFile(manifest,'0'.repeat(64)+'  VERSION\n');
    result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/checksum mismatch: VERSION/);
    await writeFile(manifest,line+line);
    result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/Duplicate manifest path: VERSION/);
    await writeFile(manifest,SHA(version)+'  ../outside\n');
    result=run(root);assert.equal(result.status,1);assert.match(result.stderr,/Unsafe manifest path/);
  } finally { await cleanup(); }
});

test('verification CLI rejects incomplete and unsupported requests',()=>{
  for(const args of [['--root'],['--unknown']]) {
    const result=spawnSync(process.execPath,[VERIFY,...args],{encoding:'utf8'});
    assert.equal(result.status,1);assert.match(result.stderr,/Usage:/);
  }
});

test('saved evidence verification replays a current source and rejects a stale source certificate',async()=>{
  const {root,cleanup} = await fixture();
  try {
    const {parseDocument}=await import(pathToFileURL(join(root,'src/document.mjs')).href);
    const {createEvidence}=await import(pathToFileURL(join(root,'src/experiment.mjs')).href);
    const source=await readFile(join(root,'examples/theories/hbb1.md'),'utf8'),doc=parseDocument(source);
    const evidence=createEvidence(doc,{mode:'evaluate',maxMilliseconds:60000,selectedProperties:[],droppedAxioms:[]},{witness:{model:doc.model}});
    const directory=join(root,'reports/weakening-tour/verifier-case');await mkdir(directory,{recursive:true});
    const evidencePath=join(directory,'model.evidence.json');await writeFile(evidencePath,JSON.stringify(evidence));
    const report={format:'history-structure-weakening-tour/v2',version:'0.7.1',status:'passed',cases:[{id:'verifier-case',complete:true,file:'examples/theories/hbb1.md',savedEvidence:['verifier-case/model.evidence.json']}],evidenceCount:1,verifiedEvidenceCount:1};
    await writeFile(join(root,'reports/weakening-tour/report.json'),JSON.stringify(report));
    let result=run(root,'--replay');assert.equal(result.status,0,result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).evidence,{status:'verified',verified:1,cases:1});
    await writeFile(evidencePath,JSON.stringify({...evidence,sourceMarkdown:source+'\nAn old or altered explanation.\n'}));
    result=run(root,'--replay');assert.equal(result.status,1);assert.match(result.stderr,/source\/release is stale/);
  } finally { await cleanup(); }
});
