import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {highlightSource,renderTheoryMarkdown} from '../src/theory-presentation.mjs';

function plain(html) {
  return html.replace(/<[^>]*>/g,'').replace(/&(amp|lt|gt|quot|#39);/g,(_,entity)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[entity]);
}

test('lexical highlighting preserves complete, incomplete, Unicode and ASCII input exactly',()=>{
  const cases=[
    ['hsm',`# Paper: x\r\naxiom Echo! [forward]: ∀ v. (live ∧ ♢[] ↓ propose(v)) ⇒ ∃ w. ↕ echo(w)\r\n`],
    ['hsm',`axiom "Alternative:!" [backward]: forall v. echo(v) -> dia[] past propose(v) // tail\n`],
    ['hsm',`property A [all]: ∃⁰¹ v. chosen(v) ∨ ∃¹ w. w ≠ "x<&"\naxiom B: "unfinished`],
    ['hsm',`forall v'. p(v') & p('quoted') & p("\\\"quoted\\\"")`],
    ['json',`{ "x": "<script>", "n": -1.25e+2, "b": true, "other": null }`],
    ['markdown',`# T\r\n\r\nA **bold** paragraph with \`literal<&\`.\r\n~~~hsm\r\n∀ v. p(v)\r\n~~~\r\n`],
    ['markdown','````markdown\n```hsm\naxiom Example: false\n```\n````\n'],
    ['unknown','<img src=x onerror=alert(1)>'],
    ['hsm','𝒙 ♢ ↓ † \uD800']
  ];
  for(const [language,source]of cases)assert.equal(plain(highlightSource(source,language)),source);
  assert.match(highlightSource('∀ v. p(v) ⇒ □[v] ↓ q("x") # note','hsm'),/tok-operator/);
  assert.match(highlightSource('∀ v. p(v) ⇒ □[v] ↓ q("x") # note','hsm'),/tok-string/);
  assert.match(highlightSource('∀ v. p(v) ⇒ □[v] ↓ q("x") # note','hsm'),/tok-comment/);
});

test('literate Markdown renders semantic prose and highlighted executable blocks with collapsed model JSON',()=>{
  const source=`# Theory\n\nA **clear** paragraph and *explanation* with \`safe(l)\`.\n\n- First\n- Second\n\n3. Ordered\n4. Again\n\n> A quotation.\n\n| Name | Formula |\n| --- | :---: |\n| Rule | \`p | q\` |\n\n[Guide](../../docs/THEORY_FORMAT.md)\n\n\`\`\`hsm-model\n{"nodes": []}\n\`\`\`\n\n\`\`\`hsm\naxiom Echo? [backward]: ∀ v. echo(v) ⇒ ♢[] ↓ propose(v)\n\`\`\`\n`;
  const html=renderTheoryMarkdown(source,{basePath:'examples/theories/'});
  for(const expected of ['<h1>Theory</h1>','<strong>clear</strong>','<em>explanation</em>','<code>safe(l)</code>','<ul>','<ol start="3">','<blockquote>','<table>','<code>p | q</code>','href="docs/THEORY_FORMAT.md"','class="language-hsm"','tok-keyword','tok-operator','data-source-line='])assert.ok(html.includes(expected),expected);
  assert.match(html,/<details class="theory-model-block"[^>]*><summary>History model · JSON<\/summary>/);
  assert.doesNotMatch(html,/<details[^>]*\bopen\b/);
  assert.match(html,/class="language-json"/);
});

test('reader escapes raw HTML and rejects active or disguised link destinations',()=>{
  const source=`<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[x](javascript:alert(1)) [x](data:text/html,x) [x](vbscript:x) [x](//evil.example/x) [x](java\tscript:x) [x](\\\\evil.example/x)\n\n[okay](https://example.test/a?q=%22) and [mail](mailto:test@example.test)\n\n\`\`\`hsm\naxiom "<img onerror=x>": p("</code><script>alert(1)</script>")\n\`\`\`\n`;
  const html=renderTheoryMarkdown(source);
  assert.doesNotMatch(html,/<script|<img|<iframe|<svg|href="(?:javascript|vbscript|data|\/\/|\\\\)/i);
  assert.match(html,/&lt;script&gt;/);
  assert.match(html,/href="https:\/\/example.test\/a\?q=%22" target="_blank" rel="noopener noreferrer"/);
  assert.match(html,/href="mailto:test@example.test"/);
  assert.doesNotMatch(renderTheoryMarkdown('[x](relative)',{basePath:'javascript:alert(1)/'}),/<a /);
});

test('portable relative links stay within a package hosted below a URL subdirectory',()=>{
  const hosted='http://host/project/';
  const cases=[
    ['../../docs/PAPER_MAP.md',{},'docs/PAPER_MAP.md'],
    ['../../docs/PAPER_MAP.md',{basePath:'examples/theories/'},'docs/PAPER_MAP.md'],
    ['../../../docs/./PAPER_MAP.md?q=a#section',{},'docs/PAPER_MAP.md?q=a#section'],
    ['foo.md',{},'foo.md'],
    ['../guide.md',{basePath:'examples/theories/'},'examples/guide.md'],
    ['https://example.org/../guide?q=1#s',{},'https://example.org/../guide?q=1#s'],
    ['mailto:test@example.org',{},'mailto:test@example.org'],
    ['#section',{},'#section'],
    ['/absolute/../guide.md',{},'/absolute/../guide.md']
  ];
  for(const [destination,options,expected]of cases) {
    const href=renderTheoryMarkdown(`[guide](${destination})`,options).match(/href="([^"]+)"/)[1];
    assert.equal(href,expected);
    if(!/^(?:https?:|mailto:|#|\/)/.test(expected))assert.ok(new URL(href,hosted).href.startsWith(hosted));
  }
  const href=renderTheoryMarkdown('[map](../../docs/PAPER_MAP.md)').match(/href="([^"]+)"/)[1];
  assert.equal(new URL(href,hosted).href,'http://host/project/docs/PAPER_MAP.md');
});

test('outer longer fences keep inner hsm examples literal and unclosed editing fences remain readable',()=>{
  const html=renderTheoryMarkdown('````markdown\n```hsm\naxiom Example: false\n```\n````\n\n~~~hsm\naxiom Real: true\n~~~');
  assert.equal((html.match(/class="language-hsm"/g)??[]).length,1);
  assert.match(html,/```hsm/);
  assert.ok(renderTheoryMarkdown('```hsm\naxiom A: ∀').includes('tok-operator'));
  assert.ok(renderTheoryMarkdown('Heading\n=======\n\n---').includes('<h1>Heading</h1>'));
  assert.match(renderTheoryMarkdown('# C#\n\n- Parent\n  - Child\n  - Sibling\n- Next'),/<h1>C#<\/h1>[\s\S]*<ul><li><p>Parent<\/p>\n<ul>/);
  assert.equal((renderTheoryMarkdown('['.repeat(20000)).match(/\[/g)??[]).length,20000);
  assert.equal(renderTheoryMarkdown('safe_learner_x and _emphasis_'),'<p>safe_learner_x and <em>emphasis</em></p>');
  const nested=renderTheoryMarkdown('[a [b](https://x.test)](https://y.test)');
  assert.equal((nested.match(/<a /g)??[]).length,1);
  assert.match(renderTheoryMarkdown('[see `]` here](https://example.org)'),/href="https:\/\/example.org"[^>]*>see <code>\]<\/code> here<\/a>/);
  const unfinished='a '+'`'.repeat(100000);
  assert.equal(renderTheoryMarkdown(unfinished),'<p>'+unfinished+'</p>');
  assert.equal(plain(highlightSource(unfinished)),unfinished);
  const operators='∧'.repeat(30000);
  assert.equal(highlightSource(operators,'hsm'),operators);
});

test('every bundled theory renders its prose and executable declarations without raw model expansion',async()=>{
  const base=new URL('../examples/theories/',import.meta.url);
  const files=(await readdir(base)).filter(n=>n.endsWith('.md'));
  assert.equal(files.length,29);
  for(const name of files) {
    const source=await readFile(new URL(name,base),'utf8');
    const html=renderTheoryMarkdown(source,{basePath:'examples/theories/'});
    assert.match(html,/<h1>/,name);
    assert.match(html,/theory-model-block/,name);
    assert.match(html,/language-hsm/,name);
    assert.doesNotMatch(html,/<details[^>]*\bopen\b/,name);
    assert.ok(!html.includes('undefined'),name);
  }
});
