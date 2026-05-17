use docx_rs::*;
use std::path::Path;

use super::types::{ExportQuestionInput, ExportMode, ExportRequest};
use super::layout::layout_questions;

pub fn generate_word(request: &ExportRequest, output_path: &Path) -> Result<(), String> {
    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut docx = Docx::new();

    // Title
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text(&request.title).bold().size(28))
            .align(AlignmentType::Center)
    );

    // Meta info
    let meta_text = format!(
        "学生: {} · 日期: {} · 共 {} 题",
        request.student_name,
        date_str,
        request.questions.len()
    );
    docx = docx.add_paragraph(
        Paragraph::new()
            .add_run(Run::new().add_text(meta_text).size(18))
            .align(AlignmentType::Center)
    );

    // Add a blank line
    docx = docx.add_paragraph(Paragraph::new());

    match request.mode {
        ExportMode::QuestionsOnly => {
            docx = render_questions_only(docx, &request.questions);
        }
        ExportMode::FullAnalysis => {
            docx = render_full_analysis(docx, &request.questions);
        }
    }

    let file = std::fs::File::create(output_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    docx.build().pack(file)
        .map_err(|e| format!("Word generation failed: {}", e))?;

    Ok(())
}

fn render_questions_only(mut docx: Docx, questions: &[ExportQuestionInput]) -> Docx {
    let rows = layout_questions(questions);

    for row in &rows {
        if row.len() == 2 {
            // Two-column table
            let mut table = Table::new(vec![
                TableRow::new(vec![
                    TableCell::new()
                        .add_paragraph(build_question_paragraph(row[0]))
                        .vertical_align(VAlignType::Top),
                    TableCell::new()
                        .add_paragraph(build_question_paragraph(row[1]))
                        .vertical_align(VAlignType::Top),
                ])
            ]);
            table = table.set_grid(vec![5000, 5000]);
            docx = docx.add_table(table);
        } else {
            docx = docx.add_paragraph(build_question_paragraph(row[0]));
        }
        docx = docx.add_paragraph(Paragraph::new());
    }

    docx
}

fn render_full_analysis(mut docx: Docx, questions: &[ExportQuestionInput]) -> Docx {
    for (idx, q) in questions.iter().enumerate() {
        // Question number and content
        docx = docx.add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text(format!("{}. {}", idx + 1, &q.content)).size(22))
        );

        // Correct answer
        if let Some(answer) = &q.correct_answer {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("正确答案: {}", answer)).size(20))
            );
        }

        // Student answer
        if let Some(answer) = &q.student_answer {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("学生答案: {}", answer)).size(20))
            );
        }

        // Error cause
        if let Some(cause_label) = &q.error_cause_label {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("错因: {}", cause_label)).size(20))
            );
        }

        // Knowledge points
        if !q.knowledge_points.is_empty() {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!(
                        "知识点: {}",
                        q.knowledge_points.join(", ")
                    )).size(20))
            );
        }

        // Chapter
        if let Some(chapter) = &q.chapter {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("章节: {}", chapter)).size(20))
            );
        }

        // Difficulty
        if let Some(diff_label) = &q.difficulty_label {
            docx = docx.add_paragraph(
                Paragraph::new()
                    .add_run(Run::new().add_text(format!("难度: {}", diff_label)).size(20))
            );
        }

        // Separator
        docx = docx.add_paragraph(
            Paragraph::new()
                .add_run(Run::new().add_text("─".repeat(50)).size(16))
        );
        docx = docx.add_paragraph(Paragraph::new());
    }

    docx
}

fn build_question_paragraph(q: &ExportQuestionInput) -> Paragraph {
    let mut para = Paragraph::new()
        .add_run(Run::new().add_text(format!("{}. {}", q.id, &q.content)).size(22));

    // Notes area
    para = para.add_run(Run::new().add_text("\n笔记区").size(18).italic());
    for _ in 0..5 {
        para = para.add_run(Run::new().add_text("\n_______________________________").size(16));
    }

    para
}
