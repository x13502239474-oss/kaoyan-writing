/* 写作考试：试卷列表 / 限时倒计时（可暂停、刷新续考）/ 草稿自动保存 / 字数统计 /
   交卷回顾 / 参考思路对照 / 人工评分与自我评价 / 存入写作档案 */
'use strict';
import * as store from '../store.js';
import { esc, icon, uid, fmtClock, fmtMin, fmtDate, relTime, countWords, excerpt } from '../utils.js';
import { toast, confirmSheet, formSheet, labelChip, emptyState, sectionTitle, wireEditor, disclaimer } from '../ui.js';

const ui = { activeQ: null };
let editorCtl = null, timerHandle = null;

const RUBRIC = [
  { key: 'shen', label: '审题立意', hint: '是否准确回应材料、论点是否明确' },
  { key: 'jie', label: '结构层次', hint: '开头/主体/结尾是否完整、段落是否推进' },
  { key: 'lun', label: '论证分析', hint: '是否有「为什么」的展开、事例后是否分析' },
  { key: 'yu', label: '语言表达', hint: '是否准确、通顺、无套话' }
];

function elapsedSec(a) {
  const base = Math.max(0, (Date.now() - new Date(a.startedAt).getTime()) / 1000);
  let paused = Number(a.pausedTotalSec) || 0;
  if (a.pauseStartedAt) paused += Math.max(0, (Date.now() - new Date(a.pauseStartedAt).getTime()) / 1000);
  return Math.max(0, base - paused);
}
function remainingSec(a) { return Math.max(0, (Number(a.durationSec) || 0) - elapsedSec(a)); }
/** 已交卷答卷的用时应冻结在交卷时刻 */
function durationOf(a) {
  if (a.status === 'submitted' && typeof a.finalDurationSec === 'number') return a.finalDurationSec;
  return elapsedSec(a);
}
function inProgress(examId) {
  return store.get().examAttempts.filter(a => a.examId === examId && a.status === 'in_progress').slice(-1)[0] || null;
}
function findExam(id) { return store.get().exams.find(x => x.id === id); }
function findAttempt(id) { return store.get().examAttempts.find(x => x.id === id); }

function release() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  if (editorCtl) { editorCtl.flush(); editorCtl.destroy(); editorCtl = null; }
}
export function unmount() { release(); }

export function render(ctx) {
  const p = ctx.params || {};
  if (p.attemptId) return result(ctx, p.id, p.attemptId);
  if (p.id) return examPage(ctx, p.id);
  return list(ctx);
}

