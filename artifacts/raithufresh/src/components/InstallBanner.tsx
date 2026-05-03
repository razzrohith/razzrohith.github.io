import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import BilingualLabel from "@/components/BilingualLabel";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("pwa-banner-dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("pwa-banner-dismissed", "1"); } catch {}
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-primary text-primary-foreground rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">
            <BilingualLabel en="Install RaithuFresh" te="రైతుఫ్రెష్‌ను ఇన్‌స్టాల్ చేయండి" />
          </p>
          <p className="text-xs opacity-80 leading-tight mt-0.5">
            <BilingualLabel en="Add to home screen for quick access" te="త్వరిత యాక్సెస్ కోసం హోమ్ స్క్రీన్‌కి జోడించండి" />
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="shrink-0 text-xs font-semibold h-auto py-1"
          onClick={handleInstall}
        >
          <BilingualLabel en="Install" te="ఇన్‌స్టాల్" orientation="stacked" />
        </Button>
        <button
          onClick={handleDismiss}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
