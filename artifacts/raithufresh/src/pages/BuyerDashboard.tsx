import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Calendar, MapPin, Package, Phone,
  CheckCircle2, Clock, XCircle, Loader2, BadgeCheck, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/Navbar";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReservationsForCurrentBuyer,
  cancelBuyerReservation,
  BuyerReservation,
  ReservationStatus,
  isSupabaseConfigured,
} from "@/lib/supabase";

// ── Constants ────────────────────────────────────────────────────────────────

type FilterTab = "all" | ReservationStatus;

const ALL_STATUSES: ReservationStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const FILTER_TABS: FilterTab[] = ["all", ...ALL_STATUSES];

const STATUS_BADGE: Record<ReservationStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_TILE: Record<ReservationStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-primary/5 text-primary border-primary/15",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-destructive/5 text-destructive border-destructive/15",
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

// ── Component ────────────────────────────────────────────────────────────────

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<BuyerReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
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

  // ── Counts (always from full list) ────────────────────────────────────────

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ALL_STATUSES.map((s) => [s, reservations.filter((r) => r.status === s).length])
      ) as Record<ReservationStatus, number>,
    [reservations]
  );

  const totalCount = reservations.length;

  // ── Filtered + searched list ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = reservations;
    if (activeFilter !== "all") {
      list = list.filter((r) => r.status === activeFilter);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const listing = r.produce_listings;
        const farmer = listing?.farmers;
        return (
          listing?.produce_name?.toLowerCase().includes(q) ||
          farmer?.name?.toLowerCase().includes(q) ||
          farmer?.village?.toLowerCase().includes(q) ||
          farmer?.district?.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [reservations, activeFilter, searchQuery]);

  const hasActiveFilters = activeFilter !== "all" || searchQuery.trim().length > 0;

  // ── Cancel handler ────────────────────────────────────────────────────────

  const handleCancel = async (reservationId: string, produceName: string) => {
    const confirmed = window.confirm(
      `Cancel your reservation request for "${produceName}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setCancellingIds((prev) => new Set(prev).add(reservationId));
    const ok = await cancelBuyerReservation(reservationId);
    setCancellingIds((prev) => {
      const next = new Set(prev);
      next.delete(reservationId);
      return next;
    });

    if (ok) {
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: "cancelled" as ReservationStatus } : r
        )
      );
    }
  };

  const clearFilters = () => {
    setActiveFilter("all");
    setSearchQuery("");
  };

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Buyer";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Buyer Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {displayName}</p>
          {user?.email && (
            <p className="text-xs text-muted-foreground">{user.email}</p>
          )}
        </div>

        {/* Status tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {ALL_STATUSES.map((status) => {
            const Icon = STATUS_ICON[status];
            return (
              <button
                key={status}
                onClick={() => setActiveFilter(activeFilter === status ? "all" : status)}
                className={`rounded-xl p-3 border text-center transition-all ${STATUS_TILE[status]} ${
                  activeFilter === status ? "ring-2 ring-offset-1 ring-current opacity-100" : "opacity-80 hover:opacity-100"
                }`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                <div className="text-2xl font-bold leading-none">{counts[status]}</div>
                <div className="text-xs mt-1 capitalize opacity-80">{STATUS_LABEL[status]}</div>
              </button>
            );
          })}
        </div>

        {/* Filter tabs + Search */}
        <div className="mb-4 space-y-3">
          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {FILTER_TABS.map((tab) => {
              const count = tab === "all" ? totalCount : counts[tab as ReservationStatus];
              const isActive = activeFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span className="capitalize">{tab === "all" ? "All" : STATUS_LABEL[tab as ReservationStatus]}</span>
                  <span
                    className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by produce, farmer, village, district or status..."
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Section heading */}
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Reservation History
          {!loading && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({filtered.length} {filtered.length === 1 ? "result" : "results"})
            </span>
          )}
        </h2>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading your reservations...</span>
          </div>
        ) : reservations.length === 0 ? (
          /* True empty — no reservations at all */
          <div className="text-center py-16">
            <img
              src="/assets/empty-produce.svg"
              alt="No reservations yet"
              width={120}
              height={96}
              className="mx-auto mb-4 opacity-70"
            />
            <p className="font-semibold text-foreground mb-1">No reservations yet</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Browse fresh produce and reserve directly from nearby farmers.
            </p>
            <Link href="/browse">
              <Button>Browse Produce</Button>
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          /* Filter/search returns nothing */
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No reservations match your filters</p>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filter selection.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-4">
              {filtered.map((r, i) => {
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
                const isCancelling = cancellingIds.has(r.id);
                const isPending = r.status === "pending";

                return (
                  <motion.div
                    key={r.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: i * 0.03, duration: 0.25 }}
                    className={`bg-card border rounded-2xl p-5 shadow-sm transition-opacity ${
                      r.status === "cancelled" ? "opacity-70" : ""
                    } border-border`}
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

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm mb-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>
                          {r.quantity_kg} kg
                          {estimatedTotal && (
                            <span className="text-primary font-medium"> · Rs {estimatedTotal}</span>
                          )}
                        </span>
                      </div>
                      {listing?.pickup_location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="truncate">{listing.pickup_location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{reservedDate}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground col-span-2 sm:col-span-1">
                        <span className="text-xs">
                          {r.payment_method ?? "Cash or UPI directly to farmer"}
                        </span>
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
                      {isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={isCancelling}
                          onClick={() =>
                            handleCancel(r.id, listing?.produce_name ?? "this produce")
                          }
                        >
                          {isCancelling ? (
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
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}

        {/* Clear filters shortcut when filters are active and list is non-empty */}
        {hasActiveFilters && filtered.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Clear filters
            </button>
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
