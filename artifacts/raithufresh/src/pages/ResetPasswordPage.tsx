import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import BilingualLabel from "@/components/BilingualLabel";
import PreferenceControls from "@/components/PreferenceControls";

const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type ResetForm = z.infer<typeof resetSchema>;

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { updatePassword, user, recovering, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  // If we reach this page without a user/recovering flag, something is wrong
  // (unless we just succeeded).
  useEffect(() => {
    if (!success && !user) {
      const timeout = setTimeout(() => {
        if (!user) navigate("/login");
      }, 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [user, success, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const onSubmit = async (data: ResetForm) => {
    setSubmitting(true);
    const { error } = await updatePassword(data.password);
    setSubmitting(false);

    if (error) {
      toast.error(error);
    } else {
      setSuccess(true);
      toast.success("Password updated successfully!");
      // Sign out to force fresh login with new credentials
      await signOut();
    }
  };

  if (!user && !success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Validating session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Subtle Background */}
      <div 
        className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none bg-cover bg-center bg-no-repeat blur-sm scale-105"
        style={{ backgroundImage: "url('/assets/images/hero/market-hero.png')" }}
      />

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <PreferenceControls className="bg-card border border-border rounded-lg shadow-sm" />
      </div>

      <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl mb-8 z-10 relative">
        <Leaf className="w-6 h-6" />
        RaithuFresh
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-sm z-10 relative">
        {success ? (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">
              <BilingualLabel en="Password Reset" te="పాస్‌వర్డ్ రీసెట్" />
            </h1>
            <p className="text-sm text-muted-foreground">
              Your password has been updated. You can now log in with your new password.
            </p>
            <Link href="/login">
              <Button className="w-full mt-4 h-auto py-2">
                <BilingualLabel en="Log In Now" te="ఇప్పుడే లాగిన్ చేయండి" orientation="stacked" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground mb-1">
              <BilingualLabel en="Set New Password" te="కొత్త పాస్‌వర్డ్‌ను సెట్ చేయండి" />
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter a new secure password for your account.
            </p>

            {recovering && (
              <div className="bg-blue-50 border border-blue-100 text-blue-700 text-xs rounded-lg px-3 py-2 mb-4 flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Password recovery active for {user?.email}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="new-password">
                  <BilingualLabel en="New Password" te="కొత్త పాస్‌వర్డ్" />
                </Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    {...register("password")}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
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

              <div>
                <Label htmlFor="confirm-password">
                  <BilingualLabel en="Confirm New Password" te="కొత్త పాస్‌వర్డ్‌ను ధృవీకరించండి" />
                </Label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  {...register("confirmPassword")}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && (
                  <p className="text-destructive text-xs mt-1">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full h-auto py-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  <BilingualLabel en="Reset Password" te="పాస్‌వర్డ్‌ను రీసెట్ చేయండి" orientation="stacked" />
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
