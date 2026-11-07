/* 本地持久化数据层：全量 JSON 存 localStorage，支持导出 / 恢复 / 内容包导入 */
'use strict';
import { buildSeed } from './seed.js';
import { uid, today, addDays, download, clamp } from './utils.js';

const KEY = 'ky_writing_v1';
export const APP_ID = 'kaoyan-writing';
export const SCHEMA = 1;
export const REVIEW_INTERVALS = [1, 2, 4, 7, 15, 30]; // 天

let state = null;
let lastError = '';
const listeners = new Set();

export const get = () => state;
export const lastSaveError = () => lastError;

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastError = '';
    return true;
  } catch (e) {
    lastError = e && e.name === 'QuotaExceededError'
      ? '本地存储空间已满，请先导出备份并清理部分历史内容'
      : '保存失败：' + (e && e.message ? e.message : '未知错误');
    console.error('[store] save failed', e);
    return false;
  }
}

/** 结构性变更：mutate(fn) 后保存并通知界面刷新 */
export function mutate(fn) {
  fn(state);
  state.updatedAt = new Date().toISOString();
  const ok = save();
  listeners.forEach(f => { try { f(state); } catch (e) { console.error(e); } });
  return ok;
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** 轻量日志（不触发界面刷新） */
export function log(type, meta = {}) {
  if (!state) return;
  state.activity.unshift({ id: uid('act'), type, at: new Date().toISOString(), meta });
  if (state.activity.length > 800) state.activity.length = 800;
  save();
}

function blank() {
  return {
    app: APP_ID, version: SCHEMA, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    profile: { nickname: '', examType: '管理类联考（199 管综）', examDate: '', dailyGoalMin: 30 },
    courses: [], materials: [], modelEssays: [], drills: [], exams: [],
    notes: {}, phrases: [], drillRecords: [], drillDrafts: {}, essays: [], examAttempts: [],
    reviewQueue: [], weakAreas: [], activity: [], taskState: {}, newEssayDraft: {},
    settings: { autosaveMs: 600, showDisclaimer: true, lastBackupAt: '' }
  };
}

/** 新建作文草稿（未正式存入档案前也持久保存） */
export function newDraft() {
  if (!state.newEssayDraft || !state.newEssayDraft.startedAt) {
    state.newEssayDraft = { title: '', type: '论说文', content: '', startedAt: new Date().toISOString() };
    save();
  }
  return state.newEssayDraft;
}
export function clearNewDraft() { state.newEssayDraft = {}; save(); }

/** 补齐缺失字段，容错处理损坏数据 */
function normalize(raw) {
  const base = blank();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const out = { ...base };
  const arrays = ['courses', 'materials', 'modelEssays', 'drills', 'exams', 'phrases',
    'drillRecords', 'essays', 'examAttempts', 'reviewQueue', 'weakAreas', 'activity'];
  for (const k of arrays) out[k] = Array.isArray(raw[k]) ? raw[k].filter(x => x && typeof x === 'object') : [];
  for (const k of ['notes', 'taskState', 'drillDrafts', 'newEssayDraft']) out[k] = (raw[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k])) ? raw[k] : {};
  out.profile = { ...base.profile, ...(raw.profile && typeof raw.profile === 'object' ? raw.profile : {}) };
  out.settings = { ...base.settings, ...(raw.settings && typeof raw.settings === 'object' ? raw.settings : {}) };
  out.createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : base.createdAt;
  out.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : base.updatedAt;
  out.version = SCHEMA;
  out.app = APP_ID;
  // 单条记录容错
  out.essays.forEach(e => { e.versions = Array.isArray(e.versions) ? e.versions : []; e.problems = Array.isArray(e.problems) ? e.problems : []; });
  out.examAttempts.forEach(a => { a.answers = (a.answers && typeof a.answers === 'object') ? a.answers : {}; a.selfScores = (a.selfScores && typeof a.selfScores === 'object') ? a.selfScores : {}; });
  out.modelEssays.forEach(m => { m.paragraphs = Array.isArray(m.paragraphs) ? m.paragraphs : []; m.structure = Array.isArray(m.structure) ? m.structure : []; });
  out.courses.forEach(c => { c.points = Array.isArray(c.points) ? c.points : []; c.difficulties = Array.isArray(c.difficulties) ? c.difficulties : []; c.examples = Array.isArray(c.examples) ? c.examples : []; });
  return out;
}

