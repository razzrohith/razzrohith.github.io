import { useRef, useState, useEffect } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import {
  Leaf, Users, CheckCircle, ArrowRight, Tractor, MapPin,
  Star, BadgeCheck, Calendar, Loader2, ShoppingBag,
  Phone, Banknote, ClipboardList, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import {
  isSupabaseConfigured,
  getSupabase,
  getLandingFarmers,
  getLandingListings,
  LandingFarmer,
  SupabaseListing,
} from "@/lib/supabase";

// ── Static data ───────────────────────────────────────────────────────────────

const STEP_ICONS = [ClipboardList, Search, Phone, Banknote] as const;

const pilotSteps = [
  {
    step: "1",
    title: "Farmer Lists Produce",
    desc: "Farmer adds fruits or vegetables — quantity, price, and pickup location.",
  },
  {
    step: "2",
    title: "Buyer Reserves Nearby",
    desc: "Buyer browses active listings nearby and reserves the quantity needed.",
  },
  {
    step: "3",
    title: "Buyer Contacts Farmer",
    desc: "Buyer calls or messages the farmer directly to confirm before pickup.",
  },
  {
    step: "4",
    title: "Cash or UPI at Pickup",
    desc: "Payment is made directly to the farmer at pickup. No online payment.",
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

// ── Waitlist schema ───────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, "Enter your full name (at least 2 characters)"),
  phone: z.string().length(10, "Enter a valid 10-digit mobile number"),
  role: z.enum(["Buyer", "Farmer", "Agent"], {
    required_error: "Please select your role",
  }),
  village: z.string().min(2, "Enter your village or town name"),
});
type FormValues = z.infer<typeof schema>;

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const waitlistRef = useRef<HTMLDivElement>(null);

  // ── Waitlist form state ──────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleValue, setRoleValue] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // ── Landing data ─────────────────────────────────────────────────────────
  const [landingFarmers, setLandingFarmers] = useState<LandingFarmer[]>([]);
  const [landingListings, setLandingListings] = useState<SupabaseListing[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured()) {
        setDataLoading(false);
        return;
      }
      try {
        const [farmers, listings] = await Promise.all([
          getLandingFarmers(),
          getLandingListings(),
        ]);
        setLandingFarmers(farmers);
        setLandingListings(listings);
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

  // Farmer of the Week — highest rated verified farmer
  const farmerOfWeek: LandingFarmer | null = landingFarmers[0] ?? null;
  const farmerOfWeekListings: SupabaseListing[] = farmerOfWeek
    ? landingListings.filter((l) => l.farmer_id === farmerOfWeek.id).slice(0, 3)
    : [];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const scrollToWaitlistWithRole = (role: "Buyer" | "Farmer") => {
    setRoleValue(role);
    setValue("role", role, { shouldValidate: false });
    setTimeout(() => {
      waitlistRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const onSubmit = async (data: FormValues) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await getSupabase()
          .from("waitlist_leads")
          .insert({
            name: data.name,
            phone: data.phone,
            role: data.role.toLowerCase(),
            town: data.village,
          });
        if (error) console.warn("Supabase waitlist error:", error.message);
      }
    } catch (e) {
      console.warn("Waitlist save failed, using local fallback:", e);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
  };

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
                <Leaf className="w-4 h-4" /> Now in Telangana — Pilot Phase
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4 leading-tight">
                Raithu<span className="text-primary">Fresh</span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground mb-3 font-medium leading-snug">
                Buy fresh fruits and vegetables directly from nearby farmers.
              </p>
              <p className="text-base text-muted-foreground mb-8 max-w-lg">
                Connecting Telangana farmers with local buyers. No middlemen. Fair prices. Fresh produce.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="text-base px-7"
                  onClick={() => scrollToWaitlistWithRole("Buyer")}
                >
                  Join as Buyer
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="text-base px-7"
                  onClick={() => scrollToWaitlistWithRole("Farmer")}
                >
                  Join as Farmer
                </Button>
                <Link href="/browse">
                  <Button size="lg" variant="outline" className="text-base px-7 w-full sm:w-auto">
                    Browse Produce <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
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
                alt="Fresh fruits and vegetables from Telangana farmers — mango, tomato, brinjal, banana, chili"
                width={480}
                height={380}
                className="w-full max-w-md drop-shadow-sm select-none"
                draggable={false}
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── How the Pilot Works ── */}
      <section className="py-14 px-4 bg-primary/5">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                How the Pilot Works
              </h2>
              <p className="text-muted-foreground">Simple steps. No app needed. No online payment.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {pilotSteps.map((s, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <motion.div
                    key={s.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    className="bg-white rounded-xl p-5 border border-border shadow-sm text-center flex flex-col items-center gap-2"
                  >
                    <div className="w-11 h-11 rounded-full bg-primary/8 flex items-center justify-center mb-1">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {s.step}
                    </div>
                    <h3 className="font-semibold text-foreground text-sm">{s.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Farmer of the Week ── */}
      {!dataLoading && farmerOfWeek && (
        <section className="py-14 px-4 bg-amber-50/60 border-y border-amber-100">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              {/* Header badge */}
              <div className="flex items-center gap-3 mb-7">
                <img
                  src="/assets/icon-farmer-week.svg"
                  alt="Farmer of the week award"
                  width={52}
                  height={52}
                  className="shrink-0"
                />
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-0.5">
                    Farmer of the Week
                  </p>
                  <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                    {farmerOfWeek.name}
                  </h2>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">

                {/* Farmer profile card */}
                <div className="bg-white rounded-2xl p-6 border border-amber-100 shadow-sm flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {[farmerOfWeek.village, farmerOfWeek.district].filter(Boolean).join(", ")}
                    </p>
                    {farmerOfWeek.verified && (
                      <div className="flex items-center gap-1 text-xs text-primary font-semibold shrink-0">
                        <BadgeCheck className="w-4 h-4" />
                        Verified
                      </div>
                    )}
                  </div>
                  <StarRating rating={farmerOfWeek.rating} />
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const c = listingCountByFarmer[farmerOfWeek.id] ?? 0;
                      return c > 0
                        ? `${c} active listing${c !== 1 ? "s" : ""} available now`
                        : "No active listings right now";
                    })()}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Link href={`/farmers/${farmerOfWeek.id}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        View Farmer Profile
                      </Button>
                    </Link>
                    <Link href={`/browse`} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        Browse Their Produce
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Farmer's top listings */}
                {farmerOfWeekListings.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {farmerOfWeekListings.map((listing) => {
                      const harvestDate = listing.harvest_datetime
                        ? listing.harvest_datetime.split("T")[0]
                        : null;
                      return (
                        <div
                          key={listing.id}
                          className="bg-white rounded-xl px-4 py-3 border border-amber-100 shadow-sm flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <CategoryIcon category={listing.category} size={32} />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground text-sm truncate">
                                {listing.produce_name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Rs {listing.price_per_kg}/kg · {listing.quantity_kg} kg available
                                {harvestDate ? ` · Harvest ${harvestDate}` : ""}
                              </p>
                            </div>
                          </div>
                          <Link href={`/produce/${listing.id}`} className="shrink-0">
                            <Button size="sm" variant="ghost" className="text-xs h-7 px-2">
                              View <ArrowRight className="w-3 h-3 ml-0.5" />
                            </Button>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center bg-white rounded-2xl border border-amber-100 p-8 text-center text-muted-foreground text-sm">
                    No active listings from this farmer right now.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Nearby Verified Farmers ── */}
      <section className="py-14 px-4 bg-white">
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
                  Nearby Verified Farmers
                </h2>
                <p className="text-muted-foreground text-sm">
                  Farmers listing fresh produce directly from Telangana.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="outline" size="sm">
                  Browse All Produce <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-14 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading farmers...</span>
              </div>
            ) : landingFarmers.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground bg-muted/30 rounded-xl flex flex-col items-center gap-2">
                <img
                  src="/assets/empty-produce.svg"
                  alt="No farmers found"
                  width={100}
                  height={80}
                  className="opacity-70"
                />
                <p className="text-sm">No verified farmers listed yet.</p>
                <p className="text-xs">Check back soon as the pilot grows.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {landingFarmers.map((farmer, i) => {
                  const count = listingCountByFarmer[farmer.id] ?? 0;
                  return (
                    <motion.div
                      key={farmer.id}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.07, duration: 0.35 }}
                      className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground text-base">{farmer.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {[farmer.village, farmer.district].filter(Boolean).join(", ")}
                          </p>
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
                        <Button variant="outline" size="sm" className="w-full mt-auto">
                          View Farmer Profile
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
                  Fresh Listings Near You
                </h2>
                <p className="text-muted-foreground text-sm">
                  Active produce available for pickup from Telangana farmers.
                </p>
              </div>
              <Link href="/browse">
                <Button variant="outline" size="sm">
                  Browse All Produce <ArrowRight className="w-3.5 h-3.5 ml-1" />
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
                              Rs {listing.price_per_kg}
                            </div>
                            <div className="text-muted-foreground text-xs">per kg</div>
                          </div>
                          <div className="bg-muted rounded-lg p-2 text-center">
                            <div className="font-bold text-foreground text-lg">
                              {listing.quantity_kg}
                            </div>
                            <div className="text-muted-foreground text-xs">kg available</div>
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
                          <Button variant="outline" size="sm" className="w-full mt-auto">
                            View Details
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
              The Problem
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
                  3-4 middlemen — by which time it is 3-5 days old.
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
              Why RaithuFresh?
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
                <Button
                  className="mt-5 w-full"
                  variant="outline"
                  onClick={() => scrollToWaitlistWithRole("Farmer")}
                >
                  Join as Farmer
                </Button>
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
                <Button
                  className="mt-5 w-full"
                  onClick={() => scrollToWaitlistWithRole("Buyer")}
                >
                  Join as Buyer
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Waitlist Form ── */}
      <section id="waitlist" ref={waitlistRef} className="py-14 px-4 bg-white">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Join the Waitlist
              </h2>
              <p className="text-muted-foreground">
                Be among the first when RaithuFresh launches in your area.
              </p>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-10 text-center bg-card border border-border rounded-2xl p-6 shadow-sm">
                <CheckCircle className="w-14 h-14 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">You are on the list!</h3>
                <p className="text-muted-foreground text-sm">
                  We will contact you when RaithuFresh launches near you. Thank you for your interest.
                </p>
                <Link href="/browse">
                  <Button variant="outline" size="sm" className="mt-2">
                    Browse Produce Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-4 bg-card border border-border rounded-2xl p-6 shadow-sm"
              >
                <div>
                  <Label htmlFor="wl-name">Full Name</Label>
                  <Input
                    id="wl-name"
                    placeholder="Your full name"
                    autoComplete="name"
                    {...register("name")}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-destructive text-xs mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="wl-phone">Mobile Number</Label>
                  <Input
                    id="wl-phone"
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    inputMode="numeric"
                    autoComplete="tel"
                    {...register("phone")}
                    className={errors.phone ? "border-destructive" : ""}
                  />
                  {errors.phone && (
                    <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>
                  )}
                </div>

                <div>
                  <Label>I am a</Label>
                  <Select
                    value={roleValue}
                    onValueChange={(v) => {
                      setRoleValue(v);
                      setValue("role", v as "Buyer" | "Farmer" | "Agent", {
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Buyer">Buyer — I want to buy fresh produce</SelectItem>
                      <SelectItem value="Farmer">Farmer — I want to sell my harvest</SelectItem>
                      <SelectItem value="Agent">Agent — I help farmers list produce</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-destructive text-xs mt-1">{errors.role.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="wl-village">Village / Town</Label>
                  <Input
                    id="wl-village"
                    placeholder="e.g. Shadnagar, Siddipet, Nizamabad..."
                    {...register("village")}
                    className={errors.village ? "border-destructive" : ""}
                  />
                  {errors.village && (
                    <p className="text-destructive text-xs mt-1">{errors.village.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Join Waitlist"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  No spam. We will only contact you when the pilot launches near you.
                </p>
              </form>
            )}
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
          <button
            className="hover:text-foreground underline underline-offset-2"
            onClick={() => scrollToWaitlistWithRole("Farmer")}
          >
            Join as Farmer
          </button>
          <span>·</span>
          <button
            className="hover:text-foreground underline underline-offset-2"
            onClick={() => scrollToWaitlistWithRole("Buyer")}
          >
            Join as Buyer
          </button>
        </div>
        <p className="mt-3 text-xs">
          MVP pilot — No real transactions yet. Payment is Cash or UPI directly to the farmer.
        </p>
      </footer>
    </div>
  );
}
