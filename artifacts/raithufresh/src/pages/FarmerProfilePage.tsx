import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Star, MapPin, Phone, Share2, Package,
  Calendar, FileText, CheckCircle2, Loader2, AlertCircle,
  BadgeCheck, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import ReservationModal from "@/components/ReservationModal";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import BilingualLabel from "@/components/BilingualLabel";
import { ProduceListing } from "@/lib/types";
import {
  SupabaseFarmer, SupabaseListing,
  isSupabaseConfigured, getFarmerProfileById, getActiveListingsByFarmer,
} from "@/lib/supabase";
import { shareListing } from "@/lib/share";
import { mockFarmers, mockListings } from "@/data/mockData";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapListing(row: SupabaseListing): ProduceListing {
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
    status: "Available",
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FarmerProfilePage() {
  const { id } = useParams<{ id: string }>();

  const [farmer, setFarmer] = useState<SupabaseFarmer | null>(null);
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedListing, setSelectedListing] = useState<ProduceListing | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactProduce, setContactProduce] = useState<string | undefined>(undefined);

  useEffect(() => {
    async function load() {
      if (!id) { setNotFound(true); setLoading(false); return; }

      if (!isSupabaseConfigured()) {
        const mf = mockFarmers.find((f) => f.id === id);
        if (!mf) { setNotFound(true); setLoading(false); return; }
        setFarmer({
          id: mf.id,
          name: mf.name,
          phone: mf.phone,
          village: mf.village,
          district: null,
          rating: mf.rating,
          verified: true,
          assisted_mode: false,
          user_id: null,
        });
        const farmerListings = mockListings
          .filter((l) => l.farmerId === mf.id && l.status === "Available");
        setListings(farmerListings);
        setLoading(false);
        return;
      }

      try {
        const [farmerData, listingsData] = await Promise.all([
          getFarmerProfileById(id),
          getActiveListingsByFarmer(id),
        ]);
        if (!farmerData) {
          const mf = mockFarmers.find((f) => f.id === id);
          if (!mf) { setNotFound(true); return; }
          setFarmer({
            id: mf.id,
            name: mf.name,
            phone: mf.phone,
            village: mf.village,
            district: null,
            rating: mf.rating,
            verified: true,
            assisted_mode: false,
            user_id: null,
          });
          setListings(
            mockListings.filter((l) => l.farmerId === mf.id && l.status === "Available")
          );
          return;
        }
        setFarmer(farmerData);
        setListings(listingsData.map(mapListing));
      } catch {
        const mf = mockFarmers.find((f) => f.id === id);
        if (mf) {
          setFarmer({
            id: mf.id,
            name: mf.name,
            phone: mf.phone,
            village: mf.village,
            district: null,
            rating: mf.rating,
            verified: true,
            assisted_mode: false,
            user_id: null,
          });
          setListings(
            mockListings.filter((l) => l.farmerId === mf.id && l.status === "Available")
          );
        } else {
          setNotFound(true);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading farmer profile...</span>
        </div>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────

  if (notFound || !farmer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Farmer not found</h2>
          <p className="text-sm text-muted-foreground mb-6">
            This farmer profile may not exist or is not publicly available.
          </p>
          <Link href="/browse">
            <Button>Browse Produce</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Profile view ──────────────────────────────────────────────────────────

  const location = [farmer.village, farmer.district].filter(Boolean).join(", ");
  const rating = farmer.rating ?? 0;

  const handleReserve = (listing: ProduceListing) => {
    setSelectedListing(listing);
    setModalOpen(true);
  };

  const handleContact = (produceName?: string) => {
    setContactProduce(produceName);
    setContactOpen(true);
  };

  const handleShareProfile = async () => {
    const url = `${window.location.origin}/farmers/${id}`;
    const text = `View ${farmer.name}'s fresh fruit and vegetable listings on RaithuFresh${location ? ` near ${location}` : ""}.`;
    const title = `${farmer.name} on RaithuFresh`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // user cancelled — fall through
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied to clipboard.");
    } catch {
      toast.info(`Profile URL: ${url}`);
    }
  };

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
            <ArrowLeft className="w-4 h-4" /> <BilingualLabel en="Back to Browse" te="తిరిగి బ్రౌజ్ చేయండి" />
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShareProfile}>
            <Share2 className="w-4 h-4" />
            Share Profile
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Farmer profile card */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{farmer.name}</h1>
                {location && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    {location}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {farmer.verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    <BilingualLabel en="Verified Farmer" te="ధృవీకరించబడిన రైతు" />
                  </span>
                )}
                {farmer.assisted_mode && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Users className="w-3 h-3" />
                    <BilingualLabel en="Agent Assisted" te="ఏజెంట్ సహాయం" />
                  </span>
                )}
              </div>
            </div>

            {/* Rating */}
            {rating > 0 && (
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${
                      s <= Math.round(rating)
                        ? "fill-secondary text-secondary"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">{rating}</span>
              </div>
            )}

            {/* Listing count */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Package className="w-4 h-4 text-primary" />
              <span>
                <BilingualLabel
                  en={`${listings.length} active ${listings.length === 1 ? "listing" : "listings"}`}
                  te={`${listings.length} క్రియాశీల ${listings.length === 1 ? "లిస్టింగ్" : "లిస్టింగ్స్"}`}
                />
              </span>
            </div>

            {/* Trust note */}
            <div className="rounded-lg bg-primary/5 border border-primary/10 px-4 py-3 text-sm text-muted-foreground flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Contact the farmer before pickup. Payment is Cash or UPI directly to the farmer.
                RaithuFresh does not handle online payment.
              </span>
            </div>
          </div>

          {/* Listings */}
          <h2 className="text-base font-semibold text-foreground mb-3">
            <BilingualLabel en="Active Listings" te="క్రియాశీల లిస్టింగ్స్" />
          </h2>

          {listings.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
              <img
                src="/assets/empty-produce.svg"
                alt="No active listings"
                width={100}
                height={80}
                className="mx-auto mb-4 opacity-70"
              />
              <p className="text-muted-foreground text-sm">
                No active listings from this farmer right now.
              </p>
              <Link href="/browse">
                <Button variant="outline" className="mt-4">
                  Browse all produce
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {listings.map((listing, i) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-base">{listing.name}</h3>
                    </div>
                    <Badge
                      variant={listing.category === "Fruit" ? "default" : "secondary"}
                      className="shrink-0"
                    >
                      {listing.category}
                    </Badge>
                  </div>

                  {/* Price / Qty */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-primary/5 rounded-lg p-2.5 text-center">
                      <div className="font-bold text-primary text-lg">Rs {listing.pricePerKg}</div>
                      <div className="text-muted-foreground text-xs">per kg</div>
                    </div>
                    <div className="bg-muted rounded-lg p-2.5 text-center">
                      <div className="font-bold text-foreground text-lg">{listing.quantityKg}</div>
                      <div className="text-muted-foreground text-xs">kg available</div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                    {listing.harvestDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Harvest: {listing.harvestDate}
                      </div>
                    )}
                    {listing.pickupLocation && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        {listing.pickupLocation}
                        {listing.distanceKm > 0 ? ` · ${listing.distanceKm} km away` : ""}
                      </div>
                    )}
                    {listing.qualityNotes && (
                      <div className="flex items-start gap-1.5">
                        <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {listing.qualityNotes}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 h-auto py-2" onClick={() => handleReserve(listing)}>
                      <BilingualLabel en="Reserve" te="రిజర్వ్" orientation="stacked" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-auto py-2"
                      onClick={() => handleContact(listing.name)}
                    >
                      <BilingualLabel en="Contact" te="సంప్రదించండి" orientation="stacked" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 px-2"
                      title="Share this listing"
                      aria-label="Share this listing"
                      onClick={() =>
                        shareListing({
                          name: listing.name,
                          pricePerKg: listing.pricePerKg,
                          location,
                          id: listing.id,
                        })
                      }
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <Link
                    href={`/produce/${listing.id}`}
                    className="block text-xs text-center text-primary underline underline-offset-2 mt-2"
                  >
                    View full details
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        listing={selectedListing}
      />
      <ContactFarmerDialog
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        farmerName={farmer.name}
        phone={farmer.phone}
        produceName={contactProduce}
      />
    </div>
  );
}
