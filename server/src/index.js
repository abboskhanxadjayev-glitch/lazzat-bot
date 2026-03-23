import "dotenv/config";
import app from "./app.js";
import { env } from "./config/env.js";
import { verifySupabaseConnection } from "./config/supabase.js";

app.listen(env.port, async () => {
  console.log(`Lazzat API listening on http://localhost:${env.port}`);

  const supabaseStatus = await verifySupabaseConnection();

  if (!supabaseStatus.ok) {
    console.warn(`[supabase] order persistence unavailable: ${supabaseStatus.reason}`);
  }
});