/* ---------------- 试卷列表 ---------------- */
function list(ctx) {
  const s = store.get();
  const submitted = s.examAttempts.filter(a => a.status === 'submitted');
  const ongoing = s.examAttempts.filter(a => a.status === 'in_progress');
  return {
    title: '写作考试', sub: `${s.exams.length} 套演示卷 · ${submitted.length} 次已交卷`,
    html: `
      <div class="page-head"><h1>写作考试</h1><p>限时完成完整文章。倒计时、草稿自动保存、刷新或关闭浏览器后可继续；交卷后可查看答卷、对照参考思路并做人工自评。</p></div>
      <div class="tabs"><button data-go="#/drills">专项训练</button><button class="active">写作考试</button></div>
      <div class="notice brand">${icon('info', 16)}<div>手机端可直接在编辑区输入；未满字数只会提示，不会阻止交卷。<b>本站不会自动评判作文</b>，交卷后的分数由你自己（或老师）人工填写。</div></div>
      ${ongoing.length ? `<div class="card card-pad mb-4" style="border-left:4px solid var(--warn)">
        ${sectionTitle('未完成的考试', `${ongoing.length} 场`)}
        ${ongoing.map(a => { const e = findExam(a.examId); return `<a class="list-item" style="padding:9px 0" href="#/exam/${esc(a.examId)}">
          <span class="li-ico amber">续</span><span class="li-main"><span class="li-title">${esc(e ? e.title : '考试')}</span>
          <span class="li-sub">开始于 ${fmtDate(a.startedAt, true)} · 草稿已自动保存</span></span><span class="li-r">${icon('right', 16)}</span></a>`; }).join('')}
      </div>` : ''}
      ${sectionTitle('可用试卷', '内置均为演示卷，非真题')}
      ${s.exams.length ? s.exams.map(e => {
        const recs = submitted.filter(a => a.examId === e.id).slice().reverse();
        const active = inProgress(e.id);
        return `<div class="card card-pad mb-3">
          <div class="chips mb-2">${labelChip(e.label)}<span class="chip chip-brand">${esc(e.type)}</span><span class="chip chip-outline">${e.durationMin} 分钟</span><span class="chip chip-outline">${e.questions.length} 题</span></div>
          <div class="t-md t-bold">${esc(e.title)}</div>
          <div class="t-sm t-muted mt-1">${esc(e.description || '')}</div>
          <div class="t-xs t-muted mt-2">${e.questions.map(q => `${q.type}（建议 ${q.minWords} 字以上）`).join(' · ')}</div>
          <div class="btn-row mt-3">
            <a class="btn ${active ? 'btn-soft' : 'btn-primary'} btn-sm" href="#/exam/${esc(e.id)}">${active ? '继续考试' : icon('play', 14) + ' 查看并开始'}</a>
            ${recs.length ? `<a class="btn btn-outline btn-sm" href="#/exam/${esc(e.id)}/result/${esc(recs[0].id)}">最近答卷</a>` : ''}
          </div>
        </div>`;
      }).join('') : emptyState('考', '还没有试卷', '可在「数据管理 → 导入内容包」中添加自己的真题或模拟卷。', `<a class="btn btn-primary btn-sm" href="#/settings">去导入</a>`)}
      ${submitted.length ? `<div class="section mt-5">${sectionTitle('历史答卷', `${submitted.length} 份`)}
        <div class="list">${submitted.slice(0, 8).map(a => { const e = findExam(a.examId); return `<a class="list-item" href="#/exam/${esc(a.examId)}/result/${esc(a.id)}">
          <span class="li-ico seal">卷</span><span class="li-main"><span class="li-title">${esc(e ? e.title : '考试答卷')}</span>
          <span class="li-sub">${fmtDate(a.submittedAt || a.endedAt, true)} · 用时 ${fmtMin(durationOf(a))}</span></span>
          <span class="li-r">${a.totalScore ? `<span class="chip chip-brand">${a.totalScore} 分</span>` : '未评分'}${icon('right', 16)}</span></a>`; }).join('')}</div></div>` : ''}
      ${disclaimer(true)}
    `
  };
}

