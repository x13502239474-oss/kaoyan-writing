# 考研系列四站统一设计规范（Kaoyan Design System v1）

> 供数学 / 写作 / 逻辑 / 英语二 四个独立站点共用，保证视觉与交互一致。
> **落地方式**：把写作站的 `css/tokens.css` 原样复制到你的项目，再覆写 `--brand-*` 学科色即可。
> 本文件不含任何其它三个站点的代码，不会修改它们的项目文件。

---

## 1. 设计原则

1. **移动端第一优先级**：所有布局从 320px 起做，桌面端只是「加一条侧栏」。
2. **浅色纸感**：白卡片 + 浅灰蓝底 + 细边框，长时间阅读不刺眼。
3. **一个主色 + 一个学科点缀**：主色统一靛蓝，学科差异只体现在点缀色与首字图标。
4. **手指友好**：所有可点区域 ≥ 44px；输入框字号 ≥ 16px（防 iOS 自动缩放）。
5. **零横向滚动**：全局 `overflow-x:hidden` + `box-sizing:border-box` + 筛选标签自动换行。
6. **一致性优先于花哨**：同一件事在四站用同一个组件、同一个位置、同一种措辞。

---

## 2. 颜色令牌

```css
:root {
  /* 主色（四站统一） */
  --brand: #3B5BDB;  --brand-strong: #2D47B8;
  --brand-soft: #EEF2FF; --brand-soft-2: #E3EAFF; --brand-on: #FFFFFF;

  /* 学科点缀（各站可覆写） */
  --seal: #B4433A;  --seal-soft: #FBEEEC;   /* 写作站：印章红 */

  /* 中性 */
  --bg: #F5F7FB; --surface: #FFFFFF; --surface-2: #F8FAFD; --surface-3: #F1F4FA;
  --border: #E5EAF2; --border-strong: #D3DBE9;
  --ink: #1B2434; --ink-2: #44506A; --muted: #7A8699; --faint: #A5AEBC;

  /* 语义 */
  --success: #0E8359; --success-soft: #E7F6EF;
  --warn: #B8730C;    --warn-soft: #FFF3E0;
  --danger: #C0392B;  --danger-soft: #FDECEA;
  --info: #1C6FB5;    --info-soft: #E8F3FC;
}
```

建议学科点缀色（仅替换 `--seal*`）：
数学 `#0E7C86`（青）、逻辑 `#7A4FB5`（紫）、英语二 `#B4760A`（琥珀）。

**金融/涨跌例外**：若站点涉及成绩趋势以外的涨跌数据，遵循中国习惯**涨红跌绿**；本站分数趋势用品牌蓝，不涉及该规则。

---

## 3. 排版

| 用途 | 值 |
|---|---|
| 界面字体 | `-apple-system, "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` |
| 长文阅读字体 | `"Songti SC", "Noto Serif CJK SC", "SimSun", serif`，17px / line-height 1.95 |
| 正文 | 14–15px / 1.6 |
| 标题 | 页标题 24px / 760；卡片标题 15px / 680 |
| 编辑器 | 17px / 2.05，衬线，min-height 300px |
| 字号梯度 | 11 / 12 / 14 / 15 / 17 / 20 / 24 / 28 |

圆角 `8 / 12 / 16 / 22 / pill`；阴影三级；间距 4 的倍数。

---

## 4. 布局骨架（四站一致）

```
┌─────────────────────────────────────┐
│ AppBar 56px（返回 / 标题+副标 / 操作）│  fixed top
├──────────┬──────────────────────────┤
│ Sidebar  │  Main .container         │  ≥1024px 才出现侧栏
│ 236px    │  max-width 940px         │
│ （分组） │  padding 16 / 32         │
├──────────┴──────────────────────────┤
│ TabBar 62px（5 个标签）              │  <1024px 显示，fixed bottom
└─────────────────────────────────────┘
FAB 写作/新建按钮（右下，54px 圆形）
```

- 底部 5 个标签固定为：**首页 / 课程 / 训练 / 素材 / 我的**；每站的第 3、4 项文案可替换为该学科主模块，但位置与数量不变。
- 侧栏分组固定：**学习 / 资料 / 个人**。
- iOS 安全区：`env(safe-area-inset-*)` 用在 AppBar、TabBar 与 bottom sheet。
- `main` 顶部 padding = AppBar 高度，底部 padding = TabBar 高度 + 安全区，避免内容被遮挡。

---

## 5. 组件与交互约定

| 组件 | 类名 | 约定 |
|---|---|---|
| 卡片 | `.card` / `.card-pad` | 白底、1px 边框、16px 圆角、一级阴影 |
| 按钮 | `.btn .btn-primary/.btn-soft/.btn-outline/.btn-danger` | 最小高 44px，小号 34px，`:active` 缩放 .975 |
| 分段/标签页 | `.segmented` / `.tabs` | 选中态用品牌色 + 底部 3px 指示条 |
| 列表 | `.list` / `.list-item` | 左侧 38px 图标块 + 主标题(省略号) + 副标题 + 右箭头 |
| 筛选 | `.filter-pill` / `.filter-scroll` | **自动换行**，不做横向滚动 |
| 表单 | `.field .input .textarea .select` | 字号 16px，聚焦 3px 品牌光晕 |
| 弹层 | `.overlay .sheet` | 移动端底部抽屉（圆角 22px），≥720px 居中对话框 |
| 提示 | `.toast` | 底部居中，2.2s 自动消失 |
| 进度 | `.progress` | 8px / 5px 两档 |
| 空状态 | `.empty` | 图标 + 标题 + 说明 + 一个主行动按钮 |
| 声明条 | `.notice` / `.notice.warn` | 蓝 / 琥珀两种 |

**交互铁律**
1. 删除类操作一律二次确认（`confirmSheet`），危险操作前自动导出快照；
2. 所有输入自动保存，界面显示「已自动保存 HH:MM:SS」状态点；
3. 表单统一走 `formSheet`，不各写各的弹窗；
4. 主观内容一律「人工评分 + 自我评价」，出现「自动判分」字样的功能不要做；
5. 内容来源标签固定 5 类：演示内容 / AI 生成 / 个人添加 / 导入资料 / 古籍·公有领域。

---

## 6. 数据层约定（便于日后合并）

- localStorage 键名：`ky_<subject>_v1`（写作站为 `ky_writing_v1`）；
- 全量 JSON 一次写入，字段带 `version` 与容错补全；
- 备份格式统一：`{ app, kind:"backup", version, exportedAt, data }`；
- 内容包格式统一：`{ app, kind:"content", version, courses/materials/... }`；
- 路由统一 hash 形式 `#/xxx`，便于静态托管、无需服务端重写。

---

## 7. PWA

- `manifest.webmanifest`：`display: standalone`，`theme_color #3B5BDB`，192 / 512 / maskable 三图标；
- `sw.js`：在线优先 + 离线回退缓存（避免开发期读到旧代码）；
- iOS：`apple-mobile-web-app-capable`、`apple-touch-icon`、`apple-mobile-web-app-title`；
- `viewport-fit=cover` + 安全区 padding。

---

## 8. 复用清单

复制以下文件即可获得一致外观：
`css/tokens.css` → `css/app.css` →（按需）`css/views.css` → `js/utils.js`（图标与工具）→ `js/ui.js`（抽屉/Toast/表单/编辑器自动保存）。

各站只需实现自己的 `js/store.js`、`js/seed.js` 与 `js/views/*`。
