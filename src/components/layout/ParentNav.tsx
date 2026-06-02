import { useApp } from "../../context/AppContext";
import { LayoutDashboard, Settings } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "仪表盘", icon: LayoutDashboard },
  { id: "settings", label: "设置", icon: Settings },
];

export default function ParentNav() {
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
