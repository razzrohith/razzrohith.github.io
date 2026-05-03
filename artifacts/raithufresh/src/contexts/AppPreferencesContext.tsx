import React, { createContext, useContext, useEffect, useState } from "react";

type LanguageMode = "en" | "en_te";
type ThemeMode = "light" | "dark";

interface AppPreferencesContextType {
  languageMode: LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isTeluguEnabled: boolean;
  toggleLanguageMode: () => void;
  toggleThemeMode: () => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextType | undefined>(undefined);

export const AppPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [languageMode, setLanguageMode] = useState<LanguageMode>(() => {
    try {
      const saved = localStorage.getItem("raithu_language_mode");
      return (saved === "en_te" ? "en_te" : "en") as LanguageMode;
    } catch {
      return "en";
    }
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem("raithu_theme");
      if (saved === "dark") return "dark";
      if (saved === "light") return "light";
      
      // Optional: system preference
      // if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
      
      return "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    localStorage.setItem("raithu_language_mode", languageMode);
  }, [languageMode]);

  useEffect(() => {
    localStorage.setItem("raithu_theme", themeMode);
    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [themeMode]);

  const isTeluguEnabled = languageMode === "en_te";

  const toggleLanguageMode = () => {
    setLanguageMode(prev => (prev === "en" ? "en_te" : "en"));
  };

  const toggleThemeMode = () => {
    setThemeMode(prev => (prev === "light" ? "dark" : "light"));
  };

  return (
    <AppPreferencesContext.Provider
      value={{
        languageMode,
        setLanguageMode,
        themeMode,
        setThemeMode,
        isTeluguEnabled,
        toggleLanguageMode,
        toggleThemeMode,
      }}
    >
      {children}
    </AppPreferencesContext.Provider>
  );
};

export const useAppPreferences = () => {
  const context = useContext(AppPreferencesContext);
  if (context === undefined) {
    throw new Error("useAppPreferences must be used within an AppPreferencesProvider");
  }
  return context;
};
