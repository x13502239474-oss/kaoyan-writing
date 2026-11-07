/* 个人写作档案：历史作文 / 自由写作编辑器（自动保存）/ 自评 / 版本管理 / 修改前后对比 / 收藏表达 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtDate, fmtMin, excerpt, countWords, diffLines, debounce } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, sectionTitle, wireEditor, disclaimer } from '../ui.js';

const ui = { q: '', type: '全部', diffA: null, diffB: null };
let editorCtl = null, tickHandle = null, startedAt = Date.now();

function release() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (editorCtl) { editorCtl.flush(); editorCtl.destroy(); editorCtl = null; }
}
export function unmount() { release(); }

export function render(ctx) {
  const p = ctx.params || {};
  if (ctx.path === '/write/new') return newEssay(ctx);
  if (/\/diff$/.test(ctx.path)) return diffView(ctx, p.id);
  if (p.id) return essayDetail(ctx, p.id);
  return list(ctx);
}

/* ---------------- 档案列表 ---------------- */
function list(ctx) {
  const s = store.get();
  const q = ui.q.trim().toLowerCase();
  const arr = s.essays.filter(e => {
    if (ui.type !== '全部' && e.type !== ui.type) return false;
    if (!q) return true;
    return [e.title, e.type, e.content, e.selfEval, ...(e.problems || [])].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const totalWords = s.essays.reduce((n, e) => n + countWords(e.content).total, 0);
  return {
    title: '个人写作档案', sub: `${s.essays.length} 篇作文 · ${totalWords} 字`,
    actions: `<a class="icon-btn" href="#/write/new" aria-label="新建作文">${icon('plus', 21)}</a>`,
    html: `
      <div class="page-head"><h1>个人写作档案</h1><p>每一篇都可以继续编辑、保存新版本、做修改前后对比。写作内容自动保存到本机，刷新或关闭浏览器不会丢失。</p></div>
      <div class="grid grid-3 mb-4" style="gap:8px">
        <div class="stat-tile"><div class="v">${s.essays.length}</div><div class="stat-label">历史作文</div></div>
        <div class="stat-tile"><div class="v">${totalWords}</div><div class="stat-label">累计字数</div></div>
        <div class="stat-tile"><div class="v">${s.phrases.length}</div><div class="stat-label">收藏表达</div></div>
      </div>
      <a class="btn btn-primary btn-block mb-4" href="#/write/new">${icon('pen', 16)} 开始自由写作</a>
      <div class="input-search mb-3"><input class="input" id="arch-q" placeholder="搜索标题、正文、自评、问题标签…" value="${esc(ui.q)}">${icon('search', 17)}</div>
      <div class="filter-scroll mb-4">${['全部', '论说文', '论证有效性分析', '其他'].map(t => `<button class="filter-pill ${ui.type === t ? 'active' : ''}" data-atype="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      ${arr.length ? arr.map(e => `<div class="essay-card">
        <div class="flex between gap-2"><a class="e-t flex-1" href="#/essay/${esc(e.id)}">${esc(e.title)}</a><span class="chip ${e.source === 'exam' ? 'chip-seal' : 'chip-outline'}">${e.source === 'exam' ? '考试答卷' : e.source === 'demo' ? '演示' : '自建'}</span></div>
        <div class="e-ex clamp-2">${esc(excerpt(e.content, 110))}</div>
        <div class="chips mt-2">
          <span class="chip chip-brand">${esc(e.type || '作文')}</span>
          <span class="chip chip-outline">${fmtDate(e.createdAt, true)}</span>
          <span class="chip chip-outline">${countWords(e.content).total} 字</span>
          <span class="chip chip-outline">${fmtMin(e.durationSec || 0)}</span>
          ${e.selfScore ? `<span class="chip chip-success">自评 ${e.selfScore} 分</span>` : ''}
          ${(e.versions || []).length ? `<span class="chip chip-warn">${e.versions.length} 个版本</span>` : ''}
        </div>
        ${(e.problems || []).length ? `<div class="chips mt-2">${e.problems.map(p => `<span class="chip chip-danger">${esc(p)}</span>`).join('')}</div>` : ''}
        <div class="btn-row mt-3">
          <a class="btn btn-xs btn-soft" href="#/essay/${esc(e.id)}">编辑 / 复盘</a>
          ${(e.versions || []).length >= 2 ? `<a class="btn btn-xs btn-outline" href="#/essay/${esc(e.id)}/diff">版本对比</a>` : ''}
          <button class="btn btn-xs btn-ghost t-danger" data-essay-del="${esc(e.id)}">删除</button>
        </div>
      </div>`).join('') : emptyState('档', '还没有作文', '从自由写作、专项训练或模拟考试开始，内容都会自动留存。', `<a class="btn btn-primary btn-sm" href="#/write/new">开始写作</a>`)}
      <div class="card card-pad mt-4">${sectionTitle('收藏的优秀表达', `${s.phrases.length} 条`)}
        ${s.phrases.length ? s.phrases.slice(0, 5).map(p => `<div class="phrase-item"><div class="p-txt">${esc(p.text)}<div class="t-xs t-muted mt-1" style="font-family:var(--font-sans)">${esc(p.source || '')}</div></div>
          <button class="btn btn-xs btn-ghost t-danger" data-global-ph-del="${esc(p.id)}">删</button></div>`).join('') : `<div class="t-sm t-muted">可在范文「逐段精读」或作文详情中收藏好句。</div>`}
      </div>
      ${disclaimer(true)}
    `
  };
}

/* ---------------- 自由写作编辑器 ---------------- */
function newEssay(ctx) {
  const d = store.newDraft();
  return {
    title: '自由写作', sub: '自动保存草稿', fab: false,
    html: `
      <div class="page-head"><h1>开始写作</h1><p>不用等准备好再动笔。标题、类型与正文都会自动保存为草稿，确认后存入档案。</p></div>
      <div class="card card-pad mb-4">
        <label class="field"><span class="field-label">标题</span><input class="input" id="new-title" value="${esc(d.title || '')}" placeholder="给这篇作文起个名字"></label>
        <label class="field"><span class="field-label">文体</span><select class="select" id="new-type">
          ${['论说文', '论证有效性分析', '其他'].map(t => `<option value="${t}" ${d.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <div class="flex between mb-2"><b class="t-md">正文</b><span class="t-xs t-muted">本次用时 <span id="new-timer">00:00</span> · 自动保存</span></div>
        <div class="editor-wrap" id="new-editor">
          <textarea class="editor" id="new-content" style="min-height:380px" placeholder="写完整文章，或者先写一个主体段。手机端可直接输入，内容会自动保存。">${esc(d.content || '')}</textarea>
          <div class="editor-bar"><span class="save-dot" data-save-dot></span><span data-save>草稿已保存</span>
            <span style="margin-left:auto" class="wc" data-wc>0 字</span></div>
        </div>
        <div class="btn-row mt-4">
          <button class="btn btn-primary equal" data-save-essay>${icon('save', 16)} 保存为作文</button>
          <button class="btn btn-outline" data-new-clear>清空草稿</button>
        </div>
        <div class="t-xs t-muted mt-2">保存后可在档案里继续修改、保存版本、做修改前后对比与人工自评。</div>
      </div>
      <a class="btn btn-outline btn-block" href="#/archive">← 返回写作档案</a>
    `
  };
}

/* ---------------- 作文详情 / 编辑 ---------------- */
function essayDetail(ctx, id) {
  const e = store.get().essays.find(x => x.id === id);
  if (!e) return { title: '作文不存在', html: emptyState('?', '未找到这篇作文', '', `<a class="btn btn-primary btn-sm" href="#/archive">返回档案</a>`) };
  const versions = e.versions || [];
  const myPhrases = store.get().phrases.filter(p => p.essayId === id);
  return {
    title: '作文编辑', sub: excerpt(e.title, 14), fab: false,
    actions: `<button class="icon-btn" data-app-action="meta" aria-label="编辑信息">${icon('edit', 20)}</button>
              <button class="icon-btn" data-app-action="delete" aria-label="删除作文">${icon('trash', 20)}</button>`,
    html: `
      <div class="breadcrumb"><a href="#/archive">写作档案</a> / 编辑与复盘</div>
      <div class="card card-pad mb-4">
        <div class="chips mb-2">${labelChip(e.label || 'user')}<span class="chip chip-brand">${esc(e.type || '作文')}</span>${e.source === 'exam' ? '<span class="chip chip-seal">考试答卷</span>' : ''}</div>
        <h1 style="font-size:var(--fs-lg);font-weight:730;line-height:1.5">${esc(e.title)}</h1>
        <div class="grid grid-2 grid-md-2 mt-3" style="gap:8px">
          <div class="kv"><span class="k">写作日期</span><span class="v">${fmtDate(e.createdAt, true)}</span></div>
          <div class="kv"><span class="k">写作耗时</span><span class="v">${fmtMin(e.durationSec || 0)}</span></div>
          <div class="kv"><span class="k">最近修改</span><span class="v">${fmtDate(e.updatedAt || e.createdAt, true)}</span></div>
          <div class="kv"><span class="k">自评成绩</span><span class="v">${e.selfScore ? e.selfScore + ' 分' : '未评分'}</span></div>
        </div>
      </div>

      <div class="card card-pad mb-4">
        <div class="flex between mb-3"><b class="t-md">正文（可直接修改）</b><span class="t-xs t-muted">自动保存到本机</span></div>
        <div class="editor-wrap" id="essay-editor">
          <textarea class="editor" id="essay-content" style="min-height:420px">${esc(e.content || '')}</textarea>
          <div class="editor-bar"><span class="save-dot" data-save-dot></span><span data-save>已自动保存</span>
            <span style="margin-left:auto" class="wc" data-wc>0 字</span></div>
        </div>
        <div class="btn-row mt-3">
          <button class="btn btn-soft equal" data-save-version>${icon('copy', 15)} 保存为新版本</button>
          <button class="btn btn-outline" data-add-phrase>${icon('heart', 15)} 收藏好句</button>
        </div>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('自我评价与常见问题', '人工自评，非自动判分')}
        <div class="notice warn">${icon('info', 15)}<div>本站不自动评判作文。以下分数与问题标签由你自己填写，用于长期复盘。</div></div>
        <label class="field"><span class="field-label">自评分（0–100）</span>
          <div class="flex gap-3"><input type="range" id="e-score" min="0" max="100" step="1" value="${e.selfScore || 0}" style="flex:1;min-width:0;accent-color:var(--brand)"><b class="t-brand" id="e-score-out" style="width:40px;text-align:right">${e.selfScore || 0}</b></div></label>
        <label class="field"><span class="field-label">自评 / 复盘笔记</span><textarea class="textarea" id="e-eval" rows="5" placeholder="这次最满意的是什么？最需要改的一件事是什么？">${esc(e.selfEval || '')}</textarea></label>
        <label class="field"><span class="field-label">个人常见问题（逗号分隔）</span><input class="input" id="e-problems" value="${esc((e.problems || []).join('，'))}" placeholder="立意过大，段落重复，举例后缺少分析"></label>
        <button class="btn btn-primary btn-block" data-save-self>${icon('save', 16)} 保存自评</button>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('修改前后版本', `${versions.length} 个版本`)}
        ${versions.length ? versions.map(v => `<div class="list-item" style="padding:10px 0">
          <span class="li-ico green" style="width:30px;height:30px;flex:0 0 30px;font-size:13px">版</span>
          <span class="li-main"><span class="li-title" style="font-size:14px">${esc(v.label || '版本')}</span>
          <span class="li-sub">${countWords(v.content).total} 字 · ${fmtDate(v.at, true)}</span></span>
          <button class="btn btn-xs btn-outline" data-load-version="${esc(v.id)}">载入</button>
          <button class="btn btn-xs btn-ghost t-danger" data-del-version="${esc(v.id)}">删</button>
        </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:14px">还没有版本。修改正文后点「保存为新版本」，就能做前后对比。</div>`}
        ${versions.length >= 2 ? `<a class="btn btn-soft btn-block btn-sm mt-3" href="#/essay/${esc(id)}/diff">${icon('eye', 15)} 打开修改前后版本对比</a>` : ''}
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('从本篇收藏的表达', `${myPhrases.length} 条`)}
        ${myPhrases.length ? myPhrases.map(p => `<div class="phrase-item"><div class="p-txt">${esc(p.text)}</div>
          <button class="btn btn-xs btn-ghost t-danger" data-e-ph-del="${esc(p.id)}">删</button></div>`).join('') : `<div class="t-sm t-muted">点上方「收藏好句」把写得满意的句子存下来，之后可集中回看。</div>`}
      </div>
      <a class="btn btn-outline btn-block" href="#/archive">← 返回写作档案</a>
    `
  };
}

/* ---------------- 版本对比 ---------------- */
function diffView(ctx, id) {
  const e = store.get().essays.find(x => x.id === id);
  if (!e) return { title: '作文不存在', html: emptyState('?', '未找到这篇作文', '', `<a class="btn btn-primary btn-sm" href="#/archive">返回档案</a>`) };
  const vs = e.versions || [];
  const opts = [{ id: '__current__', label: '当前正文', content: e.content || '' }, ...vs.map(v => ({ id: v.id, label: v.label || '版本', content: v.content }))];
  let A = opts.find(o => o.id === ui.diffA) || opts[Math.max(0, opts.length - 2)] || opts[0];
  let B = opts.find(o => o.id === ui.diffB) || opts[opts.length - 1];
  const diff = diffLines(A.content, B.content);
  const left = diff.filter(x => x.type !== 'add'), right = diff.filter(x => x.type !== 'del');
  return {
    title: '修改前后对比', sub: excerpt(e.title, 12), fab: false,
    html: `
      <div class="breadcrumb"><a href="#/archive">写作档案</a> / <a href="#/essay/${esc(id)}">${esc(excerpt(e.title, 14))}</a> / 版本对比</div>
      <div class="card card-pad mb-4">
        <div class="form-row">
          <label class="field" style="margin:0"><span class="field-label">修改前</span>
            <select class="select" id="diff-a">${opts.map(o => `<option value="${esc(o.id)}" ${o.id === A.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
          <label class="field" style="margin:0"><span class="field-label">修改后</span>
            <select class="select" id="diff-b">${opts.map(o => `<option value="${esc(o.id)}" ${o.id === B.id ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>
        </div>
        <div class="chips mt-3"><span class="chip" style="background:#DCF3E6;color:#0B6B47">绿色 = 新增</span><span class="chip" style="background:#FCE2DF;color:#9C2C21">红色删除线 = 删去</span>
          <span class="chip chip-outline">${countWords(A.content).total} 字 → ${countWords(B.content).total} 字</span></div>
      </div>
      <div class="diff-grid">
        <div class="diff-col"><div class="dh">修改前 · ${esc(A.label)}</div><div class="db">${left.length ? left.map(l => `<div class="diff-line ${l.type === 'del' ? 'del' : 'same'}">${esc(l.text) || '&nbsp;'}</div>`).join('') : '<span class="t-muted">（空）</span>'}</div></div>
        <div class="diff-col"><div class="dh">修改后 · ${esc(B.label)}</div><div class="db">${right.length ? right.map(l => `<div class="diff-line ${l.type === 'add' ? 'add' : 'same'}">${esc(l.text) || '&nbsp;'}</div>`).join('') : '<span class="t-muted">（空）</span>'}</div></div>
      </div>
      <a class="btn btn-outline btn-block mt-4" href="#/essay/${esc(id)}">← 返回作文编辑</a>
    `
  };
}

/* ---------------- 交互 ---------------- */
export function mount(ctx, main) {
  release();
  const p = ctx.params || {};
  const isNew = ctx.path === '/write/new';
  const isDiff = /\/diff$/.test(ctx.path);
  const isDetail = !!p.id && !isDiff;

  if (isDiff) {
    const a = main.querySelector('#diff-a'), b = main.querySelector('#diff-b');
    [a, b].forEach(sel => sel && sel.addEventListener('change', () => { ui.diffA = a.value; ui.diffB = b.value; ctx.refresh(); }));
    return;
  }

  if (isNew) {
    startedAt = Date.now();
    const d = store.newDraft();
    const timer = main.querySelector('#new-timer');
    if (timer) {
      const upd = () => timer.textContent = `${String(Math.floor((Date.now() - startedAt) / 60000)).padStart(2, '0')}:${String(Math.floor((Date.now() - startedAt) / 1000) % 60).padStart(2, '0')}`;
      upd(); tickHandle = setInterval(upd, 1000);
    }
    const title = main.querySelector('#new-title'), type = main.querySelector('#new-type');
    const persistMeta = debounce(() => { const dr = store.newDraft(); dr.title = title.value; dr.type = type.value; store.save(); }, 500);
    title.addEventListener('input', persistMeta);
    type.addEventListener('change', persistMeta);
    const wrap = main.querySelector('#new-editor');
    if (wrap) editorCtl = wireEditor(wrap, { delay: store.get().settings.autosaveMs || 600, onChange: v => { store.newDraft().content = v; store.save(); } });
  }

  if (isDetail) {
    const e = store.get().essays.find(x => x.id === p.id);
    const wrap = main.querySelector('#essay-editor');
    if (wrap && e) editorCtl = wireEditor(wrap, {
      delay: store.get().settings.autosaveMs || 600,
      onChange: v => { const cur = store.get().essays.find(x => x.id === p.id); if (cur) { cur.content = v; cur.updatedAt = new Date().toISOString(); store.save(); } }
    });
    const sc = main.querySelector('#e-score'), out = main.querySelector('#e-score-out');
    if (sc) sc.addEventListener('input', () => { out.textContent = sc.value; });
  }

  const q = main.querySelector('#arch-q');
  if (q) q.addEventListener('input', () => { ui.q = q.value; const pos = q.selectionStart; ctx.refresh(); const n = main.ownerDocument.getElementById('arch-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });

  main.addEventListener('click', async (e) => {
    const t = e.target;
    const at = t.closest('[data-atype]');
    if (at) { ui.type = at.dataset.atype; ctx.refresh(); return; }
    const d1 = t.closest('[data-essay-del]');
    if (d1) {
      if (!await confirmSheet({ title: '删除作文', desc: '作文正文、版本与自评会一并删除，且无法恢复。', confirmText: '删除', danger: true })) return;
      store.mutate(s => { s.essays = s.essays.filter(x => x.id !== d1.dataset.essayDel); s.phrases = s.phrases.filter(x => x.essayId !== d1.dataset.essayDel); });
      toast('已删除'); ctx.refresh(); return;
    }
    const gpd = t.closest('[data-global-ph-del]');
    if (gpd) {
      store.mutate(s => { s.phrases = s.phrases.filter(x => x.id !== gpd.dataset.globalPhDel); });
      toast('已删除'); ctx.refresh(); return;
    }
    if (isNew && t.closest('[data-new-clear]')) {
      if (!await confirmSheet({ title: '清空草稿', desc: '当前标题与正文草稿将被清空，且无法恢复。', confirmText: '清空', danger: true })) return;
      if (editorCtl) editorCtl.destroy(), editorCtl = null;
      store.clearNewDraft(); toast('草稿已清空'); ctx.refresh(); return;
    }
    if (isNew && t.closest('[data-save-essay]')) {
      if (editorCtl) editorCtl.flush();
      const d = store.newDraft();
      const title = main.querySelector('#new-title'), type = main.querySelector('#new-type'), ta = main.querySelector('#new-content');
      d.title = title.value.trim(); d.type = type.value; d.content = ta.value;
      if (!d.content.trim()) { toast('正文还是空的，先写一点吧', 'err'); return; }
      const id = uid('essay');
      store.mutate(s => s.essays.unshift({
        id, title: d.title || `未命名作文 · ${fmtDate(new Date().toISOString())}`, type: d.type, content: d.content,
        createdAt: d.startedAt, updatedAt: new Date().toISOString(),
        durationSec: Math.round((Date.now() - new Date(d.startedAt).getTime()) / 1000),
        selfScore: 0, selfEval: '', problems: [], versions: [{ id: uid('v'), label: '初稿', content: d.content, at: new Date().toISOString() }],
        source: 'free', label: 'user'
      }));
      store.log('writing', { title: d.title, durationSec: Math.round((Date.now() - new Date(d.startedAt).getTime()) / 1000) });
      store.clearNewDraft();
      toast('作文已存入档案', 'ok'); ctx.go('#/essay/' + id); return;
    }
    if (isDetail && t.closest('[data-save-self]')) {
      const cur = store.get().essays.find(x => x.id === p.id); if (!cur) return;
      const sc = main.querySelector('#e-score'), ev = main.querySelector('#e-eval'), pr = main.querySelector('#e-problems');
      store.mutate(s => {
        const x = s.essays.find(y => y.id === p.id);
        x.selfScore = Number(sc.value) || 0; x.selfEval = ev.value;
        x.problems = pr.value.split(/[,，、]/).map(v => v.trim()).filter(Boolean);
        x.updatedAt = new Date().toISOString();
      });
      store.log('review', { essayId: p.id, selfScore: Number(sc.value) || 0 });
      toast('自评已保存', 'ok'); ctx.refresh(); return;
    }
    if (isDetail && t.closest('[data-save-version]')) {
      if (editorCtl) editorCtl.flush();
      const cur = store.get().essays.find(x => x.id === p.id); if (!cur) return;
      const v = await formSheet({ title: '保存为新版本', desc: '会把当前正文快照存成一个版本，之后可与其它版本做前后对比。', fields: [
        { key: 'label', label: '版本名称', value: `修改 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`, required: true }
      ], confirmText: '保存版本' });
      if (!v) return;
      store.mutate(s => { const x = s.essays.find(y => y.id === p.id); x.versions = x.versions || []; x.versions.push({ id: uid('v'), label: v.label, content: x.content, at: new Date().toISOString() }); });
      toast('版本已保存', 'ok'); ctx.refresh(); return;
    }
    if (isDetail && t.closest('[data-load-version]')) {
      const vid = t.closest('[data-load-version]').dataset.loadVersion;
      const cur = store.get().essays.find(x => x.id === p.id);
      const v = (cur.versions || []).find(x => x.id === vid); if (!v) return;
      if (!await confirmSheet({ title: '载入版本内容', desc: '会用该版本内容替换当前正文（当前正文已在自动保存中，建议先「保存为新版本」留档）。', confirmText: '载入' })) return;
      store.mutate(s => { const x = s.essays.find(y => y.id === p.id); x.content = v.content; x.updatedAt = new Date().toISOString(); });
      toast('已载入'); ctx.refresh(); return;
    }
    if (isDetail && t.closest('[data-del-version]')) {
      const vid = t.closest('[data-del-version]').dataset.delVersion;
      if (!await confirmSheet({ title: '删除版本', desc: '仅删除这个快照，不影响当前正文。', confirmText: '删除', danger: true })) return;
      store.mutate(s => { const x = s.essays.find(y => y.id === p.id); x.versions = (x.versions || []).filter(v => v.id !== vid); });
      ctx.refresh(); return;
    }
    if (isDetail && t.closest('[data-add-phrase]')) {
      const cur = store.get().essays.find(x => x.id === p.id); if (!cur) return;
      const v = await formSheet({ title: '收藏好句', desc: '把本篇里写得满意的句子存下来，可自行精简。', fields: [
        { key: 'text', label: '表达原文', type: 'textarea', rows: 5, required: true },
        { key: 'note', label: '批注', type: 'textarea', rows: 2 }
      ], confirmText: '收藏' });
      if (!v) return;
      store.mutate(s => s.phrases.unshift({ id: uid('ph'), text: v.text, note: v.note, source: cur.title, essayId: p.id, at: new Date().toISOString(), label: 'user' }));
      toast('已收藏', 'ok'); ctx.refresh(); return;
    }
    if (isDetail && t.closest('[data-e-ph-del]')) {
      const pid = t.closest('[data-e-ph-del]').dataset.ePhDel;
      store.mutate(s => { s.phrases = s.phrases.filter(x => x.id !== pid); });
      ctx.refresh();
    }
  });
}

export async function action(name, el, ctx) {
  const id = ctx.params && ctx.params.id;
  const e = id ? store.get().essays.find(x => x.id === id) : null;
  if (!e) return;
  if (name === 'meta') {
    const v = await formSheet({ title: '编辑作文信息', fields: [
      { key: 'title', label: '标题', value: e.title, required: true },
      { key: 'type', label: '文体', type: 'select', value: e.type, options: ['论说文', '论证有效性分析', '其他'].map(t => ({ value: t, label: t })) },
      { key: 'durationSec', label: '写作耗时（秒）', type: 'number', value: e.durationSec || 0, min: 0, max: 86400 }
    ], confirmText: '保存' });
    if (!v) return;
    store.mutate(s => { const x = s.essays.find(y => y.id === id); x.title = v.title; x.type = v.type; x.durationSec = Number(v.durationSec) || 0; });
    toast('已保存', 'ok'); ctx.refresh(); return;
  }
  if (name === 'delete') {
    if (!await confirmSheet({ title: '删除作文', desc: `确定删除「${esc(e.title)}」？`, confirmText: '删除', danger: true })) return;
    store.mutate(s => { s.essays = s.essays.filter(x => x.id !== id); s.phrases = s.phrases.filter(x => x.essayId !== id); });
    toast('已删除'); ctx.go('#/archive');
  }
}
