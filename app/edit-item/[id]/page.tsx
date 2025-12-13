"use client";

import { useEffect, useMemo, useState, ChangeEvent, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  X,
  Settings2,
} from "lucide-react";

const ADD_CATEGORY = "__ADD_CATEGORY__";
const ADD_LOCATION = "__ADD_LOCATION__";
const ADD_TYPE = "__ADD_TYPE__";

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
};

type Category = { id: string; name: string };
type Location = { id: string; name: string };
type ItemType = { id: string; name: string };

type ItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  type: string | null;
  quantity: number | null;
  image_url: string | null;
  image_url_2: string | null;
  te_number: string | null;
  purchase_price: number | string | null;
  purchase_date: string | null;
  user_id: string | null;
};

function coerceParam(v: unknown): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : null;
  return typeof v === "string" ? v : null;
}

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();

  // ✅ Robustly read the dynamic route param, regardless of folder naming
  const itemId = useMemo(() => {
    const p: any = params || {};
    return (
      coerceParam(p.id) ||
      coerceParam(p.itemId) ||
      coerceParam(p.item_id) ||
      null
    );
  }, [params]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    te_number: "", // optional
    description: "",
    type: "",
    category: "", // REQUIRED
    location: "", // REQUIRED
    quantity: 0,
    purchase_price: "" as "" | number,
    purchase_date: "" as "" | string,
    image_url: null as string | null,
    image_url_2: null as string | null,
  });

  const setField = (key: keyof typeof form, value: any) =>
    setForm((p) => ({ ...p, [key]: value }));

  const addMasterItem = async (
    table: "categories" | "locations" | "item_types",
    name: string
  ): Promise<{ id: string; name: string } | null> => {
    if (!userId || !name.trim()) return null;

    const { data, error } = await supabase
      .from(table)
      .insert({ name: name.trim(), user_id: userId })
      .select("id, name")
      .single();

    if (error || !data) {
      console.error(error);
      setErrorMsg(`Failed to add ${table}: ${error?.message ?? ""}`.trim());
      return null;
    }

    const typed = data as { id: string; name: string };

    if (table === "categories") setCategories((prev) => [...prev, typed]);
    if (table === "locations") setLocations((prev) => [...prev, typed]);
    if (table === "item_types") setItemTypes((prev) => [...prev, typed]);

    return typed;
  };

  const handleCategoryChange = async (value: string) => {
    if (value === ADD_CATEGORY) {
      const name = prompt("Enter new category name:");
      if (!name?.trim()) return;
      const added = await addMasterItem("categories", name);
      if (added) setField("category", added.name);
      return;
    }
    setField("category", value);
  };

  const handleLocationChange = async (value: string) => {
    if (value === ADD_LOCATION) {
      const name = prompt("Enter new location name:");
      if (!name?.trim()) return;
      const added = await addMasterItem("locations", name);
      if (added) setField("location", added.name);
      return;
    }
    setField("location", value);
  };

  const handleTypeChange = async (value: string) => {
    if (value === ADD_TYPE) {
      const name = prompt("Enter new type (e.g. Tool, Equipment, Material):");
      if (!name?.trim()) return;
      const added = await addMasterItem("item_types", name);
      if (added) setField("type", added.name);
      return;
    }
    setField("type", value);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);
      setInfoMsg(null);

      // ✅ Stop infinite loading if route param is missing
      if (!itemId) {
        setErrorMsg(
          "Item ID is missing from the URL. Check your route folder name and param (e.g. [id] vs [itemId])."
        );
        setLoading(false);
        return;
      }

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) console.error("Auth error:", authError);

      if (!userData?.user) {
        router.replace("/auth");
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      // profile
      const { data: prof, error: profError } = await supabase
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", uid)
        .maybeSingle();
      if (profError) console.error("Profile load error:", profError);

      if (prof) {
        setProfile({
          id: prof.id,
          role: prof.role || "requester",
          display_name: prof.display_name || null,
        });
      }

      // masters
      const [cats, locs, types] = await Promise.all([
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("locations").select("id, name").order("name"),
        supabase.from("item_types").select("id, name").order("name"),
      ]);

      if (!cats.error && cats.data) setCategories(cats.data as Category[]);
      if (!locs.error && locs.data) setLocations(locs.data as Location[]);
      if (!types.error && types.data) setItemTypes(types.data as ItemType[]);

      // item
      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select(
          "id,name,description,category,location,type,quantity,image_url,image_url_2,te_number,purchase_price,purchase_date,user_id"
        )
        .eq("id", itemId)
        .maybeSingle();

      if (itemError || !itemData) {
        console.error(itemError);
        setErrorMsg(`Item could not be found. ${itemError?.message ?? ""}`.trim());
        setLoading(false);
        return;
      }

      const row = itemData as ItemRow;
      const normalizedPrice =
        row.purchase_price === null || row.purchase_price === ""
          ? ""
          : Number(row.purchase_price);

      setForm({
        name: row.name ?? "",
        te_number: row.te_number ?? "",
        description: row.description ?? "",
        type: row.type ?? "",
        category: row.category ?? "",
        location: row.location ?? "",
        quantity: Number(row.quantity ?? 0),
        purchase_price: Number.isFinite(normalizedPrice as number)
          ? (normalizedPrice as number)
          : "",
        purchase_date: row.purchase_date ?? "",
        image_url: row.image_url ?? null,
        image_url_2: row.image_url_2 ?? null,
      });

      setLoading(false);
    };

    void init();
  }, [itemId, router]);

  const isFormValid =
    form.name.trim().length > 0 &&
    form.category.trim().length > 0 &&
    form.location.trim().length > 0;

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setErrorMsg(null);
    setInfoMsg(null);

    if (!itemId) {
      setErrorMsg("Missing item id.");
      setSaving(false);
      return;
    }

    // Enforce Category + Location (TE optional)
    if (!form.category.trim()) {
      setErrorMsg("Category is required before saving.");
      setSaving(false);
      return;
    }
    if (!form.location.trim()) {
      setErrorMsg("Location is required before saving.");
      setSaving(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      te_number: form.te_number.trim() || null,
      description: form.description.trim() || null,
      type: form.type.trim() || null,
      category: form.category.trim(),
      location: form.location.trim(),
      quantity: Number(form.quantity || 0),
      image_url: form.image_url,
      image_url_2: form.image_url_2,
      purchase_price: form.purchase_price === "" ? null : Number(form.purchase_price),
      purchase_date: form.purchase_date === "" ? null : form.purchase_date,
    };

    const { error } = await supabase.from("items").update(payload).eq("id", itemId);

    if (error) {
      console.error(error);
      setErrorMsg(`Error saving item. ${error.message ?? ""}`.trim());
    } else {
      setInfoMsg("Item updated.");
    }

    setSaving(false);
  };

  const handleDelete = async () => {
    if (profile?.role !== "admin") return;
    if (!itemId) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${form.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { error } = await supabase.from("items").delete().eq("id", itemId);

    if (error) {
      console.error(error);
      setErrorMsg(`Error deleting item. ${error.message ?? ""}`.trim());
      setDeleting(false);
      return;
    }

    router.push("/");
  };

  const handleImageFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    which: "primary" | "secondary"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${which}.${ext}`;
      const path = `${userId}/items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        console.error(uploadError);
        setErrorMsg("Error uploading image. Please try again.");
        return;
      }

      const { data } = supabase.storage.from("item-images").getPublicUrl(path);
      const url = data.publicUrl;

      if (which === "primary") setField("image_url", url);
      else setField("image_url_2", url);

      e.target.value = "";
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error while uploading image.");
    }
  };

  const clearImage = (which: "primary" | "secondary") => {
    if (which === "primary") setField("image_url", null);
    else setField("image_url_2", null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading item...
      </div>
    );
  }

  if (errorMsg && !itemId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-700 px-6">
        <div className="max-w-xl w-full bg-white border rounded-2xl p-5">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p className="font-semibold">Cannot open item</p>
              <p className="text-sm mt-1">{errorMsg}</p>
            </div>
          </div>
          <button
            onClick={() => router.push("/")}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Back to dashboard
          </button>
        </div>
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
          <p className="text-sm font-semibold text-slate-900">Edit Item – {form.name}</p>
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

        <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                TE Number <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="text"
                value={form.te_number}
                onChange={(e) => setField("te_number", e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => void handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select or add...</option>
                {itemTypes.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
                <option value={ADD_TYPE}>+ Add new type...</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-600">
                  Category <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/settings/categories"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage
                </Link>
              </div>
              <select
                value={form.category}
                onChange={(e) => void handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              >
                <option value="">Select or add...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
                <option value={ADD_CATEGORY}>+ Add new category...</option>
              </select>
              {!form.category.trim() && (
                <p className="mt-1 text-[11px] text-red-600">Category is required.</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-600">
                  Location <span className="text-red-500">*</span>
                </label>
                <Link
                  href="/settings/locations"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <Settings2 className="w-3 h-3" /> Manage
                </Link>
              </div>
              <select
                value={form.location}
                onChange={(e) => void handleLocationChange(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              >
                <option value="">Select or add...</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
                <option value={ADD_LOCATION}>+ Add new location...</option>
              </select>
              {!form.location.trim() && (
                <p className="mt-1 text-[11px] text-red-600">Location is required.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Photos</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Primary Photo</p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {form.image_url ? (
                    <div className="w-full relative group">
                      <img src={form.image_url} alt={form.name} className="w-full h-40 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearImage("primary");
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-xs text-center">Click to upload primary photo</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileChange(e, "primary")} />
                </label>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">Secondary Photo</p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {form.image_url_2 ? (
                    <div className="w-full relative group">
                      <img src={form.image_url_2} alt={`${form.name} secondary`} className="w-full h-40 object-cover rounded-lg" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          clearImage("secondary");
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Upload className="w-8 h-8" />
                      <p className="text-xs text-center">Click to upload secondary photo</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageFileChange(e, "secondary")} />
                </label>
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
            <button
              type="submit"
              disabled={saving || deleting || !isFormValid}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving..." : "Save changes"}
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Deleting..." : "Delete item"}
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
