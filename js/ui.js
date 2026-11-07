/* 通用 UI 组件：Toast / 底部抽屉 / 表单 / 确认 / 内容标签 / 笔记 / 编辑器自动保存 */
'use strict';
import { $, esc, icon, uid, fmtDate, relTime, countWords, debounce, on, pad2 } from './utils.js';
import * as store from './store.js';

/* ---------------- Toast ---------------- */
export function toast(msg, type = '') {
  const root = $('#toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast ' + (type || '');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .25s'; }, 2200);
  setTimeout(() => el.remove(), 2500);
}

/* ---------------- 抽屉栈 ---------------- */
const sheetStack = [];
export function openSheet(html) {
  const root = $('#overlay-root');
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${html}</div>`;
  root.appendChild(wrap);
  sheetStack.push(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closeSheet(); });
  return wrap;
}
export function closeSheet(result) {
  const wrap = sheetStack.pop();
  if (wrap) wrap.remove();
  return result;
}
export function sheetEl() { return sheetStack[sheetStack.length - 1] || null; }

/** 确认对话 */
export function confirmSheet({ title = '确认操作', desc = '', confirmText = '确定', cancelText = '取消', danger = false } = {}) {
  return new Promise((resolve) => {
    const wrap = openSheet(`
      <div class="sheet-title">${esc(title)}</div>
      ${desc ? `<div class="sheet-desc">${desc}</div>` : ''}
      <div class="sheet-actions">
        <button class="btn btn-outline" data-x="cancel">${esc(cancelText)}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-x="ok">${esc(confirmText)}</button>
      </div>`);
    const done = (v) => { closeSheet(); resolve(v); };
    on(wrap, 'click', '[data-x]', (e, el) => done(el.dataset.x === 'ok'));
  });
}

/**
 * 通用表单抽屉
 * fields: [{key,label,type:'text'|'textarea'|'select'|'number'|'range',value,placeholder,options,hint,rows,min,max,step,required}]
 */
export function formSheet({ title, desc = '', fields = [], confirmText = '保存', extraHtml = '', onSubmit } = {}) {
  return new Promise((resolve) => {
    const body = fields.map(f => {
      const v = f.value == null ? '' : f.value;
      let ctrl;
      if (f.type === 'textarea') ctrl = `<textarea class="textarea" data-f="${esc(f.key)}" rows="${f.rows || 5}" placeholder="${esc(f.placeholder || '')}" style="min-height:${(f.rows || 5) * 26 + 24}px">${esc(v)}</textarea>`;
      else if (f.type === 'select') ctrl = `<select class="select" data-f="${esc(f.key)}">${(f.options || []).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(v) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
      else if (f.type === 'range') ctrl = `<div class="flex gap-3"><input type="range" data-f="${esc(f.key)}" min="${f.min ?? 0}" max="${f.max ?? 100}" step="${f.step ?? 1}" value="${esc(v)}" style="flex:1;accent-color:var(--brand);min-width:0"><b class="t-brand" data-range-out="${esc(f.key)}" style="width:40px;text-align:right">${esc(v)}</b></div>`;
      else ctrl = `<input class="input" type="${f.type === 'number' ? 'number' : 'text'}" data-f="${esc(f.key)}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${f.type === 'number' ? `min="${f.min ?? ''}" max="${f.max ?? ''}"` : ''}>`;
      return `<label class="field"><span class="field-label">${esc(f.label)}${f.required ? ' <span class="t-danger">*</span>' : ''}</span>${ctrl}${f.hint ? `<span class="field-hint">${f.hint}</span>` : ''}</label>`;
    }).join('');
    const wrap = openSheet(`
      <div class="sheet-title">${esc(title)}</div>
      ${desc ? `<div class="sheet-desc">${desc}</div>` : ''}
      <form data-form novalidate>${body}${extraHtml}</form>
      <div class="sheet-actions">
        <button class="btn btn-outline" data-x="cancel">取消</button>
        <button class="btn btn-primary" data-x="ok">${esc(confirmText)}</button>
      </div>`);
    on(wrap, 'input', 'input[type=range][data-f]', (e, el) => {
      const out = $(`[data-range-out="${el.dataset.f}"]`, wrap); if (out) out.textContent = el.value;
    });
    const submit = () => {
      const vals = {};
      for (const f of fields) {
        const el = $(`[data-f="${f.key}"]`, wrap);
        vals[f.key] = el ? el.value.trim() : '';
        if (f.required && !vals[f.key]) { toast(`请填写「${f.label}」`, 'err'); el && el.focus(); return; }
      }
      closeSheet();
      if (onSubmit) onSubmit(vals);
      resolve(vals);
    };
    on(wrap, 'click', '[data-x]', (e, el) => { if (el.dataset.x === 'cancel') { closeSheet(); resolve(null); } else submit(); });
    on(wrap, 'submit', '[data-form]', (e) => { e.preventDefault(); submit(); });
  });
}

