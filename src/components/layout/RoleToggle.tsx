import { useApp } from "../../context/AppContext";

export default function RoleToggle() {
  const { roleMode, toggleRoleMode } = useApp();
  const isStudent = roleMode === "student";

  return (
    <button
      onClick={toggleRoleMode}
      className="w-full flex items-center text-xs text-notion-muted hover:text-notion-text border border-notion-border rounded-notion px-2 py-1 transition-colors"
    >
      <span className="flex-1 text-center py-0.5">
        {isStudent ? "学生模式" : "家长模式"}
      </span>
      <span className="text-notion-subtle">↔</span>
    </button>
  );
}
