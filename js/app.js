/* 应用入口：hash 路由 + 应用外壳（顶栏 / 侧栏 / 底部导航 / 悬浮写作按钮） */
'use strict';
import * as store from './store.js';
import { $, icon, esc } from './utils.js';
import { toast } from './ui.js';

import * as home from './views/home.js';
import * as courses from './views/courses.js';
import * as materials from './views/materials.js';
import * as models from './views/models.js';
import * as drills from './views/drills.js';
import * as exam from './views/exam.js';
import * as archive from './views/archive.js';
import * as review from './views/review.js';
import * as settings from './views/settings.js';
import * as me from './views/me.js';

/* ---------------- 路由表 ---------------- */
const ROUTES = [
  { p: '/', v: home, tab: 'home', side: '#/home', back: false },
  { p: '/home', v: home, tab: 'home', side: '#/home', back: false },
  { p: '/courses', v: courses, tab: 'courses', side: '#/courses', back: false },
  { p: '/course/:id', v: courses, tab: 'courses', side: '#/courses' },
  { p: '/materials', v: materials, tab: 'library', side: '#/materials', back: false },
  { p: '/models', v: models, tab: 'library', side: '#/models', back: false },
  { p: '/model/:id', v: models, tab: 'library', side: '#/models' },
  { p: '/drills', v: drills, tab: 'train', side: '#/drills', back: false },
  { p: '/drill/:id', v: drills, tab: 'train', side: '#/drills' },
  { p: '/exams', v: exam, tab: 'train', side: '#/exams', back: false },
  { p: '/exam/:id', v: exam, tab: 'train', side: '#/exams' },
  { p: '/exam/:id/result/:attemptId', v: exam, tab: 'train', side: '#/exams' },
  { p: '/archive', v: archive, tab: 'me', side: '#/archive', back: false },
  { p: '/write/new', v: archive, tab: 'me', side: '#/archive' },
  { p: '/essay/:id', v: archive, tab: 'me', side: '#/archive' },
  { p: '/essay/:id/diff', v: archive, tab: 'me', side: '#/archive' },
  { p: '/review', v: review, tab: 'me', side: '#/review', back: false },
  { p: '/settings', v: settings, tab: 'me', side: '#/settings', back: false },
  { p: '/me', v: me, tab: 'me', side: '#/me', back: false }
].map(r => {
  const keys = [];
  const re = new RegExp('^' + r.p.replace(/:[A-Za-z0-9_]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  return { ...r, re, keys };
});

const SIDEBAR = [
  { group: '学习', items: [
    ['学习首页', '#/home', 'home'], ['课程学习', '#/courses', 'bookOpen'],
    ['专项训练', '#/drills', 'target'], ['写作考试', '#/exams', 'clock']
  ] },
  { group: '资料', items: [
    ['写作素材库', '#/materials', 'layers'], ['范文学习', '#/models', 'file']
  ] },
  { group: '个人', items: [
    ['个人中心', '#/me', 'archive'], ['写作档案', '#/archive', 'pen'],
    ['复习与统计', '#/review', 'chart'], ['数据管理', '#/settings', 'settings']
  ] }
];
const TABS = [
  ['首页', '#/home', 'home', 'home'],
  ['课程', '#/courses', 'bookOpen', 'courses'],
  ['训练', '#/drills', 'target', 'train'],
  ['素材', '#/materials', 'layers', 'library'],
  ['我的', '#/me', 'archive', 'me']
];

let current = null; // { view, ctx }

function match(path) {
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      return { route: r, params };
    }
  }
  return null;
}

function sidebarHtml(activeSide, due) {
  return `<aside class="sidebar">
    <div class="side-brand"><div class="mark">文</div><div><div class="t1">考研写作</div><div class="t2">个人自学工作台</div></div></div>
    ${SIDEBAR.map(g => `<div class="side-group">${g.group}</div>` + g.items.map(([label, hash, ico]) =>
      `<a class="side-link ${activeSide === hash ? 'active' : ''}" href="${hash}">${icon(ico, 18)}<span>${label}</span>${hash === '#/review' && due > 0 ? `<span class="chip chip-warn" style="margin-left:auto">${due}</span>` : ''}</a>`
    ).join('')).join('')}
    <div class="side-foot">数据仅保存在本机浏览器<br>请定期在「数据管理」导出备份<br><span style="color:var(--brand)">v1.0 · 本地离线可用</span></div>
  </aside>`;
}
function tabbarHtml(activeTab, due) {
  return `<nav class="tabbar">${TABS.map(([label, hash, ico, tab]) =>
    `<a class="tab ${activeTab === tab ? 'active' : ''}" href="${hash}">${icon(ico, 22)}<span>${label}</span>${tab === 'me' && due > 0 ? '<i class="dot"></i>' : ''}</a>`
  ).join('')}</nav>`;
}

