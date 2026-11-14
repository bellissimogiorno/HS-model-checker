/**
 * Formula syntax for the History Structure Model-checker.
 *
 * This module has no DOM or Node dependencies. It accepts both the paper's
 * connective glyphs and a deliberately small ASCII notation. Terms are either
 * quoted values, lexically bound variable names, or explicit variables `?x`.
 * Thus `forall v. echo(v)` binds v, while `echo(red)` uses the value "red".
 * Printing always quotes values and marks variable occurrences explicitly.
 */

const MAX_SOURCE_LENGTH = 100_000;
const MAX_TOKENS = 20_000;
const MAX_DEPTH = 128;

export class FormulaSyntaxError extends SyntaxError {
  constructor(message, source, index = 0) {
    const before = source.slice(0, index);
    const line = before.split('\n').length;
    const column = Array.from(before.slice(before.lastIndexOf('\n') + 1)).length + 1;
    super(`${message} (line ${line}, column ${column})`);
    this.name = 'FormulaSyntaxError';
    this.index = index;
    this.line = line;
    this.column = column;
  }
}

const glyphs = new Map([
  ['⊤', 'true'], ['⊥', 'false'], ['¬', 'not'], ['∧', 'and'], ['∨', 'or'],
  ['⇒', 'implies'], ['→', 'implies'], ['⇔', 'iff'], ['↔', 'iff'],
  ['∀', 'forall'], ['∃', 'exists'], ['↓', 'past'], ['⇓', 'allpast'],
  ['↕', 'sometime'], ['⇕', 'everytime'], ['♢', 'dia'], ['◇', 'dia'],
  ['□', 'box'], ['≠', 'neq'],
]);

const words = new Map([
  ['true', 'true'], ['false', 'false'], ['seq', 'seq'], ['not', 'not'],
  ['and', 'and'], ['or', 'or'], ['forall', 'forall'], ['exists', 'exists'],
  ['exists01', 'exists01'], ['exists1', 'exists1'], ['past', 'past'],
  ['allpast', 'allpast'], ['end', 'end'], ['sometime', 'sometime'],
  ['everytime', 'everytime'], ['dia', 'dia'], ['diamond', 'dia'],
  ['box', 'box'], ['square', 'box'],
]);

