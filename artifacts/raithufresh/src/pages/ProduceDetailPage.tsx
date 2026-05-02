import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Calendar, Star, Phone,
  Package, FileText, Navigation, Loader2, AlertCircle,
  Share2, Info, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import ReservationModal from "@/components/ReservationModal";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import { mockListings, mockFarmers } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import {
  isSupabaseConfigured, getProduceListingById, getSupabase, SupabaseListing,
} from "@/lib/supabase";
import { shareListing } from "@/lib/share";

// ── Helpers ─────────────────────────────────────────────────────────────────

function supabaseStatusToLocal(status: string): ProduceListing["status"] {
  if (status === "sold") return "Sold";
  if (status === "out_of_stock") return "Out of Stock";
  return "Available";
}

function mapToProduceListing(row: SupabaseListing): ProduceListing {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    name: row.produce_name,
    category: row.category,
    pricePerKg: Number(row.price_per_kg),
    quantityKg: Number(row.quantity_kg),
    harvestDate: row.harvest_datetime ? row.harvest_datetime.split("T")[0] : "",
    pickupLocation: row.pickup_location ?? "",
    distanceKm: Number(row.distance_km ?? 0),
    qualityNotes: row.quality_notes ?? undefined,
    status: supabaseStatusToLocal(row.status),
  };
}

type FarmerInfo = {
  name: string;
  village: string | null;
  district: string | null;
  rating: number | null;
  phone: string | null;
  verified: boolean;
};