/* ---------------- 试卷详情 / 开始 ---------------- */
function examPage(ctx, id) {
  const e = findExam(id);
  if (!e) return { title: '试卷不存在', html: emptyState('?', '未找到这套试卷', '', `<a class="btn btn-primary btn-sm" href="#/exams">返回</a>`) };
  const a = inProgress(id);
  if (a) return taking(ctx, e, a);
  const recs = store.get().examAttempts.filter(x => x.examId === id && x.status === 'submitted');
  return {
    title: '试卷详情', sub: `${e.durationMin} 分钟`,
    html: `
      <div class="breadcrumb"><a href="#/exams">写作考试</a> / 试卷详情</div>
      <div class="card card-pad mb-4">
        <div class="chips mb-2">${labelChip(e.label)}<span class="chip chip-brand">${esc(e.type)}</span><span class="chip chip-outline">${e.durationMin} 分钟</span></div>
        <h1 style="font-size:var(--fs-xl);font-weight:730;line-height:1.45">${esc(e.title)}</h1>
        <div class="t-sm t-muted mt-2">${esc(e.description || '')}</div>
        <div class="divider"></div>
        ${e.questions.map((q, i) => `<div class="mb-4">
          <div class="t-md t-bold mb-2">第 ${i + 1} 题 · ${esc(q.type)}</div>
          <div class="bodytext">${esc(q.prompt)}</div>
          <div class="exam-mat">${esc(q.material || '')}</div>
          <div class="t-xs t-muted mt-2">建议字数 ${q.minWords}${q.maxWords ? '–' + q.maxWords : '+'} 字（演示参数，以目标考试正式要求为准）</div>
        </div>`).join('')}
        <button class="btn btn-primary btn-block" data-start>${icon('play', 16)} 开始限时考试</button>
        <div class="t-xs t-muted t-center mt-2">开始后计时不可重置；草稿每 0.6 秒自动保存，可随时暂停。</div>
      </div>
      ${recs.length ? `<div class="section">${sectionTitle('本卷历史答卷', `${recs.length} 份`)}
        <div class="list">${recs.map(r => `<a class="list-item" href="#/exam/${esc(id)}/result/${esc(r.id)}">
          <span class="li-ico">卷</span><span class="li-main"><span class="li-title">${fmtDate(r.submittedAt || r.endedAt, true)} 的答卷</span>
          <span class="li-sub">用时 ${fmtMin(durationOf(r))} · ${r.totalScore ? '自评 ' + r.totalScore + ' 分' : '未评分'}</span></span>
          <span class="li-r">${icon('right', 16)}</span></a>`).join('')}</div></div>` : ''}
      <a class="btn btn-outline btn-block mt-3" href="#/exams">← 返回试卷列表</a>
    `
  };
}

/* ---------------- 考试中 ---------------- */
function taking(ctx, e, a) {
  const qs = e.questions;
  const activeId = (ui.activeQ && qs.some(q => q.id === ui.activeQ)) ? ui.activeQ : qs[0].id;
  ui.activeQ = activeId;
  const q = qs.find(x => x.id === activeId);
  const ans = a.answers[activeId] || '';
  const rem = Math.ceil(remainingSec(a));
  return {
    title: '考试中', sub: e.title, fab: false,
    actions: `<button class="icon-btn" data-app-action="abandon" aria-label="放弃考试">${icon('trash', 20)}</button>`,
    html: `
      <div class="timer-bar" id="timer-bar">
        <div><div class="tb-t">${a.pauseStartedAt ? '已暂停' : '剩余时间'}</div><div class="tb-v ${rem < 300 ? 'danger' : ''}" id="timer-value">${fmtClock(rem)}</div></div>
        <div class="tb-r">
          <button class="tb-btn" data-pause>${a.pauseStartedAt ? icon('play', 13) + ' 继续' : icon('pause', 13) + ' 暂停'}</button>
          <button class="tb-btn primary" data-submit-exam>交卷</button>
        </div>
      </div>
      <div class="notice warn">${icon('info', 16)}<div>本卷为<b>演示卷（非真题）</b>，时长与建议字数均为演示参数。交卷后仍可回来修改自评与答卷回顾。</div></div>
      ${qs.length > 1 ? `<div class="q-switch">${qs.map((x, i) => `<button class="${x.id === activeId ? 'active' : ''} ${(a.answers[x.id] || '').trim() ? 'filled' : ''}" data-q="${esc(x.id)}">第 ${i + 1} 题 · ${esc(x.type)}</button>`).join('')}</div>` : ''}
      <div class="exam-q">
        <div class="eq-h"><span class="chip chip-brand">第 ${qs.indexOf(q) + 1} 题</span><span class="chip">${esc(q.type)}</span>${labelChip(e.label)}</div>
        <div class="eq-prompt">${esc(q.prompt)}</div>
        <div class="exam-mat">${esc(q.material || '')}</div>
      </div>
      <div class="card card-pad">
        <div class="flex between mb-3"><b class="t-md">作答区</b><span class="t-xs t-muted">草稿自动保存到本机</span></div>
        <div class="editor-wrap" id="exam-editor">
          <textarea class="editor" id="exam-answer" style="min-height:340px" placeholder="在这里写完整文章。手机端可直接输入；切换题目或刷新页面都不会丢失。">${esc(ans)}</textarea>
          <div class="editor-bar">
            <span class="save-dot" data-save-dot></span><span data-save>草稿已保存</span>
            <span style="margin-left:auto" class="wc" data-wc>0 字</span>
            <span data-limit class="t-xs"></span>
          </div>
        </div>
        <div class="t-xs t-muted mt-2">建议 ${q.minWords}${q.maxWords ? '–' + q.maxWords : '+'} 字；本题当前 <b id="exam-q-wc">${countWords(ans).total}</b> 字。</div>
      </div>
      <div class="btn-row mt-4">
        <button class="btn btn-primary equal" data-submit-exam>${icon('check', 16)} 交卷并查看答卷</button>
        ${qs.length > 1 && qs.indexOf(q) < qs.length - 1 ? `<button class="btn btn-soft equal" data-next-q>下一题 ${icon('arrow', 15)}</button>` : ''}
      </div>
      <div class="t-xs t-muted t-center mt-3">${qs.map((x, i) => `第 ${i + 1} 题 ${countWords(a.answers[x.id] || '').total} 字`).join(' · ')}</div>
    `
  };
}

