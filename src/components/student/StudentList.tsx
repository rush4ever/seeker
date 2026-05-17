import type { Student } from "../../types";
import { Trash2, Pencil } from "lucide-react";

interface Props {
  students: Student[];
  currentStudentId: number | null;
  onSelect: (student: Student) => void;
  onDelete: (id: number) => void;
  onEdit: (student: Student) => void;
}

function gradeLabel(grade: number): string {
  const map: Record<number, string> = { 8: "初二", 9: "初三", 10: "高一", 11: "高二", 12: "高三" };
  return map[grade] || `Grade ${grade}`;
}

export default function StudentList({ students, currentStudentId, onSelect, onDelete, onEdit }: Props) {
  return (
    <div className="space-y-2">
      {students.map((student) => (
        <div
          key={student.id}
          onClick={() => onSelect(student)}
          className={`p-3 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
            currentStudentId === student.id
              ? "bg-primary-50 border border-primary-200"
              : "bg-white border border-gray-100 hover:bg-gray-50"
          }`}
        >
          <div className="min-w-0">
            <p className="font-medium truncate">{student.name}</p>
            <p className="text-sm text-gray-500">
              {gradeLabel(student.current_grade)} · {student.current_semester === 1 ? "上" : "下"}学期
            </p>
          </div>
          <div className="flex items-center shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(student); }}
              className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
              title="编辑"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(student.id); }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="删除"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
