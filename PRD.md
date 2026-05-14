# PRD: 错题分析系统（Wrong Question Analysis System）

## Problem Statement

家长希望为孩子（现初二，使用苏科版教材）构建一套错题分析系统，帮助孩子从错题中系统性地提取知识点、建立知识图谱、定位薄弱环节、生成针对性练习，并长期积累迭代至高中毕业。

当前痛点：
- 学校智慧学习平台导出的错题以 Word 文档形式存在，散落在微信中，难以系统管理
- 错题仅被简单收集，缺乏深度分析（错因归类、知识点关联、薄弱点追踪）
- 没有针对性的相似题练习和科学的复习调度机制
- 传统错题本手动整理耗时，难以坚持到高中毕业
- 现有学习类 App 界面杂乱、游戏化干扰多、不适合长期专注使用

## Solution

一套基于 Tauri 的跨平台桌面应用（Mac/Windows），核心循环：

```
导入错题（Word） → AI 分析（知识点抽取 + 错因分析） → 挂接知识图谱
       ↑                                                    ↓
  批改记录 ← 拍照上传答案 ← 打印练习 ← 生成相似题（LLM）
```

长期价值：知识图谱从"红色（薄弱）"到"绿色（掌握）"的可视化成长轨迹，配合掌握度百分比、每周小结、考试预测等数据激励，让孩子看到自己的进步。

### 输入格式（已验证）

智慧学习平台导出的 Word 文档结构：

```
标题: 邵瀚文-数学错题集-20260514

┌─────────────────────────────────────────────────────────────────┐
│ [原错题]  1 (客观题)  10.4.2分式的乘除（2）   答题时间: 2026-05-14 │
├─────────────────────────────────────────────────────────────────┤
│ 题目内容（含文字、公式图片、图表图片）                              │
│ A. ...  B. ...  C. ...  D. ...                                   │
└─────────────────────────────────────────────────────────────────┘

...（多道错题）...

参考答案
1【原错题参考答案】 C
2【原错题参考答案】 ab
...
```

每道题包含：序号、题型（客观题/主观题）、章节来源、答题日期、题目内容（文字+图片）、参考答案。

## User Stories

### 导入与分析

1. 作为家长，我想将微信中的 Word 错题文档拖入系统，系统自动解析并提取所有错题，这样我就不用手动录入。
2. 作为学生，我想在系统无法自动解析某道题时手动添加错题（拍照+文字输入），这样就不会遗漏任何错题。
3. 作为学生，我想系统导入错题后自动清理杂乱格式（多余空行、奇怪字体、页眉页脚）、将公式图片渲染为 LaTeX、调整图片大小，这样导出的错题排版美观。
4. 作为学生，我想导入错题后 AI 自动分析这道题涉及的知识点，并匹配到知识图谱的对应节点，这样我能看到错题在知识体系中的位置。
5. 作为学生，我想 AI 自动分析我的错误原因（概念不清/计算错误/审题失误/粗心/完全不会），这样我能精准定位问题所在。
6. 作为家长，我想在 AI 自动分析后快速确认或修正知识点匹配和错因分析的结果，这样能保证知识图谱的准确性。

### 知识图谱

7. 作为学生，我想看到一个可视化的知识图谱，掌握的知识点显示绿色，薄弱的显示红色，这样我能直观地知道自己哪里强哪里弱。
8. 作为学生，我想点击知识图谱上的红色节点，系统能生成针对该知识点的练习题，这样我能集中攻克薄弱环节。
9. 作为学生，我想知识图谱覆盖从初二到高三的全部内容（苏科版），这样我能看到自己的长期成长轨迹。
10. 作为学生，我想知识图谱默认显示当前年级的内容，但也能查看历史和未来的知识点，这样既有聚焦又有全局视野。
11. 作为家长，我想看到孩子知识图谱的整体变化趋势，这样我能了解孩子的学习进展。

### 练习与批改

