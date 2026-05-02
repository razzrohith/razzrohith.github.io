import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Star, Edit, Package, CheckCircle, User, MapPin, Phone, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { mockFarmers, mockListings } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import {
  isSupabaseConfigured, SupabaseFarmer, SupabaseListing, SupabaseReservation, ReservationStatus,
  getOrCreateFarmerForCurrentUser, getFarmerListings,
  createFarmerListing, updateListingStatus,
  getReservationsForFarmer, updateReservationStatus,
} from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ── Schema ──────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_FARMER = mockFarmers[0];

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

function supabaseStatusToLocal(
  status: string
): ProduceListing["status"] {
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

  // Real farmer row from Supabase, or null if not loaded / not configured
  const [farmerRow, setFarmerRow] = useState<SupabaseFarmer | null>(null);
  const [farmerLoading, setFarmerLoading] = useState(false);

  // When Supabase is configured and farmer is loaded, listings come from Supabase.
  // Otherwise they come from mock data (demo mode).
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [listingsLoaded, setListingsLoaded] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reservations state — live from Supabase when configured, otherwise empty
  const [reservations, setReservations] = useState<SupabaseReservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState<string | null>(null);
  const [updatingReservation, setUpdatingReservation] = useState<string | null>(null);

  // ── Load farmer row and listings ─────────────────────────────────────────

  const loadFarmerData = useCallback(async () => {
    if (!isSupabaseConfigured() || !user || !profile) {
      // Demo mode: use mock data for listings, empty reservations
      setListings(mockListings.filter((l) => l.farmerId === MOCK_FARMER.id));
      setListingsLoaded(true);
      return;
    }

    setFarmerLoading(true);
    try {
      const farmer = await getOrCreateFarmerForCurrentUser(profile);
      setFarmerRow(farmer);

      if (farmer) {
        // Load listings and reservations in parallel
        const [sbListings, sbReservations] = await Promise.all([
          getFarmerListings(farmer.id),
          getReservationsForFarmer(farmer.id),
        ]);
        setListings(sbListings.map(supabaseToLocal));
        setReservations(sbReservations);
      } else {
        setListings([]);
        setReservations([]);
      }
    } catch (e) {
      console.warn("Error loading farmer data:", e);
      setListings([]);
      setReservations([]);
    } finally {
      setFarmerLoading(false);
      setListingsLoaded(true);
    }
  }, [user, profile]);

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

  useEffect(() => {
    loadFarmerData();
  }, [loadFarmerData]);

  // ── Derived display values ───────────────────────────────────────────────

  const displayName =
    farmerRow?.name ?? profile?.full_name ?? MOCK_FARMER.name;
  const displayVillage =
    farmerRow?.village ?? profile?.village ?? MOCK_FARMER.village;
  const displayPhone =
    farmerRow?.phone ?? profile?.phone ?? MOCK_FARMER.phone;
  const displayRating = farmerRow?.rating ?? MOCK_FARMER.rating;
  const isVerified = farmerRow?.verified ?? false;
  const isRealFarmer = isSupabaseConfigured() && !!user;

  // ── Form ─────────────────────────────────────────────────────────────────

  const {
    register, handleSubmit, setValue, reset, formState: { errors },
  } = useForm<ListingForm>({ resolver: zodResolver(listingSchema) });

  const onSubmit = async (data: ListingForm) => {
    setSubmitting(true);

    const localListing: ProduceListing = {
      id: `p${Date.now()}`,
      farmerId: farmerRow?.id ?? MOCK_FARMER.id,
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
          // Use the real Supabase UUID as id so status updates hit the right row
          localListing.id = newId;
          toast.success("Listing saved to database.");
        } else {
          toast.error("Listing could not be saved. Check your connection.");
          setSubmitting(false);
          return;
        }
      } else {
        toast.success("Listing added locally (demo mode).");
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

  // ── Status update ────────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: ProduceListing["status"]) => {
    if (isSupabaseConfigured() && farmerRow) {
      const ok = await updateListingStatus(id, localStatusToSupabase(status));
      if (!ok) {
        toast.error("Could not update listing status. Try again.");
        return;
      }
    }
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    toast.success(`Listing marked as ${status}.`);
  };

  // ── Loading state ────────────────────────────────────────────────────────

  const isLoading = isRealFarmer && farmerLoading && !listingsLoaded;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Farmer Dashboard</h1>

        {/* Setup warning if Supabase is configured but farmer row could not be created */}
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
            {isVerified ? "Verified Farmer" : "Farmer"}
          </Badge>
        </motion.div>

        {/* Listings section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">My Listings</h2>
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              disabled={isLoading}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add New Listing
            </Button>
          </div>

          {/* Add listing form */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-foreground mb-4">Add New Produce Listing</h3>
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="grid sm:grid-cols-2 gap-4"
              >
                <div>
                  <Label>Produce Name</Label>
                  <Input placeholder="e.g. Tomato, Mango..." {...register("name")} />
                  {errors.name && (
                    <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={categoryValue}
                    onValueChange={(v) => {
                      setCategoryValue(v);
                      setValue("category", v as "Fruit" | "Vegetable", {
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Fruit or Vegetable" />
                    </SelectTrigger>
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
                  <Label>Quantity (kg)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 100"
                    {...register("quantityKg")}
                  />
                  {errors.quantityKg && (
                    <p className="text-destructive text-xs mt-1">{errors.quantityKg.message}</p>
                  )}
                </div>
                <div>
                  <Label>Price per kg (Rs)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 25"
                    {...register("pricePerKg")}
                  />
                  {errors.pricePerKg && (
                    <p className="text-destructive text-xs mt-1">{errors.pricePerKg.message}</p>
                  )}
                </div>
                <div>
                  <Label>Harvest Date</Label>
                  <Input type="date" {...register("harvestDate")} />
                  {errors.harvestDate && (
                    <p className="text-destructive text-xs mt-1">{errors.harvestDate.message}</p>
                  )}
                </div>
                <div>
                  <Label>Pickup Village / Location</Label>
                  <Input
                    placeholder="e.g. Shadnagar Main Market"
                    {...register("pickupLocation")}
                  />
                  {errors.pickupLocation && (
                    <p className="text-destructive text-xs mt-1">
                      {errors.pickupLocation.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input
                    placeholder="10-digit mobile"
                    maxLength={10}
                    {...register("phone")}
                  />
                  {errors.phone && (
                    <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>
                <div>
                  <Label>Quality Notes (optional)</Label>
                  <Input
                    placeholder="e.g. Organic, freshly picked..."
                    {...register("qualityNotes")}
                  />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Add Listing"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading your listings...
            </div>
          )}

          {/* Listings list */}
          {!isLoading && listings.length === 0 && (
            <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
              No listings yet. Add your first produce listing above.
            </div>
          )}

          {!isLoading && listings.length > 0 && (
            <div className="space-y-3">
              {listings.map((listing) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground">{listing.name}</h3>
                      <Badge
                        variant={listing.category === "Fruit" ? "default" : "secondary"}
                        className="text-xs"
                      >
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
                    <div className="text-sm text-muted-foreground">
                      Rs {listing.pricePerKg}/kg · {listing.quantityKg} kg ·
                      Harvest: {listing.harvestDate}
                    </div>
                    {listing.pickupLocation && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Pickup: {listing.pickupLocation}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info("Edit coming soon.")}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(listing.id, "Sold")}
                      disabled={listing.status === "Sold"}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Sold
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(listing.id, "Out of Stock")}
                      disabled={listing.status === "Out of Stock"}
                    >
                      <Package className="w-3.5 h-3.5 mr-1" />
                      Out of Stock
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Buyer Reservations — live from Supabase */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Buyer Reservations</h2>

          {/* Loading */}
          {reservationsLoading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 bg-card border border-border rounded-2xl">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading reservations...
            </div>
          )}

          {/* Error */}
          {!reservationsLoading && reservationsError && (
            <div className="text-center py-8 text-destructive bg-card border border-destructive/20 rounded-2xl">
              {reservationsError}
            </div>
          )}

          {/* Empty */}
          {!reservationsLoading && !reservationsError && reservations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-2xl">
              {isSupabaseConfigured()
                ? "No buyer reservations yet. Reservations will appear here when buyers reserve your listings."
                : "Reservations are unavailable in demo mode."}
            </div>
          )}

          {/* Reservation cards */}
          {!reservationsLoading && !reservationsError && reservations.length > 0 && (
            <div className="space-y-3">
              {reservations.map((r) => {
                const produceName = r.produce_listings?.produce_name ?? "Unknown produce";
                const isUpdating = updatingReservation === r.id;
                const isTerminal = r.status === "completed" || r.status === "cancelled";

                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-medium text-foreground">{r.buyer_name}</span>
                          <ReservationStatusBadge status={r.status} />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {r.quantity_kg} kg of <span className="font-medium text-foreground">{produceName}</span>
                          {" · "}+91 {r.buyer_phone}
                        </div>
                        {r.payment_method && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Payment: {r.payment_method}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Received: {new Date(r.created_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </div>
                      </div>

                      {/* Action buttons — vary by status */}
                      {!isTerminal && (
                        <div className="flex gap-2 flex-wrap shrink-0">
                          {r.status === "pending" && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleReservationStatus(r.id, "confirmed")}
                            >
                              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                              Confirm
                            </Button>
                          )}
                          {r.status === "confirmed" && (
                            <Button
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => handleReservationStatus(r.id, "completed")}
                            >
                              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5 mr-1" />}
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isUpdating}
                            onClick={() => handleReservationStatus(r.id, "cancelled")}
                          >
                            {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5 mr-1" />}
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
