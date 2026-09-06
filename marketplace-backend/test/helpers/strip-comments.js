// Removes JS comments WITHOUT walking into strings.
//
// The obvious one-liner — `src.replace(/\/\*[\s\S]*?\*\//g, ' ')` — is wrong on
// this codebase and dangerously so: a `/*` inside a string (CSS-in-JS, a URL, a
// regex) makes it swallow everything up to the next `*/`. On studio-shell.js that
// deleted 100,250 characters, 27% of the file. Assertions then pass or fail for
// reasons that have nothing to do with the code, and a `doesNotMatch` passes
// vacuously because the text it was looking for was eaten.
//
// So track the quoting state and only treat `//` and `/*` as comments when they
// are actually in code.
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    const next = src[i + 1]

    // Strings and template literals are copied through untouched.
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      out += ch
      i++
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue }
        out += src[i]
        if (src[i] === quote) { i++; break }
        i++
      }
      continue
    }

    if (ch === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++
      out += ' '
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      out += ' '
      continue
    }

    out += ch
    i++
  }
  return out
}
