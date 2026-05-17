use printpdf::*;
use std::path::Path;

use super::types::{ExportQuestionInput, ExportMode, ExportRequest};
use super::font::load_font_data;
use super::layout::layout_questions;

// A4 page size (f32 for printpdf)
const PAGE_W: f32 = 210.0;
const PAGE_H: f32 = 297.0;
const MARGIN: f32 = 20.0;
const CONTENT_W: f32 = PAGE_W - MARGIN * 2.0;

pub fn generate_pdf(request: &ExportRequest, output_path: &Path) -> Result<(), String> {
    let font_data = load_font_data().map_err(|e| format!("Font loading failed: {}", e))?;

    let (doc, first_page, first_layer) = PdfDocument::new(
        &request.title,
        Mm(PAGE_W),
        Mm(PAGE_H),
        "Layer 1",
    );

    let font = doc.add_external_font(std::io::Cursor::new(font_data))
        .map_err(|e| format!("Font embedding failed: {}", e))?;

    let mut state = PageState {
        doc,
        page_idx: first_page,
        layer_idx: first_layer,
    };

    // Header
    let date_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let header = format!(
        "{} · 学生: {} · 日期: {} · 共 {} 题",
        request.title,
        request.student_name,
        date_str,
        request.questions.len()
    );

    let mut y = draw_centered_text(&mut state, &header, 14.0, Mm(PAGE_H - MARGIN), &font);
    y = y - Mm(5.0);

    match request.mode {
        ExportMode::QuestionsOnly => {
            let rows = layout_questions(&request.questions);
            for row in &rows {
                if row.len() == 2 {
                    let col_width = (CONTENT_W - 5.0) / 2.0;
                    let y1 = draw_question_card(&mut state, row[0], 11.0, Mm(MARGIN), y, Mm(col_width), &font);
                    let y2 = draw_question_card(&mut state, row[1], 11.0, Mm(MARGIN + col_width + 5.0), y, Mm(col_width), &font);
                    y = y1.min(y2);
                } else {
                    y = draw_question_card(&mut state, row[0], 11.0, Mm(MARGIN), y, Mm(CONTENT_W), &font);
                }
                y = y - Mm(5.0);
            }
        }
        ExportMode::FullAnalysis => {
            for (idx, q) in request.questions.iter().enumerate() {
                let lines = wrap_text(&format!("{}. {}", idx + 1, &q.content), 50);
                for line in &lines {
                    y = draw_text(&mut state, line, 12.0, Mm(MARGIN), y, &font);
                }

                if let Some(answer) = &q.correct_answer {
                    y = draw_text(&mut state, &format!("正确答案: {}", answer), 10.0, Mm(MARGIN), y, &font);
                }

                if let Some(answer) = &q.student_answer {
                    y = draw_text(&mut state, &format!("学生答案: {}", answer), 10.0, Mm(MARGIN), y, &font);
                }

                if let Some(cause) = &q.error_cause_label {
                    y = draw_text(&mut state, &format!("错因: {}", cause), 10.0, Mm(MARGIN), y, &font);
                }

                if !q.knowledge_points.is_empty() {
                    let text = format!("知识点: {}", q.knowledge_points.join(", "));
                    let lines = wrap_text(&text, 55);
                    for line in &lines {
                        y = draw_text(&mut state, line, 10.0, Mm(MARGIN), y, &font);
                    }
                }

                if let Some(chapter) = &q.chapter {
                    y = draw_text(&mut state, &format!("章节: {}", chapter), 10.0, Mm(MARGIN), y, &font);
                }

                if let Some(diff) = &q.difficulty_label {
                    y = draw_text(&mut state, &format!("难度: {}", diff), 10.0, Mm(MARGIN), y, &font);
                }

                y = y - Mm(3.0);
                y = draw_text(&mut state, &"─".repeat(50), 8.0, Mm(MARGIN), y, &font);
                y = y - Mm(3.0);
            }
        }
    }

    let file = std::fs::File::create(output_path).map_err(|e| e.to_string())?;
    let mut buf_writer = std::io::BufWriter::new(file);
    state.doc.save(&mut buf_writer)
        .map_err(|e| format!("PDF save failed: {}", e))?;

    Ok(())
}

// Wrap text by character count
fn wrap_text(text: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();

    for ch in text.chars() {
        if current.chars().count() >= max_chars {
            lines.push(current);
            current = String::new();
        }
        current.push(ch);
    }

    if !current.is_empty() {
        lines.push(current);
    }

    lines
}

struct PageState {
    doc: PdfDocumentReference,
    page_idx: PdfPageIndex,
    layer_idx: PdfLayerIndex,
}

fn draw_text(state: &mut PageState, text: &str, size: f32, x: Mm, y: Mm, font: &IndirectFontRef) -> Mm {
    let min_y = Mm(MARGIN + size * 0.5);
    let mut current_y = y;

    if current_y < min_y {
        let (new_page, new_layer) = state.doc.add_page(Mm(PAGE_W), Mm(PAGE_H), "Layer 1");
        state.page_idx = new_page;
        state.layer_idx = new_layer;
        current_y = Mm(PAGE_H - MARGIN);
    }

    let layer = state.doc.get_page(state.page_idx).get_layer(state.layer_idx);
    layer.use_text(text, size, x, current_y, font);
    current_y - Mm(size * 0.5)
}

fn draw_centered_text(state: &mut PageState, text: &str, size: f32, y: Mm, font: &IndirectFontRef) -> Mm {
    let approx_width = text.chars().count() as f32 * size * 0.5;
    let x = Mm((PAGE_W - approx_width) / 2.0).max(Mm(MARGIN));
    draw_text(state, text, size, x, y, font)
}

fn draw_question_card(
    state: &mut PageState,
    q: &ExportQuestionInput,
    size: f32,
    x: Mm,
    y: Mm,
    width: Mm,
    font: &IndirectFontRef,
) -> Mm {
    let mut current_y = y;
    let max_chars = ((width.0 / size) * 2.0) as usize;

    // Question content
    let text = format!("{}. {}", q.id, &q.content);
    let lines = wrap_text(&text, max_chars.max(10));
    for line in &lines {
        current_y = draw_text(state, line, size, x, current_y, font);
    }

    // Notes area
    current_y = current_y - Mm(3.0);
    current_y = draw_text(state, "笔记区", size * 0.8, x, current_y, font);

    for _ in 0..5 {
        current_y = current_y - Mm(4.0);
        current_y = draw_text(state, "_______________________________", size * 0.7, x, current_y, font);
    }

    current_y
}
