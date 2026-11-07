/* 课程学习系统：列表 + 详情（知识点 / 重难点 / 示例解析 / 笔记 / 完成 / 复习计划） */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtDate, excerpt } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, notesHtml, bindNotes, sectionTitle, disclaimer } from '../ui.js';

const ui = { q: '', cat: '全部', openPoint: null };

function categories() {
  const set = new Set(store.get().courses.map(c => c.category || '其他'));
  return ['全部', ...Array.from(set)];
}
function filtered() {
  const q = ui.q.trim().toLowerCase();
  return store.get().courses.filter(c => {
    if (ui.cat !== '全部' && c.category !== ui.cat) return false;
    if (!q) return true;
    return [c.title, c.summary, c.category, ...(c.tags || []), ...(c.keyTakeaways || [])]
      .join(' ').toLowerCase().includes(q);
  });
}

export function render(ctx) {
  if (ctx.params && ctx.params.id) return detail(ctx, ctx.params.id);
  return list(ctx);
}

/* ---------------- 列表 ---------------- */
function list(ctx) {
  const s = store.get(), st = store.stats();
  const arr = filtered();
  return {
    title: '课程学习', sub: `${st.doneCourses}/${st.courseTotal} 讲已完成`,
    actions: `<button class="icon-btn" data-app-action="new" aria-label="新建课程">${icon('plus', 21)}</button>`,
    html: `
      <div class="page-head"><h1>课程学习</h1><p>按「知识点 → 重难点 → 示例解析 → 笔记」的顺序学完一讲，再标记完成并加入复习计划。</p></div>
      <div class="card card-pad mb-4">
        <div class="flex between mb-2"><span class="t-sm t-bold">总体进度</span><span class="t-sm t-brand t-bold">${st.coursePct}%</span></div>
        <div class="progress"><i style="width:${st.coursePct}%"></i></div>
        <div class="t-xs t-muted mt-2">已完成 ${st.doneCourses} 讲 · 共 ${st.courseTotal} 讲 · 加入复习 ${s.reviewQueue.filter(r => r.targetType === 'course' || r.targetType === 'point').length} 项</div>
      </div>
      <div class="input-search mb-3"><input class="input" id="course-q" placeholder="搜索课程标题、标签、要点…" value="${esc(ui.q)}">${icon('search', 17)}</div>
      <div class="filter-scroll mb-4">${categories().map(c => `<button class="filter-pill ${ui.cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      ${arr.length ? `<div class="grid grid-md-2">${arr.map((c, i) => {
        const inRev = store.hasReview('course', c.id);
        return `<a class="course-card" href="#/course/${esc(c.id)}">
          <div class="cc-top"><span class="cc-idx">${c.completed ? '✓' : String(i + 1).padStart(2, '0')}</span>
            <div class="flex-1"><div class="cc-title">${esc(c.title)}</div><div class="cc-sum clamp-2 mt-1">${esc(c.summary || '')}</div></div></div>
          <div class="chips">${labelChip(c.label)}<span class="chip">${esc(c.category || '课程')}</span>${c.completed ? '<span class="chip chip-success">已完成</span>' : ''}${inRev ? '<span class="chip chip-warn">复习中</span>' : ''}</div>
          <div class="cc-foot"><span class="t-xs t-muted">${c.points.length} 个知识点 · ${c.examples.length} 个示例 · 约 ${c.minutes || 20} 分钟</span>
            <span class="t-brand" style="margin-left:auto">${icon('right', 16)}</span></div>
        </a>`;
      }).join('')}</div>` : emptyState('课', '没有匹配的课程', '换个关键词或筛选条件，也可以新建一门自己的课程。', `<button class="btn btn-primary btn-sm" data-app-action="new">新建课程</button>`)}
      <div class="mt-4"><button class="btn btn-outline btn-block" data-app-action="new">${icon('plus', 16)} 新建个人课程</button></div>
      ${disclaimer(true)}
    `
  };
}