/* ---------------- 答卷结果 / 人工自评 ---------------- */
function result(ctx, examId, attemptId) {
  const e = findExam(examId), a = findAttempt(attemptId);
  if (!e || !a) return { title: '答卷不存在', html: emptyState('?', '未找到这份答卷', '', `<a class="btn btn-primary btn-sm" href="#/exams">返回考试列表</a>`) };
  const scores = a.scores || {};
  const totalWords = e.questions.reduce((n, q) => n + countWords(a.answers[q.id] || '').total, 0);
  const savedEssays = store.get().essays.filter(x => x.examAttemptId === a.id);
  return {
    title: '答卷回顾', sub: fmtDate(a.submittedAt || a.endedAt, true), fab: false,
    html: `
      <div class="breadcrumb"><a href="#/exams">写作考试</a> / <a href="#/exam/${esc(examId)}">${esc(e.title)}</a> / 答卷</div>
      <div class="card card-pad mb-4">
        <h1 style="font-size:var(--fs-lg);font-weight:730">${esc(e.title)} · 答卷</h1>
        <div class="grid grid-3 mt-3" style="gap:8px">
          <div class="stat-tile"><div class="v" style="font-size:19px">${fmtMin(durationOf(a))}</div><div class="stat-label">写作用时</div></div>
          <div class="stat-tile"><div class="v" style="font-size:19px">${totalWords}</div><div class="stat-label">总字数</div></div>
          <div class="stat-tile"><div class="v" style="font-size:19px">${a.totalScore || '—'}</div><div class="stat-label">人工自评分</div></div>
        </div>
        <div class="t-xs t-muted mt-3">交卷时间 ${fmtDate(a.submittedAt || a.endedAt, true)} · 状态：${a.status === 'submitted' ? '已交卷' : '进行中'}</div>
      </div>

      <div class="notice warn">${icon('alert', 16)}<div><b>本站不自动评判作文。</b>下方分数完全由你（或老师）人工填写，仅用于长期趋势记录，不代表任何考试机构的评分标准。参考内容均为 AI 生成的演示思路，非官方范文。</div></div>

      ${sectionTitle('答卷内容', '')}
      ${e.questions.map((q, i) => `<div class="card card-pad mb-3">
        <div class="flex between mb-2"><b class="t-md">第 ${i + 1} 题 · ${esc(q.type)}</b><span class="chip chip-outline">${countWords(a.answers[q.id] || '').total} 字</span></div>
        <div class="para-text" style="padding:0;font-size:16px;white-space:pre-wrap;word-break:break-word">${esc(a.answers[q.id] || '（未作答）')}</div>
        <div class="divider"></div>
        <div class="t-xs t-bold t-brand mb-2">参考思路对照（AI 生成 · 非官方范文 · 非标准答案）</div>
        <div class="bodytext">${esc(q.reference || '（暂无参考内容）')}</div>
      </div>`).join('')}

      <div class="card card-pad mb-4" id="rubric-card">
        ${sectionTitle('人工评分 / 自我评价', '满分 100，仅自评')}
        ${e.questions.length > 1 ? `<div class="t-sm t-muted mb-3">多题试卷：逐题打分后取平均作为本次自评分。</div>` : ''}
        ${e.questions.map((q, qi) => `<div class="mb-4" data-rubric-q="${esc(q.id)}">
          <div class="t-sm t-bold mb-1">第 ${qi + 1} 题 · ${esc(q.type)} <span class="t-xs t-brand" data-rubric-sum="${esc(q.id)}">${rubricSum(scores[q.id])}</span> / 100</div>
          ${RUBRIC.map(r => `<div class="rubric-row">
            <div class="r-name">${esc(r.label)}<span class="r-hint">${esc(r.hint)}</span></div>
            <input type="range" min="0" max="25" step="1" data-rubric="${esc(r.key)}" data-qid="${esc(q.id)}" value="${(scores[q.id] || {})[r.key] || 0}">
            <span class="r-val" data-out="${esc(r.key)}:${esc(q.id)}">${(scores[q.id] || {})[r.key] || 0}</span>
          </div>`).join('')}
        </div>`).join('')}
        <label class="field"><span class="field-label">自我评价 / 复盘</span>
          <textarea class="textarea" id="self-eval" rows="5" placeholder="本次最满意的地方、最明显的问题、下次要改的一件事…">${esc(a.selfEval || '')}</textarea></label>
        <label class="field"><span class="field-label">常见问题标签（逗号分隔）</span>
          <input class="input" id="self-problems" value="${esc((a.problems || []).join('，'))}" placeholder="例如：立意过大，举例后缺少分析，结尾仓促">
          <span class="field-hint">保存后会自动汇总到「复习与统计 → 个人薄弱环节」。</span></label>
        <button class="btn btn-primary btn-block" data-save-score>${icon('save', 16)} 保存人工评分与自评</button>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('存入个人写作档案', savedEssays.length ? `已存入 ${savedEssays.length} 篇` : '')}
        <div class="t-sm t-muted mb-3" style="line-height:1.8">把每道题的答卷单独存为一篇作文，之后可以继续修改、保存版本、做修改前后对比。</div>
        <button class="btn btn-soft btn-block" data-to-archive ${savedEssays.length ? 'disabled' : ''}>${icon('archive', 16)} ${savedEssays.length ? '本答卷已存入档案' : '存入写作档案'}</button>
        ${savedEssays.length ? `<div class="mt-3">${savedEssays.map(x => `<a class="list-item" style="padding:8px 0" href="#/essay/${esc(x.id)}"><span class="li-main"><span class="li-title" style="font-size:14px">${esc(x.title)}</span></span><span class="li-r">${icon('right', 15)}</span></a>`).join('')}</div>` : ''}
      </div>
      <a class="btn btn-outline btn-block" href="#/exam/${esc(examId)}">← 返回试卷</a>
    `
  };
}
function rubricSum(qs) { return RUBRIC.reduce((n, r) => n + (Number((qs || {})[r.key]) || 0), 0); }

