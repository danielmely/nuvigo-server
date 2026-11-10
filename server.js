const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const accounts = require('./accounts');
const reports = require('./reports');

const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const KEY = process.env.TMDB_API_KEY || '';
const OMDB = process.env.OMDB_API_KEY || '';
const cache = new Map();
const infoCache = new Map();
let providerLogos = null;

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function posterPath(title, year, type) {
  const k = `${type}|${title}|${year}`;
  if (cache.has(k)) return cache.get(k);
  const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';
  const q = `https://api.themoviedb.org/3/search/${type}?api_key=${KEY}&query=${encodeURIComponent(title)}&${yearParam}=${encodeURIComponent(year)}`;
  const data = await getJSON(q);
  const hit = (data.results || []).find((r) => r.poster_path);
  const path = hit ? hit.poster_path : null;
  cache.set(k, path);
  return path;
}

async function info(title, year, type) {
  const k = `${type}|${title}|${year}`;
  if (infoCache.has(k)) return infoCache.get(k);
  const q = `https://www.omdbapi.com/?apikey=${OMDB}&t=${encodeURIComponent(title)}&y=${encodeURIComponent(year)}&type=${type}&plot=short`;
  const d = await getJSON(q);
  const ok = (v) => (v && v !== 'N/A' ? v : null);
  let out = null;
  if (d && d.Response === 'True') {
    const rt = (d.Ratings || []).find((r) => r.Source === 'Rotten Tomatoes');
    let votes = ok(d.imdbVotes);
    if (votes) {
      const n = Number(votes.replace(/,/g, ''));
      votes = n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);
    }
    const director = ok(d.Director) ? d.Director.split(',')[0].replace(/\s*\(.*\)/, '').trim() : null;
    const cast = ok(d.Actors) ? d.Actors.split(',').slice(0, 3).map((a) => a.trim()) : [];
    out = { plot: ok(d.Plot), imdb: ok(d.imdbRating), votes, rt: rt ? rt.Value : null, director, cast };
  }
  infoCache.set(k, out);
  return out;
}

// Accounts need DATABASE_URL and JWT_SECRET; without them the demo still runs and /api/auth/* says so.
let acc = null;
let pool = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /railway\.internal|localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false },
  });
}
if (pool && process.env.JWT_SECRET) {
  acc = accounts.create({ query: (t, p) => pool.query(t, p), secret: process.env.JWT_SECRET });
  acc.init().then(() => console.log('accounts ready')).catch((e) => { console.error('accounts init failed', e); acc = null; });
}

// Error reports work with or without a database. ADMIN_KEY protects GET /api/reports.
const rep = reports.create({ query: pool ? (t, p) => pool.query(t, p) : null, adminKey: process.env.ADMIN_KEY || '' });
rep.init().then(() => pool && console.log('reports ready')).catch((e) => console.error('reports init failed', e.message));

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if ((u.pathname === '/api/report' || u.pathname === '/api/reports') && (await rep.handle(req, res, u))) return;
  if (u.pathname === '/api/me' || u.pathname.startsWith('/api/auth/') || u.pathname.startsWith('/api/sync')) {
    if (!acc) { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"error":"Accounts are not set up on this server yet."}'); }
    if (await acc.handle(req, res, u)) return;
  }
  if (u.pathname === '/api/info') {
    if (!OMDB) { res.writeHead(404); return res.end(); }
    try {
      const type = u.searchParams.get('type') === 'series' ? 'series' : 'movie';
      const out = await info(u.searchParams.get('title') || '', u.searchParams.get('year') || '', type);
      if (!out) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' });
      return res.end(JSON.stringify(out));
    } catch (e) { res.writeHead(502); return res.end(); }
  }
  if (u.pathname === '/api/providers') {
    if (!KEY) { res.writeHead(404); return res.end(); }
    try {
      if (!providerLogos) {
        const out = {};
        for (const kind of ['movie', 'tv']) {
          const d = await getJSON(`https://api.themoviedb.org/3/watch/providers/${kind}?api_key=${KEY}&watch_region=US`);
          for (const r of d.results || []) {
            if (r.logo_path && !out[r.provider_id]) out[r.provider_id] = `https://image.tmdb.org/t/p/w154${r.logo_path}`;
          }
        }
        providerLogos = out;
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' });
      return res.end(JSON.stringify(providerLogos));
    } catch (e) { res.writeHead(502); return res.end(); }
  }
  if (u.pathname === '/api/poster') {
    if (!KEY) { res.writeHead(404); return res.end(); }
    try {
      const type = u.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const pp = await posterPath(u.searchParams.get('title') || '', u.searchParams.get('year') || '', type);
      if (!pp) { res.writeHead(404); return res.end(); }
      const size = u.searchParams.get('size') === 'original' ? 'original' : 'w780';
      const url = `https://image.tmdb.org/t/p/${size}${pp}`;
      res.writeHead(302, { Location: url, 'Cache-Control': 'public, max-age=86400' });
      return res.end();
    } catch (e) { res.writeHead(502); return res.end(); }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(page);
}).listen(process.env.PORT || 3000, '0.0.0.0');
