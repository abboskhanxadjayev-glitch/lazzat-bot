import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

function isPlaceholderValue(value) {
  return value.includes("your-project-id") || value.includes("your-supabase-anon-key");
}

export const hasSupabaseRealtimeConfig = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !isPlaceholderValue(supabaseUrl) &&
  !isPlaceholderValue(supabaseAnonKey)
);

let supabaseBrowserClient = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseRealtimeConfig) {
    return null;
  }

  if (!supabaseBrowserClient) {
    supabaseBrowserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  }

  return supabaseBrowserClient;
}
