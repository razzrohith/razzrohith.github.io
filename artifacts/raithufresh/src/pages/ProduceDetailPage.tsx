import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Calendar, Star, Phone,
  Package, FileText, Navigation, Loader2, AlertCircle,
  Share2, Info, CheckCircle2, BadgeCheck, Tractor,
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
  isSupabaseConfigured,
  getProduceListingById,
  getOtherActiveListingsByFarmer,
  getSupabase,
  SupabaseListing,
} from "@/lib/supabase";
import { shareListing } from "@/lib/share";
import BilingualLabel from "@/components/BilingualLabel";
import ImageWithFallback from "@/components/ImageWithFallback";
import { getProduceImage, getCategoryIcon } from "@/lib/images";

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

// ── Sub-components ────────────────────────────────────────────────────────────

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  return (
    <img
      src={getCategoryIcon(category)}
      alt={category}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-md object-cover"
    />
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ProduceDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [listing, setListing] = useState<ProduceListing | null>(null);
  const [farmer, setFarmer] = useState<FarmerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reserveQty, setReserveQty] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalListing, setModalListing] = useState<ProduceListing | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [moreFarmer, setMoreFarmer] = useState<SupabaseListing[]>([]);

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
          location: [row.farmers?.village, row.farmers?.district].filter(Boolean).join(", "),
        }));

        setSimilar(items);
      } catch {
        // Similar listings are best-effort
      }
    }
    loadSimilar();
  }, [listing]);

  // ── Load more from this farmer ────────────────────────────────────────────

  useEffect(() => {
    if (!listing?.farmerId || !id || !isSupabaseConfigured()) return;

    async function loadMore() {
      try {
        const more = await getOtherActiveListingsByFarmer(listing!.farmerId!, id!);
        setMoreFarmer(more);
      } catch {
        // best-effort
      }
    }
    loadMore();
  }, [listing?.farmerId, id]);

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
          <img
            src="/assets/images/empty-states/empty-basket.png"
            alt="Listing not found"
            className="w-32 h-32 object-cover mx-auto mb-5 opacity-80 mix-blend-multiply dark:mix-blend-screen"
          />
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

  // ── Derived values ────────────────────────────────────────────────────────

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

  const openModal = (l: ProduceListing) => {
    setModalListing(l);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalListing(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-5">
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Browse
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
            <Share2 className="w-4 h-4" />
            Share Listing
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >

          {/* ── Main listing card ── */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4 shadow-sm">
            <ImageWithFallback
              src={"" /* No DB image support yet */}
              fallbackSrc={getProduceImage(listing.name, listing.category)}
              alt={listing.name}
              containerClassName="w-full h-64 sm:h-80"
            />
            <div className="p-6">
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
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <CategoryIcon category={listing.category} size={22} />
                <Badge variant={listing.category === "Fruit" ? "default" : "secondary"}>
                  {listing.category}
                </Badge>
              </div>
            </div>

            {/* Price / Quantity */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  <BilingualLabel en={`Rs ${listing.pricePerKg}`} te={`Rs ${listing.pricePerKg}`} orientation="stacked" />
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  <BilingualLabel en="per kg" te="కేజీకి" />
                </div>
              </div>
              <div className="bg-muted rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{listing.quantityKg}</div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  <BilingualLabel en="kg available" te="కేజీలు ఉన్నాయి" />
                </div>
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
                  <span className={`font-medium ${isAvailable ? "text-primary" : "text-destructive"}`}>
                    {listing.status}
                  </span>
                </span>
              </div>
              </div>
            </div>
          </div>

          {/* ── Farmer trust card ── */}
          {farmer && (
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 mb-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <ImageWithFallback
                    src="/assets/images/farmers/generic-farmer.png"
                    alt="Farmer profile"
                    containerClassName="w-12 h-12 rounded-full shrink-0"
                    className="rounded-full"
                  />
                  <div>
                    <p className="font-semibold text-foreground leading-tight">{farmerName}</p>
                    {farmerLocation && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {farmerLocation}
                      </p>
                    )}
                  </div>
                </div>
                {farmerVerified && (
                  <div className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0">
                    <BadgeCheck className="w-4 h-4" />
                    Verified
                  </div>
                )}
              </div>

              {farmerRating > 0 && (
                <div className="flex items-center gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${
                        s <= Math.round(farmerRating)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/20 fill-muted-foreground/10"
                      }`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">{farmerRating}</span>
                </div>
              )}

              <div className="flex gap-2">
                {listing.farmerId && (
                  <Link href={`/farmers/${listing.farmerId}`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full h-auto py-2">
                      <BilingualLabel en="View Farmer Profile" te="రైతు ప్రొఫైల్ చూడండి" orientation="stacked" />
                    </Button>
                  </Link>
                )}
                <Button size="sm" variant="outline" className="flex-1 h-auto py-2" onClick={handleContact}>
                  <BilingualLabel en="Contact Farmer" te="రైతును సంప్రదించండి" orientation="stacked" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Pickup directions ── */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">
                <BilingualLabel en="Pickup Directions" te="పికప్ మార్గం" />
              </h3>
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

          {/* ── Before pickup notes ── */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">
                <BilingualLabel en="Before You Come for Pickup" te="మీరు పికప్ కోసం వచ్చే ముందు" />
              </h3>
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

          {/* ── Reserve section ── */}
          {isAvailable ? (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">
                <BilingualLabel en="Reserve This Produce" te="ఈ పంటను రిజర్వ్ చేయండి" />
              </h3>
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
                <Button className="flex-1 h-auto py-2" onClick={() => openModal(listing)}>
                  <BilingualLabel en="Reserve Now" te="ఇప్పుడే రిజర్వ్ చేయండి" orientation="stacked" variant="button" />
                </Button>
                <Button variant="outline" className="flex-1 h-auto py-2" onClick={handleContact}>
                  <BilingualLabel en="Contact Farmer" te="రైతును సంప్రదించండి" orientation="stacked" variant="onLight" />
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

          {/* ── More from this farmer ── */}
          {moreFarmer.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                <Tractor className="w-4 h-4 text-primary" />
                More from {farmerName}
              </h3>
              <div className="space-y-4">
                {moreFarmer.map((item) => {
                  const mapped = mapToProduceListing(item);
                  const harvestDate = item.harvest_datetime
                    ? item.harvest_datetime.split("T")[0]
                    : null;
                  const loc = [
                    (item.farmers as { village?: string | null } | null)?.village,
                    (item.farmers as { district?: string | null } | null)?.district ?? item.district,
                  ].filter(Boolean).join(", ");

                  return (
                    <div
                      key={item.id}
                      className="border border-border rounded-xl p-4 flex flex-col gap-3"
                    >
                      {/* Name + category */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {item.produce_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            {harvestDate && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Harvest: {harvestDate}
                              </span>
                            )}
                            {loc && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {loc}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <CategoryIcon category={item.category} size={18} />
                          <Badge
                            variant={item.category === "Fruit" ? "default" : "secondary"}
                          >
                            {item.category}
                          </Badge>
                        </div>
                      </div>

                      {/* Price + Qty */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-primary/5 rounded-lg p-2 text-center">
                          <div className="font-bold text-primary text-base">
                            Rs {item.price_per_kg}
                          </div>
                          <div className="text-xs text-muted-foreground">per kg</div>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <div className="font-bold text-foreground text-base">
                            {item.quantity_kg}
                          </div>
                          <div className="text-xs text-muted-foreground">kg available</div>
                        </div>
                      </div>

                      {/* Action row 1: View + Reserve */}
                      <div className="grid grid-cols-2 gap-2">
                        <Link href={`/produce/${item.id}`}>
                          <Button size="sm" variant="outline" className="w-full">
                            View Details
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => openModal(mapped)}
                        >
                          Reserve
                        </Button>
                      </div>

                      {/* Action row 2: Contact + Share */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={handleContact}
                        >
                          <Phone className="w-3.5 h-3.5 mr-1.5" />
                          Contact Farmer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full"
                          onClick={() =>
                            shareListing({
                              name: item.produce_name,
                              pricePerKg: Number(item.price_per_kg),
                              location: loc,
                              id: item.id,
                            })
                          }
                        >
                          <Share2 className="w-3.5 h-3.5 mr-1.5" />
                          Share
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Similar produce ── */}
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
        onClose={closeModal}
        listing={modalListing ?? listing}
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
