import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ClipboardList, Calendar, MapPin, Package, Phone,
  CheckCircle2, Clock, XCircle, Loader2, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReservationsForCurrentBuyer,
  BuyerReservation,
  ReservationStatus,
  isSupabaseConfigured,
} from "@/lib/supabase";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ReservationStatus, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-100 text-green-700 border-green-200",
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

const ALL_STATUSES: ReservationStatus[] = ["pending", "confirmed", "completed", "cancelled"];

// ── Component ────────────────────────────────────────────────────────────────

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<BuyerReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<{
    name: string;
    phone: string | null;
    produceName: string;
  } | null>(null);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const data = await getReservationsForCurrentBuyer();
      setReservations(data);
      setLoading(false);
    }
    load();
  }, []);

  const counts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, reservations.filter((r) => r.status === s).length])
  ) as Record<ReservationStatus, number>;

  const displayName =
    profile?.full_name ?? user?.email?.split("@")[0] ?? "Buyer";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Buyer Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Welcome back, {displayName}
          </p>
          {user?.email && (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>

        {/* Status count tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {ALL_STATUSES.map((status) => {
            const Icon = STATUS_ICON[status];
            return (
              <div
                key={status}
                className={`rounded-xl p-3 border text-center ${STATUS_BADGE[status]}`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                <div className="text-2xl font-bold leading-none">{counts[status]}</div>
                <div className="text-xs mt-1 capitalize opacity-80">{STATUS_LABEL[status]}</div>
              </div>
            );
          })}
        </div>

        {/* Reservation list */}
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Reservation History
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading your reservations...</span>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-16">
            <img
              src="/assets/empty-produce.svg"
              alt="No reservations yet"
              width={120}
              height={96}
              className="mx-auto mb-4 opacity-70"
            />
            <p className="font-semibold text-foreground mb-1">No reservations yet</p>
            <p className="text-sm text-muted-foreground mb-5">
              Browse fresh produce and make your first reservation.
            </p>
            <Link href="/browse">
              <Button>Browse Produce</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {reservations.map((r, i) => {
              const listing = r.produce_listings;
              const farmer = listing?.farmers;
              const farmerLocation = [farmer?.village, farmer?.district]
                .filter(Boolean)
                .join(", ");
              const Icon = STATUS_ICON[r.status];
              const reservedDate = new Date(r.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const estimatedTotal = listing?.price_per_kg
                ? (r.quantity_kg * Number(listing.price_per_kg)).toLocaleString()
                : null;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  className="bg-card border border-border rounded-2xl p-5 shadow-sm"
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            listing?.category === "Fruit"
                              ? "/assets/icon-fruit.svg"
                              : "/assets/icon-vegetable.svg"
                          }
                          alt={listing?.category ?? "Produce"}
                          width={18}
                          height={18}
                          className="shrink-0"
                        />
                        <p className="font-semibold text-foreground truncate">
                          {listing?.produce_name ?? "Produce"}
                        </p>
                      </div>
                      {farmer?.name && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {farmer.name}
                          {farmerLocation ? ` · ${farmerLocation}` : ""}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_BADGE[r.status]}`}
                    >
                      <Icon className="w-3 h-3" />
                      {STATUS_LABEL[r.status]}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        {r.quantity_kg} kg reserved
                        {estimatedTotal && (
                          <span className="text-primary font-medium ml-1">
                            · Rs {estimatedTotal} est.
                          </span>
                        )}
                      </span>
                    </div>
                    {listing?.pickup_location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{listing.pickup_location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Reserved on {reservedDate}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pl-5">
                      {r.payment_method ?? "Cash or UPI directly to farmer"}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Link href={`/produce/${r.listing_id}`}>
                      <Button size="sm" variant="outline">
                        View Listing
                      </Button>
                    </Link>
                    {farmer?.phone && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setContactTarget({
                            name: farmer.name ?? "Farmer",
                            phone: farmer.phone ?? null,
                            produceName: listing?.produce_name ?? "produce",
                          });
                          setContactOpen(true);
                        }}
                      >
                        <Phone className="w-3.5 h-3.5 mr-1.5" />
                        Contact Farmer
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {contactTarget && (
        <ContactFarmerDialog
          open={contactOpen}
          onClose={() => {
            setContactOpen(false);
            setContactTarget(null);
          }}
          farmerName={contactTarget.name}
          phone={contactTarget.phone}
          produceName={contactTarget.produceName}
        />
      )}
    </div>
  );
}
