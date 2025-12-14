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
  profiles: ProfileRow[] | null; // Supabase nested select often returns an array
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
        company_id: companyId, // IMPORTANT: match your API route input
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
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        Manage who can access this company workspace.
      </p>

      {err && <p style={{ marginTop: 12, color: "crimson" }}>{err}</p>}
      {inviteMsg && (
        <p style={{ marginTop: 12, color: "green" }}>{inviteMsg}</p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 14,
          marginTop: 18,
          padding: 14,
          border: "1px solid #eee",
          borderRadius: 12,
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
          Add existing user (already signed up)
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={emailToAdd}
            onChange={(e) => setEmailToAdd(e.target.value)}
            placeholder="user@email.com"
            style={{
              flex: "1 1 260px",
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          />
          <select
            value={roleToAdd}
            onChange={(e) => setRoleToAdd(e.target.value)}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={addExistingByEmail}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Add to company
          </button>
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "10px 0 0" }}>
          Invite new user (not signed up yet)
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="newuser@email.com"
            style={{
              flex: "1 1 260px",
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
            }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            onClick={inviteNewUser}
            style={{
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Send invite
          </button>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Current members</h2>

        {loading ? (
          <p>Loading…</p>
        ) : rows.length === 0 ? (
          <p>No users yet.</p>
        ) : (
          <div
            style={{
              border: "1px solid #eee",
              borderRadius: 12,
              overflow: "hidden",
              marginTop: 10,
            }}
          >
            {rows.map((r, idx) => {
              const profile = r.profiles?.[0];
              return (
                <div
                  key={r.user_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 180px 120px",
                    gap: 10,
                    alignItems: "center",
                    padding: 12,
                    borderTop: idx === 0 ? "none" : "1px solid #eee",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {profile?.full_name ?? profile?.email ?? r.user_id}
                    </div>
                    <div style={{ opacity: 0.75, fontSize: 13 }}>
                      {profile?.email ?? ""}
                    </div>
                  </div>

                  <select
                    value={r.role}
                    onChange={(e) => changeRole(r.user_id, e.target.value)}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 10,
                    }}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => removeUser(r.user_id)}
                    style={{
                      padding: "8px 10px",
                      border: "1px solid #ddd",
                      borderRadius: 10,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
