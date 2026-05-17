import React from "react";
import { useApp } from "../../context/AppContext";
import StudentSwitcher from "../student/StudentSwitcher";
import RoleToggle from "./RoleToggle";
import StudentNav from "./StudentNav";
import ParentNav from "./ParentNav";
import OllamaStatusBar from "./OllamaStatusBar";

interface Props {
  children: React.ReactNode;
}

function gradeLabel(grade: number): string {
  const map: Record<number, string> = { 8: "初二", 9: "初三", 10: "高一", 11: "高二", 12: "高三" };
  return map[grade] || `Grade ${grade}`;
}

export default function AppShell({ children }: Props) {
  const { roleMode, currentStudent } = useApp();

  return (
    <div className="h-screen flex bg-gray-50">
      <div className="flex">
        <StudentSwitcher />
        <div className="w-52 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100">
            <span className="font-semibold text-gray-800">
              {roleMode === "student" ? "学习中心" : "家长中心"}
            </span>
          </div>
          <div className="flex-1 p-3">
            {roleMode === "student" ? <StudentNav /> : <ParentNav />}
          </div>
          <div className="p-3 border-t border-gray-100">
            <RoleToggle />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <OllamaStatusBar />
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6">
          <h1 className="text-lg font-medium text-gray-800">
            {currentStudent
              ? `${currentStudent.name} · ${gradeLabel(currentStudent.current_grade)}`
              : "请选择一个学生"}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
