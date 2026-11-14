/** Presentation-only formula notation. Both spellings parse to the same AST.
 *
 * Conversion preserves whitespace, comments, quoted values, declaration names
 * and model JSON. It changes operator tokens only. Reserved words used as
 * learner/value terms or bound variable names are deliberately left alone.
 * An AST comparison guards every conversion; invalid input is never rewritten.
 */
import {parseFormula} from './parser.mjs';
import {parseDocument} from './document.mjs';

const spellings = [
  ['true','⊤'],['false','⊥'],['not','¬'],['!','¬'],
  ['and','∧'],['&&','∧'],['&','∧'],['or','∨'],['||','∨'],['|','∨'],
  ['->','⇒'],['=>','⇒'],['→','⇒'],['<->','⇔'],['<=>','⇔'],['↔','⇔'],
  ['forall','∀'],['exists','∃'],['exists1','∃¹'],['∃1','∃¹'],['∃!','∃¹'],['∃₁','∃¹'],
  ['exists01','∃⁰¹'],['∃01','∃⁰¹'],['∃₀₁','∃⁰¹'],
  ['past','↓'],['allpast','⇓'],['sometime','↕'],['everytime','⇕'],
  ['dia','♢'],['diamond','♢'],['◇','♢'],['box','□'],['square','□'],['!=','≠'],['==','='],
];
const toUnicode = new Map(spellings);
const toAscii = new Map([
  ['⊤','true'],['⊥','false'],['¬','not'],['∧','and'],['∨','or'],
  ['⇒','->'],['→','->'],['⇔','<->'],['↔','<->'],['∀','forall'],['∃','exists'],
  ['∃¹','exists1'],['∃₁','exists1'],['∃1','exists1'],['∃!','exists1'],
  ['∃⁰¹','exists01'],['∃₀₁','exists01'],['∃01','exists01'],
  ['↓','past'],['⇓','allpast'],['↕','sometime'],['⇕','everytime'],
  ['♢','dia'],['◇','dia'],['□','box'],['≠','!='],
]);
const quantifiers = new Set(['forall','exists','exists1','exists01','∀','∃','∃¹','∃₁','∃1','∃!','∃⁰¹','∃₀₁','∃01']);
const reserved = new Set(['seq','end',...toUnicode.keys(),...toAscii.keys()]);
const word = /[\p{L}_][\p{L}\p{N}_$']*/uy;
const operators = /^(?:<->|<=>|∃⁰¹|∃₀₁|∃01|∃¹|∃₁|∃1|∃!|->|=>|&&|\|\||!=|==)/;

function tokens(source) {
  const result=[];
  for(let index=0;index<source.length;) {
    const start=index,ch=source[index];
    if(/\s/u.test(ch)) {while(index<source.length&&/\s/u.test(source[index]))index++;result.push({text:source.slice(start,index),kind:'space'});continue;}
    if(ch==='#'||source.startsWith('//',index)) {index=source.indexOf('\n',index);if(index<0)index=source.length;result.push({text:source.slice(start,index),kind:'comment'});continue;}
    if(ch==='"'||ch==="'") {
      const quote=ch;index++;
      while(index<source.length) {const next=source[index++];if(next==='\\')index++;else if(next===quote)break;}
      result.push({text:source.slice(start,index),kind:'string'});continue;
    }
    if(ch==='?') {word.lastIndex=index+1;const match=word.exec(source);if(match){index=word.lastIndex;result.push({text:source.slice(start,index),kind:'variable'});continue;}}
    const operator=source.slice(index).match(operators);
    if(operator) {index+=operator[0].length;result.push({text:operator[0],kind:'operator'});continue;}
    word.lastIndex=index;const match=word.exec(source);
    if(match) {index=word.lastIndex;result.push({text:match[0],kind:'word'});continue;}
    index++;result.push({text:ch,kind:'operator'});
  }
  return result;
}

function convertFormula(source, table) {
  const original=parseFormula(source),pieces=tokens(source);
  const significant=pieces.filter(piece=>piece.kind!=='space'&&piece.kind!=='comment');
  const stack=[];let binding=false;
  for(let index=0;index<significant.length;index++) {
    const token=significant[index],previous=significant[index-1],next=significant[index+1];
    const inTerms=stack.some(context=>context==='terms');
    const equalityTerm=token.kind==='word'&&(['=','==','!=','≠'].includes(previous?.text)||['=','==','!=','≠'].includes(next?.text));
    const protectedToken=inTerms||binding||equalityTerm||token.kind==='string'||token.kind==='variable';
    if(!protectedToken&&table.has(token.text))token.replacement=table.get(token.text);
    if(!protectedToken&&quantifiers.has(token.text))binding=true;
    else if(binding&&token.text==='.')binding=false;
    if(token.text==='[')stack.push('terms');
    else if(token.text==='(')stack.push(previous&&(previous.kind==='string'||previous.kind==='word'&&!reserved.has(previous.text))?'terms':'formula');
    else if(token.text===']'||token.text===')')stack.pop();
  }
  // Replacing a one-character glyph by a word must not join neighbouring words.
  // This also handles compact inputs such as ∀v.↓echo(v) without touching literals.
  let output='';
  for(let index=0;index<pieces.length;index++) {
    const piece=pieces[index],text=piece.replacement??piece.text;
    const before=output.at(-1),after=(pieces[index+1]?.replacement??pieces[index+1]?.text??'')[0];
    if(piece.replacement&&/^[\p{L}_]/u.test(text)&&before&&/[\p{L}\p{N}_$'?]/u.test(before))output+=' ';
    output+=text;
    if(piece.replacement&&/[\p{L}\p{N}_$']$/u.test(text)&&after&&/[\p{L}\p{N}_$'?]/u.test(after))output+=' ';
  }
  if(JSON.stringify(parseFormula(output))!==JSON.stringify(original))throw new Error('Notation conversion would change this formula; the source was not changed.');
  return output;
}

/** Convert a complete valid formula, retaining its exact logical structure. */
export const unicodeFormula = source=>convertFormula(source,toUnicode);
export const asciiFormula = source=>convertFormula(source,toAscii);

function convertTheorySource(source, converter) {
  const doc=parseDocument(source),lines=source.split(/\r\n?|\n/),starts=[0];
  for(const match of source.matchAll(/\r\n?|\n/g))starts.push(match.index+match[0].length);
  const edits=[];
  for(const declaration of [...doc.axioms,...doc.properties]) {
    const line=lines[declaration.line-1];let quoted=false,escaped=false,colon=-1;
    for(let index=0;index<line.length;index++) {
      const ch=line[index];
      if(quoted){if(escaped)escaped=false;else if(ch==='\\')escaped=true;else if(ch==='"')quoted=false;}
      else if(ch==='"')quoted=true;
      else if(ch===':'){colon=index;break;}
    }
    if(colon<0)throw new Error('Cannot locate the formula in its declaration.');
    const column=colon+1+line.slice(colon+1).match(/^\s*/)[0].length;
    const formulaLines=declaration.formula.split('\n');
    const start=starts[declaration.line-1]+column;
    const end=starts[declaration.line+formulaLines.length-2]+formulaLines.at(-1).length+(formulaLines.length===1?column:0);
    edits.push({start,end,text:converter(source.slice(start,end))});
  }
  let output=source;
  for(const edit of edits.sort((a,b)=>b.start-a.start))output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
  const rewritten=parseDocument(output);
  const semantic=doc=>({model:doc.model,includeLive:doc.includeLive,axioms:doc.axioms.map(({name,kind,ast})=>({name,kind,ast})),properties:doc.properties.map(({name,scope,ast})=>({name,scope,ast}))});
  if(JSON.stringify(semantic(doc))!==JSON.stringify(semantic(rewritten)))throw new Error('Notation conversion would change this theory; the source was not changed.');
  return output;
}

/** Rewrite executable formula tokens only; prose, names and JSON stay exact. */
export const unicodeTheorySource = source=>convertTheorySource(source,unicodeFormula);
export const asciiTheorySource = source=>convertTheorySource(source,asciiFormula);
