import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type LoginForm = z.infer<typeof loginSchema>;

function roleDashboard(role: string | null): string {
  if (role === "farmer") return "/farmer";
  if (role === "agent") return "/agent";
  if (role === "admin") return "/admin";
  return "/buyer";
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { user, signIn, signOut, role } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  // Redirect to role dashboard once role is known after login
  useEffect(() => {
    if (justLoggedIn && role !== null) {
      navigate(roleDashboard(role));
    }
  }, [justLoggedIn, role, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Cannot log in.");
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Welcome back!");
      setJustLoggedIn(true);
      // useEffect above handles navigation once role loads
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl mb-8">
        <Leaf className="w-6 h-6" />
        RaithuFresh
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-sm">
        <h1 className="text-xl font-bold text-foreground mb-1">Log In</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Welcome back. Enter your credentials to continue.
        </p>

        {user && !submitting ? (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 text-primary rounded-xl p-4 text-sm text-center">
              You are already logged in as <strong>{user.email}</strong>.
            </div>
            <Link href={roleDashboard(role)}>
              <Button className="w-full">Go to Dashboard</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full">My Profile</Button>
            </Link>
            <Button variant="ghost" className="w-full text-destructive" onClick={() => signOut()}>
              Log Out
            </Button>
          </div>
        ) : (
          <>
            {!isSupabaseConfigured() && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 mb-4">
                Supabase is not configured. Authentication is unavailable in demo mode.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Password</Label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    {...register("password")}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={submitting || justLoggedIn}>
                {submitting || justLoggedIn ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {justLoggedIn ? "Redirecting..." : "Logging in..."}
                  </>
                ) : (
                  "Log In"
                )}
              </Button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-5">
              No account?{" "}
              <Link href="/signup" className="text-primary font-medium hover:underline">
                Sign up
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
