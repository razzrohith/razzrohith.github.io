import { useRef, useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Leaf, Users, ShoppingBag, Phone, CheckCircle, ArrowRight, Tractor, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Navbar from "@/components/Navbar";
import { isSupabaseConfigured, getSupabase } from "@/lib/supabase";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().length(10, "Enter a valid 10-digit phone number"),
  role: z.enum(["Buyer", "Farmer", "Agent"], { required_error: "Please select a role" }),
  village: z.string().min(2, "Village/Town is required"),
});
type FormValues = z.infer<typeof schema>;

const steps = [
  { step: "1", title: "Farmer Lists Produce", desc: "A farmer adds their fresh harvest — quantity, price, pickup location." },
  { step: "2", title: "Buyer Browses Nearby", desc: "Buyers see listings close to them, filter by type and price." },
  { step: "3", title: "Reserve & Pickup", desc: "Buyer reserves the quantity needed, pays directly to the farmer at pickup." },
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

export default function LandingPage() {
  const waitlistRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [roleValue, setRoleValue] = useState<string>("");

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const scrollToWaitlist = () => {
    waitlistRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const onSubmit = async (data: FormValues) => {
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-secondary/10 py-16 md:py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-medium mb-4">
              <Leaf className="w-4 h-4" /> Now in Telangana
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 leading-tight">
              Raithu<span className="text-primary">Fresh</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-2 font-medium">
              Buy fresh fruits and vegetables directly from nearby farmers.
            </p>
            <p className="text-base text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connecting Telangana farmers with local buyers. No middlemen. Fair prices. Fresh produce.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={scrollToWaitlist} className="text-base px-8">
                Join as Buyer
              </Button>
              <Button size="lg" variant="secondary" onClick={scrollToWaitlist} className="text-base px-8">
                Join as Farmer
              </Button>
              <Link href="/browse">
                <Button size="lg" variant="outline" className="text-base px-8 w-full sm:w-auto">
                  Browse Produce <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6 text-center">The Problem</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <Tractor className="w-8 h-8 text-red-400 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">For Farmers</h3>
                <p className="text-muted-foreground text-sm">Farmers send most of their harvest to mandis and agents, getting very low prices. A small leftover portion often goes to waste.</p>
              </div>
              <div className="bg-orange-50 border border-orange-100 rounded-xl p-6">
                <ShoppingBag className="w-8 h-8 text-orange-400 mb-3" />
                <h3 className="font-semibold text-foreground mb-2">For Buyers</h3>
                <p className="text-muted-foreground text-sm">Buyers in towns and cities pay retail prices for produce that passed through 3-4 middlemen — by which time it's 3-5 days old.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Solution */}
      <section className="py-14 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">The Solution</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              RaithuFresh lets farmers sell a small portion of their harvest directly to local buyers — before sending the rest to their agent or mandi. Everyone wins.
            </p>
            <div className="grid md:grid-cols-3 gap-5">
              {steps.map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  className="bg-white rounded-xl p-6 border border-border shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg mb-3 mx-auto">
                    {s.step}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">Why RaithuFresh?</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
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
              </div>
              <div>
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
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 px-4 bg-muted/40">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">How It Works</h2>
            <p className="text-muted-foreground mb-8">Simple 3-step process. No app download needed.</p>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {steps.map((s, i) => (
                <div key={s.step} className="flex items-center gap-3">
                  <div className="bg-white rounded-xl p-4 border border-border text-center w-48">
                    <div className="text-3xl font-bold text-primary mb-1">{s.step}</div>
                    <div className="font-medium text-sm text-foreground">{s.title}</div>
                  </div>
                  {i < steps.length - 1 && <ArrowRight className="w-5 h-5 text-muted-foreground hidden md:block shrink-0" />}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Waitlist Form */}
      <section id="waitlist" ref={waitlistRef} className="py-14 px-4 bg-white">
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Join the Waitlist</h2>
              <p className="text-muted-foreground">Be the first to know when RaithuFresh launches in your area.</p>
            </div>
            {submitted ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <CheckCircle className="w-14 h-14 text-primary" />
                <h3 className="text-lg font-semibold">Thank you!</h3>
                <p className="text-muted-foreground">We'll contact you soon when RaithuFresh launches near you.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 bg-card border border-border rounded-2xl p-6 shadow-sm">
                <div>
                  <Label htmlFor="wl-name">Full Name</Label>
                  <Input id="wl-name" placeholder="Your name" {...register("name")} />
                  {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label htmlFor="wl-phone">Phone Number</Label>
                  <Input id="wl-phone" placeholder="10-digit mobile number" maxLength={10} {...register("phone")} />
                  {errors.phone && <p className="text-destructive text-xs mt-1">{errors.phone.message}</p>}
                </div>
                <div>
                  <Label>I am a</Label>
                  <Select
                    value={roleValue}
                    onValueChange={(v) => {
                      setRoleValue(v);
                      setValue("role", v as "Buyer" | "Farmer" | "Agent", { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Buyer">Buyer</SelectItem>
                      <SelectItem value="Farmer">Farmer</SelectItem>
                      <SelectItem value="Agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.role && <p className="text-destructive text-xs mt-1">{errors.role.message}</p>}
                </div>
                <div>
                  <Label htmlFor="wl-village">Village / Town</Label>
                  <Input id="wl-village" placeholder="e.g. Shadnagar, Siddipet..." {...register("village")} />
                  {errors.village && <p className="text-destructive text-xs mt-1">{errors.village.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    disabled={submitting}
                    onClick={() => { setRoleValue("Buyer"); setValue("role", "Buyer"); }}
                  >
                    {submitting ? "Saving..." : "Join as Buyer"}
                  </Button>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                    onClick={() => { setRoleValue("Farmer"); setValue("role", "Farmer"); }}
                  >
                    {submitting ? "Saving..." : "Join as Farmer"}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 px-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Leaf className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">RaithuFresh</span>
        </div>
        <p>Connecting Telangana farmers with local buyers.</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <MapPin className="w-3 h-3" /> Telangana, India
        </div>
        <p className="mt-2 text-xs">MVP version — No real transactions yet. Join the waitlist to stay updated.</p>
      </footer>
    </div>
  );
}
