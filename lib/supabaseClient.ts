// lib/supabaseClient.ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const url = process.env.https://smunkjdnsybwsqwdvgsp.supabase.co!;
  const anon = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdW5ramRuc3lid3Nxd2R2Z3NwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MzU0MDUsImV4cCI6MjA4MDIxMTQwNX0.Ljxbjhwu-OX8rYuNpXDQOF6yy77-5raqZB9j88wOX3Y;
  return createBrowserClient(url, anon);
}
