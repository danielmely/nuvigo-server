const test = require('node:test');
const assert = require('node:assert');
const legal = require('../legal');

function call(method, path) {
  let status, body = '';
  const res = { writeHead: (s) => { status = s; }, end: (b) => { body = b || ''; } };
  const hit = legal.handle({ method }, res, path);
  return { hit, status, body };
}

test('serves each legal page', () => {
  for (const p of ['/privacy', '/terms', '/support', '/copyright', '/acknowledgements', '/dmca', '/privacy/']) {
    const r = call('GET', p);
    assert.ok(r.hit, p); assert.strictEqual(r.status, 200); assert.match(r.body, /<h1>/);
  }
});
test('ignores other paths and methods', () => {
  assert.strictEqual(call('GET', '/api/me').hit, false);
  assert.strictEqual(call('POST', '/privacy').hit, false);
});
test('TMDB attribution present', () => {
  assert.match(call('GET', '/acknowledgements').body, /not endorsed or certified by TMDB/);
});
