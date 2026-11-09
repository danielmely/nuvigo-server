// NuviGo accounts: email + password sign-up and sign-in, and per-user synced data.
// Needs two Railway variables: DATABASE_URL (from the Postgres add-on) and JWT_SECRET (a long random string).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const KEYS = ['addons', 'progress', 'settings', 'links', 'watched']; // what an account syncs
const MAX_BODY = 1024 * 1024;
const TOKEN_DAYS = 90;

function create({ query, secret }) {
  const encKey = crypto.createHash('sha256').update('nuvigo-links:' + secret).digest();

  function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
    return Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
  }
  function decrypt(b64) {
    const raw = Buffer.from(b64, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
  }

  async function init() {
    await query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await query(`CREATE TABLE IF NOT EXISTS user_data (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, key))`);
  }

  // Simple per-IP limiter for sign-in and sign-up attempts.
  const attempts = new Map();
  function limited(ip) {
    const now = Date.now();
    const list = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
    list.push(now);
    attempts.set(ip, list);
    return list.length > 20;
  }

  const sign = (id) => jwt.sign({ uid: id }, secret, { expiresIn: `${TOKEN_DAYS}d` });

  function authed(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    try { return jwt.verify(h.slice(7), secret).uid; } catch { return null; }
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
        catch { reject(Object.assign(new Error('bad json'), { status: 400 })); }
      });
      req.on('error', reject);
    });
  }

  const send = (res, status, obj) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(obj));
  };
  const fail = (res, status, message) => send(res, status, { error: message });

  /** Returns true when it handled the request. */
  async function handle(req, res, url) {
    const p = url.pathname;
    if (!(p === '/api/me' || p.startsWith('/api/auth/') || p.startsWith('/api/sync'))) return false;
    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '?';

      if (req.method === 'POST' && (p === '/api/auth/register' || p === '/api/auth/login')) {
        if (limited(ip)) return fail(res, 429, 'Too many attempts. Try again in a few minutes.'), true;
        const body = await readBody(req);
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail(res, 400, 'Enter a valid email address.'), true;

        if (p.endsWith('register')) {
          if (password.length < 8 || password.length > 200) return fail(res, 400, 'Use a password with at least 8 characters.'), true;
          const hash = await bcrypt.hash(password, 10);
          try {
            const r = await query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, hash]);
            return send(res, 201, { token: sign(r.rows[0].id), user: { id: r.rows[0].id, email } }), true;
          } catch (e) {
            if (String(e.code) === '23505' || /unique|duplicate/i.test(String(e.message))) return fail(res, 409, 'An account with that email already exists.'), true;
            throw e;
          }
        }
        const r = await query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
        const row = r.rows[0];
        const ok = row ? await bcrypt.compare(password, row.password_hash) : await bcrypt.compare(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali');
        if (!row || !ok) return fail(res, 401, 'Wrong email or password.'), true;
        return send(res, 200, { token: sign(row.id), user: { id: row.id, email } }), true;
      }

      const uid = authed(req);
      if (!uid) return fail(res, 401, 'Please sign in again.'), true;

      if (p === '/api/me' && req.method === 'GET') {
        const r = await query('SELECT id, email FROM users WHERE id = $1', [uid]);
        if (!r.rows[0]) return fail(res, 401, 'Please sign in again.'), true;
        return send(res, 200, { user: r.rows[0] }), true;
      }

      if (p === '/api/me' && req.method === 'DELETE') {
        const body = await readBody(req);
        const r = await query('SELECT password_hash FROM users WHERE id = $1', [uid]);
        if (!r.rows[0] || !(await bcrypt.compare(String(body.password || ''), r.rows[0].password_hash))) return fail(res, 403, 'Wrong password.'), true;
        await query('DELETE FROM user_data WHERE user_id = $1', [uid]);
        await query('DELETE FROM users WHERE id = $1', [uid]);
        return send(res, 200, { ok: true }), true;
      }

      if (p === '/api/sync' && req.method === 'GET') {
        const r = await query('SELECT key, value, version FROM user_data WHERE user_id = $1', [uid]);
        const keys = {};
        for (const row of r.rows) {
          let data;
          try { data = JSON.parse(row.key === 'links' ? decrypt(row.value) : row.value); } catch { continue; }
          keys[row.key] = { version: row.version, data };
        }
        return send(res, 200, { keys }), true;
      }

      const m = p.match(/^\/api\/sync\/([a-z]+)$/);
      if (m && req.method === 'PUT') {
        const key = m[1];
        if (!KEYS.includes(key)) return fail(res, 404, 'Unknown key.'), true;
        const body = await readBody(req);
        if (body.data === undefined) return fail(res, 400, 'Missing data.'), true;
        const json = JSON.stringify(body.data);
        const value = key === 'links' ? encrypt(json) : json;
        const r = await query(
          `INSERT INTO user_data (user_id, key, value, version) VALUES ($1, $2, $3, 1)
           ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, version = user_data.version + 1, updated_at = now()
           RETURNING version`, [uid, key, value]);
        return send(res, 200, { version: r.rows[0].version }), true;
      }

      return fail(res, 404, 'Not found.'), true;
    } catch (e) {
      if (e.status) return fail(res, e.status, e.message), true;
      console.error('accounts error', e);
      return fail(res, 500, 'Something went wrong. Try again.'), true;
    }
  }

  return { init, handle };
}

module.exports = { create };
