import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

export default function AuthCallbackPage() {
  const [, navigate] = useLocation();
  const { user, loading, recovering } = useAuth();

  useEffect(() => {
    // If auth is no longer loading and we have a user, decide where to go
    if (!loading) {
      if (recovering) {
        navigate("/reset-password");
      } else if (user) {
        navigate("/");
      } else {
        const timeout = setTimeout(() => {
          if (!user) navigate("/login");
        }, 3000);
        return () => clearTimeout(timeout);
      }
    }
    return undefined;
  }, [user, loading, recovering, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="flex justify-center">
            {loading ? (
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            ) : user ? (
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            ) : (
              <XCircle className="w-12 h-12 text-destructive" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {loading ? "Verifying..." : user ? "Verified!" : "Verification Failed"}
          </h1>
          <p className="text-muted-foreground">
            {loading
              ? "Please wait while we confirm your account."
              : user
              ? "Your account has been successfully verified. Redirecting..."
              : "We couldn't verify your account. The link may have expired."}
          </p>
        </div>
      </div>
    </div>
  );
}
