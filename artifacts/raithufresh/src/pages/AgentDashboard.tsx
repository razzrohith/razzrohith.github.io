import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Users, Plus, Phone, Calendar, ClipboardList, TrendingUp,
  CheckCircle2, PhoneCall, Clock, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { mockAgents, mockFarmers, mockListings } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";
import {
  getSupabase, isSupabaseConfigured,
  AgentCallRequest, AgentCallRequestInsert, AgentCallRequestStatus,
} from "@/lib/supabase";

// ── Schemas ────────────────────────────────────────────────────────────────

const callbackSchema = z.object({
  farmerName: z.string().min(2, "Farmer name required"),
  dateTime: z.string().min(1, "Select date and time"),
  notes: z.string().min(2, "Add notes"),
});
type CallbackForm = z.infer<typeof callbackSchema>;

const stockSchema = z.object({
  farmerId: z.string().min(1, "Select a farmer"),
  produceId: z.string().min(1, "Select produce"),
  newQuantity: z.coerce.number().min(0, "Enter quantity"),
});
type StockForm = z.infer<typeof stockSchema>;

const assistanceSchema = z.object({
  farmerName: z.string().min(2, "Farmer name is required"),
  farmerPhone: z.string().min(1, "Farmer phone is required").regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
  village: z.string().optional(),
  requestNote: z.string().optional(),
});
type AssistanceForm = z.infer<typeof assistanceSchema>;

// ── Helpers ────────────────────────────────────────────────────────────────

const demoAgent = mockAgents[0];

const sampleCallLogs = [
  { id: "c1", farmer: "Ramaiah", date: "2026-04-28", notes: "Confirmed 500kg mango stock. Will be ready in 2 days." },
  { id: "c2", farmer: "Lakshmi Devi", date: "2026-04-29", notes: "Tomato harvest done. Set price at Rs 25/kg." },
  { id: "c3", farmer: "Venkat Rao", date: "2026-04-30", notes: "Banana stock reduced to 200kg. Remaining sold to mandi." },
];

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

