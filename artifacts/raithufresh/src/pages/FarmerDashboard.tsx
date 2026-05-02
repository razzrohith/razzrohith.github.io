import { useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Star, Edit, Package, CheckCircle, User, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Navbar from "@/components/Navbar";
import { mockFarmers, mockListings, mockReservations } from "@/data/mockData";
import { ProduceListing } from "@/lib/types";

const listingSchema = z.object({
  name: z.string().min(2, "Produce name is required"),
  category: z.enum(["Fruit", "Vegetable"], { required_error: "Select a category" }),
  quantityKg: z.coerce.number().min(1, "Enter quantity"),
  pricePerKg: z.coerce.number().min(1, "Enter price"),
  harvestDate: z.string().min(1, "Select harvest date"),
  pickupLocation: z.string().min(2, "Enter pickup location"),
  phone: z.string().length(10, "Enter 10-digit phone number"),
  qualityNotes: z.string().optional(),
});
type ListingForm = z.infer<typeof listingSchema>;

const demoFarmer = mockFarmers[0];

export default function FarmerDashboard() {
  const [listings, setListings] = useState<ProduceListing[]>(
    mockListings.filter((l) => l.farmerId === demoFarmer.id)
  );
  const [showForm, setShowForm] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");
  const [editListing, setEditListing] = useState<ProduceListing | null>(null);

  const reservations = mockReservations.filter((r) => r.farmerId === demoFarmer.id);

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
  });

  const onSubmit = (data: ListingForm) => {
    const newListing: ProduceListing = {
      id: `p${Date.now()}`,
      farmerId: demoFarmer.id,
      name: data.name,
      category: data.category,
      pricePerKg: data.pricePerKg,
      quantityKg: data.quantityKg,
      harvestDate: data.harvestDate,
      pickupLocation: data.pickupLocation,
      distanceKm: 10,
      qualityNotes: data.qualityNotes,
      status: "Available",
    };
    setListings((prev) => [newListing, ...prev]);
    reset();
    setCategoryValue("");
    setShowForm(false);
    toast.success("Listing added successfully!");
  };

  const updateStatus = (id: string, status: ProduceListing["status"]) => {
    setListings((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
    toast.success(`Listing marked as ${status}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Farmer Dashboard</h1>

        {/* Profile */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4"
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground">{demoFarmer.name}</h2>
            <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{demoFarmer.village}</span>
              <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />+91 {demoFarmer.phone}</span>
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-secondary text-secondary" />{demoFarmer.rating} rating
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Member since {demoFarmer.joinedDate}</p>
          </div>
          <Badge variant="default">Verified Farmer</Badge>
        </motion.div>

        {/* Add Listing */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">My Listings</h2>
            <Button onClick={() => setShowForm(!showForm)} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add New Listing
            </Button>
          </div>

          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm"
            >
              <h3 className="font-semibold text-foreground mb-4">Add New Produce Listing</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Produce Name</Label>
                  <Input placeholder="e.g. Tomato, Mango..." {...register("name")} />
                  {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={categoryValue} onValueChange={(v) => { setCategoryValue(v); setValue("category", v as "Fruit"|"Vegetable", { shouldValidate: true }); }}>
                    <SelectTrigger><SelectValue placeholder="Fruit or Vegetable" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fruit">Fruit</SelectItem>
                      <SelectItem value="Vegetable">Vegetable</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-destructive text-xs mt-1">{errors.category.message}</p>}
                </div>
                <div>
                  <Label>Quantity (kg)</Label>
                  <Input type="number" placeholder="e.g. 100" {...register("quantityKg")} />
                  {errors.quantityKg && <p className="text-destructive text-xs mt-1">{errors.quantityKg.message}</p>}
                </div>
                <div>
                  <Label>Price per kg (Rs)</Label>
                  <Input type="number" placeholder="e.g. 25" {...register("pricePerKg")} />
                  {errors.pricePerKg && <p className="text-destructive text-xs mt-1">{errors.pricePerKg.message}</p>}
                </div>
                <div>
                  <Label>Harvest Date</Label>
                  <Input type="date" {...register("harvestDate")} />
                  {errors.harvestDate && <p className="text-destructive text-xs mt-1">{errors.harvestDate.message}</p>}
                </div>
                <div>
                  <Label>Pickup Village / Location</Label>
                  <Input placeholder="e.g. Shadnagar Main Market" {...register("pickupLocation")} />
                  {errors.pickupLocation && <p className="text-destructive text-xs mt-1">{errors.pickupLocation.message}</p>}
                </div>
                <div>
                  <Label>Contact Phone</Label>
                  <Input placeholder="10-digit mobile" maxLength={10} {...register("phone")} />
                  {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <Label>Quality Notes (optional)</Label>
                  <Input placeholder="e.g. Organic, freshly picked..." {...register("qualityNotes")} />
                </div>
                <div className="sm:col-span-2 flex gap-3">
                  <Button type="submit" className="flex-1">Add Listing</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Listings */}
          {listings.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground bg-card border border-border rounded-2xl">
              No listings yet. Add your first produce listing.
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((listing) => (
                <motion.div
                  key={listing.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">{listing.name}</h3>
                      <Badge variant={listing.category === "Fruit" ? "default" : "secondary"} className="text-xs">
                        {listing.category}
                      </Badge>
                      <Badge
                        variant={listing.status === "Available" ? "default" : "secondary"}
                        className={`text-xs ${listing.status === "Sold" ? "bg-red-100 text-red-700" : listing.status === "Out of Stock" ? "bg-orange-100 text-orange-700" : ""}`}
                      >
                        {listing.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Rs {listing.pricePerKg}/kg · {listing.quantityKg} kg · Harvest: {listing.harvestDate}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { setEditListing(listing); toast.info("Edit feature coming soon!"); }}>
                      <Edit className="w-3.5 h-3.5 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(listing.id, "Sold")} disabled={listing.status === "Sold"}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />Sold
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(listing.id, "Out of Stock")} disabled={listing.status === "Out of Stock"}>
                      <Package className="w-3.5 h-3.5 mr-1" />Out of Stock
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Buyer Interest */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Buyer Reservations</h2>
          {reservations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-card border border-border rounded-2xl">
              No reservations yet.
            </div>
          ) : (
            <div className="space-y-3">
              {reservations.map((r) => {
                const produce = mockListings.find((l) => l.id === r.produceId);
                return (
                  <div key={r.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{r.buyerName}</div>
                      <div className="text-sm text-muted-foreground">
                        Wants {r.quantityKg} kg of {produce?.name} · Phone: +91 {r.buyerPhone}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Date: {r.date}</div>
                    </div>
                    <Badge className={`${r.status === "Completed" ? "bg-green-100 text-green-700" : r.status === "Cancelled" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {r.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
