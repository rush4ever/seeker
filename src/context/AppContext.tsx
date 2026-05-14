import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Student, RoleMode } from "../types";

interface AppContextType {
  currentStudent: Student | null;
  setCurrentStudent: (student: Student | null) => void;
  roleMode: RoleMode;
  toggleRoleMode: () => void;
  activePage: string;
  setActivePage: (page: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [roleMode, setRoleMode] = useState<RoleMode>("student");
  const [activePage, setActivePage] = useState("home");

  const toggleRoleMode = useCallback(() => {
    setRoleMode((prev) => (prev === "student" ? "parent" : "student"));
  }, []);

  useEffect(() => {
    setActivePage(roleMode === "student" ? "home" : "dashboard");
  }, [roleMode]);

  return (
    <AppContext.Provider
      value={{
        currentStudent,
        setCurrentStudent,
        roleMode,
        toggleRoleMode,
        activePage,
        setActivePage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
