import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Leaf, LogOut, ChevronDown, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ROLE_COLORS: Record<string, string> = {
  farmer: "bg-green-100 text-green-700 border-green-200",
  agent: "bg-blue-100 text-blue-700 border-blue-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  buyer: "bg-amber-100 text-amber-700 border-amber-200",
};

const links = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse Produce" },
  { href: "/farmer", label: "Farmer Dashboard" },
  { href: "/agent", label: "Agent Dashboard" },
  { href: "/admin", label: "Admin" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, profile, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    setUserMenuOpen(false);
    toast.success("Logged out successfully.");
  };

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Account";

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary text-lg">
          <Leaf className="w-5 h-5" />
          RaithuFresh
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                location === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {l.label}
            </Link>
          ))}

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
                <div className="absolute right-0 mt-1 w-48 bg-white border border-border rounded-xl shadow-md py-1 z-50">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs font-medium text-foreground truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {(role === "buyer" || role === "admin") && (
                    <Link
                      href="/buyer"
                      onClick={() => setUserMenuOpen(false)}
                      className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <ClipboardList className="w-4 h-4 text-primary" />
                      Buyer Dashboard
                    </Link>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-muted flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-2">
              <Link href="/login">
                <Button variant="outline" size="sm">Log In</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign Up</Button>
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
        <div className="md:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === l.href
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {l.label}
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
              {(role === "buyer" || role === "admin") && (
                <Link
                  href="/buyer"
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    location === "/buyer"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Buyer Dashboard
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-muted text-left"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="outline" size="sm" className="w-full mt-1">Log In</Button>
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)}>
                <Button size="sm" className="w-full mt-1">Sign Up</Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
