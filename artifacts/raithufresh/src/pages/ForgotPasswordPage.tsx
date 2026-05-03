import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import BilingualLabel from "@/components/BilingualLabel";
import PreferenceControls from "@/components/PreferenceControls";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});
type ForgotForm = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotForm) => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured.");
      return;
    }
    setSubmitting(true);
    const { error } = await resetPassword(data.email);
    setSubmitting(false);
    
    if (error) {
      if (error.toLowerCase().includes("rate limit")) {
        toast.error("Email limit reached. Please wait a while before trying again.");
      } else {
        toast.error(error);
      }
    } else {
      setSent(true);
      toast.success("Reset link sent!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12 relative">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <PreferenceControls className="bg-card border border-border rounded-lg shadow-sm" />
      </div>

      <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl mb-8">
        <Leaf className="w-6 h-6" />
        RaithuFresh
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-sm">
        {sent ? (
          <div className="text-center space-y-4 py-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="w-6 h-6 text-primary" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">
              <BilingualLabel en="Check your email" te="మీ ఈమెయిల్ తనిఖీ చేయండి" />
            </h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, we've sent a password reset link.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full mt-4 h-auto py-2">
                <BilingualLabel en="Return to Login" te="లాగిన్‌కి తిరిగి వెళ్లండి" orientation="stacked" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-foreground mb-1">
              <BilingualLabel en="Forgot Password?" te="పాస్‌వర్డ్ మర్చిపోయారా?" />
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email address and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="forgot-email">
                  <BilingualLabel en="Email Address" te="ఈమెయిల్ చిరునామా" />
                </Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full h-auto py-2" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  <BilingualLabel en="Send Reset Link" te="రీసెట్ లింక్ పంపండి" orientation="stacked" />
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
