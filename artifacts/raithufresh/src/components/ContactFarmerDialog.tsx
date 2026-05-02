import { Phone, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Normalize an Indian phone number to the format required by wa.me and tel: links.
 * Strips spaces, dashes, parentheses, and leading +.
 * Accepts: 10-digit, +91XXXXXXXXXX, 91XXXXXXXXXX.
 * Returns: "91XXXXXXXXXX" (12 digits, no +) or null if unrecognizable.
 * Does NOT modify the stored database value.
 */
function normalizePhoneE164(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().+]/g, "");
  if (/^\d{10}$/.test(cleaned)) return `91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return cleaned;
  return null;
}

/** Format normalized E164 for display: "+91 98765 43210" */
function formatDisplay(normalized: string): string {
  return `+${normalized.slice(0, 2)} ${normalized.slice(2, 7)} ${normalized.slice(7)}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  farmerName: string;
  phone: string | null;
  produceName?: string;
}

export default function ContactFarmerDialog({
  open,
  onClose,
  farmerName,
  phone,
  produceName,
}: Props) {
  const normalized = phone ? normalizePhoneE164(phone) : null;
  const displayPhone = normalized ? formatDisplay(normalized) : phone;

  const waText = produceName
    ? `Hi, I saw your ${produceName} listing on RaithuFresh. Is it still available?`
    : "Hi, I saw your produce listing on RaithuFresh. Is it still available?";

  const waUrl = normalized
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(waText)}`
    : null;

  const telUrl = normalized ? `tel:+${normalized}` : null;

  const handleCopy = async () => {
    const toCopy = normalized ? `+${normalized}` : phone;
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
      toast.success("Phone number copied.");
    } catch {
      toast.info(`Farmer phone: ${displayPhone}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Contact Farmer</DialogTitle>
        </DialogHeader>

        {normalized ? (
          <div className="space-y-3 pt-1">
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">{farmerName}</p>
              <p className="text-2xl font-bold text-foreground tracking-wide">
                {displayPhone}
              </p>
            </div>

            <div className="flex gap-3">
              <a href={telUrl!} className="flex-1" onClick={onClose}>
                <Button className="w-full">
                  <Phone className="w-4 h-4 mr-2" />
                  Call Now
                </Button>
              </a>
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>

            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
              >
                <Button
                  variant="outline"
                  className="w-full text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Message on WhatsApp
                </Button>
              </a>
            )}

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
