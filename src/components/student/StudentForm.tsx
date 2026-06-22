import React, { useState, useRef, useEffect } from "react";
import type { CreateStudentRequest, UpdateStudentRequest, Student } from "../../types";

interface Props {
  initialData?: Student;
  onSubmit: (req: CreateStudentRequest | UpdateStudentRequest) => void;
  onCancel: () => void;
}

export default function StudentForm({ initialData, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [grade, setGrade] = useState(initialData?.current_grade ?? 8);
  const [semester, setSemester] = useState(initialData?.current_semester ?? 2);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData) {
      onSubmit({
        id: initialData.id,
        name,
        current_grade: grade,
        current_semester: semester,
        textbook_version: "苏科版",
      });
    } else {
      onSubmit({
        name,
        current_grade: grade,
        current_semester: semester,
        textbook_version: "苏科版",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
        <input
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value={8}>初二</option>
          <option value={9}>初三</option>
          <option value={10}>高一</option>
          <option value={11}>高二</option>
          <option value={12}>高三</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">学期</label>
        <select
          value={semester}
          onChange={(e) => setSemester(Number(e.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value={1}>上学期</option>
          <option value={2}>下学期</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary">{initialData ? "保存" : "添加"}</button>
        <button type="button" onClick={onCancel} className="btn-secondary">取消</button>
      </div>
    </form>
  );
}
