import { useApp } from "../../context/AppContext";
import { LayoutDashboard, Settings } from "lucide-react";

const navItems = [
  { id: "dashboard", label: "仪表盘", icon: LayoutDashboard },
  { id: "settings", label: "设置", icon: Settings },
];

export default function ParentNav() {
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