12. 作为学生，我想系统根据我的薄弱知识点自动生成相似练习题，并导出为 PDF/Word 打印出来，这样我能在纸上手写做题（最自然的方式）。
13. 作为学生，我想导出的练习卷排版自适应（短题并排、长题独占一页），并且每页底部预留笔记区，这样裁剪贴到错题本后方便手写补充。
14. 作为学生，我想导出练习卷时选择两种模式：仅原题（用于裁剪贴错题本）或完整分析（原题+错答+正答+错因+思路+知识点标签），这样满足不同场景需求。
15. 作为学生，做完练习题后我想拍照上传答案，系统自动批改选择题/填空题/简单计算题，这样能快速得到反馈。
16. 作为学生，对于复杂解答题/证明题，我想系统给出参考答案和评分要点，我对照自评后系统记录结果，这样既能获得指导又保持自主性。
17. 作为学生，我想批量拍照上传多道题的答案，系统逐题批改，这样提高效率。

### 复习与掌握度

18. 作为学生，我想系统每天主动推送一个"5 分钟薄弱点快练"（基于当前最薄弱的知识点），这样我能利用碎片时间巩固。
19. 作为学生，我想考前能手动圈选考试范围（如"下周月考：第 3-5 章"），系统自动从该范围的错题和相似题中生成一份复习卷，这样我能针对性备考。
20. 作为学生，我想每道知识点有一个掌握度百分比（0-100%），基于错题率、相似题正确率、最近一次做对时间综合计算，这样我能量化自己的掌握程度。
21. 作为学生，我想当某知识点的掌握度达到 90% 以上时，该错题"毕业"进入月度保底复习（每月抽一道验证），这样已掌握的题不会频繁打扰。
22. 作为学生，我想看到知识图谱上的节点从红色逐渐变黄再变绿的过程，这样我能获得成就感。

### 数据统计与激励

23. 作为学生，我想每周看到一份小结（"本周攻克了 3 个薄弱点，数学掌握度提升 8%"），这样我能感受到持续进步。
24. 作为学生，我想系统根据错题分布预测"下周考试最可能丢分的 3 个知识点"，这样我能提前针对性复习。
25. 作为学生，我想看到统计数据（累计消灭错题数、本周练习时长、各知识点掌握度变化曲线），这些数据本身就是激励。
26. 作为家长，我想看到孩子的学习报告（掌握度趋势、薄弱点分布、练习频率），这样我能适时给予支持。

### 错题本导出

27. 作为学生，我想将错题以精美的排版导出为 PDF 或 Word，裁剪后贴到实体错题本上，这样满足学校可能的要求。
28. 作为学生，我想批量导出某章节的所有错题（仅原题模式），一键生成"第 5 章错题集"，这样节省整理时间。
29. 作为家长，我想每学期末导出一份完整的错题分析报告 PDF 归档保存，这样留下学习档案。

### 多学生与年级管理

30. 作为家长，我想在同一个系统中管理多个孩子的错题数据，通过下拉菜单切换学生档案，这样一台电脑满足全家需求。
31. 作为学生，我想系统自动按开学日期推进年级（初二→初三→高中），知识点树自动扩展，这样我不需要手动调整。
32. 作为家长，我想在必要时手动调整孩子的当前年级和学期，这样能与实际学习进度同步。
33. 作为学生，我想系统根据我实际错题覆盖的知识点自动标记"已学/未学"，即使年级自动推进了，未学过的知识点不会提前出现，这样不会超前焦虑。

### 备份与数据安全

34. 作为家长，我想系统自动每天将数据备份到同步盘（iCloud/OneDrive/Dropbox），这样换电脑或意外损坏时数据不会丢失。
35. 作为家长，我想系统每次退出时保留最近 10 个版本的本地快照，这样误操作后可以恢复。
36. 作为家长，我想数据完全存储在本地，不出本机，这样保护孩子的隐私。

### 系统体验

