"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function CreateCompanyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setErr("Company name must be at least 2 characters.");
      return;
    }

    setLoading(true);

    try {
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      const user = userRes?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      // 1) create company
      const { data: company, error: companyErr } = await supabase
        .from("companies")
        .insert({ name: trimmed })
        .select("id")
        .single();

      if (companyErr) throw companyErr;
      if (!company?.id) throw new Error("Company creation failed.");

      // 2) add membership as owner
      const { error: memberErr } = await supabase.from("company_users").insert({
        company_id: company.id,
        user_id: user.id,
        role: "owner",
      });

      if (memberErr) throw memberErr;

      router.replace(`/${company.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Create a company</h1>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 8 }}>
          Company name
        </label>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g., RK Contracting Inc."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
          }}
        />

        {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}

        <button
          disabled={loading}
          type="submit"
          style={{
            marginTop: 14,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
            cursor: "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Creating…" : "Create company"}
        </button>
      </form>
    </div>
  );
}
