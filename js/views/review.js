/* 复习与学习统计：待复习 / 复习记录 / 已掌握 / 写作次数 / 历史成绩 / 薄弱环节 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, today, fmtDate, fmtMin, addDays, excerpt } from '../utils.js';
import { toast, confirmSheet, formSheet, emptyState, sectionTitle } from '../ui.js';

const ui = { tab: 'due' };

function dueList() { return store.dueReviews().sort((a, b) => a.dueDate.localeCompare(b.dueDate)); }
function futureList() { return store.get().reviewQueue.filter(r => !r.mastered && r.dueDate > today()).sort((a, b) => a.dueDate.localeCompare(b.dueDate)); }
function masteredList() { return store.get().reviewQueue.filter(r => r.mastered); }

function scoreSeries() {
  const s = store.get();
  const rows = [
    ...s.essays.filter(e => e.selfScore > 0).map(e => ({ at: e.updatedAt || e.createdAt, score: e.selfScore, title: e.title })),
    ...s.examAttempts.filter(a => a.status === 'submitted' && a.totalScore > 0).map(a => ({ at: a.submittedAt || a.endedAt, score: a.totalScore, title: '模拟考试' }))
  ].filter(x => x.at).sort((a, b) => new Date(a.at) - new Date(b.at)).slice(-10);
  return rows;
}

export function render(ctx) {
  const s = store.get(), st = store.stats();
  const due = dueList(), future = futureList(), mastered = masteredList();
  const reviews = s.activity.filter(a => a.type === 'review' && a.meta && a.meta.result).slice(0, 12);
  const series = scoreSeries();
  const totalWords = s.essays.reduce((n, e) => n + (e.content || '').replace(/\s/g, '').length, 0);
  const problemAuto = Object.entries(st.problemCount).sort((a, b) => b[1] - a[1]);

  return {
    title: '复习与统计', sub: `${due.length} 项待复习`,
    html: `
      <div class="page-head"><h1>复习与统计</h1><p>按间隔复习（1 / 2 / 4 / 7 / 15 / 30 天）安排知识点，成绩与问题标签全部来自你的人工自评。</p></div>
      <div class="grid grid-2 grid-md-2 mb-4">
        <div class="card card-pad">
          ${sectionTitle('学习进度', '')}
          <div class="flex between t-sm mb-2"><span>课程完成</span><b>${st.doneCourses}/${st.courseTotal}</b></div>
          <div class="progress mb-3"><i style="width:${st.coursePct}%"></i></div>
          <div class="kv"><span class="k">已掌握知识点</span><span class="v">${st.mastered}</span></div>
          <div class="kv"><span class="k">待复习</span><span class="v">${st.due}</span></div>
          <div class="kv"><span class="k">写作练习次数</span><span class="v">${st.writingSessions}</span></div>
          <div class="kv"><span class="k">累计写作字数</span><span class="v">${totalWords}</span></div>
        </div>
        <div class="card card-pad">
          ${sectionTitle('写作成绩（人工自评）', `${st.scoreCount} 次记录`)}
          <div class="flex between t-sm mb-2"><span>平均分</span><b class="t-brand" style="font-size:20px">${st.avgScore || '—'}</b></div>
          ${series.length ? `<div class="spark">${series.map(r => `<div class="col" title="${esc(r.title)} · ${r.score} 分 · ${fmtDate(r.at)}"><i style="height:${Math.max(4, r.score)}%"></i><small>${r.score}</small></div>`).join('')}</div>
            <div class="t-xs t-muted t-center mt-2">最近 ${series.length} 次自评（满分 100，仅供参考，不代表真实考试分数）</div>`
            : `<div class="t-sm t-muted" style="padding:18px 0;line-height:1.8">还没有自评成绩。在「专项训练」提交后自评，或在「写作档案」「考试答卷」里填写人工自评，这里就会生成趋势。</div>`}
        </div>
      </div>

      <div class="tabs" data-review-tabs>
        <button class="${ui.tab === 'due' ? 'active' : ''}" data-tab="due">待复习 ${due.length ? `(${due.length})` : ''}</button>
        <button class="${ui.tab === 'plan' ? 'active' : ''}" data-tab="plan">复习计划</button>
        <button class="${ui.tab === 'log' ? 'active' : ''}" data-tab="log">复习记录</button>
        <button class="${ui.tab === 'weak' ? 'active' : ''}" data-tab="weak">薄弱环节</button>
      </div>

      <div data-pane="due" class="${ui.tab === 'due' ? '' : 'hidden'}">
        ${due.length ? due.map(r => `<div class="card card-pad review-card ${r.dueDate < today() ? 'overdue' : 'due'} mb-3">
          <div class="flex between gap-2"><b class="t-md flex-1">${esc(r.label)}</b>
            <span class="chip ${r.dueDate < today() ? 'chip-danger' : 'chip-warn'}">${r.dueDate < today() ? '已逾期 ' + esc(r.dueDate.slice(5)) : '今日到期'}</span></div>
          <div class="t-xs t-muted mt-2">${r.targetType === 'point' ? '知识点' : r.targetType === 'course' ? '课程' : '自定义'} · 第 ${r.stage + 1} 轮 · 间隔 ${store.REVIEW_INTERVALS[Math.min(r.stage, store.REVIEW_INTERVALS.length - 1)]} 天 · 计划 ${fmtDate(r.dueDate)}</div>
          <div class="btn-row mt-3">
            <button class="btn btn-xs btn-danger" data-rev="${esc(r.id)}" data-result="forgot">忘了</button>
            <button class="btn btn-xs btn-outline" data-rev="${esc(r.id)}" data-result="fuzzy">模糊</button>
            <button class="btn btn-xs btn-soft" data-rev="${esc(r.id)}" data-result="good">记得</button>
            <button class="btn btn-xs btn-ghost t-danger" data-rev-del="${esc(r.id)}" style="margin-left:auto">移除</button>
          </div>
        </div>`).join('') : emptyState('复', '今天没有到期复习', '可在课程详情里把整讲或单个知识点「加入复习计划」，也可以手动添加一条。')}
        <button class="btn btn-outline btn-block btn-sm mt-2" data-add-review>${icon('plus', 15)} 手动添加复习项</button>
        <div class="card card-pad mt-4">${sectionTitle('已掌握知识点', `${mastered.length} 项`)}
          ${mastered.length ? mastered.map(r => `<div class="kv"><span class="k">✓ ${esc(r.label)}</span><span class="v t-success">已掌握</span></div>`).join('') : `<div class="t-sm t-muted">连续完成 ${store.REVIEW_INTERVALS.length} 轮「记得」后，条目会自动标记为已掌握。</div>`}
        </div>
      </div>

      <div data-pane="plan" class="${ui.tab === 'plan' ? '' : 'hidden'}">
        ${sectionTitle('后续复习计划', `${future.length} 项`)}
        ${future.length ? `<div class="list">${future.map(r => `<div class="list-item"><span class="li-ico">复</span>
          <span class="li-main"><span class="li-title">${esc(r.label)}</span><span class="li-sub">${fmtDate(r.dueDate)} · 第 ${r.stage + 1} 轮</span></span>
          <button class="btn btn-xs btn-ghost t-danger" data-rev-del="${esc(r.id)}">移除</button></div>`).join('')}</div>`
          : `<div class="t-sm t-muted" style="padding:14px 0">暂无后续计划。完成一次复习后会自动安排下一次间隔。</div>`}
        <button class="btn btn-outline btn-block btn-sm mt-3" data-add-review>${icon('plus', 15)} 手动添加复习项</button>
      </div>

      <div data-pane="log" class="${ui.tab === 'log' ? '' : 'hidden'}">
        ${sectionTitle('最近复习记录', `${reviews.length} 条`)}
        ${reviews.length ? `<div class="list">${reviews.map(a => `<div class="list-item"><span class="li-ico ${a.meta.result === 'good' ? 'green' : a.meta.result === 'forgot' ? 'seal' : 'amber'}">复</span>
          <span class="li-main"><span class="li-title">${a.meta.result === 'good' ? '记得' : a.meta.result === 'fuzzy' ? '模糊' : '忘了'}</span>
          <span class="li-sub">${fmtDate(a.at, true)}</span></span></div>`).join('')}</div>`
          : `<div class="t-sm t-muted" style="padding:14px 0">还没有复习记录。完成一次「待复习」自测后就会出现在这里。</div>`}
      </div>

      <div data-pane="weak" class="${ui.tab === 'weak' ? '' : 'hidden'}">
        ${sectionTitle('自动汇总：自评中反复出现的问题', `${problemAuto.length} 类`)}
        ${problemAuto.length ? problemAuto.map(([name, n]) => `<div class="bar-row"><span class="b-l" title="${esc(name)}">${esc(name)}</span>
          <span class="b-track"><span class="b-fill" style="display:block;width:${Math.min(100, n / Math.max(1, problemAuto[0][1]) * 100)}%"></span></span>
          <span class="b-v">${n} 次</span></div>`).join('') : `<div class="t-sm t-muted mb-3">给作文或答卷填写「常见问题标签」后，这里会自动汇总频次。</div>`}
        <div class="divider"></div>
        ${sectionTitle('我标记的薄弱环节', `${s.weakAreas.length} 项`, `<button class="btn btn-xs btn-soft" data-add-weak">+ 添加</button>`)}
        ${s.weakAreas.length ? s.weakAreas.map(w => `<div class="card card-pad mb-3">
          <div class="flex between"><b class="t-md">${esc(w.name)}</b><span class="flex gap-2">
            <button class="btn btn-xs btn-outline" data-weak-edit="${esc(w.id)}">编辑</button>
            <button class="btn btn-xs btn-ghost t-danger" data-weak-del="${esc(w.id)}">删除</button></span></div>
          ${w.note ? `<div class="bodytext mt-2">${esc(w.note)}</div>` : ''}
          <div class="t-xs t-muted mt-2">记录于 ${fmtDate(w.createdAt)}</div>
        </div>`).join('') : `<div class="t-sm t-muted">还没有标记。把复盘中最常犯的问题写下来，写作前扫一眼。</div>`}
      </div>

      <div class="notice brand mt-4">${icon('info', 16)}<div>所有统计都基于你自己的操作记录与<b>人工自评</b>；本站不对作文做自动评分，也不推断真实考试分数。</div></div>
    `
  };
}

export function mount(ctx, main) {
  main.addEventListener('click', async (e) => {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) {
      ui.tab = tab.dataset.tab;
      main.querySelectorAll('[data-review-tabs] button').forEach(b => b.classList.toggle('active', b === tab));
      main.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== ui.tab));
      return;
    }
    const rev = t.closest('[data-rev]');
    if (rev) {
      store.doReview(rev.dataset.rev, rev.dataset.result);
      toast(rev.dataset.result === 'good' ? '已记录「记得」，下次间隔已延长' : rev.dataset.result === 'fuzzy' ? '已记录「模糊」，明天再复习' : '已记录「忘了」，明天再复习', 'ok');
      ctx.refresh(); return;
    }
    const rd = t.closest('[data-rev-del]');
    if (rd) {
      if (!await confirmSheet({ title: '移出复习计划', desc: '确定移除这条复习项？历史记录会保留。', confirmText: '移除', danger: true })) return;
      store.mutate(s => { s.reviewQueue = s.reviewQueue.filter(r => r.id !== rd.dataset.revDel); });
      ctx.refresh(); return;
    }
    const ar = t.closest('[data-add-review]');
    if (ar) {
      const v = await formSheet({ title: '添加复习项', desc: '可以是一个知识点、一种漏洞类型，或任何你想定期回顾的内容。', fields: [
        { key: 'label', label: '复习内容', required: true, placeholder: '例如：条件关系误用（必要 / 充分）' },
        { key: 'days', label: '几天后复习', type: 'number', value: 0, min: 0, max: 365, hint: '0 = 今天立即加入待复习' }
      ], confirmText: '添加' });
      if (!v) return;
      store.mutate(s => s.reviewQueue.push({
        id: uid('rev'), targetType: 'custom', targetId: uid('c'), label: v.label,
        dueDate: addDays(today(), Number(v.days) || 0), stage: 0, mastered: false,
        createdAt: new Date().toISOString(), history: []
      }));
      ui.tab = 'due'; toast('已加入复习计划', 'ok'); ctx.refresh(); return;
    }
    const aw = t.closest('[data-add-weak]'), we = t.closest('[data-weak-edit]');
    if (aw || we) {
      const w = we ? store.get().weakAreas.find(x => x.id === we.dataset.weakEdit) : null;
      const v = await formSheet({ title: w ? '编辑薄弱环节' : '添加薄弱环节', fields: [
        { key: 'name', label: '问题名称', value: w ? w.name : '', required: true, placeholder: '例如：举例后缺少分析' },
        { key: 'note', label: '改进方法 / 提醒', type: 'textarea', rows: 4, value: w ? (w.note || '') : '' }
      ], confirmText: '保存' });
      if (!v) return;
      store.mutate(s => {
        if (w) { const x = s.weakAreas.find(y => y.id === w.id); x.name = v.name; x.note = v.note; }
        else s.weakAreas.unshift({ id: uid('w'), name: v.name, note: v.note, count: 1, createdAt: new Date().toISOString() });
      });
      toast('已保存', 'ok'); ctx.refresh(); return;
    }
    const wd = t.closest('[data-weak-del]');
    if (wd) {
      if (!await confirmSheet({ title: '删除薄弱环节', desc: '确定删除这条记录？', confirmText: '删除', danger: true })) return;
      store.mutate(s => { s.weakAreas = s.weakAreas.filter(x => x.id !== wd.dataset.weakDel); });
      ctx.refresh();
    }
  });
}