37. 作为学生，我想首次安装后系统自带 5-10 道示例错题和完整的知识图谱演示，这样我能秒懂系统是干嘛的。
38. 作为学生，我想系统引导我导入第一道自己的错题，走完完整流程（导入→分析→生成练习→打印→拍照批改），这样快速建立肌肉记忆。
39. 作为学生，我想系统界面清新简洁，打开就是大按钮"今日薄弱点快练"，没有杂乱信息和游戏化干扰，这样我能专注学习。
40. 作为家长，我想系统在学生模式下不暴露复杂的管理功能，在我的模式下能看到所有数据和设置，这样分工清晰。
41. 作为非技术家长，我想系统首次启动时自动检测 Ollama 和模型是否安装，未安装则自动引导下载（先下载 7B 快速可用，后台再下载 32B），这样我自己就能完成部署。
42. 作为用户，我想系统能自动检测新版本并静默更新，这样长期使用中始终获得最新功能和知识点树更新。

## Implementation Decisions

### 技术架构

- **框架**: Tauri（Rust 后端 + Web 前端）。跨平台支持 Mac/Windows，包体小、启动快。
- **前端**: Web 技术栈（推荐 React + TypeScript），UI 自由度极高，易做出清新界面。
- **数据库**: SQLite 本地文件，单库多学生（`student_id` 字段隔离）。Tauri 通过 `tauri-plugin-sql` 访问。
- **本地 AI**: Ollama 运行本地大模型。MVP 推荐 Qwen2.5-32B 或 DeepSeek-R1-32B（用户硬件：M3 Max 36GB + RTX 4090 32GB，完全胜任）。首次启动先拉 7B 模型快速可用，后台继续拉 32B。
- **自动更新**: Tauri updater 通过 GitHub Releases 分发更新。

### 核心模块设计

#### 1. Word Parser（Word 文档解析器）

**职责**: 解析智慧学习平台导出的 `.docx` 文件，提取结构化错题数据。

**输入**: `.docx` 文件（如 `邵瀚文-数学错题集-20260514.docx`）
**输出**: 结构化 JSON 数组，每道题包含：
- `number`: 序号
- `type`: "objective" | "subjective"
- `chapter`: 章节来源（如 "10.4.2分式的乘除（2）"）
- `date`: 答题日期
- `content`: 题目内容（HTML/Markdown，含图片引用）
- `images`: 图片数组（公式图、图表图），每图含 binary data 和位置信息
- `answer`: 参考答案（从文档末尾"参考答案"区块提取）
- `options`: 选项数组（仅客观题）

**关键挑战**:
- Word 中的数学公式以 OMML/图片形式嵌入，需要提取并尽可能转换为 LaTeX（用于后续渲染和 LLM 分析）。转换失败的保留为图片。
- 图表（实验装置图、几何图等）作为图片保留，用于显示和 LLM 分析（多模态）。
- 文档结构为"题目区块 + 末尾参考答案区块"，需要按序号匹配。

#### 2. Image Processor（图片处理器）

**职责**: 处理 Word 中嵌入的所有图片（公式图、图表图）。

**功能**:
- 提取 `.docx` 中的图片资源（`word/media/` 下的 PNG/JPG/EMF 等）
- 公式图片：尝试 OCR/LaTeX 识别转换为文本公式；失败则保留图片 + base64
- 图表图片：保留原图，用于题目展示和 LLM 多模态分析
- 图片压缩和统一尺寸（导出时自适应排版）

#### 3. Knowledge Point Extractor（知识点抽取器）

**职责**: 使用 LLM 从错题中抽取知识点，匹配到预置知识树。

**输入**: 单道错题的完整内容（文字 + 图片）
**输出**:
- `knowledgePoints`: 知识点列表（如 ["分式的乘除", "分式化简", "约分"]）
- `difficulty`: 难度评估（easy/medium/hard）
- `errorCause`: 错因分析（概念不清/计算错误/审题失误/粗心/完全不会）

