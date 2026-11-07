/* 范文学习：结构拆解 / 逐段精读 / 思路分析 / 好词好句收藏 / 个人笔记 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtDate, excerpt } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, sectionTitle, notesHtml, bindNotes, disclaimer } from '../ui.js';

const ui = { q: '', type: '全部', tab: 'structure' };

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return store.get().modelEssays.filter(m => {
    if (ui.type !== '全部' && m.type !== ui.type) return false;
    if (!q) return true;
    return [m.title, m.type, m.prompt, m.source, ...(m.paragraphs || []).map(p => p.text)].join(' ').toLowerCase().includes(q);
  });
}

export function render(ctx) {
  if (ctx.params && ctx.params.id) return detail(ctx, ctx.params.id);
  return list(ctx);
}

function list(ctx) {
  const s = store.get(), arr = filtered();
  return {
    title: '范文学习', sub: `${s.modelEssays.length} 篇 · ${s.phrases.length} 条收藏表达`,
    actions: `<button class="icon-btn" data-app-action="add" aria-label="添加范文">${icon('plus', 21)}</button>`,
    html: `
      <div class="page-head"><h1>范文学习</h1><p>按结构拆解与逐段精读的方式学习。内置范文均为 AI 生成演示内容，非真题、非官方范文。</p></div>
      <div class="tabs"><button data-go="#/materials">素材库</button><button class="active">范文学习</button></div>
      <div class="input-search mb-3"><input class="input" id="model-q" placeholder="搜索标题、材料、正文…" value="${esc(ui.q)}">${icon('search', 17)}</div>
      <div class="filter-scroll mb-4">${['全部', '论说文', '论证有效性分析'].map(t => `<button class="filter-pill ${ui.type === t ? 'active' : ''}" data-mtype="${esc(t)}">${esc(t)}</button>`).join('')}
        <button class="filter-pill" data-go="#/settings">导入自己的范文</button></div>
      ${arr.length ? arr.map(m => {
        const learned = (m.learned || []).length, total = (m.paragraphs || []).length;
        return `<a class="card card-pad" style="display:block;margin-bottom:11px" href="#/model/${esc(m.id)}">
          <div class="chips mb-2">${labelChip(m.label)}<span class="chip chip-brand">${esc(m.type)}</span>${learned ? `<span class="chip chip-success">已学 ${learned}/${total} 段</span>` : ''}</div>
          <div class="t-md t-bold" style="line-height:1.5">${esc(m.title)}</div>
          <div class="t-sm t-muted mt-2 clamp-2" style="line-height:1.7">${esc(excerpt(m.prompt, 90))}</div>
          <div class="t-xs t-muted mt-2">${total} 个段落 · ${(m.structure || []).length} 个结构环节${m.source ? ' · ' + esc(excerpt(m.source, 30)) : ''}</div>
        </a>`;
      }).join('') : emptyState('范', '没有匹配的范文', '换个关键词，或在「数据管理 → 导入内容包」中载入你自己的范文。', `<button class="btn btn-primary btn-sm" data-app-action="add">添加范文</button>`)}
      ${disclaimer(true)}
    `
  };
}

function detail(ctx, id) {
  const m = store.get().modelEssays.find(x => x.id === id);
  if (!m) return { title: '范文不存在', html: emptyState('?', '未找到这篇范文', '它可能已被删除。', `<a class="btn btn-primary btn-sm" href="#/models">返回范文列表</a>`) };
  const paras = m.paragraphs || [], learned = m.learned || [];
  const myPhrases = store.get().phrases.filter(p => p.modelId === id);

  return {
    title: '范文精读', sub: excerpt(m.title, 14), fab: false,
    actions: `<button class="icon-btn" data-app-action="del" aria-label="删除范文">${icon('trash', 20)}</button>`,
    html: `
      <div class="breadcrumb"><a href="#/models">范文学习</a> / 精读</div>
      <div class="card card-pad mb-4">
        <div class="chips mb-2">${labelChip(m.label)}<span class="chip chip-brand">${esc(m.type)}</span></div>
        <h1 style="font-size:var(--fs-xl);line-height:1.45;font-weight:730">${esc(m.title)}</h1>
        ${m.source ? `<div class="t-xs t-muted mt-2">来源说明：${esc(m.source)}</div>` : ''}
        <div class="divider"></div>
        <div class="t-xs t-bold t-brand mb-2">题目 / 材料</div>
        <div class="bodytext">${esc(m.prompt)}</div>
        <div class="flex between mt-3"><span class="t-sm t-muted">逐段学习进度 ${learned.length}/${paras.length}</span>
          <button class="btn btn-xs btn-outline" data-app-action="reset-learn">重置学习进度</button></div>
        <div class="progress thin mt-2"><i style="width:${paras.length ? Math.round(learned.length / paras.length * 100) : 0}%"></i></div>
      </div>

      <div class="tabs" data-model-tabs>
        <button class="${ui.tab === 'structure' ? 'active' : ''}" data-tab="structure">结构拆解</button>
        <button class="${ui.tab === 'read' ? 'active' : ''}" data-tab="read">逐段精读</button>
        <button class="${ui.tab === 'phrases' ? 'active' : ''}" data-tab="phrases">好词好句</button>
        <button class="${ui.tab === 'notes' ? 'active' : ''}" data-tab="notes">个人笔记</button>
      </div>

      <div data-pane="structure" class="${ui.tab === 'structure' ? '' : 'hidden'}">
        ${(m.structure || []).length ? m.structure.map((s, i) => `
          <div class="card card-pad mb-3" style="border-left:4px solid var(--brand)">
            <div class="flex gap-2"><span class="chip chip-brand">${i + 1}</span><b class="t-md">${esc(s.part)}</b></div>
            <div class="bodytext mt-2">${esc(s.desc)}</div>
          </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">暂无结构拆解，可在导入范文时补充。</div>`}
        <div class="card card-pad mt-3">${sectionTitle('论证思路串讲', '')}
          <div class="bodytext">${esc((m.structure || []).map((s, i) => `${i + 1}. ${s.part}：${s.desc}`).join('\n')) || '可在逐段精读中查看每段的思路分析。'}</div>
          <div class="notice brand mt-3" style="margin:0">${icon('info', 15)}<div>结构模板只是脚手架。请把每段的「角色 → 承担的论证任务 → 与中心论点的关系」迁移到自己的写作中，而不是背诵句子。</div></div>
        </div>
      </div>

      <div data-pane="read" class="${ui.tab === 'read' ? '' : 'hidden'}">
        ${paras.length ? paras.map((p, i) => `
          <div class="para-card ${learned.includes(p.id) ? 'learned' : ''}">
            <div class="para-head"><span class="p-no">第 ${i + 1} 段</span><span class="p-role">${esc(p.role || '正文')}</span>
              <span class="t-xs ${learned.includes(p.id) ? 't-success' : 't-muted'}">${learned.includes(p.id) ? '已学' : '未学'}</span></div>
            <div class="para-text">${esc(p.text)}</div>
            <div class="para-analysis"><div class="a-t">论证思路分析</div>${esc(p.analysis || '（暂无解析，可添加个人笔记补充你的理解）')}</div>
            <div class="flex gap-2 wrap" style="padding:9px 12px;border-top:1px solid var(--border)">
              <button class="btn btn-xs ${learned.includes(p.id) ? 'btn-outline' : 'btn-soft'}" data-para-learn="${esc(p.id)}">${learned.includes(p.id) ? '取消已学' : icon('check', 13) + ' 标记已学'}</button>
              <button class="btn btn-xs btn-outline" data-para-phrase="${esc(p.id)}">${icon('heart', 13)} 收藏好句</button>
              <button class="btn btn-xs btn-ghost" data-para-note="${esc(p.id)}">写段落笔记</button>
            </div>
          </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">这篇范文还没有分段内容。</div>`}
      </div>

      <div data-pane="phrases" class="${ui.tab === 'phrases' ? '' : 'hidden'}">
        ${sectionTitle('收藏的优秀表达', `${myPhrases.length} 条`)}
        ${myPhrases.length ? myPhrases.map(p => `<div class="phrase-item">
          <div class="p-txt">${esc(p.text)}${p.note ? `<div class="t-xs t-muted mt-2" style="font-family:var(--font-sans)">批注：${esc(p.note)}</div>` : ''}
            <div class="t-xs t-muted mt-2" style="font-family:var(--font-sans)">${esc(p.source || '')} · ${fmtDate(p.at)}</div></div>
          <button class="btn btn-xs btn-ghost" data-ph-edit="${esc(p.id)}">改</button>
          <button class="btn btn-xs btn-ghost t-danger" data-ph-del="${esc(p.id)}">删</button>
        </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">还没有收藏表达。在「逐段精读」里点「收藏好句」即可添加。</div>`}
        <button class="btn btn-outline btn-block btn-sm mt-2" data-app-action="add-phrase">${icon('plus', 15)} 手动添加一条表达</button>
      </div>

      <div data-pane="notes" class="${ui.tab === 'notes' ? '' : 'hidden'}">${notesHtml('model:' + m.id)}</div>
      <div class="divider"></div><a class="btn btn-outline btn-block" href="#/models">← 返回范文列表</a>
    `
  };
}

export function mount(ctx, main) {
  const q = document.getElementById('model-q');
  if (q) q.addEventListener('input', () => { ui.q = q.value; const p = q.selectionStart; ctx.refresh(); const n = document.getElementById('model-q'); if (n) { n.focus(); n.setSelectionRange(p, p); } });
  const id = ctx.params && ctx.params.id;
  const model = id ? store.get().modelEssays.find(x => x.id === id) : null;

  main.addEventListener('click', async (e) => {
    const mt = e.target.closest('[data-mtype]');
    if (mt) { ui.type = mt.dataset.mtype; ctx.refresh(); return; }
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      ui.tab = tab.dataset.tab;
      main.querySelectorAll('[data-model-tabs] button').forEach(b => b.classList.toggle('active', b === tab));
      main.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== ui.tab));
      return;
    }
    const learn = e.target.closest('[data-para-learn]');
    if (learn && model) {
      const pid = learn.dataset.paraLearn;
      store.mutate(s => { const m = s.modelEssays.find(x => x.id === id); m.learned = m.learned || []; const i = m.learned.indexOf(pid); if (i >= 0) m.learned.splice(i, 1); else m.learned.push(pid); });
      store.log('model', { id }); ctx.refresh(); return;
    }
    const ph = e.target.closest('[data-para-phrase]');
    if (ph && model) {
      const p = model.paragraphs.find(x => x.id === ph.dataset.paraPhrase); if (!p) return;
      const v = await formSheet({ title: '收藏好词好句', desc: '可把整段精简成你真正想记的一句；收藏后支持编辑与删除。', fields: [
        { key: 'text', label: '表达原文', type: 'textarea', rows: 6, value: p.text, required: true },
        { key: 'note', label: '我的批注', type: 'textarea', rows: 3, placeholder: '例如：可用于辩证段回扣' }
      ], confirmText: '收藏' });
      if (!v) return;
      store.mutate(s => s.phrases.unshift({ id: uid('ph'), text: v.text, note: v.note, source: model.title, modelId: id, at: new Date().toISOString(), label: 'user' }));
      toast('已收藏', 'ok'); ctx.refresh(); return;
    }
    const pn = e.target.closest('[data-para-note]');
    if (pn && model) {
      const p = model.paragraphs.find(x => x.id === pn.dataset.paraNote); if (!p) return;
      const v = await formSheet({ title: '段落笔记', fields: [{ key: 'text', label: '这一段我学到什么', type: 'textarea', rows: 5, required: true }], confirmText: '保存' });
      if (!v) return;
      store.mutate(s => { const k = 'model:' + id; (s.notes[k] = s.notes[k] || []).unshift({ id: uid('note'), text: `【第 ${model.paragraphs.indexOf(p) + 1} 段】${v.text}`, at: new Date().toISOString() }); });
      toast('笔记已保存', 'ok'); return;
    }
    const pe = e.target.closest('[data-ph-edit]');
    if (pe) {
      const p = store.get().phrases.find(x => x.id === pe.dataset.phEdit); if (!p) return;
      const v = await formSheet({ title: '编辑收藏表达', fields: [
        { key: 'text', label: '表达原文', type: 'textarea', rows: 5, value: p.text, required: true },
        { key: 'note', label: '批注', type: 'textarea', rows: 3, value: p.note || '' }
      ], confirmText: '保存' });
      if (!v) return;
      store.mutate(s => { const t = s.phrases.find(x => x.id === p.id); t.text = v.text; t.note = v.note; });
      toast('已保存', 'ok'); ctx.refresh(); return;
    }
    const pd = e.target.closest('[data-ph-del]');
    if (pd) {
      if (!await confirmSheet({ title: '删除收藏', desc: '确定删除这条表达？', confirmText: '删除', danger: true })) return;
      store.mutate(s => { s.phrases = s.phrases.filter(x => x.id !== pd.dataset.phDel); });
      ctx.refresh();
    }
  });
  if (model) bindNotes(main, 'model:' + model.id, () => ctx.refresh());
}

export async function action(name, el, ctx) {
  const id = ctx.params && ctx.params.id;
  if (name === 'reset-learn' && id) {
    store.mutate(s => { const m = s.modelEssays.find(x => x.id === id); if (m) m.learned = []; });
    toast('已重置逐段学习进度'); ctx.refresh(); return;
  }
  if (name === 'add-phrase' && id) {
    const v = await formSheet({ title: '添加优秀表达', fields: [
      { key: 'text', label: '表达原文', type: 'textarea', rows: 5, required: true },
      { key: 'source', label: '出处', value: '', placeholder: '自己整理 / 书名页码' },
      { key: 'note', label: '批注', type: 'textarea', rows: 3 }
    ], confirmText: '收藏' });
    if (!v) return;
    store.mutate(s => s.phrases.unshift({ id: uid('ph'), text: v.text, note: v.note, source: v.source, modelId: id, at: new Date().toISOString(), label: 'user' }));
    toast('已收藏', 'ok'); ctx.refresh(); return;
  }
  if (name === 'add') {
    const v = await formSheet({
      title: '添加个人范文', desc: '把全文粘贴进来，用空行分段；之后可在每段补充解析。内容标记为「个人添加」。',
      fields: [
        { key: 'title', label: '范文标题', required: true },
        { key: 'type', label: '文体', type: 'select', options: [{ value: '论说文', label: '论说文' }, { value: '论证有效性分析', label: '论证有效性分析' }, { value: '其他', label: '其他' }] },
        { key: 'prompt', label: '题目 / 材料', type: 'textarea', rows: 4 },
        { key: 'source', label: '来源说明', placeholder: '自己整理 / 书名页码 / AI 生成（请如实标注）' },
        { key: 'text', label: '正文（空行分段）', type: 'textarea', rows: 10, required: true }
      ], confirmText: '创建范文'
    });
    if (!v) return;
    const paras = v.text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map((text, i) => ({ id: uid('pa'), role: `第 ${i + 1} 段`, text, analysis: '' }));
    const nid = uid('model');
    store.mutate(s => s.modelEssays.unshift({ id: nid, title: v.title, type: v.type, prompt: v.prompt, source: v.source || '个人添加', label: 'user', structure: [], paragraphs: paras, learned: [] }));
    toast('范文已创建', 'ok'); ctx.go('#/model/' + nid); return;
  }
  if (name === 'del' && id) {
    if (!await confirmSheet({ title: '删除范文', desc: '确定删除这篇范文？相关收藏表达会保留，但笔记会被移除。', confirmText: '删除', danger: true })) return;
    store.mutate(s => { s.modelEssays = s.modelEssays.filter(x => x.id !== id); delete s.notes['model:' + id]; });
    toast('已删除'); ctx.go('#/models');
  }
}
