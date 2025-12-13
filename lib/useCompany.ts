"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UseCompanyResult = {
  loading: boolean;
  companyId: string | null;
  role: string | null;
  error: string | null;
};

export function useCompany(): UseCompanyResult {
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) console.error(userErr);

      const user = userData?.user;
      if (!user) {
        if (!cancelled) {
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      // With RLS, user can only read their own membership rows
      const { data, error: cuErr } = await supabase
        .from("company_users")
        .select("company_id, role")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cuErr) {
        console.error(cuErr);
        if (!cancelled) {
          setError("Failed to load company membership.");
          setCompanyId(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setCompanyId(data?.company_id ?? null);
        setRole(data?.role ?? null);
        setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, companyId, role, error };
}
