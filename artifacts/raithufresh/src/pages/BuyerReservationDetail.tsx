import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft, Calendar, MapPin, Package, Phone, ExternalLink,
  CheckCircle2, Clock, XCircle, Loader2, BadgeCheck, Star,
  ShieldCheck, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import {
  getBuyerReservationById,
  cancelBuyerReservation,
  BuyerReservationDetail,
  ReservationStatus,
  isSupabaseConfigured,
} from "@/lib/supabase";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ReservationStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_ICON: Record<ReservationStatus, React.ElementType> = {
  pending: Clock,
  confirmed: CheckCircle2,
  completed: BadgeCheck,
  cancelled: XCircle,
};

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  id: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function BuyerReservationDetailPage({ id }: Props) {
  const [reservation, setReservation] = useState<BuyerReservationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id || !isSupabaseConfigured()) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const data = await getBuyerReservationById(id);
      if (!data) setNotFound(true);
      else setReservation(data);
      setLoading(false);
    }
    load();
  }, [id]);

  const handleCancel = async () => {
    if (!reservation) return;
    const produce = reservation.produce_listings?.produce_name ?? "this produce";
    const confirmed = window.confirm(
      `Cancel your reservation request for "${produce}"? This cannot be undone.`
    );
    if (!confirmed) return;
    setCancelling(true);
    const ok = await cancelBuyerReservation(reservation.id);
    setCancelling(false);
    if (ok) {
      setReservation((prev) =>
        prev ? { ...prev, status: "cancelled" as ReservationStatus } : prev
      );
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-32 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading reservation...</span>
        </div>
      </div>
    );
  }

  // ── Not found / access denied ─────────────────────────────────────────────

  if (notFound || !reservation) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-6 h-6 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Reservation not found</h1>
          <p className="text-sm text-muted-foreground mb-6">
            This reservation does not exist, or you do not have permission to view it.
          </p>
          <Link href="/buyer">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Buyer Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const listing = reservation.produce_listings;
  const farmer = listing?.farmers;
  const StatusIcon = STATUS_ICON[reservation.status];
  const isPending = reservation.status === "pending";

  const estimatedTotal = listing?.price_per_kg
    ? (reservation.quantity_kg * Number(listing.price_per_kg)).toLocaleString("en-IN")
    : null;

  const reservedDate = new Date(reservation.created_at).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const reservedTime = new Date(reservation.created_at).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const harvestDate = listing?.harvest_datetime
    ? new Date(listing.harvest_datetime).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const farmerLocation = [farmer?.village, farmer?.district].filter(Boolean).join(", ");

  // Pickup directions — plain OpenStreetMap search, no API key needed
  const pickupSearchUrl = listing?.pickup_location
    ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(listing.pickup_location)}`
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link href="/buyer">
          <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Buyer Dashboard
          </button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Header card */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={listing?.category === "Fruit" ? "/assets/icon-fruit.svg" : "/assets/icon-vegetable.svg"}
                  alt={listing?.category ?? "Produce"}
                  width={22}
                  height={22}
                  className="shrink-0"
                />
                <h1 className="text-xl font-bold text-foreground truncate">
                  {listing?.produce_name ?? "Reservation"}
                </h1>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full border font-medium shrink-0 ${STATUS_BADGE[reservation.status]}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {STATUS_LABEL[reservation.status]}
              </span>
            </div>
            {listing?.category && (
              <p className="text-xs text-muted-foreground ml-8">{listing.category}</p>
            )}
          </div>

          {/* Reservation details */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide text-muted-foreground">
              Reservation Details
            </h2>
            <div className="space-y-3">
              <DetailRow
                icon={<Package className="w-4 h-4 text-primary" />}
                label="Quantity"
                value={`${reservation.quantity_kg} kg`}
              />
              {estimatedTotal && (
                <DetailRow
                  icon={<Package className="w-4 h-4 text-primary opacity-0" />}
                  label="Estimated total"
                  value={`Rs ${estimatedTotal}`}
                  valueClass="text-primary font-semibold"
                />
              )}
              <DetailRow
                icon={<Calendar className="w-4 h-4 text-primary" />}
                label="Reserved on"
                value={`${reservedDate} at ${reservedTime}`}
              />
              {harvestDate && (
                <DetailRow
                  icon={<Calendar className="w-4 h-4 text-primary" />}
                  label="Expected harvest"
                  value={harvestDate}
                />
              )}
              <DetailRow
                icon={<Package className="w-4 h-4 text-primary" />}
                label="Payment method"
                value={reservation.payment_method ?? "Cash or UPI directly to farmer"}
              />
            </div>
          </div>

          {/* Pickup location */}
          {listing?.pickup_location && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Pickup Location
              </h2>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{listing.pickup_location}</p>
                  {listing.district && (
                    <p className="text-xs text-muted-foreground mt-0.5">{listing.district}</p>
                  )}
                </div>
              </div>
              {pickupSearchUrl && (
                <a
                  href={pickupSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in map
                </a>
              )}
            </div>
          )}

          {/* Farmer details */}
          {farmer && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                Farmer
              </h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-foreground">{farmer.name}</p>
                    {farmer.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  {farmerLocation && (
                    <p className="text-xs text-muted-foreground">{farmerLocation}</p>
                  )}
                  {farmer.rating != null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span className="text-xs text-muted-foreground">
                        {Number(farmer.rating).toFixed(1)} rating
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
              Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link href={`/produce/${reservation.listing_id}`}>
                <Button size="sm" variant="outline">
                  View Listing
                </Button>
              </Link>
              {farmer && (
                <Link href={`/farmers/${reservation.listing_id}`}>
                  <Button size="sm" variant="outline">
                    View Farmer Profile
                  </Button>
                </Link>
              )}
              {farmer?.phone && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setContactOpen(true)}
                >
                  <Phone className="w-3.5 h-3.5 mr-1.5" />
                  Contact Farmer
                </Button>
              )}
              {isPending && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={cancelling}
                  onClick={handleCancel}
                >
                  {cancelling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1.5" />
                      Cancel Request
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {farmer?.phone && (
        <ContactFarmerDialog
          open={contactOpen}
          onClose={() => setContactOpen(false)}
          farmerName={farmer.name ?? "Farmer"}
          phone={farmer.phone}
          produceName={listing?.produce_name ?? "produce"}
        />
      )}
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
  valueClass = "text-foreground",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-xs text-muted-foreground block mb-0.5">{label}</span>
        <span className={`text-sm ${valueClass}`}>{value}</span>
      </div>
    </div>
  );
}
