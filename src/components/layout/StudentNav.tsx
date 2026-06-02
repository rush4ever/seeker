import { useApp } from "../../context/AppContext";
import { Home, BookOpen, Brain, BarChart3, Printer, Camera } from "lucide-react";

const navItems = [
  { id: "home", label: "首页", icon: Home },
  { id: "questions", label: "错题本", icon: BookOpen },
  { id: "graph", label: "知识图谱", icon: Brain },
  { id: "practice", label: "练习卷", icon: Printer },
  { id: "grading", label: "批改", icon: Camera },
  { id: "stats", label: "统计", icon: BarChart3 },
];

export default function StudentNav() {
  const { activePage, setActivePage } = useApp();

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {navItems.map((item) => {
        const active = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`flex items-center gap-2.5 px-2.5 py-1.5 text-sm rounded-notion transition-colors duration-150 ${
              active
                ? "bg-notion-accent-bg text-notion-text font-medium"
                : "text-notion-muted hover:bg-notion-surface"
            }`}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
