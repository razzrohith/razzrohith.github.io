import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Users, Tractor, ShoppingBag, Package, TrendingUp, CheckCircle, Ban, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { mockFarmers, mockBuyers, mockAgents, mockListings, mockReservations } from "@/data/mockData";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";

type DbCounts = {
  waitlist: number;
  farmers: number;
  listings: number;
  reservations: number;
};

type UserStatus = { [id: string]: "Active" | "Suspended" };

export default function AdminDashboard() {
  const [dbCounts, setDbCounts] = useState<DbCounts | null>(null);
  const [farmerStatus, setFarmerStatus] = useState<UserStatus>(
    Object.fromEntries(mockFarmers.map((f) => [f.id, "Active" as const]))
  );
  const [buyerStatus, setBuyerStatus] = useState<UserStatus>(
    Object.fromEntries(mockBuyers.map((b) => [b.id, "Active" as const]))
  );

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    async function loadCounts() {
      try {
        const sb = getSupabase();
        const [waitlistRes, farmersRes, listingsRes, reservationsRes] = await Promise.all([
          sb.from("waitlist_leads").select("id", { count: "exact", head: true }),
          sb.from("farmers").select("id", { count: "exact", head: true }),
          sb.from("produce_listings").select("id", { count: "exact", head: true }),
          sb.from("reservations").select("id", { count: "exact", head: true }),
        ]);
        setDbCounts({
          waitlist: waitlistRes.count ?? 0,
          farmers: farmersRes.count ?? 0,
          listings: listingsRes.count ?? 0,
          reservations: reservationsRes.count ?? 0,
        });
      } catch (e) {
        console.warn("Admin count fetch failed:", e);
      }
    }
    loadCounts();
  }, []);

  const analyticsCards = [
    {
      label: "Waitlist Signups",
      value: dbCounts ? dbCounts.waitlist : "—",
      sub: dbCounts ? "from database" : "Supabase not connected",
      icon: Users,
      color: "bg-blue-50 text-blue-700 border-blue-100",
    },
    {
      label: "Total Farmers",
      value: dbCounts ? dbCounts.farmers : mockFarmers.length,
      sub: dbCounts ? "from database" : "mock data",
      icon: Tractor,
      color: "bg-green-50 text-green-700 border-green-100",
    },
    {
      label: "Produce Listings",
      value: dbCounts ? dbCounts.listings : mockListings.filter((l) => l.status === "Available").length,
      sub: dbCounts ? "from database" : "mock data",
      icon: Package,
      color: "bg-amber-50 text-amber-700 border-amber-100",
    },
    {
      label: "Reservations",
      value: dbCounts ? dbCounts.reservations : mockReservations.length,
      sub: dbCounts ? "from database" : "mock data",
      icon: ShoppingBag,
      color: "bg-purple-50 text-purple-700 border-purple-100",
    },
    {
      label: "Reserved Qty (mock)",
      value: `${mockReservations.reduce((a, r) => a + r.quantityKg, 0)} kg`,
      sub: "mock data",
      icon: TrendingUp,
      color: "bg-orange-50 text-orange-700 border-orange-100",
    },
    {
      label: "Est. Sales Value (mock)",
      value: `Rs ${mockListings.reduce((a, l) => a + l.pricePerKg * l.quantityKg, 0).toLocaleString()}`,
      sub: "mock data",
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    },
  ];

  const toggleFarmer = (id: string, name: string) => {
    setFarmerStatus((prev) => {
      const next = prev[id] === "Active" ? "Suspended" : "Active";
      toast.success(`${name} ${next === "Suspended" ? "suspended" : "re-activated"}`);
      return { ...prev, [id]: next };
    });
  };

  const toggleBuyer = (id: string, name: string) => {
    setBuyerStatus((prev) => {
      const next = prev[id] === "Active" ? "Suspended" : "Active";
      toast.success(`${name} ${next === "Suspended" ? "suspended" : "re-activated"}`);
      return { ...prev, [id]: next };
    });
  };

  const verifyFarmer = (name: string) => toast.success(`${name} verified as a trusted farmer`);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-1">Manage all users, listings, and platform activity</p>
        {isSupabaseConfigured() ? (
          <p className="text-xs text-primary font-medium mb-6">Connected to Supabase — showing live counts</p>
        ) : (
          <p className="text-xs text-muted-foreground mb-6">Supabase not configured — showing mock data</p>
        )}

        {/* Analytics */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8"
        >
          {analyticsCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-4 ${card.color}`}
            >
              <card.icon className="w-5 h-5 mb-2 opacity-80" />
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium mt-0.5 opacity-80">{card.label}</div>
              <div className="text-xs opacity-60 mt-0.5">{card.sub}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="farmers">
          <TabsList className="mb-4">
            <TabsTrigger value="farmers">Farmers ({mockFarmers.length})</TabsTrigger>
            <TabsTrigger value="buyers">Buyers ({mockBuyers.length})</TabsTrigger>
            <TabsTrigger value="agents">Agents ({mockAgents.length})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({mockListings.length})</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
          </TabsList>

          {/* Farmers */}
          <TabsContent value="farmers">
            <div className="space-y-3">
              {mockFarmers.map((f) => (
                <div key={f.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground">{f.name}</span>
                      <Badge className={farmerStatus[f.id] === "Active" ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                        {farmerStatus[f.id]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{f.village} · +91 {f.phone} · Rating: {f.rating}</div>
                    <div className="text-xs text-muted-foreground">Joined: {f.joinedDate}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => verifyFarmer(f.name)}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFarmer(f.id, f.name)}
                      className={farmerStatus[f.id] === "Active" ? "text-destructive hover:text-destructive" : "text-primary"}
                    >
                      {farmerStatus[f.id] === "Active" ? <><Ban className="w-3.5 h-3.5 mr-1" />Suspend</> : <><CheckCircle className="w-3.5 h-3.5 mr-1" />Activate</>}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Buyers */}
          <TabsContent value="buyers">
            <div className="space-y-3">
              {mockBuyers.map((b) => (
                <div key={b.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground">{b.name}</span>
                      <Badge className={buyerStatus[b.id] === "Active" ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}>
                        {buyerStatus[b.id]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{b.village} · +91 {b.phone}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleBuyer(b.id, b.name)}
                    className={buyerStatus[b.id] === "Active" ? "text-destructive hover:text-destructive" : "text-primary"}
                  >
                    {buyerStatus[b.id] === "Active" ? <><Ban className="w-3.5 h-3.5 mr-1" />Suspend</> : <><CheckCircle className="w-3.5 h-3.5 mr-1" />Activate</>}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Agents */}
          <TabsContent value="agents">
            <div className="space-y-3">
              {mockAgents.map((a) => (
                <div key={a.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-foreground mb-0.5">{a.name}</div>
                    <div className="text-sm text-muted-foreground">+91 {a.phone} · {a.commissionRate}% commission</div>
                    <div className="text-xs text-muted-foreground">
                      Assigned farmers: {a.assignedFarmerIds.map((id) => mockFarmers.find((f) => f.id === id)?.name).join(", ")}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toast.info("Agent management coming soon!")}>
                    Manage
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Listings */}
          <TabsContent value="listings">
            <div className="space-y-3">
              {mockListings.map((l) => {
                const farmer = mockFarmers.find((f) => f.id === l.farmerId);
                return (
                  <div key={l.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground">{l.name}</span>
                        <Badge variant={l.category === "Fruit" ? "default" : "secondary"} className="text-xs">{l.category}</Badge>
                        <Badge className={`text-xs ${l.status === "Available" ? "bg-green-100 text-green-700 border-0" : "bg-red-100 text-red-700 border-0"}`}>
                          {l.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {farmer?.name} · {farmer?.village} · Rs {l.pricePerKg}/kg · {l.quantityKg} kg
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toast.info("Listing management coming soon!")}>
                      Manage
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Disputes */}
          <TabsContent value="disputes">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-semibold text-foreground mb-1">No Active Disputes</h3>
              <p className="text-sm text-muted-foreground">
                Dispute resolution tools will be added in the next version. For now, disputes are handled by phone.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
