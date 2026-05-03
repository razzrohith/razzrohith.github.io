import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import {
  getSupabase, isSupabaseConfigured,
  UserProfile, UserRole, SignUpData,
  signIn as sbSignIn, signUp as sbSignUp, signOut as sbSignOut,
  resetPasswordForEmail as sbResetPasswordForEmail,
  updatePassword as sbUpdatePassword,
  resendVerificationEmail as sbResendVerificationEmail,
  getCurrentUserProfile,
} from "@/lib/supabase";

// ── Context shape ──────────────────────────────────────────────────────────

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  recovering: boolean; // True during password recovery flow
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: SignUpData) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  resendVerification: (email: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  recovering: false,
  signIn: async () => ({ error: "Auth not ready" }),
  signUp: async () => ({ error: "Auth not ready", needsEmailConfirmation: false }),
  signOut: async () => {},
  refreshProfile: async () => {},
  resetPassword: async () => ({ error: "Auth not ready" }),
  updatePassword: async () => ({ error: "Auth not ready" }),
  resendVerification: async () => ({ error: "Auth not ready" }),
});

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  const loadProfile = useCallback(async (u: User) => {
    let p = await getCurrentUserProfile(u.id);

    // If no profile exists but the user has metadata (set during signUp),
    // create the profile now using the authenticated session. This handles
    // the case where email confirmation was required at signup time, so the
    // INSERT in signUp had no auth session and was blocked by RLS.
    if (!p && u.user_metadata?.role) {
      const meta = u.user_metadata as {
        full_name?: string;
        phone?: string;
        role?: string;
        village?: string;
      };
      const sb = getSupabase();

      // Double-check profile doesn't exist to avoid duplicate key errors.
      // getCurrentUserProfile may return null due to RLS timing, but the
      // profile may still exist. Use maybeSingle for a safer check.
      const { data: existingCheck } = await sb
        .from("user_profiles")
        .select("id")
        .eq("id", u.id)
        .maybeSingle();

      if (existingCheck) {
        // Profile already exists — just reload it, don't INSERT.
        p = await getCurrentUserProfile(u.id);
      } else {
        const { error } = await sb.from("user_profiles").insert({
          id: u.id,
          full_name: meta.full_name ?? null,
          phone: meta.phone ?? null,
          role: meta.role ?? null,
          village: meta.village ?? null,
        });
        if (!error) {
          p = await getCurrentUserProfile(u.id);
        } else {
          // Safety net: if INSERT failed due to duplicate key (race condition),
          // just load the existing profile instead of showing an error.
          const errMsg = error.message.toLowerCase();
          if (errMsg.includes("duplicate key") || errMsg.includes("unique constraint") || errMsg.includes("user_profiles_pkey")) {
            p = await getCurrentUserProfile(u.id);
          } else {
            console.warn("AuthContext: profile auto-create failed:", error.message);
          }
        }
      }

      // If role is farmer and no farmers row exists, create it now
      if (meta.role === "farmer" && p) {
        const { data: existingFarmer } = await sb
          .from("farmers")
          .select("id")
          .eq("user_id", u.id)
          .maybeSingle();
        if (!existingFarmer) {
          await sb.from("farmers").insert({
            user_id: u.id,
            name: meta.full_name ?? "Farmer",
            phone: meta.phone ?? null,
            village: meta.village ?? null,
            assisted_mode: false,
            verified: false,
          });
        }
      }
    }

    setProfile(p);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const sb = getSupabase();

    sb.auth.getSession().then(async ({ data: { session } }) => {
      try {
        const u = session?.user ?? null;
        setUser(u);
        if (u) await loadProfile(u);
      } catch (err) {
        console.error("Auth session load error:", err);
      } finally {
        setLoading(false);
      }
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange(
      async (event, session) => {
        try {
          const u = session?.user ?? null;
          setUser(u);

          if (event === "PASSWORD_RECOVERY") {
            setRecovering(true);
          } else if (event === "SIGNED_IN") {
            // If we were recovering, keep the flag until explicit logout or reset
            // but we usually want to know they are "in" now.
          } else if (event === "SIGNED_OUT") {
            setRecovering(false);
          }

          if (u) {
            await loadProfile(u);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error("Auth state change error:", err);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const handleSignIn = async (email: string, password: string) => {
    return sbSignIn(email, password);
  };

  const handleSignUp = async (data: SignUpData) => {
    return sbSignUp(data);
  };

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  const handleSignOut = async () => {
    try {
      await sbSignOut();
    } catch (err) {
      console.warn("AuthContext: sbSignOut error:", err);
    } finally {
      // Always clear local state even if Supabase call fails
      setUser(null);
      setProfile(null);
      setRecovering(false);
      // Clear app-specific local storage keys to ensure fresh state on next login
      try {
        localStorage.removeItem("raithu_farmer_new_pending");
        localStorage.removeItem("raithu_farmer_last_visit_ts");
      } catch { /* ignore storage errors */ }
    }
  };

  const handleResetPassword = async (email: string) => {
    return sbResetPasswordForEmail(email);
  };

  const handleUpdatePassword = async (password: string) => {
    return sbUpdatePassword(password);
  };

  const handleResendVerification = async (email: string) => {
    return sbResendVerificationEmail(email);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        recovering,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile,
        resetPassword: handleResetPassword,
        updatePassword: handleUpdatePassword,
        resendVerification: handleResendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}
