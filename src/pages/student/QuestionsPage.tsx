import { useState, useRef, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { useQuestions } from "../../hooks/useQuestions";
import { parseWordDocument } from "../../lib/wordParser";
import type { Question, Subject } from "../../types";
import { FileUp, Filter, Trash2, BookOpen } from "lucide-react";

function subjectLabel(s: Subject): string {
  return s === "math" ? "数学" : "物理";
}

function typeLabel(t: string): string {
  return t === "objective" ? "客观题" : "主观题";
}

export default function QuestionsPage() {
  const { currentStudent } = useApp();
  const { questions, loading, addQuestions, remove } = useQuestions(currentStudent?.id);
  const [importing, setImporting] = useState(false);
  const [filterSubject, setFilterSubject] = useState<Subject | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredQuestions = questions.filter((q) =>
    filterSubject === "all" ? true : q.subject === filterSubject
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentStudent) return;

      setImporting(true);
      try {
        const result = await parseWordDocument(file);
        const subject: Subject = file.name.includes("物理") ? "physics" : "math";

        const newQuestions = result.questions.map((q) => ({
          student_id: currentStudent.id,
          subject,
          source_type: "word_import" as const,
          source_file: file.name,
          number_in_source: q.number,
          question_type: q.type,
          chapter: q.chapter,
          answer_date: q.answerDate,
          content: q.content,
          content_images: null,
          student_answer: null,
          correct_answer: q.correctAnswer,
          error_cause: null,
          difficulty: null,
          mastery_score: 0,
          status: "active" as const,
        }));

        await addQuestions(newQuestions);
      } catch (err) {
        alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [currentStudent, addQuestions]
  );

  if (!currentStudent) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <BookOpen size={48} className="mb-4" />
        <p className="text-lg">请先在左侧选择一个学生</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          错题本 ({filteredQuestions.length} 道)
        </h2>
        <div className="flex items-center gap-3">
          {/* Subject filter */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value as Subject | "all")}
              className="text-sm outline-none bg-transparent"
            >
              <option value="all">全部</option>
              <option value="math">数学</option>
              <option value="physics">物理</option>
            </select>
          </div>

          {/* Import button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <FileUp size={16} />
            {importing ? "导入中..." : "导入 Word"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">加载中...</div>
      ) : filteredQuestions.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <BookOpen size={48} className="mx-auto mb-4" />
          <p>暂无错题</p>
          <p className="text-sm mt-2">点击"导入 Word"按钮导入错题文档</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q) => (
            <QuestionCard key={q.id} question={q} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onDelete,
}: {
  question: Question;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-xs px-2 py-1 rounded-full ${
                question.subject === "math"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-green-50 text-green-600"
              }`}
            >
              {subjectLabel(question.subject)}
            </span>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
              {typeLabel(question.question_type)}
            </span>
            <span className="text-xs text-gray-400">{question.chapter}</span>
          </div>
          <p className="text-gray-800 line-clamp-2">{question.content}</p>
          {question.correct_answer && (
            <p className="text-sm text-green-600 mt-2">
              答案: {question.correct_answer}
            </p>
          )}
        </div>
        <button
          onClick={() => onDelete(question.id)}
          className="p-2 text-gray-400 hover:text-red-500 transition-colors ml-4"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
