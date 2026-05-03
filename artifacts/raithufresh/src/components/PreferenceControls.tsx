import { Languages, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";

interface PreferenceControlsProps {
  className?: string;
}

export default function PreferenceControls({ className = "" }: PreferenceControlsProps) {
  const { languageMode, toggleLanguageMode, themeMode, toggleThemeMode } = useAppPreferences();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLanguageMode}
        className="h-8 px-2 flex items-center gap-1.5 text-xs font-semibold hover:bg-muted"
        title={languageMode === "en" ? "Switch to English + Telugu" : "Switch to English only"}
      >
        <Languages className="w-3.5 h-3.5 text-primary" />
        <span>{languageMode === "en" ? "EN" : "EN+తెలుగు"}</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={toggleThemeMode}
        className="h-8 w-8 p-0 flex items-center justify-center hover:bg-muted"
        title={themeMode === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
      >
        {themeMode === "light" ? (
          <Moon className="w-3.5 h-3.5 text-foreground" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-400" />
        )}
      </Button>
    </div>
  );
}
