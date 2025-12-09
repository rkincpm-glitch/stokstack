"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, AlertCircle, Loader2 } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  user_id: string | null;
  te_number: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
};

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }

      const userId = userData.user.id;

      // Load profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", userId)
        .maybeSingle();

      if (prof) {
        setProfile({
          id: prof.id,
          role: prof.role || "requester",
          display_name: prof.display_name || null,
        });
      }

      // Load item
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .maybeSingle();

      if (itemError || !itemData) {
        console.error(itemError);
        setErrorMsg("Item could not be found.");
        setItem(null);
        setLoading(false);
        return;
      }

      setItem(itemData as Item);
      setLoading(false);
    };

    if (itemId) {
      init();
    }
  }, [itemId, router]);

  const handleChange = (field: keyof Item, value: any) => {
    if (!item) return;
    setItem({ ...item, [field]: value });
  };

  const handleSave = async () => {
    if (!item) return;

    setSaving(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase
      .from("items")
      .update({
        name: item.name,
        description: item.description,
        category: item.category,
        location: item.location,
        quantity: item.quantity,
        te_number: item.te_number,
        image_url: item.image_url,
        image_url_2: item.image_url_2,
        purchase_price: item.purchase_price,
        purchase_date: item.purchase_date,
      })
      .eq("id", item.id);

    if (error) {
      console.error(error);
      setErrorMsg("Error saving item.");
    } else {
      setInfoMsg("Item updated.");
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (!item || !profile) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${item.name}" from Stokstak? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase.from("items").delete().eq("id", item.id);

    if (error) {
      console.error(error);
      setErrorMsg("Error deleting item.");
      setDeleting(false);
      return;
    }

    // Optionally: also clean up related stock_verifications, links, etc.
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading item...
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-600">
        <p className="mb-4">Item could not be found.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
        >
          Back to Stokstak
        </button>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Edit Item – {item.name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <AlertCircle className="w-4 h-4" />
            <span>{infoMsg}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          {/* Basic fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Name
              </label>
              <input
                type="text"
                value={item.name}
                onChange={(e) => handleChange("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                TE Number
              </label>
              <input
                type="text"
                value={item.te_number || ""}
                onChange={(e) => handleChange("te_number", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Category
              </label>
              <input
                type="text"
                value={item.category || ""}
                onChange={(e) => handleChange("category", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Location
              </label>
              <input
                type="text"
                value={item.location || ""}
                onChange={(e) => handleChange("location", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Quantity
              </label>
              <input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  handleChange("quantity", Number(e.target.value || 0))
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Unit Price
              </label>
              <input
                type="number"
                step="0.01"
                value={item.purchase_price ?? ""}
                onChange={(e) =>
                  handleChange(
                    "purchase_price",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={item.purchase_date || ""}
                onChange={(e) =>
                  handleChange(
                    "purchase_date",
                    e.target.value === "" ? null : e.target.value
                  )
                }
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Description
            </label>
            <textarea
              value={item.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          {/* Image URLs - keep simple text fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Primary Image URL
              </label>
              <input
                type="text"
                value={item.image_url || ""}
                onChange={(e) => handleChange("image_url", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Secondary Image URL
              </label>
              <input
                type="text"
                value={item.image_url_2 || ""}
                onChange={(e) => handleChange("image_url_2", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save changes"}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleting ? "Deleting..." : "Delete item"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
