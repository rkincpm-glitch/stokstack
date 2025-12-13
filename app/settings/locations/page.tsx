"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { ArrowLeft, Plus, Save, Trash2, X, Search, AlertCircle } from "lucide-react";

type LocationRow = {
  id: string;
  name: string;
  user_id: string | null;
};

export default function LocationsSettingsPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [search, setSearch] = useState("");

  const [newName, setNewName] = useState("");

  // editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth");
      return;
    }
    setUserId(userData.user.id);

    await loadLocations();
    setLoading(false);
  };

  const loadLocations = async () => {
    const { data, error } = await supabase
      .from("locations")
      .select("id, name, user_id")
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setError("Failed to load locations.");
      setRows([]);
      return;
    }

    setRows((data || []) as LocationRow[]);
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.name || "").toLowerCase().includes(term));
  }, [rows, search]);

  const startEdit = (row: LocationRow) => {
    setEditingId(row.id);
    setEditingName(row.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setError("Name cannot be blank.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("locations")
      .update({ name })
      .eq("id", editingId);

    if (error) {
      console.error(error);
      setError("Failed to update location.");
      setSaving(false);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.id === editingId ? { ...r, name } : r))
    );
    cancelEdit();
    setSaving(false);
  };

  const addLocation = async () => {
    if (!userId) return;
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setError(null);

    const { data, error } = await supabase
      .from("locations")
      .insert({ name, user_id: userId })
      .select("id, name, user_id")
      .single();

    if (error || !data) {
      console.error(error);
      setError("Failed to add location.");
      setSaving(false);
      return;
    }

    setRows((prev) => {
      const next = [...prev, data as LocationRow];
      next.sort((a, b) => a.name.localeCompare(b.name));
      return next;
    });
    setNewName("");
    setSaving(false);
  };

  const deleteLocation = async (row: LocationRow) => {
    const ok = confirm(`Delete location "${row.name}"? This cannot be undone.`);
    if (!ok) return;

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("locations").delete().eq("id", row.id);

    if (error) {
      console.error(error);
      setError("Failed to delete location.");
      setSaving(false);
      return;
    }

    setRows((prev) => prev.filter((r) => r.id !== row.id));
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading locations...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/add-item"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Add Item
          </Link>

          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">Locations</p>
            <p className="text-xs text-slate-500">Add, rename, delete</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Add */}
        <div className="bg-white border rounded-2xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900 mb-3">Add Location</p>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. MER Level, South Tube, Warehouse A"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <button
              type="button"
              onClick={addLocation}
              disabled={saving || !newName.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* List */}
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-900">
              Existing Locations ({rows.length})
            </p>

            <div className="relative sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="divide-y">
            {filtered.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">
                No locations found.
              </div>
            ) : (
              filtered.map((row) => (
                <div key={row.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    {editingId === row.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{row.name}</p>
                    )}
                    <p className="text-xs text-slate-500">
                      {row.user_id ? "User-created" : "Shared"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {editingId === row.id ? (
                      <>
                        <button
                          type="button"
                          onClick={saveEdit}
                          disabled={saving || !editingName.trim()}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLocation(row)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
