import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Leaf, LogOut, ChevronDown, ClipboardList, UserCircle, Languages, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useAppPreferences } from "@/contexts/AppPreferencesContext";
import BilingualLabel from "./BilingualLabel";

const ROLE_COLORS: Record<string, string> = {
  farmer: "bg-green-100 text-green-700 border-green-200",
  agent: "bg-blue-100 text-blue-700 border-blue-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  buyer: "bg-amber-100 text-amber-700 border-amber-200",
};

type NavLink = { href: string; label: string; te: string; roles?: string[] };

const links: NavLink[] = [
  { href: "/", label: "Home", te: "హోమ్" },
  { href: "/browse", label: "Browse Produce", te: "పంటలు చూడండి" },
  { href: "/farmer", label: "Farmer Dashboard", te: "రైతు డాష్బోర్డ్", roles: ["farmer", "admin"] },
  { href: "/agent", label: "Agent Dashboard", te: "ఏజెంట్ డాష్బోర్డ్", roles: ["agent", "admin"] },
  { href: "/admin", label: "Admin", te: "అడ్మిన్", roles: ["admin"] },
];

function getRoleDashboard(role: string | null): { href: string; label: string; te: string } {
  if (role === "farmer") return { href: "/farmer", label: "Farmer Dashboard", te: "రైతు డాష్బోర్డ్" };
  if (role === "agent") return { href: "/agent", label: "Agent Dashboard", te: "ఏజెంట్ డాష్బోర్డ్" };
  if (role === "admin") return { href: "/admin", label: "Admin Dashboard", te: "అడ్మిన్ డాష్బోర్డ్" };
  return { href: "/buyer", label: "Buyer Dashboard", te: "కొనుగోలుదారు డాష్బోర్డ్" };
}


export default function Navbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, profile, role, signOut } = useAuth();
  const { languageMode, toggleLanguageMode, themeMode, toggleThemeMode } = useAppPreferences();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setUserMenuOpen(false);
    toast.success("Logged out successfully.");
  };

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Account";

  // Reactive badge count — initialised from localStorage, updates when FarmerDashboard fires the custom event
  const readBadgeCount = () =>
    (role === "farmer" || role === "admin")
      ? Math.max(0, parseInt(localStorage.getItem("raithu_farmer_new_pending") ?? "0", 10) || 0)
      : 0;

  const [farmerNewPending, setFarmerNewPending] = useState<number>(readBadgeCount);

  useEffect(() => {
    setFarmerNewPending(readBadgeCount());
    const handler = () => setFarmerNewPending(readBadgeCount());
    window.addEventListener("raithu_farmer_badge_update", handler);
    return () => window.removeEventListener("raithu_farmer_badge_update", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-lg">
          <Leaf className="w-5 h-5" />
          RaithuFresh
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.filter((l) => !l.roles || (role && l.roles.includes(role))).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                location === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <BilingualLabel 
                en={l.label} 
                te={l.te} 
                teClassName={location === l.href ? "text-primary-foreground/70" : ""}
              />
              {l.href === "/farmer" && farmerNewPending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none">
                  {farmerNewPending > 9 ? "9+" : farmerNewPending}
                </span>
              )}
            </Link>
          ))}

          {/* Preferences toggles - Desktop */}
          <div className="flex items-center gap-1 ml-2 border-l border-border pl-2">
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

          {user ? (
            <div className="relative ml-2">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <span className="max-w-[120px] truncate">{displayName}</span>
                {role && (
                  <Badge
                    className={`text-[10px] px-1.5 py-0 border ${ROLE_COLORS[role] ?? "bg-muted text-muted-foreground"}`}
                  >
                    {role}
                  </Badge>
                )}
                <ChevronDown className="w-3.5 h-3.5 opacity-60" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-md py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <UserCircle className="w-4 h-4 text-primary" />
                    <BilingualLabel en="My Profile" te="నా ప్రొఫైల్" />
                  </Link>
                  <Link
                    href={getRoleDashboard(role).href}
                    onClick={() => setUserMenuOpen(false)}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <BilingualLabel 
                      en={getRoleDashboard(role).label} 
                      te={getRoleDashboard(role).te} 
                    />
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <BilingualLabel en="Log Out" te="లాగ్ అవుట్" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link href="/login">
                <Button variant="outline" size="sm" className="h-8 py-0">
                  <BilingualLabel en="Log In" te="లాగిన్" />
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="h-8 py-0">
                  <BilingualLabel en="Sign Up" te="సైన్ అప్" />
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-foreground hover:bg-muted"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border bg-background px-4 py-3 flex flex-col gap-1">
          {/* Preferences toggles - Mobile */}
          <div className="flex items-center justify-between gap-2 mb-2 p-1 bg-muted/50 rounded-lg">
            <button
              onClick={toggleLanguageMode}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-background border border-border rounded-md shadow-sm"
            >
              <Languages className="w-3.5 h-3.5 text-primary" />
              <span>{languageMode === "en" ? "English Only" : "EN + తెలుగు Help"}</span>
            </button>
            <button
              onClick={toggleThemeMode}
              className="px-4 flex items-center justify-center gap-2 py-2 text-xs font-semibold bg-background border border-border rounded-md shadow-sm"
            >
              {themeMode === "light" ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              )}
            </button>
          </div>

          {links.filter((l) => !l.roles || (role && l.roles.includes(role))).map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
                location === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <BilingualLabel 
                en={l.label} 
                te={l.te} 
                teClassName={location === l.href ? "text-primary-foreground/70" : ""}
              />
              {l.href === "/farmer" && farmerNewPending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-amber-500 text-white leading-none">
                  {farmerNewPending > 9 ? "9+" : farmerNewPending}
                </span>
              )}
            </Link>
          ))}

          {user ? (
            <>
              <div className="px-3 py-2 flex items-center gap-2 text-sm text-foreground border-t border-border mt-1 pt-2">
                <span className="font-medium truncate max-w-[140px]">{displayName}</span>
                {role && (
                  <Badge
                    className={`text-[10px] px-1.5 py-0 border ${ROLE_COLORS[role] ?? ""}`}
                  >
                    {role}
                  </Badge>
                )}
              </div>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  location === "/profile"
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <UserCircle className="w-4 h-4" />
                <BilingualLabel 
                  en="My Profile" 
                  te="నా ప్రొఫైల్" 
                  teClassName={location === "/profile" ? "text-primary-foreground/70" : ""}
                />
              </Link>
              <Link
                href={getRoleDashboard(role).href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  location === getRoleDashboard(role).href
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <ClipboardList className="w-4 h-4" />
                <BilingualLabel 
                  en={getRoleDashboard(role).label} 
                  te={getRoleDashboard(role).te} 
                  teClassName={location === getRoleDashboard(role).href ? "text-primary-foreground/70" : ""}
                />
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-muted text-left"
              >
                <LogOut className="w-4 h-4" />
                <BilingualLabel en="Log Out" te="లాగ్ అవుట్" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full mt-1">
                  <BilingualLabel en="Log In" te="లాగిన్" />
                </Button>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full mt-1">
                  <BilingualLabel en="Sign Up" te="సైన్ అప్" />
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
