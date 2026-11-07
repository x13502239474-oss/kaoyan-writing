/* 专项训练：7 类练习 / 草稿自动保存 / 字数统计 / 提交记录 / 参考要点对照 / 人工自评 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtDate, fmtMin, excerpt, countWords } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, sectionTitle, wireEditor, disclaimer } from '../ui.js';
import { DRILL_TYPES } from '../seed.js';

const ui = { type: '全部', openRef: null, submitted: null };
let drillStart = Date.now();
let editorCtl = null;
let tickHandle = null;

function releaseEditor() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (editorCtl) { editorCtl.flush(); editorCtl.destroy(); editorCtl = null; }
}
export function unmount() { releaseEditor(); }

export function render(ctx) {
  if (ctx.params && ctx.params.id) return detail(ctx, ctx.params.id);
  return hub(ctx);
}

function hub(ctx) {
  const s = store.get();
  const list = ui.type === '全部' ? s.drills : s.drills.filter(d => d.type === ui.type);
  return {
    title: '专项训练', sub: `${s.drillRecords.length} 次练习记录`,
    html: `
      <div class="page-head"><h1>专项训练</h1><p>从审题到成篇，逐级练习。所有作答以完整文字输入为主，提交后可对照参考要点做人工自评；本站不自动判分。</p></div>
      <div class="tabs"><button class="active">专项训练</button><button data-go="#/exams">写作考试</button></div>
      <div class="notice brand">${icon('info', 16)}<div>建议顺序：审题 → 找漏洞 / 拆结构 → 提炼论点 → 列提纲 → 段落写作 → 完整文章写作。每次提交都会进入个人档案与统计。</div></div>
      ${sectionTitle('训练类型', `${DRILL_TYPES.length} 类`)}
      <div class="grid grid-2 grid-md-3 mb-5">${DRILL_TYPES.map((t, i) => {
        const n = s.drillRecords.filter(r => r.type === t).length;
        const total = s.drills.filter(d => d.type === t).length;
        return `<button class="type-tile" data-type="${esc(t)}">
          <span class="tt-ico">${['审', '漏', '构', '论', '纲', '段', '篇'][i]}</span>
          <span class="tt-t">${esc(t)}</span><span class="tt-d">${total} 道练习题</span>
          <span class="tt-n">${n ? `已练 ${n} 次` : '尚未练习'}</span>
        </button>`;
      }).join('')}</div>
      <div class="filter-scroll mb-3">${['全部', ...DRILL_TYPES].map(t => `<button class="filter-pill ${ui.type === t ? 'active' : ''}" data-ftype="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      ${list.length ? list.map(d => {
        const recs = s.drillRecords.filter(r => r.drillId === d.id);
        const draft = (s.drillDrafts[d.id] || '').trim();
        return `<a class="list-item" href="#/drill/${esc(d.id)}" style="display:flex">
          <span class="li-ico">${esc(d.type.slice(0, 1))}</span>
          <span class="li-main"><span class="li-title">${esc(d.title)}</span>
            <span class="li-sub">${esc(d.type)} · 建议 ${d.minWords || 100} 字以上 · ${recs.length ? `已提交 ${recs.length} 次` : '未提交'}${draft ? ' · 有草稿' : ''}</span></span>
          <span class="li-r">${draft ? '<span class="chip chip-warn">草稿</span>' : ''}${icon('right', 16)}</span>
        </a>`;
      }).join('') : emptyState('练', '这个分类下还没有练习题', '可在「数据管理 → 导入内容包」中添加自己的练习题。')}
      ${disclaimer(true)}
    `
  };
}

function detail(ctx, id) {
  const s = store.get();
  const d = s.drills.find(x => x.id === id);
  if (!d) return { title: '练习不存在', html: emptyState('?', '未找到这道练习', '请返回专项训练列表。', `<a class="btn btn-primary btn-sm" href="#/drills">返回</a>`) };
  if (editorCtl === null) drillStart = Date.now();
  const recs = s.drillRecords.filter(r => r.drillId === id).sort((a, b) => new Date(b.at) - new Date(a.at));
  const draft = s.drillDrafts[id] || '';
  const showRef = ui.openRef === id;
  const last = recs[0];

  return {
    title: '专项训练', sub: d.type, fab: false,
    html: `
      <div class="breadcrumb"><a href="#/drills">专项训练</a> / ${esc(d.type)}</div>
      <div class="drill-hero">
        <div class="chips mb-2">${labelChip(d.label)}<span class="chip chip-brand">${esc(d.type)}</span><span class="chip chip-outline">建议 ${d.minWords || 100} 字以上</span></div>
        <div class="dh-t">${esc(d.title)}</div>
        <div class="bodytext">${esc(d.material || '')}</div>
        <div class="divider"></div>
        <div class="t-xs t-bold t-brand mb-2">作答要求</div>
        <div class="bodytext">${esc(d.prompt || '')}</div>
        ${d.hint ? `<details class="mt-3"><summary class="t-sm t-brand" style="cursor:pointer">查看提示</summary><div class="bodytext mt-2">${esc(d.hint)}</div></details>` : ''}
      </div>

      <div class="card card-pad mb-4">
        <div class="flex between mb-3"><b class="t-md">我的作答</b><span class="t-xs t-muted">用时 <span id="drill-timer">00:00</span> · 自动保存</span></div>
        <div class="editor-wrap" id="drill-editor">
          <textarea class="editor" id="drill-answer" placeholder="在这里写下你的完整作答。不要只列要点——练习的目标是把推理过程写清楚。">${esc(draft)}</textarea>
          <div class="editor-bar">
            <span class="save-dot" data-save-dot></span><span data-save>草稿已保存</span>
            <span style="margin-left:auto" class="wc" data-wc>0 字</span>
            <span data-limit class="t-xs"></span>
          </div>
        </div>
        <div class="btn-row mt-3">
          <button class="btn btn-primary equal" data-submit>${icon('check', 16)} 提交并保存作答</button>
          <button class="btn btn-outline" data-clear>清空</button>
        </div>
        <div class="t-xs t-muted mt-2">提交后会生成一条练习记录，同时保留草稿自动保存能力；你可以反复重做同一道题并留下多个版本。</div>
      </div>

      ${showRef || ui.submitted === id ? `<div class="card card-pad mb-4" style="border-left:4px solid var(--success)">
        ${sectionTitle('参考要点对照', '仅供自查，非标准答案')}
        <div class="notice warn">${icon('info', 15)}<div>以下为 AI 生成的参考要点，仅用于对照思考过程，<b>不构成评分，也不代表标准答案</b>。主观作答请以人工评分与自我评价为准。</div></div>
        <div class="bodytext">${esc(d.reference || '（本题暂无参考要点）')}</div>
        <div class="btn-row mt-3">
          <button class="btn btn-soft btn-sm" data-self>${icon('edit', 14)} 填写 / 修改自评</button>
          <button class="btn btn-outline btn-sm" data-go="#/write/new">把这次作答扩写成作文</button>
        </div>
      </div>` : `<button class="btn btn-outline btn-block mb-4" data-showref>对照参考要点（提交后建议再看）</button>`}

      ${sectionTitle('本题作答记录', `${recs.length} 次`)}
      ${recs.length ? recs.map(r => `<div class="essay-card">
        <div class="flex between"><span class="t-sm t-bold">${fmtDate(r.at, true)}</span>
          <span class="chips"><span class="chip">用时 ${fmtMin(r.durationSec || 0)}</span>${typeof r.selfScore === 'number' && r.selfScore > 0 ? `<span class="chip chip-brand">自评 ${r.selfScore} 分</span>` : ''}</span></div>
        <div class="e-ex mt-2" style="white-space:pre-wrap;color:var(--ink-2)">${esc(excerpt(r.answer, 300))}</div>
        ${r.selfNote ? `<div class="notice brand mt-2" style="margin:0">自评备注：${esc(r.selfNote)}</div>` : ''}
        <div class="btn-row mt-3">
          <button class="btn btn-xs btn-outline" data-load="${esc(r.id)}">载入到编辑器重做</button>
          <button class="btn btn-xs btn-outline" data-rec-edit="${esc(r.id)}">编辑自评</button>
          <button class="btn btn-xs btn-ghost t-danger" data-rec-del="${esc(r.id)}">删除记录</button>
        </div>
      </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:16px">还没有提交过作答。先写一段试试。</div>`}
      <a class="btn btn-outline btn-block mt-3" href="#/drills">← 返回专项训练</a>
    `
  };
}

export function mount(ctx, main) {
  const id = ctx.params && ctx.params.id;
  releaseEditor();
  const timerEl = document.getElementById('drill-timer');
  if (timerEl) {
    drillStart = Date.now() - (Number(sessionStorage.getItem('ky_drill_elapsed_' + id)) || 0) * 1000;
    const upd = () => {
      const sec = Math.floor((Date.now() - drillStart) / 1000);
      timerEl.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
      sessionStorage.setItem('ky_drill_elapsed_' + id, String(sec));
    };
    upd(); tickHandle = setInterval(upd, 1000);
    const wrap = document.getElementById('drill-editor');
    if (wrap) editorCtl = wireEditor(wrap, {
      delay: store.get().settings.autosaveMs || 600,
      minWords: (store.get().drills.find(d => d.id === id) || {}).minWords || 0,
      onChange: (v) => { store.get().drillDrafts[id] = v; store.save(); }
    });
  }
  main.addEventListener('click', async (e) => {
    const ty = e.target.closest('[data-type]');
    if (ty) { ui.type = ty.dataset.type; ctx.refresh(); return; }
    const ft = e.target.closest('[data-ftype]');
    if (ft) { ui.type = ft.dataset.ftype; ctx.refresh(); return; }
    const sr = e.target.closest('[data-showref]');
    if (sr) { ui.openRef = id; ctx.refresh(); return; }
    const cl = e.target.closest('[data-clear]');
    if (cl) {
      if (!await confirmSheet({ title: '清空当前作答', desc: '编辑器中的文字与自动保存的草稿都会被清空（已提交的历史记录不受影响）。', confirmText: '清空', danger: true })) return;
      const ta = document.getElementById('drill-answer'); if (ta) ta.value = '';
      store.mutate(s => { s.drillDrafts[id] = ''; });
      toast('已清空'); ctx.refresh(); return;
    }
    const sub = e.target.closest('[data-submit]');
    if (sub) {
      if (editorCtl) editorCtl.flush();
      const ta = document.getElementById('drill-answer');
      const text = ta ? ta.value.trim() : '';
      if (!text) { toast('请先写下作答内容', 'err'); return; }
      const d = store.get().drills.find(x => x.id === id);
      const words = countWords(text).total;
      if (d && words < (d.minWords || 0) * 0.5) {
        if (!await confirmSheet({ title: '字数偏少', desc: `当前 ${words} 字，建议 ${d.minWords} 字以上。仍要提交吗？（提交后仍可重做）`, confirmText: '仍然提交' })) return;
      }
      const rec = {
        id: uid('dr'), drillId: id, type: d.type, title: d.title, answer: text,
        durationSec: Math.floor((Date.now() - drillStart) / 1000),
        selfScore: 0, selfNote: '', at: new Date().toISOString(), label: 'user'
      };
      store.mutate(s => { s.drillRecords.unshift(rec); s.drillDrafts[id] = text; });
      store.log('drill', { title: d.title, type: d.type, durationSec: rec.durationSec });
      ui.openRef = id; ui.submitted = id;
      sessionStorage.removeItem('ky_drill_elapsed_' + id);
      toast('作答已保存，请对照参考要点自评', 'ok');
      ctx.refresh(); return;
    }
    const ld = e.target.closest('[data-load]');
    if (ld) {
      const r = store.get().drillRecords.find(x => x.id === ld.dataset.load); if (!r) return;
      store.mutate(s => { s.drillDrafts[id] = r.answer; });
      ctx.refresh(); toast('已载入，可继续修改'); return;
    }
    const se = e.target.closest('[data-self]');
    const re = e.target.closest('[data-rec-edit]');
    if (se || re) {
      const recs = store.get().drillRecords.filter(x => x.drillId === id).sort((a, b) => new Date(b.at) - new Date(a.at));
      const r = re ? store.get().drillRecords.find(x => x.id === re.dataset.recEdit) : recs[0];
      if (!r) { toast('请先提交一次作答', 'err'); return; }
      const v = await formSheet({ title: '人工自评（自我评价）', desc: '本站不自动判分。请对照参考要点，给自己的作答一个主观分数并记录改进点。', fields: [
        { key: 'selfScore', label: '自评分（0–100）', type: 'range', min: 0, max: 100, step: 1, value: r.selfScore || 60 },
        { key: 'selfNote', label: '本次主要问题 / 改进点', type: 'textarea', rows: 5, value: r.selfNote || '' }
      ], confirmText: '保存自评' });
      if (!v) return;
      store.mutate(s => { const t = s.drillRecords.find(x => x.id === r.id); t.selfScore = Number(v.selfScore) || 0; t.selfNote = v.selfNote; });
      toast('自评已保存', 'ok'); ctx.refresh(); return;
    }
    const del = e.target.closest('[data-rec-del]');
    if (del) {
      if (!await confirmSheet({ title: '删除作答记录', desc: '删除后不可恢复，确定继续？', confirmText: '删除', danger: true })) return;
      store.mutate(s => { s.drillRecords = s.drillRecords.filter(x => x.id !== del.dataset.recDel); });
      toast('已删除'); ctx.refresh();
    }
  });
}
