import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

export const supabase = env.hasSupabase
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

let hasLoggedSupabaseStatus = false;

export function logSupabaseConfiguration() {
  if (hasLoggedSupabaseStatus) {
    return;
  }

  hasLoggedSupabaseStatus = true;

  if (!env.hasSupabase) {
    console.warn(
      `[supabase] disabled: ${env.supabaseConfigError} Fix server/.env SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.`
    );
    return;
  }

  const keyPreview = env.supabaseServiceRoleKey.startsWith("sb_secret_")
    ? "sb_secret_***"
    : `${env.supabaseServiceRoleKey.slice(0, 10)}...`;

  console.log(`[supabase] client initialized for ${env.supabaseUrl}`);
  console.log(`[supabase] using privileged key ${keyPreview}`);
}

export async function verifySupabaseConnection() {
  logSupabaseConfiguration();

  if (!supabase) {
    return {
      ok: false,
      reason: env.supabaseConfigError
    };
  }

  const { error } = await supabase.from("orders").select("id").limit(1);

  if (error) {
    console.error(`[supabase] connection check failed: ${error.message}`);
    return {
      ok: false,
      reason: error.message,
      code: error.code || null
    };
  }

  console.log("[supabase] connection check succeeded.");

  return {
    ok: true,
    reason: "connected"
  };
}