**实现**:
- 调用本地 LLM（Ollama API），prompt 包含预置知识树的子集（同章节知识点）作为上下文，要求 LLM 从中选择最匹配的知识点，必要时提出新知识点。
- 多模态支持：将题目图片（公式图、图表图）一并传给支持视觉的模型（如 Qwen2.5-VL）。

#### 4. Knowledge Graph Engine（知识图谱引擎）

**职责**: 管理知识图谱的数据结构和查询。

**数据模型**:
- `knowledge_nodes` 表：知识点节点（id, name, grade, semester, subject, chapter, parent_id, is_preset）
- `knowledge_edges` 表：知识点关系（from_id, to_id, relation_type: prerequisite|related|subtopic）
- `question_knowledge` 表：错题-知识点关联（question_id, knowledge_id, confidence）
- `mastery` 表：掌握度记录（student_id, knowledge_id, score, last_updated, review_count, correct_streak）

**预置数据**: 苏科版初二至高三数学+物理知识点树，按年级-学期-章节-知识点层级组织。以人教版数据为参考底稿，人工调整为苏科版章节顺序和命名。

**核心算法**:
- 掌握度计算：`score = f(错题率, 相似题正确率, 最近一次做对时间, 复习间隔)`，0-100%
- 知识点关联：LLM 抽取后先匹配预置节点（fuzzy match + 语义相似度），匹配失败则创建动态节点并挂接到最近的主干节点下。

#### 5. Similar Question Generator（相似题生成器）

**职责**: 基于错题生成相似练习题。

**输入**: 错题内容 + 关联知识点 + 期望题型/难度
**输出**: 1-3 道相似题（文字 + 图片），每题含标准答案和解析

**策略**:
- MVP 阶段纯 LLM 生成：prompt 要求"基于原题改数字/改情境/反转问法，保持知识点和难度一致"
- 生成后 LLM 自检（再算一遍验证答案正确性）
- 如果自检发现矛盾，标记为"待校验"，提醒用户
- Phase 2 引入本地题库，优先从题库匹配，题库没有时 LLM 兜底

#### 6. Practice Sheet Exporter（练习卷导出器）

**职责**: 将练习题或错题导出为可打印的 PDF/Word。

**两种模式**:
- **仅原题模式**: 适合裁剪贴错题本。单题单页，页面底部预留笔记区（空白横线），无答案无解析。
- **完整分析模式**: 适合复习归档。包含原题、错误答案、正确答案、错因分析、解题思路、知识点标签。自适应排版（短题并排，长题独占）。

**技术**: Rust 端使用 `printpdf` 或 `genpdf` 库生成 PDF；Word 导出使用 `docx-rs` 库。

#### 7. Answer Grader（答案批改器）

**职责**: 评判学生上传的手写答案。

**流程**:
1. 接收拍照上传的图片
2. OCR 提取手写文字/公式（本地模型或 Ollama + 视觉模型）
3. 与标准答案对比：
   - 选择题/填空题/简单计算题：直接字符串/数值匹配，AI 自动判对错
   - 复杂解答题/证明题：AI 给出参考答案和评分要点，学生对照自评（选择"完全正确/部分正确/错误"），系统记录

**输入存储**: 答案图片保存到本地文件系统，OCR 结果存入 `answers` 表。

#### 8. Review Scheduler（复习调度器）

**职责**: 决定什么时候复习哪道错题/哪个知识点。

**算法**:
- **薄弱点快练**: 每天选取掌握度最低的 1-3 个活跃知识点，每个生成 1 题，组成"5 分钟快练"
- **毕业机制**: 掌握度 > 90% 的错题移入"月度保底复习池"，每月随机抽 1 道验证
- **考前模式**: 根据用户圈选的章节范围，从该范围错题中按"掌握度从低到高"排序，优先选取薄弱题生成复习卷
- **优先级公式**: `priority = (1 - mastery_score) * recency_weight * importance_weight`

#### 9. Mastery Tracker（掌握度追踪器）

