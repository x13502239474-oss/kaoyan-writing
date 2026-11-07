/* 写作素材库：主题分类 / 类型筛选 / 搜索 / 收藏 / 个人补充 / 编辑删除 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtDate, excerpt } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, favBtn, sectionTitle, disclaimer } from '../ui.js';

const ui = { q: '', theme: '全部', type: '全部', favOnly: false, openId: null };
const TYPES = ['全部', '论据', '案例', '名言', '示例表达', '角度'];

function themes() {
  return ['全部', ...Array.from(new Set(store.get().materials.map(m => m.theme || '未分类')))];
}
function filtered() {
  const q = ui.q.trim().toLowerCase();
  return store.get().materials.filter(m => {
    if (ui.favOnly && !m.favorite) return false;
    if (ui.theme !== '全部' && (m.theme || '未分类') !== ui.theme) return false;
    if (ui.type !== '全部' && m.type !== ui.type) return false;
    if (!q) return true;
    return [m.title, m.content, m.source, m.theme, m.type, ...(m.tags || [])].join(' ').toLowerCase().includes(q);
  });
}
function materialFields(m = {}) {
  return [
    { key: 'theme', label: '主题分类', value: m.theme || '', required: true, placeholder: '例如：创新与守正', hint: '可填新主题，会自动出现在筛选栏' },
    { key: 'type', label: '素材类型', type: 'select', value: m.type || '论据', options: TYPES.filter(t => t !== '全部').map(t => ({ value: t, label: t })) },
    { key: 'title', label: '标题', value: m.title || '', required: true },
    { key: 'content', label: '正文', type: 'textarea', rows: 7, value: m.content || '', required: true, hint: '若引用他人文字，请确认使用权限并注明出处；不要虚构名人语录。' },
    { key: 'source', label: '出处 / 备注', value: m.source || '', placeholder: '例如：自己整理 / 书名·页码' },
    { key: 'tags', label: '标签（逗号分隔）', value: (m.tags || []).join('，'), placeholder: '辩证，条件，可写性' }
  ];
}

export function render(ctx) {
  const s = store.get(), arr = filtered();
  const themeCounts = {};
  s.materials.forEach(m => { themeCounts[m.theme || '未分类'] = (themeCounts[m.theme || '未分类'] || 0) + 1; });
  return {
    title: '写作素材库', sub: `${s.materials.length} 条素材 · ${s.materials.filter(m => m.favorite).length} 条收藏`,
    actions: `<button class="icon-btn" data-app-action="add" aria-label="添加素材">${icon('plus', 21)}</button>`,
    html: `
      <div class="page-head"><h1>写作素材库</h1><p>按主题整理论据、案例、名言与论证角度。收藏后可在「只看收藏」中集中复习；支持随时补充与修改自己的素材。</p></div>
      <div class="tabs"><button class="active">素材库</button><button data-go="#/models">范文学习</button></div>

      <div class="input-search mb-3"><input class="input" id="mat-q" placeholder="搜索标题、正文、出处、标签…" value="${esc(ui.q)}">${icon('search', 17)}</div>
      <div class="filter-scroll mb-2">${themes().map(t => `<button class="filter-pill ${ui.theme === t && !ui.favOnly ? 'active' : ''}" data-theme="${esc(t)}">${esc(t)}${t !== '全部' ? ` <span style="opacity:.7">${themeCounts[t] || 0}</span>` : ''}</button>`).join('')}</div>
      <div class="filter-scroll mb-3">${TYPES.map(t => `<button class="filter-pill ${ui.type === t ? 'active' : ''}" data-type="${esc(t)}">${esc(t)}</button>`).join('')}
        <button class="filter-pill ${ui.favOnly ? 'active' : ''}" data-fav="1">♥ 只看收藏</button></div>

      <div class="flex between mb-3"><span class="t-sm t-muted">共 ${arr.length} 条${ui.favOnly ? '（已收藏）' : ''}</span>
        <button class="btn btn-xs btn-soft" data-app-action="add">${icon('plus', 14)} 补充素材</button></div>

      ${arr.length ? arr.map(m => `
        <div class="mat-card">
          <div class="m-top"><div class="m-title">${esc(m.title)}</div>${favBtn(!!m.favorite, 'm-fav', m.id)}</div>
          <div class="chips mt-2">${labelChip(m.label)}<span class="chip chip-brand">${esc(m.theme || '未分类')}</span><span class="chip">${esc(m.type || '素材')}</span>${(m.tags || []).slice(0, 3).map(t => `<span class="chip chip-outline">${esc(t)}</span>`).join('')}</div>
          <div class="m-body">${esc(m.content)}</div>
          ${m.source ? `<div class="t-xs t-muted mb-2">出处：${esc(m.source)}</div>` : ''}
          ${m.note ? `<div class="notice brand mb-2" style="margin:0">${icon('edit', 14)}<div><b>我的批注：</b>${esc(m.note)}</div></div>` : ''}
          <div class="m-foot">
            <button class="btn btn-xs btn-outline" data-m-copy="${esc(m.id)}">${icon('copy', 13)} 复制</button>
            <button class="btn btn-xs btn-outline" data-m-note="${esc(m.id)}">${icon('edit', 13)} 批注</button>
            <button class="btn btn-xs btn-outline" data-m-edit="${esc(m.id)}">编辑</button>
            <button class="btn btn-xs btn-ghost t-danger" data-m-del="${esc(m.id)}">删除</button>
            <span class="t-xs t-muted" style="margin-left:auto">${fmtDate(m.createdAt)}</span>
          </div>
        </div>`).join('') : emptyState('素材', '没有匹配的素材', '换个关键词或筛选条件，也可以补充一条自己的素材。', `<button class="btn btn-primary btn-sm" data-app-action="add">补充素材</button>`)}
      ${disclaimer(true)}
    `
  };
}

export function mount(ctx, main) {
  const q = document.getElementById('mat-q');
  if (q) q.addEventListener('input', () => {
    ui.q = q.value; const pos = q.selectionStart; ctx.refresh();
    const n = document.getElementById('mat-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
  });
  main.addEventListener('click', async (e) => {
    const th = e.target.closest('[data-theme]');
    if (th) { ui.theme = th.dataset.theme; ui.favOnly = false; ctx.refresh(); return; }
    const ty = e.target.closest('[data-type]');
    if (ty) { ui.type = ty.dataset.type; ctx.refresh(); return; }
    const fv = e.target.closest('[data-fav]');
    if (fv) { ui.favOnly = !ui.favOnly; if (ui.favOnly) ui.theme = '全部'; ctx.refresh(); return; }
    const f = e.target.closest('[data-m-fav]');
    if (f) { store.mutate(s => { const m = s.materials.find(x => x.id === f.dataset.mFav); if (m) m.favorite = !m.favorite; }); toast('收藏状态已更新', 'ok'); ctx.refresh(); return; }
    const c = e.target.closest('[data-m-copy]');
    if (c) {
      const m = store.get().materials.find(x => x.id === c.dataset.mCopy);
      if (!m) return;
      try { await navigator.clipboard.writeText(m.content); toast('已复制正文', 'ok'); }
      catch { toast('浏览器未允许复制，请长按选择文字', 'err'); }
      return;
    }
    const note = e.target.closest('[data-m-note]');
    if (note) {
      const m = store.get().materials.find(x => x.id === note.dataset.mNote); if (!m) return;
      const v = await formSheet({ title: '我的批注', fields: [{ key: 'note', label: '批注内容', type: 'textarea', rows: 5, value: m.note || '', hint: '例如：可用在「条件分析」段落，配合口径素材' }], confirmText: '保存' });
      if (!v) return;
      store.mutate(s => { const t = s.materials.find(x => x.id === m.id); t.note = v.note; });
      toast('批注已保存', 'ok'); ctx.refresh(); return;
    }
    const ed = e.target.closest('[data-m-edit]');
    if (ed) { await openForm(ed.dataset.mEdit); return; }
    const del = e.target.closest('[data-m-del]');
    if (del) {
      if (!await confirmSheet({ title: '删除素材', desc: '删除后不可恢复，确定继续？', confirmText: '删除', danger: true })) return;
      store.mutate(s => { s.materials = s.materials.filter(x => x.id !== del.dataset.mDel); });
      toast('已删除'); ctx.refresh();
    }
  });

  async function openForm(id) {
    const m = id ? store.get().materials.find(x => x.id === id) : null;
    const v = await formSheet({ title: m ? '编辑素材' : '补充个人素材', desc: m ? '' : '新增内容标记为「个人添加」，可自由修改删除。', fields: materialFields(m || {}), confirmText: m ? '保存修改' : '添加素材' });
    if (!v) return;
    const row = {
      theme: v.theme, type: v.type, title: v.title, content: v.content, source: v.source,
      tags: v.tags.split(/[,，、]/).map(x => x.trim()).filter(Boolean)
    };
    store.mutate(s => {
      if (m) Object.assign(s.materials.find(x => x.id === id), row);
      else s.materials.unshift({ id: uid('mat'), ...row, label: 'user', favorite: false, createdAt: new Date().toISOString() });
    });
    if (!m) store.log('material', { title: row.title });
    toast(m ? '已保存修改' : '素材已添加', 'ok'); ctx.refresh();
  }
  main.__openMaterialForm = openForm;
}

export async function action(name, el, ctx) {
  if (name === 'add') {
    const main = document.getElementById('main');
    if (main && main.__openMaterialForm) await main.__openMaterialForm(null);
  }
}
