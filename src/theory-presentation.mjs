/** Safe, dependency-free presentation of literate history theories.
 *
 * Rendering never interprets HTML or evaluates code. Highlighting is lexical
 * and deliberately tolerates unfinished input; parsing/validation belongs to
 * document.mjs and parser.mjs. The source is never rewritten by this module.
 */
const MAX_HIGHLIGHT_LENGTH = 2 * 1024 * 1024;
const MAX_RENDER_LENGTH = 2 * 1024 * 1024;
const MAX_HIGHLIGHT_TOKENS = 20_000;

const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[c]);
const span = (kind, text) => `<span class="tok-${kind}">${escapeHTML(text)}</span>`;
const wordOperators = new Set(['not','and','or','past','allpast','end','sometime','everytime','dia','diamond','box','square']);
const keywords = new Set(['axiom','property','include','forall','exists','exists1','exists01','true','false','seq']);
const metadata = new Set(['backward','forward','other','all']);
const identifier = /[\p{L}_][\p{L}\p{N}_$']*/uy;
const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const operators = /^(?:<->|<=>|->|=>|&&|\|\||!=|==|∃⁰¹|∃₀₁|∃01|∃¹|∃₁|∃1|∃!|[⊤⊥¬∧∨⇒→⇔↔∀∃↓⇓↕⇕♢◇□≠=&|!])/u;

function highlightCode(source, json = false, budget={count:0,exhausted:false}) {
  const out = [];
  let i = 0;
  while (i < source.length) {
    if(++budget.count>MAX_HIGHLIGHT_TOKENS) {budget.exhausted=true;return '';}
    const start = i, ch = source[i];
    if (/\s/u.test(ch)) {
      while (i < source.length && /\s/u.test(source[i])) i++;
      out.push(escapeHTML(source.slice(start,i)));
    } else if (!json && (ch === '#' || source.startsWith('//',i))) {
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') i++;
      out.push(span('comment',source.slice(start,i)));
    } else if (ch === '"' || (!json && ch === "'")) {
      const quote = ch;
      i++;
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') {
        if (source[i] === '\\') { i += Math.min(2,source.length-i); continue; }
        if (source[i++] === quote) break;
      }
      out.push(span('string',source.slice(start,i)));
    } else if (!json && operators.test(source.slice(i,i+4))) {
      const token = source.slice(i,i+4).match(operators)[0];
      i += token.length; out.push(span('operator',token));
    } else {
      identifier.lastIndex = i;
      const name = identifier.exec(source);
      if (name) {
        i = identifier.lastIndex;
        const token = name[0];
        const kind = json ? (['true','false','null'].includes(token)?'keyword':'name')
          : wordOperators.has(token)?'operator':keywords.has(token)?'keyword':metadata.has(token)?'meta':'name';
        out.push(span(kind,token));
      } else {
        number.lastIndex = i;
        const numeric = number.exec(source);
        if (numeric) { i=number.lastIndex; out.push(span('number',numeric[0])); }
        else if (/^[()[\]{},.:?]$/.test(ch)) { i++; out.push(span('punctuation',ch)); }
        else { i++; out.push(escapeHTML(ch)); }
      }
    }
  }
  return out.join('');
}

function fenceOpening(line) {
  const match=line.match(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/);
  if (!match) return null;
  return {marker:match[1][0],length:match[1].length,info:match[2].trim(),tag:match[2].trim().split(/\s+/)[0]};
}
function closesFence(line, fence) {
  const match=line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
  return !!match && match[1][0]===fence.marker && match[1].length>=fence.length;
}

function highlightMarkdown(source,budget) {
  const parts=source.split(/(\r\n|\r|\n)/),out=[];
  let fence=null;
  for(let i=0;i<parts.length;i+=2) {
    if(++budget.count>MAX_HIGHLIGHT_TOKENS) {budget.exhausted=true;return '';}
    const line=parts[i],newline=parts[i+1]??'';
    if (fence) {
      if (closesFence(line,fence)) { out.push(span('meta',line)); fence=null; }
      else out.push(fence.tag==='hsm'?highlightCode(line,false,budget):['hsm-model','json'].includes(fence.tag)?highlightCode(line,true,budget):escapeHTML(line));
    } else {
      const opening=fenceOpening(line);
      if (opening) { fence=opening;out.push(span('meta',line)); }
      else if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) out.push(span('heading',line));
      else {
        // Inline code is distinct without allowing markup to alter the input.
        let cursor=0,search=markerSearch(line),position=line.indexOf('`');
        while(position>=0) {
          let end=position;while(line[end]==='`')end++;
          const marker=line.slice(position,end),close=search(marker,end);
          if(close>=0) {
            out.push(escapeHTML(line.slice(cursor,position)),span('string',line.slice(position,close+marker.length)));
            cursor=close+marker.length;position=line.indexOf('`',cursor);
          } else position=line.indexOf('`',end);
        }
        out.push(escapeHTML(line.slice(cursor)));
      }
    }
    out.push(escapeHTML(newline));
  }
  return out.join('');
}

