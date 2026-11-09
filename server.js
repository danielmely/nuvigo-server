const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const page = fs.readFileSync(path.join(__dirname, 'index.html'));
const KEY = process.env.TMDB_API_KEY || '';
const cache = new Map();

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
  const url = hit ? `https://image.tmdb.org/t/p/w342${hit.poster_path}` : null;
  cache.set(k, url);
  return url;
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
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
