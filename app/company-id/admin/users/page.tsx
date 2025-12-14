"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type ProfileRow = {
  email: string | null;
  full_name: string | null;
};

type CompanyUserRow = {
  user_id: string;
  role: string;
  profiles: ProfileRow[] | null; // ← MUST be array
};

const ROLES = ["owner", "admin", "manager", "member", "viewer"] as const;

export default function CompanyUsersAdminPage({
  params,
}: {
  params: { companyId: string };
}) {
  const companyId = params.companyId;
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [rows, setRows] = useState<CompanyUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Add existing user
  const [emailToAdd, setEmailToAdd] = useState("");
  const [roleToAdd, setRoleToAdd] = useState<string>("member");

  // Invite new user
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("member");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  async function load() {
    setErr(null);
    setLoading(true);

    const { data, error } = await supabase
      .from("company_users")
      .select("user_id, role, profiles(email, full_name)")
      .eq("company_id", companyId)
      .order("role", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
    } else {
      // data already matches CompanyUserRow shape
      setRows((data ?? []) as CompanyUserRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  async function changeRole(userId: string, newRole: string) {
    setErr(null);
    const { error } = await supabase
      .from("company_users")
      .update({ role: newRole })
      .eq("company_id", companyId)
      .eq("user_id", userId);

    if (error) setErr(error.message);
    else await load();
  }

  async function removeUser(userId: string) {
    setErr(null);
    const ok = confirm("Remove this user from the company?");
    if (!ok) return;

    const { error } = await supabase
      .from("company_users")
      .delete()
      .eq("company_id", companyId)
      .eq("user_id", userId);

    if (error) setErr(error.message);
    else await load();
  }

  async function addExistingByEmail() {
    setErr(null);
    const email = emailToAdd.trim().toLowerCase();
    if (!email) return;

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, email")
      .ilike("email", email)
      .maybeSingle();

    if (profErr) {
      setErr(profErr.message);
      return;
    }

    if (!prof?.id) {
      setErr("No existing user found with that email. Use Invite instead.");
      return;
    }

    const { error: insErr } = await supabase.from("company_users").insert({
      company_id: companyId,
      user_id: prof.id,
      role: roleToAdd,
    });

    if (insErr) {
      setErr(insErr.message);
      return;
    }

    setEmailToAdd("");
    setRoleToAdd("member");
    await load();
  }

  async function inviteNewUser() {
    setInviteMsg(null);
    setErr(null);

    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    const res = await fetch("/api/admin/invite-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        company_id: companyId, // ← FIXED
        role: inviteRole,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setErr(json?.error ?? "Invite failed");
      return;
    }

    setInviteMsg("Invite sent. The user will be added to this company.");
    setInviteEmail("");
    setInviteRole("member");
    await load();
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Company Users</h1>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
      {inviteMsg && <p style={{ marginTop: 12, color: "green" }}>{inviteMsg}</p>}

      <div style={{ marginTop: 18 }}>
        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No users yet.</p>
        ) : (
          rows.map((r) => {
            const profile = r.profiles?.[0];
            return (
              <div key={r.user_id} style={{ padding: 12, borderBottom: "1px solid #eee" }}>
                <div style={{ fontWeight: 700 }}>
                  {profile?.full_name ?? profile?.email ?? r.user_id}
                </div>
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  {profile?.email ?? ""}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
