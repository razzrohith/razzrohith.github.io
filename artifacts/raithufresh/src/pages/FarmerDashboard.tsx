import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Star, Edit, Package, CheckCircle, User, MapPin, Phone, Loader2,
  Bell, X, RefreshCw, RotateCcw, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { mockFarmers, mockListings } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import {
  isSupabaseConfigured, getSupabase,
  SupabaseFarmer, SupabaseListing, SupabaseReservation, ReservationStatus,
  getOrCreateFarmerForCurrentUser, getFarmerListings,
  createFarmerListing, updateListingStatus, updateListing,
  getReservationsForFarmer, updateReservationStatus,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import BilingualLabel from "@/components/BilingualLabel";

// ── Schemas ──────────────────────────────────────────────────────────────────

const listingSchema = z.object({
  name: z.string().min(2, "Produce name is required"),
  category: z.enum(["Fruit", "Vegetable"], { required_error: "Select a category" }),
  quantityKg: z.coerce.number().min(1, "Enter quantity"),
  pricePerKg: z.coerce.number().min(1, "Enter price"),
  harvestDate: z.string().min(1, "Select harvest date"),
  pickupLocation: z.string().min(2, "Enter pickup location"),
  phone: z.string().length(10, "Enter 10-digit phone number"),
  qualityNotes: z.string().optional(),
});
type ListingForm = z.infer<typeof listingSchema>;

const editSchema = z.object({
  name: z.string().min(2, "Produce name is required"),
  category: z.enum(["Fruit", "Vegetable"], { required_error: "Select a category" }),
  quantityKg: z.coerce.number().min(0, "Enter quantity"),
  pricePerKg: z.coerce.number().min(1, "Enter price"),
  harvestDate: z.string().min(1, "Select harvest date"),
  pickupLocation: z.string().min(2, "Enter pickup location"),
  district: z.string().optional(),
  qualityNotes: z.string().optional(),
  status: z.enum(["Available", "Sold", "Out of Stock"]),
});
type EditForm = z.infer<typeof editSchema>;

// ── Constants & helpers ──────────────────────────────────────────────────────

const ACTIVE_FARMER = mockFarmers[0];

type ResFilter = "all" | ReservationStatus;

const FILTERS: { label: string; teLabel: string; value: ResFilter }[] = [
  { label: "All", teLabel: "అన్నీ", value: "all" },
  { label: "Pending", teLabel: "వేచి ఉన్నాయి", value: "pending" },
  { label: "Confirmed", teLabel: "నిర్ధారించబడ్డాయి", value: "confirmed" },
  { label: "Completed", teLabel: "పూర్తయ్యాయి", value: "completed" },
  { label: "Cancelled", teLabel: "రద్దు చేయబడ్డాయి", value: "cancelled" },
];

const RESERVATION_STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  confirmed: "bg-blue-100  text-blue-700  border-blue-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100   text-red-700   border-red-200",
};

function ReservationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={`text-xs border ${RESERVATION_STATUS_STYLES[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function supabaseStatusToLocal(status: string): ProduceListing["status"] {
  if (status === "sold") return "Sold";
  if (status === "out_of_stock") return "Out of Stock";
  return "Available";
}

function localStatusToSupabase(
  status: ProduceListing["status"]
): "active" | "sold" | "out_of_stock" | "reserved" {
  if (status === "Sold") return "sold";
  if (status === "Out of Stock") return "out_of_stock";
  return "active";
}

function supabaseToLocal(sl: SupabaseListing): ProduceListing {
  return {
    id: sl.id,
    farmerId: sl.farmer_id,
    name: sl.produce_name,
    category: sl.category,
    pricePerKg: sl.price_per_kg,
    quantityKg: sl.quantity_kg,
    harvestDate: sl.harvest_datetime ? sl.harvest_datetime.split("T")[0] : "",
    pickupLocation: sl.pickup_location ?? "",
    distanceKm: sl.distance_km ?? 0,
    qualityNotes: sl.quality_notes ?? undefined,
    status: supabaseStatusToLocal(sl.status),
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FarmerDashboard() {
  const { user, profile } = useAuth();

  // ── Farmer + listings ─────────────────────────────────────────────────────

  const [farmerRow, setFarmerRow] = useState<SupabaseFarmer | null>(null);
  const [farmerLoading, setFarmerLoading] = useState(false);
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [rawListings, setRawListings] = useState<SupabaseListing[]>([]);
  const [listingsLoaded, setListingsLoaded] = useState(false);
  const [listingsError, setListingsError] = useState<string | null>(null);

  // ── Create listing form ───────────────────────────────────────────────────

  const [showForm, setShowForm] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Edit listing modal ────────────────────────────────────────────────────

  const [editingListing, setEditingListing] = useState<ProduceListing | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editCategoryValue, setEditCategoryValue] = useState("");
  const [editStatusValue, setEditStatusValue] = useState<ProduceListing["status"]>("Available");

  // ── Quick quantity update ─────────────────────────────────────────────────

  const [quickQtyId, setQuickQtyId] = useState<string | null>(null);
  const [quickQtyValue, setQuickQtyValue] = useState("");
  const [quickQtySaving, setQuickQtySaving] = useState(false);

  // ── Reservations ──────────────────────────────────────────────────────────

  const [reservations, setReservations] = useState<SupabaseReservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [updatingReservation, setUpdatingReservation] = useState<string | null>(null);
  const [refreshingReservations, setRefreshingReservations] = useState(false);
  const [reservationFilter, setReservationFilter] = useState<ResFilter>("all");

  // ── Notifications ─────────────────────────────────────────────────────────

  const [newPendingCount, setNewPendingCount] = useState(0);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // ── Realtime ──────────────────────────────────────────────────────────────

  const [realtimeConnected, setRealtimeConnected] = useState<boolean | null>(null);

  // ── Forms ─────────────────────────────────────────────────────────────────

  const {
    register, handleSubmit, setValue, reset, formState: { errors },
  } = useForm<ListingForm>({ resolver: zodResolver(listingSchema) });

  const {
    register: regEdit,
    handleSubmit: handleEditSubmit,
    setValue: setEditValue,
    reset: resetEdit,
    formState: { errors: editErrors },
  } = useForm<EditForm>({ resolver: zodResolver(editSchema) });

  // ── Notification helpers ──────────────────────────────────────────────────

  const markAllSeen = () => {
    setNewPendingCount(0);
    setBannerDismissed(true);
    localStorage.setItem("raithu_farmer_new_pending", "0");
    localStorage.setItem("raithu_farmer_last_visit_ts", new Date().toISOString());
    window.dispatchEvent(new CustomEvent("raithu_farmer_badge_update"));
  };

  // ── Load farmer data ──────────────────────────────────────────────────────

  const loadFarmerData = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !profile) {
      setListings(mockListings.filter((l) => l.farmerId === ACTIVE_FARMER.id));
      setListingsLoaded(true);
      return;
    }

    const prevTs = localStorage.getItem("raithu_farmer_last_visit_ts");
    const prevLastVisit = prevTs ? new Date(prevTs) : new Date(0);
    localStorage.setItem("raithu_farmer_last_visit_ts", new Date().toISOString());

    setFarmerLoading(true);
    setReservationsLoading(true);
    setListingsError(null);
    setReservationsError(null);
    try {
      const farmer = await getOrCreateFarmerForCurrentUser(profile);
      setFarmerRow(farmer);

      if (farmer) {
        const [sbListings, sbReservations] = await Promise.all([
          getFarmerListings(farmer.id),
          getReservationsForFarmer(farmer.id),
        ]);
        setListings(sbListings.map(supabaseToLocal));
        setRawListings(sbListings);
        setReservations(sbReservations);

        const newCount = sbReservations.filter(
          (r) => r.status === "pending" && new Date(r.created_at) > prevLastVisit
        ).length;
        setNewPendingCount(newCount);
        localStorage.setItem("raithu_farmer_new_pending", String(newCount));
      } else {
        setListings([]);
        setRawListings([]);
        setReservations([]);
      }
    } catch {
      setListingsError("Could not load your listings. Please try again.");
      setReservationsError("Could not load reservations. Please try again.");
      setListings([]);
      setRawListings([]);
      setReservations([]);
    } finally {
      setFarmerLoading(false);
      setReservationsLoading(false);
      setListingsLoaded(true);
    }
  }, [user, profile]);

  // ── Refresh reservations only ─────────────────────────────────────────────

  const refreshReservations = useCallback(async () => {
    if (!isSupabaseConfigured() || !farmerRow) return;
    setRefreshingReservations(true);
    setReservationsError(null);
    try {
      const sbReservations = await getReservationsForFarmer(farmerRow.id);
      setReservations(sbReservations);

      const prevTs = localStorage.getItem("raithu_farmer_last_visit_ts");
      const prevLastVisit = prevTs ? new Date(prevTs) : new Date(0);
      const newCount = sbReservations.filter(
        (r) => r.status === "pending" && new Date(r.created_at) > prevLastVisit
      ).length;
      setNewPendingCount(newCount);
      localStorage.setItem("raithu_farmer_new_pending", String(newCount));
      window.dispatchEvent(new CustomEvent("raithu_farmer_badge_update"));
    } catch {
      setReservationsError("Could not load reservations. Please try again.");
    } finally {
      setRefreshingReservations(false);
    }
  }, [farmerRow]);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadFarmerData();
  }, [loadFarmerData]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isSupabaseConfigured() || !farmerRow) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let realtimeChannel: any;
    try {
      realtimeChannel = getSupabase()
        .channel(`farmer-res-${farmerRow.id}`)
        .on(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          "postgres_changes" as any,
          { event: "*", schema: "public", table: "reservations" },
          () => {
            refreshReservations();
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            setRealtimeConnected(true);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setRealtimeConnected(false);
          }
        });
    } catch {
      setRealtimeConnected(false);
    }

    return () => {
      if (realtimeChannel) {
        try { getSupabase().removeChannel(realtimeChannel); } catch { /* ignore */ }
      }
    };
  }, [farmerRow, refreshReservations]);

  // ── Reservation status update ─────────────────────────────────────────────

  const handleReservationStatus = async (
    reservationId: string,
    newStatus: ReservationStatus
  ) => {
    setUpdatingReservation(reservationId);
    const ok = await updateReservationStatus(reservationId, newStatus);
    setUpdatingReservation(null);
    if (ok) {
      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, status: newStatus } : r))
      );
      toast.success(`Reservation marked as ${newStatus}.`);
    } else {
      toast.error("Could not update reservation status. Try again.");
    }
  };

  // ── Listing status update (including Reactivate) ──────────────────────────

  const updateStatus = async (id: string, status: ProduceListing["status"]) => {
    if (isSupabaseConfigured() && farmerRow) {
      const ok = await updateListingStatus(id, localStatusToSupabase(status));
      if (!ok) {
        toast.error("Could not update listing status. Try again.");
        return;
      }
    }
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    setRawListings((prev) =>
      prev.map((l) => l.id === id ? { ...l, status: localStatusToSupabase(status) } : l)
    );
    const msg =
      status === "Available" ? "Listing reactivated." : `Listing marked as ${status}.`;
    toast.success(msg);
  };

  // ── Create listing ────────────────────────────────────────────────────────

  const onSubmit = async (data: ListingForm) => {
    setSubmitting(true);

    const localListing: ProduceListing = {
      id: `p${Date.now()}`,
      farmerId: farmerRow?.id ?? ACTIVE_FARMER.id,
      name: data.name,
      category: data.category,
      pricePerKg: data.pricePerKg,
      quantityKg: data.quantityKg,
      harvestDate: data.harvestDate,
      pickupLocation: data.pickupLocation,
      distanceKm: 0,
      qualityNotes: data.qualityNotes,
      status: "Available",
    };

    try {
      if (isSupabaseConfigured() && farmerRow) {
        const newId = await createFarmerListing(farmerRow.id, {
          produce_name: data.name,
          category: data.category,
          quantity_kg: data.quantityKg,
          price_per_kg: data.pricePerKg,
          harvest_datetime: new Date(data.harvestDate).toISOString(),
          pickup_location: data.pickupLocation,
          quality_notes: data.qualityNotes || undefined,
        });

        if (newId) {
          localListing.id = newId;
          toast.success("Listing saved to database.");
        } else {
          toast.error("Listing could not be saved. Check your connection.");
          setSubmitting(false);
          return;
        }
      } else {
        toast.success("Listing added successfully.");
      }
    } catch (e) {
      console.warn("Listing save error:", e);
      toast.error("Listing could not be saved.");
      setSubmitting(false);
      return;
    }

    setListings((prev) => [localListing, ...prev]);
    reset();
    setCategoryValue("");
    setShowForm(false);
    setSubmitting(false);
  };

  // ── Edit listing ──────────────────────────────────────────────────────────

  const handleEditOpen = (listing: ProduceListing) => {
    const raw = rawListings.find((l) => l.id === listing.id);
    setEditingListing(listing);
    setEditCategoryValue(listing.category);
    setEditStatusValue(listing.status);
    resetEdit({
      name: listing.name,
      category: listing.category,
      quantityKg: listing.quantityKg,
      pricePerKg: listing.pricePerKg,
      harvestDate: listing.harvestDate,
      pickupLocation: listing.pickupLocation,
      district: raw?.district ?? "",
      qualityNotes: listing.qualityNotes ?? "",
      status: listing.status,
    });
  };

  const onEditSave = async (data: EditForm) => {
    if (!editingListing) return;
    setEditSubmitting(true);

    const supaStatus = localStatusToSupabase(data.status);

    if (isSupabaseConfigured() && farmerRow) {
      const ok = await updateListing(editingListing.id, {
        produce_name: data.name,
        category: data.category,
        quantity_kg: data.quantityKg,
        price_per_kg: data.pricePerKg,
        harvest_datetime: new Date(data.harvestDate).toISOString(),
        pickup_location: data.pickupLocation,
        district: data.district || undefined,
        quality_notes: data.qualityNotes || undefined,
        status: supaStatus,
      });
      if (!ok) {
        toast.error("Could not save changes. Try again.");
        setEditSubmitting(false);
        return;
      }
      toast.success("Listing updated.");
    } else {
      toast.success("Listing updated successfully.");
    }

    setListings((prev) =>
      prev.map((l) =>
        l.id === editingListing.id
          ? {
              ...l,
              name: data.name,
              category: data.category,
              quantityKg: data.quantityKg,
              pricePerKg: data.pricePerKg,
              harvestDate: data.harvestDate,
              pickupLocation: data.pickupLocation,
              qualityNotes: data.qualityNotes || undefined,
              status: data.status,
            }
          : l
      )
    );
    setRawListings((prev) =>
      prev.map((l) =>
        l.id === editingListing.id
          ? {
              ...l,
              produce_name: data.name,
              category: data.category,
              quantity_kg: data.quantityKg,
              price_per_kg: data.pricePerKg,
              harvest_datetime: new Date(data.harvestDate).toISOString(),
              pickup_location: data.pickupLocation,
              district: data.district || null,
              quality_notes: data.qualityNotes || null,
              status: supaStatus,
            }
          : l
      )
    );

    setEditingListing(null);
    setEditSubmitting(false);
  };

  // ── Quick quantity update ─────────────────────────────────────────────────

  const handleQuickQtySave = async (listingId: string) => {
    const newQty = parseFloat(quickQtyValue);
    if (isNaN(newQty) || newQty < 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    setQuickQtySaving(true);
    if (isSupabaseConfigured() && farmerRow) {
      const ok = await updateListing(listingId, { quantity_kg: newQty });
      if (!ok) {
        toast.error("Could not update quantity. Try again.");
        setQuickQtySaving(false);
        return;
      }
    }
    setListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, quantityKg: newQty } : l))
    );
    setRawListings((prev) =>
      prev.map((l) => (l.id === listingId ? { ...l, quantity_kg: newQty } : l))
    );
    toast.success("Quantity updated.");
    setQuickQtyId(null);
    setQuickQtyValue("");
    setQuickQtySaving(false);
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const displayName   = farmerRow?.name     ?? profile?.full_name ?? ACTIVE_FARMER.name;
  const displayVillage = farmerRow?.village ?? profile?.village   ?? ACTIVE_FARMER.village;
  const displayPhone  = farmerRow?.phone    ?? profile?.phone     ?? ACTIVE_FARMER.phone;
  const displayRating = farmerRow?.rating   ?? ACTIVE_FARMER.rating;
  const isVerified    = farmerRow?.verified ?? false;
  const isRealFarmer  = isSupabaseConfigured() && !!user;
  const isLoading     = isRealFarmer && farmerLoading && !listingsLoaded;

  const filteredReservations =
    reservationFilter === "all"
      ? reservations
      : reservations.filter((r) => r.status === reservationFilter);

  const statusCounts: Record<string, number> = {
    all:       reservations.length,
    pending:   reservations.filter((r) => r.status === "pending").length,
    confirmed: reservations.filter((r) => r.status === "confirmed").length,
    completed: reservations.filter((r) => r.status === "completed").length,
    cancelled: reservations.filter((r) => r.status === "cancelled").length,
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">
          <BilingualLabel en="Farmer Dashboard" te="రైతు డాష్బోర్డ్" />
        </h1>

        {/* Setup warning */}
        {isSupabaseConfigured() && listingsLoaded && !farmerRow && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3 mb-5">
            Your farmer profile could not be linked. Listings are not saved to the database.
            Please refresh or contact support.
          </div>
        )}

        {/* Profile card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
              {displayVillage && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {displayVillage}
                </span>
              )}
              {displayPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  +91 {displayPhone}
                </span>
              )}
              {displayRating ? (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />
                  {displayRating} rating
                </span>
              ) : null}
            </div>
            {isRealFarmer && farmerRow && (
              <p className="text-xs text-muted-foreground mt-1">
                Farmer ID: {farmerRow.id.slice(0, 8)}…
              </p>
            )}
          </div>
          <Badge variant={isVerified ? "default" : "secondary"}>
            {isVerified ? (
              <BilingualLabel en="Verified Farmer" te="ధృవీకరించబడిన రైతు" />
            ) : (
              <BilingualLabel en="Farmer" te="రైతు" />
            )}
          </Badge>
        </motion.div>

        {/* Getting started onboarding */}
        {listings.length === 0 && (
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 mb-8">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <BilingualLabel en="Getting Started" te="మొదలు పెట్టండి" />
            </h3>
            <div className="grid gap-3">
              {[
                { en: "Add your first produce listing", te: "మీ మొదటి పంట వివరాలను జోడించండి" },
                { en: "Enter quantity and price per kg", te: "పరిమాణం మరియు కేజీ ధరను నమోదు చేయండి" },
                { en: "Add pickup village and phone number", te: "పికప్ గ్రామం మరియు ఫోన్ నంబర్‌ను జోడించండి" },
                { en: "Wait for buyers to reserve your crop", te: "కొనుగోలుదారులు మీ పంటను రిజర్వ్ చేసే వరకు వేచి ఉండండి" },
              ].map((step, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <BilingualLabel en={step.en} te={step.te} />
                </div>
              ))}
            </div>
            <div className="mt-5">
              <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto h-auto py-2.5 px-6 shadow-md shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                <BilingualLabel en="Add My First Listing" te="నా మొదటి పంటను జోడించండి" />
              </Button>
            </div>
          </div>
        )}

        {/* ── My Listings ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              <BilingualLabel en="My Listings" te="నా పంటలు" />
            </h2>
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              disabled={isLoading}
              className="h-auto py-2"
            >
              <BilingualLabel en="Add New Listing" te="కొత్త పంటను జోడించండి" orientation="stacked" />
            </Button>
          </div>

          {/* Add listing form */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-foreground mb-4">
                <BilingualLabel en="Add New Produce Listing" te="కొత్త పంటను చేర్చండి" />
              </h3>
              <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>
                    <BilingualLabel en="Produce Name" te="పంట పేరు" />
                  </Label>
                  <Input placeholder="e.g. Tomato, Mango..." {...register("name")} />
                  {errors.name && (
                    <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Category" te="రకం" />
                  </Label>
                  <Select
                    value={categoryValue}
                    onValueChange={(v) => {
                      setCategoryValue(v);
                      setValue("category", v as "Fruit" | "Vegetable", { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Fruit or Vegetable" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fruit">Fruit</SelectItem>
                      <SelectItem value="Vegetable">Vegetable</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-destructive text-xs mt-1">{errors.category.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Quantity (kg)" te="పరిమాణం (కేజీలు)" />
                  </Label>
                  <Input type="number" placeholder="e.g. 100" {...register("quantityKg")} />
                  {errors.quantityKg && (
                    <p className="text-destructive text-xs mt-1">{errors.quantityKg.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Price per kg (Rs)" te="ధర కేజీకి (రూ)" />
                  </Label>
                  <Input type="number" placeholder="e.g. 25" {...register("pricePerKg")} />
                  {errors.pricePerKg && (
                    <p className="text-destructive text-xs mt-1">{errors.pricePerKg.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Harvest Date" te="కోత తేదీ" />
                  </Label>
                  <Input type="date" {...register("harvestDate")} />
                  {errors.harvestDate && (
                    <p className="text-destructive text-xs mt-1">{errors.harvestDate.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Pickup Village / Location" te="పికప్ గ్రామం / ప్రదేశం" />
                  </Label>
                  <Input placeholder="e.g. Shadnagar Main Market" {...register("pickupLocation")} />
                  {errors.pickupLocation && (
                    <p className="text-destructive text-xs mt-1">{errors.pickupLocation.message}</p>
                  )}
                </div>
                <div>
                  <Label>
                    <BilingualLabel en="Contact Phone" te="సంప్రదించవలసిన ఫోన్" />
                  </Label>
                  <Input placeholder="10-digit mobile" maxLength={10} {...register("phone")} />
                  {errors.phone && (
                    <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
                <div>
                  <Label>Quality Notes (optional)</Label>
                  <Input placeholder="e.g. Organic, freshly picked..." {...register("qualityNotes")} />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <Button type="submit" className="flex-1 h-auto py-2" disabled={submitting}>
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    ) : (
                      <BilingualLabel en="Add Listing" te="పంటను జోడించండి" orientation="stacked" />
                    )}
                  </Button>
                  <Button type="button" variant="outline" className="h-auto py-2" onClick={() => setShowForm(false)}>
                    <BilingualLabel en="Cancel" te="రద్దు" orientation="stacked" />
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading your listings...
            </div>
          )}

          {/* Error */}
          {!isLoading && listingsError && (
            <div className="bg-card border border-destructive/20 rounded-2xl p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Could not load listings</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">{listingsError}</p>
              <Button size="sm" onClick={loadFarmerData}>Try Again</Button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !listingsError && listings.length === 0 && (
            <div className="text-center py-12 px-6 bg-card border border-border border-dashed rounded-2xl">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-medium text-foreground mb-1">
                <BilingualLabel en="No listings yet" te="ఇంకా ఎటువంటి పంటలు లేవు" />
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                <BilingualLabel 
                  en="Add your first produce listing so buyers can find and reserve it." 
                  te="కొనుగోలుదారులు కనుగొని రిజర్వ్ చేయడానికి మీ మొదటి పంట వివరాలను జోడించండి."
                  orientation="stacked"
                />
              </p>
              <Button variant="outline" onClick={() => setShowForm(true)} className="h-auto py-2">
                <Plus className="w-4 h-4 mr-2" />
                <BilingualLabel en="Add New Listing" te="కొత్త పంటను జోడించండి" />
              </Button>
            </div>
          )}

          {/* Listing cards */}
          {!isLoading && !listingsError && listings.length > 0 && (
            <div className="space-y-3">
              {listings.map((listing) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground">{listing.name}</h3>
                        <Badge variant={listing.category === "Fruit" ? "default" : "secondary"} className="text-xs">
                          {listing.category}
                        </Badge>
                        <Badge
                          variant={listing.status === "Available" ? "default" : "secondary"}
                          className={`text-xs ${
                            listing.status === "Sold"
                              ? "bg-red-100 text-red-700"
                              : listing.status === "Out of Stock"
                              ? "bg-orange-100 text-orange-700"
                              : ""
                          }`}
                        >
                          {listing.status}
                        </Badge>
                      </div>

                      {/* Quick quantity update inline */}
                      {quickQtyId === listing.id ? (
                        <div className="flex items-center gap-2 mt-1.5 mb-1">
                          <Input
                            type="number"
                            value={quickQtyValue}
                            onChange={(e) => setQuickQtyValue(e.target.value)}
                            className="h-7 w-24 text-sm"
                            min={0}
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground">kg</span>
                          <Button
                            size="sm"
                            className="h-7 px-3 text-xs"
                            disabled={quickQtySaving}
                            onClick={() => handleQuickQtySave(listing.id)}
                          >
                            {quickQtySaving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                          </Button>
                          <button
                            onClick={() => { setQuickQtyId(null); setQuickQtyValue(""); }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          Rs {listing.pricePerKg}/kg ·{" "}
                          <button
                            className="underline underline-offset-2 hover:text-foreground"
                            onClick={() => {
                              setQuickQtyId(listing.id);
                              setQuickQtyValue(String(listing.quantityKg));
                            }}
                            title="Click to update quantity"
                          >
                            {listing.quantityKg} kg
                          </button>
                          {" "}· Harvest: {listing.harvestDate}
                        </div>
                      )}

                      {listing.pickupLocation && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Pickup: {listing.pickupLocation}
                        </div>
                      )}
                      {listing.qualityNotes && (
                        <div className="text-xs text-muted-foreground mt-0.5 italic">
                          {listing.qualityNotes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditOpen(listing)}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>

                      {listing.status === "Available" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(listing.id, "Sold")}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Sold
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateStatus(listing.id, "Out of Stock")}
                          >
                            <Package className="w-3.5 h-3.5 mr-1" />
                            Out of Stock
                          </Button>
                        </>
                      )}

                      {(listing.status === "Sold" || listing.status === "Out of Stock") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(listing.id, "Available")}
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Buyer Reservations ────────────────────────────────────────── */}
        <div>
          {/* New pending banner */}
          {newPendingCount > 0 && !bannerDismissed && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 mb-4">
              <Bell className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  You have <strong>{newPendingCount}</strong> new pending{" "}
                  {newPendingCount === 1 ? "reservation" : "reservations"} since your last visit.
                </p>
                <button
                  onClick={markAllSeen}
                  className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2"
                >
                  Mark all as seen
                </button>
              </div>
              <button
                onClick={markAllSeen}
                className="text-amber-600 hover:text-amber-800 shrink-0 p-0.5 rounded"
                aria-label="Mark all as seen and dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Reservations heading row */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BilingualLabel en="Buyer Reservations" te="కొనుగోలుదారు రిజర్వేషన్లు" />
              {newPendingCount > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  {newPendingCount} new
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              {/* Realtime status pill */}
              {isSupabaseConfigured() && realtimeConnected !== null && (
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    realtimeConnected
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-red-50 text-red-600 border-red-200"
                  }`}
                  title={realtimeConnected ? "Live updates active" : "Realtime unavailable — use manual refresh"}
                >
                  {realtimeConnected
                    ? <><Wifi className="w-3 h-3" />Live</>
                    : <><WifiOff className="w-3 h-3" />Offline</>
                  }
                </span>
              )}
              {newPendingCount > 0 && (
                <button
                  onClick={markAllSeen}
                  className="text-xs text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
                >
                  Mark all as seen
                </button>
              )}
              {isSupabaseConfigured() && farmerRow && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refreshReservations}
                  disabled={refreshingReservations}
                  title="Refresh reservations"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingReservations ? "animate-spin" : ""}`} />
                  <span className="ml-1 hidden sm:inline">Refresh</span>
                </Button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          {reservations.length > 0 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {FILTERS.map((f) => {
                const count = statusCounts[f.value] ?? 0;
                const active = reservationFilter === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setReservationFilter(f.value)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                     <BilingualLabel en={f.label} te={f.teLabel} variant={active ? "button" : "onLight"} />
                    {count > 0 && (
                      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                        active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Loading */}
          {reservationsLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 bg-card border border-border rounded-2xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading reservations...
            </div>
          )}

          {/* Error */}
          {!reservationsLoading && reservationsError && (
            <div className="bg-card border border-destructive/20 rounded-2xl p-6 text-center">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Could not load reservations</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">{reservationsError}</p>
              {isSupabaseConfigured() && (
                <Button
                  size="sm"
                  onClick={farmerRow ? refreshReservations : loadFarmerData}
                  disabled={refreshingReservations}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshingReservations ? "animate-spin" : ""}`} />
                  Try Again
                </Button>
              )}
            </div>
          )}

          {/* Empty (all reservations) */}
          {!reservationsLoading && !reservationsError && reservations.length === 0 && (
            <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl text-sm">
              {isSupabaseConfigured()
                ? "No buyer reservations yet. Reservations will appear here when buyers reserve your listings."
                : "Reservations are unavailable in this view."}
            </div>
          )}

          {/* Empty (filtered) */}
          {!reservationsLoading && !reservationsError && reservations.length > 0 && filteredReservations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-2xl text-sm">
              No {reservationFilter} reservations.
            </div>
          )}

          {/* Reservation cards */}
          {!reservationsLoading && !reservationsError && filteredReservations.length > 0 && (
            <div className="space-y-3">
              {filteredReservations.map((r) => {
                const produceName = r.produce_listings?.produce_name ?? "Unknown produce";
                const pickupLocation = r.produce_listings?.pickup_location;
                const isUpdating = updatingReservation === r.id;
                const isPending   = r.status === "pending";
                const isConfirmed = r.status === "confirmed";
                const isTerminal  = r.status === "completed" || r.status === "cancelled";

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Name + status */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-semibold text-foreground">{r.buyer_name}</span>
                          <ReservationStatusBadge status={r.status} />
                        </div>

                        {/* Produce + quantity */}
                        <div className="text-sm text-muted-foreground mb-0.5">
                          <span className="font-medium text-foreground">{r.quantity_kg} kg</span>
                          {" of "}
                          <span className="font-medium text-foreground">{produceName}</span>
                        </div>

                        {/* Buyer phone — visible only to the farmer who owns the listing */}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-0.5">
                          <Phone className="w-3 h-3 shrink-0" />
                          +91 {r.buyer_phone}
                        </div>

                        {/* Pickup location */}
                        {pickupLocation && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {pickupLocation}
                          </div>
                        )}

                        {/* Payment method */}
                        {r.payment_method && (
                          <div className="text-xs text-muted-foreground mb-0.5">
                            Payment: {r.payment_method}
                          </div>
                        )}

                        {/* Date received */}
                        <div className="text-xs text-muted-foreground">
                          Received:{" "}
                          {new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {!isTerminal && (
                        <div className="flex gap-2 flex-wrap shrink-0 self-start">
                          {isPending && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleReservationStatus(r.id, "confirmed")}
                            >
                              {isUpdating
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : (
                                  <BilingualLabel en="Confirm" te="నిర్ధారించండి" orientation="stacked" variant="button" />
                                )}
                            </Button>
                          )}
                          {isConfirmed && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleReservationStatus(r.id, "completed")}
                            >
                              {isUpdating
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : (
                                  <BilingualLabel en="Complete" te="పూర్తి చేయండి" orientation="stacked" variant="button" />
                                )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleReservationStatus(r.id, "cancelled")}
                          >
                            {isUpdating
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : (
                                <BilingualLabel en="Cancel" te="రద్దు" orientation="stacked" variant="onLight" />
                              )}
                          </Button>
                        </div>
                      )}

                      {isTerminal && (
                        <span className="text-xs text-muted-foreground italic self-start shrink-0">
                          No further actions
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit listing modal ───────────────────────────────────────────── */}
      <Dialog open={!!editingListing} onOpenChange={(open) => { if (!open) setEditingListing(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              <BilingualLabel en="Edit Listing" te="పంట వివరాలను మార్చండి" />
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit(onEditSave)} className="grid sm:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>
                <BilingualLabel en="Produce Name" te="పంట పేరు" />
              </Label>
              <Input {...regEdit("name")} />
              {editErrors.name && (
                <p className="text-destructive text-xs mt-1">{editErrors.name.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Category" te="రకం" />
              </Label>
              <Select
                value={editCategoryValue}
                onValueChange={(v) => {
                  setEditCategoryValue(v);
                  setEditValue("category", v as "Fruit" | "Vegetable", { shouldValidate: true });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Fruit or Vegetable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Fruit">Fruit</SelectItem>
                  <SelectItem value="Vegetable">Vegetable</SelectItem>
                </SelectContent>
              </Select>
              {editErrors.category && (
                <p className="text-destructive text-xs mt-1">{editErrors.category.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Quantity (kg)" te="పరిమాణం (కేజీలు)" />
              </Label>
              <Input type="number" min={0} {...regEdit("quantityKg")} />
              {editErrors.quantityKg && (
                <p className="text-destructive text-xs mt-1">{editErrors.quantityKg.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Price per kg (Rs)" te="ధర కేజీకి (రూ)" />
              </Label>
              <Input type="number" min={1} {...regEdit("pricePerKg")} />
              {editErrors.pricePerKg && (
                <p className="text-destructive text-xs mt-1">{editErrors.pricePerKg.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Harvest Date" te="కోత తేదీ" />
              </Label>
              <Input type="date" {...regEdit("harvestDate")} />
              {editErrors.harvestDate && (
                <p className="text-destructive text-xs mt-1">{editErrors.harvestDate.message}</p>
              )}
            </div>

            <div>
              <Label>
                <BilingualLabel en="Pickup Location" te="పికప్ ప్రదేశం" />
              </Label>
              <Input {...regEdit("pickupLocation")} />
              {editErrors.pickupLocation && (
                <p className="text-destructive text-xs mt-1">{editErrors.pickupLocation.message}</p>
              )}
            </div>

            <div>
              <Label>District (optional)</Label>
              <Input placeholder="e.g. Ranga Reddy" {...regEdit("district")} />
            </div>

            <div>
              <Label>Quality Notes (optional)</Label>
              <Input placeholder="e.g. Organic, freshly picked..." {...regEdit("qualityNotes")} />
            </div>

            <div className="sm:col-span-2">
              <Label>
                <BilingualLabel en="Status" te="స్థితి" />
              </Label>
              <Select
                value={editStatusValue}
                onValueChange={(v) => {
                  setEditStatusValue(v as ProduceListing["status"]);
                  setEditValue("status", v as ProduceListing["status"], { shouldValidate: true });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Sold">Sold</SelectItem>
                  <SelectItem value="Out of Stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
              {editErrors.status && (
                <p className="text-destructive text-xs mt-1">{editErrors.status.message}</p>
              )}
            </div>

            <DialogFooter className="sm:col-span-2 mt-2">
              <Button
                type="button"
                variant="outline"
                className="h-auto py-2"
                onClick={() => setEditingListing(null)}
                disabled={editSubmitting}
              >
                <BilingualLabel en="Cancel" te="రద్దు" orientation="stacked" />
              </Button>
              <Button type="submit" className="h-auto py-2" disabled={editSubmitting}>
                {editSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  <BilingualLabel en="Save Changes" te="మార్పులను సేవ్ చేయండి" orientation="stacked" />
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
