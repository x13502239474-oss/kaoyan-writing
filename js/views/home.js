/* 学习首页 */
'use strict';
import * as store from '../store.js';
import { esc, icon, relTime, fmtDate, today, uid } from '../utils.js';
import { toast, formSheet, confirmSheet, labelChip, disclaimer, emptyState, sectionTitle } from '../ui.js';
import { DRILL_TYPES } from '../seed.js';

function streakDays() {
  const dates = new Set(store.get().activity.map(a => (a.at || '').slice(0, 10)).filter(Boolean));
  let n = 0;
  let d = new Date();
  if (!dates.has(today(d))) d.setDate(d.getDate() - 1);
  while (dates.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function render(ctx) {
  const s = store.get(), st = store.stats();
  const tasks = store.todayTasks();
  const doneN = tasks.filter(t => t.done).length;
  const hour = new Date().getHours();
  const greet = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
  const due = store.dueReviews();
  const doneCourses = s.courses.filter(c => c.completed);
  const doneTypes = new Set(s.drillRecords.map(r => r.type));
  const pendingTypes = DRILL_TYPES.filter(t => !doneTypes.has(t));

  const recent = [
    ...s.essays.map(e => ({ kind: '作文', title: e.title, at: e.updatedAt || e.createdAt, route: `#/essay/${e.id}`, sub: `${e.content ? e.content.replace(/\s/g, '').length : 0} 字` })),
    ...s.examAttempts.filter(a => a.status === 'submitted').map(a => ({ kind: '考试', title: (s.exams.find(x => x.id === a.examId) || {}).title || '模拟考试', at: a.submittedAt || a.endedAt, route: `#/exam/${a.examId}/result/${a.id}`, sub: a.totalScore ? `自评 ${a.totalScore} 分` : '已交卷' })),
    ...s.drillRecords.map(r => ({ kind: '训练', title: r.title || r.type, at: r.at, route: '#/drills', sub: r.type }))
  ].filter(x => x.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 5);

  const daysLeft = s.profile.examDate ? Math.ceil((new Date(s.profile.examDate) - new Date()) / 86400000) : null;

  return {
    title: '学习首页', sub: `${fmtDate(new Date().toISOString())} · ${greet}`,
    fab: false,
    html: `
    <div class="hero">
      <div class="hero-greet">${greet}${s.profile.nickname ? '，' + esc(s.profile.nickname) : ''} · 今天也写一点</div>
      <div class="hero-title">考研写作 · 自学工作台</div>
      <div class="hero-desc">${daysLeft != null ? (daysLeft >= 0 ? `距离你设定的考试日期还有 <b>${daysLeft}</b> 天。` : '设定的考试日期已过，可在「数据管理」中更新。') : '学 → 练 → 写 → 改 → 复盘，每天写一点。'}</div>
      <div class="hero-metrics">
        <div><div class="v">${doneN}/${tasks.length}</div><div class="k">今日任务</div></div>
        <div><div class="v">${streakDays()}</div><div class="k">连续学习天数</div></div>
        <div><div class="v">${st.writingSessions}</div><div class="k">写作练习次数</div></div>
      </div>
      <div class="hero-progress">
        <div class="lab"><span>课程总进度</span><span>${st.doneCourses} / ${st.courseTotal} 讲 · ${st.coursePct}%</span></div>
        <div class="progress"><i style="width:${st.coursePct}%"></i></div>
      </div>
    </div>

    <div class="section mt-5">
      ${sectionTitle('快速进入', '', '')}
      <div class="quick-grid">
        <a class="quick" href="#/courses"><span class="q-ico">课</span><span class="q-t">课程学习</span><span class="q-d">${st.courseTotal} 讲 · 已完成 ${st.doneCourses}</span></a>
        <a class="quick" href="#/drills"><span class="q-ico seal">练</span><span class="q-t">专项训练</span><span class="q-d">7 类练习 · ${s.drillRecords.length} 次记录</span></a>
        <a class="quick" href="#/exams"><span class="q-ico green">考</span><span class="q-t">模拟考试</span><span class="q-d">限时 · 自动保存 · 人工自评</span></a>
        <a class="quick" href="#/write/new"><span class="q-ico amber">写</span><span class="q-t">自由写作</span><span class="q-d">随时开写 · 本地留存</span></a>
      </div>
    </div>

    <div class="section">
      <div class="section-head"><h2>今日学习任务</h2><span class="cap">${doneN}/${tasks.length} 已完成</span><button class="more btn btn-xs btn-soft" data-task-add>+ 自定义</button></div>
      <div class="card" style="overflow:hidden">
        ${tasks.length ? tasks.map(t => `
          <div class="task-item">
            <button class="task-check ${t.done ? 'done' : ''}" data-task="${esc(t.id)}" aria-label="切换完成">${t.done ? icon('check', 13) : ''}</button>
            <div class="task-b">
              <div class="task-t" style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</div>
              <div class="task-d">${esc(t.desc)}</div>
            </div>
            ${t.route ? `<a class="btn btn-xs btn-soft" href="${t.route}">前往</a>` : ''}
            ${t.type === 'custom' ? `<button class="btn btn-xs btn-ghost t-danger" data-task-del="${esc(t.id.split(':')[1])}">删</button>` : ''}
          </div>`).join('') : `<div class="t-sm t-muted t-center" style="padding:20px">今天没有待办，去写一篇吧。</div>`}
      </div>
    </div>

    <div class="section grid grid-2 grid-md-2">
      <div class="card card-pad">
        ${sectionTitle('当前学习进度', '')}
        <div class="grid grid-2" style="gap:10px">
          <div class="stat-tile"><div class="v" style="color:var(--brand)">${st.doneCourses}</div><div class="stat-label">已完成课程</div></div>
          <div class="stat-tile"><div class="v" style="color:var(--success)">${st.mastered}</div><div class="stat-label">已掌握知识点</div></div>
          <div class="stat-tile"><div class="v" style="color:var(--seal)">${st.due}</div><div class="stat-label">待复习</div></div>
          <div class="stat-tile"><div class="v" style="color:var(--warn)">${st.avgScore || '—'}</div><div class="stat-label">平均自评分</div></div>
        </div>
        <a class="btn btn-outline btn-block btn-sm mt-3" href="#/review">查看复习与统计 ${icon('arrow', 15)}</a>
      </div>

      <div class="card card-pad">
        ${sectionTitle('待复习知识点', `${due.length} 项`, `<a href="#/review">全部</a>`)}
        ${due.length ? due.slice(0, 4).map(r => `
          <a class="list-item" style="padding:9px 0;border-color:var(--border)" href="#/review">
            <span class="li-ico amber" style="width:30px;height:30px;flex:0 0 30px;font-size:14px">复</span>
            <span class="li-main"><span class="li-title" style="font-size:14px">${esc(r.label)}</span>
            <span class="li-sub">${r.dueDate < today() ? '已逾期 · ' : '今日到期 · '}第 ${r.stage + 1} 轮</span></span>
            <span class="li-r">${icon('right', 16)}</span>
          </a>`).join('') : `<div class="t-sm t-muted" style="padding:14px 0">暂无到期复习。可在课程详情里把知识点「加入复习计划」。</div>`}
      </div>
    </div>

    <div class="section grid grid-2 grid-md-2">
      <div class="card card-pad">
        ${sectionTitle('已完成课程', `${doneCourses.length} 讲`, `<a href="#/courses">全部</a>`)}
        ${doneCourses.length ? doneCourses.slice(0, 4).map(c => `
          <a class="list-item" style="padding:9px 0" href="#/course/${esc(c.id)}">
            <span class="li-ico green" style="width:30px;height:30px;flex:0 0 30px;font-size:14px">✓</span>
            <span class="li-main"><span class="li-title" style="font-size:14px">${esc(c.title)}</span><span class="li-sub">${esc(c.category)} · ${fmtDate(c.completedAt)}</span></span>
          </a>`).join('') : `<div class="t-sm t-muted" style="padding:14px 0">还没有标记完成的课程。进入课程页，学完一讲后点「标记完成」。</div>`}
      </div>
      <div class="card card-pad">
        ${sectionTitle('待完成练习', `${pendingTypes.length} 类`, `<a href="#/drills">去训练</a>`)}
        ${pendingTypes.length ? `<div class="chips">${pendingTypes.map(t => `<a class="chip chip-brand" href="#/drills">${esc(t)}</a>`).join('')}</div>
          <div class="t-sm t-muted mt-3" style="line-height:1.7">建议优先做「审题训练」和「找出逻辑漏洞」，再进入段落与全篇写作。</div>`
          : `<div class="t-sm t-muted" style="padding:14px 0">七类专项训练都已至少练过一次，可以开始限时模拟考试了。</div>`}
      </div>
    </div>

    <div class="section">
      ${sectionTitle('最近写作记录', '', `<a href="#/archive">档案</a>`)}
      <div class="list">
        ${recent.length ? recent.map(r => `
          <a class="list-item" href="${r.route}">
            <span class="li-ico ${r.kind === '考试' ? 'seal' : r.kind === '训练' ? 'amber' : ''}">${r.kind === '作文' ? '文' : r.kind === '考试' ? '考' : '练'}</span>
            <span class="li-main"><span class="li-title">${esc(r.title)}</span><span class="li-sub">${esc(r.kind)} · ${esc(r.sub)} · ${relTime(r.at)}</span></span>
            <span class="li-r">${icon('right', 16)}</span>
          </a>`).join('') : emptyState('✎', '还没有写作记录', '从「自由写作」或「专项训练」开始，内容会自动保存到本机。', `<a class="btn btn-primary btn-sm" href="#/write/new">开始写作</a>`)}
      </div>
    </div>

    ${!s.settings.lastBackupAt ? `<div class="notice warn">${icon('alert', 16)}<div>你还没有导出过备份。所有数据只存在当前浏览器里，建议现在到 <a href="#/settings" style="text-decoration:underline">数据管理</a> 导出一份 JSON 备份。</div></div>` : ''}
    ${disclaimer(true)}
    `
  };
}

export function mount(ctx, main) {
  main.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-task]');
    if (t) { store.toggleTask(t.dataset.task); ctx.refresh(); return; }
    const add = e.target.closest('[data-task-add]');
    if (add) {
      const v = await formSheet({ title: '添加今日任务', fields: [{ key: 'text', label: '任务内容', type: 'text', required: true, placeholder: '例如：重写昨天的开头段' }], confirmText: '添加' });
      if (v && v.text) { store.addCustomTask(v.text); toast('已添加', 'ok'); ctx.refresh(); }
      return;
    }
    const del = e.target.closest('[data-task-del]');
    if (del) {
      if (await confirmSheet({ title: '删除自定义任务', desc: '确定删除这条任务？', confirmText: '删除', danger: true })) { store.removeCustomTask(del.dataset.taskDel); ctx.refresh(); }
    }
  });
}