const identifierPattern = /[\p{L}_][\p{L}\p{N}_$']*/uy;
const numeralPattern = /[0-9]+/y;
const variableNamePattern = /^[\p{L}_][\p{L}\p{N}_$']*$/u;

function tokenize(source) {
  const tokens = [];
  const fail = (message, index) => { throw new FormulaSyntaxError(message, source, index); };
  const push = (kind, value, index) => {
    if (tokens.length >= MAX_TOKENS) fail(`Formula exceeds ${MAX_TOKENS} tokens`, index);
    tokens.push({kind, value, index});
  };
  let i = 0;
  while (i < source.length) {
    if (/\s/u.test(source[i])) { i++; continue; }
    if (source[i] === '#' || source.startsWith('//', i)) {
      const nextLine = source.indexOf('\n', i);
      i = nextLine < 0 ? source.length : nextLine + 1;
      continue;
    }
    const start = i;
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = '';
      let closed = false;
      i++;
      while (i < source.length) {
        const next = source[i++];
        if (next === quote) { closed = true; break; }
        if (next === '\n' || next === '\r') fail('A quoted value cannot contain an unescaped newline', i - 1);
        if (next !== '\\') { value += next; continue; }
        if (i >= source.length) fail('Unterminated string escape', i - 1);
        const escaped = source[i++];
        const replacements = {n:'\n', r:'\r', t:'\t', b:'\b', f:'\f', v:'\v', '\\':'\\', "'":"'", '"':'"', '/':'/'};
        if (Object.hasOwn(replacements, escaped)) value += replacements[escaped];
        else if (escaped === 'u') {
          const digits = source.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(digits)) fail('Expected four hexadecimal digits after \\u', i);
          value += String.fromCharCode(parseInt(digits, 16));
          i += 4;
        } else fail(`Unknown string escape \\${escaped}`, i - 2);
      }
      if (!closed) fail('Unterminated quoted value', start);
      push('value', value, start);
      continue;
    }
    let matched = false;
    for (const [spelling, kind] of [
      ['<->','iff'], ['<=>','iff'], ['->','implies'], ['=>','implies'],
      ['&&','and'], ['||','or'], ['!=','neq'], ['==','eq'],
    ]) {
      if (source.startsWith(spelling, i)) {
        push(kind, spelling, i); i += spelling.length; matched = true; break;
      }
    }
    if (matched) continue;
    if (ch === '∃') {
      if (source.startsWith('∃⁰¹', i) || source.startsWith('∃₀₁', i)) { push('exists01', source.slice(i,i+3), i); i += 3; continue; }
      if (source.startsWith('∃¹', i) || source.startsWith('∃₁', i)) { push('exists1', source.slice(i,i+2), i); i += 2; continue; }
      if (source.startsWith('∃01', i)) { push('exists01', '∃01', i); i += 3; continue; }
      if (source.startsWith('∃1', i)) { push('exists1', '∃1', i); i += 2; continue; }
      if (source.startsWith('∃!', i)) { push('exists1', '∃!', i); i += 2; continue; }
    }
    if (glyphs.has(ch)) { push(glyphs.get(ch), ch, i++); continue; }
    const punctuation = {'(':'(', ')':')', '[':'[', ']':']', ',':',', '.':'.', '=':'eq', '!':'not', '&':'and', '|':'or'};
    if (Object.hasOwn(punctuation, ch)) { push(punctuation[ch], ch, i++); continue; }
    if (ch === '?') {
      identifierPattern.lastIndex = i + 1;
      const match = identifierPattern.exec(source);
      if (!match) fail('Expected a variable name after ?', i + 1);
      push('variable', match[0], i);
      i = identifierPattern.lastIndex;
      continue;
    }
    identifierPattern.lastIndex = i;
    const name = identifierPattern.exec(source);
    if (name) {
      push(words.get(name[0]) ?? 'name', name[0], i);
      i = identifierPattern.lastIndex;
      continue;
    }
    numeralPattern.lastIndex = i;
    const numeral = numeralPattern.exec(source);
    if (numeral) { push('name', numeral[0], i); i = numeralPattern.lastIndex; continue; }
    fail(`Unexpected character ${JSON.stringify(ch)}`, i);
  }
  tokens.push({kind:'eof', value:'', index:source.length});
  return tokens;
}

const binary = new Map([
  ['iff', {precedence:1, right:false}], ['implies', {precedence:2, right:true}],
  ['or', {precedence:3, right:false}], ['and', {precedence:4, right:false}],
]);
const quantifiers = new Set(['forall', 'exists', 'exists01', 'exists1']);
const prefixes = new Set(['not', 'past', 'allpast', 'end', 'sometime', 'everytime']);

