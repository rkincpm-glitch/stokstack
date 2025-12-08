"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Save,
  Ban,
  RotateCcw,
} from "lucide-react";

type ProfileRow = {
  id: string;
  display_name: string | null;
  roles: string[];   // multi-role
  is_active: boolean;
};

const ALL_ROLES = [
  "requester",
  "pm",
  "president",
  "purchaser",
  "receiver",
  "admin",
];

function parseRoles(value: string | null): string[] {
  if (!value) return ["requester"];
  return value
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

function stringifyRoles(roles: string[]): string {
  // Ensure at least requester
  if (roles.length === 0) return "requester";
  return Array.from(new Set(roles)).join(",");
}

export default function AdminUsersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authProfile, setAuthProfile] = useState<ProfileRow | null>(null);
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSaveStatus("idle");

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth");
      return;
    }

    const userId = userData.user.id;
    const email = userData.user.email || "";

    // 1) Ensure current user has a profile
    let { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("id, role, display_name, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!prof && !profError) {
      const { data: newProf } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "admin", // bootstrap first login as admin
          display_name: email,
          is_active: true,
        })
        .select("id, role, display_name, is_active")
        .single();
      prof = newProf;
    }

    if (!prof) {
      setErrorMsg("Could not load your profile.");
      setLoading(false);
      return;
    }

    // 2) Load all profiles
    const { data: allProfiles, error: allError } = await supabase
      .from("profiles")
      .select("id, role, display_name, is_active, created_at")
      .order("created_at", { ascending: true });

    if (allError) {
      console.error(allError);
      setErrorMsg(`Error loading users: ${allError.message}`);
      setLoading(false);
      return;
    }

    let profiles = allProfiles as any[];
    const anyAdmin = profiles.some((p) =>
      parseRoles(p.role).includes("admin")
    );

    // 3) Bootstrap: if no admin exists yet, make THIS user admin
    if (!anyAdmin) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .where("id", "eq", userId); // some clients don't allow .where; fallback to .eq
      if (!updErr) {
        prof.role = "admin";
        profiles = profiles.map((p) =>
          p.id === userId ? { ...p, role: "admin" } : p
        );
      }
    }

    const currentRoles = parseRoles(prof.role);
    const currentProfile: ProfileRow = {
      id: prof.id,
      roles: currentRoles,
      display_name: prof.display_name || email,
      is_active: prof.is_active ?? true,
    };
    setAuthProfile(currentProfile);

    // If still not admin after bootstrap, no access
    if (!currentRoles.includes("admin")) {
      setLoading(false);
      return;
    }

    const rowsNormalized: ProfileRow[] = profiles.map((p) => ({
      id: p.id,
      roles: parseRoles(p.role),
      display_name: p.display_name || p.id,
      is_active: p.is_active ?? true,
    }));

    setRows(rowsNormalized);
    setLoading(false);
  };

  const toggleRole = (id: string, role: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        let nextRoles = [...r.roles];
        if (nextRoles.includes(role)) {
          nextRoles = nextRoles.filter((rr) => rr !== role);
        } else {
          nextRoles.push(role);
        }
        // Always keep requester if user has no roles
        if (nextRoles.length === 0) nextRoles = ["requester"];
        return { ...r, roles: nextRoles };
      })
    );
  };

  const handleNameChange = (id: string, name: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, display_name: name } : r))
    );
  };

  const handleToggleActive = async (row: ProfileRow) => {
    if (!authProfile) return;
    if (row.id === authProfile.id && row.is_active) {
      setErrorMsg("You cannot disable your own admin account.");
      return;
    }

    const next = !row.is_active;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: next })
        .eq("id", row.id);

      if (error) {
        console.error(error);
        setErrorMsg("Error updating active status.");
        return;
      }

      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r))
      );
    } catch (err) {
      console.error(err);
      setErrorMsg("Error updating active status.");
    }
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    // Ensure unique display_name
    const seen = new Map<string, number>();
    const dups = new Set<string>();

    for (const row of rows) {
      const name = row.display_name?.trim().toLowerCase();
      if (!name) continue;
      const count = (seen.get(name) || 0) + 1;
      seen.set(name, count);
      if (count > 1) dups.add(name);
    }

    if (dups.size > 0) {
      const dupList = Array.from(dups)
        .map((n) => `"${n}"`)
        .join(", ");
      setErrorMsg(
        `Duplicate user names found (${dupList}). Please make each display name unique before saving.`
      );
      setSaveStatus("idle");
      return;
    }

    try {
      for (const row of rows) {
        await supabase
          .from("profiles")
          .update({
            role: stringifyRoles(row.roles),
            display_name: row.display_name,
            is_active: row.is_active,
          })
          .eq("id", row.id);
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setErrorMsg("Error saving changes.");
      setSaveStatus("idle");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading users...
      </div>
    );
  }

  if (!authProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Unable to load profile.
      </div>
    );
  }

  if (!authProfile.roles.includes("admin")) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Link>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
            <p className="text-sm text-slate-700 font-semibold mb-1">
              Not authorized
            </p>
            <p className="text-xs text-slate-500">
              Only admins can manage user roles. Ask your admin to grant you
              access.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-2 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                User Management
              </p>
              <p className="text-xs text-slate-500">Signed in as admin</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-slate-700">
              <p className="font-semibold mb-1">
                Manage users for stokstak
              </p>
              <p className="text-xs text-slate-500">
                Users sign up via the login page. Admins can then assign
                multiple roles like requester, purchaser, receiver, etc.  
                Display names must be unique.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                ? "Saved"
                : "Save changes"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr className="text-xs text-slate-500 text-left">
                  <th className="px-3 py-2">User (name / email)</th>
                  <th className="px-3 py-2">User ID</th>
                  <th className="px-3 py-2">Roles</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const inactive = !row.is_active;
                  const isSelf = row.id === authProfile.id;

                  return (
                    <tr
                      key={row.id}
                      className={`border-b last:border-0 ${
                        inactive ? "bg-slate-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          value={row.display_name || ""}
                          onChange={(e) =>
                            handleNameChange(row.id, e.target.value)
                          }
                          className={`w-full px-2 py-1 border rounded-lg text-xs ${
                            inactive
                              ? "bg-slate-100 text-slate-400"
                              : "bg-white"
                          }`}
                          placeholder="Name or email"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <p className="text-[11px] text-slate-500 break-all">
                          {row.id}
                        </p>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          {ALL_ROLES.map((role) => {
                            const checked = row.roles.includes(role);
                            return (
                              <label
                                key={role}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border cursor-pointer ${
                                  checked
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                    : "bg-white border-slate-200 text-slate-500"
                                } ${
                                  inactive
                                    ? "opacity-60 cursor-not-allowed"
                                    : ""
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="hidden"
                                  checked={checked}
                                  disabled={inactive}
                                  onChange={() => toggleRole(row.id, role)}
                                />
                                <span>{role}</span>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(row)}
                          disabled={isSelf && row.is_active}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] ${
                            row.is_active
                              ? "bg-red-50 text-red-700 hover:bg-red-100 disabled:bg-red-50 disabled:text-red-300"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {row.is_active ? (
                            <>
                              <Ban className="w-3 h-3" />
                              {isSelf ? "Cannot disable self" : "Disable"}
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              Re-enable
                            </>
                          )}
                        </button>
                        {!row.is_active && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Disabled users cannot access the app, but their
                            history is preserved.
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400">
            🔑 <strong>Create users:</strong> they sign up on the login page
            (email/password). A profile is created automatically on first
            login. Admin then assigns roles here.  
            ❌ <strong>Hard delete:</strong> removing auth accounts requires
            a secure backend; use “Disable” instead.
          </p>
        </div>
      </main>
    </div>
  );
}
