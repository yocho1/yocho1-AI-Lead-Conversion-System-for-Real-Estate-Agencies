const requiredServerEnv = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
] as const;

export function getServerEnv() {
  const missing: string[] = requiredServerEnv.filter((key) => !process.env[key]);
  const hasPublicKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (!hasPublicKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    appUrl: process.env.APP_URL || "http://localhost:3000",
    followUpDelayMinutes: Number(process.env.FOLLOW_UP_DELAY_MINUTES || 20),
  };
}

export function getAiEnv() {
  const env = getServerEnv();
  if (!env.openrouterApiKey) {
    throw new Error("Missing required env vars: OPENROUTER_API_KEY");
  }

  return {
    openrouterApiKey: env.openrouterApiKey,
    openrouterModel: env.openrouterModel,
    appUrl: env.appUrl,
  };
}

export function getClientEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing public Supabase env vars");
  }

  return { supabaseUrl, supabaseAnonKey };
}
