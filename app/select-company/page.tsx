"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type CompanyLite = { id: string; name: string };

type Membership = {
  company_id: string;
  // Supabase nested select returns an array (even if 1:1)
  companies: CompanyLite[] | null;
};

export default function SelectCompanyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setErr(null);
      setLoading(true);

      // Confirm auth first (optional but helps avoid confusing empty data)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        if (mounted) {
          setErr(authErr?.message ?? "Not authenticated.");
          setMemberships([]);
          setLoading(false);
        }
        return;
      }

      // Get memberships for the current user
      const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(id, name)")
        .eq("user_id", authData.user.id);

      if (!mounted) return;

      if (error) {
        setErr(error.message);
        setMemberships([]);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Membership[];
      setMemberships(rows);

      // If exactly one company, jump straight in
      if (rows.length === 1) {
        const c = rows[0].companies?.[0];
        if (c?.id) {
          router.replace(`/${c.id}`);
          return;
        }
      }

      setLoading(false);
    }

    run();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  function go(companyId: string) {
    router.push(`/${companyId}`);
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Select Company</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Choose which company workspace you want to open.
      </p>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

      {loading ? (
        <p style={{ marginTop: 14 }}>Loading…</p>
      ) : memberships.length === 0 ? (
        <p style={{ marginTop: 14 }}>No company memberships found.</p>
      ) : (
        <div
          style={{
            marginTop: 14,
            border: "1px solid #eee",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {memberships.map((m, idx) => {
            const c = m.companies?.[0];
            const id = c?.id ?? m.company_id;
            const name = c?.name ?? "Company";

            return (
              <button
                key={`${m.company_id}-${idx}`}
                onClick={() => go(id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: 14,
                  border: "none",
                  background: "white",
                  borderTop: idx === 0 ? "none" : "1px solid #eee",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>{name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{id}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
