"use client";

import { FormEvent, useEffect, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Calendar,
  DollarSign,
  CheckCircle2,
  Settings2,
  X,
} from "lucide-react";

const ADD_CATEGORY = "__ADD_CATEGORY__";
const ADD_LOCATION = "__ADD_LOCATION__";
const ADD_TYPE = "__ADD_TYPE__";

interface Category {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface ItemType {
  id: string;
  name: string;
}

export default function AddItemPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    teNumber: "",
    description: "",
    type: "",
    category: "",
    location: "",
    quantity: "" as number | "",
    purchasePrice: "" as number | "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    verifyOnCreate: true,
    verifyNotes: "",
  });

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUrl2, setImageUrl2] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);

  // photo for initial verification
  const [verifyPhotoUrl, setVerifyPhotoUrl] = useState<string | null>(null);

  // ------------ helpers ------------

  const updateForm = (key: keyof typeof form, value: any) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  // Insert new master record (category/location/type). Shared for all users.
  const addMasterItem = async (
    table: "categories" | "locations" | "item_types",
    name: string
  ): Promise<{ id: string; name: string } | null> => {
    if (!userId || !name.trim()) return null;

    try {
      const { data, error } = await supabase
        .from(table)
        .insert({ name: name.trim(), user_id: userId })
        .select("id, name")
        .single();

      if (error || !data) {
        console.error(`Failed to add ${table}:`, error);
        setError(`Failed to add ${table}.`);
        return null;
      }

      const typedData = data as { id: string; name: string };

      if (table === "categories") {
        setCategories((prev) => [...prev, typedData]);
      } else if (table === "locations") {
        setLocations((prev) => [...prev, typedData]);
      } else {
        setItemTypes((prev) => [...prev, typedData]);
      }

      return typedData;
    } catch (err) {
      console.error(err);
      setError(`Unexpected error adding ${table}.`);
      return null;
    }
  };

  // ------------ load user + master data ------------

  useEffect(() => {
    async function init() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          console.error("Error fetching user:", authError);
        }

        if (!user) {
          router.replace("/auth");
          return;
        }

        setUserId(user.id);

        // shared: no user_id filters
        const [catsResult, locsResult, typesResult] = await Promise.allSettled([
          supabase.from("categories").select("id, name").order("name"),
          supabase.from("locations").select("id, name").order("name"),
          supabase.from("item_types").select("id, name").order("name"),
        ]);

        if (
          catsResult.status === "fulfilled" &&
          !catsResult.value.error &&
          catsResult.value.data
        ) {
          setCategories(catsResult.value.data as Category[]);
        }

        if (
          locsResult.status === "fulfilled" &&
          !locsResult.value.error &&
          locsResult.value.data
        ) {
          setLocations(locsResult.value.data as Location[]);
        }

        if (
          typesResult.status === "fulfilled" &&
          !typesResult.value.error &&
          typesResult.value.data
        ) {
          setItemTypes(typesResult.value.data as ItemType[]);
        }
      } catch (err) {
        console.error("Init error:", err);
        setError("Failed to load initial data.");
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, [router]);

  // ------------ category/location/type change ------------

  const handleCategoryChange = async (value: string) => {
    if (value === ADD_CATEGORY) {
      const name = prompt("Enter new category name:");
      if (!name?.trim()) return;

      const added = await addMasterItem("categories", name);
      if (added) updateForm("category", added.name);
    } else {
      updateForm("category", value);
    }
  };

  const handleLocationChange = async (value: string) => {
    if (value === ADD_LOCATION) {
      const name = prompt("Enter new location name:");
      if (!name?.trim()) return;

      const added = await addMasterItem("locations", name);
      if (added) updateForm("location", added.name);
    } else {
      updateForm("location", value);
    }
  };

  const handleTypeChange = async (value: string) => {
    if (value === ADD_TYPE) {
      const name = prompt("Enter new type (e.g. Tool, Equipment, Material):");
      if (!name?.trim()) return;

      const added = await addMasterItem("item_types", name);
      if (added) updateForm("type", added.name);
    } else {
      updateForm("type", value);
    }
  };

  // ------------ image upload (items) ------------

  const uploadImage = async (file: File, type: "primary" | "secondary") => {
    if (!userId) return;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-${type}.${ext}`;
      const path = `${userId}/items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        console.error(uploadError);
        setError("Image upload failed. Try again.");
        return;
      }

      const { data } = supabase.storage.from("item-images").getPublicUrl(path);
      const url = data.publicUrl;

      if (type === "primary") setImageUrl(url);
      else setImageUrl2(url);
    } catch (err) {
      console.error(err);
      setError("Unexpected error while uploading image.");
    }
  };

  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>,
    type: "primary" | "secondary"
  ) => {
    const file = e.target.files?.[0];
    if (file) void uploadImage(file, type);
  };

  // ------------ image upload (verification photo) ------------

  const uploadVerificationPhoto = async (file: File) => {
    if (!userId) return;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}-verification.${ext}`;
      const path = `${userId}/verifications/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        console.error(uploadError);
        setError("Verification photo upload failed. Try again.");
        return;
      }

      const { data } = supabase.storage.from("item-images").getPublicUrl(path);
      const url = data.publicUrl;
      setVerifyPhotoUrl(url);
    } catch (err) {
      console.error(err);
      setError("Unexpected error while uploading verification photo.");
    }
  };

  const handleVerifyPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadVerificationPhoto(file);
  };

  // ------------ submit ------------

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      if (!form.name.trim()) {
        setError("Item name is required.");
        setSaving(false);
        return;
      }

      if (form.quantity === "" || Number.isNaN(Number(form.quantity))) {
        setError("Quantity must be a number.");
        setSaving(false);
        return;
      }

      const quantityNum = Number(form.quantity);
      if (quantityNum <= 0) {
        setError("Quantity must be a positive number.");
        setSaving(false);
        return;
      }

      const priceNum =
        form.purchasePrice === "" ? null : Number(form.purchasePrice);
      const purchasePrice =
        priceNum !== null && !Number.isNaN(priceNum) && priceNum >= 0
          ? priceNum
          : null;

      const { data: item, error: insertError } = await supabase
        .from("items")
        .insert({
          user_id: userId,
          name: form.name.trim(),
          te_number: form.teNumber.trim() || null,
          description: form.description.trim() || null,
          type: form.type || null,
          category: form.category || null,
          location: form.location || null,
          quantity: quantityNum,
          image_url: imageUrl,
          image_url_2: imageUrl2,
          purchase_price: purchasePrice,
          purchase_date: form.purchaseDate || null,
        })
        .select("id")
        .single();

      if (insertError || !item) {
        console.error("Insert error:", insertError);
        setError("Failed to save item. Please try again.");
        setSaving(false);
        return;
      }

      // Initial verification (with optional photo)
      if (form.verifyOnCreate && item.id) {
        try {
          await supabase.from("stock_verifications").insert({
            item_id: item.id,
            verified_at: new Date().toISOString().slice(0, 10),
            verified_qty: quantityNum,
            notes: form.verifyNotes.trim() || "Initial stock on creation",
            verified_by: userId,
            photo_url: verifyPhotoUrl,
          });
        } catch (verErr) {
          console.error("Verification insert error:", verErr);
        }
      }

      setSuccess(true);
      // Reset some fields, but keep type/category/location for convenience
      setForm((prev) => ({
        ...prev,
        name: "",
        teNumber: "",
        description: "",
        quantity: "",
        purchasePrice: "",
        verifyNotes: "",
      }));
      setImageUrl(null);
      setImageUrl2(null);
      setVerifyPhotoUrl(null);

      setTimeout(() => router.push("/"), 900);
    } catch (err) {
      console.error("Submit error:", err);
      setError("Unexpected error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ------------ render ------------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">New Item</p>
              <p className="text-xs text-slate-500">Add to inventory</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-6 space-y-8"
        >
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Add Inventory Item
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Record tools, equipment, and materials with full details.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Item added successfully! Redirecting...
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Basic Information
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Item Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="e.g. Hilti TE 70 Hammer Drill"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  TE Number
                </label>
                <input
                  type="text"
                  value={form.teNumber}
                  onChange={(e) => updateForm("teNumber", e.target.value)}
                  placeholder="e.g. TE-045"
                  className="w-full px-4 py-2.5 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.quantity}
                  onChange={(e) =>
                    updateForm(
                      "quantity",
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-4 py-2.5 border rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) =>
                    updateForm("description", e.target.value)
                  }
                  placeholder="Condition, specs, accessories..."
                  className="w-full px-4 py-2.5 border rounded-lg"
                />
              </div>
            </div>
          </section>

          {/* Type, Category & Location */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Classification
            </h2>
            <div className="grid gap-5 sm:grid-cols-3">
              {/* Type */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Type
                  </label>
                </div>
                <select
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg"
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

              {/* Category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Category
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
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg"
                >
                  <option value="">Select or add...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value={ADD_CATEGORY}>+ Add new category...</option>
                </select>
              </div>

              {/* Location */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-slate-700">
                    Location
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
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg"
                >
                  <option value="">Select or add...</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                  <option value={ADD_LOCATION}>+ Add new location...</option>
                </select>
              </div>
            </div>
          </section>

          {/* Purchase Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Purchase Details
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Purchase Price (per unit)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">
                    <DollarSign className="w-5 h-5" />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.purchasePrice}
                    onChange={(e) =>
                      updateForm(
                        "purchasePrice",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    placeholder="250.00"
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Purchase Date
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">
                    <Calendar className="w-5 h-5" />
                  </span>
                  <input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) =>
                      updateForm("purchaseDate", e.target.value)
                    }
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Photos
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  url: imageUrl,
                  setUrl: setImageUrl,
                  label: "Primary Photo",
                  type: "primary" as const,
                },
                {
                  url: imageUrl2,
                  setUrl: setImageUrl2,
                  label: "Secondary Photo",
                  type: "secondary" as const,
                },
              ].map(({ url, setUrl, label, type }) => (
                <div key={type}>
                  <p className="text-sm font-medium text-slate-700 mb-2">
                    {label}
                  </p>
                  <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-slate-400 transition">
                    {url ? (
                      <div className="relative group">
                        <img
                          src={url}
                          alt={label}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setUrl(null)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400">
                        {type === "primary" ? (
                          <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                        ) : (
                          <Upload className="w-12 h-12 mx-auto mb-2" />
                        )}
                        <p className="text-sm">Click to upload</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageChange(e, type)}
                    />
                  </label>
                </div>
              ))}
            </div>
          </section>

          {/* Initial Verification */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
              Initial Stock Verification
            </h2>
            <div className="bg-slate-50 border rounded-xl p-4 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.verifyOnCreate}
                  onChange={(e) =>
                    updateForm("verifyOnCreate", e.target.checked)
                  }
                  className="mt-0.5"
                />
                <span className="text-slate-700">
                  Create an initial stock verification record (recommended for
                  audit trail)
                </span>
              </label>

              {form.verifyOnCreate && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={form.verifyNotes}
                      onChange={(e) =>
                        updateForm("verifyNotes", e.target.value)
                      }
                      placeholder="e.g. Physically counted in warehouse"
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Verification Photo (optional)
                    </label>
                    <label className="block border-2 border-dashed border-slate-300 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                      {verifyPhotoUrl ? (
                        <div className="relative group">
                          <img
                            src={verifyPhotoUrl}
                            alt="Verification"
                            className="w-full h-40 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setVerifyPhotoUrl(null)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-center text-slate-400">
                          <Upload className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-xs">
                            Click to upload verification photo
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleVerifyPhotoChange}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-between items-center pt-6 border-t">
            <Link
              href="/"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {saving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
