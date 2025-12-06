"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Users, Save } from "lucide-react";

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
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
      .select("id, role, display_name")
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
        })
        .select()
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
      .select("id, role, display_name, created_at")
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
      role: prof.role,
      display_name: prof.display_name || email,
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

  const handleSave = async () => {
    setSaveStatus("saving");
    setErrorMsg(null);

    try {
      for (const row of rows) {
        await supabase
          .from("profiles")
          .update({
            role: row.role,
            display_name: row.display_name,
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
                User Roles
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-700">
              Assign roles to users. This controls what part of the purchasing
              workflow they see.
            </p>
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.display_name || ""}
                        onChange={(e) =>
                          handleNameChange(row.id, e.target.value)
                        }
                        className="w-full px-2 py-1 border rounded-lg text-xs"
                        placeholder="Name or email"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-[11px] text-slate-500 break-all">
                        {row.id}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.role}
                        onChange={(e) =>
                          handleRoleChange(row.id, e.target.value)
                        }
                        className="px-2 py-1 border rounded-lg text-xs"
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400">
            Roles: <strong>requester</strong> (creates requests),{" "}
            <strong>pm</strong> (project manager approval),{" "}
            <strong>president</strong> (final approval),{" "}
            <strong>purchaser</strong> (buys materials),{" "}
            <strong>receiver</strong> (marks received),{" "}
            <strong>admin</strong> (can manage roles).
          </p>
        </div>
      </main>
    </div>
  );
}
