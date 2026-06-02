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
    <div className="h-screen flex bg-white text-notion-text font-notion">
      <aside className="w-64 border-r border-notion-border flex flex-col">
        <div className="px-4 py-3 border-b border-notion-border">
          <span className="text-sm font-semibold text-notion-text">
            {roleMode === "student" ? "学习中心" : "家长中心"}
          </span>
        </div>
        <div className="border-b border-notion-border">
          <StudentSwitcher />
        </div>
        <div className="flex-1 py-2 overflow-auto">
          {roleMode === "student" ? <StudentNav /> : <ParentNav />}
        </div>
        <div className="p-3 border-t border-notion-border">
          <RoleToggle />
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 px-6 flex items-center justify-between border-b border-notion-border">
          <h1 className="text-sm font-medium text-notion-text">
            {currentStudent
              ? `${currentStudent.name} · ${gradeLabel(currentStudent.current_grade)}`
              : "请选择一个学生"}
          </h1>
          <OllamaStatusBar />
        </header>
        <main className="flex-1 overflow-auto px-6 py-5">{children}</main>
      </div>
    </div>
  );
}
