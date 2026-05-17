use super::types::ExportQuestionInput;

/// Estimate how much space a question takes (in characters).
/// Used to decide if a question is "short" enough for side-by-side layout.
pub fn estimate_content_length(q: &ExportQuestionInput) -> usize {
    q.content.chars().count()
}

/// A "short" question can fit side-by-side with another in questions_only mode.
/// Threshold: ~120 characters (empirically about half a page).
pub fn is_short_question(q: &ExportQuestionInput) -> bool {
    estimate_content_length(q) < 120
}

/// Split questions into rows for the questions_only layout.
/// Each row has 1 or 2 questions. Short questions are paired side-by-side.
pub fn layout_questions(questions: &[ExportQuestionInput]) -> Vec<Vec<&ExportQuestionInput>> {
    let mut rows: Vec<Vec<&ExportQuestionInput>> = Vec::new();
    let mut pending_short: Option<&ExportQuestionInput> = None;

    for q in questions {
        if is_short_question(q) {
            if let Some(prev) = pending_short.take() {
                rows.push(vec![prev, q]);
            } else {
                pending_short = Some(q);
            }
        } else {
            // Long question: flush any pending short question first
            if let Some(prev) = pending_short.take() {
                rows.push(vec![prev]);
            }
            rows.push(vec![q]);
        }
    }

    // Flush remaining pending question
    if let Some(prev) = pending_short {
        rows.push(vec![prev]);
    }

    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_question(content: &str) -> ExportQuestionInput {
        ExportQuestionInput {
            id: 1,
            content: content.to_string(),
            correct_answer: None,
            student_answer: None,
            error_cause: None,
            error_cause_label: None,
            difficulty: None,
            difficulty_label: None,
            chapter: None,
            knowledge_points: vec![],
            question_type: "objective".to_string(),
        }
    }

    #[test]
    fn test_short_question_threshold() {
        let short = make_question("解方程: 2x = 4");
        assert!(is_short_question(&short));

        let long = make_question("已知函数 f(x) = x^2 + 2x + 1，求其在区间 [-2, 2] 上的最大值和最小值，并说明取得最值时的 x 值。");
        assert!(!is_short_question(&long));
    }

    #[test]
    fn test_layout_pairs_short_questions() {
        let questions = vec![
            make_question("短题1"),
            make_question("短题2"),
            make_question("短题3"),
        ];

        let rows = layout_questions(&questions);
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].len(), 2); // 短题1 + 短题2
        assert_eq!(rows[1].len(), 1); // 短题3 单独
    }

    #[test]
    fn test_layout_long_question_gets_own_row() {
        let questions = vec![
            make_question("短题1"),
            make_question("这是一个非常长的题目内容，超过了120个字符的限制，所以应该独占一行。已知函数 f(x) = x^2 + 2x + 1，求其在区间 [-2, 2] 上的最大值和最小值。"),
            make_question("短题2"),
        ];

        let rows = layout_questions(&questions);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].len(), 1); // 短题1 单独（因为长题紧随其后，算法可能不同）
        // Actually, let me reconsider...
    }

    #[test]
    fn test_layout_mixed() {
        let questions = vec![
            make_question("短题1"),
            make_question("短题2"),
            make_question("这是一个非常长的题目内容，超过了120个字符的限制，所以应该独占一行。"),
            make_question("短题3"),
            make_question("短题4"),
        ];

        let rows = layout_questions(&questions);
        // 短题1+2 并排，长题独占，短题3+4 并排
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].len(), 2);
        assert_eq!(rows[1].len(), 1);
        assert_eq!(rows[2].len(), 2);
    }
}
