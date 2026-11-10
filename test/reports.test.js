const test = require('node:test');
const assert = require('node:assert');
const { Readable } = require('node:stream');
const reports = require('../reports');

function fakeReq(method, body, ip = '1.1.1.1', headers = {}) {
  const r = Readable.from(body ? [Buffer.from(body)] : []);
  r.method = method; r.headers = Object.assign({ 'x-forwarded-for': ip }, headers); r.socket = { remoteAddress: ip };
  return r;
}
function fakeRes() { return { code: 0, body: '', writeHead(c) { this.code = c; }, end(b) { this.body = b || ''; } }; }
const url = (p) => new URL(p, 'http://x');

test('stores a report and trims fields', async () => {
  const r = reports.create({ query: null, adminKey: 'k' });
  const res = fakeRes();
  await r.handle(fakeReq('POST', JSON.stringify({ message: 'x'.repeat(900), app: '1.0' })), res, url('/api/report'));
  assert.equal(res.code, 204);
  assert.equal(r._recent[0].message.length, 500);
});

test('rejects empty and bad json', async () => {
  const r = reports.create({ query: null, adminKey: 'k' });
  let res = fakeRes();
  await r.handle(fakeReq('POST', '{"message":""}'), res, url('/api/report')); assert.equal(res.code, 400);
  res = fakeRes();
  await r.handle(fakeReq('POST', 'nope'), res, url('/api/report')); assert.equal(res.code, 400);
});

test('rate limits per ip', async () => {
  const r = reports.create({ query: null, adminKey: 'k' });
  let last;
  for (let i = 0; i < 31; i++) { last = fakeRes(); await r.handle(fakeReq('POST', '{"message":"m"}', '9.9.9.9'), last, url('/api/report')); }
  assert.equal(last.code, 429);
});

test('listing needs the admin key', async () => {
  const r = reports.create({ query: null, adminKey: 'secret' });
  await r.handle(fakeReq('POST', '{"message":"hello"}'), fakeRes(), url('/api/report'));
  let res = fakeRes();
  await r.handle(fakeReq('GET', ''), res, url('/api/reports?key=wrong')); assert.equal(res.code, 404);
  res = fakeRes();
  await r.handle(fakeReq('GET', ''), res, url('/api/reports?key=secret')); assert.equal(res.code, 200);
  assert.equal(JSON.parse(res.body)[0].message, 'hello');
});
