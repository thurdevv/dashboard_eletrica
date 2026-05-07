// Browser stub for Node.js 'path' — xeokit uses path.normalize() when
// loading local files; we return the string unchanged for URL-based loading.
module.exports = {
  normalize: (p) => p,
  join:      (...parts) => parts.join('/'),
  dirname:   (p) => p.split('/').slice(0, -1).join('/') || '.',
  basename:  (p) => p.split('/').pop() ?? p,
  extname:   (p) => { const b = p.split('/').pop() ?? ''; const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : '' },
  sep:       '/',
  delimiter: ':',
}
