import { useState, useRef } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  validateManualQuestionForm,
  buildManualQuestionInput,
  type ManualQuestionForm,
} from "../../lib/manualQuestion";
import { useQuestions } from "../../hooks/useQuestions";

interface Props {
  studentId: number;
  onClose: () => void;
  onAdded: () => void;
}

export default function ManualAddQuestionForm({ studentId, onClose, onAdded }: Props) {
  const [form, setForm] = useState<ManualQuestionForm>({
    content: "",
    questionType: "objective",
    subject: "math",
    chapter: "",
    correctAnswer: "",
    errorCause: "unknown",
    difficulty: "medium",
  });
  const [imagePaths, setImagePaths] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addQuestions } = useQuestions(studentId);

  function update<K extends keyof ManualQuestionForm>(key: K, val: ManualQuestionForm[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleUploadImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const paths: string[] = [];
    for (const f of files) {
      const buf = await f.arrayBuffer();
      const path = (await invoke("save_uploaded_photo", {
        studentId,
        filename: f.name,
        bytes: Array.from(new Uint8Array(buf)),
      })) as string;
      paths.push(path);
    }
    setImagePaths((p) => [...p, ...paths]);
  }

  async function handleSubmit() {
    setError(null);
    const errs = validateManualQuestionForm(form);
    if (errs.length) {
      setError(errs.join("；"));
      return;
    }
    setSubmitting(true);
    try {
      const input = buildManualQuestionInput(form, studentId, imagePaths);
      await addQuestions([input]);
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-notion-border rounded-notion bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">手动添加错题</h3>
        <button onClick={onClose} className="notion-btn-ghost p-1" aria-label="关闭">
          <X size={16} />
        </button>
      </div>
      <p className="text-xs text-notion-muted">关闭即丢失，未自动暂存。</p>

      <textarea
        className="notion-input min-h-[100px]"
        placeholder="题目内容 *"
        value={form.content}
        onChange={(e) => update("content", e.target.value)}
        autoFocus
      />

      <div className="flex gap-3 flex-wrap">
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">题型</legend>
          <span className="text-notion-muted">题型</span>
          {(["objective", "subjective"] as const).map((t) => (
            <label key={t} className="flex items-center gap-1">
              <input
                type="radio"
                name="qtype"
                checked={form.questionType === t}
                onChange={() => update("questionType", t)}
              />
              {t === "objective" ? "客观" : "主观"}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex items-center gap-2 text-sm">
          <legend className="sr-only">学科</legend>
          <span className="text-notion-muted">学科</span>
          {(["math", "physics"] as const).map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input
                type="radio"
                name="subject"
                checked={form.subject === s}
                onChange={() => update("subject", s)}
              />
              {s === "math" ? "数学" : "物理"}
            </label>
          ))}
        </fieldset>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          className="notion-input"
          placeholder="章节"
          value={form.chapter}
          onChange={(e) => update("chapter", e.target.value)}
        />
        <input
          className="notion-input"
          placeholder="参考答案"
          value={form.correctAnswer}
          onChange={(e) => update("correctAnswer", e.target.value)}
        />
      </div>

      <div className="flex gap-3">
        <select
          className="notion-input flex-1"
          value={form.errorCause}
          onChange={(e) => update("errorCause", e.target.value as ManualQuestionForm["errorCause"])}
        >
          <option value="unknown">错因：未分类</option>
          <option value="concept">概念不清</option>
          <option value="calculation">计算错误</option>
          <option value="careless">粗心</option>
          <option value="misread">审题失误</option>
        </select>
        <select
          className="notion-input flex-1"
          value={form.difficulty}
          onChange={(e) => update("difficulty", e.target.value as ManualQuestionForm["difficulty"])}
        >
          <option value="easy">难度：易</option>
          <option value="medium">难度：中</option>
          <option value="hard">难度：难</option>
        </select>
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUploadImages}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="notion-btn-ghost text-xs"
          type="button"
        >
          <Upload size={14} /> 上传图片（{imagePaths.length}）
        </button>
      </div>

      {error && <p className="text-sm text-notion-danger">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="notion-btn-ghost">取消</button>
        <button onClick={handleSubmit} disabled={submitting} className="notion-btn-primary">
          {submitting && <Loader2 size={14} className="animate-spin" />}
          完成添加
        </button>
      </div>
    </div>
  );
}
