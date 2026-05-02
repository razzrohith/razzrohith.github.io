import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
