import { useApp } from "../../context/AppContext";

export default function RoleToggle() {
  const { roleMode, toggleRoleMode } = useApp();

  return (
    <button
      onClick={toggleRoleMode}
      className="px-4 py-2 text-sm font-medium rounded-full transition-colors bg-gray-100 hover:bg-gray-200 w-full"
    >
      {roleMode === "student" ? "👤 学生模式" : "👨‍👩‍👧 家长模式"}
    </button>
  );
}
