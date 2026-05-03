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

export async function signUp(
  data: SignUpData
): Promise<{ error: string | null; needsEmailConfirmation: boolean }> {
  if (!isSupabaseConfigured())
    return { error: "Supabase is not configured.", needsEmailConfirmation: false };
  const sb = getSupabase();

  // Store profile fields in user_metadata so they can be recovered
  // on first login even if the INSERT below fails (e.g. when email
  // confirmation is enabled and there is no auth session yet).
  const { data: authData, error: signUpError } = await sb.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.fullName.trim(),
        phone: data.phone.trim(),
        role: data.role,
        village: data.village?.trim() || null,
      },
    },
  });

  if (signUpError) return { error: signUpError.message, needsEmailConfirmation: false };
  if (!authData.user) return { error: "Signup failed — no user returned.", needsEmailConfirmation: false };

  const needsEmailConfirmation = !authData.session;

  // Attempt to insert the profile. This will succeed when email confirmation
  // is disabled (session exists immediately). When confirmation is required
  // there is no session so RLS will block the INSERT; the profile will be
  // created by AuthContext.loadProfile on the first login instead.
  const { error: profileError } = await sb.from("user_profiles").insert({
    id: authData.user.id,
    full_name: data.fullName.trim(),
    phone: data.phone.trim(),
    role: data.role,
    village: data.village?.trim() || null,
  });

  if (profileError && !needsEmailConfirmation) {
    return {
      error: `Account created but profile save failed: ${profileError.message}`,
      needsEmailConfirmation: false,
    };
  }

  // If farmer role and session exists, create the farmers row immediately.
  // Without a session the FarmerDashboard will create it on first login.
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
      console.warn("Farmer row creation at signup failed:", farmerError.message);
    }
  }

  return { error: null, needsEmailConfirmation };
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

/**
 * Fetches a single produce_listing by id, joined with farmer info.
 * Works for both anon (public_read_active_listings enforces status='active')
 * and authenticated users (auth_read_listings allows all statuses).
 * Returns null if listing does not exist or RLS blocks access.
 */
export async function getProduceListingById(id: string): Promise<SupabaseListing | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .select("*, farmers(id, name, village, district, rating, phone, verified)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("getProduceListingById error:", error.message);
    return null;
  }
  return data as SupabaseListing | null;
}

/** Fetches a single farmer's public profile by farmers.id (anon-safe). */
export async function getFarmerProfileById(farmerId: string): Promise<SupabaseFarmer | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase()
    .from("farmers")
    .select("id, name, village, district, rating, phone, verified, assisted_mode, user_id")
    .eq("id", farmerId)
    .maybeSingle();
  if (error) {
    console.warn("getFarmerProfileById error:", error.message);
    return null;
  }
  return data as SupabaseFarmer | null;
}

/**
 * Fetches up to 3 other active listings from the same farmer, excluding the current listing.
 * Public-safe: no phone exposed in the farmer join.
 */
