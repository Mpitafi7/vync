import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

if (!env.supabase.url || !env.supabase.anonKey) {
  throw new Error(
    "Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify: Site settings → Environment variables → Add variables, then redeploy."
  );
}

export const supabase = createClient(env.supabase.url, env.supabase.anonKey);
