# P0 缺口 + Notion 风格重设计

> 日期：2026-06-02
> 状态：Brainstorming 已完成，待用户复核后进入 writing-plans
> 范围：PRD P0 缺口（4 项）+ 现有页面 Notion 风格化

## 1. 背景与目标

上一轮 PRD 对比识别出 4 项 P0 缺口：M11 备份、#2 手动加题、#19 考前模式、#21 毕业触发。
本轮同时收到两条产品方向调整：

1. **界面类 Notion 风格** — 更简约、信息层级清晰、避免装饰
2. **消除多余 action** — 默认即生效、避免中间确认弹窗

目标：交付 4 项 P0 特性，同时把现有 6 学生页 + 2 家长页 + 5 layout 组件统一到 Notion 风格。

## 2. 设计原则

### 2.1 Notion 风格 Token
- **颜色**：`bg` `#ffffff`，`surface` `#fbfbfa`，`border` `#e9e9e7`，`text-primary` `#37352f`，`text-secondary` `#787774`，`text-tertiary` `#b4b4b0`，`accent` `#2383e2`，`accent-bg` `#ddebf1`，`danger` `#e03e3e`，`success` `#0f7b6c`，`warning` `#cb912f`
- **字体**：系统栈 `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`；正文 14px，标题 16/20/28px
- **间距阶梯**：4/8/12/16/24/32/48/64
- **圆角**：统一 6px（按钮/输入/卡片）
- **阴影**：默认无；仅 hover 时 `0 1px 2px rgba(15,15,15,0.05)`，模态 `0 8px 24px rgba(15,15,15,0.12)`
- **分隔**：1px solid `#e9e9e7` 优先于 box-shadow
- **动效**：150ms ease-out hover/focus 过渡

落地：`src/styles/tokens.ts`（TS 常量）+ `tailwind.config.js` 扩展 `theme.extend`。
不引入新 CSS 框架；继续用 Tailwind 原子化（已存在）。

### 2.2 无多余 Action 三原则
1. **避免中间确认弹窗** — 唯一例外是"不可逆且后果显著"的操作（如恢复快照、清空数据）。这类用 inline 二次确认（行内展开 "确认恢复？" + 取消/确认按钮）
2. **避免多次模态** — 模态仅用于"必须打断"的操作（OCR 进行中、不可恢复错误）。其他用 inline / drawer / 新页
3. **减少手选参数** — 字段默认值=最常见值；提交/选择=实时生效，不需要"保存"按钮

### 2.3 TDD 边界
- **纯函数**：业务规则（graduation 计算、考前模式 SQL 拼装、手动加题 payload 转换、备份元数据）→ vitest 单元测试先写
- **React 组件**：实现完跑一遍 vitest（如有）即可，深度测试交给 Playwright E2E
- **Rust 命令**：cargo test（如有）
- **E2E**：4 个新 spec 覆盖 P0 全流程 + 1 个风格 smoke test

## 3. P0 #21 毕业触发

### 数据流
1. `GradingPage.handleConfirm` 在 `INSERT INTO practice_answers` 之后调用 `graduation.markIfGraduated(questionId, sessionId)`
2. `markIfGraduated` 重算该 question 的 mastery_score（聚合 question 的 practice_answers，is_correct ∈ {0,1,2,3} 加权），与 `mastery` 公式对齐
3. 若新 mastery ≥ 90，UPDATE `questions SET status='graduated', mastery_score=? WHERE id=?`
4. 错题本列表展示时，已毕业项显示 "已毕业" 标签（灰色、非警告色）

### 纯函数（`src/lib/graduation.ts`）
```ts
calculateMastery(answers: PracticeAnswer[]): number  // 0-100
shouldGraduate(mastery: number): boolean            // >= 90
recomputeQuestionMastery(answers: PracticeAnswer[]): {
  newMastery: number
  newStatus: "active" | "graduated"
}
```

