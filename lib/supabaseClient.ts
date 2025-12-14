import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Singleton browser client (keeps existing imports working)
 */
export const supabase: SupabaseClient = createBrowserClient(url, anon);

/**
 * Factory function (recommended for new code)
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(url, anon);
}