/** Highlight without changing a single source character. Unknown languages
 * are escaped verbatim. Large inputs degrade to plain escaped text. */
export function highlightSource(source, language='markdown') {
  if(typeof source!=='string') throw new TypeError('Highlighted source must be a string.');
  if(source.length>MAX_HIGHLIGHT_LENGTH) return escapeHTML(source);
  const tag=String(language).toLowerCase(),budget={count:0,exhausted:false};
  const html=tag==='markdown'||tag==='md'?highlightMarkdown(source,budget)
    :tag==='hsm'?highlightCode(source,false,budget)
    :tag==='json'||tag==='hsm-model'?highlightCode(source,true,budget):escapeHTML(source);
  return budget.exhausted?escapeHTML(source):html;
}

function markerSearch(source) {
  let budget=source.length*8;
  return (marker,start)=> {
    if(budget<=0)return -1;
    const end=source.indexOf(marker,start);
    budget-=(end<0?source.length:end+marker.length)-start;
    return end;
  };
}

function safeHref(raw,basePath) {
  let href=raw.trim();
  const destination=href.match(/^<([^<>]*)>(?:\s+["'][\s\S]*["'])?$/)
    ??href.match(/^(\S+?)(?:\s+["'][\s\S]*["'])?$/);
  if(!destination) return null;
  href=destination[1];
  // Spaces/control characters and backslashes can disguise schemes or hosts.
  if(/[\u0000-\u0020\u007f\\]/u.test(href)||href.startsWith('//')) return null;
  const scheme=href.match(/^([a-z][a-z0-9+.-]*):/i)?.[1].toLowerCase();
  if(scheme&&!['http','https','mailto'].includes(scheme))return null;
  if(!scheme&&!href.startsWith('#')&&!href.startsWith('/')&&basePath) {
    href=basePath.replace(/\/?$/,'/')+href;
    if(/[\u0000-\u0020\u007f\\]/u.test(href)||/^(?!https?:|mailto:)[a-z][a-z0-9+.-]*:/i.test(href)||href.startsWith('//'))return null;
  }
  if(!/^[a-z][a-z0-9+.-]*:/i.test(href)&&!href.startsWith('#')&&!href.startsWith('/')) {
    // A portable/imported theory may have lost its original directory. Keep
    // relative links inside the package, even when hosted below /project/.
    // URL normalization removes dot segments and clamps excess .. at its root;
    // dropping that artificial root keeps the result relative to the package.
    const normalized=new URL(href,'https://theory.invalid/');
    href=(normalized.pathname.slice(1)||'./')+normalized.search+normalized.hash;
  }
  return href;
}

function delimiterEnds(source) {
  // One scan avoids repeatedly searching the rest of an unfinished paragraph
  // such as "[[[[..." while the user is typing.
  const ends=new Map(),square=[],round=[],search=markerSearch(source);
  for(let i=0;i<source.length;i++) {
    if(source[i]==='\\') {i++;continue;}
    const ch=source[i];
    if(ch==='`') {
      let end=i;while(source[end]==='`')end++;
      const marker=source.slice(i,end),close=search(marker,end);
      if(close>=0) {i=close+marker.length-1;continue;}
      i=end-1;continue;
    }
    if(ch==='[')square.push(i);
    else if(ch==='(')round.push(i);
    else if(ch===']'&&square.length)ends.set(square.pop(),i);
    else if(ch===')'&&round.length)ends.set(round.pop(),i);
  }
  return ends;
}

function inline(source,basePath,depth=0,allowLinks=true) {
  if(depth>8)return escapeHTML(source);
  const out=[],ends=delimiterEnds(source),search=markerSearch(source);
  for(let i=0;i<source.length;) {
    const ch=source[i];
    if(ch==='\\'&&/[\\`*{}[\]()#+.!_|<>-]/.test(source[i+1]??'')) {
      out.push(escapeHTML(source[i+1]));i+=2;continue;
    }
    if(ch==='`') {
      let end=i;while(source[end]==='`')end++;
      const marker=source.slice(i,end),close=search(marker,end);
      if(close>=0) {out.push(`<code>${escapeHTML(source.slice(end,close))}</code>`);i=close+marker.length;continue;}
      out.push(escapeHTML(marker));i=end;continue;
    }
    if(ch==='['&&allowLinks) {
      const labelEnd=ends.get(i);
      if(labelEnd!==undefined&&source[labelEnd+1]==='(') {
        const hrefEnd=ends.get(labelEnd+1);
        if(hrefEnd!==undefined) {
          const href=safeHref(source.slice(labelEnd+2,hrefEnd),basePath);
          if(href!==null) {
            const external=/^https?:/i.test(href);
            out.push(`<a href="${escapeHTML(href)}"${external?' target="_blank" rel="noopener noreferrer"':''}>${inline(source.slice(i+1,labelEnd),basePath,depth+1,false)}</a>`);
            i=hrefEnd+1;continue;
          }
          out.push(escapeHTML(source.slice(i,hrefEnd+1)));i=hrefEnd+1;continue;
        }
      }
    }
    const strong=source.startsWith('**',i)?'**':source.startsWith('__',i)?'__':null;
    const wordBefore=/[\p{L}\p{N}]/u.test(source[i-1]??'');
    const marker=(ch==='_'&&wordBefore)?null:strong??((ch==='*'||ch==='_')?ch:null);
    if(marker) {
      let end=search(marker,i+marker.length);
      while(end>=0&&marker[0]==='_'&&/[\p{L}\p{N}]/u.test(source[end+marker.length]??''))end=search(marker,end+marker.length);
      if(end>i+marker.length&&!/\s/u.test(source[i+marker.length])&&!/\s/u.test(source[end-1])) {
        const tag=strong?'strong':'em';
        out.push(`<${tag}>${inline(source.slice(i+marker.length,end),basePath,depth+1,allowLinks)}</${tag}>`);i=end+marker.length;continue;
      }
    }
    out.push(escapeHTML(ch));i++;
  }
  return out.join('');
}

function tableCells(line) {
  let text=line.trim();
  if(text.startsWith('|'))text=text.slice(1);
  if(text.endsWith('|')&&!text.endsWith('\\|'))text=text.slice(0,-1);
  const cells=[];let start=0,code='';
  for(let i=0;i<text.length;i++) {
    if(text[i]==='\\') {i++;continue;}
    if(text[i]==='`') {
      let end=i;while(text[end]==='`')end++;
      const marker=text.slice(i,end);
      if(!code)code=marker;else if(code===marker)code='';
      i=end-1;
    } else if(text[i]==='|'&&!code) {cells.push(text.slice(start,i).trim());start=i+1;}
  }
  cells.push(text.slice(start).trim());return cells;
}
function tableSeparator(line) {
  if(!line?.includes('|'))return null;
  const cells=tableCells(line);
  return cells.length&&cells.every(c=>/^:?-{3,}:?$/.test(c))?cells:null;
}
const listPattern=/^( {0,3})([-+*]|\d+[.)])\s+(.+)$/;
function startsBlock(lines,i) {
  return /^\s*$/.test(lines[i])||!!fenceOpening(lines[i])||/^ {0,3}#{1,6}(?:\s|$)/.test(lines[i])
    ||/^ {0,3}>/.test(lines[i])||listPattern.test(lines[i])||/^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(lines[i])
    ||!!tableSeparator(lines[i+1]);
}

function blocks(lines,basePath,offset=0,nesting=0) {
  if(nesting>16)return `<pre>${escapeHTML(lines.join('\n'))}</pre>`;
  const out=[];
  for(let i=0;i<lines.length;) {
    const line=lines[i];
    if(!line.trim()) {i++;continue;}
    const fence=fenceOpening(line);
    if(fence) {
      const first=i;let j=i+1;
      while(j<lines.length&&!closesFence(lines[j],fence))j++;
      const code=lines.slice(i+1,j).join('\n'),tag=fence.tag;
      const language=tag==='hsm-model'?'json':tag;
      const rendered=`<pre><code class="language-${escapeHTML(/^[a-z][a-z0-9-]*$/i.test(language)?language:'text')}">${highlightSource(code,language)}</code></pre>`;
      out.push(tag==='hsm-model'?`<details class="theory-model-block" data-source-line="${offset+first+1}"><summary>History model · JSON</summary>${rendered}</details>`
        :`<div class="theory-code-block" data-source-line="${offset+first+1}">${rendered}</div>`);
      i=j<lines.length?j+1:j;continue;
    }
    const heading=line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if(heading) {const level=heading[1].length;out.push(`<h${level}>${inline(heading[2].replace(/\s+#+\s*$/,''),basePath)}</h${level}>`);i++;continue;}
    if(lines[i+1]?.match(/^ {0,3}(?:={3,}|-{3,})\s*$/)) {
      const level=lines[i+1].trim()[0]==='='?1:2;
      out.push(`<h${level}>${inline(line.trim(),basePath)}</h${level}>`);i+=2;continue;
    }
    if(/^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) {out.push('<hr>');i++;continue;}
    if(/^ {0,3}>/.test(line)) {
      const start=i,quoted=[];
      while(i<lines.length&&/^ {0,3}>/.test(lines[i]))quoted.push(lines[i++].replace(/^ {0,3}> ?/,''));
      out.push(`<blockquote>${blocks(quoted,basePath,offset+start,nesting+1)}</blockquote>`);continue;
    }
    const separator=tableSeparator(lines[i+1]);
    if(separator) {
      const header=tableCells(line),align=separator.map(c=>c.startsWith(':')?(c.endsWith(':')?'center':'left'):c.endsWith(':')?'right':'left');
      const cells=(row,tag)=>header.map((_,k)=>`<${tag} class="align-${align[k]??'left'}">${inline(row[k]??'',basePath)}</${tag}>`).join('');
      const rows=[];i+=2;
      while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(`<tr>${cells(tableCells(lines[i++]),'td')}</tr>`);
      out.push(`<div class="theory-table"><table><thead><tr>${cells(header,'th')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);continue;
    }
    const item=line.match(listPattern);
    if(item) {
      const ordered=/^\d/.test(item[2]),tag=ordered?'ol':'ul',items=[],baseIndent=item[1].length;
      const start=ordered?Number.parseInt(item[2],10):1;
      while(i<lines.length) {
        const row=lines[i].match(listPattern);
        if(!row||row[1].length!==baseIndent||/^\d/.test(row[2])!==ordered)break;
        const content=[row[3]],first=i,indent=row[1].length+row[2].length+1;i++;
        while(i<lines.length&&/^[ \t]+\S/.test(lines[i])) {
          const nested=lines[i].match(listPattern);
          if(nested&&nested[1].length<=baseIndent)break;
          content.push(lines[i++].replace(new RegExp(`^ {0,${indent}}`),''));
        }
        items.push(`<li>${blocks(content,basePath,offset+first,nesting+1)}</li>`);
      }
      out.push(`<${tag}${ordered&&start!==1?` start="${start}"`:''}>${items.join('')}</${tag}>`);continue;
    }
    const paragraph=[line.trim()];i++;
    while(i<lines.length&&!startsBlock(lines,i))paragraph.push(lines[i++].trim());
    out.push(`<p>${inline(paragraph.join('\n'),basePath)}</p>`);
  }
  return out.join('\n');
}

/** Render the supported Markdown subset used by the bundled literate theories:
 * headings, paragraphs, emphasis, code, safe links, lists, tables and quotes.
 * Raw HTML is always visible text. Images, embedded HTML, math evaluation and
 * scripts are intentionally not executed. Model JSON is collapsed by default. */
export function renderTheoryMarkdown(source,{basePath=''}={}) {
  if(typeof source!=='string')throw new TypeError('Theory Markdown must be a string.');
  if(typeof basePath!=='string')throw new TypeError('Markdown basePath must be a string.');
  if(source.length>MAX_RENDER_LENGTH)return `<pre class="theory-plain-source">${escapeHTML(source)}</pre>`;
  return blocks(source.split(/\r\n?|\n/),basePath);
}
