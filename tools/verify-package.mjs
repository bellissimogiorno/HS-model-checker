#!/usr/bin/env node
/** Inspect the delivered package, not the author's checkout. This verifies
 * consistency and replayable witnesses; it is not browser or UNSAT proof QA. */
import {readFile, readdir, stat, realpath} from 'node:fs/promises';
import {resolve, dirname, relative, sep, isAbsolute, extname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const requireResult = (condition, message) => { if (!condition) throw new Error(message); };

async function inside(root, base, name, label = name) {
  requireResult(typeof name === 'string' && name.length > 0 && !isAbsolute(name) && !name.includes('\\'), `Unsafe package path: ${label}`);
  const target = resolve(base, name), local = relative(root, target);
  requireResult(local !== '..' && !local.startsWith('..' + sep) && !isAbsolute(local), `Path escapes package: ${label}`);
  let actual;
  try { actual = await realpath(target); } catch { throw new Error(`Missing package file: ${label}`); }
  const actualLocal = relative(root, actual);
  requireResult(actualLocal !== '..' && !actualLocal.startsWith('..' + sep) && !isAbsolute(actualLocal), `Linked path escapes package: ${label}`);
  return target;
}

async function filesWithin(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of (await readdir(directory, {withFileTypes: true})).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = resolve(directory, entry.name);
      requireResult(!entry.isSymbolicLink(), `Package contains a symbolic link: ${relative(root,file)}`);
      // Reversible directory patches keep originals/receipts here. They are
      // bookkeeping for undo, not another copy of the active runtime source.
      if (directory === root && ['.hsm-patches','.hsm-sync','.git','_site','node_modules','__pycache__'].includes(entry.name) && entry.isDirectory()) continue;
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
    }
  }
  await visit(root);
  return files;
}

