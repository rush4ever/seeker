import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useStudents } from "../../hooks/useStudents";
import StudentForm from "./StudentForm";
import StudentList from "./StudentList";
import { UserPlus } from "lucide-react";
import type { Student } from "../../types";

export default function StudentSwitcher() {
  const { currentStudent, setCurrentStudent } = useApp();
  const { students, add, update, remove } = useStudents();
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingStudent(null);
  };

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2">
        <h2 className="text-xs font-medium text-notion-muted uppercase tracking-wide">
          学生档案
        </h2>
      </div>
      <div className="px-2 pb-2">
        {showForm ? (
          <StudentForm
            initialData={editingStudent ?? undefined}
            onSubmit={(req) => {
              if ("id" in req) {
                update(req);
              } else {
                add(req);
              }
              handleCancel();
            }}
            onCancel={handleCancel}
          />
        ) : (
          <>
            <StudentList
              students={students}
              currentStudentId={currentStudent?.id ?? null}
              onSelect={setCurrentStudent}
              onDelete={remove}
              onEdit={handleEdit}
            />
            <button
              onClick={() => setShowForm(true)}
              className="mt-2 w-full py-1.5 flex items-center justify-center gap-1.5 text-xs text-notion-muted hover:bg-notion-surface rounded-notion transition-colors"
            >
              <UserPlus size={14} />
              添加学生
            </button>
          </>
        )}
      </div>
    </div>
  );
}
