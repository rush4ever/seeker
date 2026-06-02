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

        // 120 字符以上才算"长"题
        let long = make_question(
            "已知函数 f(x) = x^2 + 2x + 1，求其在区间 [-2, 2] 上的最大值和最小值，\
             并说明取得最值时的 x 值，进一步分析该函数的单调性与极值点的关系，\
             最后画出函数图像并标注关键点。这是一个综合性的函数题目，\
             涉及配方法、求导与端点分析等多项技能，需要写出完整规范的解答过程。",
        );
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
        let long = make_question(
            "已知函数 f(x) = x^2 + 2x + 1，求其在区间 [-2, 2] 上的最大值和最小值，\
             并说明取得最值时的 x 值，进一步分析该函数的单调性与极值点的关系，\
             最后画出函数图像并标注关键点。这是一个综合性的函数题目，\
             涉及配方法、求导与端点分析等多项技能，需要写出完整规范的解答过程。",
        );
        let questions = vec![
            make_question("短题1"),
            long,
            make_question("短题2"),
        ];

        let rows = layout_questions(&questions);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].len(), 1); // 短题1 单独
        assert_eq!(rows[1].len(), 1); // 长题独占
        assert_eq!(rows[2].len(), 1); // 短题2 单独
    }

    #[test]
    fn test_layout_mixed() {
        let long = make_question(
            "已知函数 f(x) = x^2 + 2x + 1，求其在区间 [-2, 2] 上的最大值和最小值，\
             并说明取得最值时的 x 值，进一步分析该函数的单调性与极值点的关系，\
             最后画出函数图像并标注关键点。这是一个综合性的函数题目，\
             涉及配方法、求导与端点分析等多项技能，需要写出完整规范的解答过程。",
        );
        let questions = vec![
            make_question("短题1"),
            make_question("短题2"),
            long,
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