/* ---------------- 内容来源标签 ---------------- */
export const LABELS = {
  demo:   { text: '演示内容', cls: 'label-demo' },
  ai:     { text: 'AI 生成', cls: 'label-ai' },
  user:   { text: '个人添加', cls: 'label-user' },
  import: { text: '导入资料', cls: 'label-import' },
  public: { text: '古籍·公有领域', cls: 'label-public' }
};
export function labelChip(label) {
  const L = LABELS[label] || LABELS.user;
  return `<span class="chip ${L.cls}">${L.text}</span>`;
}
export function disclaimer(compact = false) {
  return `<div class="notice ${compact ? '' : 'warn'}">
    ${icon('info', 16)}
    <div><b>内容声明：</b>本站内置内容均为「演示内容」或「AI 生成」示例，<b>不含真实考研真题、官方范文或权威机构课程内容</b>，也不提供作文自动评分。请通过「数据管理 → 导入内容包」载入你自己的教材、讲义、真题与范文；主观作文请以人工评分与自我评价为准。</div>
  </div>`;
}

export function emptyState(ico, title, desc, actionHtml = '') {
  return `<div class="empty"><div class="e-ico">${esc(ico)}</div>
    <div class="e-title">${esc(title)}</div>
    <div class="e-desc">${desc}</div>${actionHtml}</div>`;
}

