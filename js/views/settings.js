/* 数据管理与设置：JSON 全量备份 / 恢复 / 内容包导入 / 模板 / 个人设置 / PWA / 关于 */
'use strict';
import * as store from '../store.js';
import { esc, icon, download, pickFile, readFileText, fmtDate, uid } from '../utils.js';
import { toast, confirmSheet, formSheet, LABELS, labelChip, disclaimer, sectionTitle } from '../ui.js';

function usedBytes() {
  try { return new Blob([localStorage.getItem('ky_writing_v1') || '']).size; }
  catch { return 0; }
}
function fmtBytes(n) { return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`; }

export function render(ctx) {
  const s = store.get();
  const counts = [
    ['课程', s.courses.length], ['素材', s.materials.length], ['范文', s.modelEssays.length],
    ['练习题', s.drills.length], ['试卷', s.exams.length], ['作文', s.essays.length],
    ['练习记录', s.drillRecords.length], ['考试答卷', s.examAttempts.length],
    ['笔记', Object.values(s.notes).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0)],
    ['收藏表达', s.phrases.length], ['复习项', s.reviewQueue.length]
  ];
  return {
    title: '数据管理', sub: '本地持久化 · 无需账号', fab: false,
    html: `
      <div class="page-head"><h1>数据管理</h1><p>所有学习数据保存在当前浏览器的 localStorage 中，不上传云端。请定期导出 JSON 备份；换浏览器、清理缓存或卸载前务必先备份。</p></div>

      <div class="notice warn">${icon('alert', 16)}<div><b>数据只在本机、当前浏览器。</b>清除浏览器数据 / 使用无痕模式 / 更换设备都会导致数据不可见。恢复备份前，系统会先自动下载一份当前数据的快照。</div></div>

      <div class="card card-pad mb-4">
        ${sectionTitle('备份与恢复', '')}
        <div class="grid grid-2 mb-3" style="gap:10px">
          <button class="btn btn-primary" data-act="export">${icon('download', 16)} 导出全量备份</button>
          <button class="btn btn-soft" data-act="restore-replace">${icon('upload', 16)} 恢复备份（覆盖）</button>
          <button class="btn btn-outline" data-act="restore-merge">${icon('refresh', 16)} 恢复备份（合并）</button>
          <button class="btn btn-outline" data-act="copy-json">${icon('copy', 16)} 复制备份 JSON</button>
        </div>
        <div class="kv"><span class="k">上次导出备份</span><span class="v">${s.settings.lastBackupAt ? fmtDate(s.settings.lastBackupAt, true) : '从未导出'}</span></div>
        <div class="kv"><span class="k">本地数据占用</span><span class="v">${fmtBytes(usedBytes())}</span></div>
        <div class="kv"><span class="k">最后保存时间</span><span class="v">${fmtDate(s.updatedAt, true)}</span></div>
        <div class="kv"><span class="k">保存状态</span><span class="v ${store.lastSaveError() ? 't-danger' : 't-success'}">${store.lastSaveError() ? esc(store.lastSaveError()) : '正常'}</span></div>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('导入教材 / 讲义 / 范文 / 真题', '内容包')}
        <div class="t-sm t-ink2 mb-3" style="line-height:1.85">把你自己的资料整理成 JSON 内容包后导入，条目会统一标记为「导入资料」，<b>只追加内容、不覆盖任何学习记录</b>。字段说明见下方模板文件；单个字段缺失时系统会自动补默认值。</div>
        <div class="drop-zone" id="drop-zone">
          <div class="dz-i">⬆</div><div class="dz-t">点击选择，或把 .json 文件拖到这里</div>
          <div class="t-xs t-muted">支持 courses / materials / modelEssays / drills / exams 五类内容</div>
        </div>
        <div class="btn-row mt-3">
          <button class="btn btn-soft btn-sm" data-act="import-content">${icon('upload', 15)} 选择内容包</button>
          <button class="btn btn-outline btn-sm" data-act="template">${icon('download', 15)} 下载内容包模板</button>
          <button class="btn btn-outline btn-sm" data-act="import-text">${icon('plus', 15)} 粘贴文本快速建素材</button>
        </div>
        <div class="t-xs t-muted mt-3" style="line-height:1.7">关于 PDF：本站不内置 PDF 解析。请把讲义 / 真题中的文字按需整理成模板中的 JSON 字段（可借助任意 PDF 转文字工具），再导入；扫描件需先做 OCR 并人工校对。</div>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('个人设置', '')}
        <div class="kv"><span class="k">昵称</span><span class="v">${esc(s.profile.nickname || '未设置')}</span></div>
        <div class="kv"><span class="k">考试类型</span><span class="v">${esc(s.profile.examType || '未设置')}</span></div>
        <div class="kv"><span class="k">目标考试日期</span><span class="v">${esc(s.profile.examDate || '未设置')}</span></div>
        <div class="kv"><span class="k">每日目标（分钟）</span><span class="v">${s.profile.dailyGoalMin || 30}</span></div>
        <div class="kv"><span class="k">编辑器自动保存间隔</span><span class="v">${s.settings.autosaveMs || 600} 毫秒</span></div>
        <button class="btn btn-soft btn-block btn-sm mt-3" data-act="profile">${icon('edit', 15)} 修改个人设置</button>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('当前数据概览', '')}
        <div class="grid grid-3" style="gap:8px">${counts.map(([k, v]) => `<div class="stat-tile"><div class="v" style="font-size:20px">${v}</div><div class="stat-label">${esc(k)}</div></div>`).join('')}</div>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('内容来源标注说明', '')}
        ${Object.entries(LABELS).map(([k, L]) => `<div class="legend-row">${labelChip(k)}<span class="d">${({
          demo: '功能演示用的内置通用写作方法说明，不是任何机构的课程内容',
          ai: '由 AI 生成的示例、范文与参考思路，非真题、非官方范文',
          user: '你自己新建或编辑的内容',
          import: '通过内容包导入的资料，来源由你自行标注',
          public: '公有领域古籍原文，已注明出处；未收录虚构的名人语录'
        })[k]}</span></div>`).join('')}
        <div class="divider"></div>
        ${disclaimer()}
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('安装到手机主屏幕（PWA）', '')}
        <div class="bodytext mb-3">本站在 localhost 或 HTTPS 下可离线使用。电脑端启动服务后，手机与电脑连同一 Wi-Fi，用浏览器打开终端里显示的局域网地址即可访问（该地址下仍可正常使用全部功能与数据保存）。</div>
        <div class="bodytext mb-3"><b>iPhone：</b>Safari 打开 → 底部分享按钮 → 「添加到主屏幕」。<br><b>Android：</b>Chrome 打开 → 右上角菜单 → 「安装应用 / 添加到主屏幕」。<br>若要完整离线缓存，请通过 HTTPS 地址访问（本机 localhost 亦可）。</div>
        <button class="btn btn-soft btn-block btn-sm" data-act="install" id="pwa-install">${icon('download', 15)} 安装到本设备</button>
        <div class="t-xs t-muted mt-2" id="pwa-tip"></div>
      </div>

      <div class="card card-pad mb-4">
        ${sectionTitle('危险操作', '')}
        <div class="btn-row">
          <button class="btn btn-danger btn-sm" data-act="reset">${icon('refresh', 15)} 重置为初始演示数据</button>
          <button class="btn btn-danger btn-sm" data-act="wipe">${icon('trash', 15)} 清空全部学习数据</button>
        </div>
        <div class="t-xs t-muted mt-2">两项操作都会先要求确认，并自动下载一份当前数据快照。清空后仍可通过备份文件恢复。</div>
      </div>

      <div class="t-xs t-muted t-center mb-4">考研写作 · 自学工作台 v1.0 · 零依赖静态站点 · 本地离线优先</div>
    `
  };
}

export function mount(ctx, main) {
  const zone = main.querySelector('#drop-zone');
  if (zone) {
    zone.addEventListener('click', () => handleContent(ctx));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', async e => {
      e.preventDefault(); zone.classList.remove('over');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) await applyContent(ctx, await readFileText(f));
    });
  }
  const inst = main.querySelector('#pwa-install');
  if (inst && !window.__pwaInstallEvent) {
    inst.addEventListener('click', () => {
      const tip = main.querySelector('#pwa-tip');
      if (tip) tip.textContent = '当前浏览器未触发安装提示：请改用浏览器菜单中的「添加到主屏幕 / 安装应用」，或确认通过 HTTPS / localhost 访问。';
    });
  } else if (inst) {
    inst.addEventListener('click', async () => {
      const ev = window.__pwaInstallEvent; if (!ev) return;
      ev.prompt(); const { outcome } = await ev.userChoice;
      window.__pwaInstallEvent = null;
      toast(outcome === 'accepted' ? '已开始安装' : '已取消安装');
    });
  }

  main.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    try {
      if (act === 'export') { const name = store.exportBackup(); toast('备份已下载：' + name, 'ok'); ctx.refresh(); return; }
      if (act === 'copy-json') {
        const text = JSON.stringify(store.backupObject(), null, 2);
        try { await navigator.clipboard.writeText(text); toast('备份 JSON 已复制', 'ok'); }
        catch { toast('浏览器未允许复制，请改用「导出全量备份」', 'err'); }
        return;
      }
      if (act === 'restore-replace' || act === 'restore-merge') {
        const f = await pickFile(); if (!f) return;
        const text = await readFileText(f);
        const parsed = store.parseBackup(text); // 先校验
        const mode = act === 'restore-merge' ? 'merge' : 'replace';
        const ok = await confirmSheet({
          title: mode === 'replace' ? '覆盖恢复备份' : '合并恢复备份',
          desc: `文件包含：课程 ${parsed.courses.length} 讲 / 素材 ${parsed.materials.length} 条 / 作文 ${parsed.essays.length} 篇 / 答卷 ${parsed.examAttempts.length} 份。<br><br>${mode === 'replace' ? '<b>覆盖会替换当前全部数据</b>' : '合并会按 id 追加不重复的记录'}。系统已先自动下载一份当前数据快照，确定继续？`,
          confirmText: '确定恢复', danger: mode === 'replace'
        });
        if (!ok) return;
        download(`恢复前快照_${Date.now()}.json`, JSON.stringify(store.backupObject(), null, 2));
        const r = store.restoreBackup(text, mode);
        toast(`恢复完成：课程 ${r.courses} / 素材 ${r.materials} / 作文 ${r.essays}`, 'ok');
        ctx.go('#/home'); return;
      }
      if (act === 'import-content') { await handleContent(ctx); return; }
      if (act === 'template') { store.exportTemplate(); toast('内容包模板已下载', 'ok'); return; }
      if (act === 'import-text') {
        const v = await formSheet({ title: '粘贴文本快速建素材', desc: '把讲义中的一段文字粘进来，会生成一条「个人添加」素材，可再到素材库里改主题与出处。', fields: [
          { key: 'title', label: '标题', required: true },
          { key: 'content', label: '正文', type: 'textarea', rows: 9, required: true },
          { key: 'theme', label: '主题分类', value: '未分类', required: true },
          { key: 'source', label: '出处', placeholder: '书名 / 页码 / 链接（请自行确认使用权限）' }
        ], confirmText: '添加素材' });
        if (!v) return;
        store.mutate(s => s.materials.unshift({ id: uid('mat'), title: v.title, content: v.content, theme: v.theme, type: '论据', source: v.source, tags: [], favorite: false, label: 'user', createdAt: new Date().toISOString() }));
        toast('素材已添加，可到素材库查看', 'ok'); ctx.go('#/materials'); return;
      }
      if (act === 'profile') {
        const s = store.get();
        const v = await formSheet({ title: '个人设置', fields: [
          { key: 'nickname', label: '昵称', value: s.profile.nickname || '' },
          { key: 'examType', label: '考试类型', type: 'select', value: s.profile.examType, options: ['管理类联考（199 管综）', '经济类联考（396 经综）', '其他 / 自定义'].map(x => ({ value: x, label: x })) },
          { key: 'examDate', label: '目标考试日期', value: s.profile.examDate || '', placeholder: 'YYYY-MM-DD，可留空' },
          { key: 'dailyGoalMin', label: '每日目标（分钟）', type: 'number', value: s.profile.dailyGoalMin || 30, min: 1, max: 600 },
          { key: 'autosaveMs', label: '自动保存间隔（毫秒）', type: 'number', value: s.settings.autosaveMs || 600, min: 200, max: 5000 }
        ], confirmText: '保存设置' });
        if (!v) return;
        store.mutate(st => {
          st.profile.nickname = v.nickname; st.profile.examType = v.examType;
          st.profile.examDate = /^\d{4}-\d{2}-\d{2}$/.test(v.examDate) ? v.examDate : '';
          st.profile.dailyGoalMin = Number(v.dailyGoalMin) || 30;
          st.settings.autosaveMs = Math.min(5000, Math.max(200, Number(v.autosaveMs) || 600));
        });
        toast('设置已保存', 'ok'); ctx.refresh(); return;
      }
      if (act === 'reset' || act === 'wipe') {
        const ok = await confirmSheet({
          title: act === 'reset' ? '重置为初始演示数据' : '清空全部学习数据',
          desc: act === 'reset'
            ? '当前所有进度、笔记、作文与自评都将被替换为初始演示数据。系统会先自动下载一份当前数据快照。'
            : '所有学习数据将被清空（保留空的数据结构）。系统会先自动下载一份当前数据快照。<b>此操作不可撤销，只能通过备份恢复。</b>',
          confirmText: act === 'reset' ? '确认重置' : '确认清空', danger: true
        });
        if (!ok) return;
        download(`清空前快照_${Date.now()}.json`, JSON.stringify(store.backupObject(), null, 2));
        if (act === 'reset') store.resetAll();
        else store.mutate(st => {
          st.courses = []; st.materials = []; st.modelEssays = []; st.drills = []; st.exams = [];
          st.notes = {}; st.phrases = []; st.drillRecords = []; st.drillDrafts = {}; st.essays = [];
          st.examAttempts = []; st.reviewQueue = []; st.weakAreas = []; st.activity = [];
          st.taskState = {}; st.newEssayDraft = {};
        });
        toast('操作完成', 'ok'); ctx.go('#/home');
      }
    } catch (err) {
      console.error(err);
      toast('操作失败：' + (err && err.message ? err.message : '未知错误'), 'err');
    }
  });
}

async function handleContent(ctx) {
  const f = await pickFile(); if (!f) return;
  await applyContent(ctx, await readFileText(f));
}
async function applyContent(ctx, text) {
  let obj;
  try { obj = JSON.parse(text); } catch { toast('JSON 格式错误，无法解析', 'err'); return; }
  const keys = ['courses', 'materials', 'modelEssays', 'drills', 'exams'];
  const counts = keys.map(k => `${k}: ${Array.isArray(obj[k]) ? obj[k].length : 0}`).join(' / ');
  const ok = await confirmSheet({ title: '导入内容包', desc: `将追加以下内容（统一标记为「导入资料」，不影响现有学习记录）：<br><br>${esc(counts)}<br><br>确定导入？`, confirmText: '确认导入' });
  if (!ok) return;
  const r = store.importContent(text);
  toast(`导入完成：课程 ${r.courses || 0} / 素材 ${r.materials || 0} / 范文 ${r.modelEssays || 0} / 训练 ${r.drills || 0} / 试卷 ${r.exams || 0}`, 'ok');
  ctx.go('#/home');
}