function proseOnly(source) {
  // Respect fence character/length, including quoted examples with four ticks.
  const output = []; let fence = null;
  for (const line of source.split(/\r\n?|\n/)) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
    } else if (marker) fence = marker[1];
    else output.push(line.replace(/(`+)[\s\S]*?\1/g, ''));
  }
  return output.join('\n');
}

async function checkLink(root, base, raw, label) {
  let value = raw.trim().replace(/^<|>$/g, '');
  // Optional Markdown title is not part of the path.
  value = value.replace(/\s+["'][\s\S]*["']$/, '');
  if (!value || value.startsWith('#')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')) return false;
  const pathname = value.split(/[?#]/, 1)[0];
  if (!pathname) return false;
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { throw new Error(`Invalid encoded link: ${label}`); }
  await inside(root, base, decoded, label);
  return true;
}

function semanticContent(doc) {
  return {name: doc.name, model: doc.model, includeLive: doc.includeLive,
    axioms: doc.axioms.map(({name,kind,ast}) => ({name,kind,ast})),
    properties: doc.properties.map(({name,scope,ast}) => ({name,scope,ast}))};
}

/** Extra user files are listed, not rejected. Every manifest-listed release
 * file must still exist and match its recorded bytes. */
async function checkManifest(root, files) {
  const path = resolve(root,'MANIFEST.sha256');
  if (!files.includes(path)) return {status: 'not present', verifiedFiles: 0};
  const entries = new Set();
  for (const line of (await readFile(path,'utf8')).split(/\r?\n/).filter(Boolean)) {
    const match = line.match(/^([a-f0-9]{64})  (.+)$/);
    requireResult(match, 'Malformed MANIFEST.sha256 entry.');
    const [, expected, name] = match;
    requireResult(!name.split('/').some(part => part === '..' || part === '.' || !part), `Unsafe manifest path: ${name}`);
    requireResult(!entries.has(name), `Duplicate manifest path: ${name}`);
    requireResult(name !== 'MANIFEST.sha256', 'Manifest must not include itself.');
    entries.add(name);
    const file = await inside(root, root, name);
    requireResult((await stat(file)).isFile(), `Manifest path is not a file: ${name}`);
    requireResult(digest(await readFile(file)) === expected, `Manifest checksum mismatch: ${name}`);
  }
  requireResult(entries.size > 0, 'Manifest must not be empty.');
  const extras = files.map(file => relative(root,file).split(sep).join('/')).filter(name => name !== 'MANIFEST.sha256' && !entries.has(name));
  return {status: 'verified', verifiedFiles: entries.size, unlistedFiles: extras};
}

export async function verifyPackage({root = ROOT, replay = false} = {}) {
  root = await realpath(resolve(root));
  const files = await filesWithin(root);
  const version = (await readFile(resolve(root,'VERSION'),'utf8')).trim();
  const packageInfo = JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
  requireResult(version === packageInfo.version, 'VERSION and package.json disagree.');
  requireResult(/^\d+\.\d+\.\d+$/.test(version), 'Release version must be semantic x.y.z.');

  let imports = 0, assets = 0, links = 0;
  const modules = files.filter(file => extname(file) === '.mjs' && (relative(root,file).startsWith('src' + sep) || relative(root,file).startsWith('tools' + sep) || file === resolve(root,'demo.mjs')));
  for (const file of modules) {
    const source = await readFile(file,'utf8');
    const syntax = spawnSync(process.execPath, ['--check',file], {encoding:'utf8', maxBuffer:1024*1024});
    requireResult(!syntax.error && syntax.status === 0, `Module syntax check failed: ${relative(root,file)}${syntax.stderr ? '\n'+syntax.stderr.trim() : ''}`);
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"](\.[^'"\n]+)['"]/g)) {
      await inside(root, dirname(file), match[1], `${relative(root,file)} → ${match[1]}`); imports++;
    }
  }
  const html = await readFile(resolve(root,'index.html'),'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  requireResult(new Set(ids).size === ids.length, 'index.html has duplicate element IDs.');
  const idSet = new Set(ids), app = await readFile(resolve(root,'src/app.mjs'),'utf8');
  const referencedIds = new Set([...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(match => match[1]));
  for (const id of referencedIds) requireResult(idSet.has(id), `Application references missing HTML element #${id}.`);
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) if (await checkLink(root, root, match[1], `index.html → ${match[1]}`)) assets++;
  for (const file of files.filter(file => extname(file) === '.css')) {
    for (const match of (await readFile(file,'utf8')).matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
      if (await checkLink(root, dirname(file), match[1], `${relative(root,file)} → ${match[1]}`)) assets++;
    }
  }
  // Public templates resolve relative links after export, where they replace
  // the root README and guides. Verify those links in the exported package.
  for (const file of files.filter(file => extname(file) === '.md' && !relative(root,file).startsWith('templates' + sep))) {
    for (const match of proseOnly(await readFile(file,'utf8')).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if (await checkLink(root, dirname(file), match[1], `${relative(root,file)} → ${match[1]}`)) links++;
    }
  }

  const url = name => pathToFileURL(resolve(root,name)).href;
  const [{parseDocument}, {unicodeFormula}, {EXAMPLES}] = await Promise.all([
    import(url('src/document.mjs')), import(url('src/notation.mjs')), import(url('src/example-catalog.mjs'))
  ]);
  const names = (await readdir(resolve(root,'examples/theories'))).filter(name => name.endsWith('.md')).sort();
  const catalog = EXAMPLES.map(example => example.file).sort();
  requireResult(new Set(catalog).size === catalog.length && JSON.stringify(names) === JSON.stringify(catalog), 'Theory files and the canonical example catalog disagree.');
  const preservationPath = resolve(root,'docs/THEORY-FINGERPRINTS.json');
  const preservation = JSON.parse(await readFile(preservationPath,'utf8'));
  requireResult(preservation.files && typeof preservation.files === 'object', 'Expected semantic fingerprints in the preservation record.');
  const fingerprints = new Map();
  if (Array.isArray(preservation.files)) {
    for (const entry of preservation.files) {
      requireResult(entry && typeof entry.file === 'string' && entry.unchanged === true && /^[a-f0-9]{64}$/.test(entry.semanticSha256), 'Malformed semantic preservation entry.');
      requireResult(!fingerprints.has(entry.file), `Duplicate semantic preservation entry: ${entry.file}`);
      fingerprints.set(entry.file,entry);
    }
  } else {
    for (const [file,semanticSha256] of Object.entries(preservation.files)) {
      requireResult(/^[a-f0-9]{64}$/.test(semanticSha256), `Malformed semantic preservation digest: ${file}`);
      fingerprints.set(file,{semanticSha256});
    }
  }
  requireResult(JSON.stringify([...fingerprints.keys()].sort()) === JSON.stringify(names), 'Semantic preservation record does not cover exactly the shipped theories.');
  let declarations = 0;
  for (const name of names) {
    const source = await readFile(resolve(root,'examples/theories',name),'utf8'), doc = parseDocument(source);
    requireResult(/Implementation authorship:.*AI-generated following prompts by Murdoch J\. Gabbay/.test(source), `Theory lacks implementation provenance: ${name}`);
    requireResult(/Murdoch J\. Gabbay and Isaac Sheff/.test(source), `Theory lacks separate paper authorship: ${name}`);
    const expected = fingerprints.get(name);
    requireResult(digest(JSON.stringify(semanticContent(doc))) === expected.semanticSha256, `Theory mathematical fingerprint changed: ${name}`);
    if (expected.currentSourceSha256) requireResult(digest(source) === expected.currentSourceSha256, `Theory source preservation record is stale: ${name}`);
    for (const row of [...doc.axioms,...doc.properties]) {
      requireResult(unicodeFormula(row.formula) === row.formula, `Theory formula is not Unicode-normalized: ${name}/${row.name}`); declarations++;
    }
  }
  const {buildReader} = await import(url('tools/build-reader.mjs'));
  const reader = await buildReader({root,check:true});
  const manifest = await checkManifest(root,files);
  let evidence = {status:'not requested', verified:0};
  if (replay) {
    const {replayExperiment} = await import(url('src/experiment.mjs'));
    const reportRoot = resolve(root,'reports/weakening-tour');
    const report = JSON.parse(await readFile(resolve(reportRoot,'report.json'),'utf8'));
    requireResult(report.format === 'history-structure-weakening-tour/v2' && report.status === 'passed', 'Bundled tour is not a passed v2 report.');
    requireResult(report.version === version, 'Bundled tour belongs to a different release. Regenerate the report.');
    requireResult(Array.isArray(report.cases), 'Bundled tour cases must be an array.');
    const seen = new Set(); let verified = 0;
    for (const row of report.cases) {
      requireResult(row.complete === true && Array.isArray(row.savedEvidence), `Incomplete/malformed tour case: ${row.id}`);
      const sourceFile = await inside(root,root,row.file,`tour source ${row.file}`);
      const source = await readFile(sourceFile,'utf8');
      for (const name of row.savedEvidence) {
        requireResult(!seen.has(name), `Duplicate saved evidence path: ${name}`); seen.add(name);
        const file = await inside(root,reportRoot,name,`saved evidence ${name}`);
        const certificate = JSON.parse(await readFile(file,'utf8'));
        requireResult(certificate.version === version && certificate.sourceMarkdown === source, `Saved certificate source/release is stale: ${name}`);
        const result = replayExperiment(certificate,{maxMilliseconds:60000});
        requireResult(result.verified === true && result.assumptions?.complete === true && result.assumptions?.holds === true && result.assumptions?.includeLive === true, `Saved certificate did not replay with complete retained ThyLive: ${name}`);
        verified++;
      }
    }
    requireResult(verified === report.evidenceCount && verified === report.verifiedEvidenceCount, 'Tour certificate counts disagree with saved evidence.');
    requireResult(verified > 0, 'Tour contains no saved evidence.');
    evidence = {status:'verified', verified, cases:report.cases.length};
  }
  return {status:'passed',version,root,moduleSyntaxChecks:modules.length,localImports:imports,htmlIds:ids.length,htmlIdReferences:referencedIds.size,localAssets:assets,markdownLinks:links,theories:names.length,declarations,semanticFingerprints:'verified',offlineReader:{status:'current',theories:reader.theories,bytes:reader.bytes},manifest,evidence,browserRuntime:'not checked by this command'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2); let root = ROOT, replay = false;
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--root' && args[index+1]) root = resolve(args[++index]);
      else if (args[index] === '--replay') replay = true;
      else throw new Error('Usage: node tools/verify-package.mjs [--root DIR] [--replay]');
    }
    console.log(JSON.stringify(await verifyPackage({root,replay}),null,2));
  } catch (error) { console.error(`Package verification failed: ${error.message}`); process.exitCode = 1; }
}
