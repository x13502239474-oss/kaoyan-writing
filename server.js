/**
 * 零依赖静态服务器 —— npm start 即可运行，无需 npm install
 * 局域网可访问（手机与电脑同一 Wi-Fi），PWA 在 localhost / LAN http 下可注册
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const START_PORT = Number(process.env.PORT || 5183);
const MAX_TRY = 30;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2'
};

function safeResolve(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); }
  catch { return null; }
  if (p.includes('\0')) return null;
  const full = path.resolve(ROOT, '.' + (p === '/' ? '/index.html' : p));
  // 防目录穿越
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return null;
  return full;
}

function lanIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const i of ifaces[name] || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Method Not Allowed');
  }
  let file = safeResolve(req.url || '/');
  if (!file) { res.writeHead(400); return res.end('Bad Request'); }

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err2, buf) => {
      if (err2) {
        // 无扩展名的路径回退到首页（便于未来改用 history 路由）
        const ext = path.extname(file);
        if (!ext) {
          fs.readFile(path.join(ROOT, 'index.html'), (e3, b3) => {
            if (e3) { res.writeHead(404); return res.end('Not Found'); }
            res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
            return res.end(req.method === 'HEAD' ? undefined : b3);
          });
          return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('404 Not Found: ' + path.basename(file));
      }
      const ext = path.extname(file).toLowerCase();
      const headers = {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': (ext === '.png' || ext === '.svg' || ext === '.ico') ? 'public, max-age=86400' : 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      };
      res.writeHead(200, headers);
      res.end(req.method === 'HEAD' ? undefined : buf);
    });
  });
});

function listen(port, attempt) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attempt < MAX_TRY) {
      console.log(`端口 ${port} 被占用，尝试 ${port + 1} ...`);
      listen(port + 1, attempt + 1);
    } else {
      console.error('启动失败：', e.message);
      process.exit(1);
    }
  });
  server.listen(port, '0.0.0.0', () => {
    console.log('');
    console.log('  ✅ 考研写作自学网站已启动');
    console.log(`  ➜ 电脑访问:  http://localhost:${port}/`);
    lanIPs().forEach(ip => console.log(`  ➜ 手机访问:  http://${ip}:${port}/  (需同一 Wi-Fi)`));
    console.log('');
    console.log('  按 Ctrl+C 停止服务');
    console.log('');
  });
}
listen(START_PORT, 0);
