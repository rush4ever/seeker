import { useEffect, useState, useRef } from "react";
import { useKnowledgeGraph } from "../../hooks/useKnowledgeGraph";
import KnowledgeTree from "../graph/KnowledgeTree";
import { getDb } from "../../lib/db";
import { buildExamPrepQuery } from "../../lib/examPrep";
import ExportButtonGroup from "../export/ExportButtonGroup";
import type { Question, Subject } from "../../types";

interface Props {
  studentId: number;
  subject: Subject;
  selectedKps: Set<number>;
  onToggleKp: (id: number) => void;
  questions: Question[];
  onQuestionsChange: (qs: Question[]) => void;
  studentName: string;
}

export default function ExamPrepPanel({
  studentId,
  subject,
  selectedKps,
  onToggleKp,
  questions,
  onQuestionsChange,
  studentName,
}: Props) {
  const { tree } = useKnowledgeGraph({ studentId, subject });
  const [loading, setLoading] = useState(false);
  // Use a ref to dedupe identical Set contents across React re-renders, since
  // referential equality of Set isn't reliable in a useEffect dep array.
  const lastKey = useRef<string>("");

  useEffect(() => {
    const key = Array.from(selectedKps).sort((a, b) => a - b).join(",");
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (selectedKps.size === 0) {
      onQuestionsChange([]);
      return;
    }

    setLoading(true);
    (async () => {
      const { sql, params } = buildExamPrepQuery(
        studentId,
        Array.from(selectedKps)
      );
      const db = await getDb();
      const rows = await db.select<Question[]>(sql, params);
      onQuestionsChange(rows);
      setLoading(false);
    })();
    // onQuestionsChange / studentId are referentially stable enough for this use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, selectedKps]);

  return (
    <div className="flex gap-4 flex-1 min-h-0">
      <div className="w-72 overflow-auto notion-card">
        <h3 className="text-sm font-medium mb-2">选择知识点</h3>
        {tree.length === 0 ? (
          <p className="text-xs text-notion-subtle">暂无知识点</p>
        ) : (
          <KnowledgeTree
            tree={tree}
            multiSelect
            selectedIds={selectedKps}
            onToggle={onToggleKp}
            onSelect={() => {}}
          />
        )}
      </div>
      <div className="flex-1 overflow-auto space-y-3">
        <div className="text-xs text-notion-muted">
          {loading
            ? "加载中…"
            : `已选 ${selectedKps.size} 个知识点 / 共 ${questions.length} 道错题`}
        </div>
        {questions.length > 0 && (
          <ExportButtonGroup
            questions={questions}
            studentName={studentName}
            mode="questions_only"
            title="考前复习卷"
          />
        )}
        <div className="space-y-1">
          {questions.map((q) => (
            <div key={q.id} className="notion-card text-sm">
              <span className="text-notion-muted mr-2">
                {q.chapter ?? "未分类"}
              </span>
              {q.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
