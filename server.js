const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const KEY = process.env.TMDB_API_KEY || '';
const OMDB = process.env.OMDB_API_KEY || '';
const cache = new Map();
const infoCache = new Map();

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function posterURL(title, year, type) {
  const k = `${type}|${title}|${year}`;
  if (cache.has(k)) return cache.get(k);
  const yearParam = type === 'tv' ? 'first_air_date_year' : 'year';
  const q = `https://api.themoviedb.org/3/search/${type}?api_key=${KEY}&query=${encodeURIComponent(title)}&${yearParam}=${encodeURIComponent(year)}`;
  const data = await getJSON(q);
  const hit = (data.results || []).find((r) => r.poster_path);
  const url = hit ? `https://image.tmdb.org/t/p/w780${hit.poster_path}` : null;
  cache.set(k, url);
  return url;
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
    out = { plot: ok(d.Plot), imdb: ok(d.imdbRating), votes, rt: rt ? rt.Value : null };
  }
  infoCache.set(k, out);
  return out;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/info') {
    if (!OMDB) { res.writeHead(404); return res.end(); }
    try {
      const type = u.searchParams.get('type') === 'series' ? 'series' : 'movie';
      const out = await info(u.searchParams.get('title') || '', u.searchParams.get('year') || '', type);
      if (!out) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' });
      return res.end(JSON.stringify(out));
    } catch (e) { res.writeHead(502); return res.end(); }
  }
  if (u.pathname === '/api/poster') {
    if (!KEY) { res.writeHead(404); return res.end(); }
    try {
      const type = u.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
      const url = await posterURL(u.searchParams.get('title') || '', u.searchParams.get('year') || '', type);
      if (!url) { res.writeHead(404); return res.end(); }
      res.writeHead(302, { Location: url, 'Cache-Control': 'public, max-age=86400' });
      return res.end();
    } catch (e) { res.writeHead(502); return res.end(); }
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
  res.end(page);
}).listen(process.env.PORT || 3000, '0.0.0.0');
