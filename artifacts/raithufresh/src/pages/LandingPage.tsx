import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Leaf, Users, CheckCircle, ArrowRight, Tractor, MapPin,
  Star, BadgeCheck, Calendar, Loader2, ShoppingBag,
  Phone, Banknote, ClipboardList, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import {
  isSupabaseConfigured,
  getLandingFarmers,
  getLandingListings,
  getLandingStats,
  LandingFarmer,
  LandingStats,
  SupabaseListing,
} from "@/lib/supabase";
import BilingualLabel from "@/components/BilingualLabel";

// ── Static data ───────────────────────────────────────────────────────────────

const STEP_ICONS = [ClipboardList, Search, Phone, Banknote] as const;

const steps = [
  {
    step: "1",
    title: "Farmer Lists Produce",
    teTitle: "రైతు పంటను జాబితా చేస్తారు",
    desc: "Farmer adds fruits or vegetables — quantity, price, and pickup location.",
    teDesc: "రైతు పండ్లు లేదా కూరగాయలు - పరిమాణం, ధర మరియు తీసుకునే ప్రదేశాన్ని జోడిస్తారు.",
  },
  {
    step: "2",
    title: "Buyer Reserves Nearby",
    teTitle: "కొనుగోలుదారు రిజర్వ్ చేస్తారు",
    desc: "Buyer browses active listings and reserves the quantity needed.",
    teDesc: "కొనుగోలుదారు పంటలను చూసి కావలసిన పరిమాణాన్ని రిజర్వ్ చేస్తారు.",
  },
  {
    step: "3",
    title: "Buyer Contacts Farmer",
    teTitle: "రైతును సంప్రదించండి",
    desc: "Buyer calls or messages the farmer directly to confirm pickup.",
    teDesc: "కొనుగోలుదారు నేరుగా రైతుకు ఫోన్ చేసి పికప్ గురించి మాట్లాడుతారు.",
  },
  {
    step: "4",
    title: "Cash or UPI at Pickup",
    teTitle: "పికప్ వద్ద నగదు లేదా UPI",
    desc: "Payment is made directly to the farmer. No online payment needed.",
    teDesc: "చెల్లింపు నేరుగా రైతుకు చేయబడుతుంది. ఆన్‌లైన్ పేమెంట్ అవసరం లేదు.",
  },
];

const farmerBenefits = [
  "Sell directly — no middleman cutting your earnings",
  "Set your own price per kg",
  "Reach buyers in nearby towns and villages",
  "Agents can help if you don't have a smartphone",
];

const buyerBenefits = [
  "Get fresh produce harvested just days ago",
  "Know exactly which farmer grew your food",
  "Lower prices — no retail markup",
  "Support local Telangana farmers",
];