/** Parse one complete formula. Throws FormulaSyntaxError with line/column. */
export function parseFormula(source) {
  if (typeof source !== 'string') throw new TypeError('A formula must be a string');
  if (source.length > MAX_SOURCE_LENGTH) {
    throw new FormulaSyntaxError(`Formula exceeds ${MAX_SOURCE_LENGTH} characters`, source, MAX_SOURCE_LENGTH);
  }
  const tokens = tokenize(source);
  let pos = 0;
  let depth = 0;
  let groupingDepth = 0;
  const bound = new Map();
  const peek = () => tokens[pos];
  const fail = (message, token = peek()) => { throw new FormulaSyntaxError(message, source, token.index); };
  const consume = (kind) => {
    if (peek().kind !== kind) fail(`Expected ${JSON.stringify(kind)}, found ${peek().kind === 'eof' ? 'end of formula' : JSON.stringify(peek().value)}`);
    return tokens[pos++];
  };
  const enter = () => {
    // A printed AST encloses subformulas in parentheses. Allow the parser's
    // control frames for those wrappers while separately bounding both actual
    // grouping and the resulting AST, so every accepted AST can round-trip.
    if (++depth > MAX_DEPTH * 3) fail(`Formula nesting exceeds ${MAX_DEPTH}`);
  };

  function term() {
    const token = peek();
    if (token.kind === 'value') { pos++; return {type:'value', value:token.value}; }
    if (token.kind === 'variable') { pos++; return {type:'var', name:token.value}; }
    // Reserved words can still be unquoted terms and bound variable names.
    if (variableNamePattern.test(token.value) || /^[0-9]+$/.test(token.value)) {
      pos++;
      return bound.has(token.value) ? {type:'var', name:token.value} : {type:'value', value:token.value};
    }
    fail('Expected a value or variable');
  }

  function expression(minPrecedence = 0) {
    enter();
    try {
      let left = primary();
      while (binary.has(peek().kind) && binary.get(peek().kind).precedence >= minPrecedence) {
        const operator = tokens[pos++].kind;
        const {precedence, right} = binary.get(operator);
        const rhs = expression(right ? precedence : precedence + 1);
        left = {type:operator, left, right:rhs};
      }
      return left;
    } finally { depth--; }
  }

  function primary() {
    const token = peek();
    // Equality is identifiable before interpreting a word as an operator.
    // In particular `forall seq. seq = seq` must honour the binding, and a
    // constant with a reserved spelling can be used in an equality as well.
    if ((token.kind === 'value' || token.kind === 'variable' || variableNamePattern.test(token.value) || /^[0-9]+$/.test(token.value)) &&
        (tokens[pos + 1]?.kind === 'eq' || tokens[pos + 1]?.kind === 'neq')) {
      const left = term();
      const operator = tokens[pos++].kind;
      const result = {type:'eq', left, right:term()};
      return operator === 'neq' ? {type:'not', body:result} : result;
    }
    if (token.kind === '(') {
      pos++;
      if (++groupingDepth > MAX_DEPTH) fail(`Formula nesting exceeds ${MAX_DEPTH}`, token);
      try {
        const result = expression();
        consume(')');
        return result;
      } finally { groupingDepth--; }
    }
    if (prefixes.has(token.kind)) {
      pos++;
      return {type:token.kind, body:expression(5)};
    }
    if (token.kind === 'dia' || token.kind === 'box') {
      pos++;
      const learners = [];
      if (peek().kind === '[') {
        pos++;
        if (peek().kind !== ']') {
          learners.push(term());
          while (peek().kind === ',') { pos++; learners.push(term()); }
        }
        consume(']');
      }
      return {type:token.kind, learners, body:expression(5)};
    }
    if (quantifiers.has(token.kind)) {
      pos++;
      const variables = [];
      do {
        if (variables.length) consume(',');
        const variable = peek();
        if (!(variable.kind === 'variable' || variableNamePattern.test(variable.value))) fail('Expected a bound variable name');
        pos++;
        variables.push(variable.value);
      } while (peek().kind === ',');
      consume('.');
      for (const variable of variables) bound.set(variable, (bound.get(variable) ?? 0) + 1);
      let body;
      try { body = expression(); }
      finally {
        for (const variable of variables) {
          const remaining = bound.get(variable) - 1;
          if (remaining) bound.set(variable, remaining); else bound.delete(variable);
        }
      }
      for (let i = variables.length - 1; i >= 0; i--) body = {type:token.kind, variable:variables[i], body};
      return body;
    }
    if (token.kind === 'true' || token.kind === 'false' || token.kind === 'seq') {
      pos++;
      return {type:token.kind};
    }
    if (token.kind === 'name' || token.kind === 'variable' || token.kind === 'value') {
      pos++;
      // Quoted symbols are unambiguous when followed by an argument list.
      // This permits signatures such as "vote-ready" or "past" without
      // imposing extra restrictions on the paper's uninterpreted symbols.
      const quotedAtom = token.kind === 'value' && peek().kind === '(';
      if (!quotedAtom && (token.kind !== 'name' || !variableNamePattern.test(token.value))) fail('A term must be used in an equality', token);
      const args = [];
      if (peek().kind === '(') {
        pos++;
        if (peek().kind !== ')') {
          args.push(term());
          while (peek().kind === ',') { pos++; args.push(term()); }
        }
        consume(')');
      }
      return {type:'atom', symbol:token.value, args};
    }
    fail(token.kind === 'eof' ? 'Expected a formula' : `Expected a formula, found ${JSON.stringify(token.value)}`);
  }

  const ast = expression();
  if (peek().kind !== 'eof') fail(`Unexpected token ${JSON.stringify(peek().value)} after formula`);
  // Left-associative chains and multi-variable binders need not increase the
  // parser's call depth, but still build nested ASTs. Enforce the same limit
  // for those shapes before downstream consumers can recurse through them.
  const pending = [[ast, 1]];
  while (pending.length) {
    const [node, structuralDepth] = pending.pop();
    if (structuralDepth > MAX_DEPTH) fail(`Formula nesting exceeds ${MAX_DEPTH}`, tokens[0]);
    if (node.body) pending.push([node.body, structuralDepth + 1]);
    else if (binary.has(node.type)) {
      pending.push([node.left, structuralDepth + 1], [node.right, structuralDepth + 1]);
    }
  }
  return ast;
}

