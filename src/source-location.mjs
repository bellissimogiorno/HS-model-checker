/** Source coordinates use one-based Unicode-code-point columns. Browser
 * textarea selections and parser indices use UTF-16 offsets. Keep the boundary
 * explicit, including CRLF/CR input and characters outside the BMP. */
function requireSource(source) {
  if (typeof source !== 'string') throw new TypeError('Source must be a string.');
}

export function sourcePosition(source, index) {
  requireSource(source);
  if (!Number.isSafeInteger(index)) throw new TypeError('Source index must be a safe integer.');
  const offset = Math.max(0, Math.min(index, source.length));
  let line = 1, start = 0;
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    if (match.index >= offset) break;
    line++; start = match.index + match[0].length;
  }
  return {line, column: Array.from(source.slice(start, offset)).length + 1};
}

export function sourceOffset(source, {line = 1, column = 1} = {}) {
  requireSource(source);
  if (!Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) {
    throw new TypeError('Source line and column must be positive safe integers.');
  }
  let current = 1, start = 0, end = source.length;
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    if (current === line) { end = match.index; break; }
    current++; start = match.index + match[0].length;
  }
  if (line > current) return source.length;
  return start + Array.from(source.slice(start, end)).slice(0, column - 1).join('').length;
}
