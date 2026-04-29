import fs from 'node:fs';
import path from 'node:path';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const config = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY
};

const out = path.join(process.cwd(), 'assets', 'js', 'runtime-config.js');
fs.writeFileSync(out, `window.DealNestConfig = ${JSON.stringify(config, null, 2)};\n`);
console.log(`Wrote public runtime config to ${path.relative(process.cwd(), out)}`);
