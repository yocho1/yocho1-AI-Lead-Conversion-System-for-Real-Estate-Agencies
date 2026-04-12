import { createClient } from "@supabase/supabase-js";
import { getClientEnv, getServerEnv } from "@/lib/env";

export function getServerSupabase() {
  const env = getServerEnv();

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

export function getClientSupabase() {
  const env = getClientEnv();
  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}
