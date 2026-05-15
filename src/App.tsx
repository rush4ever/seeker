import { useEffect } from "react";
import { useApp } from "./context/AppContext";
import { seedKnowledgeTree } from "./lib/knowledgeTree";
import AppShell from "./components/layout/AppShell";
import HomePage from "./pages/student/HomePage";
import QuestionsPage from "./pages/student/QuestionsPage";
import GraphPage from "./pages/student/GraphPage";
import PracticePage from "./pages/student/PracticePage";
import StatsPage from "./pages/student/StatsPage";
import DashboardPage from "./pages/parent/DashboardPage";
import SettingsPage from "./pages/parent/SettingsPage";

function StudentRouter({ page }: { page: string }) {
  switch (page) {
    case "home": return <HomePage />;
    case "questions": return <QuestionsPage />;
    case "graph": return <GraphPage />;
    case "practice": return <PracticePage />;
    case "stats": return <StatsPage />;
    default: return <HomePage />;
  }
}

function ParentRouter({ page }: { page: string }) {
  switch (page) {
    case "dashboard": return <DashboardPage />;
    case "settings": return <SettingsPage />;
    default: return <DashboardPage />;
  }
}

export default function App() {
  const { roleMode, activePage } = useApp();

  useEffect(() => {
    seedKnowledgeTree().catch(console.error);
  }, []);

  return (
    <AppShell>
      {roleMode === "student"
        ? <StudentRouter page={activePage} />
        : <ParentRouter page={activePage} />}
    </AppShell>
  );
}
