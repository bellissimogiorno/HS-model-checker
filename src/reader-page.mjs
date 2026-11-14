/** Generate a standalone reader from validated executable theory metadata.
 * This module shares the application's safe Markdown renderer. The resulting
 * HTML needs no runtime imports, fetches, server, build tools or remote assets.
 */
import {renderTheoryMarkdown} from './theory-presentation.mjs';
import {unicodeTheorySource} from './notation.mjs';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const jsonForHTML = value => JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, char => ({
  '<':'\\u003c', '>':'\\u003e', '&':'\\u0026', '\u2028':'\\u2028', '\u2029':'\\u2029'
})[char]);

// Authored source is data, never JavaScript. Keep this runtime independent of
// the checker: a local file reader must not imply that it ran any solver.
export function readerRuntime() {
  const data = JSON.parse(document.getElementById('reader-data').textContent);
  const search = document.getElementById('readerSearch');
  const count = document.getElementById('readerCount');
  const empty = document.getElementById('readerEmpty');
  const previous = document.getElementById('readerPrevious');
  const next = document.getElementById('readerNext');
  const records = data.theories.map(record => ({
    ...record,
    article: document.getElementById(record.id),
    link: document.querySelector('[data-theory-link="' + record.id + '"]'),
    normalized: [record.group,record.file,record.label,record.description,record.title,record.source,record.searchText].join('\n').normalize('NFKC').toLowerCase()
  }));
  const byId = new Map(records.map(record => [record.id, record]));
  let matches = records;
  let selected = records[0]?.id ?? null;

  function updateSelection(id, target) {
    const record = byId.get(id);
    if (!record) return;
    selected = id;
    for (const row of records) {
      row.article.hidden = row.id !== id;
      if (row.id === id) row.link.setAttribute('aria-current', 'page');
      else row.link.removeAttribute('aria-current');
    }
    empty.hidden = true;
    const index = matches.findIndex(row => row.id === selected);
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index >= matches.length - 1;
    if (target) {
      const node = document.getElementById(target);
      if (node) requestAnimationFrame(() => node.scrollIntoView({block: 'start'}));
    }
  }

  function locationSelection() {
    const hash = location.hash.slice(1);
    const match = hash.match(/^(theory-\d+)(?:-line-\d+)?$/);
    if (match && byId.has(match[1])) {
      // A direct link to a filtered-out theory clears the filter explicitly.
      if (!matches.some(row => row.id === match[1])) {
        search.value = '';
        filter(false);
      }
      updateSelection(match[1], hash);
    } else if (selected) updateSelection(selected);
  }

  function filter(choose = true) {
    const terms = search.value.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
    matches = records.filter(row => terms.every(term => row.normalized.includes(term)));
    const visible = new Set(matches.map(row => row.id));
    for (const row of records) row.link.parentElement.hidden = !visible.has(row.id);
    for (const group of document.querySelectorAll('[data-reader-group]')) {
      const hasMatch = records.some(row => row.group === group.dataset.readerGroup && visible.has(row.id));
      group.hidden = !hasMatch;
    }
    count.textContent = matches.length + ' of ' + records.length + ' theories';
    if (!matches.length) {
      for (const row of records) row.article.hidden = true;
      empty.hidden = false;
      previous.disabled = next.disabled = true;
      return;
    }
    if (choose) updateSelection(visible.has(selected) ? selected : matches[0].id);
  }

  function step(delta) {
    const index = matches.findIndex(row => row.id === selected);
    const row = matches[index + delta];
    if (row) location.hash = row.id;
  }

  search.addEventListener('input', () => filter());
  document.getElementById('readerClear').addEventListener('click', () => {
    search.value = ''; filter(); search.focus();
  });
  previous.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  for (const button of document.querySelectorAll('[data-source-download]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const record = byId.get(button.dataset.sourceDownload);
      if (!record) return;
      const url = URL.createObjectURL(new Blob([record.source], {type: 'text/markdown;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = record.file.split('/').at(-1);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  window.addEventListener('hashchange', locationSelection);
  filter(false);
  locationSelection();
  document.getElementById('readerSearchTools').hidden = false;
  document.getElementById('readerControls').hidden = false;
}

const readerCSS = `
@font-face{font-family:"History Mono";src:url(data:font/woff;base64,FONT_DATA) format("woff");font-weight:400;font-style:normal;font-display:swap}
:root{color-scheme:light;--ink:#192435;--muted:#536278;--blue:#2457d6;--line:#e0e6ef;--wash:#f5f8fd;--mono:"History Mono","DejaVu Sans Mono",ui-monospace,Consolas,monospace;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:#fff}
*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0}a{color:var(--blue);text-underline-offset:4px}button,input{font:inherit}button{cursor:pointer}button:disabled{cursor:default;opacity:.5}button,a,input,summary{touch-action:manipulation}:focus-visible{outline:3px solid var(--blue);outline-offset:4px}
.reader-header,.reader-layout,.reader-footer{width:min(1420px,calc(100% - 64px));margin-inline:auto}.reader-header{padding:32px 0 24px;border-bottom:1px solid var(--line)}.reader-brand{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}.reader-title{display:flex;align-items:center;gap:10px;min-width:0}.brand-mark{display:grid;place-items:center;flex:none;width:4.5rem;height:2.625rem;border-radius:.5625rem;background:var(--blue);color:white;font-family:ui-sans-serif,system-ui,sans-serif;font-size:1.05rem;font-weight:700;line-height:1;letter-spacing:0}.reader-brand h1{min-width:0;overflow-wrap:anywhere;margin:0;font-size:1.5rem;line-height:1.3;letter-spacing:-.025em}.reader-header p{max-width:90ch;margin:12px 0 0}.reader-meta{font-size:.875rem;color:var(--muted)}.reader-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:36px;align-items:start;padding-block:28px}.reader-navigation{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto;padding:4px 10px 12px 0}.reader-navigation label{display:block;font-weight:600}#readerSearch{width:100%;margin-top:8px;padding:10px 12px;border:1px solid #8594a9;border-radius:6px;background:#fff;color:var(--ink)}.reader-search-actions{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin:6px 0 20px}#readerCount{font-size:.875rem;color:var(--muted)}.reader-text-button{border:0;background:none;color:var(--blue);padding:8px 0;font-weight:600}.reader-navigation h2{font-size:1rem;margin:20px 0 8px}.reader-navigation ul{list-style:none;padding:0;margin:0}.reader-navigation li{margin:0 0 4px}.reader-navigation a{display:block;padding:8px 10px;border-radius:6px;text-decoration:none;color:var(--ink);font-size:.9375rem}.reader-navigation a:hover{background:var(--wash)}.reader-navigation a[aria-current]{background:#edf3ff;color:#1744b5;font-weight:600}.reader-main{min-width:0}#readerControls{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin:0 0 20px}#readerControls .reader-button{flex:1 1 10rem;min-width:0}.reader-button{max-width:100%;overflow-wrap:anywhere;display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:8px 14px;border:1px solid #8594a9;border-radius:6px;background:#fff;color:var(--ink);font-weight:600;text-decoration:none}.reader-button:hover:not(:disabled){background:var(--wash)}.reader-theory{scroll-margin-top:20px;min-width:0;border:1px solid var(--line);border-radius:8px;padding:26px 30px;margin-bottom:24px}.reader-theory > header{margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid var(--line)}.reader-theory > header p{margin:0 0 10px;color:var(--muted)}.reader-source-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px}.reader-checksum{font-family:var(--mono);font-size:.8125rem;overflow-wrap:anywhere;color:var(--muted);margin-top:12px}.reader-declarations{margin-top:16px}.reader-declarations summary{font-weight:600;cursor:pointer;min-height:40px;padding:8px 0}.reader-declarations table{width:100%;border-collapse:collapse;font-size:.875rem}.reader-declarations th,.reader-declarations td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line)}.reader-declarations th{font-weight:600}.reader-declarations a{font-family:var(--mono)}.reader-declarations .reader-table-wrap{overflow-x:auto}.reader-main noscript{display:block;margin-bottom:20px;padding:14px;background:var(--wash)}.reader-footer{font-size:.875rem;color:var(--muted);padding:20px 0;border-top:1px solid var(--line)}
.theory-reader h1{font-size:1.6rem;line-height:1.3;letter-spacing:-.025em;margin:0 0 20px}.theory-reader h2{font-size:1.2rem;line-height:1.4;margin:32px 0 12px;padding-top:16px;border-top:1px solid var(--line)}.theory-reader h3,.theory-reader h4,.theory-reader h5,.theory-reader h6{font-size:1rem;line-height:1.5;margin:24px 0 10px}.theory-reader p,.theory-reader ul,.theory-reader ol,.theory-reader blockquote{margin:0 0 16px;max-width:82ch}.theory-reader ul,.theory-reader ol{padding-left:24px}.theory-reader li+li{margin-top:5px}.theory-reader blockquote{border-left:3px solid var(--line);padding:4px 0 4px 18px;color:var(--muted)}.theory-reader :not(pre)>code{font-family:var(--mono);font-size:.94em;padding:2px 4px;border-radius:3px;background:var(--wash)}.theory-reader pre{margin:0 0 18px;padding:16px 18px;border:1px solid var(--line);border-radius:6px;background:var(--wash);font:400 .94rem/1.8 var(--mono);font-variant-ligatures:none;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}.theory-reader pre code{font:inherit}.theory-table{max-width:100%;overflow-x:auto;margin-bottom:18px}.theory-table table{border-collapse:collapse}.theory-table th,.theory-table td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left}.theory-model-block{margin:24px 0 4px;border-top:1px solid var(--line)}.theory-model-block>summary{cursor:pointer;color:var(--blue);font-weight:600;min-height:44px;padding:10px 0}.theory-model-block pre{max-height:480px;overflow:auto;white-space:pre}.theory-code-block{scroll-margin-top:20px}.tok-keyword,.tok-heading{color:#1744b5}.tok-operator{color:#713b91}.tok-name{color:#086477}.tok-string{color:#236241}.tok-comment,.tok-meta{color:#596579}.tok-number{color:#815020}.tok-punctuation{color:#536278}
@media(max-width:900px){.reader-header,.reader-layout,.reader-footer{width:calc(100% - 32px)}.reader-layout{grid-template-columns:220px minmax(0,1fr);gap:20px}.reader-theory{padding:22px 20px}}
@media(max-width:680px){.reader-layout{display:block;padding-top:16px}.reader-navigation{position:static;max-height:310px;margin-bottom:24px;padding-right:6px;border-bottom:1px solid var(--line)}.reader-navigation h2{margin-top:14px}.reader-theory{padding:20px 14px}.theory-reader pre{padding:12px}.reader-brand h1{font-size:1.3rem}.reader-declarations th,.reader-declarations td{padding:6px}.reader-header{padding-top:22px}}
@media(forced-colors:active){.tok-keyword,.tok-heading,.tok-operator,.tok-name,.tok-string,.tok-comment,.tok-meta,.tok-number,.tok-punctuation{color:CanvasText}.reader-navigation a[aria-current]{outline:1px solid Highlight}.brand-mark{border:1px solid CanvasText;background:Canvas;color:CanvasText}}
@media print{.reader-navigation,#readerControls,.reader-source-actions,.reader-declarations,.reader-header .reader-button{display:none!important}.reader-layout{display:block;width:100%;padding:0}.reader-header,.reader-footer{width:100%}.reader-theory{border:0;padding:0;break-before:page}.reader-theory:first-of-type{break-before:auto}.theory-reader pre{white-space:pre-wrap;overflow:visible;max-height:none}.theory-model-block:not([open]){display:none}}
`;

function sourceIndex(theory, sourceBlockLines) {
  const rows = [];
  if (theory.includeLive) rows.push('<tr><td>Include</td><td><code>ThyLive</code></td><td>All worlds · complete dynamic schemes</td><td>—</td></tr>');
  for (const declaration of theory.declarations) {
    const blockLine = sourceBlockLines.filter(line => line <= declaration.line).at(-1);
    const label = declaration.type === 'axiom' ? declaration.kind + ' axiom' : declaration.scope + ' property';
    const scope = declaration.type === 'axiom' ? 'All worlds' : declaration.scope === 'all' ? 'All worlds' : 'End of time';
    const target = blockLine ? `${theory.id}-line-${blockLine}` : theory.id;
    rows.push(`<tr><td>${escapeHTML(label)}</td><td><a href="#${target}">${escapeHTML(declaration.name)}</a></td><td>${scope}</td><td>${declaration.line}</td></tr>`);
  }
  return `<details class="reader-declarations"><summary>Declaration index · ${theory.axiomCount} axioms${theory.includeLive ? ' + ThyLive' : ''}, ${theory.propertyCount} properties</summary><div class="reader-table-wrap"><table><thead><tr><th>Role</th><th>Name</th><th>Validity scope</th><th>Source line</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></details>`;
}

/** Input is produced by tools/build-reader.mjs using parseDocument. */
export function createReaderPage({version, groups, theories, fontBase64}) {
  if (typeof fontBase64 !== 'string' || !/^[A-Za-z0-9+/]+=*$/.test(fontBase64)) throw new TypeError('Reader needs a base64 font.');
  const ids = new Set();
  for (const theory of theories) {
    if (!/^theory-\d+$/.test(theory.id) || ids.has(theory.id)) throw new TypeError('Reader theory IDs must be unique generated identifiers.');
    ids.add(theory.id);
  }
  const sourcePath = file => 'examples/theories/' + file.split('/').map(encodeURIComponent).join('/');
  const articles = theories.map(theory => {
    const rendered = renderTheoryMarkdown(unicodeTheorySource(theory.source), {basePath: 'examples/theories/'});
    const sourceBlockLines = [...rendered.matchAll(/data-source-line="(\d+)"/g)].map(match => Number(match[1]));
    const content = rendered.replace(/ data-source-line="(\d+)"/g, (_match, line) => ` id="${theory.id}-line-${line}" data-source-line="${line}"`);
    return `<section class="reader-theory" id="${theory.id}" aria-label="${escapeHTML(theory.title)}"><header><p>${escapeHTML(theory.group)} · ${escapeHTML(theory.description)}</p><div class="reader-source-actions"><button type="button" class="reader-button" data-source-download="${theory.id}" hidden>Save exact Markdown</button><a href="${sourcePath(theory.file)}">Open source file</a></div><div class="reader-checksum">Source SHA-256: ${escapeHTML(theory.sourceSha256)}</div>${sourceIndex(theory, sourceBlockLines)}</header><article class="theory-reader">${content}</article></section>`;
  }).join('\n');
  const navigation = groups.map(group => `<section data-reader-group="${escapeHTML(group)}"><h2>${escapeHTML(group)}</h2><ul>${theories.filter(theory => theory.group === group).map(theory => `<li><a href="#${theory.id}" data-theory-link="${theory.id}">${escapeHTML(theory.label)}</a></li>`).join('')}</ul></section>`).join('\n');
  const data = {version, theories};
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="author" content="AI-generated following prompts by Murdoch J. Gabbay"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"><title>HSM ${escapeHTML(version)} · offline theory reader</title><style>${readerCSS.replace('FONT_DATA',fontBase64)}</style></head>
<body><header class="reader-header"><div class="reader-brand"><div class="reader-title"><span class="brand-mark" aria-hidden="true">HSmc</span><h1>History Structure Model-checker · theory reader</h1></div><a class="reader-button" href="index.html">Open model-checker</a></div><p>Read the executable theories offline. This file opens directly without a server or internet connection. It displays the source; it does not run a model-checking query.</p><p class="reader-meta">HSM ${escapeHTML(version)} · ${theories.length} theories · To run the checker, start <code>python3 serve.py --open</code> from this package. <a href="README.md">Run instructions</a> · <a href="assets/FONT-LICENSE.txt">Bundled font licence</a></p></header>
<div class="reader-layout"><nav class="reader-navigation" aria-label="Theory catalog"><div id="readerSearchTools" hidden><label for="readerSearch">Find a theory or rule<input id="readerSearch" type="search" placeholder="Protocol, rule, claim or formula" autocomplete="off"></label><div class="reader-search-actions"><span id="readerCount" role="status" aria-live="polite">${theories.length} theories</span><button id="readerClear" class="reader-text-button" type="button">Clear</button></div></div>${navigation}</nav><main class="reader-main"><noscript>JavaScript is disabled: all theories remain readable below, and the catalog links still jump to them. The source files are available beside this reader.</noscript><div id="readerControls" hidden><button id="readerPrevious" class="reader-button" type="button">← Previous theory</button><button id="readerNext" class="reader-button" type="button">Next theory →</button></div><p id="readerEmpty" hidden>No theories match. Clear the search or use fewer terms.</p>${articles}</main></div>
<footer class="reader-footer">Generated from the executable Markdown and canonical declaration loader. Source fingerprints identify bytes; they do not certify mathematical correctness. HSM was AI-generated following prompts by Murdoch J. Gabbay. The paper's authorship and exact references appear within each theory.</footer>
<script id="reader-data" type="application/json">${jsonForHTML(data)}</script>
<script id="reader-runtime">(${readerRuntime.toString()})();</script>
</body></html>\n`;
}
