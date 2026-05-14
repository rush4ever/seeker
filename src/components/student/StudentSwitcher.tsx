import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { useStudents } from "../../hooks/useStudents";
import StudentForm from "./StudentForm";
import StudentList from "./StudentList";
import { UserPlus } from "lucide-react";

export default function StudentSwitcher() {
  const { currentStudent, setCurrentStudent } = useApp();
  const { students, add, remove } = useStudents();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-800">学生档案</h2>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {showForm ? (
          <StudentForm
            onSubmit={(req) => { add(req); setShowForm(false); }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <>
            <StudentList
              students={students}
              currentStudentId={currentStudent?.id ?? null}
              onSelect={setCurrentStudent}
              onDelete={remove}
            />
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <UserPlus size={16} />
              添加学生
            </button>
          </>
        )}
      </div>
    </div>
  );
}
