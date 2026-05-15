import { useApp } from "../../context/AppContext";
import { Home, BookOpen, Brain, BarChart3, Printer } from "lucide-react";

const navItems = [
  { id: "home", label: "首页", icon: Home },
  { id: "questions", label: "错题本", icon: BookOpen },
  { id: "graph", label: "知识图谱", icon: Brain },
  { id: "practice", label: "练习卷", icon: Printer },
  { id: "stats", label: "统计", icon: BarChart3 },
];

export default function StudentNav() {
  const { activePage, setActivePage } = useApp();

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setActivePage(item.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            activePage === item.id
              ? "bg-primary-50 text-primary-700"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <item.icon size={18} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}