/* ---------------- 个人笔记（课程 / 范文共用，可增删改） ---------------- */
export function notesHtml(key) {
  const st = store.get();
  const list = st.notes[key] || [];
  return `<div class="section-head"><h2>个人笔记</h2><span class="cap">${list.length} 条</span></div>
    <div class="card card-pad">
      ${list.length ? list.map(n => `
        <div class="note-item" data-note-id="${esc(n.id)}">
          <div class="n-meta"><span>${fmtDate(n.at, true)}${n.editedAt ? ' · 已编辑' : ''}</span>
            <span class="flex gap-2">
              <button class="btn btn-xs btn-ghost" data-note-edit="${esc(n.id)}">编辑</button>
              <button class="btn btn-xs btn-ghost t-danger" data-note-del="${esc(n.id)}">删除</button>
            </span></div>
          <div class="n-text">${esc(n.text)}</div>
        </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:16px 0">还没有笔记，随手记下自己的理解与易错点。</div>`}
      <button class="btn btn-soft btn-block mt-2" data-note-add>${icon('plus', 16)} 添加笔记</button>
    </div>`;
}

export function bindNotes(root, key, refresh) {
  const add = async () => {
    const v = await formSheet({
      title: '添加笔记', fields: [{ key: 'text', label: '笔记内容', type: 'textarea', rows: 6, required: true, placeholder: '写下你的理解、疑问、易错点…' }], confirmText: '保存笔记'
    });
    if (!v) return;
    store.mutate(s => {
      (s.notes[key] = s.notes[key] || []).unshift({ id: uid('note'), text: v.text, at: new Date().toISOString() });
    });
    store.log('note', { key });
    toast('笔记已保存', 'ok'); refresh();
  };
  on(root, 'click', '[data-note-add]', add);
  on(root, 'click', '[data-note-edit]', async (e, el) => {
    const st = store.get(); const n = (st.notes[key] || []).find(x => x.id === el.dataset.noteEdit);
    if (!n) return;
    const v = await formSheet({ title: '编辑笔记', fields: [{ key: 'text', label: '笔记内容', type: 'textarea', rows: 6, value: n.text, required: true }], confirmText: '保存修改' });
    if (!v) return;
    store.mutate(s => { const t = (s.notes[key] || []).find(x => x.id === n.id); if (t) { t.text = v.text; t.editedAt = new Date().toISOString(); } });
    toast('笔记已更新', 'ok'); refresh();
  });
  on(root, 'click', '[data-note-del]', async (e, el) => {
    if (!await confirmSheet({ title: '删除笔记', desc: '删除后无法恢复，确定继续？', confirmText: '删除', danger: true })) return;
    store.mutate(s => { s.notes[key] = (s.notes[key] || []).filter(x => x.id !== el.dataset.noteDel); });
    toast('已删除'); refresh();
  });
}

/* ---------------- 写作编辑器：自动保存 + 字数统计 ---------------- */
/**
 * @param {HTMLElement} root 包含 .editor 与 .editor-bar 的容器
 * @param {object} opt { onChange(value), minWords, maxWords, delay }
 * @returns {{flush:Function, destroy:Function}}
 */
export function wireEditor(root, opt = {}) {
  const ta = $('.editor', root);
  const wc = $('[data-wc]', root);
  const saveEl = $('[data-save]', root);
  const dot = $('[data-save-dot]', root);
  const limitEl = $('[data-limit]', root);
  const delay = opt.delay || 600;
  if (!ta) return { flush() {}, destroy() {} };

  const updateCount = () => {
    const c = countWords(ta.value);
    if (wc) wc.textContent = `${c.total} 字（含中文 ${c.cjk} 字）`;
    if (limitEl) {
      const min = opt.minWords || 0, max = opt.maxWords || 0;
      if (min || max) {
        const ok = c.total >= min && (!max || c.total <= max);
        limitEl.className = ok ? 'limit-ok' : 'limit-bad';
        limitEl.textContent = `要求 ${min}${max ? '–' + max : '+'} 字`;
      }
    }
  };
  const setSaved = () => {
    const d = new Date();
    if (saveEl) saveEl.textContent = `已自动保存 ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    if (dot) dot.classList.remove('saving');
  };
  const persist = () => { opt.onChange && opt.onChange(ta.value); setSaved(); };
  const deb = debounce(persist, delay);

  const onInput = () => {
    updateCount();
    if (saveEl) saveEl.textContent = '正在保存…';
    if (dot) dot.classList.add('saving');
    deb();
  };
  const onHide = () => { if (deb) deb.flush(); };
  const onVis = () => { if (document.visibilityState === 'hidden') onHide(); };
  ta.addEventListener('input', onInput);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onHide);
  updateCount();
  return {
    flush: onHide,
    destroy() { deb.cancel(); ta.removeEventListener('input', onInput); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', onHide); }
  };
}

/* ---------------- 常用小组件 ---------------- */
export function favBtn(active, dataAttr, value) {
  return `<button class="fav-btn ${active ? 'on' : ''}" data-${dataAttr}="${esc(value)}" aria-label="${active ? '取消收藏' : '收藏'}">${icon('heart', 18)}</button>`;
}
export function timeChip(iso) { return `<span class="chip chip-outline">${relTime(iso)}</span>`; }
export function sectionTitle(title, cap = '', rightHtml = '') {
  return `<div class="section-head"><h2>${esc(title)}</h2>${cap ? `<span class="cap">${esc(cap)}</span>` : ''}${rightHtml ? `<div class="more">${rightHtml}</div>` : ''}</div>`;
}
