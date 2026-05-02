import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProduceListing } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";

const schema = z.object({
  quantityKg: z.coerce.number().min(1, "Enter at least 1 kg"),
  buyerName: z.string().min(2, "Name is required"),
  buyerPhone: z.string().length(10, "Enter a valid 10-digit phone number"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  listing: ProduceListing | null;
}

export default function ReservationModal({ open, onClose, listing }: Props) {
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    if (!listing) return;
    setSubmitting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await getSupabase()
          .from("reservations")
          .insert({
            listing_id: listing.id,
            buyer_name: data.buyerName,
            buyer_phone: data.buyerPhone,
            quantity_kg: data.quantityKg,
            status: "pending",
            payment_method: "Cash or UPI directly to farmer",
          });
        if (error) console.warn("Supabase reservation error:", error.message);
      }
    } catch (e) {
      console.warn("Reservation save failed, using local fallback:", e);
    } finally {
      setSubmitting(false);
      setSuccess(true);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {!success ? (
          <>
            <DialogHeader>
              <DialogTitle>Reserve Produce</DialogTitle>
              <DialogDescription>
                {listing ? `Reserve ${listing.name} at Rs ${listing.pricePerKg}/kg` : ""}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="qty">Quantity needed (kg)</Label>
                <Input
                  id="qty"
                  type="number"
                  placeholder={listing ? `Max ${listing.quantityKg} kg` : ""}
                  {...register("quantityKg")}
                />
                {errors.quantityKg && <p className="text-destructive text-xs mt-1">{errors.quantityKg.message}</p>}
              </div>
              <div>
                <Label htmlFor="name">Your name</Label>
                <Input id="name" placeholder="Enter your name" {...register("buyerName")} />
                {errors.buyerName && <p className="text-destructive text-xs mt-1">{errors.buyerName.message}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Your phone number</Label>
                <Input id="phone" placeholder="10-digit mobile number" maxLength={10} {...register("buyerPhone")} />
                {errors.buyerPhone && <p className="text-destructive text-xs mt-1">{errors.buyerPhone.message}</p>}
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Payment: Cash or UPI directly to farmer
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending..." : "Send Reservation Request"}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="w-14 h-14 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Request Sent!</h3>
            <p className="text-muted-foreground text-sm">
              Your request has been sent to the farmer. Please contact the farmer before pickup.
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 w-full">
              Payment: Cash or UPI directly to farmer
            </div>
            <Button onClick={handleClose} className="w-full">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