export default function AgentDashboard() {
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [callLogs, setCallLogs] = useState(sampleCallLogs);
  const [stockHistory, setStockHistory] = useState<
    { id: string; farmer: string; produce: string; qty: number; date: string }[]
  >([]);
  const [listings, setListings] = useState<ProduceListing[]>(mockListings);

  // Assistance request state
  const [requests, setRequests] = useState<AgentCallRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [assistanceSubmitting, setAssistanceSubmitting] = useState(false);

  const assignedFarmers = mockFarmers.filter((f) =>
    demoAgent.assignedFarmerIds.includes(f.id)
  );
  const selectedFarmer = assignedFarmers.find((f) => f.id === selectedFarmerId);
  const farmerListings = listings.filter((l) => l.farmerId === selectedFarmerId);

  const {
    register: regCallback, handleSubmit: handleCallback, reset: resetCallback,
    formState: { errors: errCallback },
  } = useForm<CallbackForm>({ resolver: zodResolver(callbackSchema) });

  const {
    register: regStock, handleSubmit: handleStock, setValue: setStockValue,
    reset: resetStock, formState: { errors: errStock },
  } = useForm<StockForm>({ resolver: zodResolver(stockSchema) });

  const {
    register: regAssist, handleSubmit: handleAssist, reset: resetAssist,
    formState: { errors: errAssist },
  } = useForm<AssistanceForm>({ resolver: zodResolver(assistanceSchema) });

  // ── Load requests from Supabase ──────────────────────────────────────────

  const loadRequests = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setRequestsLoading(true);
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from("agent_call_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setRequests((data as AgentCallRequest[]) ?? []);
    } catch (err) {
      console.error("Failed to load agent call requests:", err);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── Submit assistance request ────────────────────────────────────────────

  const onSubmitAssistance = async (data: AssistanceForm) => {
    setAssistanceSubmitting(true);
    const payload: AgentCallRequestInsert = {
      farmer_name: data.farmerName.trim(),
      farmer_phone: data.farmerPhone.trim(),
      village: data.village?.trim() || undefined,
      request_note: data.requestNote?.trim() || undefined,
      status: "pending",
    };

    if (!isSupabaseConfigured()) {
      // Mock fallback
      const mockRow: AgentCallRequest = {
        id: `mock-${Date.now()}`,
        farmer_name: payload.farmer_name,
        farmer_phone: payload.farmer_phone,
        village: payload.village ?? null,
        request_note: payload.request_note ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
      };
      setRequests((prev) => [mockRow, ...prev]);
      resetAssist();
      setAssistanceSubmitting(false);
      toast.success("Agent callback request saved (demo mode).");
      return;
    }

    try {
      const sb = getSupabase();
      const { data: inserted, error } = await sb
        .from("agent_call_requests")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setRequests((prev) => [inserted as AgentCallRequest, ...prev]);
      resetAssist();
      toast.success("Agent callback request saved successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Could not save request: ${msg}`);
    } finally {
      setAssistanceSubmitting(false);
    }
  };

  // ── Update request status ────────────────────────────────────────────────

  const updateStatus = async (id: string, newStatus: AgentCallRequestStatus) => {
    setUpdatingId(id);

    if (!isSupabaseConfigured()) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
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
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
      toast.success("Status updated.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Status update failed: ${msg}`);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Existing handlers ────────────────────────────────────────────────────

  const onSubmitCallback = (data: CallbackForm) => {
    setCallLogs((prev) => [
      { id: `c${Date.now()}`, farmer: data.farmerName, date: data.dateTime.split("T")[0], notes: data.notes },
      ...prev,
    ]);
    resetCallback();
    toast.success("Callback scheduled!");
  };

  const onSubmitStock = (data: StockForm) => {
    const farmer = mockFarmers.find((f) => f.id === data.farmerId);
    const produce = listings.find((l) => l.id === data.produceId);
    setListings((prev) =>
      prev.map((l) => (l.id === data.produceId ? { ...l, quantityKg: data.newQuantity } : l))
    );
    setStockHistory((prev) => [
      {
        id: `s${Date.now()}`,
        farmer: farmer?.name || "",
        produce: produce?.name || "",
        qty: data.newQuantity,
        date: new Date().toISOString().split("T")[0],
      },
      ...prev,
    ]);
    resetStock();
    toast.success("Stock updated!");
  };

  const estimatedCommission = listings
    .filter((l) => demoAgent.assignedFarmerIds.includes(l.farmerId))
    .reduce(
      (acc, l) => acc + (l.pricePerKg * l.quantityKg * demoAgent.commissionRate) / 100,
      0
    );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agent Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              Managing on behalf of farmers — {demoAgent.name}
            </p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">
            {demoAgent.commissionRate}% Commission
          </Badge>
        </div>

        {/* Commission summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Commission Tracking</h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-primary/5 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-primary">{assignedFarmers.length}</div>
              <div className="text-xs text-muted-foreground">Farmers</div>
            </div>
            <div className="bg-secondary/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-foreground">
                {listings.filter(
                  (l) =>
                    demoAgent.assignedFarmerIds.includes(l.farmerId) &&
                    l.status === "Available"
                ).length}
              </div>
              <div className="text-xs text-muted-foreground">Active Listings</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                Rs {Math.round(estimatedCommission).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">Est. Commission</div>
            </div>
          </div>
        </motion.div>

        {/* Assigned Farmers */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Assigned Farmers
          </h2>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {assignedFarmers.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFarmerId(f.id)}
                className={`text-left rounded-2xl p-4 border transition-all ${
                  selectedFarmerId === f.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="font-semibold text-foreground">{f.name}</div>
                <div className="text-sm text-muted-foreground">
                  {f.village} · +91 {f.phone}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {listings.filter((l) => l.farmerId === f.id && l.status === "Available").length} active listings
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Farmer actions */}
        {selectedFarmer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 space-y-4"
          >
            <h3 className="font-semibold text-foreground">
              Managing: <span className="text-primary">{selectedFarmer.name}</span>
            </h3>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h4 className="font-semibold text-foreground mb-3">Update Stock</h4>
              <form onSubmit={handleStock(onSubmitStock)} className="space-y-3">
                <input type="hidden" value={selectedFarmerId} {...regStock("farmerId")} />
                <div>
                  <Label>Select Produce</Label>
                  <Select onValueChange={(v) => setStockValue("produceId", v, { shouldValidate: true })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose listing..." />
                    </SelectTrigger>
                    <SelectContent>
                      {farmerListings.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name} (current: {l.quantityKg} kg)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errStock.produceId && (
                    <p className="text-destructive text-xs mt-1">{errStock.produceId.message}</p>
                  )}
                </div>
                <div>
                  <Label>New Quantity (kg)</Label>
                  <Input
                    type="number"
                    placeholder="Enter updated quantity"
                    {...regStock("newQuantity")}
                  />
                  {errStock.newQuantity && (
                    <p className="text-destructive text-xs mt-1">{errStock.newQuantity.message}</p>
                  )}
                </div>
                <Button type="submit" size="sm">
                  Update Stock
                </Button>
              </form>
            </div>

            {stockHistory.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h4 className="font-semibold text-foreground mb-3">Stock Update History</h4>
                <div className="space-y-2">
                  {stockHistory.map((h) => (
                    <div
                      key={h.id}
                      className="flex justify-between text-sm py-1.5 border-b border-border last:border-0"
                    >
                      <span className="text-muted-foreground">
                        {h.farmer} · {h.produce}
                      </span>
                      <span className="font-medium text-foreground">
                        {h.qty} kg on {h.date}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Farmer Callback / Assistance Request Form */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Log Farmer Assistance Request
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Record a callback or assistance request. Saved to Supabase when configured.
          </p>
          <form onSubmit={handleAssist(onSubmitAssistance)} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>
                  Farmer Name <span className="text-destructive">*</span>
                </Label>
                <Input placeholder="e.g. Ramaiah" {...regAssist("farmerName")} />
                {errAssist.farmerName && (
                  <p className="text-destructive text-xs mt-1">{errAssist.farmerName.message}</p>
                )}
              </div>
              <div>
                <Label>
                  Farmer Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  {...regAssist("farmerPhone")}
                />
                {errAssist.farmerPhone && (
                  <p className="text-destructive text-xs mt-1">{errAssist.farmerPhone.message}</p>
                )}
              </div>
            </div>
            <div>
              <Label>Village / Town</Label>
              <Input placeholder="e.g. Shadnagar" {...regAssist("village")} />
            </div>
            <div>
              <Label>Request Note</Label>
              <Textarea
                placeholder="What help does this farmer need?"
                {...regAssist("requestNote")}
                rows={2}
              />
            </div>
            <Button type="submit" size="sm" disabled={assistanceSubmitting}>
              {assistanceSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-1.5" />
                  Save Callback Request
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Assistance Request List */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Callback Requests
              {requests.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({requests.length})
                </span>
              )}
            </h2>
            {isSupabaseConfigured() && (
              <button
                onClick={loadRequests}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                disabled={requestsLoading}
              >
                <RefreshCw className={`w-3 h-3 ${requestsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
          </div>

          {requestsLoading ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No callback requests yet.
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="border border-border rounded-xl p-4 hover:border-primary/30 transition-colors"
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
                          <span className="text-xs text-muted-foreground">· {req.village}</span>
                        )}
                      </div>
                      {req.request_note && (
                        <p className="text-sm text-muted-foreground mb-2">{req.request_note}</p>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(req.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${STATUS_COLORS[req.status]}`}
                      >
                        {STATUS_ICONS[req.status]}
                        {STATUS_LABELS[req.status]}
                      </span>
                    </div>
                  </div>

                  {/* Status update buttons */}
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
        </div>

        {/* Schedule Callback (existing — local call log) */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Schedule Callback
          </h2>
          <form onSubmit={handleCallback(onSubmitCallback)} className="space-y-3">
            <div>
              <Label>Farmer Name</Label>
              <Input placeholder="e.g. Ramaiah" {...regCallback("farmerName")} />
              {errCallback.farmerName && (
                <p className="text-destructive text-xs mt-1">{errCallback.farmerName.message}</p>
              )}
            </div>
            <div>
              <Label>Date and Time</Label>
              <Input type="datetime-local" {...regCallback("dateTime")} />
              {errCallback.dateTime && (
                <p className="text-destructive text-xs mt-1">{errCallback.dateTime.message}</p>
              )}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="What to discuss..." {...regCallback("notes")} rows={2} />
              {errCallback.notes && (
                <p className="text-destructive text-xs mt-1">{errCallback.notes.message}</p>
              )}
            </div>
            <Button type="submit" size="sm">
              <Phone className="w-4 h-4 mr-1.5" />
              Schedule Callback
            </Button>
          </form>
        </div>

        {/* Call Logs */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Call Logs
          </h2>
          <div className="space-y-3">
            {callLogs.map((log) => (
              <div
                key={log.id}
                className="border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-foreground text-sm">{log.farmer}</span>
                  <span className="text-xs text-muted-foreground">{log.date}</span>
                </div>
                <p className="text-sm text-muted-foreground">{log.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
