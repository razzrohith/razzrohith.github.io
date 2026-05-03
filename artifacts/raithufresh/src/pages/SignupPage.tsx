import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, Eye, EyeOff, Mail, RefreshCw, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured, normalizePhone, isValidPhone, isPhoneAvailable } from "@/lib/supabase";
import BilingualLabel from "@/components/BilingualLabel";

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().refine((val) => isValidPhone(val), "Enter a valid 10-digit mobile number starting with 6-9"),
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/[a-z]/, "Include at least one lowercase letter")
    .regex(/[0-9]/, "Include at least one number")
    .regex(/[^A-Za-z0-9]/, "Include at least one special character")
    .refine((val) => !val.includes(" "), "Password cannot contain spaces"),
  role: z.enum(["buyer", "farmer", "agent"], {
    required_error: "Select your role",
  }),
  village: z.string().optional(),
});
type SignupForm = z.infer<typeof signupSchema>;

const VALID_ROLES = ["buyer", "farmer", "agent"] as const;
type ValidRole = typeof VALID_ROLES[number];

function roleDashboard(role: string | null): string {
  if (role === "farmer") return "/farmer";
  if (role === "agent") return "/agent";
  return "/buyer";
}

export default function SignupPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { signUp, role, user, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [justSignedUp, setJustSignedUp] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const { resendVerification } = useAuth();

  // Read ?role= from URL (e.g. /signup?role=buyer)
  const params = new URLSearchParams(search);
  const urlRole = params.get("role");
  const preRole: ValidRole | "" =
    VALID_ROLES.includes(urlRole as ValidRole) ? (urlRole as ValidRole) : "";

  const [roleValue, setRoleValue] = useState<string>(preRole);

  const {
    register, handleSubmit, setValue, watch, formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const passwordValue = watch("password", "");

  const passwordRules = [
    { label: "8+ characters", met: passwordValue.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(passwordValue) },
    { label: "Lowercase letter", met: /[a-z]/.test(passwordValue) },
    { label: "Number", met: /[0-9]/.test(passwordValue) },
    { label: "Special character", met: /[^A-Za-z0-9]/.test(passwordValue) },
    { label: "No spaces", met: passwordValue.length > 0 && !passwordValue.includes(" ") },
  ];

  // Pre-select role from URL on mount
  useEffect(() => {
    if (preRole) {
      setValue("role", preRole, { shouldValidate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If email confirmation is disabled, profile + role will load immediately
  // and we can redirect to the dashboard automatically.
  useEffect(() => {
    if (justSignedUp && role !== null) {
      navigate(roleDashboard(role));
    }
  }, [justSignedUp, role, navigate]);

  const onSubmit = async (data: SignupForm) => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Cannot sign up.");
      return;
    }
    setSubmitting(true);
    try {
      const normalizedPhone = normalizePhone(data.phone);

      // Check phone availability before auth signup
      const isAvailable = await isPhoneAvailable(normalizedPhone);
      if (!isAvailable) {
        toast.error("This phone number is already registered. Please use another number or log in.");
        setSubmitting(false);
        return;
      }

      const { error, needsEmailConfirmation } = await signUp({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: normalizedPhone,
        role: data.role,
        village: data.village,
      });

      if (error) {
        const errLower = error.toLowerCase();
        if (errLower.includes("email rate limit exceeded")) {
          toast.error(
            "Supabase email limit reached. For testing, disable email confirmations or wait before trying again."
          );
        } else if (
          errLower.includes("already exists") ||
          errLower.includes("already registered") ||
          errLower.includes("please log in") ||
          errLower.includes("duplicate key") ||
          errLower.includes("unique constraint") ||
          errLower.includes("user_profiles_pkey")
        ) {
          toast.error(error, { duration: 6000 });
        } else if (
          errLower.includes("relation") ||
          errLower.includes("pg_") ||
          errLower.includes("syntax") ||
          errLower.includes("violates") ||
          errLower.includes("database")
        ) {
          toast.error("An unexpected server error occurred. Please try again later.");
        } else {
          toast.error(error);
        }
        return;
      }

      if (needsEmailConfirmation) {
        setSignedUpEmail(data.email);
        setVerificationNeeded(true);
        toast.success(
          "Account created! Please check your email for a verification link.",
          { duration: 8000 }
        );
      } else {
        toast.success("Account created! Welcome to RaithuFresh.");
        setJustSignedUp(true);
      }
    } catch (err: any) {
      console.error("Signup exception:", err);
      toast.error(err.message || "An unexpected error occurred during signup.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!signedUpEmail) return;
    setResending(true);
    const { error } = await resendVerification(signedUpEmail);
    setResending(false);
    if (error) {
      if (error.toLowerCase().includes("rate limit")) {
        toast.error("Resend limit reached. Please wait a few minutes.");
      } else {
        toast.error(error);
      }
    } else {
      toast.success("Verification email resent!");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl mb-8">
        <Leaf className="w-6 h-6" />
        RaithuFresh
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-sm">
        <h1 className="text-xl font-bold text-foreground mb-1">
          <BilingualLabel en="Create Account" te="ఖాతాను సృష్టించండి" />
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          <BilingualLabel 
            en="Join RaithuFresh as a buyer, farmer, or agent." 
            te="కొనుగోలుదారు, రైతు లేదా ఏజెంట్‌గా రైతుఫ్రెష్‌లో చేరండి."
            orientation="stacked"
          />
        </p>

        {verificationNeeded ? (
          <div className="text-center space-y-6 py-2">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Verify Your Email</h1>
              <p className="text-sm text-muted-foreground mt-2">
                We've sent a verification link to<br />
                <span className="font-medium text-foreground">{signedUpEmail}</span>
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground text-left space-y-2 border border-border">
              <p>• Check your spam folder if you don't see it.</p>
              <p>• The link will expire in 24 hours.</p>
              <p>• You must verify before you can log in.</p>
            </div>

            <div className="space-y-3">
              <Link href="/login">
                <Button className="w-full">Proceed to Login</Button>
              </Link>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs gap-2"
                onClick={handleResend}
                disabled={resending}
              >
                {resending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Didn't get the email? Resend
              </Button>
            </div>
          </div>
        ) : user && !submitting ? (
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 text-primary rounded-xl p-4 text-sm text-center">
              You are already signed in as <strong>{user.email}</strong>.
            </div>
            <Link href={roleDashboard(role)}>
              <Button className="w-full h-auto py-2">
                <BilingualLabel en="Go to Dashboard" te="డాష్బోర్డ్ కు వెళ్ళండి" orientation="stacked" />
              </Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline" className="w-full h-auto py-2">
                <BilingualLabel en="My Profile" te="నా ప్రొఫైల్" orientation="stacked" />
              </Button>
            </Link>
            <Button variant="ghost" className="w-full text-destructive h-auto py-2" onClick={() => signOut()}>
              <BilingualLabel en="Log Out" te="లాగ్ అవుట్" orientation="stacked" />
            </Button>
          </div>
        ) : (
          <>
            {!isSupabaseConfigured() && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 mb-4">
                Supabase is not configured. Signup is unavailable in demo mode.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label>
                  <BilingualLabel en="Full Name" te="పూర్తి పేరు" /> <span className="text-destructive">*</span>
                </Label>
                <Input placeholder="e.g. Ramaiah Reddy" {...register("fullName")} />
                {errors.fullName && (
                  <p className="text-destructive text-xs mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <Label>
                  <BilingualLabel en="Phone" te="ఫోన్ నంబర్" /> <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="e.g. 9876543210"
                  inputMode="numeric"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
                )}
              </div>

              <div>
                <Label>
                  <BilingualLabel en="Email" te="ఈమెయిల్" /> <span className="text-destructive">*</span>
                </Label>
                <Input
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
                <Label>
                  <BilingualLabel en="Password" te="పాస్వర్డ్" /> <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    {...register("password")}
                    autoComplete="new-password"
                    className="pr-10"
                    onFocus={() => setPasswordFocused(true)}
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
                {errors.password && !passwordFocused && (
                  <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
                )}

                {(passwordFocused || (errors.password && passwordValue.length > 0)) && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-xl border border-border space-y-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3" /> Password Requirements
                    </p>
                    <div className="grid grid-cols-2 gap-y-1.5 gap-x-2">
                      {passwordRules.map((rule, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          {rule.met ? (
                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                          ) : (
                            <X className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className={`text-[11px] leading-tight ${rule.met ? "text-foreground" : "text-muted-foreground"}`}>
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <Label>
                  <BilingualLabel en="I am a" te="నేను ఒక" /> <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={roleValue}
                  onValueChange={(v) => {
                    setRoleValue(v);
                    setValue("role", v as "buyer" | "farmer" | "agent", { shouldValidate: true });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buyer">
                      <BilingualLabel en="Buyer" te="కొనుగోలుదారు" />
                    </SelectItem>
                    <SelectItem value="farmer">
                      <BilingualLabel en="Farmer" te="రైతు" />
                    </SelectItem>
                    <SelectItem value="agent">
                      <BilingualLabel en="Agent" te="ఏజెంట్" />
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-destructive text-xs mt-1">{errors.role.message}</p>
                )}
              </div>

              <div>
                <Label>
                  <BilingualLabel en="Village / Town" te="గ్రామం / పట్టణం" /> (optional)
                </Label>
                <Input placeholder="e.g. Shadnagar" {...register("village")} />
              </div>

              <Button 
                type="submit" 
                className={`w-full h-auto py-3 transition-all duration-200 ${submitting || justSignedUp ? "opacity-70 cursor-not-allowed" : ""}`}
                disabled={submitting || justSignedUp}
              >
                {submitting || justSignedUp ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {justSignedUp ? "Redirecting..." : "Creating account..."}
                  </>
                ) : (
                  <BilingualLabel en="Create Account" te="ఖాతాను సృష్టించండి" orientation="stacked" variant="button" />
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Admin accounts are assigned manually by the platform admin.
            </p>

            <p className="text-sm text-muted-foreground text-center mt-3">
              <BilingualLabel en="Already have an account?" te="ఇప్పటికే ఖాతా ఉందా?" variant="onLight" />{" "}
              <Link href="/login" className="text-primary font-medium hover:underline">
                <BilingualLabel en="Log in" te="లాగిన్" variant="onLight" />
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
