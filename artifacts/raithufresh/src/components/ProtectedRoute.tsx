import { Link } from "wouter";
import { Lock, ShieldOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

type Props = {
  allowedRoles: UserRole[];
  children: React.ReactNode;
};

export default function ProtectedRoute({ allowedRoles, children }: Props) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary opacity-60" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Please log in to continue</h2>
          <p className="text-muted-foreground text-sm mb-6">
            This page requires you to be signed in.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/login">
              <Button>Log In</Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline">Sign Up</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(role as UserRole)) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">You do not have access to this page</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your role ({role ?? "unknown"}) is not allowed here.
          </p>
          <Link href="/">
            <Button variant="outline">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