**职责**: 计算和维护每个知识点的掌握度百分比。

**计算公式**（可调整）:
```
mastery = base_score * decay_factor + recent_bonus

base_score = (相似题正确数 / 相似题总数) * 100
decay_factor = exp(-days_since_last_correct / 30)  // 30天半衰期
recent_bonus = +10 if last_3_practices_all_correct else 0
```

#### 10. Stats & Reporting（统计报告器）

**职责**: 生成统计数据和报告。

**输出**:
- 每周小结：攻克薄弱点数、掌握度变化、练习频率
- 考试预测：基于当前错题分布，预测考试范围内最可能丢分的知识点 Top 3
- 长期统计：累计错题数、消灭数、各知识点掌握度曲线、学科对比

#### 11. Backup Manager（备份管理器）

**职责**: 数据备份和恢复。

**功能**:
- 自动备份：检测用户配置的同步盘文件夹（iCloud/OneDrive/Dropbox），每天或每次退出时复制 `.db` 文件
- 本地快照：每次退出保留最近 10 个版本的 `.db` 文件（轮转）
- 学期末归档：提供"导出学期报告 PDF"功能（所有错题的完整分析模式汇总）
- 恢复：从同步盘备份恢复 `.db` 文件

#### 12. Student Profile Manager（学生档案管理器）

**职责**: 多学生支持和年级管理。

**功能**:
- 学生档案 CRUD（姓名、当前年级、当前学期、教材版本）
- 年级自动推进：基于开学日期（默认 9 月 1 日升年级），自动扩展可见知识点树
- 个人进度追踪：根据实际错题覆盖的知识点，标记"已学/未学"，与年级推进独立

#### 13. UI Layer（界面层）

**双角色设计**:

**学生模式**（默认）:
- 首页：大按钮"今日薄弱点快练" + 薄弱点 Top 3 卡片 + 知识图谱缩略图
- 错题本：按时间/知识点/掌握度筛选的错题列表
- 知识图谱：可交互的力导向图/树状图，点击节点进入针对性练习
- 练习页面：生成练习卷 → 预览 → 导出 PDF/Word → 打印
- 上传批改：拖拽/选择照片 → AI 批改 → 结果确认
- 统计页面：掌握度趋势、本周小结

**家长模式**:
- 仪表盘：所有孩子的掌握度概览、薄弱点分布、练习频率
- 可下钻查看具体错题、错因、练习记录
- 系统设置：学生档案管理、年级调整、备份配置、模型配置

**设计原则**: 清新简洁、信息层级清晰、重点突出、无游戏化元素、无社交功能。

### 数据库 Schema（核心表）

