import React, { useState } from "react";
import type { CreateStudentRequest } from "../../types";

interface Props {
  onSubmit: (req: CreateStudentRequest) => void;
  onCancel: () => void;
}

export default function StudentForm({ onSubmit, onCancel }: Props) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(8);
  const [semester, setSemester] = useState(2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      current_grade: grade,
      current_semester: semester,
      textbook_version: "苏科版",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
        <input
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
        <button type="submit" className="btn-primary">添加</button>
        <button type="button" onClick={onCancel} className="btn-secondary">取消</button>
      </div>
    </form>
  );
}