// ── Small helpers ─────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number | null }) {
  if (!rating) return null;
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i < rounded
              ? "text-amber-400 fill-amber-400"
              : "text-muted-foreground/20 fill-muted-foreground/10"
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function CategoryIcon({ category, size = 20 }: { category: string; size?: number }) {
  const src = category === "Fruit" ? "/assets/icon-fruit.svg" : "/assets/icon-vegetable.svg";
  return (
    <img
      src={src}
      alt={category}
      width={size}
      height={size}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function getRoleDashboard(role: string | null): { href: string; label: string } {
  if (role === "farmer") return { href: "/farmer", label: "Farmer Dashboard" };
  if (role === "agent") return { href: "/agent", label: "Agent Dashboard" };
  if (role === "admin") return { href: "/admin", label: "Admin Dashboard" };
  return { href: "/buyer", label: "Buyer Dashboard" };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, role } = useAuth();
  // ── Landing data ─────────────────────────────────────────────────────────
  const [landingFarmers, setLandingFarmers] = useState<LandingFarmer[]>([]);
  const [landingListings, setLandingListings] = useState<SupabaseListing[]>([]);
  const [landingStats, setLandingStats] = useState<LandingStats | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setDataLoading(false);
        return;
      }
      try {
        const [farmers, listings, stats] = await Promise.all([
          getLandingFarmers(),
          getLandingListings(),
          getLandingStats(),
        ]);
        setLandingFarmers(farmers);
        setLandingListings(listings);
        setLandingStats(stats);
      } catch (e) {
        console.warn("Landing data load failed:", e);
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────

  const listingCountByFarmer: Record<string, number> = {};
  landingListings.forEach((l) => {
    listingCountByFarmer[l.farmer_id] = (listingCountByFarmer[l.farmer_id] ?? 0) + 1;
  });

  const farmerOfWeek: LandingFarmer | null = landingFarmers[0] ?? null;
  const farmerOfWeekListings: SupabaseListing[] = farmerOfWeek
    ? landingListings.filter((l) => l.farmer_id === farmerOfWeek.id).slice(0, 3)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* ── Hero ── */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16 md:py-20 px-4 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">

            {/* Left: Text + CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-5">
                <Leaf className="w-4 h-4" /> Now in Telangana
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
                Raithu<span className="text-primary">Fresh</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-3 font-medium leading-snug">
                <BilingualLabel 
                  en="Buy fresh fruits and vegetables directly from nearby farmers." 
                  te="తాజా పండ్లు మరియు కూరగాయలను నేరుగా రైతుల నుండి కొనండి."
                  orientation="stacked"
                  teClassName="text-sm mt-1"
                />
              </p>
              <p className="text-base text-muted-foreground mb-8 max-w-lg">
                Connecting Telangana farmers with local buyers. No middlemen. Fair prices. Fresh produce.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <>
                    <Link href={getRoleDashboard(role).href}>
                      <Button size="lg" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel 
                          en={`Go to ${getRoleDashboard(role).label.replace(" Dashboard", "")} Dashboard`} 
                          te="డాష్బోర్డ్ కు వెళ్ళండి"
                          orientation="stacked"
                        />
                      </Button>
                    </Link>
                    <Link href="/browse">
                      <Button size="lg" variant="secondary" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel en="Browse Produce" te="పంటలు చూడండి" orientation="stacked" />
                      </Button>
                    </Link>
                    <Link href="/profile">
                      <Button size="lg" variant="outline" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel en="My Profile" te="నా ప్రొఫైల్" orientation="stacked" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/signup?role=buyer">
                      <Button size="lg" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel en="Join as Buyer" te="కొనుగోలుదారుగా చేరండి" orientation="stacked" />
                      </Button>
                    </Link>
                    <Link href="/signup?role=farmer">
                      <Button size="lg" variant="secondary" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel en="Join as Farmer" te="రైతుగా చేరండి" orientation="stacked" />
                      </Button>
                    </Link>
                    <Link href="/browse">
                      <Button size="lg" variant="outline" className="text-base px-7 w-full sm:w-auto h-auto py-3">
                        <BilingualLabel en="Browse Produce" te="పంటలు చూడండి" orientation="stacked" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>

            {/* Right: Hero illustration (desktop only) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="hidden md:flex items-center justify-center"
            >
              <img
                src="/assets/hero-produce.svg"
                alt="Fresh fruits and vegetables from Telangana farmers"
                width={480}
                height={380}
                className="w-full max-w-md drop-shadow-sm select-none"
                draggable={false}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Trust Indicators Strip ── */}
      <section className="py-8 px-4 bg-white border-b border-border">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm text-muted-foreground mb-6">
            Built for local pickup. Farmers list fresh fruits and vegetables, buyers reserve and contact directly.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0, duration: 0.35 }}
              className="flex flex-col items-center gap-1.5 bg-primary/5 rounded-xl p-4 text-center"
            >
              <BadgeCheck className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold text-primary leading-none">
                {dataLoading ? "—" : (landingStats?.verifiedFarmers ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <BilingualLabel en="Verified Farmers" te="ధృవీకరించబడిన రైతులు" orientation="stacked" />
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06, duration: 0.35 }}
              className="flex flex-col items-center gap-1.5 bg-primary/5 rounded-xl p-4 text-center"
            >
              <ShoppingBag className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold text-primary leading-none">
                {dataLoading ? "—" : (landingStats?.activeListings ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <BilingualLabel en="Active Listings" te="అందుబాటులో ఉన్న పంటలు" orientation="stacked" />
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.12, duration: 0.35 }}
              className="flex flex-col items-center gap-1.5 bg-primary/5 rounded-xl p-4 text-center col-span-2 sm:col-span-1"
            >
              <MapPin className="w-6 h-6 text-primary" />
              <span className="text-2xl font-bold text-primary leading-none">
                {dataLoading ? "—" : (landingStats?.districtsCovered ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <BilingualLabel en="Districts" te="జిల్లాలు" orientation="stacked" />
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.18, duration: 0.35 }}
              className="flex flex-col items-center gap-1.5 bg-amber-50 rounded-xl p-4 text-center"
            >
              <img src="/assets/icon-fruit.svg" alt="Fruit" width={24} height={24} />
              <span className="text-2xl font-bold text-amber-600 leading-none">
                {dataLoading ? "—" : (landingStats?.fruitListings ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <BilingualLabel en="Fruit" te="పండ్లు" orientation="stacked" />
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.24, duration: 0.35 }}
              className="flex flex-col items-center gap-1.5 bg-violet-50 rounded-xl p-4 text-center"
            >
              <img src="/assets/icon-vegetable.svg" alt="Vegetable" width={24} height={24} />
              <span className="text-2xl font-bold text-violet-600 leading-none">
                {dataLoading ? "—" : (landingStats?.vegetableListings ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                <BilingualLabel en="Vegetables" te="కూరగాయలు" orientation="stacked" />
              </span>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-14 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 text-center">
              <BilingualLabel en="How It Works" te="ఇది ఎలా పనిచేస్తుంది" />
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-8">
              Simple steps to connect farmers with buyers.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
              {steps.map((s, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Step {s.step}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">
                      <BilingualLabel en={s.title} te={s.teTitle} orientation="stacked" />
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <BilingualLabel en={s.desc} te={s.teDesc} orientation="stacked" teClassName="text-[10px]" />
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Farmer of the Week ── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  <BilingualLabel en="Farmer of the Week" te="వారపు ఉత్తమ రైతు" />
                </h2>
                <p className="text-muted-foreground text-sm">
                  Our highest rated verified farmer this week.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="outline" size="sm">
                  <BilingualLabel en="See All Farmers" te="రైతులందరినీ చూడండి" />
                </Button>
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : !farmerOfWeek ? (
              <div className="text-center py-14 text-muted-foreground bg-muted/30 rounded-xl border border-border">
                <p className="text-sm">No verified farmers yet.</p>
                <p className="text-xs mt-1">Check back soon.</p>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-primary/5 to-secondary/5 border border-border rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-2xl font-bold text-primary">
                  {farmerOfWeek.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-foreground text-lg">{farmerOfWeek.name}</h3>
                    {farmerOfWeek.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                        <BadgeCheck className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  {farmerOfWeek.rating && <StarRating rating={farmerOfWeek.rating} />}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {[farmerOfWeek.village, farmerOfWeek.district].filter(Boolean).join(", ")}
                  </div>

                  {farmerOfWeekListings.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {farmerOfWeekListings.map((l) => (
                        <Badge key={l.id} variant="secondary" className="text-xs">
                          {l.produce_name} — Rs {l.price_per_kg}/kg
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Link href={`/farmers/${farmerOfWeek.id}`} className="mt-4 inline-block">
                    <Button variant="outline" size="sm">
                      <BilingualLabel en="View Profile" te="ప్రొఫైల్ చూడండి" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Nearby Farmers ── */}
      <section className="py-14 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  <BilingualLabel en="Active Farmers" te="అందుబాటులో ఉన్న రైతులు" />
                </h2>
                <p className="text-muted-foreground text-sm">
                  Farmers currently listing produce on RaithuFresh.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="outline" size="sm">
                  <BilingualLabel en="Browse All" te="అన్నీ చూడండి" />
                </Button>
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading farmers...</span>
              </div>
            ) : landingFarmers.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground bg-white rounded-xl border border-border">
                <p className="text-sm">No farmers active right now.</p>
                <p className="text-xs mt-1">Check back soon.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {landingFarmers.slice(0, 6).map((farmer, i) => {
                  const count = listingCountByFarmer[farmer.id] ?? 0;
                  return (
                    <motion.div
                      key={farmer.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.07, duration: 0.35 }}
                      className="bg-white border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{farmer.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {[farmer.village, farmer.district].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        </div>
                        {farmer.verified && (
                          <div className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
                            <BadgeCheck className="w-4 h-4" />
                            Verified
                          </div>
                        )}
                      </div>
                      {farmer.rating && <StarRating rating={farmer.rating} />}
                      <p className="text-xs text-muted-foreground">
                        {count > 0
                          ? `${count} active listing${count !== 1 ? "s" : ""}`
                          : "No active listings right now"}
                      </p>
                      <Link href={`/farmers/${farmer.id}`}>
                        <Button variant="outline" size="sm" className="w-full mt-auto h-auto py-2">
                          <BilingualLabel en="View Farmer Profile" te="రైతు ప్రొఫైల్ చూడండి" orientation="stacked" />
                        </Button>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Fresh Listings Near You ── */}
      <section className="py-14 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
                  <BilingualLabel en="Fresh Listings" te="తాజా పంటలు" />
                </h2>
                <p className="text-muted-foreground text-sm">
                  Active produce available for pickup from Telangana farmers.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="outline" size="sm">
                  <BilingualLabel en="Browse All Produce" te="పంటలన్నీ చూడండి" />
                </Button>
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading listings...</span>
              </div>
            ) : landingListings.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground bg-white rounded-xl border border-border flex flex-col items-center gap-2">
                <img
                  src="/assets/empty-produce.svg"
                  alt="No listings found"
                  width={100}
                  height={80}
                  className="opacity-70"
                />
                <p className="text-sm">No active listings right now.</p>
                <p className="text-xs">Check back soon or browse all produce.</p>
                <Link href="/browse">
                  <Button variant="outline" size="sm" className="mt-2">
                    Browse All Produce
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {landingListings.slice(0, 6).map((listing, i) => {
                    const harvestDate = listing.harvest_datetime
                      ? listing.harvest_datetime.split("T")[0]
                      : null;
                    const village = listing.farmers?.village ?? null;
                    const district = listing.farmers?.district ?? listing.district ?? null;
                    const locationStr = [village, district].filter(Boolean).join(", ");
                    return (
                      <motion.div
                        key={listing.id}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.07, duration: 0.35 }}
                        className="bg-white border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold text-foreground text-base">
                              {listing.produce_name}
                            </h3>
                            {listing.farmers?.name && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                by {listing.farmers.name}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <CategoryIcon category={listing.category} size={18} />
                            <Badge
                              variant={listing.category === "Fruit" ? "default" : "secondary"}
                            >
                              {listing.category}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-primary/5 rounded-lg p-2 text-center">
                            <div className="font-bold text-primary text-lg">
                              <BilingualLabel en={`Rs ${listing.price_per_kg}`} te={`Rs ${listing.price_per_kg}`} orientation="stacked" />
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              <BilingualLabel en="per kg" te="కేజీకి" />
                            </div>
                          </div>
                          <div className="bg-muted rounded-lg p-2 text-center">
                            <div className="font-bold text-foreground text-lg">
                              {listing.quantity_kg}
                            </div>
                            <div className="text-muted-foreground text-[10px]">
                              <BilingualLabel en="kg available" te="కేజీలు ఉన్నాయి" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          {harvestDate && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              Harvest: {harvestDate}
                            </div>
                          )}
                          {locationStr && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              {locationStr}
                            </div>
                          )}
                        </div>

                        <Link href={`/produce/${listing.id}`}>
                          <Button variant="outline" size="sm" className="w-full mt-auto h-auto py-2">
                            <BilingualLabel en="View Details" te="వివరాలు చూడండి" orientation="stacked" />
                          </Button>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
                {landingListings.length > 6 && (
                  <div className="text-center mt-6">
                    <Link href="/browse">
                      <Button variant="outline">
                        See all {landingListings.length} listings{" "}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">
              <BilingualLabel en="The Problem" te="సమస్య" />
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <Tractor className="w-8 h-8 text-red-400 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">For Farmers</h3>
                <p className="text-muted-foreground text-sm">
                  Farmers send most of their harvest to mandis and agents, getting very low prices.
                  A small leftover portion often goes to waste.
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
                <ShoppingBag className="w-8 h-8 text-orange-400 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">For Buyers</h3>
                <p className="text-muted-foreground text-sm">
                  Buyers in towns and cities pay retail prices for produce that passed through
                  3–4 middlemen — by which time it is 3–5 days old.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
              <BilingualLabel en="Why RaithuFresh?" te="రైతుఫ్రెష్ ఎందుకు?" />
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl p-6 border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Tractor className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground text-lg">For Farmers</h3>
                </div>
                <ul className="space-y-3">
                  {farmerBenefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                {!user && (
                  <Link href="/signup?role=farmer" className="mt-5 block">
                    <Button className="w-full h-auto py-2" variant="outline">
                      <BilingualLabel en="Join as Farmer" te="రైతుగా చేరండి" orientation="stacked" />
                    </Button>
                  </Link>
                )}
              </div>
              <div className="bg-white rounded-xl p-6 border border-border shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-secondary" />
                  <h3 className="font-semibold text-foreground text-lg">For Buyers</h3>
                </div>
                <ul className="space-y-3">
                  {buyerBenefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
                {!user && (
                  <Link href="/signup?role=buyer" className="mt-5 block">
                    <Button className="w-full h-auto py-2">
                      <BilingualLabel en="Join as Buyer" te="కొనుగోలుదారుగా చేరండి" orientation="stacked" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              <BilingualLabel en="Ready to Get Started?" te="ప్రారంభించడానికి సిద్ధంగా ఉన్నారా?" />
            </h2>
            <p className="text-muted-foreground mb-7">
              Sign up in under a minute. Browse active listings or list your produce today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {user ? (
                <>
                  <Link href={getRoleDashboard(role).href}>
                    <Button size="lg" className="text-base px-8 w-full sm:w-auto h-auto py-3">
                      <BilingualLabel en="Go to Dashboard" te="డాష్బోర్డ్ కు వెళ్ళండి" orientation="stacked" />
                    </Button>
                  </Link>
                  <Link href="/browse">
                    <Button size="lg" variant="outline" className="text-base px-8 w-full sm:w-auto h-auto py-3">
                      <BilingualLabel en="Browse Produce" te="పంటలు చూడండి" orientation="stacked" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup?role=buyer">
                    <Button size="lg" className="text-base px-8 w-full sm:w-auto">
                      Sign Up as Buyer
                    </Button>
                  </Link>
                  <Link href="/signup?role=farmer">
                    <Button size="lg" variant="secondary" className="text-base px-8 w-full sm:w-auto">
                      Sign Up as Farmer
                    </Button>
                  </Link>
                  <Link href="/browse">
                    <Button size="lg" variant="outline" className="text-base px-8 w-full sm:w-auto">
                      Browse First <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-muted/30 py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Leaf className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">RaithuFresh</span>
        </div>
        <p>Connecting Telangana farmers with local buyers.</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <MapPin className="w-3 h-3" /> Telangana, India
        </div>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs">
          <Link href="/browse" className="hover:text-foreground underline underline-offset-2">
            Browse Produce
          </Link>
          <span>·</span>
          {user ? (
            <>
              <Link href={getRoleDashboard(role).href} className="hover:text-foreground underline underline-offset-2">
                Dashboard
              </Link>
              <span>·</span>
              <Link href="/profile" className="hover:text-foreground underline underline-offset-2">
                My Profile
              </Link>
            </>
          ) : (
            <>
              <Link href="/signup?role=farmer" className="hover:text-foreground underline underline-offset-2">
                Join as Farmer
              </Link>
              <span>·</span>
              <Link href="/signup?role=buyer" className="hover:text-foreground underline underline-offset-2">
                Join as Buyer
              </Link>
              <span>·</span>
              <Link href="/login" className="hover:text-foreground underline underline-offset-2">
                Log In
              </Link>
            </>
          )}
        </div>
        <p className="mt-3 text-xs">
          Payment is Cash or UPI directly to the farmer at pickup.
        </p>
      </footer>
    </div>
  );
}
