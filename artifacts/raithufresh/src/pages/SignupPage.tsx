import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Leaf, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";

const signupSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["buyer", "farmer", "agent"], {
    required_error: "Select your role",
  }),
  village: z.string().optional(),
});
type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [, navigate] = useLocation();
  const { signUp } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [roleValue, setRoleValue] = useState("");

  const {
    register, handleSubmit, setValue, formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Cannot sign up.");
      return;
    }
    setSubmitting(true);
    const { error } = await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      phone: data.phone,
      role: data.role,
      village: data.village,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success(
        "Account created! Check your email to confirm, then log in.",
        { duration: 6000 }
      );
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl mb-8">
        <Leaf className="w-6 h-6" />
        RaithuFresh
      </Link>

      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-7 shadow-sm">
        <h1 className="text-xl font-bold text-foreground mb-1">Create Account</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Join RaithuFresh as a buyer, farmer, or agent.
        </p>

        {!isSupabaseConfigured() && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2 mb-4">
            Supabase is not configured. Signup is unavailable in demo mode.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input placeholder="e.g. Ramaiah Reddy" {...register("fullName")} />
            {errors.fullName && (
              <p className="text-destructive text-xs mt-1">{errors.fullName.message}</p>
            )}
          </div>

          <div>
            <Label>
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input placeholder="10-digit mobile number" maxLength={10} {...register("phone")} />
            {errors.phone && (
              <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <Label>
              Email <span className="text-destructive">*</span>
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
              Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
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
            <Label>
              Role <span className="text-destructive">*</span>
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
                <SelectItem value="buyer">Buyer — I want to buy produce</SelectItem>
                <SelectItem value="farmer">Farmer — I sell my produce</SelectItem>
                <SelectItem value="agent">Agent — I assist farmers</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-destructive text-xs mt-1">{errors.role.message}</p>
            )}
          </div>

          <div>
            <Label>Village / Town (optional)</Label>
            <Input placeholder="e.g. Shadnagar" {...register("village")} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Admin accounts are assigned manually. Contact the platform admin if you need admin access.
        </p>

        <p className="text-sm text-muted-foreground text-center mt-3">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