export async function getOtherActiveListingsByFarmer(
  farmerId: string,
  excludeListingId: string
): Promise<SupabaseListing[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .select(
      "id, farmer_id, produce_name, category, price_per_kg, quantity_kg, harvest_datetime, pickup_location, district, distance_km, quality_notes, status, farmers(id, name, village, district, rating, verified)"
    )
    .eq("farmer_id", farmerId)
    .eq("status", "active")
    .neq("id", excludeListingId)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) {
    console.warn("getOtherActiveListingsByFarmer error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as SupabaseListing[];
}

/** Fetches all active produce_listings for a given farmer_id. Public (RLS: status=active for anon). */
export async function getActiveListingsByFarmer(farmerId: string): Promise<SupabaseListing[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .select("*, farmers(id, name, village, district, rating, phone, verified)")
    .eq("farmer_id", farmerId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("getActiveListingsByFarmer error:", error.message);
    return [];
  }
  return (data ?? []) as SupabaseListing[];
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

/**
 * Updates safe editable fields of a produce_listing.
 * Protected fields (id, farmer_id, created_at) are never touched here.
 * Farmer RLS ensures a farmer can only update their own listings.
 */
export async function updateListing(
  listingId: string,
  fields: Partial<{
    produce_name: string;
    category: "Fruit" | "Vegetable";
    quantity_kg: number;
    price_per_kg: number;
    harvest_datetime: string;
    pickup_location: string;
    district: string;
    quality_notes: string;
    status: "active" | "sold" | "out_of_stock" | "reserved";
  }>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from("produce_listings")
    .update(fields)
    .eq("id", listingId);
  if (error) {
    console.warn("updateListing error:", error.message);
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
    verified?: boolean | null;
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

// ── Landing page helpers ─────────────────────────────────────────────────────

/**
 * Fetches up to 6 verified farmers for the landing page farmer discovery section.
 * Returns only public-safe fields — NO phone number.
 * Ordered by rating descending so the best-rated farmers appear first.
 */
export async function getLandingFarmers(): Promise<LandingFarmer[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("farmers")
    .select("id, name, village, district, rating, verified")
    .eq("verified", true)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(6);
  if (error) {
    console.warn("getLandingFarmers error:", error.message);
    return [];
  }
  return (data ?? []) as LandingFarmer[];
}

/**
 * Fetches up to 15 active produce listings for the landing page preview section.
 * Returns only status=active (enforced by RLS for anon users).
 * The caller can slice to 6 for display and use the full set for listing counts.
 */
export async function getLandingListings(): Promise<SupabaseListing[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("produce_listings")
    .select(
      "id, farmer_id, produce_name, category, price_per_kg, quantity_kg, harvest_datetime, pickup_location, district, distance_km, quality_notes, status, farmers(id, name, village, district, rating, phone, verified)"
    )
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(15);
  if (error) {
    console.warn("getLandingListings error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as SupabaseListing[];
}

export type LandingStats = {
  verifiedFarmers: number;
  activeListings: number;
  districtsCovered: number;
  fruitListings: number;
  vegetableListings: number;
};

/**
 * Fetches aggregate stats for the landing page trust strip.
 * Public-safe: no phone, no buyer data, no reservations, no admin data.
 * Two parallel queries: verified farmer count + active listing breakdown.
 */
export async function getLandingStats(): Promise<LandingStats> {
  const empty: LandingStats = {
    verifiedFarmers: 0,
    activeListings: 0,
    districtsCovered: 0,
    fruitListings: 0,
    vegetableListings: 0,
  };
  if (!isSupabaseConfigured()) return empty;
  try {
    const sb = getSupabase();
    const [
      { count: farmerCount },
      { data: listingRows },
    ] = await Promise.all([
      sb.from("farmers")
        .select("*", { count: "exact", head: true })
        .eq("verified", true),
      sb.from("produce_listings")
        .select("category, district")
        .eq("status", "active"),
    ]);
    const rows = (listingRows ?? []) as { category: string; district: string | null }[];
    const districts = new Set(rows.map((r) => r.district).filter(Boolean));
    return {
      verifiedFarmers: farmerCount ?? 0,
      activeListings: rows.length,
      districtsCovered: districts.size,
      fruitListings: rows.filter((r) => r.category === "Fruit").length,
      vegetableListings: rows.filter((r) => r.category === "Vegetable").length,
    };
  } catch (e) {
    console.warn("getLandingStats error:", e);
    return empty;
  }
}

export type LandingFarmer = {
  id: string;
  name: string;
  village: string | null;
  district: string | null;
  rating: number | null;
  verified: boolean;
};

// ── Admin reservation helpers ────────────────────────────────────────────────

/**
 * Fetches all reservations for admin users, with a three-level join:
 * reservations → produce_listings → farmers.
 * RLS ensures only admin users (user_profiles.role = 'admin') can call this.
 */
export async function getAllReservationsForAdmin(): Promise<AdminReservation[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await getSupabase()
    .from("reservations")
    .select(
      "id, buyer_name, buyer_phone, quantity_kg, status, payment_method, created_at, produce_listings(produce_name, price_per_kg, farmers(name, village, district))"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getAllReservationsForAdmin error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as AdminReservation[];
}

/**
 * Admin-facing reservation status update. RLS ensures only admin users
 * (user_profiles.role = 'admin') can call this. Column-level GRANT restricts
 * the update to the status column only.
 */
export async function updateAdminReservationStatus(
  reservationId: string,
  status: ReservationStatus
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from("reservations")
    .update({ status })
    .eq("id", reservationId);

  if (error) {
    console.warn("updateAdminReservationStatus error:", error.message);
    return false;
  }
  return true;
}

export type AdminReservation = {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  quantity_kg: number;
  status: ReservationStatus;
  payment_method: string | null;
  created_at: string;
  produce_listings?: {
    produce_name: string;
    price_per_kg: number;
    farmers?: {
      name: string;
      village: string | null;
      district: string | null;
    } | null;
  } | null;
};

/**
 * Reservation record joined with listing + farmer details for the buyer's own dashboard.
 * buyer_phone is intentionally omitted — buyers know their own phone.
 * farmer phone IS included for pickup coordination (shown via ContactFarmerDialog only).
 */
export type BuyerReservation = {
  id: string;
  listing_id: string;
  buyer_name: string;
  quantity_kg: number;
  status: ReservationStatus;
  payment_method: string | null;
  created_at: string;
  produce_listings?: {
    produce_name: string;
    category: string;
    price_per_kg: number;
    pickup_location: string | null;
    farmers?: {
      name: string;
      village: string | null;
      district: string | null;
      phone: string | null;
    } | null;
  } | null;
};

/**
 * Cancels a buyer's own pending reservation.
 * RLS enforces:
 *   USING  buyer_user_id = auth.uid() AND status = 'pending'
 *   WITH CHECK buyer_user_id = auth.uid() AND status = 'cancelled'
 * So buyers can only cancel their own pending reservations and cannot
 * set any other status, update protected fields, or touch another buyer's row.
 */
export async function cancelBuyerReservation(reservationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const { error } = await getSupabase()
    .from("reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId);
  if (error) {
    console.warn("cancelBuyerReservation error:", error.message);
    return false;
  }
  return true;
}

/**
 * Fetches all reservations for the currently logged-in buyer.
 * RLS enforces buyer_user_id = auth.uid() server-side — buyers can only see their own.
 * Farmer phone is included for ContactFarmerDialog (pickup coordination).
 * buyer_phone is intentionally NOT selected — buyers know their own phone.
 */
/**
 * Returns BuyerReservation[] on success (may be empty []), null on fetch error.
 * Callers should treat null as a network/DB error and show an error state.
 * Returns [] (not null) for the non-error cases: Supabase not configured, or
 * user not logged in (shouldn't happen inside a ProtectedRoute).
 */
export async function getReservationsForCurrentBuyer(): Promise<BuyerReservation[] | null> {
  if (!isSupabaseConfigured()) return [];
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return [];

  const { data, error } = await getSupabase()
    .from("reservations")
    .select(
      "id, listing_id, buyer_name, quantity_kg, status, payment_method, created_at, produce_listings(produce_name, category, price_per_kg, pickup_location, farmers(name, village, district, phone))"
    )
    .eq("buyer_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("getReservationsForCurrentBuyer error:", error.message);
    return null;
  }
  return (data ?? []) as unknown as BuyerReservation[];
}

export type BuyerReservationDetail = {
  id: string;
  listing_id: string;
  buyer_name: string;
  quantity_kg: number;
  status: ReservationStatus;
  payment_method: string | null;
  created_at: string;
  produce_listings?: {
    produce_name: string;
    category: string;
    price_per_kg: number;
    harvest_datetime: string | null;
    pickup_location: string | null;
    district: string | null;
    status: string;
    farmers?: {
      id?: string;
      name: string;
      village: string | null;
      district: string | null;
      rating: number | null;
      verified: boolean | null;
      phone: string | null;
    } | null;
  } | null;
};

/**
 * Fetches a single reservation for the currently logged-in buyer by ID.
 * Client-side guard: .eq("buyer_user_id", user.id) + RLS SELECT policy.
 * Returns null if not found, not owned by current buyer, or not logged in.
 * Farmer phone included for ContactFarmerDialog (own reservation context only).
 */
export async function getBuyerReservationById(
  reservationId: string
): Promise<BuyerReservationDetail | null> {
  if (!isSupabaseConfigured()) return null;
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return null;

  const { data, error } = await getSupabase()
    .from("reservations")
    .select(
      "id, listing_id, buyer_name, quantity_kg, status, payment_method, created_at, " +
      "produce_listings(produce_name, category, price_per_kg, harvest_datetime, pickup_location, district, status, " +
      "farmers(id, name, village, district, rating, verified, phone))"
    )
    .eq("id", reservationId)
    .eq("buyer_user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("getBuyerReservationById error:", error.message);
    return null;
  }
  return data as unknown as BuyerReservationDetail | null;
}

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

export async function updateUserProfile(
  updates: Partial<Pick<UserProfile, "full_name" | "phone" | "village" | "district">>
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: "Supabase is not configured." };
  const { data: { user } } = await getSupabase().auth.getUser();
  if (!user) return { error: "Not authenticated." };
  const { error } = await getSupabase()
    .from("user_profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) return { error: error.message };
  return { error: null };
}