/* ---------------- 交互 ---------------- */
export function mount(ctx, main) {
  const p = ctx.params || {};
  release();

  /* 试卷详情：开始考试 */
  const start = main.querySelector('[data-start]');
  if (start) start.addEventListener('click', () => {
    const e = findExam(p.id); if (!e) return;
    const a = {
      id: uid('att'), examId: e.id, startedAt: new Date().toISOString(),
      durationSec: e.durationMin * 60, pausedTotalSec: 0, pauseStartedAt: null,
      status: 'in_progress', answers: {}, scores: {}, totalScore: 0, selfEval: '', problems: []
    };
    store.mutate(s => { s.examAttempts.push(a); });
    ui.activeQ = e.questions[0].id;
    toast('考试开始，计时启动', 'ok'); ctx.refresh();
  });

  /* 考试中 */
  const tval = main.querySelector('#timer-value');
  if (tval) {
    const e = findExam(p.id), a = inProgress(p.id);
    const upd = () => {
      const cur = inProgress(p.id);
      if (!cur) { clearInterval(timerHandle); timerHandle = null; return; }
      const rem = Math.ceil(remainingSec(cur));
      tval.textContent = fmtClock(rem);
      tval.classList.toggle('danger', rem < 300);
      if (rem <= 0 && !cur.pauseStartedAt) { clearInterval(timerHandle); timerHandle = null; finishExam(ctx, e, cur, true); }
    };
    upd(); timerHandle = setInterval(upd, 1000);

    const wrap = main.querySelector('#exam-editor');
    if (wrap && a) editorCtl = wireEditor(wrap, {
      delay: store.get().settings.autosaveMs || 600,
      minWords: (e.questions.find(q => q.id === ui.activeQ) || {}).minWords || 0,
      onChange: (v) => {
        const cur = inProgress(e.id); if (!cur) return;
        cur.answers[ui.activeQ] = v; store.save();
        const small = main.querySelector('#exam-q-wc'); if (small) small.textContent = String(countWords(v).total);
      }
    });
  }

  /* 结果页：评分滑块实时显示 */
  main.addEventListener('input', (e) => {
    const r = e.target.closest('[data-rubric]');
    if (!r) return;
    const out = main.querySelector(`[data-out="${r.dataset.rubric}:${r.dataset.qid}"]`);
    if (out) out.textContent = r.value;
    const sumEl = main.querySelector(`[data-rubric-sum="${r.dataset.qid}"]`);
    if (sumEl) {
      let sum = 0; main.querySelectorAll(`[data-rubric][data-qid="${r.dataset.qid}"]`).forEach(x => { sum += Number(x.value); });
      sumEl.textContent = String(sum);
    }
  });

  main.addEventListener('click', async (e) => {
    const t = e.target;
    const qsw = t.closest('[data-q]');
    if (qsw) { if (editorCtl) editorCtl.flush(); ui.activeQ = qsw.dataset.q; ctx.refresh(); return; }
    const nq = t.closest('[data-next-q]');
    if (nq) {
      if (editorCtl) editorCtl.flush();
      const ex = findExam(p.id); const i = ex.questions.findIndex(q => q.id === ui.activeQ);
      if (i < ex.questions.length - 1) { ui.activeQ = ex.questions[i + 1].id; ctx.refresh(); }
      return;
    }
    const pause = t.closest('[data-pause]');
    if (pause) {
      const a = inProgress(p.id); if (!a) return;
      store.mutate(s => {
        const cur = s.examAttempts.find(x => x.id === a.id);
        if (cur.pauseStartedAt) { cur.pausedTotalSec += (Date.now() - new Date(cur.pauseStartedAt).getTime()) / 1000; cur.pauseStartedAt = null; }
        else cur.pauseStartedAt = new Date().toISOString();
      });
      ctx.refresh(); return;
    }
    const sub = t.closest('[data-submit-exam]');
    if (sub) {
      if (editorCtl) editorCtl.flush();
      const ex = findExam(p.id), a = inProgress(p.id); if (!a) return;
      const unanswered = ex.questions.filter(q => !(a.answers[q.id] || '').trim());
      if (unanswered.length && !await confirmSheet({ title: '确认交卷', desc: `还有 ${unanswered.length} 题未作答，交卷后不能继续编辑本次答卷。确定交卷吗？`, confirmText: '确认交卷' })) return;
      await finishExam(ctx, ex, a, false); return;
    }
    const saveScore = t.closest('[data-save-score]');
    if (saveScore) {
      const a = findAttempt(p.attemptId); if (!a) return;
      const sc = {};
      main.querySelectorAll('[data-rubric-q]').forEach(box => {
        const qid = box.dataset.rubricQ; sc[qid] = {};
        box.querySelectorAll('[data-rubric]').forEach(r => { sc[qid][r.dataset.rubric] = Number(r.value); });
      });
      const sums = Object.values(sc).map(rubricSum);
      const total = sums.length ? Math.round(sums.reduce((x, y) => x + y, 0) / sums.length) : 0;
      const ev = main.querySelector('#self-eval'), pr = main.querySelector('#self-problems');
      store.mutate(s => {
        const cur = s.examAttempts.find(x => x.id === a.id);
        cur.scores = sc; cur.totalScore = total;
        cur.selfEval = ev ? ev.value : '';
        cur.problems = pr ? pr.value.split(/[,，、]/).map(x => x.trim()).filter(Boolean) : [];
      });
      toast(`已保存，本次自评 ${total} 分`, 'ok'); ctx.refresh(); return;
    }
    const toArch = t.closest('[data-to-archive]');
    if (toArch) {
      const ex = findExam(p.id), a = findAttempt(p.attemptId); if (!a) return;
      const sc = a.scores || {};
      const made = [];
      store.mutate(s => {
        ex.questions.forEach((q, i) => {
          if (s.essays.some(x => x.examAttemptId === a.id && x.questionId === q.id)) return;
          const content = a.answers[q.id] || '';
          const id = uid('essay');
          s.essays.unshift({
            id, title: `${ex.title} · 第 ${i + 1} 题（${q.type}）`, type: q.type, content,
            createdAt: a.submittedAt || a.endedAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
            durationSec: Math.round(durationOf(a)), selfScore: rubricSum(sc[q.id]) || 0,
            selfEval: a.selfEval || '', problems: a.problems || [], versions: [],
            source: 'exam', examAttemptId: a.id, questionId: q.id, label: 'user'
          });
          made.push(id);
        });
      });
      store.log('essay', { count: made.length });
      toast(made.length ? `已存入 ${made.length} 篇作文` : '此前已存入档案', 'ok'); ctx.refresh();
    }
  });
}

