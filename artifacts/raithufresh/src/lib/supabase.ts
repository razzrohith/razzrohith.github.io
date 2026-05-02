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

// ── Auth types ──────────────────────────────────────────────────────────────

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

  // If role is farmer AND there's an active session (email confirmation disabled),
  // create the farmers row immediately. If no session (confirmation pending),
  // the dashboard will create it on first login.
  if (data.role === "farmer" && authData.session) {
    const { error: farmerError } = await sb.from("farmers").insert({
      user_id: authData.user.id,
      name: data.fullName.trim(),
      phone: data.phone.trim(),
      village: data.village?.trim() || null,
      assisted_mode: false,
      verified: false,
    });
    if (farmerError) {
      // Non-fatal: dashboard will create the farmers row on first login
      console.warn("Farmer row creation at signup failed:", farmerError.message);
    }
  }

  return { error: null };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

// ── Farmer helpers ──────────────────────────────────────────────────────────

/** Returns the farmers row linked to the currently authenticated user, or null. */
export async function getFarmerByCurrentUser(): Promise<SupabaseFarmer | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return null;

  const { data, error } = await getSupabase()
    .from("farmers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("getFarmerByCurrentUser error:", error.message);
    return null;
  }
  return data as SupabaseFarmer | null;
}

/**
 * Returns the farmers row for the current user, creating one from user_profiles
 * if it doesn't exist yet. Returns null if creation fails or user not authenticated.
 */
export async function getOrCreateFarmerForCurrentUser(
  profile: UserProfile
): Promise<SupabaseFarmer | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return null;

  // Try to get existing row first
  const existing = await getFarmerByCurrentUser();
  if (existing) return existing;

  // Create a new farmers row from user_profiles data
  const { data, error } = await getSupabase()
    .from("farmers")
    .insert({
      user_id: user.id,
      name: profile.full_name ?? "Farmer",
      phone: profile.phone ?? null,
      village: profile.village ?? null,
      district: profile.district ?? null,
      assisted_mode: false,
      verified: false,
    })
    .select()
    .single();

  if (error) {
    console.warn("getOrCreateFarmerForCurrentUser — create failed:", error.message);
    return null;
  }
  return data as SupabaseFarmer;
}

/** Fetches all produce_listings for a given farmer_id (any status). */
export async function getFarmerListings(farmerId: string): Promise<SupabaseListing[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .select("*, farmers(id, name, village, district, rating, phone)")
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getFarmerListings error:", error.message);
    return [];
  }
  return (data ?? []) as SupabaseListing[];
}

/** Inserts a new produce_listing for the given farmer_id. Returns the new row id. */
export async function createFarmerListing(
  farmerId: string,
  listing: Omit<ListingInsert, "farmer_id">
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .insert({ ...listing, farmer_id: farmerId })
    .select("id")
    .single();

  if (error) {
    console.warn("createFarmerListing error:", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

/** Updates the status of a produce_listing. Farmer RLS ensures only own listings. */
export async function updateListingStatus(
  listingId: string,
  status: "active" | "sold" | "out_of_stock" | "reserved"
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from("produce_listings")
    .update({ status })
    .eq("id", listingId);

  if (error) {
    console.warn("updateListingStatus error:", error.message);
    return false;
  }
  return true;
}

// ── Reservation helpers ─────────────────────────────────────────────────────

/**
 * Fetches all reservations for a farmer's own listings, joined with listing details.
 * Uses two queries: first get listing IDs, then get reservations for those IDs.
 * RLS on the reservations table enforces farmer ownership server-side.
 */
export async function getReservationsForFarmer(
  farmerId: string
): Promise<SupabaseReservation[]> {
  if (!isSupabaseConfigured()) return [];

  // Step 1: get this farmer's listing IDs
  const { data: listings, error: listingsError } = await getSupabase()
    .from("produce_listings")
    .select("id")
    .eq("farmer_id", farmerId);

  if (listingsError) {
    console.warn("getReservationsForFarmer — listings error:", listingsError.message);
    return [];
  }
  if (!listings || listings.length === 0) return [];

  const listingIds = (listings as { id: string }[]).map((l) => l.id);

  // Step 2: get reservations for those listings, joined with listing details
  const { data, error } = await getSupabase()
    .from("reservations")
    .select(
      "id, listing_id, buyer_name, buyer_phone, quantity_kg, status, payment_method, created_at, produce_listings(produce_name, price_per_kg, pickup_location, harvest_datetime)"
    )
    .in("listing_id", listingIds)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getReservationsForFarmer — reservations error:", error.message);
    return [];
  }
  // PostgREST join typing is an array type at compile time, but the actual data
  // for a many-to-one join (reservation.listing_id → produce_listings.id) is a
  // single object at runtime. Cast through unknown to satisfy the type checker.
  return (data ?? []) as unknown as SupabaseReservation[];
}

/**
 * Updates the status of a reservation. RLS ensures the farmer can only update
 * reservations linked to their own listings. Column-level GRANT restricts the
 * update to the status column only.
 */
export async function updateReservationStatus(
  reservationId: string,
  status: "pending" | "confirmed" | "cancelled" | "completed"
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from("reservations")
    .update({ status })
    .eq("id", reservationId);

  if (error) {
    console.warn("updateReservationStatus error:", error.message);
    return false;
  }
  return true;
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
  assisted_mode: boolean;
  user_id: string | null;
};

export type ReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type SupabaseReservation = {
  id: string;
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  quantity_kg: number;
  status: ReservationStatus;
  payment_method: string | null;
  created_at: string;
  produce_listings?: {
    produce_name: string;
    price_per_kg: number;
    pickup_location: string | null;
    harvest_datetime: string | null;
  } | null;
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
