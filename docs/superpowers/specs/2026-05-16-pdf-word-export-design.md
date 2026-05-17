# PDF/Word 导出功能设计文档

> 路线 A 第 2 部分：真实文件导出（PDF + Word）

## 目标

将现有浏览器打印功能升级为真实 PDF/Word 文件导出，支持练习卷和错题本两种内容、仅原题/完整分析两种模式。

## 功能范围

| 页面 | 导出内容 | 格式 | 触发方式 |
|------|---------|------|---------|
| PracticePage | 练习卷（已选择题） | PDF / Word | 替换"生成并打印"为导出按钮组 |
| QuestionsPage | 错题本（可按章节筛选） | PDF / Word | 新增批量导出按钮 |

## 技术方案

Rust 后端生成：
- PDF: `genpdf` crate
- Word: `docx-rs` crate

前端通过 Tauri invoke 调用，Tauri `dialog::save` API 选择保存路径。

## 后端架构

```
src-tauri/src/
  export/
    mod.rs        # 公共接口
    types.rs      # 导出数据结构
    font.rs       # 字体加载（平台检测 + fallback）
    layout.rs     # 排版辅助（高度估算、卡片拆分）
    pdf.rs        # PDF 生成
    word.rs       # Word 生成
  commands/
    export.rs     # Tauri commands
```

## 数据流

1. 前端收集 `question_ids + mode + format + title`
2. Tauri invoke → Rust command
3. Rust 查询数据库获取题目完整数据（含知识点标签）
4. 按 mode 组装内容 → 生成文件 → 保存到用户指定路径
5. 返回 `Ok(路径)` 或 `Err(信息)`

## 字体策略

运行时检测平台，按优先级加载系统字体：
- macOS: `/System/Library/Fonts/PingFang.ttc`
- Windows: `C:\Windows\Fonts\msyh.ttc`
- Fallback: 应用 resources 中打包文泉驿微米黑

找不到系统字体时自动 fallback，保证中文始终可渲染。

## PDF 排版（genpdf）

- A4 纵向，2cm 边距
- 标题区：学生名 · 日期 · 标题 · 共 N 题
- 仅原题模式：2 列表格，短题（<120 字符）并排，长题跨列独占，底部笔记区（虚线横线 5 行）
- 完整分析模式：每题连续排列，题目 → 正确答案 → 错因 → 知识点 → 分割线

## Word 排版（docx-rs）

同 PDF 结构，用段落样式和表格实现两列布局。

## 前端改动

- PracticePage: "生成并打印" → `[导出 PDF | 导出 Word]` 按钮组
- QuestionsPage: 新增"批量导出"按钮
- 导出时显示"生成中..."提示

## 测试策略

- Rust: 单元测试排版逻辑（高度估算、拆分）
- 集成测试：生成文件验证大小 > 0