export async function action(name, el, ctx) {
  if (name !== 'abandon') return;
  const id = ctx.params && ctx.params.id;
  const a = id ? inProgress(id) : null;
  if (!a) { toast('当前没有进行中的考试'); return; }
  if (!await confirmSheet({ title: '放弃本次考试', desc: '本次计时与已写草稿将被删除，且无法恢复。确定放弃？', confirmText: '放弃考试', danger: true })) return;
  store.mutate(s => { s.examAttempts = s.examAttempts.filter(x => x.id !== a.id); });
  release();
  toast('已放弃本次考试'); ctx.go('#/exams');
}

async function finishExam(ctx, e, a, auto) {
  store.mutate(s => {
    const cur = s.examAttempts.find(x => x.id === a.id);
    if (!cur || cur.status === 'submitted') return;
    if (cur.pauseStartedAt) { cur.pausedTotalSec += (Date.now() - new Date(cur.pauseStartedAt).getTime()) / 1000; cur.pauseStartedAt = null; }
    cur.status = 'submitted'; cur.submittedAt = new Date().toISOString(); cur.endedAt = cur.submittedAt;
    cur.finalDurationSec = Math.round(elapsedSec(cur));
  });
  store.log('exam', { title: e.title, durationSec: Math.round(durationOf(a)) });
  if (editorCtl) { editorCtl.flush(); editorCtl.destroy(); editorCtl = null; }
  toast(auto ? '时间到，已自动交卷' : '交卷成功，可查看答卷与人工自评', auto ? 'err' : 'ok');
  ctx.go(`#/exam/${e.id}/result/${a.id}`);
}
