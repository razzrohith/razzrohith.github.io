import { Phone, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  farmerName: string;
  phone: string | null;
}

export default function ContactFarmerDialog({ open, onClose, farmerName, phone }: Props) {
  const handleCopy = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(`+91${phone}`);
      toast.success("Phone number copied.");
    } catch {
      toast.info(`Farmer phone: +91 ${phone}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Contact Farmer</DialogTitle>
        </DialogHeader>

        {phone ? (
          <div className="space-y-4 pt-1">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">{farmerName}</p>
              <p className="text-2xl font-bold text-foreground tracking-wide">+91 {phone}</p>
            </div>

            <div className="flex gap-3">
              <a href={`tel:+91${phone}`} className="flex-1" onClick={onClose}>
                <Button className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Now
                </Button>
              </a>
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Number
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Payment is Cash or UPI directly to the farmer at pickup.
            </p>
          </div>
        ) : (
          <div className="py-4 text-center space-y-4">
            <p className="text-muted-foreground text-sm">
              Please reserve first or visit the pickup location to reach this farmer.
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