/** Return the set of variable names which occur free in an AST. */
export function freeVariables(ast) {
  const free = new Set();
  const bound = new Map();
  const visitTerm = (term) => {
    if (term?.type === 'var' && !bound.has(term.name)) free.add(term.name);
  };
  function visit(node, depth = 0) {
    if (depth > MAX_DEPTH) throw new RangeError(`Formula nesting exceeds ${MAX_DEPTH}`);
    if (!node || typeof node !== 'object') throw new TypeError('Expected a formula AST');
    if (node.type === 'atom') node.args.forEach(visitTerm);
    else if (node.type === 'eq') { visitTerm(node.left); visitTerm(node.right); }
    else if (quantifiers.has(node.type)) {
      bound.set(node.variable, (bound.get(node.variable) ?? 0) + 1);
      visit(node.body, depth + 1);
      const remaining = bound.get(node.variable) - 1;
      if (remaining) bound.set(node.variable, remaining); else bound.delete(node.variable);
    } else if (binary.has(node.type)) { visit(node.left, depth + 1); visit(node.right, depth + 1); }
    else if (prefixes.has(node.type)) visit(node.body, depth + 1);
    else if (node.type === 'dia' || node.type === 'box') { node.learners.forEach(visitTerm); visit(node.body, depth + 1); }
    else if (!['true','false','seq'].includes(node.type)) throw new TypeError(`Unknown formula AST node ${JSON.stringify(node.type)}`);
  }
  visit(ast);
  return free;
}

/** Render a lossless, unambiguous ASCII formula. */
export function printFormula(ast) {
  const printTerm = (term) => {
    if (term?.type === 'value' && typeof term.value === 'string') return JSON.stringify(term.value);
    if (term?.type === 'var' && variableNamePattern.test(term.name)) return `?${term.name}`;
    throw new TypeError('Invalid formula term');
  };
  const operators = {and:'and', or:'or', implies:'->', iff:'<->'};
  function print(node, depth = 0) {
    if (depth > MAX_DEPTH) throw new RangeError(`Formula nesting exceeds ${MAX_DEPTH}`);
    if (!node || typeof node !== 'object') throw new TypeError('Expected a formula AST');
    if (['true','false','seq'].includes(node.type)) return node.type;
    if (node.type === 'atom') {
      if (typeof node.symbol !== 'string') throw new TypeError('Invalid atom symbol');
      const quoted = !variableNamePattern.test(node.symbol) || words.has(node.symbol);
      const symbol = quoted ? JSON.stringify(node.symbol) : node.symbol;
      return node.args.length || quoted ? `${symbol}(${node.args.map(printTerm).join(', ')})` : symbol;
    }
    if (node.type === 'eq') return `(${printTerm(node.left)} = ${printTerm(node.right)})`;
    if (prefixes.has(node.type)) return `${node.type}(${print(node.body, depth + 1)})`;
    if (binary.has(node.type)) return `(${print(node.left, depth + 1)} ${operators[node.type]} ${print(node.right, depth + 1)})`;
    if (quantifiers.has(node.type)) {
      if (!variableNamePattern.test(node.variable)) throw new TypeError('Invalid bound variable name');
      return `(${node.type} ${node.variable}. ${print(node.body, depth + 1)})`;
    }
    if (node.type === 'dia' || node.type === 'box') return `${node.type}[${node.learners.map(printTerm).join(', ')}](${print(node.body, depth + 1)})`;
    throw new TypeError(`Unknown formula AST node ${JSON.stringify(node.type)}`);
  }
  return print(ast);
}
