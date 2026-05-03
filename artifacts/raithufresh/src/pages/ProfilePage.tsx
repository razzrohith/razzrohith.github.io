import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { User, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile, isSupabaseConfigured, normalizePhone, isValidPhone } from "@/lib/supabase";
import BilingualLabel from "@/components/BilingualLabel";

const ROLE_COLORS: Record<string, string> = {
  farmer: "bg-green-100 text-green-700 border-green-200",
  agent: "bg-blue-100 text-blue-700 border-blue-200",
  admin: "bg-purple-100 text-purple-700 border-purple-200",
  buyer: "bg-amber-100 text-amber-700 border-amber-200",
};

const profileSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().refine((val) => isValidPhone(val), "Enter a valid 10-digit mobile number starting with 6-9"),
  village: z.string().optional(),
  district: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      village: "",
      district: "",
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? "",
        phone: profile.phone ?? "",
        village: profile.village ?? "",
        district: profile.district ?? "",
      });
    }
  }, [profile, reset]);

  const onSubmit = async (data: ProfileForm) => {
    if (!isSupabaseConfigured()) {
      toast.error("Supabase is not configured. Profile updates require a live connection.");
      return;
    }
    setSaving(true);
    const normalizedPhone = normalizePhone(data.phone);
    const { error } = await updateUserProfile({
      full_name: data.full_name.trim(),
      phone: normalizedPhone,
      village: data.village?.trim() || null,
      district: data.district?.trim() || null,
    });
    setSaving(false);
    if (error) {
      if (error.toLowerCase().includes("unique constraint") || error.toLowerCase().includes("user_profiles_phone_unique_idx")) {
        toast.error("This phone number is already registered by another user.");
      } else {
        toast.error(`Could not save profile: ${error}`);
      }
    } else {
      await refreshProfile();
      toast.success("Profile updated successfully.");
      reset(data);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">Not logged in</p>
          <p className="text-sm text-muted-foreground">Please log in to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              <BilingualLabel en="Your Profile" te="మీ ప్రొఫైల్" />
            </h1>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-4">
          {/* Role — read-only */}
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">
              <BilingualLabel en="Account role" te="ఖాతా రకం" />
            </span>
            {profile?.role ? (
              <Badge
                className={`text-[10px] px-2 py-0.5 border ml-auto ${ROLE_COLORS[profile.role] ?? "bg-muted text-muted-foreground"}`}
              >
                {profile.role}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground ml-auto">Unknown</span>
            )}
            <span className="text-xs text-muted-foreground">(read-only)</span>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>
                <BilingualLabel en="Full Name" te="పూర్తి పేరు" /> <span className="text-destructive">*</span>
              </Label>
              <Input placeholder="Your name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-destructive text-xs mt-1">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Phone" te="ఫోన్" /> <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="10-digit mobile number"
                maxLength={10}
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  <BilingualLabel en="Village / Town" te="గ్రామం / పట్టణం" />
                </Label>
                <Input placeholder="e.g. Shadnagar" {...register("village")} />
              </div>
              <div>
                <Label>
                  <BilingualLabel en="District" te="జిల్లా" />
                </Label>
                <Input placeholder="e.g. Rangareddy" {...register("district")} />
              </div>
            </div>

            {!isSupabaseConfigured() && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                Supabase not configured — profile saves are disabled in demo mode.
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-auto py-2"
              disabled={saving || !isDirty || !isSupabaseConfigured()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <BilingualLabel en="Save Changes" te="మార్పులను సేవ్ చేయండి" orientation="stacked" />
              )}
            </Button>
          </form>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Your role cannot be changed here. Contact an admin to update your account role.
        </p>
      </div>
    </div>
  );
}