### TDD
- `graduation.test.ts`：
  - 0 答 → mastery = 0
  - 全对（isCorrect=1）→ mastery 增长
  - 部分对（isCorrect=2）→ 增长较慢
  - mastery=89 → active
  - mastery=90 → graduated
  - mastery=100 → graduated

### UI 提示
- `QuestionsPage` 列表：题目右上角小 chip，"已毕业"（success 色，10px）
- 无 toast / 弹窗

## 4. P0 #2 手动加题

### UI
- `QuestionsPage` 顶栏右侧加"添加"按钮（与"导入 Word"并排）
- 点击后，**行内展开**一个 form panel（不是模态）
- Form 字段：
  - 题目内容（textarea，自动 focus，必填）
  - 题型 radio（客观 | 主观，默认客观）
  - 学科 radio（数学 | 物理，默认数学）
  - 章节 input（autocomplete，data source = 该学生已用过的 chapter）
  - 参考答案（input）
  - 图片：点击上传区，调用 Tauri dialog，可多选
  - 错因 select（默认"未分类"）
  - 难度 select（默认"medium"）
- 提交按钮："完成添加"
- 提交后：调用 `useQuestionAnalysis` 跑 AI 分析（与 Word 导入同流程），关闭 form panel，跳回错题本

### 无多余 Action
- 无"暂存"按钮（用户如想退出，关闭即丢失，form 顶部提示文案明示）
- 章节 autocomplete 自动从历史推断，减少输入
- 图片多选一次完成，不需要"继续添加图片"

### 纯函数（`src/lib/manualQuestion.ts`）
```ts
buildManualQuestionInput(
  form: FormState,
  currentStudentId: number,
  imagePaths: string[]
): QuestionInput

validateManualQuestionForm(form: FormState): string[]  // 错误信息列表
```

### TDD
- 完整 form → QuestionInput
- 缺题目内容 → 错误
- 图片多选 → content_images JSON 数组正确
- 默认值正确

### 图片存储
- 路径：`{appData}/photos/{studentId}/{timestamp}-{filename}`
- 通过新增 Tauri 命令 `save_uploaded_photo(path, bytes)` 写入

## 5. P0 #19 考前模式

### UI
- `PracticePage` 顶栏：[日常模式 | 考前模式] 切换（segmented control）
- **考前模式布局**：左侧 1/3 知识点树，右侧 2/3 错题预览
- 知识点树：`KnowledgeTree` 组件扩展为多选（checkbox + click 展开）
- 选中即右侧实时拉错题（按 mastery ASC）
- 顶部显示"已选 N 个知识点 / 共 M 道错题"
- 底部：[导出 PDF] [导出 Word]（无"生成"按钮，选中即就绪）

### 无多余 Action
- 无"开始生成"按钮
- 无"确认范围"步骤（直接显示结果）
- 学科切换：默认沿用上次选择

### 纯函数（`src/lib/examPrep.ts`）
```ts
buildExamPrepQuery(
  studentId: number,
  knowledgeIds: number[],
  limit?: number  // 默认 50
): { sql: string; params: unknown[] }

createExamPrepSession(
  db: DB,
  studentId: number,
  knowledgeIds: number[]
): Promise<number>  // sessionId, session_type='exam_prep'

sortQuestionsByMastery(questions: Question[], order: 'asc' | 'desc'): Question[]

getLeafKnowledgeIds(tree: KnowledgeTreeNode[]): number[]
```

### TDD
- 单知识点 → SQL `WHERE knowledge_id IN (?)`
- 多知识点 → SQL `IN (?,?,?)` + 参数对齐
- 排序：mastery 升序
- session 写入：session_type='exam_prep', target_knowledge_ids=JSON 数组

## 6. P0 M11 备份

### 数据流