function buildShell(out, route, due) {
  const back = route.back === false ? '' : `<button class="icon-btn" data-nav-back aria-label="返回">${icon('left', 22)}</button>`;
  const actions = out.actions || `<a class="icon-btn" href="#/settings" aria-label="数据管理">${icon('settings', 20)}</a>`;
  return `
    <header class="appbar"><div class="appbar-inner">
      ${back || '<span style="width:8px;flex:0 0 8px"></span>'}
      <div class="appbar-title">${esc(out.title || '考研写作')}${out.sub ? `<span class="appbar-sub">${esc(out.sub)}</span>` : ''}</div>
      <div class="flex gap-1">${actions}</div>
    </div></header>
    ${sidebarHtml(route.side, due)}
    <main class="main" id="main"></main>
    ${tabbarHtml(route.tab, due)}
    ${out.fab === false ? '' : `<button class="fab" data-fab aria-label="开始写作">${icon('pen', 24)}</button>`}
  `;
}

function renderRoute(opts = {}) {
  if (current && current.view && typeof current.view.unmount === 'function') {
    try { current.view.unmount(); } catch (e) { console.error('unmount error', e); }
  }
  const keepY = opts.keepScroll ? window.scrollY : 0;
  let path = (location.hash || '').replace(/^#/, '') || '/home';
  if (!path.startsWith('/')) path = '/' + path;
  let found = match(path);
  if (!found) { location.replace('#/home'); return; }
  const { route, params } = found;
  const ctx = {
    params, path, route,
    go(hash) { if (location.hash === hash) renderRoute(); else location.hash = hash; },
    back() { if (history.length > 1) history.back(); else ctx.go('#/home'); },
    refresh(keep = true) { renderRoute({ keepScroll: keep }); },
    toast
  };
  const view = route.v;
  let out = {};
  try { out = view.render(ctx) || {}; }
  catch (e) {
    console.error('[render error]', e);
    out = { html: `<div class="notice warn">页面渲染出错：${esc(e.message)}。可尝试在「数据管理」中导出备份后重置数据。</div>`, title: '出错了' };
  }
  $('#app').innerHTML = buildShell(out, route, store.dueReviews().length);
  const main = $('#main');
  main.innerHTML = `<div class="container">${out.html || ''}</div>`;
  current = { view, ctx, out };
  try { if (typeof view.mount === 'function') view.mount(ctx, main); }
  catch (e) { console.error('[mount error]', e); toast('页面交互初始化失败：' + e.message, 'err'); }
  if (keepY > 0) window.scrollTo(0, keepY); else window.scrollTo(0, 0);
}

/* ---------------- 全局委托事件 ---------------- */
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { e.preventDefault(); const h = go.dataset.go; if (location.hash === h) renderRoute(); else location.hash = h; return; }
  if (e.target.closest('[data-nav-back]')) { if (history.length > 1) history.back(); else location.hash = '#/home'; return; }
  if (e.target.closest('[data-fab]')) { location.hash = '#/write/new'; return; }
  const act = e.target.closest('[data-app-action]');
  if (act && current && current.view && typeof current.view.action === 'function') {
    current.view.action(act.dataset.appAction, act, current.ctx);
  }
});
window.addEventListener('hashchange', () => renderRoute());

/* ---------------- 启动 ---------------- */
store.init();
if (!location.hash) location.replace('#/home');
renderRoute();

/* PWA：注册 Service Worker（localhost / HTTPS 可用） */
if ('serviceWorker' in navigator) {
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  if (secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW 注册失败（不影响网站使用）', err));
    });
  }
}
/* 捕获安装事件，供「数据管理」页显示安装按钮 */
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__pwaInstallEvent = e; });

/* 暴露给冒烟测试与调试 */
window.__KY = { store, renderRoute, get current() { return current; } };
