// Learn more https://docs.expo.dev/guides/customizing-metro
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Dev only: forward /echo-api/* to the Worker on this machine (`npm run dev` in ../echo-api).
// The phone already reaches Metro, so routing through it avoids a second LAN port
// that iOS or the network may block.
const API_PREFIX = '/echo-api';
const API_TARGET = { host: '127.0.0.1', port: 8787 };

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url.startsWith(API_PREFIX + '/')) return middleware(req, res, next);
    console.log(`[echo-api proxy] ${req.method} ${req.url}`);
    const upstream = http.request(
      {
        ...API_TARGET,
        method: req.method,
        path: req.url.slice(API_PREFIX.length),
        headers: { ...req.headers, host: `${API_TARGET.host}:${API_TARGET.port}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res);
      },
    );
    upstream.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AI server is not running. Start it with `npm run dev` in echo-api.' }));
    });
    req.pipe(upstream);
  },
};

module.exports = config;