**本地快照**
- 触发 1：应用退出（`tauri::WindowEvent::CloseRequested`）→ `create_local_snapshot` + `cleanup_old_snapshots(10)` → 放行关闭
- 触发 2：用户在 SettingsPage 点"立即创建本地快照"
- 触发 3：恢复快照前（自动安全网）
- 路径：`{appData}/backups/snapshot-{YYYYMMDD-HHMMSS}.db`
- 轮转：保留最近 10 个，超出按 mtime 删除最老的

**同步盘备份**
- 配置：用户在 SettingsPage 点"选择同步盘文件夹" → Tauri dialog → 存到 `app_config` 表
- 触发 1：用户在 SettingsPage 点"立即备份到同步盘"
- 路径：`{sync_folder}/seeker-{YYYYMMDD-HHMMSS}.db`
- 不轮转（用户自己管）

**恢复**
- 用户在 SettingsPage 选某个快照 → 点"恢复"
- **不可逆**：inline 确认（"将覆盖当前数据，已自动创建安全快照。确定恢复？"）
- 执行：先 `create_local_snapshot`（自动），再把快照文件 cp 回 `seeker.db`
- 恢复成功后弹通知（右上角 toast，3s 自动消失）"已恢复到 {ts}，应用将重启"
- 触发应用重启

### Rust 命令（`src-tauri/src/commands/backup.rs`）
```rust
pick_sync_folder() -> Result<String>
set_sync_folder_config(path: String) -> Result<()>
get_sync_folder_config() -> Result<Option<String>>

create_local_snapshot() -> Result<SnapshotInfo>
list_local_snapshots() -> Result<Vec<SnapshotInfo>>
restore_snapshot(path: String) -> Result<()>
cleanup_old_snapshots(keep: usize) -> Result<usize>

backup_to_sync_folder() -> Result<SnapshotInfo>
```

`SnapshotInfo { path: String, created_at: String, size_bytes: u64 }`

### TS 包装（`src/lib/backup.ts`）
薄包装 `invoke()`，导出类型化函数。

### SettingsPage UI
- 标题："设置"
- 卡片 1：同步盘备份
  - 当前路径（或"未设置"）
  - 按钮"选择文件夹" / "立即备份" / "打开文件夹"
- 卡片 2：本地快照
  - 列表：相对时间 / 大小 / [恢复] [删除]
  - 顶部"立即创建快照"按钮
- 卡片 3：恢复提示（展开的 inline 确认）
- 卡片 4：模型配置（占位，留给后续 P1 #41）

### 纯函数（`src/lib/backupConfig.ts`）
```ts
formatRelativeTime(timestamp: string): string   // "2 小时前"
formatBytes(bytes: number): string              // "12.4 MB"
sortSnapshotsByTime(snapshots: SnapshotInfo[]): SnapshotInfo[]
getActiveSyncFolder(config: AppConfig): string | null
```

### TDD
- formatRelativeTime 边界：now / 5min ago / 1h ago / yesterday / N days ago
- sortSnapshotsByTime 倒序
- 同步盘路径未配置时返回 null

## 7. Notion 风格化现有页面

### 改造清单
| 文件 | 改动 |
|---|---|
| `src/pages/student/HomePage.tsx` | 移除 gradient hero；中等按钮；卡片边框化 |
| `src/pages/student/QuestionsPage.tsx` | 顶栏 inline；hover 操作；form panel inline 展开 |
| `src/pages/student/GraphPage.tsx` | 详情面板 inline 展开（去掉原 modal 习惯，如有） |
| `src/pages/student/PracticePage.tsx` | 顶栏 segmented control；多选树 |
| `src/pages/student/GradingPage.tsx` | 题目列表紧凑；批改完成即跳下一题 |
| `src/pages/student/StatsPage.tsx` | 移除装饰；图表保留 |
| `src/pages/parent/DashboardPage.tsx` | 4-6 关键卡片 |
| `src/pages/parent/SettingsPage.tsx` | 完全重写（M11） |
| `src/components/layout/AppShell.tsx` | 白底、细边线、左侧导航 |
| `src/components/layout/StudentNav.tsx` | 图标 + 文字、hover 浅灰 |
| `src/components/layout/ParentNav.tsx` | 同上 |
| `src/components/layout/RoleToggle.tsx` | 右上角、单按钮 |
| `src/components/layout/OllamaStatusBar.tsx` | 紧凑、不占空间 |
| `src/components/layout/StudentSwitcher.tsx` | 简化 |
| `src/index.css` + `tailwind.config.js` | 注入 token |