export function init() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { console.warn('localStorage 不可用', e); }
  if (raw) {
    try { state = normalize(JSON.parse(raw)); }
    catch (e) { console.error('数据解析失败，已使用内置演示数据', e); state = normalize(buildSeed()); }
  } else {
    state = normalize(buildSeed());
  }
  save();
  return state;
}

export function resetAll() {
  state = normalize(buildSeed());
  save();
  listeners.forEach(f => f(state));
}

/* ---------------- 备份导出 / 恢复 ---------------- */
export function backupObject() {
  return {
    app: APP_ID, kind: 'backup', version: SCHEMA,
    exportedAt: new Date().toISOString(),
    note: '考研写作自学网站 · 全量备份。包含学习进度、笔记、素材、作文与设置。',
    data: state
  };
}
export function exportBackup() {
  const name = `写作备份_${today()}_${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`;
  download(name, JSON.stringify(backupObject(), null, 2));
  mutate(s => { s.settings.lastBackupAt = new Date().toISOString(); });
  return name;
}

export function parseBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('JSON 格式错误，无法解析'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('文件内容不是有效对象');
  const data = obj.kind === 'backup' && obj.data ? obj.data : obj;
  if (obj.app && obj.app !== APP_ID) throw new Error(`这不是本站的备份文件（app=${obj.app}）`);
  if (!Array.isArray(data.courses) && !Array.isArray(data.essays)) throw new Error('缺少必要的数据字段（courses / essays）');
  return normalize(data);
}

export function restoreBackup(text, mode = 'replace') {
  const incoming = parseBackup(text);
  if (mode === 'merge') {
    const cur = state;
    const mergeArr = (a, b) => {
      const ids = new Set(a.map(x => x && x.id));
      b.forEach(x => { if (!x) return; if (!x.id || !ids.has(x.id)) { a.push(x); ids.add(x.id); } });
    };
    ['courses', 'materials', 'modelEssays', 'drills', 'exams', 'phrases', 'drillRecords',
      'essays', 'examAttempts', 'reviewQueue', 'weakAreas', 'activity'].forEach(k => mergeArr(cur[k], incoming[k]));
    Object.assign(cur.drillDrafts, incoming.drillDrafts || {});
    Object.entries(incoming.notes).forEach(([k, v]) => {
      if (!cur.notes[k]) cur.notes[k] = v;
      else mergeArr(cur.notes[k], Array.isArray(v) ? v : []);
    });
    Object.assign(cur.taskState, incoming.taskState);
    save();
  } else {
    state = incoming;
    save();
  }
  listeners.forEach(f => f(state));
  return { courses: state.courses.length, essays: state.essays.length, materials: state.materials.length };
}