type SimilarItem = {
  id: string;
  name: string;
  pricePerKg: number;
  location: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export default function ProduceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [listing, setListing] = useState<ProduceListing | null>(null);
  const [farmer, setFarmer] = useState<FarmerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);

  // ── Load main listing ─────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!id) { setNotFound(true); setLoading(false); return; }

      if (!isSupabaseConfigured()) {
        const ml = mockListings.find((l) => l.id === id);
        const mf = ml ? mockFarmers.find((f) => f.id === ml.farmerId) : null;
        if (!ml || !mf) { setNotFound(true); } else {
          setListing(ml);
          setFarmer({
            name: mf.name, village: mf.village, district: null,
            rating: mf.rating, phone: mf.phone, verified: true,
          });
        }
        setLoading(false);
        return;
      }

      try {
        const row = await getProduceListingById(id);
        if (!row) {
          const ml = mockListings.find((l) => l.id === id);
          const mf = ml ? mockFarmers.find((f) => f.id === ml.farmerId) : null;
          if (ml && mf) {
            setListing(ml);
            setFarmer({
              name: mf.name, village: mf.village, district: null,
              rating: mf.rating, phone: mf.phone, verified: true,
            });
          } else {
            setNotFound(true);
          }
          return;
        }

        setListing(mapToProduceListing(row));
        const f = row.farmers;
        setFarmer(f ? {
          name: f.name,
          village: f.village,
          district: f.district,
          rating: f.rating,
          phone: f.phone ?? null,
          verified: f.verified ?? false,
        } : null);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Load similar listings ─────────────────────────────────────────────────

  useEffect(() => {
    if (!listing || !isSupabaseConfigured()) return;

    async function loadSimilar() {
      try {
        const { data } = await getSupabase()
          .from("produce_listings")
          .select("id, produce_name, price_per_kg, pickup_location, farmers(village, district)")
          .eq("status", "active")
          .eq("category", listing!.category)
          .neq("id", listing!.id)
          .limit(3);

        if (!data || data.length === 0) return;

        const items: SimilarItem[] = (data as unknown as Array<{
          id: string;
          produce_name: string;
          price_per_kg: number | string;
          pickup_location: string | null;
          farmers: { village: string | null; district: string | null } | null;
        }>).map((row) => ({
          id: row.id,
          name: row.produce_name,
          pricePerKg: Number(row.price_per_kg),
          location: [
            row.farmers?.village,
            row.farmers?.district,
          ].filter(Boolean).join(", "),
        }));

        setSimilar(items);
      } catch {
        // Similar listings are best-effort — silently skip on error
      }
    }
    loadSimilar();
  }, [listing]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading listing...</span>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  if (notFound || !listing) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Produce not found</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This listing may have been removed or is no longer active.
          </p>
          <Link href="/browse">
            <Button>Back to Browse</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────────

  const farmerName = farmer?.name ?? "Farmer";
  const farmerVillage = farmer?.village ?? "";
  const farmerDistrict = farmer?.district ?? "";
  const farmerLocation = [farmerVillage, farmerDistrict].filter(Boolean).join(", ");
  const farmerRating = farmer?.rating ?? 0;
  const farmerPhone = farmer?.phone ?? null;
  const farmerVerified = farmer?.verified ?? false;
  const isAvailable = listing.status === "Available";

  const handleContact = () => setContactOpen(true);

  const handleShare = () =>
    shareListing({
      name: listing.name,
      pricePerKg: listing.pricePerKg,
      location: farmerLocation,
      id: listing.id,
    });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Browse
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4" />
            Share Listing
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header card */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{listing.name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  by{" "}
                  {listing.farmerId ? (
                    <Link
                      href={`/farmers/${listing.farmerId}`}
                      className="font-medium text-foreground hover:underline underline-offset-2"
                    >
                      {farmerName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{farmerName}</span>
                  )}
                  {farmerLocation ? ` · ${farmerLocation}` : ""}
                </p>
                {listing.farmerId && (
                  <Link
                    href={`/farmers/${listing.farmerId}`}
                    className="text-xs text-primary underline underline-offset-2 mt-1 inline-block"
                  >
                    View Farmer Profile
                  </Link>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge variant={listing.category === "Fruit" ? "default" : "secondary"}>
                  {listing.category}
                </Badge>
                {farmerVerified && (
                  <span className="text-xs text-primary font-medium">Verified Farmer</span>
                )}
              </div>
            </div>

            {/* Farmer rating */}
            {farmerRating > 0 && (
              <div className="flex items-center gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(farmerRating)
                        ? "fill-secondary text-secondary"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">{farmerRating}</span>
              </div>
            )}

            {/* Price / Quantity */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-primary">Rs {listing.pricePerKg}</div>
                <div className="text-muted-foreground text-xs mt-0.5">per kg</div>
              </div>
              <div className="bg-muted rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{listing.quantityKg}</div>
                <div className="text-muted-foreground text-xs mt-0.5">kg available</div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2.5 text-sm">
              {listing.harvestDate && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    Harvest date:{" "}
                    <span className="text-foreground font-medium">{listing.harvestDate}</span>
                  </span>
                </div>
              )}
              {listing.pickupLocation && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    Pickup:{" "}
                    <span className="text-foreground font-medium">{listing.pickupLocation}</span>
                    {listing.distanceKm > 0 ? ` · ${listing.distanceKm} km away` : ""}
                  </span>
                </div>
              )}
              {listing.qualityNotes && (
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Quality notes:{" "}
                    <span className="text-foreground">{listing.qualityNotes}</span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span>
                  Status:{" "}
                  <span
                    className={`font-medium ${
                      isAvailable ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {listing.status}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Pickup directions */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Pickup Directions</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {listing.pickupLocation
                ? `Head to ${listing.pickupLocation}. Contact the farmer for exact directions once you reserve. The farmer will guide you to the pickup point.`
                : "Contact the farmer after reserving for pickup directions."}
            </p>
            <p className="text-xs text-muted-foreground mt-2 bg-muted rounded-lg px-3 py-2">
              Google Maps directions will be added in a future version.
            </p>
          </div>

          {/* Before Pickup — Buyer Notes */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Before You Come for Pickup</h3>
            </div>
            <ul className="space-y-2">
              {[
                "Contact the farmer before traveling to confirm the produce is still available.",
                "Confirm the exact quantity you need — the farmer may already have partial reservations.",
                "Payment is Cash or UPI directly to the farmer at pickup. No online payment is collected by RaithuFresh.",
                "RaithuFresh does not handle delivery in this version. Pickup is arranged directly with the farmer.",
              ].map((note) => (
                <li key={note} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Reserve section — only if Available */}
          {isAvailable ? (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Reserve This Produce</h3>
              <div className="mb-4">
                <Label htmlFor="qty">How many kg do you need?</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={listing.quantityKg}
                  value={reserveQty}
                  onChange={(e) =>
                    setReserveQty(
                      Math.min(listing.quantityKg, Math.max(1, Number(e.target.value)))
                    )
                  }
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total estimate: Rs {(reserveQty * listing.pricePerKg).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-4">
                Payment: Cash or UPI directly to farmer at pickup
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setModalOpen(true)}>
                  Reserve Now
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleContact}>
                  <Phone className="w-4 h-4 mr-1.5" />
                  Contact Farmer
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm text-center">
              <AlertCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                This listing is currently{" "}
                <span className="font-medium text-destructive">{listing.status}</span> and cannot
                be reserved.
              </p>
              <Link href="/browse">
                <Button variant="outline" className="mt-3">
                  Browse other listings
                </Button>
              </Link>
            </div>
          )}

          {/* Similar produce */}
          {similar.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">
                Similar {listing.category === "Fruit" ? "Fruits" : "Vegetables"} Nearby
              </h3>
              <div className="space-y-3">
                {similar.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Rs {s.pricePerKg}/kg
                        {s.location ? ` · ${s.location}` : ""}
                      </p>
                    </div>
                    <Link href={`/produce/${s.id}`}>
                      <Button size="sm" variant="outline" className="shrink-0">
                        View Details
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        listing={listing}
      />
      <ContactFarmerDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        farmerName={farmerName}
        phone={farmerPhone}
        produceName={listing.name}
      />
    </div>
  );
}
