"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type Membership = {
  company_id: string;
  companies?: { id: string; name: string };
};

export default function SelectCompanyPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [rows, setRows] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      // Assumes you have companies table with name, and FK relationship set up in Supabase
      const { data, error } = await supabase
        .from("company_users")
        .select("company_id, companies ( id, name )")
        .eq("user_id", user.id);

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      const memberships = (data as Membership[]) ?? [];

      // If exactly one company, jump straight in
      if (memberships.length === 1) {
        router.replace(`/${memberships[0].company_id}`);
        return;
      }

      setRows(memberships);
      setLoading(false);
    })();
  }, [router, supabase]);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Select a company</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Choose which company workspace you want to open.
      </p>

      <div style={{ marginTop: 16 }}>
        <a href="/onboarding/create-company">Create a new company</a>
      </div>

      {loading ? (
        <p style={{ marginTop: 16 }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>
          No companies found. Create a company to continue.
        </p>
      ) : (
        <ul style={{ marginTop: 16, paddingLeft: 18 }}>
          {rows.map((r) => (
            <li key={r.company_id} style={{ marginBottom: 10 }}>
              <button
                onClick={() => router.push(`/${r.company_id}`)}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {r.companies?.name ?? r.company_id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