/** 导入内容包：仅追加课程/素材/范文/训练/试卷，不动学习记录 */
export function importContent(text) {
  let obj;
  try { obj = JSON.parse(text); } catch { throw new Error('JSON 格式错误，无法解析'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('文件内容不是有效对象');
  const map = [['courses', 'courses'], ['materials', 'materials'], ['modelEssays', 'modelEssays'], ['drills', 'drills'], ['exams', 'exams']];
  const counts = {};
  const pick = (src, keys, fallback = '') => { for (const k of keys) if (src[k] != null && src[k] !== '') return src[k]; return fallback; };
  mutate(s => {
    map.forEach(([key]) => {
      const arr = Array.isArray(obj[key]) ? obj[key] : [];
      counts[key] = arr.length;
      arr.forEach(item => {
        if (!item || typeof item !== 'object') return;
        const row = { ...item };
        row.id = pick(row, ['id'], uid(key.slice(0, 3)));
        row.label = 'import';
        row.importedAt = new Date().toISOString();
        row.title = pick(row, ['title', 'name'], '未命名条目');
        row.type = pick(row, ['type', 'category'], '');
        if (key === 'courses') {
          row.points = Array.isArray(row.points) ? row.points : [];
          row.difficulties = Array.isArray(row.difficulties) ? row.difficulties : [];
          row.examples = Array.isArray(row.examples) ? row.examples : [];
        }
        if (key === 'modelEssays') { row.paragraphs = Array.isArray(row.paragraphs) ? row.paragraphs : []; row.structure = Array.isArray(row.structure) ? row.structure : []; }
        if (key === 'drills') row.material = pick(row, ['material', 'text'], '');
        if (key === 'exams') row.questions = Array.isArray(row.questions) ? row.questions : [];
        s[key].push(row);
      });
    });
  });
  return counts;
}

export function contentTemplate() {
  return {
    app: APP_ID, kind: 'content', version: SCHEMA,
    note: '内容包模板：把教材/讲义/真题整理成下列结构后导入。导入内容统一标记为「导入资料」，不会覆盖学习记录。',
    courses: [{
      id: 'course_custom_001', title: '示例：我的课程章节', category: '论说文', summary: '章节简介',
      minutes: 20, tags: ['自定义'],
      points: [{ id: 'p1', title: '知识点标题', content: '知识点说明文字' }],
      difficulties: [{ title: '重点难点', content: '说明文字' }],
      examples: [{ title: '示例标题', text: '示例正文', analysis: '详细解析', label: 'import' }],
      keyTakeaways: ['本讲要点']
    }],
    materials: [{ id: 'mat_custom_001', theme: '创新', type: '论据', title: '素材标题', content: '素材正文', source: '出处/页码', tags: ['自定义'] }],
    modelEssays: [{
      id: 'model_custom_001', title: '范文标题', type: '论说文', prompt: '题目材料',
      structure: [{ part: '开头', desc: '作用说明' }],
      paragraphs: [{ id: 'pa1', role: '开头', text: '段落正文', analysis: '段落解析' }]
    }],
    drills: [{ id: 'drill_custom_001', type: '审题训练', title: '训练标题', material: '题目材料', prompt: '作答要求', hint: '提示', reference: '参考要点', minWords: 100 }],
    exams: [{
      id: 'exam_custom_001', title: '模拟卷标题', durationMin: 60,
      questions: [{ id: 'q1', type: '论说文', prompt: '写作要求', material: '题目材料', minWords: 700, reference: '参考范文/思路' }]
    }]
  };
}
export function exportTemplate() {
  download('写作内容包模板.json', JSON.stringify(contentTemplate(), null, 2));
}

/* ---------------- 复习计划 ---------------- */
export function addReview(targetType, targetId, label) {
  const exists = state.reviewQueue.find(r => r.targetId === targetId && r.targetType === targetType);
  if (exists) return false;
  mutate(s => {
    s.reviewQueue.push({
      id: uid('rev'), targetType, targetId, label,
      dueDate: today(), stage: 0, mastered: false, createdAt: new Date().toISOString(), history: []
    });
  });
  return true;
}
export function removeReview(targetType, targetId) {
  mutate(s => { s.reviewQueue = s.reviewQueue.filter(r => !(r.targetId === targetId && r.targetType === targetType)); });
}
export function hasReview(targetType, targetId) {
  return state.reviewQueue.some(r => r.targetId === targetId && r.targetType === targetType);
}
export function dueReviews(d = today()) {
  return state.reviewQueue.filter(r => !r.mastered && r.dueDate <= d);
}
export function doReview(id, result) {
  // result: 'forgot' | 'fuzzy' | 'good'
  mutate(s => {
    const r = s.reviewQueue.find(x => x.id === id);
    if (!r) return;
    if (result === 'good') r.stage = clamp(r.stage + 1, 0, REVIEW_INTERVALS.length);
    else if (result === 'forgot') r.stage = 0;
    else r.stage = clamp(r.stage, 0, REVIEW_INTERVALS.length - 1);
    const days = result === 'forgot' ? 1 : result === 'fuzzy' ? 1 : REVIEW_INTERVALS[Math.min(r.stage - 1, REVIEW_INTERVALS.length - 1)];
    r.dueDate = addDays(today(), days);
    r.lastResult = result;
    r.mastered = result === 'good' && r.stage >= REVIEW_INTERVALS.length;
    r.history.push({ at: new Date().toISOString(), result, stage: r.stage });
  });
  log('review', { id, result });
}

/* ---------------- 统计 ---------------- */
export function stats() {
  const s = state;
  const doneCourses = s.courses.filter(c => c.completed).length;
  const mastered = s.reviewQueue.filter(r => r.mastered).length;
  const writingSessions = s.essays.length + s.examAttempts.filter(a => a.status === 'submitted').length;
  const scores = s.essays.filter(e => typeof e.selfScore === 'number' && e.selfScore > 0).map(e => e.selfScore)
    .concat(s.examAttempts.filter(a => typeof a.totalScore === 'number' && a.totalScore > 0).map(a => a.totalScore));
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 0;
  const totalMinutes = Math.round(s.activity.filter(a => a.type === 'writing' || a.type === 'exam')
    .reduce((sum, a) => sum + (Number(a.meta && a.meta.durationSec) || 0), 0) / 60);
  const problemCount = {};
  s.essays.forEach(e => (e.problems || []).forEach(p => { problemCount[p] = (problemCount[p] || 0) + 1; }));
  return {
    doneCourses, courseTotal: s.courses.length, mastered,
    due: dueReviews().length, writingSessions, avgScore: avg, scoreCount: scores.length,
    totalMinutes, problemCount,
    coursePct: s.courses.length ? Math.round(doneCourses / s.courses.length * 100) : 0
  };
}

/** 今日任务（自动生成 + 用户自定义） */
export function todayTasks() {
  const d = today();
  const ts = state.taskState[d] || (state.taskState[d] = { done: [], custom: [] });
  const tasks = [];
  dueReviews(d).slice(0, 3).forEach(r => tasks.push({
    id: 'review:' + r.id, type: 'review', title: `复习：${r.label}`,
    desc: r.dueDate < d ? '已过期，建议尽快复习' : '今日待复习', route: '#/review'
  }));
  const next = state.courses.find(c => !c.completed);
  if (next) tasks.push({ id: 'course:' + next.id, type: 'course', title: `学习课程：${next.title}`, desc: `约 ${next.minutes || 20} 分钟`, route: `#/course/${next.id}` });
  const pendingTypes = ['审题训练', '找出逻辑漏洞', '列写作提纲'];
  const doneTypes = new Set(state.drillRecords.map(r => r.type));
  const nextType = pendingTypes.find(t => !doneTypes.has(t));
  if (nextType) tasks.push({ id: 'drill:' + nextType, type: 'drill', title: `专项训练：${nextType}`, desc: '完成 1 次并对照参考要点自评', route: `#/drills` });
  const wroteToday = state.essays.some(e => e.createdAt && e.createdAt.slice(0, 10) === d);
  if (!wroteToday) tasks.push({ id: 'write:daily', type: 'write', title: '完成一段写作练习', desc: '哪怕只写一个主体段，也比只看不写有效', route: '#/write/new' });
  (ts.custom || []).forEach(c => tasks.push({ id: 'custom:' + c.id, type: 'custom', title: c.text, desc: '自定义任务', route: '' }));
  return tasks.map(t => ({ ...t, done: (ts.done || []).includes(t.id) || (t.type === 'custom' && cDone(ts, t.id)) }));
}
function cDone(ts, id) { const cid = id.split(':')[1]; const c = (ts.custom || []).find(x => x.id === cid); return !!(c && c.done); }
export function toggleTask(id) {
  const d = today();
  mutate(s => {
    const ts = s.taskState[d] || (s.taskState[d] = { done: [], custom: [] });
    ts.done = ts.done || []; ts.custom = ts.custom || [];
    if (id.startsWith('custom:')) {
      const c = ts.custom.find(x => x.id === id.split(':')[1]); if (c) c.done = !c.done;
    } else {
      const i = ts.done.indexOf(id);
      if (i >= 0) ts.done.splice(i, 1); else ts.done.push(id);
    }
  });
}
export function addCustomTask(text) {
  mutate(s => {
    const d = today();
    const ts = s.taskState[d] || (s.taskState[d] = { done: [], custom: [] });
    ts.custom = ts.custom || [];
    ts.custom.push({ id: uid('t'), text, done: false });
  });
}
export function removeCustomTask(id) {
  mutate(s => { const ts = s.taskState[today()]; if (ts && ts.custom) ts.custom = ts.custom.filter(x => x.id !== id); });
}
