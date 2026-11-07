/* 真实浏览器端到端冒烟测试：npm test
   自行拉起静态服务器 → 无头 Chrome 打开测试页 → 解析 SMOKE_RESULT → 输出报告 */
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 5199);
const URL = `http://127.0.0.1:${PORT}/tools/browser-test.html`;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));

const sleep = ms => new Promise(r => setTimeout(r, ms));
function ping() {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${PORT}/index.html`, res => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  if (!CHROME) { console.error('未找到 Chrome / Edge，无法运行浏览器测试'); process.exit(2); }
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', b => { serverLog += b.toString(); });
  server.stderr.on('data', b => { serverLog += b.toString(); });

  let up = false;
  for (let i = 0; i < 40; i++) { if (await ping()) { up = true; break; } await sleep(200); }
  if (!up) { console.error('测试服务器启动失败:\n' + serverLog); server.kill(); process.exit(2); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ky-writing-test-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--disable-dev-shm-usage', '--disable-extensions', '--mute-audio',
    `--user-data-dir=${tmp}`, '--window-size=390,844',
    '--virtual-time-budget=90000', '--dump-dom', URL
  ];
  const chrome = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  chrome.stdout.on('data', b => { out += b.toString(); });
  chrome.stderr.on('data', b => { err += b.toString(); });
  const timer = setTimeout(() => { try { chrome.kill(); } catch {} }, 180000);

  await new Promise(resolve => chrome.on('close', resolve));
  clearTimeout(timer);
  server.kill();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

  const m = out.match(/SMOKE_RESULT=(\{[\s\S]*?\})<\/pre>/) || out.match(/SMOKE_RESULT=(\{[\s\S]*?\})\n/);
  const fatal = out.match(/SMOKE_FATAL=([\s\S]*?)<\/pre>/);
  if (!m) {
    console.error('未取得测试结果。');
    console.error('FATAL:', fatal ? fatal[1] : '(none)');
    console.error('CHROME STDERR:', err.slice(-2500));
    console.error('DOM 片段:', out.slice(-1800));
    process.exit(2);
  }
  let data;
  try { data = JSON.parse(m[1]); } catch (e) { console.error('结果 JSON 解析失败:', e.message, m[1].slice(0, 500)); process.exit(2); }
  console.log('');
  console.log('  考研写作网站 · 真实浏览器功能测试');
  console.log('  ─────────────────────────────────────────────');
  data.results.forEach(r => console.log(`  ${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? '  → ' + r.detail : ''}`));
  console.log('  ─────────────────────────────────────────────');
  console.log(`  通过 ${data.pass} / ${data.total}，失败 ${data.fail}`);
  console.log('');
  process.exit(data.fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
