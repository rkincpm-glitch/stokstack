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
  role: string;
  is_active: boolean;
};

const ROLE_OPTIONS = [
  "requester",
  "pm",
  "president",
  "purchaser",
  "receiver",
  "admin",
];

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
      // create default requester profile with email as display_name
      const { data: newProf } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "requester",
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
    const anyAdmin = profiles.some((p) => p.role === "admin");

    // 3) Bootstrap: if no admin exists yet, make THIS user admin
    if (!anyAdmin) {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", userId);

      if (!updErr) {
        prof.role = "admin";
        profiles = profiles.map((p) =>
          p.id === userId ? { ...p, role: "admin" } : p
        );
      }
    }

    const currentProfile: ProfileRow = {
      id: prof.id,
      role: prof.role || "requester",
      display_name: prof.display_name || email,
      is_active: prof.is_active ?? true,
    };
    setAuthProfile(currentProfile);

    // If still not admin after bootstrap, no access
    if (currentProfile.role !== "admin") {
      setLoading(false);
      return; // will render "Not authorized"
    }

    const rowsNormalized: ProfileRow[] = profiles.map((p) => ({
      id: p.id,
      role: p.role,
      display_name: p.display_name || p.id,
      is_active: p.is_active ?? true,
    }));

    setRows(rowsNormalized);
    setLoading(false);
  };

  const handleRoleChange = (id: string, role: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, role } : r))
    );
  };

  const handleNameChange = (id: string, name: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, display_name: name } : r))
    );
  };

  const handleToggleActive = async (row: ProfileRow) => {
    // Soft delete / disable
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
        prev.map((r) =>
          r.id === row.id ? { ...r, is_active: next } : r
        )
      );
    } catch (err) {
      console.error(err);
      setErrorMsg("Error updating active status.");
    }
  };

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    // 🔍 1) Check for duplicate display_name (case-insensitive)
    const seen = new Map<string, number>(); // name -> count
    const dups = new Set<string>();

    for (const row of rows) {
      const name = row.display_name?.trim().toLowerCase();
      if (!name) continue;
      const count = (seen.get(name) || 0) + 1;
      seen.set(name, count);
      if (count > 1) {
        dups.add(name);
      }
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

    // 2) Save to Supabase
    try {
      for (const row of rows) {
        await supabase
          .from("profiles")
          .update({
            role: row.role,
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
      return;
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

  if (authProfile.role !== "admin") {
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
              <p className="text-xs text-slate-500">
                Signed in as admin
              </p>
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
                Manage users for StokStack
              </p>
              <p className="text-xs text-slate-500">
                Users sign up via the login page. Admins can then set their
                role, name, and disable or re-enable access here.  
                Display names must be unique to avoid confusion.
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
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const inactive = !row.is_active;
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
                        <select
                          value={row.role}
                          onChange={(e) =>
                            handleRoleChange(row.id, e.target.value)
                          }
                          className={`px-2 py-1 border rounded-lg text-xs ${
                            inactive
                              ? "bg-slate-100 text-slate-400"
                              : "bg-white"
                          }`}
                          disabled={inactive}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(row)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] ${
                            row.is_active
                              ? "bg-red-50 text-red-700 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {row.is_active ? (
                            <>
                              <Ban className="w-3 h-3" />
                              Disable
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
