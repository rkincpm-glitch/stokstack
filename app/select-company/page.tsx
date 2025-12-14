"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
};

type MembershipRowFromDb = {
  company_id: string;
  companies: Company[]; // Supabase nested relation returns an array
};

type Membership = {
  company_id: string;
  company: Company | null; // normalized for UI use
};

export default function SelectCompanyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setErr(null);

      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(id, name)")
        .eq("user_id", user.id);

      if (error) {
        setErr(error.message);
        setMemberships([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as MembershipRowFromDb[];

      const normalized: Membership[] = rows.map((r) => ({
        company_id: r.company_id,
        company: r.companies?.[0] ?? null,
      }));

      // If exactly one company, jump straight in
      if (normalized.length === 1 && normalized[0].company_id) {
        router.replace(`/${normalized[0].company_id}`);
        return;
      }

      setMemberships(normalized);
      setLoading(false);
    };

    run();
  }, [router, supabase]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Select Company</h1>

      {err && <p style={{ color: "crimson", marginTop: 12 }}>{err}</p>}

      {memberships.length === 0 ? (
        <p style={{ marginTop: 12, opacity: 0.8 }}>
          No companies found for your user.
        </p>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          {memberships.map((m) => (
            <button
              key={m.company_id}
              onClick={() => router.push(`/${m.company_id}`)}
              style={{
                textAlign: "left",
                padding: 14,
                border: "1px solid #e5e5e5",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {m.company?.name ?? "Company"}
              </div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>
                {m.company_id}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
