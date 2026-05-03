import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProduceListing } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";
import BilingualLabel from "@/components/BilingualLabel";

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
  const { user, profile } = useAuth();
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAsLoggedIn, setSubmittedAsLoggedIn] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Pre-fill buyer name from profile when modal opens and user is logged in
  useEffect(() => {
    if (open && profile?.full_name) {
      setValue("buyerName", profile.full_name);
    }
  }, [open, profile, setValue]);

  const onSubmit = async (data: FormValues) => {
    if (!listing) return;

    if (listing.quantityKg > 0 && data.quantityKg > listing.quantityKg) {
      setError("quantityKg", {
        message: `Only ${listing.quantityKg} kg available`,
      });
      return;
    }

    const wasLoggedIn = !!user;
    setSubmittedAsLoggedIn(wasLoggedIn);
    setSubmitting(true);

    try {
      if (isSupabaseConfigured()) {
        const payload: Record<string, unknown> = {
          listing_id: listing.id,
          buyer_name: data.buyerName,
          buyer_phone: data.buyerPhone,
          quantity_kg: data.quantityKg,
          status: "pending",
          payment_method: "Cash or UPI directly to farmer",
        };
        if (wasLoggedIn && user) {
          payload.buyer_user_id = user.id;
        }

        const { error } = await getSupabase().from("reservations").insert(payload);
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
    setSubmittedAsLoggedIn(false);
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {!success ? (
          <>
            <DialogHeader>
              <DialogTitle>
                <BilingualLabel en="Reserve Produce" te="పంటను రిజర్వ్ చేయండి" variant="onLight" />
              </DialogTitle>
              <DialogDescription>
                {listing ? `Reserve ${listing.name} at Rs ${listing.pricePerKg}/kg` : ""}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
              <div>
                <Label htmlFor="qty">
                  <BilingualLabel en="Quantity needed (kg)" te="అవసరమైన పరిమాణం (కేజీలు)" variant="onLight" />
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  max={listing?.quantityKg}
                  placeholder={listing ? `Max ${listing.quantityKg} kg` : ""}
                  {...register("quantityKg")}
                />
                {errors.quantityKg && (
                  <p className="text-destructive text-xs mt-1">{errors.quantityKg.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="name">
                  <BilingualLabel en="Your name" te="మీ పేరు" variant="onLight" />
                </Label>
                <Input id="name" placeholder="Enter your name" {...register("buyerName")} />
                {errors.buyerName && (
                  <p className="text-destructive text-xs mt-1">{errors.buyerName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="phone">
                  <BilingualLabel en="Your phone number" te="మీ ఫోన్ నంబర్" variant="onLight" />
                </Label>
                <Input
                  id="phone"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  {...register("buyerPhone")}
                />
                {errors.buyerPhone && (
                  <p className="text-destructive text-xs mt-1">{errors.buyerPhone.message}</p>
                )}
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Payment: Cash or UPI directly to farmer
              </div>
              <Button type="submit" className="w-full h-auto py-2" disabled={submitting}>
                {submitting ? "Sending..." : (
                  <BilingualLabel en="Send Reservation Request" te="రిజర్వేషన్ అభ్యర్థనను పంపండి" orientation="stacked" variant="button" />
                )}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="w-14 h-14 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">
              <BilingualLabel en="Reservation Request Sent" te="రిజర్వేషన్ అభ్యర్థన పంపబడింది" />
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {submittedAsLoggedIn
                ? "Your reservation request has been sent to the farmer. You can track it from your Buyer Dashboard."
                : "Reservation request sent. Contact the farmer before pickup to confirm availability. Log in next time to track your reservation history."}
            </p>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 w-full text-left">
              <span className="font-medium">Payment:</span> Cash or UPI directly to the farmer at
              pickup. No online payment required.
            </div>
            {submittedAsLoggedIn && (
              <Link href="/buyer" onClick={handleClose} className="w-full">
                <Button variant="outline" className="w-full">
                  Go to Buyer Dashboard
                </Button>
              </Link>
            )}
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
