// SimilarWeb Proxy Server for Traffic Lens
// Deployed on Render.com (Google Cloud infrastructure) to bypass CloudFront IP blocks
// on Cloudflare/Netlify/AWS IP ranges.

import { createServer } from 'node:http';

const PORT = process.env.PORT || 3000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Simple in-memory cache (12 hour TTL)
const cache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

function getCached(domain) {
  const entry = cache.get(domain);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(domain);
    return null;
  }
  return entry.data;
}

function setCached(domain, data) {
  cache.set(domain, { data, ts: Date.now() });
  // Prune oldest entries if cache gets too large
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

async function fetchSimilarWeb(domain) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`https://data.similarweb.com/api/v1/data?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    return { status: res.status, body: text };
  } catch (e) {
    clearTimeout(timeout);
    return { status: 500, body: JSON.stringify({ error: String(e.message || e) }) };
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // Health check
  if (url.pathname === '/' || url.pathname === '/health') {
    res.writeHead(200, CORS_HEADERS);
    res.end(JSON.stringify({
      status: 'ok',
      service: 'sw-proxy-render',
      cache_size: cache.size,
      uptime: process.uptime(),
    }));
    return;
  }

  // Main endpoint: /api/sw?domain=example.com
  if (url.pathname === '/api/sw') {
    const domain = url.searchParams.get('domain');
    if (!domain) {
      res.writeHead(400, CORS_HEADERS);
      res.end(JSON.stringify({ error: 'Missing ?domain= param' }));
      return;
    }

    const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');

    // Check cache first
    const cached = getCached(cleanDomain);
    if (cached) {
      res.writeHead(200, { ...CORS_HEADERS, 'X-Cache': 'HIT' });
      res.end(cached);
      return;
    }

    // Fetch from SimilarWeb
    const { status, body } = await fetchSimilarWeb(cleanDomain);

    // Only cache successful responses with actual data
    if (status === 200 && body.startsWith('{') && body.includes('SiteName')) {
      setCached(cleanDomain, body);
    }

    res.writeHead(status, { ...CORS_HEADERS, 'X-Cache': 'MISS', 'Cache-Control': 'public, max-age=43200' });
    res.end(body);
    return;
  }

  res.writeHead(404, CORS_HEADERS);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`SW Proxy running on port ${PORT}`);
});
