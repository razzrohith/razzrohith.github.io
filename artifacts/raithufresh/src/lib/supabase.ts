import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normalizeSupabaseUrl(url: string): string {
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

const supabaseUrl = rawUrl ? normalizeSupabaseUrl(rawUrl) : undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && supabaseUrl.startsWith("https://") &&
    supabaseAnonKey && supabaseAnonKey.length > 10
  );
}

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
  if (!_client) {
    _client = createClient(supabaseUrl!, supabaseAnonKey!);
  }
  return _client;
}

// ── Auth types ─────────────────────────────────────────────────────────────

export type UserRole = "buyer" | "farmer" | "agent" | "admin";

export type UserProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole | null;
  village: string | null;
  district: string | null;
  created_at: string;
};

export type SignUpData = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: Exclude<UserRole, "admin">;
  village?: string;
};

// ── Auth helpers ────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase().auth.getUser();
  return data.user ?? null;
}

export async function getCurrentUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as UserProfile;
}

export async function getCurrentUserRole(userId: string): Promise<UserRole | null> {
  const profile = await getCurrentUserProfile(userId);
  return profile?.role ?? null;
}

export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signUp(data: SignUpData): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const sb = getSupabase();

  const { data: authData, error: signUpError } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
  });

  if (signUpError) return { error: signUpError.message };
  if (!authData.user) return { error: "Signup failed — no user returned." };

  const { error: profileError } = await sb.from("user_profiles").insert({
    id: authData.user.id,
    full_name: data.fullName.trim(),
    phone: data.phone.trim(),
    role: data.role,
    village: data.village?.trim() || null,
  });

  if (profileError) {
    return { error: `Account created but profile save failed: ${profileError.message}` };
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

// ── Table types ─────────────────────────────────────────────────────────────

export type WaitlistInsert = {
  name: string;
  phone: string;
  role: string;
  town?: string;
};

export type ReservationInsert = {
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  quantity_kg: number;
};

export type ListingInsert = {
  farmer_id: string;
  produce_name: string;
  category: "Fruit" | "Vegetable";
  quantity_kg: number;
  price_per_kg: number;
  harvest_datetime: string;
  pickup_location: string;
  quality_notes?: string;
};

export type SupabaseListing = {
  id: string;
  farmer_id: string;
  produce_name: string;
  category: "Fruit" | "Vegetable";
  quantity_kg: number;
  price_per_kg: number;
  harvest_datetime: string | null;
  pickup_location: string | null;
  district: string | null;
  distance_km: number | null;
  quality_notes: string | null;
  status: string;
  farmers?: {
    id: string;
    name: string;
    village: string | null;
    district: string | null;
    rating: number | null;
    phone: string | null;
  } | null;
};

export type SupabaseFarmer = {
  id: string;
  name: string;
  village: string | null;
  district: string | null;
  rating: number | null;
  phone: string | null;
  verified: boolean;
};

export type AgentCallRequestStatus = "pending" | "called" | "resolved";

export type AgentCallRequestInsert = {
  farmer_name: string;
  farmer_phone: string;
  village?: string;
  request_note?: string;
  status: AgentCallRequestStatus;
};

export type AgentCallRequest = {
  id: string;
  farmer_name: string;
  farmer_phone: string;
  village: string | null;
  request_note: string | null;
  status: AgentCallRequestStatus;
  created_at: string;
};
