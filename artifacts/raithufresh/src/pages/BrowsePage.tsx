import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, MapPin, Calendar, Phone, Loader2, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import ReservationModal from "@/components/ReservationModal";
import ContactFarmerDialog from "@/components/ContactFarmerDialog";
import { mockListings, mockFarmers } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import { isSupabaseConfigured, getSupabase, SupabaseListing } from "@/lib/supabase";
import { shareListing } from "@/lib/share";

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

type FarmerMap = Record<string, { name: string; village: string; phone: string | null }>;

export default function BrowsePage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [maxPrice, setMaxPrice] = useState("All");
  const [selectedListing, setSelectedListing] = useState<ProduceListing | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contactTarget, setContactTarget] = useState<{ name: string; phone: string | null; produceName: string } | null>(null);

  const [listings, setListings] = useState<ProduceListing[]>([]);
  const [farmerMap, setFarmerMap] = useState<FarmerMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setListings(mockListings.filter((l) => l.status === "Available"));
        const fm: FarmerMap = {};
        mockFarmers.forEach((f) => { fm[f.id] = { name: f.name, village: f.village, phone: f.phone }; });
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
              phone: row.farmers.phone ?? null,
            };
          }
        });
        setFarmerMap(fm);
      } catch (e) {
        console.warn("Supabase load failed, using mock data:", e);
        setListings(mockListings.filter((l) => l.status === "Available"));
        const fm: FarmerMap = {};
        mockFarmers.forEach((f) => { fm[f.id] = { name: f.name, village: f.village, phone: f.phone }; });
        setFarmerMap(fm);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const farmer = (id: string) => farmerMap[id] ?? null;

  const filtered = listings.filter((l) => {
    if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter !== "All" && l.category !== categoryFilter) return false;
    if (maxPrice !== "All" && l.pricePerKg > Number(maxPrice)) return false;
    return true;
  });

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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-1">Browse Fresh Produce</h1>
          <p className="text-muted-foreground text-sm">Directly from Telangana farmers near you</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search produce (tomato, mango...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="Fruit">Fruit</SelectItem>
              <SelectItem value="Vegetable">Vegetable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={maxPrice} onValueChange={setMaxPrice}>
            <SelectTrigger className="w-full sm:w-40">
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

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading listings...</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">{filtered.length} listings found</p>
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No produce found. Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((listing, i) => {
                  const f = farmer(listing.farmerId);
                  return (
                    <motion.div
                      key={listing.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
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
                          </p>
                        </div>
                        <Badge variant={listing.category === "Fruit" ? "default" : "secondary"} className="shrink-0">
                          {listing.category}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-primary/5 rounded-lg p-2 text-center">
                          <div className="font-bold text-primary text-lg">Rs {listing.pricePerKg}</div>
                          <div className="text-muted-foreground text-xs">per kg</div>
                        </div>
                        <div className="bg-muted rounded-lg p-2 text-center">
                          <div className="font-bold text-foreground text-lg">{listing.quantityKg}</div>
                          <div className="text-muted-foreground text-xs">kg available</div>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          Harvest: {listing.harvestDate}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {listing.pickupLocation} · {listing.distanceKm} km away
                        </div>
                      </div>

                      {listing.qualityNotes && (
                        <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-2 py-1">
                          {listing.qualityNotes}
                        </p>
                      )}

                      <div className="flex gap-2 mt-auto pt-1">
                        <Button size="sm" className="flex-1" onClick={() => handleReserve(listing)}>
                          Reserve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleContact(listing)}>
                          <Phone className="w-3.5 h-3.5 mr-1" />
                          Contact
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 px-2"
                          onClick={() => handleShare(listing)}
                          title="Share this listing"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <Link href={`/produce/${listing.id}`} className="text-xs text-center text-primary underline underline-offset-2">
                        View full details
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
