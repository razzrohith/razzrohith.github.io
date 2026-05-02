import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Users, Plus, Phone, Calendar, ClipboardList, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { mockAgents, mockFarmers, mockListings } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";

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

const demoAgent = mockAgents[0];

const sampleCallLogs = [
  { id: "c1", farmer: "Ramaiah", date: "2026-04-28", notes: "Confirmed 500kg mango stock. Will be ready in 2 days." },
  { id: "c2", farmer: "Lakshmi Devi", date: "2026-04-29", notes: "Tomato harvest done. Set price at Rs 25/kg." },
  { id: "c3", farmer: "Venkat Rao", date: "2026-04-30", notes: "Banana stock reduced to 200kg. Remaining sold to mandi." },
];

export default function AgentDashboard() {
  const [selectedFarmerId, setSelectedFarmerId] = useState("");
  const [callLogs, setCallLogs] = useState(sampleCallLogs);
  const [stockHistory, setStockHistory] = useState<{id: string; farmer: string; produce: string; qty: number; date: string}[]>([]);
  const [listings, setListings] = useState<ProduceListing[]>(mockListings);

  const assignedFarmers = mockFarmers.filter((f) => demoAgent.assignedFarmerIds.includes(f.id));
  const selectedFarmer = assignedFarmers.find((f) => f.id === selectedFarmerId);
  const farmerListings = listings.filter((l) => l.farmerId === selectedFarmerId);

  const { register: regCallback, handleSubmit: handleCallback, reset: resetCallback, formState: { errors: errCallback } } = useForm<CallbackForm>({ resolver: zodResolver(callbackSchema) });
  const { register: regStock, handleSubmit: handleStock, setValue: setStockValue, reset: resetStock, formState: { errors: errStock } } = useForm<StockForm>({ resolver: zodResolver(stockSchema) });

  const onSubmitCallback = (data: CallbackForm) => {
    setCallLogs((prev) => [{ id: `c${Date.now()}`, farmer: data.farmerName, date: data.dateTime.split("T")[0], notes: data.notes }, ...prev]);
    resetCallback();
    toast.success("Callback scheduled!");
  };

  const onSubmitStock = (data: StockForm) => {
    const farmer = mockFarmers.find((f) => f.id === data.farmerId);
    const produce = listings.find((l) => l.id === data.produceId);
    setListings((prev) => prev.map((l) => l.id === data.produceId ? { ...l, quantityKg: data.newQuantity } : l));
    setStockHistory((prev) => [{
      id: `s${Date.now()}`,
      farmer: farmer?.name || "",
      produce: produce?.name || "",
      qty: data.newQuantity,
      date: new Date().toISOString().split("T")[0],
    }, ...prev]);
    resetStock();
    toast.success("Stock updated!");
  };

  const estimatedCommission = listings
    .filter((l) => demoAgent.assignedFarmerIds.includes(l.farmerId))
    .reduce((acc, l) => acc + (l.pricePerKg * l.quantityKg * demoAgent.commissionRate / 100), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Agent Dashboard</h1>
            <p className="text-muted-foreground text-sm">Managing on behalf of farmers — {demoAgent.name}</p>
          </div>
          <Badge className="bg-primary/10 text-primary border-primary/20">{demoAgent.commissionRate}% Commission</Badge>
        </div>

        {/* Commission summary */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
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
              <div className="text-2xl font-bold text-foreground">{listings.filter((l) => demoAgent.assignedFarmerIds.includes(l.farmerId) && l.status === "Available").length}</div>
              <div className="text-xs text-muted-foreground">Active Listings</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">Rs {Math.round(estimatedCommission).toLocaleString()}</div>
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
                <div className="text-sm text-muted-foreground">{f.village} · +91 {f.phone}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {listings.filter((l) => l.farmerId === f.id && l.status === "Available").length} active listings
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Farmer actions */}
        {selectedFarmer && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 space-y-4">
            <h3 className="font-semibold text-foreground">
              Managing: <span className="text-primary">{selectedFarmer.name}</span>
            </h3>

            {/* Update Stock */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
              <h4 className="font-semibold text-foreground mb-3">Update Stock</h4>
              <form onSubmit={handleStock(onSubmitStock)} className="space-y-3">
                <input type="hidden" value={selectedFarmerId} {...regStock("farmerId")} />
                <div>
                  <Label>Select Produce</Label>
                  <Select onValueChange={(v) => setStockValue("produceId", v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Choose listing..." /></SelectTrigger>
                    <SelectContent>
                      {farmerListings.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.name} (current: {l.quantityKg} kg)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errStock.produceId && <p className="text-destructive text-xs mt-1">{errStock.produceId.message}</p>}
                </div>
                <div>
                  <Label>New Quantity (kg)</Label>
                  <Input type="number" placeholder="Enter updated quantity" {...regStock("newQuantity")} />
                  {errStock.newQuantity && <p className="text-destructive text-xs mt-1">{errStock.newQuantity.message}</p>}
                </div>
                <Button type="submit" size="sm">Update Stock</Button>
              </form>
            </div>

            {/* Stock History */}
            {stockHistory.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h4 className="font-semibold text-foreground mb-3">Stock Update History</h4>
                <div className="space-y-2">
                  {stockHistory.map((h) => (
                    <div key={h.id} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <span className="text-muted-foreground">{h.farmer} · {h.produce}</span>
                      <span className="font-medium text-foreground">{h.qty} kg on {h.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Schedule Callback */}
        <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Schedule Callback
          </h2>
          <form onSubmit={handleCallback(onSubmitCallback)} className="space-y-3">
            <div>
              <Label>Farmer Name</Label>
              <Input placeholder="e.g. Ramaiah" {...regCallback("farmerName")} />
              {errCallback.farmerName && <p className="text-destructive text-xs mt-1">{errCallback.farmerName.message}</p>}
            </div>
            <div>
              <Label>Date and Time</Label>
              <Input type="datetime-local" {...regCallback("dateTime")} />
              {errCallback.dateTime && <p className="text-destructive text-xs mt-1">{errCallback.dateTime.message}</p>}
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea placeholder="What to discuss..." {...regCallback("notes")} rows={2} />
              {errCallback.notes && <p className="text-destructive text-xs mt-1">{errCallback.notes.message}</p>}
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
              <div key={log.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
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
