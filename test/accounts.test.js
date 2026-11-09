// Run with: npm test   (uses an in-memory Postgres, so no database is needed)
const http = require('http');
const assert = require('assert');
const { newDb } = require('pg-mem');
const accounts = require('../accounts');

(async () => {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  const acc = accounts.create({ query: (t, p) => pool.query(t, p), secret: 'test-secret-test-secret' });
  await acc.init();
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (!(await acc.handle(req, res, u))) { res.writeHead(404); res.end(); }
  }).listen(0);
  const port = server.address().port;

  const call = (method, path, body, token) => new Promise((resolve) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ port, method, path, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) } }, (res) => {
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

  r = await call('DELETE', '/api/me', { password: 'nope' }, token); assert.equal(r.status, 403);
  r = await call('DELETE', '/api/me', { password: 'longenough1' }, token); assert.equal(r.status, 200);
  r = await call('POST', '/api/auth/login', { email: 'a@b.co', password: 'longenough1' }); assert.equal(r.status, 401);
  assert.equal((await pool.query('SELECT count(*) AS n FROM user_data')).rows[0].n, 0);

  console.log('all account tests passed');
  server.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
