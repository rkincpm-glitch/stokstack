"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, Save, Trash2, AlertCircle } from "lucide-react";
import { useCompany } from "@/lib/useCompany";

type Row = { id: string; name: string; user_id?: string | null; company_id?: string | null };

async function safeInsert(table: string, payload: any) {
  const first = await supabase.from(table).insert(payload).select("id,name").single();
  if (!first.error) return first;

  const msg = first.error?.message?.toLowerCase() || "";
  if (msg.includes('column "user_id"') || msg.includes("user_id")) {
    const { user_id, ...rest } = payload;
    return await supabase.from(table).insert(rest).select("id,name").single();
  }
  return first;
}

async function safeUpdate(table: string, id: string, payload: any) {
  const first = await supabase.from(table).update(payload).eq("id", id).select("id,name").single();
  if (!first.error) return first;

  const msg = first.error?.message?.toLowerCase() || "";
  if (msg.includes('column "user_id"') || msg.includes("user_id")) {
    const { user_id, ...rest } = payload;
    return await supabase.from(table).update(rest).eq("id", id).select("id,name").single();
  }
  return first;
}

export default function ManageTypesPage() {
  const { loading: companyLoading, companyId } = useCompany();

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [rows]
  );

  useEffect(() => {
    const init = async () => {
      if (companyLoading) return;

      setLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        window.location.href = "/auth";
        return;
      }
      setUserId(userData.user.id);

      if (!companyId) {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("item_types")
        .select("id,name,user_id,company_id")
        .eq("company_id", companyId)
        .order("name");

      if (error) setError(error.message);
      setRows((data || []) as Row[]);
      setLoading(false);
    };

    void init();
  }, [companyLoading, companyId]);

  const add = async () => {
    setError(null);
    if (!newName.trim()) return;
    if (!userId) return;
    if (!companyId) {
      setError("No company assigned to this user.");
      return;
    }

    const payload = { name: newName.trim(), user_id: userId, company_id: companyId };
    const res = await safeInsert("item_types", payload);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setRows((prev) => [res.data as Row, ...prev]);
    setNewName("");
  };

  const update = async (id: string, name: string) => {
    setError(null);
    if (!companyId) {
      setError("No company assigned to this user.");
      return;
    }

    setSavingId(id);

    // Keep server-side safety by scoping update to company_id
    const res = await safeUpdate("item_types", id, { name: name.trim() });
    if (res.error) setError(res.error.message);

    // Extra guard: if you want client-side strictness too, reload list after update
    setSavingId(null);
  };

  const remove = async (id: string) => {
    setError(null);
    if (!companyId) {
      setError("No company assigned to this user.");
      return;
    }

    const ok = confirm("Delete this type? Items will keep the old text unless you update them.");
    if (!ok) return;

    const { error } = await supabase
      .from("item_types")
      .delete()
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      setError(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  if (loading || companyLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading types…</div>;
  }

  if (!companyId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="bg-white border rounded-xl p-4 text-sm text-slate-700 max-w-md w-full">
          No company assigned to this user. Please add this user to a company in{" "}
          <code>company_users</code>.
          <div className="mt-3">
            <Link href="/" className="text-blue-600 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <h1 className="text-sm font-semibold text-slate-900">Manage Types</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white border rounded-2xl p-4">
          <label className="text-sm font-medium text-slate-700">Add new type</label>
          <div className="flex gap-2 mt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg"
              placeholder="e.g. Tool, Equipment, Material"
            />
            <button
              type="button"
              onClick={add}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-semibold text-slate-600 uppercase">Types</div>
          <div className="divide-y">
            {sorted.map((r) => (
              <RowEditor
                key={r.id}
                id={r.id}
                initialName={r.name}
                saving={savingId === r.id}
                onSave={update}
                onDelete={remove}
              />
            ))}
            {sorted.length === 0 && (
              <div className="px-4 py-6 text-sm text-slate-500">No types yet.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function RowEditor({
  id,
  initialName,
  saving,
  onSave,
  onDelete,
}: {
  id: string;
  initialName: string;
  saving: boolean;
  onSave: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div className="px-4 py-3 flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 px-3 py-2 border rounded-lg"
      />
      <button
        type="button"
        onClick={() => onSave(id, name)}
        disabled={saving || !name.trim()}
        className="px-3 py-2 border rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
      >
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => onDelete(id)}
        className="px-3 py-2 border rounded-lg text-sm text-red-600 flex items-center gap-2 hover:bg-red-50"
      >
        <Trash2 className="w-4 h-4" /> Delete
      </button>
    </div>
  );
}