### 改动原则
- **不重写**任何已有的逻辑（提问分析、word 解析、scheduler 等）
- **仅改样式**和**少量交互**（如"加 form panel"）
- 已有 95 个 vitest 测试不应受影响（都是 lib/ 下纯函数）

## 8. 测试策略

### 单元测试（vitest，TDD 驱动）
- `src/lib/graduation.test.ts`（新）
- `src/lib/manualQuestion.test.ts`（新）
- `src/lib/examPrep.test.ts`（新）
- `src/lib/backupConfig.test.ts`（新）
- 已有测试保持绿

### Playwright E2E（新 spec）
- `e2e/04-graduation.spec.ts` — 批改一条 mastery < 90 题、再批改到 90+、验证错题本显示"已毕业"
- `e2e/05-manual-add.spec.ts` — 点添加 → 填表单 → 提交 → 验证错题本新增
- `e2e/06-exam-prep.spec.ts` — 切到考前模式 → 选 2 个知识点 → 验证右侧错题列表 + 导出按钮
- `e2e/07-backup.spec.ts` — 设置同步盘文件夹（mock）、创建快照、列表显示、恢复（含 inline 确认）
- `e2e/08-style.spec.ts` — 风格 smoke：无 box-shadow gradient、按钮圆角 6px、字体系统栈

### 不重写现有 6 个 spec
- 02-core-workflow 仍作为基础回归跑
- 但个别断言可能因 UI 改动需微调（用 query 文本仍稳定，组件 role 可能变）

## 9. 风险与权衡

| 风险 | 缓解 |
|---|---|
| Notion 风格化现有页面工作量大 | 严格只改样式，不动逻辑；如时间紧，14 文件可拆 PR 分批 |
| 备份涉及文件 IO，跨平台行为差异 | 仅 cp 文件，TS 端不接触 fs；先 macOS 测，Windows 后续 |
| 手动加题图片上传涉及 Tauri 命令 | 复用现有 `save_answer_photo` 或新增 `save_uploaded_photo`，最小改动 |
| 考前模式多选树与现有单选树冲突 | 用新 prop `multiSelect` 控制，KnowledgeTree 内部条件渲染 checkbox |
| 备份 restore 失败的数据丢失 | 恢复前自动快照 + 恢复后弹通知"已恢复到 {ts}"，让用户能再次回滚 |
| 风格化后现有 Playwright 断言可能失效 | 优先用 `text=` 和 role 选择器，不依赖 class 名 |

## 10. 范围外（明确不做）

- P1 任务（手动确认 AI 结果、批量拍照、每日推送、年级自动推进、Ollama 引导下载、自动更新、学期末报告、章节导出、力导向图）
- 力导向图替换树状图
- 32B 模型切换
- 桌面端平台拓展（仅 macOS 验证）
- i18n

## 11. 实施顺序

按依赖 + 风险递进：

1. **#21 毕业触发**（最独立，1 个文件，0 UI 改动，最小风险）
2. **Notion 风格 token + 现有页面样式化**（不依赖 P0，但 P0 用新 token）
3. **#2 手动加题**（依赖 token）
4. **#19 考前模式**（依赖 token）
5. **M11 备份**（最大、最后做）

每完成一项 → 跑相关 vitest + 对应 E2E → commit。
全部完成 → 跑全套 vitest + 全套 Playwright → 最终 commit + push。
