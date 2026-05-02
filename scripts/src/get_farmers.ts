import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.VITE_SUPABASE_URL!;
  const key = process.env.VITE_SUPABASE_ANON_KEY!;
  const sb = createClient(url, key);
  const { data, error } = await sb.from("farmers").select("id, name, village, district, verified").order("name").limit(10);
  if (error) { console.error("Error:", error.message); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
}
main();
