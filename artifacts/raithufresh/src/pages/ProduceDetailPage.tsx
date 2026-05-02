import { useState } from "react";
import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Calendar, Star, Phone, Package, FileText, Navigation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navbar from "@/components/Navbar";
import ReservationModal from "@/components/ReservationModal";
import { mockListings, mockFarmers } from "@/data/mockData";

export default function ProduceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const listing = mockListings.find((l) => l.id === id);
  const farmer = listing ? mockFarmers.find((f) => f.id === listing.farmerId) : null;
  const [reserveQty, setReserveQty] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  if (!listing || !farmer) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h2 className="text-xl font-bold text-foreground mb-2">Produce not found</h2>
          <Link href="/browse"><Button>Back to Browse</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/browse" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-5 hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Browse
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{listing.name}</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  by <span className="font-medium text-foreground">{farmer.name}</span> · {farmer.village}
                </p>
              </div>
              <Badge variant={listing.category === "Fruit" ? "default" : "secondary"}>
                {listing.category}
              </Badge>
            </div>

            {/* Farmer rating */}
            <div className="flex items-center gap-1 mb-4">
              {[1,2,3,4,5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= Math.round(farmer.rating) ? "fill-secondary text-secondary" : "text-muted-foreground"}`}
                />
              ))}
              <span className="text-sm text-muted-foreground ml-1">{farmer.rating} · Verified Farmer</span>
            </div>

            {/* Price / Quantity */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-primary/5 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-primary">Rs {listing.pricePerKg}</div>
                <div className="text-muted-foreground text-xs mt-0.5">per kg</div>
              </div>
              <div className="bg-muted rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-foreground">{listing.quantityKg}</div>
                <div className="text-muted-foreground text-xs mt-0.5">kg available</div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span>Harvest date: <span className="text-foreground font-medium">{listing.harvestDate}</span></span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                <span>Pickup: <span className="text-foreground font-medium">{listing.pickupLocation}</span> · {listing.distanceKm} km away</span>
              </div>
              {listing.qualityNotes && (
                <div className="flex items-start gap-2.5 text-muted-foreground">
                  <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>Quality notes: <span className="text-foreground">{listing.qualityNotes}</span></span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Package className="w-4 h-4 text-primary shrink-0" />
                <span>Status: <span className={`font-medium ${listing.status === "Available" ? "text-primary" : "text-destructive"}`}>{listing.status}</span></span>
              </div>
            </div>
          </div>

          {/* Pickup directions */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Navigation className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Pickup Directions</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Head to {listing.pickupLocation}. Contact the farmer for exact directions once you reserve.
              The farmer will guide you to the pickup point.
            </p>
            <p className="text-xs text-muted-foreground mt-2 bg-muted rounded-lg px-3 py-2">
              Google Maps directions will be added in the next version.
            </p>
          </div>

          {/* Reserve */}
          {listing.status === "Available" && (
            <div className="bg-card border border-border rounded-2xl p-5 mb-4 shadow-sm">
              <h3 className="font-semibold text-foreground mb-3">Reserve This Produce</h3>
              <div className="mb-4">
                <Label htmlFor="qty">How many kg do you need?</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={listing.quantityKg}
                  value={reserveQty}
                  onChange={(e) => setReserveQty(Math.min(listing.quantityKg, Math.max(1, Number(e.target.value))))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total estimate: Rs {(reserveQty * listing.pricePerKg).toLocaleString()}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mb-4">
                Payment: Cash or UPI directly to farmer at pickup
              </div>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => setModalOpen(true)}>
                  Reserve Now
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.success(`Farmer ${farmer.name}: +91 ${farmer.phone}`)}
                >
                  <Phone className="w-4 h-4 mr-1.5" />
                  Contact Farmer
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <ReservationModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        listing={listing}
      />
    </div>
  );
}
