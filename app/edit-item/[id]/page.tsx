"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
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
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;

  // these are your UI “canonical” fields (what your inputs bind to)
  category: string | null;
  location: string | null;
  te_number: string | null;

  quantity: number;

  image_url: string | null;
  image_url_2: string | null;

  purchase_price?: number | null;
  purchase_date?: string | null;

  user_id: string | null;
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
};

/**
 * The root cause of your problem is almost always one of these:
 * - DB columns are camelCase (teNumber) but UI expects snake_case (te_number)
 * - DB columns are named differently (unit_price vs purchase_price)
 * - DB uses foreign keys (category_id / location_id) but UI uses text fields
 *
 * So we:
 * 1) detect which keys exist on the row returned by Supabase
 * 2) normalize into our UI-friendly Item shape
 * 3) on save, update using the detected keys (so it persists correctly)
 */
type ItemKeyMap = {
  categoryKey: string;
  locationKey: string;
  teKey: string;
  priceKey: string;
  dateKey: string;
  image1Key: string;
  image2Key: string;
};

function pickExistingKey(row: Record<string, any>, candidates: string[], fallback: string) {
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, k)) return k;
  }
  return fallback;
}

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [keyMap, setKeyMap] = useState<ItemKeyMap | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) console.error("Auth error:", authError);

      if (!userData?.user) {
        router.push("/auth");
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      // Load profile
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

      const row = itemData as Record<string, any>;

      // Detect DB key names from the row that came back
      const detectedKeyMap: ItemKeyMap = {
        categoryKey: pickExistingKey(row, ["category", "category_name", "category_id"], "category"),
        locationKey: pickExistingKey(row, ["location", "location_name", "location_id"], "location"),
        teKey: pickExistingKey(row, ["te_number", "teNumber", "te_no", "teNo"], "te_number"),
        priceKey: pickExistingKey(row, ["purchase_price", "unit_price", "price", "unitPrice"], "purchase_price"),
        dateKey: pickExistingKey(row, ["purchase_date", "purchaseDate", "date_purchased"], "purchase_date"),
        image1Key: pickExistingKey(row, ["image_url", "imageUrl"], "image_url"),
        image2Key: pickExistingKey(row, ["image_url_2", "imageUrl2", "image_url2"], "image_url_2"),
      };

      setKeyMap(detectedKeyMap);

      // Normalize row into UI shape
      const normalized: Item = {
        id: String(row.id),
        name: row.name ?? "",
        description: row.description ?? null,

        // IMPORTANT: if your DB stores IDs (category_id/location_id), this will show the ID.
        // For human-readable names, you should switch to a join later (categories/locations tables).
        category: row[detectedKeyMap.categoryKey] ?? null,
        location: row[detectedKeyMap.locationKey] ?? null,
        te_number: row[detectedKeyMap.teKey] ?? null,

        quantity: Number(row.quantity ?? 0),

        image_url: row[detectedKeyMap.image1Key] ?? null,
        image_url_2: row[detectedKeyMap.image2Key] ?? null,

        purchase_price:
          row[detectedKeyMap.priceKey] === "" || row[detectedKeyMap.priceKey] == null
            ? null
            : Number(row[detectedKeyMap.priceKey]),
        purchase_date: row[detectedKeyMap.dateKey] ?? null,

        user_id: row.user_id ?? null,
      };

      setItem(normalized);
      setLoading(false);
    };

    if (itemId) void init();
  }, [itemId, router]);

  const handleChange = (field: keyof Item, value: any) => {
    if (!item) return;
    setItem({ ...item, [field]: value });
  };

  const handleSave = async () => {
    if (!item || !keyMap) return;

    setSaving(true);
    setErrorMsg(null);
    setInfoMsg(null);

    // Build payload using detected DB keys (so it persists regardless of schema naming)
    const payload: Record<string, any> = {
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      // always include user_id only if you want to enforce ownership; otherwise omit
      // user_id: item.user_id,
    };

    payload[keyMap.categoryKey] = item.category;
    payload[keyMap.locationKey] = item.location;
    payload[keyMap.teKey] = item.te_number;

    payload[keyMap.image1Key] = item.image_url;
    payload[keyMap.image2Key] = item.image_url_2;

    payload[keyMap.priceKey] = item.purchase_price ?? null;
    payload[keyMap.dateKey] = item.purchase_date ?? null;

    const { error } = await supabase.from("items").update(payload).eq("id", item.id);

    if (error) {
      console.error(error);
      setErrorMsg(`Error saving item. ${error.message ?? ""}`.trim());
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
      setErrorMsg(`Error deleting item. ${error.message ?? ""}`.trim());
      setDeleting(false);
      return;
    }

    router.push("/");
  };

  // Upload a new image for primary/secondary and update state
  const handleImageFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    which: "primary" | "secondary"
  ) => {
    const file = e.target.files?.[0];
    if (!file || !userId || !item) return;

    try {
      setErrorMsg(null);

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

      if (which === "primary") {
        setItem({ ...item, image_url: url });
      } else {
        setItem({ ...item, image_url_2: url });
      }

      // allow uploading same file again by resetting input
      e.target.value = "";
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error while uploading image.");
    }
  };

  const clearImage = (which: "primary" | "secondary") => {
    if (!item) return;
    if (which === "primary") setItem({ ...item, image_url: null });
    else setItem({ ...item, image_url_2: null });
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

        <div className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-6">
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
                onChange={(e) => handleChange("quantity", Number(e.target.value || 0))}
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
                  handleChange("purchase_date", e.target.value === "" ? null : e.target.value)
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

          {/* Photos section */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
              Photos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary photo */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Primary Photo
                </p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {item.image_url ? (
                    <div className="w-full relative group">
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-40 object-cover rounded-lg"
                      />
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
                      <p className="text-xs text-center">
                        Click to upload primary photo
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFileChange(e, "primary")}
                  />
                </label>
                {item.image_url && (
                  <p className="mt-1 text-[10px] text-slate-400 break-all">
                    {item.image_url}
                  </p>
                )}
              </div>

              {/* Secondary photo */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Secondary Photo
                </p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {item.image_url_2 ? (
                    <div className="w-full relative group">
                      <img
                        src={item.image_url_2}
                        alt={`${item.name} secondary`}
                        className="w-full h-40 object-cover rounded-lg"
                      />
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
                      <p className="text-xs text-center">
                        Click to upload secondary photo
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageFileChange(e, "secondary")}
                  />
                </label>
                {item.image_url_2 && (
                  <p className="mt-1 text-[10px] text-slate-400 break-all">
                    {item.image_url_2}
                  </p>
                )}
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Note: Removing a photo here will clear it from the item record when you save.
              Files remain in storage but are no longer linked to this item.
            </p>
          </section>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || deleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
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
        </div>
      </main>
    </div>
  );
}