/* ---------------- 详情 ---------------- */
function detail(ctx, id) {
  const c = store.get().courses.find(x => x.id === id);
  if (!c) return { title: '课程不存在', html: emptyState('?', '未找到这门课程', '它可能已被删除，或在导入的数据包中不存在。', `<a class="btn btn-primary btn-sm" href="#/courses">返回课程列表</a>`) };
  const key = 'course:' + c.id;
  const inRev = store.hasReview('course', c.id);
  const points = c.points || [], diffs = c.difficulties || [], exs = c.examples || [];

  return {
    title: '课程详情', sub: excerpt(c.title, 16),
    fab: false,
    actions: `<button class="icon-btn" data-app-action="edit" aria-label="编辑课程">${icon('edit', 20)}</button>
              <button class="icon-btn" data-app-action="del" aria-label="删除课程">${icon('trash', 20)}</button>`,
    html: `
      <div class="breadcrumb"><a href="#/courses">课程学习</a> / ${esc(c.category || '课程')}</div>
      <div class="card card-pad mb-4">
        <div class="chips mb-3">${labelChip(c.label)}<span class="chip chip-brand">${esc(c.category || '课程')}</span>${c.completed ? '<span class="chip chip-success">已完成</span>' : ''}${c.editedByUser ? '<span class="chip chip-outline">本人已修改</span>' : ''}</div>
        <h1 style="font-size:var(--fs-xl);line-height:1.4;font-weight:730">${esc(c.title)}</h1>
        <p class="t-md t-ink2 mt-2" style="line-height:1.8">${esc(c.summary || '')}</p>
        <div class="t-xs t-muted mt-3">${points.length} 个知识点 · ${diffs.length} 个重难点 · ${exs.length} 个示例 · 约 ${c.minutes || 20} 分钟${c.completedAt ? ' · 完成于 ' + fmtDate(c.completedAt) : ''}</div>
        <div class="btn-row mt-4">
          <button class="btn ${c.completed ? 'btn-outline' : 'btn-primary'} equal" data-app-action="complete">${icon('check', 16)} ${c.completed ? '取消完成' : '标记完成'}</button>
          <button class="btn ${inRev ? 'btn-outline' : 'btn-soft'} equal" data-app-action="review">${icon('refresh', 16)} ${inRev ? '移出复习' : '加入复习计划'}</button>
        </div>
      </div>

      <div class="tabs" data-course-tabs>
        <button class="active" data-tab="points">知识点说明</button>
        <button data-tab="hard">重点难点</button>
        <button data-tab="examples">示例与解析</button>
        <button data-tab="notes">个人笔记</button>
      </div>

      <div data-pane="points">
        ${points.length ? points.map((p, i) => {
          const pid = `${c.id}:${p.id}`;
          const pRev = store.hasReview('point', pid);
          return `<div class="acc ${ui.openPoint === pid || (ui.openPoint === null && i === 0) ? 'open' : ''}" data-acc="${esc(pid)}">
            <button class="acc-head" data-acc-toggle="${esc(pid)}"><span class="n">${i + 1}</span><span class="flex-1">${esc(p.title)}</span>${icon('down', 16, 'caret')}</button>
            <div class="acc-body">
              <div class="bodytext mt-3">${esc(p.content)}</div>
              <div class="btn-row mt-3">
                <button class="btn btn-xs btn-soft" data-point-rev="${esc(pid)}" data-point-label="${esc(p.title)}">${pRev ? '✓ 已在复习计划' : '+ 加入复习'}</button>
                <button class="btn btn-xs btn-outline" data-point-edit="${esc(p.id)}">编辑</button>
                <button class="btn btn-xs btn-ghost t-danger" data-point-del="${esc(p.id)}">删除</button>
              </div>
            </div>
          </div>`;
        }).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">暂无知识点，可点击「+ 添加知识点」补充。</div>`}
        <button class="btn btn-outline btn-block btn-sm mt-2" data-app-action="add-point">${icon('plus', 15)} 添加知识点</button>
        ${(c.keyTakeaways || []).length ? `<div class="card card-pad mt-4">${sectionTitle('要点速记', '')}
          <ul class="bodytext" style="margin:0;padding-left:20px">${c.keyTakeaways.map(k => `<li>${esc(k)}</li>`).join('')}</ul></div>` : ''}
      </div>

      <div data-pane="hard" class="hidden">
        ${diffs.length ? diffs.map(d => `<div class="card card-pad mb-3"><div class="t-md t-bold mb-2">${icon('alert', 16)} ${esc(d.title)}</div><div class="bodytext">${esc(d.content)}</div></div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">暂无重难点说明。</div>`}
        <button class="btn btn-outline btn-block btn-sm" data-app-action="add-hard">${icon('plus', 15)} 添加重点难点</button>
      </div>

      <div data-pane="examples" class="hidden">
        ${exs.length ? exs.map(e => `<div class="example-box">
          <div class="ex-label">${labelChip(e.label || c.label)}</div>
          <div class="ex-t">${esc(e.title)}</div>
          <div class="prose" style="font-size:16px;white-space:pre-wrap">${esc(e.text)}</div>
          <div class="divider"></div>
          <div class="t-xs t-bold t-brand mb-2">详细解析</div>
          <div class="bodytext">${esc(e.analysis)}</div>
        </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:18px">暂无示例，可添加自己的例句与解析。</div>`}
        <button class="btn btn-outline btn-block btn-sm" data-app-action="add-example">${icon('plus', 15)} 添加示例 / 解析</button>
      </div>

      <div data-pane="notes" class="hidden">${notesHtml(key)}</div>

      <div class="divider"></div>
      <a class="btn btn-outline btn-block" href="#/courses">← 返回课程列表</a>
    `
  };
}

/* ---------------- 交互 ---------------- */
export function mount(ctx, main) {
  const q = document.getElementById('course-q');
  if (q) {
    q.addEventListener('input', () => { ui.q = q.value; const pos = q.selectionStart; ctx.refresh(); const n = document.getElementById('course-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } });
  }
  const id = ctx.params && ctx.params.id;
  const course = id ? store.get().courses.find(x => x.id === id) : null;

  main.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { ui.cat = cat.dataset.cat; ctx.refresh(); return; }

    const tab = e.target.closest('[data-tab]');
    if (tab) {
      main.querySelectorAll('[data-course-tabs] button').forEach(b => b.classList.toggle('active', b === tab));
      main.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== tab.dataset.tab));
      return;
    }
    const acc = e.target.closest('[data-acc-toggle]');
    if (acc) { const box = acc.closest('.acc'); box.classList.toggle('open'); ui.openPoint = box.classList.contains('open') ? acc.dataset.accToggle : null; return; }

    const prv = e.target.closest('[data-point-rev]');
    if (prv) {
      const pid = prv.dataset.pointRev;
      if (store.hasReview('point', pid)) { store.removeReview('point', pid); toast('已移出复习计划'); }
      else { store.addReview('point', pid, (course ? course.title + ' · ' : '') + prv.dataset.pointLabel); store.log('course', { id }); toast('已加入复习计划', 'ok'); }
      ctx.refresh(); return;
    }
    const pe = e.target.closest('[data-point-edit]');
    if (pe && course) {
      const p = course.points.find(x => x.id === pe.dataset.pointEdit); if (!p) return;
      const v = await formSheet({ title: '编辑知识点', fields: [
        { key: 'title', label: '标题', value: p.title, required: true },
        { key: 'content', label: '说明', type: 'textarea', rows: 8, value: p.content, required: true }
      ], confirmText: '保存修改' });
      if (!v) return;
      store.mutate(s => { const t = s.courses.find(x => x.id === id).points.find(x => x.id === p.id); t.title = v.title; t.content = v.content; s.courses.find(x => x.id === id).editedByUser = true; });
      toast('已保存', 'ok'); ctx.refresh(); return;
    }
    const pd = e.target.closest('[data-point-del]');
    if (pd && course) {
      if (!await confirmSheet({ title: '删除知识点', desc: '确定删除该知识点？', confirmText: '删除', danger: true })) return;
      store.mutate(s => { const c = s.courses.find(x => x.id === id); c.points = c.points.filter(x => x.id !== pd.dataset.pointDel); c.editedByUser = true; });
      ctx.refresh(); return;
    }
    if (e.target.closest('[data-app-action="new"]')) return;
  });

  if (course) bindNotes(main, 'course:' + course.id, () => ctx.refresh());
}

export async function action(name, el, ctx) {
  const id = ctx.params && ctx.params.id;
  const course = id ? store.get().courses.find(x => x.id === id) : null;
  if (name === 'new') {
    const cats = categories().filter(c => c !== '全部');
    const v = await formSheet({ title: '新建个人课程', desc: '创建后可继续添加知识点、重难点与示例，内容保存在本机。', fields: [
      { key: 'title', label: '课程标题', required: true, placeholder: '例如：论说文开头写法整理' },
      { key: 'category', label: '分类', type: 'select', options: [...new Set([...cats, '自定义'])].map(c => ({ value: c, label: c })) },
      { key: 'summary', label: '简介', type: 'textarea', rows: 3 },
      { key: 'minutes', label: '预计分钟', type: 'number', value: 20, min: 1, max: 600 }
    ], confirmText: '创建课程' });
    if (!v) return;
    const nid = uid('course');
    store.mutate(s => s.courses.push({
      id: nid, title: v.title, category: v.category, summary: v.summary, minutes: Number(v.minutes) || 20,
      label: 'user', tags: ['自建'], points: [], difficulties: [], examples: [], keyTakeaways: [], completed: false, completedAt: null
    }));
    store.log('course', { id: nid }); toast('课程已创建', 'ok'); ctx.go('#/course/' + nid); return;
  }
  if (!course) return;

  if (name === 'complete') {
    const was = !!course.completed;
    store.mutate(s => { const c = s.courses.find(x => x.id === id); c.completed = !c.completed; c.completedAt = c.completed ? new Date().toISOString() : null; });
    store.log('course_complete', { id, title: course.title });
    toast(was ? '已取消完成' : '已标记完成，进度已更新', 'ok'); ctx.refresh(); return;
  }
  if (name === 'review') {
    if (store.hasReview('course', id)) { store.removeReview('course', id); toast('已移出复习计划'); }
    else { store.addReview('course', id, course.title); toast('已加入复习计划', 'ok'); }
    ctx.refresh(); return;
  }
  if (name === 'edit') {
    const cats = categories().filter(c => c !== '全部');
    const v = await formSheet({ title: '编辑课程信息', fields: [
      { key: 'title', label: '课程标题', value: course.title, required: true },
      { key: 'category', label: '分类', type: 'select', value: course.category, options: [...new Set([...cats, course.category])].map(c => ({ value: c, label: c })) },
      { key: 'summary', label: '简介', type: 'textarea', rows: 4, value: course.summary },
      { key: 'minutes', label: '预计分钟', type: 'number', value: course.minutes || 20, min: 1, max: 600 }
    ], confirmText: '保存修改' });
    if (!v) return;
    store.mutate(s => { const c = s.courses.find(x => x.id === id); Object.assign(c, { title: v.title, category: v.category, summary: v.summary, minutes: Number(v.minutes) || 20, editedByUser: true }); });
    toast('已保存', 'ok'); ctx.refresh(); return;
  }
  if (name === 'del') {
    if (!await confirmSheet({ title: '删除课程', desc: `确定删除「${esc(course.title)}」？该课程的笔记与复习项也会一并移除。`, confirmText: '删除', danger: true })) return;
    store.mutate(s => {
      s.courses = s.courses.filter(x => x.id !== id);
      s.reviewQueue = s.reviewQueue.filter(r => r.targetId !== id && !r.targetId.startsWith(id + ':'));
      delete s.notes['course:' + id];
    });
    toast('已删除'); ctx.go('#/courses'); return;
  }
  if (name === 'add-point') {
    const v = await formSheet({ title: '添加知识点', fields: [
      { key: 'title', label: '知识点标题', required: true },
      { key: 'content', label: '说明内容', type: 'textarea', rows: 7, required: true }
    ], confirmText: '添加' });
    if (!v) return;
    store.mutate(s => { const c = s.courses.find(x => x.id === id); c.points.push({ id: uid('p'), title: v.title, content: v.content }); c.editedByUser = true; });
    toast('已添加', 'ok'); ctx.refresh(); return;
  }
  if (name === 'add-hard') {
    const v = await formSheet({ title: '添加重点难点', fields: [
      { key: 'title', label: '标题', required: true },
      { key: 'content', label: '说明', type: 'textarea', rows: 6, required: true }
    ], confirmText: '添加' });
    if (!v) return;
    store.mutate(s => { const c = s.courses.find(x => x.id === id); c.difficulties.push({ title: v.title, content: v.content }); c.editedByUser = true; });
    toast('已添加', 'ok'); ctx.refresh(); return;
  }
  if (name === 'add-example') {
    const v = await formSheet({ title: '添加示例与解析', desc: '可粘贴你自己整理的例句、范文片段或讲义摘录（请自行确认使用权限）。', fields: [
      { key: 'title', label: '示例标题', required: true },
      { key: 'text', label: '示例正文', type: 'textarea', rows: 7, required: true },
      { key: 'analysis', label: '详细解析', type: 'textarea', rows: 6, required: true }
    ], confirmText: '添加' });
    if (!v) return;
    store.mutate(s => { const c = s.courses.find(x => x.id === id); c.examples.push({ title: v.title, text: v.text, analysis: v.analysis, label: 'user' }); c.editedByUser = true; });
    toast('已添加', 'ok'); ctx.refresh();
  }
}
