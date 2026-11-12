// Run with: npm test   (uses an in-memory Postgres, so no database is needed)
const http = require('http');
const assert = require('assert');
const { newDb } = require('pg-mem');
const accounts = require('../accounts');

(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const sent = [];
  const acc = accounts.create({ query: (t, p) => pool.query(t, p), secret: 'test-secret-test-secret', sendMail: async (to, subject, text) => { sent.push({ to, subject, text }); } });
  await acc.init();
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!(await acc.handle(req, res, u))) { res.writeHead(404); res.end(); }
  }).listen(0);
  const port = server.address().port;

  let fwd = '10.0.0.1';
  const call = (method, path, body, token) => new Promise((resolve) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ port, method, path, headers: { 'X-Forwarded-For': fwd, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) } }, (res) => {
      let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d ? JSON.parse(d) : null }));
    });
    if (data) r.write(data); r.end();
  });

  let r = await call('POST', '/api/auth/register', { email: 'bad', password: 'longenough1' }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { email: 'a@b.co', password: 'short' }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/register', { email: 'A@B.co', password: 'longenough1' }); assert.equal(r.status, 201);
  const token = r.body.token;
  r = await call('POST', '/api/auth/register', { email: 'a@b.co', password: 'longenough1' }); assert.equal(r.status, 409);
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'wrongpass1' }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'longenough1' }); assert.equal(r.status, 200);
  r = await call('GET', '/api/me'); assert.equal(r.status, 401);
  r = await call('GET', '/api/me', undefined, token); assert.equal(r.status, 200); assert.equal(r.body.user.email, 'a@b.co');

  r = await call('PUT', '/api/sync/addons', { data: ['https://x/manifest.json'] }, token); assert.equal(r.status, 200); assert.equal(r.body.version, 1);
  r = await call('PUT', '/api/sync/addons', { data: ['https://y/manifest.json'] }, token); assert.equal(r.body.version, 2);
  r = await call('PUT', '/api/sync/links', { data: { 'trakt.token': 'SECRET' } }, token); assert.equal(r.status, 200);
  r = await call('PUT', '/api/sync/bogus', { data: 1 }, token); assert.equal(r.status, 404);
  r = await call('GET', '/api/sync', undefined, token);
  assert.deepEqual(r.body.keys.addons.data, ['https://y/manifest.json']);
  assert.equal(r.body.keys.links.data['trakt.token'], 'SECRET');
  const raw = (await pool.query("SELECT value FROM user_data WHERE key='links'")).rows[0].value;
  assert(!raw.includes('SECRET'), 'links must be encrypted at rest');

  // Password reset
  r = await call('POST', '/api/auth/forgot', { email: 'nobody@b.co' }); assert.equal(r.status, 200); assert.equal(sent.length, 0, 'no email for unknown accounts');
  r = await call('POST', '/api/auth/forgot', { email: 'bad' }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/forgot', { email: 'a@b.co' }); assert.equal(r.status, 200); assert.equal(sent.length, 1);
  const code = sent[0].text.match(/\b(\d{6})\b/)[1];
  r = await call('POST', '/api/auth/forgot', { email: 'a@b.co' }); assert.equal(sent.length, 1, 'cooldown blocks a second email');
  r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code: code === '000000' ? '111111' : '000000', password: 'newpassword1' }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code, password: 'short' }); assert.equal(r.status, 400);
  r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code, password: 'newpassword1' }); assert.equal(r.status, 200); assert(r.body.token);
  r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code, password: 'another-pass1' }); assert.equal(r.status, 400, 'code works only once');
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'longenough1' }); assert.equal(r.status, 401);
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'newpassword1' }); assert.equal(r.status, 200);
  // too many wrong guesses burns the code (a fresh address, so the per-IP limiter isn't what answers)
  fwd = '10.0.0.2';
  await pool.query('DELETE FROM password_resets');
  await pool.query("INSERT INTO password_resets (user_id, code_hash, expires_at, created_at) SELECT id, 'x', now() + interval '10 minutes', now() - interval '5 minutes' FROM users WHERE email='a@b.co'");
  r = await call('POST', '/api/auth/forgot', { email: 'a@b.co' }); assert.equal(sent.length, 2);
  const code2 = sent[1].text.match(/\b(\d{6})\b/)[1];
  const wrong = code2 === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) { r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code: wrong, password: 'newpassword2' }); assert.equal(r.status, 400); }
  r = await call('POST', '/api/auth/reset', { email: 'a@b.co', code: code2, password: 'newpassword2' }); assert.equal(r.status, 400, 'five wrong tries burn the code');
  // without a mailer, forgot says so
  const acc2 = accounts.create({ query: (t, p) => pool.query(t, p), secret: 'test-secret-test-secret' });
  const fakeRes = { s: 0, writeHead(s) { this.s = s; }, end() {} };
  const fakeReq = Object.assign(require('stream').Readable.from([]), { method: 'POST', headers: {}, socket: {} });
  await acc2.handle(fakeReq, fakeRes, new URL('http://x/api/auth/forgot')); assert.equal(fakeRes.s, 503);

  r = await call('DELETE', '/api/me', { password: 'nope' }, token); assert.equal(r.status, 403);
  r = await call('DELETE', '/api/me', { password: 'newpassword1' }, token); assert.equal(r.status, 200);
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'newpassword1' }); assert.equal(r.status, 401);
  assert.equal((await pool.query('SELECT count(*) AS n FROM user_data')).rows[0].n, 0);

  console.log('all account tests passed');
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
