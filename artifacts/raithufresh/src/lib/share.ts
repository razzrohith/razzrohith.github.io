import { toast } from "sonner";

export interface ShareListingOptions {
  name: string;
  pricePerKg: number;
  location: string;
  id: string;
}

/**
 * Share a produce listing using the free browser Web Share API when available.
 * Falls back to clipboard copy, then a toast with the URL.
 * No paid service is used.
 */
export async function shareListing(opts: ShareListingOptions): Promise<void> {
  const url = `${window.location.origin}/produce/${opts.id}`;
  const text = opts.location
    ? `Fresh ${opts.name} available on RaithuFresh for Rs ${opts.pricePerKg}/kg near ${opts.location}. View listing: ${url}`
    : `Fresh ${opts.name} available on RaithuFresh for Rs ${opts.pricePerKg}/kg. View listing: ${url}`;
  const title = `${opts.name} on RaithuFresh`;

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.success("Listing link copied to clipboard.");
  } catch {
    toast.info(`Listing URL: ${url}`);
  }
}
