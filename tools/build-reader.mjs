#!/usr/bin/env node
/** Reproducibly build the standalone theory reader from current sources.
 *
 * From the package directory:
 *   node tools/build-reader.mjs          write theories.html
 *   node tools/build-reader.mjs --check  verify it without changing any files
 *
 * The script also works from another current directory when invoked by its
 * full path. It reads VERSION, the bundled font, and every curated Markdown
 * theory named in src/example-catalog.mjs. Parsing validates each source, then
 * the shared renderer produces one self-contained HTML file that can be opened
 * directly without a server or network. It does not run the model-checker.
 *
 * Regenerate after changing theory sources, catalog descriptions, notation,
 * reader rendering or VERSION. --check exits nonzero for a missing/stale reader;
 * it never repairs the file implicitly. Node 20+ is required; no npm install.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname, relative, isAbsolute, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseDocument} from '../src/document.mjs';
import {asciiFormula} from '../src/notation.mjs';
import {EXAMPLES, EXAMPLE_GROUPS} from '../src/example-catalog.mjs';
import {createReaderPage} from '../src/reader-page.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export async function loadReaderData(root = ROOT) {
  const version = (await readFile(resolve(root,'VERSION'),'utf8')).trim();
  const fontBase64 = (await readFile(resolve(root,'assets/history-mono.woff'))).toString('base64');
  const directory = resolve(root,'examples/theories');
  const files = new Set();
  const theories = [];
  for (const [index, example] of EXAMPLES.entries()) {
    if (typeof example.file !== 'string' || files.has(example.file)) throw new Error('Reader catalog filenames must be unique strings.');
    files.add(example.file);
    const file = resolve(directory,example.file), local = relative(directory,file);
    if (!local || isAbsolute(local) || local === '..' || local.startsWith('..'+sep) || resolve(file) === directory) throw new Error('Reader source escapes the theory directory.');
    if (!EXAMPLE_GROUPS.includes(example.group)) throw new Error('Reader source has an unknown group.');
    const source = await readFile(file,'utf8');
    const doc = parseDocument(source);
    const declarations = [
      ...doc.axioms.map(row => ({type:'axiom',name:row.name,kind:row.kind,formula:row.formula,line:row.line})),
      ...doc.properties.map(row => ({type:'property',name:row.name,scope:row.scope,formula:row.formula,line:row.line}))
    ].sort((a,b) => a.line-b.line);
    theories.push({
      id:`theory-${index+1}`,file:example.file,group:example.group,label:example.label,description:example.description,
      title:doc.name,source,sourceSha256:createHash('sha256').update(source).digest('hex'),
      includeLive:doc.includeLive,axiomCount:doc.axioms.length,propertyCount:doc.properties.length,declarations,
      // The runtime searches the exact source too. Only the alternative
      // formula spellings need an additional index; do not duplicate the JSON.
      searchText:declarations.map(row=>asciiFormula(row.formula)).join('\n')
    });
  }
  return {version,groups:EXAMPLE_GROUPS,theories,fontBase64};
}

export async function buildReader({root=ROOT,check=false}={}) {
  const data = await loadReaderData(root);
  const html = createReaderPage(data);
  const output = resolve(root,'theories.html');
  if (check) {
    let existing;
    try { existing = await readFile(output,'utf8'); }
    catch { throw new Error('Offline reader is missing. Run node tools/build-reader.mjs.'); }
    if (existing !== html) throw new Error('Offline reader is stale. Run node tools/build-reader.mjs.');
  } else await writeFile(output,html);
  return {file:output,theories:data.theories.length,bytes:Buffer.byteLength(html),check};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2);
    if (args.length===1 && ['--help','-h'].includes(args[0])) {
      console.log('Usage: node tools/build-reader.mjs [--check]\n\nWithout options, rebuild theories.html from the current curated Markdown sources.\nUse --check to verify the generated file without writing; a stale or missing\nreader gives a nonzero exit status. Run after changing sources, catalog,\nnotation, rendering or VERSION. The output opens directly without a server.\n\nExamples:\n  node tools/build-reader.mjs\n  node tools/build-reader.mjs --check\n\nThe command is rooted at its package, so it also works from another directory.\nIt requires Node 20+ and runs no solver or network request.');
      process.exitCode=0;
    } else {
      if (args.length>1 || args.some(arg=>arg!=='--check')) throw new Error('Usage: node tools/build-reader.mjs [--check]');
      const result=await buildReader({check:args.includes('--check')});
      console.log(`${result.check?'Verified':'Built'} theories.html: ${result.theories} theories, ${result.bytes} bytes.`);
    }
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
