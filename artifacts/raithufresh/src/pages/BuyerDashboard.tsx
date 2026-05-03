import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList, Calendar, MapPin, Package, Phone,
  CheckCircle2, Clock, XCircle, Loader2, BadgeCheck, Search, X,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import BilingualLabel from "@/components/BilingualLabel";

// ── Constants ────────────────────────────────────────────────────────────────

type FilterTab = "all" | ReservationStatus;
type SortOrder = "newest" | "oldest" | "quantity_high" | "status";

const ALL_STATUSES: ReservationStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const FILTER_TABS: FilterTab[] = ["all", ...ALL_STATUSES];

const STATUS_PRIORITY: Record<ReservationStatus, number> = {
  pending: 0, confirmed: 1, completed: 2, cancelled: 3,
};

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

const STATUS_LABEL: Record<ReservationStatus, { en: string; te: string }> = {
  pending: { en: "Pending", te: "వేచి ఉంది" },
  confirmed: { en: "Confirmed", te: "నిర్ధారించబడింది" },
  completed: { en: "Completed", te: "పూర్తయింది" },
  cancelled: { en: "Cancelled", te: "రద్దు చేయబడింది" },
};

const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  quantity_high: "Quantity high to low",
  status: "By status",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BuyerDashboard() {
  const { user, profile } = useAuth();
  const [reservations, setReservations] = useState<BuyerReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [cancelConfirm, setCancelConfirm] = useState<{ id: string; name: string } | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<{
    name: string;
    phone: string | null;
    produceName: string;
  } | null>(null);

  const loadReservations = useCallback(async () => {
    if (!isSupabaseConfigured()) { setLoading(false); return; }
    setLoading(true);
    setFetchError(null);
    const data = await getReservationsForCurrentBuyer();
    if (data === null) {
      setFetchError("Could not load your reservations. Please check your connection and try again.");
    } else {
      setReservations(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReservations();
  }, [loadReservations]);

  // ── Counts (always from full list) ────────────────────────────────────────

  const counts = useMemo(
    () =>
      Object.fromEntries(
        ALL_STATUSES.map((s) => [s, reservations.filter((r) => r.status === s).length])
      ) as Record<ReservationStatus, number>,
    [reservations]
  );

  const totalCount = reservations.length;

  // ── Sorted → Filtered → Searched ─────────────────────────────────────────

  const processed = useMemo(() => {
    // 1. Sort
    const sorted = [...reservations].sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === "quantity_high") return b.quantity_kg - a.quantity_kg;
      if (sortOrder === "status") return STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
      return 0;
    });

    // 2. Filter by status tab
    const filtered = activeFilter === "all" ? sorted : sorted.filter((r) => r.status === activeFilter);

    // 3. Filter by search
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((r) => {
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
  }, [reservations, activeFilter, searchQuery, sortOrder]);

  const hasActiveFilters = activeFilter !== "all" || searchQuery.trim().length > 0;

  // ── Cancel handler ────────────────────────────────────────────────────────

  const handleCancel = (reservationId: string, produceName: string) => {
    setCancelConfirm({ id: reservationId, name: produceName });
  };

  const executeCancelConfirmed = async () => {
    if (!cancelConfirm) return;
    const { id: reservationId } = cancelConfirm;
    setCancelConfirm(null);
    setCancellingIds((prev) => new Set(prev).add(reservationId));
    const ok = await cancelBuyerReservation(reservationId);
    setCancellingIds((prev) => { const n = new Set(prev); n.delete(reservationId); return n; });
    if (ok) {
      setReservations((prev) =>
        prev.map((r) => r.id === reservationId ? { ...r, status: "cancelled" as ReservationStatus } : r)
      );
    }
  };

  const clearFilters = () => { setActiveFilter("all"); setSearchQuery(""); };

  const displayName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Buyer";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            <BilingualLabel en="Buyer Dashboard" te="కొనుగోలుదారు డాష్బోర్డ్" />
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <BilingualLabel en={`Welcome back, ${displayName}`} te={`స్వాగతం, ${displayName}`} />
          </p>
          {user?.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
        </div>

        {/* Onboarding card */}
        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
            <BadgeCheck className="w-4 h-4" />
            <BilingualLabel en="How it works" te="ఇది ఎలా పనిచేస్తుంది" />
          </h3>
          <div className="grid gap-3">
            {[
              { en: "Browse produce from nearby farmers", te: "దగ్గరలోని రైతుల నుండి పంటలను చూడండి" },
              { en: "Reserve what you need", te: "మీకు కావలసిన దానిని రిజర్వ్ చేయండి" },
              { en: "Contact farmer to confirm pickup", te: "పికప్ కోసం రైతును సంప్రదించండి" },
              { en: "Pay farmer directly during pickup", te: "పికప్ సమయంలో రైతుకు నేరుగా పే చేయండి" },
            ].map((step, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold shrink-0">
                  {i + 1}
                </span>
                <BilingualLabel en={step.en} te={step.te} />
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Link href="/browse">
              <Button size="sm" className="h-auto py-1.5 px-4 text-xs">
                <BilingualLabel en="Browse Produce" te="పంటలను చూడండి" />
              </Button>
            </Link>
          </div>
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
                  activeFilter === status ? "ring-2 ring-offset-1 ring-current opacity-100" : "opacity-75 hover:opacity-100"
                }`}
              >
                <Icon className="w-4 h-4 mx-auto mb-1.5 opacity-80" />
                <div className="text-2xl font-bold leading-none">{counts[status]}</div>
                <div className="text-[10px] mt-1 capitalize opacity-80">
                  <BilingualLabel en={STATUS_LABEL[status].en} te={STATUS_LABEL[status].te} orientation="stacked" variant="onLight" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Filter tabs + Search + Sort */}
        <div className="mb-4 space-y-3">
          {/* Filter tabs + Sort */}
          <div className="flex items-center gap-2 flex-wrap justify-between">
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
                        : "bg-card text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className="capitalize text-xs">
                      {tab === "all" ? (
                        <BilingualLabel en="All" te="అన్నీ" variant={isActive ? "button" : "onLight"} />
                      ) : (
                        <BilingualLabel 
                          en={STATUS_LABEL[tab as ReservationStatus].en} 
                          te={STATUS_LABEL[tab as ReservationStatus].te} 
                          variant={isActive ? "button" : "onLight"}
                        />
                      )}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-card/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border bg-card text-foreground border-border hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs">{SORT_LABELS[sortOrder]}</span>
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-20 min-w-[180px] py-1">
                  {(Object.keys(SORT_LABELS) as SortOrder[]).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => { setSortOrder(opt); setSortOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortOrder === opt ? "text-primary font-semibold" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {SORT_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          <BilingualLabel en="Reservation History" te="రిజర్వేషన్ చరిత్ర" />
          {!loading && (
            <span className="text-xs font-normal text-muted-foreground ml-1">
              ({processed.length})
            </span>
          )}
        </h2>

        {/* Backdrop for sort dropdown */}
        {sortOpen && (
          <div className="fixed inset-0 z-10" onClick={() => setSortOpen(false)} />
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading your reservations...</span>
          </div>
        ) : fetchError ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <p className="font-semibold text-foreground mb-1">Could not load reservations</p>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">{fetchError}</p>
            <Button onClick={loadReservations}>Try Again</Button>
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
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Browse fresh produce and reserve directly from nearby farmers.
            </p>
            <Link href="/browse">
              <Button>Browse Produce</Button>
            </Link>
          </div>
        ) : processed.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No reservations match your filters</p>
            <p className="text-sm text-muted-foreground mb-4">
              Try adjusting your search or filter selection.
            </p>
            <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <div className="space-y-4">
              {processed.map((r, i) => {
                const listing = r.produce_listings;
                const farmer = listing?.farmers;
                const farmerLocation = [farmer?.village, farmer?.district].filter(Boolean).join(", ");
                const Icon = STATUS_ICON[r.status];
                const reservedDate = new Date(r.created_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
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
                    className={`bg-card border rounded-2xl p-5 shadow-sm transition-opacity border-border ${
                      r.status === "cancelled" ? "opacity-70" : ""
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <img
                            src={listing?.category === "Fruit" ? "/assets/icon-fruit.svg" : "/assets/icon-vegetable.svg"}
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
                            by {farmer.name}{farmerLocation ? ` · ${farmerLocation}` : ""}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${STATUS_BADGE[r.status]}`}>
                        <Icon className="w-3 h-3" />
                        <BilingualLabel en={STATUS_LABEL[r.status].en} te={STATUS_LABEL[r.status].te} />
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
                        <span className="text-xs">{r.payment_method ?? "Cash or UPI directly to farmer"}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-wrap">
                      <Link href={`/buyer/reservations/${r.id}`}>
                        <Button size="sm" variant="default" className="h-auto py-2">
                          <BilingualLabel en="View Details" te="వివరాలు చూడండి" orientation="stacked" />
                        </Button>
                      </Link>
                      <Link href={`/produce/${r.listing_id}`}>
                        <Button size="sm" variant="outline" className="h-auto py-2">
                          <BilingualLabel en="View Listing" te="పంటను చూడండి" orientation="stacked" />
                        </Button>
                      </Link>
                      {farmer?.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto py-2"
                          onClick={() => {
                            setContactTarget({
                              name: farmer.name ?? "Farmer",
                              phone: farmer.phone ?? null,
                              produceName: listing?.produce_name ?? "produce",
                            });
                            setContactOpen(true);
                          }}
                        >
                          <BilingualLabel en="Contact Farmer" te="రైతును సంప్రదించండి" orientation="stacked" />
                        </Button>
                      )}
                      {isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={isCancelling}
                          onClick={() => handleCancel(r.id, listing?.produce_name ?? "this produce")}
                        >
                          {isCancelling ? (
                            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Cancelling...</>
                          ) : (
                            <><XCircle className="w-3.5 h-3.5 mr-1.5" />Cancel Request</>
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

        {hasActiveFilters && processed.length > 0 && (
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
          onClose={() => { setContactOpen(false); setContactTarget(null); }}
          farmerName={contactTarget.name}
          phone={contactTarget.phone}
          produceName={contactTarget.produceName}
        />
      )}

      <AlertDialog open={cancelConfirm !== null} onOpenChange={(open) => { if (!open) setCancelConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
            <AlertDialogDescription>
              Cancel your reservation request for{" "}
              <span className="font-medium text-foreground">
                {cancelConfirm?.name ?? "this produce"}
              </span>
              ? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Reservation</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeCancelConfirmed}
            >
              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
