/**
 * Backend env keys — loaded from .env (never commit real keys; use .env.example as template).
 * Vite exposes only vars prefixed with VITE_.
 * VITE_GEMINI_API_KEY is not required; analysis is triggered by Database Webhook and runs in Edge Function.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";

if (import.meta.env.DEV && (!supabaseUrl || !supabaseAnonKey)) {
  console.warn(
    "[Vync] Missing Supabase env. Copy .env.example to .env and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

export const env = {
  supabase: { url: supabaseUrl, anonKey: supabaseAnonKey },
  gemini: { apiKey: geminiApiKey },
} as const;
