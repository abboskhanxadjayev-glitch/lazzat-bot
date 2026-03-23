const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isPlaceholderValue(value) {
  return value.includes("your-project-id") || value.includes("your-service-role-key");
}

function isPrivilegedSupabaseKey(value) {
  if (!value || isPlaceholderValue(value)) {
    return false;
  }

  return !value.startsWith("sb_publishable_") && !value.startsWith("sb_anon_");
}

function getSupabaseConfigError() {
  if (!supabaseUrl) {
    return "SUPABASE_URL is missing.";
  }

  if (!supabaseServiceRoleKey) {
    return "SUPABASE_SERVICE_ROLE_KEY is missing.";
  }

  if (isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseServiceRoleKey)) {
    return "Supabase credentials are still placeholders.";
  }

  if (!isPrivilegedSupabaseKey(supabaseServiceRoleKey)) {
    return "SUPABASE_SERVICE_ROLE_KEY is not a service-role or secret key.";
  }

  return "";
}

const supabaseConfigError = getSupabaseConfigError();

export const env = {
  port: Number(process.env.PORT || 5000),
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  supabaseUrl,
  supabaseServiceRoleKey,
  supabaseConfigError,
  hasSupabase: !supabaseConfigError
};
