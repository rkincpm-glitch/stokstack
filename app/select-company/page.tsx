"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Company = {
  id: string;
  name: string;
};

// PostgREST can return nested relations as an array (common) or as an object (depending on relationship).
type CompanyRelation = Company[] | Company | null;

type MembershipRowFromDb = {
  company_id: string;
  companies: CompanyRelation;
};

type Membership = {
  company_id: string;
  company: Company | null;
};

function normalizeCompany(rel: CompanyRelation): Company | null {
  if (!rel) return null;
  if (Array.isArray(rel)) return rel[0] ?? null;
  return rel;
}

export default function SelectCompanyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErr(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        if (!cancelled) {
          setErr(authErr.message);
          setLoading(false);
        }
        return;
      }

      const user = authData?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies(id, name)")
        .eq("user_id", user.id);

      if (error) {
        if (!cancelled) {
          setErr(error.message);
          setMemberships([]);
          setLoading(false);
        }
        return;
      }

      const rows = (data ?? []) as unknown as MembershipRowFromDb[];

      const normalized: Membership[] = rows
        .map((r) => ({
          company_id: String(r.company_id),
          company: normalizeCompany(r.companies),
        }))
        .filter((m) => Boolean(m.company_id));

      // If exactly one company, jump straight in
      if (normalized.length === 1) {
        router.replace(`/${normalized[0].company_id}`);
        return;
      }

      if (!cancelled) {
        setMemberships(normalized);
        setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 980, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Select Company</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        Choose the workspace you want to access.
      </p>

      {err && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            border: "1px solid #f5c2c2",
            background: "#fff5f5",
            borderRadius: 12,
            color: "crimson",
          }}
        >
          {err}
        </div>
      )}

      {memberships.length === 0 ? (
        <div style={{ marginTop: 16, opacity: 0.8 }}>
          No companies found for your user.
        </div>
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
                background: "white",
              }}
            >
              <div style={{ fontWeight: 700 }}>
                {m.company?.name ?? "Company"}
              </div>
              <div style={{ opacity: 0.7, fontSize: 13 }}>{m.company_id}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
