// Anonymous error reports from the app. Stored in Postgres when a database is
// configured, always kept in a small in-memory list and printed to the logs.
// No account, email, IP address or viewing data is stored.
const MAX_BODY = 8 * 1024;
const KEEP = 500;
const PER_HOUR = 30;
const KEEP_DAYS = 90;

function clip(v, n) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f]+/g, ' ').slice(0, n) : '';
}

function create({ query, adminKey }) {
  const recent = [];
  const hits = new Map(); // ip -> [timestamps]
  let ready = false;

  async function init() {
    if (!query) return;
    await query(`CREATE TABLE IF NOT EXISTS error_reports (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      kind TEXT, message TEXT, context TEXT, app TEXT, os TEXT, device TEXT
    )`);
    ready = true;
    await purge();
    setInterval(purge, 24 * 3600e3).unref();
  }

  // Reports are deleted after KEEP_DAYS days.
  async function purge() {
    if (!ready) return;
    try { await query(`DELETE FROM error_reports WHERE created_at < now() - ($1 || ' days')::interval`, [String(KEEP_DAYS)]); }
    catch (e) { console.error('report purge failed', e.message); }
  }

  function limited(ip) {
    const now = Date.now();
    const list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (list.length >= PER_HOUR) { hits.set(ip, list); return true; }
    list.push(now); hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    return false;
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let d = '';
      req.on('data', (c) => { d += c; if (d.length > MAX_BODY) { reject(new Error('too big')); req.destroy(); } });
      req.on('end', () => resolve(d));
      req.on('error', reject);
    });
  }

  async function handle(req, res, u) {
    if (u.pathname === '/api/report' && req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (limited(ip)) { res.writeHead(429); res.end(); return true; }
      let b;
      try { b = JSON.parse(await readBody(req)); } catch (e) { res.writeHead(400); res.end(); return true; }
      const r = {
        at: new Date().toISOString(),
        kind: clip(b.kind, 40) || 'error',
        message: clip(b.message, 500),
        context: clip(b.context, 1000),
        app: clip(b.app, 40),
        os: clip(b.os, 40),
        device: clip(b.device, 60),
      };
      if (!r.message) { res.writeHead(400); res.end(); return true; }
      recent.unshift(r); if (recent.length > KEEP) recent.pop();
      console.log('report', JSON.stringify(r));
      if (ready) {
        query('INSERT INTO error_reports (kind,message,context,app,os,device) VALUES ($1,$2,$3,$4,$5,$6)',
          [r.kind, r.message, r.context, r.app, r.os, r.device]).catch((e) => console.error('report save failed', e.message));
      }
      res.writeHead(204); res.end();
      return true;
    }
    if (u.pathname === '/api/reports' && req.method === 'GET') {
      const key = req.headers['x-admin-key'] || u.searchParams.get('key') || '';
      if (!adminKey || key !== adminKey) { res.writeHead(404); res.end(); return true; }
      let rows = recent;
      if (ready) {
        try { rows = (await query('SELECT created_at AS at, kind, message, context, app, os, device FROM error_reports ORDER BY id DESC LIMIT 200')).rows; } catch (e) { /* fall back to memory */ }
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows, null, 2));
      return true;
    }
    return false;
  }

  return { init, handle, purge, _recent: recent };
}

module.exports = { create };
