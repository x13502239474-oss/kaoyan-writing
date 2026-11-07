/* 个人中心（移动端「我的」入口）：聚合档案 / 范文 / 复习 / 数据 / 设置 */
'use strict';
import * as store from '../store.js';
import { esc, icon, fmtDate, relTime, countWords } from '../utils.js';
import { sectionTitle, disclaimer } from '../ui.js';

const LINKS = [
  ['个人写作档案', '历史作文、版本对比与自评', '#/archive', 'archive', ''],
  ['范文学习', '结构拆解与逐段精读', '#/models', 'file', ''],
  ['写作素材库', '主题分类与收藏', '#/materials', 'layers', ''],
  ['复习与统计', '待复习、成绩趋势、薄弱环节', '#/review', 'chart', 'due'],
  ['数据管理', '备份恢复、内容导入、设置', '#/settings', 'settings', ''],
  ['写作考试', '限时模拟与答卷回顾', '#/exams', 'clock', '']
];

export function render(ctx) {
  const s = store.get(), st = store.stats();
  const totalWords = s.essays.reduce((n, e) => n + countWords(e.content).total, 0);
  const recent = s.essays.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 3);
  return {
    title: '我的', sub: '个人学习中心',
    html: `
      <div class="hero" style="padding:20px 16px">
        <div class="hero-greet">${esc(s.profile.nickname || '同学')} · ${esc(s.profile.examType || '')}</div>
        <div class="hero-title" style="font-size:21px">我的写作档案</div>
        <div class="hero-desc">${s.profile.examDate ? '目标考试日期 ' + esc(s.profile.examDate) : '已持续记录每一次写作与复盘'}</div>
        <div class="hero-metrics">
          <div><div class="v">${s.essays.length}</div><div class="k">作文篇数</div></div>
          <div><div class="v">${totalWords}</div><div class="k">累计字数</div></div>
          <div><div class="v">${st.avgScore || '—'}</div><div class="k">平均自评</div></div>
        </div>
      </div>

      <div class="section mt-5">
        ${sectionTitle('常用功能', '')}
        <div class="list">${LINKS.map(([title, desc, hash, ico, badge]) => {
          const n = badge === 'due' ? store.dueReviews().length : 0;
          return `<a class="list-item" href="${hash}">
            <span class="li-ico">${icon(ico, 18)}</span>
            <span class="li-main"><span class="li-title">${esc(title)}</span><span class="li-sub">${esc(desc)}</span></span>
            ${n ? `<span class="chip chip-warn">${n}</span>` : ''}<span class="li-r">${icon('right', 16)}</span>
          </a>`;
        }).join('')}</div>
      </div>

      <div class="section">
        ${sectionTitle('快速开始', '')}
        <div class="quick-grid">
          <a class="quick" href="#/write/new"><span class="q-ico amber">写</span><span class="q-t">自由写作</span><span class="q-d">自动保存草稿</span></a>
          <a class="quick" href="#/drills"><span class="q-ico seal">练</span><span class="q-t">专项训练</span><span class="q-d">7 类练习</span></a>
          <a class="quick" href="#/review"><span class="q-ico green">复</span><span class="q-t">今日复习</span><span class="q-d">${st.due} 项待复习</span></a>
          <a class="quick" href="#/settings"><span class="q-ico">备</span><span class="q-t">导出备份</span><span class="q-d">${s.settings.lastBackupAt ? '上次 ' + fmtDate(s.settings.lastBackupAt) : '尚未导出'}</span></a>
        </div>
      </div>

      <div class="section">
        ${sectionTitle('最近修改的作文', '', `<a href="#/archive">全部</a>`)}
        ${recent.length ? `<div class="list">${recent.map(e => `<a class="list-item" href="#/essay/${esc(e.id)}">
          <span class="li-ico">文</span><span class="li-main"><span class="li-title">${esc(e.title)}</span>
          <span class="li-sub">${countWords(e.content).total} 字 · ${relTime(e.updatedAt || e.createdAt)}</span></span>
          <span class="li-r">${icon('right', 16)}</span></a>`).join('')}</div>`
          : `<div class="card card-pad t-sm t-muted">还没有作文，点上方「自由写作」开始。</div>`}
      </div>
      ${!s.settings.lastBackupAt ? `<div class="notice warn">${icon('alert', 16)}<div>尚未导出过备份。建议现在到 <a href="#/settings" style="text-decoration:underline">数据管理</a> 下载一份 JSON，避免清理浏览器缓存后丢失数据。</div></div>` : ''}
      ${disclaimer(true)}
    `
  };
}
