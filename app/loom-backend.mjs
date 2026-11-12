// Same-origin Loom bridge for both Vite dev and production preview.
// Node's HTTP client handles chunked responses, status codes and long agent runs.
export function loomBackend({ baseUrl = process.env.LOOM_URL || 'http://127.0.0.1:5006', token = process.env.LOOM_API_TOKEN } = {}) {
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    if (!path?.startsWith('/api/loom/')) return next();
    res.setHeader('Content-Type', 'application/json');
    const route = path.slice('/api/loom'.length);
    if (!((route === '/health' && req.method === 'GET') || (route === '/v1/weave' && req.method === 'POST'))) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ message: 'Unknown Loom operation.' }));
    }
    try {
      let body;
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 65536) {
            res.statusCode = 413;
            return res.end(JSON.stringify({ message: 'Message is too long.' }));
          }
        }
        let value;
        try { value = JSON.parse(raw); } catch {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Invalid JSON request.' }));
        }
        if (typeof value.query !== 'string' || !value.query.trim()) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ message: 'Enter a message first.' }));
        }
        body = JSON.stringify({ query: value.query, ...(process.env.LOOM_AGENT_ID ? { agent_id: process.env.LOOM_AGENT_ID } : {}) });
      }
      const upstream = await fetch(`${baseUrl.replace(/\/$/, '')}${route}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body,
        signal: AbortSignal.timeout(body ? 180000 : 4000),
      });
      const text = await upstream.text();
      let value;
      try { value = JSON.parse(text); } catch { throw new Error('Loom returned an unreadable response. Check LOOM_URL.'); }
      res.statusCode = upstream.status;
      res.end(JSON.stringify(value));
    } catch (error) {
      res.statusCode = 502;
      res.end(JSON.stringify({ message: `Loom is unavailable. Run looms serve --http-port 5006, or set LOOM_URL. ${error.message}` }));
    }
  };
}

export function loomPlugin() {
  return {
    name: 'loom-backend',
    configureServer(server) { server.middlewares.use(loomBackend()); },
    configurePreviewServer(server) { server.middlewares.use(loomBackend()); },
  };
}
