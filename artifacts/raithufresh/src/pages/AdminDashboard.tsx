import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Users, Tractor, ShoppingBag, Package, TrendingUp,
  CheckCircle, Ban, AlertCircle, Phone, PhoneCall,
  Clock, CheckCircle2, RefreshCw, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import { mockFarmers, mockBuyers, mockAgents, mockListings, mockReservations } from "@/data/mockData";
import {
  isSupabaseConfigured, getSupabase,
  AgentCallRequest, AgentCallRequestStatus,
} from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────

type DbCounts = {
  waitlist: number;
  farmers: number;
  listings: number;
  reservations: number;
};

type CallRequestCounts = {
  total: number;
  pending: number;
  called: number;
  resolved: number;
};

type UserStatus = { [id: string]: "Active" | "Suspended" };

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AgentCallRequestStatus, string> = {
  pending: "Pending",
  called: "Called",
  resolved: "Resolved",
};

const STATUS_COLORS: Record<AgentCallRequestStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  called: "bg-blue-100 text-blue-800 border-blue-200",
  resolved: "bg-green-100 text-green-800 border-green-200",
};

const STATUS_ICONS: Record<AgentCallRequestStatus, React.ReactNode> = {
  pending: <Clock className="w-3 h-3" />,
  called: <PhoneCall className="w-3 h-3" />,
  resolved: <CheckCircle2 className="w-3 h-3" />,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [dbCounts, setDbCounts] = useState<DbCounts | null>(null);
  const [callRequests, setCallRequests] = useState<AgentCallRequest[]>([]);
  const [callCounts, setCallCounts] = useState<CallRequestCounts | null>(null);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [farmerStatus, setFarmerStatus] = useState<UserStatus>(
    Object.fromEntries(mockFarmers.map((f) => [f.id, "Active" as const]))
  );
  const [buyerStatus, setBuyerStatus] = useState<UserStatus>(
    Object.fromEntries(mockBuyers.map((b) => [b.id, "Active" as const]))
  );

  // ── Load DB counts ───────────────────────────────────────────────────────

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

  // ── Load agent call requests ─────────────────────────────────────────────

  const loadCallRequests = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setRequestsLoading(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("agent_call_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data as AgentCallRequest[]) ?? [];
      setCallRequests(rows);
      setCallCounts({
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        called: rows.filter((r) => r.status === "called").length,
        resolved: rows.filter((r) => r.status === "resolved").length,
      });
    } catch (e) {
      console.warn("Agent request fetch failed:", e);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCallRequests();
  }, [loadCallRequests]);

  // ── Update request status ────────────────────────────────────────────────

  const updateStatus = async (id: string, newStatus: AgentCallRequestStatus) => {
    setUpdatingId(id);

    if (!isSupabaseConfigured()) {
      setCallRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      setCallCounts((prev) => {
        if (!prev) return prev;
        const old = callRequests.find((r) => r.id === id)?.status;
        if (!old) return prev;
        return {
          ...prev,
          [old]: prev[old] - 1,
          [newStatus]: prev[newStatus] + 1,
        };
      });
      setUpdatingId(null);
      toast.success("Status updated (demo mode).");
      return;
    }

    try {
      const sb = getSupabase();
      const { error } = await sb
        .from("agent_call_requests")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;

      setCallRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      setCallCounts((prev) => {
        if (!prev) return prev;
        const old = callRequests.find((r) => r.id === id)?.status;
        if (!old) return prev;
        return {
          ...prev,
          [old]: prev[old] - 1,
          [newStatus]: prev[newStatus] + 1,
        };
      });
      toast.success("Status updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Status update failed: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Existing handlers ────────────────────────────────────────────────────

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

  const verifyFarmer = (name: string) =>
    toast.success(`${name} verified as a trusted farmer`);

  // ── Analytics cards ──────────────────────────────────────────────────────

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

  const callRequestCards = [
    {
      label: "Total Requests",
      value: callCounts ? callCounts.total : callRequests.length,
      sub: callCounts ? "from database" : isSupabaseConfigured() ? "loading…" : "mock data",
      icon: Phone,
      color: "bg-slate-50 text-slate-700 border-slate-100",
    },
    {
      label: "Pending",
      value: callCounts ? callCounts.pending : callRequests.filter((r) => r.status === "pending").length,
      sub: callCounts ? "awaiting call" : "mock data",
      icon: Clock,
      color: "bg-amber-50 text-amber-700 border-amber-100",
    },
    {
      label: "Called",
      value: callCounts ? callCounts.called : callRequests.filter((r) => r.status === "called").length,
      sub: callCounts ? "agent contacted" : "mock data",
      icon: PhoneCall,
      color: "bg-blue-50 text-blue-700 border-blue-100",
    },
    {
      label: "Resolved",
      value: callCounts ? callCounts.resolved : callRequests.filter((r) => r.status === "resolved").length,
      sub: callCounts ? "fully resolved" : "mock data",
      icon: CheckCircle2,
      color: "bg-green-50 text-green-700 border-green-100",
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-1">
          Manage all users, listings, and platform activity
        </p>
        {isSupabaseConfigured() ? (
          <p className="text-xs text-primary font-medium mb-6">
            Connected to Supabase — showing live counts
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mb-6">
            Supabase not configured — showing mock data
          </p>
        )}

        {/* Platform analytics */}
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Platform Overview
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6"
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

        {/* Agent callback request analytics */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Agent Callback Requests
          </h2>
          {isSupabaseConfigured() && (
            <button
              onClick={loadCallRequests}
              disabled={requestsLoading}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${requestsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8"
        >
          {callRequestCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
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
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="farmers">Farmers ({mockFarmers.length})</TabsTrigger>
            <TabsTrigger value="buyers">Buyers ({mockBuyers.length})</TabsTrigger>
            <TabsTrigger value="agents">Agents ({mockAgents.length})</TabsTrigger>
            <TabsTrigger value="listings">Listings ({mockListings.length})</TabsTrigger>
            <TabsTrigger value="agent-requests">
              Agent Requests
              {callCounts && callCounts.pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                  {callCounts.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
          </TabsList>

          {/* Farmers */}
          <TabsContent value="farmers">
            <div className="space-y-3">
              {mockFarmers.map((f) => (
                <div
                  key={f.id}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground">{f.name}</span>
                      <Badge
                        className={
                          farmerStatus[f.id] === "Active"
                            ? "bg-green-100 text-green-700 border-0"
                            : "bg-red-100 text-red-700 border-0"
                        }
                      >
                        {farmerStatus[f.id]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {f.village} · +91 {f.phone} · Rating: {f.rating}
                    </div>
                    <div className="text-xs text-muted-foreground">Joined: {f.joinedDate}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => verifyFarmer(f.name)}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleFarmer(f.id, f.name)}
                      className={
                        farmerStatus[f.id] === "Active"
                          ? "text-destructive hover:text-destructive"
                          : "text-primary"
                      }
                    >
                      {farmerStatus[f.id] === "Active" ? (
                        <>
                          <Ban className="w-3.5 h-3.5 mr-1" />
                          Suspend
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Activate
                        </>
                      )}
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
                <div
                  key={b.id}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-foreground">{b.name}</span>
                      <Badge
                        className={
                          buyerStatus[b.id] === "Active"
                            ? "bg-green-100 text-green-700 border-0"
                            : "bg-red-100 text-red-700 border-0"
                        }
                      >
                        {buyerStatus[b.id]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.village} · +91 {b.phone}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleBuyer(b.id, b.name)}
                    className={
                      buyerStatus[b.id] === "Active"
                        ? "text-destructive hover:text-destructive"
                        : "text-primary"
                    }
                  >
                    {buyerStatus[b.id] === "Active" ? (
                      <>
                        <Ban className="w-3.5 h-3.5 mr-1" />
                        Suspend
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Activate
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Agents */}
          <TabsContent value="agents">
            <div className="space-y-3">
              {mockAgents.map((a) => (
                <div
                  key={a.id}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-foreground mb-0.5">{a.name}</div>
                    <div className="text-sm text-muted-foreground">
                      +91 {a.phone} · {a.commissionRate}% commission
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assigned farmers:{" "}
                      {a.assignedFarmerIds
                        .map((id) => mockFarmers.find((f) => f.id === id)?.name)
                        .join(", ")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info("Agent management coming soon!")}
                  >
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
                  <div
                    key={l.id}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-foreground">{l.name}</span>
                        <Badge
                          variant={l.category === "Fruit" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {l.category}
                        </Badge>
                        <Badge
                          className={`text-xs ${
                            l.status === "Available"
                              ? "bg-green-100 text-green-700 border-0"
                              : "bg-red-100 text-red-700 border-0"
                          }`}
                        >
                          {l.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {farmer?.name} · {farmer?.village} · Rs {l.pricePerKg}/kg · {l.quantityKg} kg
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info("Listing management coming soon!")}
                    >
                      Manage
                    </Button>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Agent Requests */}
          <TabsContent value="agent-requests">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isSupabaseConfigured()
                  ? "Farmer assistance and callback requests logged by agents."
                  : "Supabase not configured — no live data available."}
              </p>
            </div>

            {requestsLoading ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <RefreshCw className="w-6 h-6 text-muted-foreground mx-auto mb-2 animate-spin opacity-40" />
                <p className="text-sm text-muted-foreground">Loading requests...</p>
              </div>
            ) : callRequests.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center">
                <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <h3 className="font-semibold text-foreground mb-1">No Callback Requests</h3>
                <p className="text-sm text-muted-foreground">
                  Requests logged from the Agent Dashboard will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {callRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-card border border-border rounded-2xl p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-foreground text-sm">
                            {req.farmer_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            +91 {req.farmer_phone}
                          </span>
                          {req.village && (
                            <span className="text-xs text-muted-foreground">
                              · {req.village}
                            </span>
                          )}
                        </div>
                        {req.request_note && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {req.request_note}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDate(req.created_at)}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${STATUS_COLORS[req.status]}`}
                      >
                        {STATUS_ICONS[req.status]}
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>

                    {/* Status action buttons */}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {(["pending", "called", "resolved"] as AgentCallRequestStatus[])
                        .filter((s) => s !== req.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => updateStatus(req.id, s)}
                            disabled={updatingId === req.id}
                            className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                          >
                            {updatingId === req.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin inline" />
                            ) : (
                              `Mark ${STATUS_LABELS[s]}`
                            )}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Disputes */}
          <TabsContent value="disputes">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <h3 className="font-semibold text-foreground mb-1">No Active Disputes</h3>
              <p className="text-sm text-muted-foreground">
                Dispute resolution tools will be added in the next version. For now, disputes are
                handled by phone.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