```sql
-- 学生档案
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  current_grade INTEGER, -- 8=初二, 9=初三, 10=高一...
  current_semester INTEGER, -- 1 or 2
  textbook_version TEXT DEFAULT '苏科版',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 错题
CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  subject TEXT CHECK(subject IN ('math', 'physics')),
  source_type TEXT, -- 'word_import' | 'manual'
  source_file TEXT, -- 原始文件名
  number_in_source INTEGER, -- 在原文档中的序号
  question_type TEXT CHECK(question_type IN ('objective', 'subjective')),
  chapter TEXT, -- 章节来源
  answer_date DATE,
  content TEXT, -- 题目内容（Markdown/HTML）
  content_images TEXT, -- JSON 数组：图片路径列表
  student_answer TEXT, -- 学生的错误答案（手动输入或 OCR）
  correct_answer TEXT, -- 正确答案
  error_cause TEXT CHECK(error_cause IN ('concept', 'calculation', 'careless', 'misread', 'unknown')),
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  mastery_score REAL DEFAULT 0, -- 0-100
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'graduated', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 知识点节点
CREATE TABLE knowledge_nodes (
  id INTEGER PRIMARY KEY,
  subject TEXT,
  grade INTEGER,
  semester INTEGER,
  chapter TEXT,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES knowledge_nodes(id),
  is_preset INTEGER DEFAULT 1,
  description TEXT
);

-- 错题-知识点关联
CREATE TABLE question_knowledge (
  question_id INTEGER REFERENCES questions(id),
  knowledge_id INTEGER REFERENCES knowledge_nodes(id),
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (question_id, knowledge_id)
);

-- 掌握度历史
CREATE TABLE mastery_history (
  id INTEGER PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  knowledge_id INTEGER REFERENCES knowledge_nodes(id),
  score REAL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 练习记录
CREATE TABLE practice_sessions (
  id INTEGER PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  session_type TEXT CHECK(session_type IN ('daily', 'exam_prep', 'ad_hoc')),
  target_knowledge_ids TEXT, -- JSON 数组
  generated_questions TEXT, -- JSON：生成的相似题
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 答题记录
CREATE TABLE practice_answers (
  id INTEGER PRIMARY KEY,
  session_id INTEGER REFERENCES practice_sessions(id),
  question_id INTEGER REFERENCES questions(id),
  generated_question_index INTEGER, -- 如果是相似题，记录是第几道
  answer_image_path TEXT, -- 拍照上传的答案图片
  ocr_result TEXT, -- OCR 识别结果
  is_correct INTEGER, -- 0=错, 1=对, 2=部分对, 3=待自评
  self_assessment TEXT, -- 自评备注
  graded_at TIMESTAMP
);

-- 复习调度
CREATE TABLE review_schedule (
  id INTEGER PRIMARY KEY,
  student_id INTEGER REFERENCES students(id),
  question_id INTEGER REFERENCES questions(id),
  scheduled_at DATE,
  completed_at TIMESTAMP,
  priority REAL
);
```

### 本地 LLM 配置

**推荐模型**:
- Qwen2.5-32B-Instruct（数学和中文理解强）
- DeepSeek-R1-32B（推理能力强，适合解题思路生成）
- 二选一即可，用户硬件（M3 Max 36GB / RTX 4090 32GB）可流畅运行

**模型用途分工**:
- 知识点抽取 + 错因分析：32B 主模型
- 相似题生成：32B 主模型（prompt 要求生成后自检）
- 答案批改（OCR 后比对）：32B 主模型
- 考试预测 + 统计报告生成：7B 快速模型即可

**首次安装流程**:
1. 系统检测 Ollama 是否安装
2. 未安装：弹出图文引导，提供下载链接和安装步骤
3. 检测模型是否已下载
4. 未下载：显示进度条，先 `ollama pull qwen2.5:7b`（快速可用）
5. 后台继续 `ollama pull qwen2.5:32b`（完整能力）
6. 32B 下载完成后自动切换

## Testing Decisions

### 测试原则

- **只测外部行为，不测实现细节**：模块的接口和输出是测试对象，内部算法实现不直接测。
- **核心模块必须有单元测试**： especially 数据解析、掌握度计算、复习调度等纯逻辑模块。
- **LLM 相关功能用集成测试**：由于 LLM 输出非确定性，测试重点是"prompt 模板正确"和"输出能被解析"，而非具体输出内容。

### 需要测试的模块

1. **Word Parser**:
   - 测试用例：使用真实样本文件（数学 12 题、物理 39 题）验证解析准确性
   - 断言：提取的题目数、每道题的字段完整性、参考答案匹配正确性
   - 测试图片提取数量和类型

2. **Knowledge Graph Engine**:
   - 测试用例：掌握度计算公式的边界条件（全对、全错、部分对、长期未复习）
   - 测试用例：知识点匹配的 fuzzy match 逻辑
   - 测试用例：毕业机制触发条件

3. **Review Scheduler**:
   - 测试用例：不同掌握度分布下的每日推荐结果
   - 测试用例：考前模式圈选范围后的题目筛选
   - 测试用例：毕业题目不会出现在日常推荐中

