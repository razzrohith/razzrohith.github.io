import {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from "react";
import { User } from "@supabase/supabase-js";
import {
  getSupabase, isSupabaseConfigured,
  UserProfile, UserRole, SignUpData,
  signIn as sbSignIn, signUp as sbSignUp, signOut as sbSignOut,
  getCurrentUserProfile,
} from "@/lib/supabase";

// ── Context shape ──────────────────────────────────────────────────────────

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (data: SignUpData) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  signIn: async () => ({ error: "Auth not ready" }),
  signUp: async () => ({ error: "Auth not ready", needsEmailConfirmation: false }),
  signOut: async () => {},
  refreshProfile: async () => {},
});

// ── Provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      async (_event, session) => {
        try {
          const u = session?.user ?? null;
          setUser(u);
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
    await sbSignOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        loading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshProfile,
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
