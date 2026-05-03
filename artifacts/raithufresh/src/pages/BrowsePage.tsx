import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, MapPin, Calendar, Phone, Loader2, Share2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import ReservationModal from "@/components/ReservationModal";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import { mockListings, mockFarmers } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import { isSupabaseConfigured, getSupabase, SupabaseListing } from "@/lib/supabase";
import { shareListing } from "@/lib/share";
import BilingualLabel from "@/components/BilingualLabel";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapSupabaseListing(row: SupabaseListing): ProduceListing {
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

/** Days between today and a harvest date. Negative = future, positive = past. */
function daysSinceHarvest(dateStr: string): number {
  if (!dateStr) return Infinity;
  const harvestMs = new Date(dateStr).getTime();
  return (Date.now() - harvestMs) / 86_400_000;
}

const TODAY = new Date().toISOString().split("T")[0];

type FarmerMap = Record<string, {
  name: string;
  village: string;
  district: string;
  phone: string | null;
}>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function BrowsePage() {
  // ── Data state ─────────────────────────────────────────────────────────────
  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [farmerMap, setFarmerMap] = useState<FarmerMap>({});
  const [loading, setLoading] = useState(true);

  // ── Filter / sort state ────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [freshnessFilter, setFreshnessFilter] = useState("All");
  const [sortBy, setSortBy] = useState("default");

  // ── Dialog state ───────────────────────────────────────────────────────────
  const [selectedListing, setSelectedListing] = useState<ProduceListing | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<{
    name: string;
    phone: string | null;
    produceName: string;
  } | null>(null);

  // ── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setListings(mockListings.filter((l) => l.status === "Available"));
        const fm: FarmerMap = {};
        mockFarmers.forEach((f) => {
          fm[f.id] = { name: f.name, village: f.village, district: "", phone: f.phone };
        });
        setFarmerMap(fm);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from("produce_listings")
          .select("*, farmers(id, name, village, district, rating, phone)")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;

        const rows = (data ?? []) as SupabaseListing[];
        setListings(rows.map(mapSupabaseListing));

        const fm: FarmerMap = {};
        rows.forEach((row) => {
          if (row.farmers) {
            fm[row.farmer_id] = {
              name: row.farmers.name,
              village: row.farmers.village ?? "",
              district: row.farmers.district ?? "",
              phone: row.farmers.phone ?? null,
            };
          }
        });
        setFarmerMap(fm);
      } catch (e) {
        console.warn("Supabase load failed, using mock data:", e);
        setListings(mockListings.filter((l) => l.status === "Available"));
        const fm: FarmerMap = {};
        mockFarmers.forEach((f) => {
          fm[f.id] = { name: f.name, village: f.village, district: "", phone: f.phone };
        });
        setFarmerMap(fm);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  /** Unique sorted districts for the location dropdown */
  const locationOptions: string[] = Array.from(
    new Set(
      Object.values(farmerMap)
        .map((f) => f.district)
        .filter(Boolean)
    )
  ).sort();

  const hasActiveFilters =
    search !== "" ||
    categoryFilter !== "All" ||
    maxPrice !== "All" ||
    locationFilter !== "All" ||
    freshnessFilter !== "All" ||
    sortBy !== "default";

  const clearFilters = () => {
    setSearch("");
    setCategoryFilter("All");
    setMaxPrice("All");
    setLocationFilter("All");
    setFreshnessFilter("All");
    setSortBy("default");
  };

  // ── Filter + sort pipeline ────────────────────────────────────────────────

  const q = search.trim().toLowerCase();

  const filtered = listings.filter((l) => {
    const f = farmerMap[l.farmerId];

    // Multi-field search: name, farmer name, village, district, category
    if (q) {
      const haystack = [
        l.name,
        f?.name,
        f?.village,
        f?.district,
        l.category,
        l.pickupLocation,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // Category
    if (categoryFilter !== "All" && l.category !== categoryFilter) return false;

    // Max price
    if (maxPrice !== "All" && l.pricePerKg > Number(maxPrice)) return false;

    // Location (district)
    if (locationFilter !== "All" && f?.district !== locationFilter) return false;

    // Freshness
    if (freshnessFilter === "today" && l.harvestDate !== TODAY) return false;
    if (freshnessFilter === "2days" && daysSinceHarvest(l.harvestDate) > 2) return false;
    if (freshnessFilter === "week" && daysSinceHarvest(l.harvestDate) > 7) return false;

    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "nearest") return (a.distanceKm || 999) - (b.distanceKm || 999);
    if (sortBy === "price_asc") return a.pricePerKg - b.pricePerKg;
    if (sortBy === "qty_desc") return b.quantityKg - a.quantityKg;
    if (sortBy === "freshest") {
      if (!a.harvestDate) return 1;
      if (!b.harvestDate) return -1;
      return new Date(b.harvestDate).getTime() - new Date(a.harvestDate).getTime();
    }
    return 0; // default: original load order
  });

  // ── Summary line ──────────────────────────────────────────────────────────

  function buildSummary(): string {
    const count = sorted.length;
    const catLabel =
      categoryFilter === "Fruit" ? "fruit"
      : categoryFilter === "Vegetable" ? "vegetable"
      : "fruit and vegetable";
    const locLabel = locationFilter !== "All" ? ` near ${locationFilter}` : "";
    const freshLabel =
      freshnessFilter === "today" ? ", harvested today"
      : freshnessFilter === "2days" ? ", harvested within 2 days"
      : freshnessFilter === "week" ? ", harvested this week"
      : "";

    if (q) {
      return `${count} result${count !== 1 ? "s" : ""} for "${search}"${locLabel}${freshLabel}`;
    }
    return `Showing ${count} ${catLabel} listing${count !== 1 ? "s" : ""}${locLabel}${freshLabel}`;
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleReserve = (listing: ProduceListing) => {
    setSelectedListing(listing);
    setModalOpen(true);
  };

  const handleContact = (listing: ProduceListing) => {
    const f = farmerMap[listing.farmerId];
    setContactTarget({
      name: f?.name ?? "Farmer",
      phone: f?.phone ?? null,
      produceName: listing.name,
    });
  };

  const handleShare = (listing: ProduceListing) => {
    const f = farmerMap[listing.farmerId];
    shareListing({
      name: listing.name,
      pricePerKg: listing.pricePerKg,
      location: f?.village ?? "",
      id: listing.id,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">
            <BilingualLabel en="Browse Fresh Produce" te="తాజా పంటలను చూడండి" />
          </h1>
          <p className="text-muted-foreground text-sm">
            <BilingualLabel en="Directly from Telangana farmers near you" te="మీకు దగ్గరలో ఉన్న తెలంగాణ రైతుల నుండి నేరుగా" />
          </p>
        </div>

        {/* ── Search + filters ── */}
        <div className="space-y-3 mb-5">

          {/* Row 1: Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by produce, farmer, village, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Row 2: Category | Location | Max Price */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">
                  <BilingualLabel en="All Types" te="అన్నీ" />
                </SelectItem>
                <SelectItem value="Fruit">
                  <BilingualLabel en="Fruit" te="పండ్లు" />
                </SelectItem>
                <SelectItem value="Vegetable">
                  <BilingualLabel en="Vegetable" te="కూరగాయలు" />
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Districts</SelectItem>
                {locationOptions.map((district) => (
                  <SelectItem key={district} value={district}>
                    {district}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={maxPrice} onValueChange={setMaxPrice}>
              <SelectTrigger className="col-span-2 sm:col-span-1">
                <SelectValue placeholder="Max Price" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Any Price</SelectItem>
                <SelectItem value="25">Up to Rs 25/kg</SelectItem>
                <SelectItem value="50">Up to Rs 50/kg</SelectItem>
                <SelectItem value="80">Up to Rs 80/kg</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Freshness | Sort */}
          <div className="grid grid-cols-2 gap-2">
            <Select value={freshnessFilter} onValueChange={setFreshnessFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Freshness" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">Any Harvest Date</SelectItem>
                <SelectItem value="today">Harvested Today</SelectItem>
                <SelectItem value="2days">Within 2 Days</SelectItem>
                <SelectItem value="week">Within This Week</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Recently Added</SelectItem>
                <SelectItem value="nearest">Nearest First</SelectItem>
                <SelectItem value="price_asc">Lowest Price</SelectItem>
                <SelectItem value="qty_desc">Highest Quantity</SelectItem>
                <SelectItem value="freshest">Freshest Harvest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Results ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading listings...</span>
          </div>
        ) : (
          <>
            {/* Summary + clear */}
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <p className="text-sm text-muted-foreground">{buildSummary()}</p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5 h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="w-3.5 h-3.5" />
                  Clear filters
                </Button>
              )}
            </div>

            {listings.length === 0 ? (
              <div className="text-center py-16">
                <img
                  src="/assets/empty-produce.svg"
                  alt="No produce available"
                  width={120}
                  height={96}
                  className="mx-auto mb-4 opacity-70"
                />
                <p className="font-medium text-foreground mb-1">No produce listed yet</p>
                <p className="text-sm text-muted-foreground">
                  Check back soon — farmers are being added.
                </p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-foreground mb-1">No matching produce found</p>
                <p className="text-sm">Try changing your search or filters.</p>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sorted.map((listing, i) => {
                  const f = farmerMap[listing.farmerId] ?? null;
                  return (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.3 }}
                      className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground text-base">{listing.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {listing.farmerId ? (
                              <Link
                                href={`/farmers/${listing.farmerId}`}
                                className="font-medium text-foreground hover:underline underline-offset-2"
                              >
                                {f?.name ?? "—"}
                              </Link>
                            ) : (f?.name ?? "—")}
                            {f?.village ? ` · ${f.village}` : ""}
                            {f?.district && f.district !== f.village ? `, ${f.district}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant={listing.category === "Fruit" ? "default" : "secondary"}
                          className="shrink-0"
                        >
                          {listing.category}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-primary/5 rounded-lg p-2 text-center">
                          <div className="font-bold text-primary text-lg">
                            <BilingualLabel en={`Rs ${listing.pricePerKg}`} te={`Rs ${listing.pricePerKg}`} orientation="stacked" />
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            <BilingualLabel en="per kg" te="కేజీకి" />
                          </div>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <div className="font-bold text-foreground text-lg">{listing.quantityKg}</div>
                          <div className="text-muted-foreground text-[10px]">
                            <BilingualLabel en="kg available" te="కేజీలు ఉన్నాయి" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
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
                      </div>

                      {listing.qualityNotes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-2 py-1">
                          {listing.qualityNotes}
                        </p>
                      )}

                      <div className="flex gap-2 mt-auto pt-1">
                        <Button size="sm" className="flex-1 h-auto py-2" onClick={() => handleReserve(listing)}>
                          <BilingualLabel en="Reserve" te="రిజర్వ్" orientation="stacked" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-auto py-2"
                          onClick={() => handleContact(listing)}
                        >
                          <BilingualLabel en="Contact" te="సంప్రదించండి" orientation="stacked" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 px-2"
                          onClick={() => handleShare(listing)}
                          title="Share this listing"
                          aria-label="Share this listing"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Link
                        href={`/produce/${listing.id}`}
                        className="text-xs text-center text-primary underline underline-offset-2"
                      >
                        <BilingualLabel en="View full details" te="పూర్తి వివరాలు చూడండి" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        listing={selectedListing}
      />
      <ContactFarmerDialog
        open={contactTarget !== null}
        onClose={() => setContactTarget(null)}
        farmerName={contactTarget?.name ?? "Farmer"}
        phone={contactTarget?.phone ?? null}
        produceName={contactTarget?.produceName}
      />
    </div>
  );
}