4. **Practice Sheet Exporter**:
   - 测试用例：两种导出模式的输出结构验证
   - 测试用例：自适应排版逻辑（短题并排、长题独占）

5. **Backup Manager**:
   - 测试用例：备份文件创建、轮转、恢复

6. **LLM 集成层**（集成测试）:
   - 测试用例：prompt 渲染正确（模板变量替换）
   - 测试用例：LLM 输出 JSON 能被正确解析
   - 测试用例：LLM 不可用时降级到 7B 模型的逻辑

### 测试框架

- **Rust 后端**: 使用内置测试框架 `cargo test`
- **前端**: Vitest + React Testing Library（测组件渲染和用户交互）
- **E2E**: Tauri 的 WebDriver 测试或 Playwright（测完整用户流程）

## Out of Scope

以下功能明确不在当前 PRD 范围内：

1. **视频/音频课程**：系统不是学习平台，不提供教学内容。
2. **社交功能**：无排行榜、无分享、无社区、无家长群。
3. **全学科同时铺开**：MVP 仅数学+物理，英语、语文、化学等后续扩展。
4. **纸质错题 OCR 自动识别**：Word 导入为主，拍照仅用于上传手写答案和手动添加错题。
5. **第三方在线题库付费对接**：本地 LLM 生成 + 自建题库，不依赖外部付费 API。
6. **实时 AI 答疑/对话**：不是通用问答助手，仅聚焦错题分析闭环。
7. **游戏化元素**：无积分、无徽章、无连续打卡、无等级系统。数据激励替代游戏化。
8. **手机/iPad App**：第一阶段仅桌面端（Mac/Windows），移动端后续规划。
9. **云端数据存储**：所有数据本地存储，不出本机。
10. **多语言支持**：仅中文。
11. **教师/学校管理端**：仅家庭使用场景。

## Further Notes

### 关于 Word 公式处理

智慧学习平台导出的 Word 文档中，数学公式以 OMML（Office Math Markup Language）或图片形式嵌入。解析策略：
- 优先尝试 OMML → LaTeX 转换（使用 `omml2mathml` 或类似库），转换后的 LaTeX 用于前端渲染（MathJax/KaTeX）和 LLM 分析（纯文本输入更省 token）。
- 转换失败或本身就是图片的公式，保留图片，LLM 分析时作为多模态输入（如果模型支持视觉）或 OCR 辅助识别。
- 物理图表、几何图等一律保留图片，用于展示和 LLM 视觉分析。

### 关于知识图谱可视化

初期使用 D3.js 或 ECharts 的力导向图/树状图实现。节点大小表示该知识点下错题数量，颜色表示掌握度（红→黄→绿）。点击节点可下钻查看子知识点或进入练习。

### 关于错题导出排版优化

"优化排版"具体包括：
1. 去除原 Word 中的页眉页脚、装饰图片、多余空行
2. 统一字体（正文宋体/黑体，公式 KaTeX 渲染）
3. 公式图片转换为 LaTeX 渲染
4. 图表自适应宽度，不超过页面边距
5. 客观题选项重新排版（A/B 在上，C/D 在下，或四列并排）
6. 题目间距统一，留白适度

### 关于苏科版知识点树

初始知识点树由 LLM 一次性生成（基于苏科版教材目录），人工校验后作为内置种子数据。数据结构支持版本号，教材改版时可更新。

### 关于多学生的数据隔离

SQLite 单库，所有表通过 `student_id` 字段隔离。查询时自动附加 `WHERE student_id = ?` 条件。学生切换时重新加载该学生的全部状态。

### 关于长期迭代

系统设计为可迭代 6 年（初二至高三毕业）。关键设计决策支持长期性：
- SQLite 数据库可承载数万条记录，性能无压力
- 知识点树预置全学段，年级推进时只是"解锁"更多节点
- 掌握度历史表记录所有变化，支持长期趋势分析
- 备份机制确保 6 年数据不丢失
- 自动更新机制确保软件持续迭代
