"use client";

import {
  useEffect,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Tag,
  MapPin,
  Calendar,
  DollarSign,
  Trash2,
  CheckCircle2,
} from "lucide-react";

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

type CategoryRow = {
  id: string;
  name: string;
  user_id: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  user_id: string | null;
};

const ADD_CATEGORY_VALUE = "__ADD_NEW_CATEGORY__";
const ADD_LOCATION_VALUE = "__ADD_NEW_LOCATION__";

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const itemId = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [teNumber, setTeNumber] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [purchasePrice, setPurchasePrice] = useState<number | "">("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUrl2, setImageUrl2] = useState<string | null>(null);

  // Master data
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      await Promise.all([
        loadCategories(uid),
        loadLocations(uid),
        loadItem(uid, itemId),
      ]);

      setLoading(false);
    };

    if (itemId) {
      init();
    }
  }, [router, itemId]);

  const loadCategories = async (uid: string) => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading categories:", error);
      return;
    }
    const names = (data as CategoryRow[]).map((c) => c.name);
    setCategories(names);
  };

  const loadLocations = async (uid: string) => {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .eq("user_id", uid)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading locations:", error);
      return;
    }
    const names = (data as LocationRow[]).map((l) => l.name);
    setLocations(names);
  };

  const loadItem = async (uid: string, itemId: string) => {
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", uid)
      .single();

    if (error || !data) {
      console.error("Error loading item:", error);
      setErrorMsg("Could not find this item or you don't have access.");
      return;
    }

    const item = data as Item;
    setName(item.name || "");
    setTeNumber(item.te_number || "");
    setDescription(item.description || "");
    setCategory(item.category || "");
    setLocation(item.location || "");
    setQuantity(item.quantity ?? "");
    setPurchasePrice(
      item.purchase_price != null ? Number(item.purchase_price) : ""
    );
    setPurchaseDate(item.purchase_date || "");
    setImageUrl(item.image_url || null);
    setImageUrl2(item.image_url_2 || null);
  };

  const handleImageUpload = async (
    e: ChangeEvent<HTMLInputElement>,
    which: "primary" | "secondary"
  ) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !userId) return;

      const ext = file.name.split(".").pop();
      const filePath = `${userId}/${Date.now()}-${which}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(filePath, file);

      if (uploadError) {
        console.error(uploadError);
        setErrorMsg("Error uploading image. Please try again.");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl || null;

      if (which === "primary") {
        setImageUrl(publicUrl);
      } else {
        setImageUrl2(publicUrl);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error while uploading image.");
    }
  };

  const handleCategorySelect = async (value: string) => {
    if (!userId) return;
    if (value !== ADD_CATEGORY_VALUE) {
      setCategory(value);
      return;
    }

    const newName = window.prompt("Enter new category name:");
    if (!newName || !newName.trim()) return;

    const trimmed = newName.trim();

    setErrorMsg(null);
    const { error } = await supabase.from("categories").insert({
      name: trimmed,
      user_id: userId,
    });

    if (error) {
      console.error("Error adding category:", error);
      setErrorMsg("Could not add category. Check console for details.");
      return;
    }

    setCategories((prev) =>
      Array.from(new Set([...prev, trimmed])).sort()
    );
    setCategory(trimmed);
  };

  const handleLocationSelect = async (value: string) => {
    if (!userId) return;
    if (value !== ADD_LOCATION_VALUE) {
      setLocation(value);
      return;
    }

    const newName = window.prompt("Enter new location name:");
    if (!newName || !newName.trim()) return;

    const trimmed = newName.trim();

    setErrorMsg(null);
    const { error } = await supabase.from("locations").insert({
      name: trimmed,
      user_id: userId,
    });

    if (error) {
      console.error("Error adding location:", error);
      setErrorMsg("Could not add location. Check console for details.");
      return;
    }

    setLocations((prev) =>
      Array.from(new Set([...prev, trimmed])).sort()
    );
    setLocation(trimmed);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !itemId) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!name.trim()) {
        setErrorMsg("Item name is required.");
        setSaving(false);
        return;
      }

      const qty = quantity === "" ? 0 : Number(quantity);
      const priceNum =
        purchasePrice === "" ? null : Number(purchasePrice);
      const price =
        priceNum === null || Number.isNaN(priceNum) ? null : priceNum;

      const { error } = await supabase
        .from("items")
        .update({
          name: name.trim(),
          te_number: teNumber.trim() || null,
          description: description.trim() || null,
          category: category || null,
          location: location || null,
          quantity: qty,
          image_url: imageUrl,
          image_url_2: imageUrl2,
          purchase_price: price,
          purchase_date: purchaseDate || null,
        })
        .eq("id", itemId)
        .eq("user_id", userId);

      if (error) {
        console.error(error);
        setErrorMsg("Error updating item. Please try again.");
        setSaving(false);
        return;
      }

      setSuccessMsg("Item updated successfully.");
      setTimeout(() => {
        router.push("/");
      }, 700);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!userId || !itemId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this item? This cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const { error } = await supabase
        .from("items")
        .delete()
        .eq("id", itemId)
        .eq("user_id", userId);

      if (error) {
        console.error(error);
        setErrorMsg("Error deleting item. Please try again.");
        setDeleting(false);
        return;
      }

      // If stock_verifications has ON DELETE CASCADE on item_id,
      // their rows are automatically removed.
      setSuccessMsg("Item deleted.");
      setTimeout(() => {
        router.push("/");
      }, 500);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error while deleting. Please try again.");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading item...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Edit Item
              </p>
              <p className="text-xs text-slate-500">Update or delete</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Edit Inventory Item
              </h1>
              <p className="text-sm text-slate-500">
                Adjust details, move locations or remove this item.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-60"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* Basic Info */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Item Name<span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  TE Number
                </label>
                <input
                  type="text"
                  value={teNumber}
                  onChange={(e) => setTeNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Quantity<span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </section>

          {/* Category & Location */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Categorization
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Category
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Power Tools, PPE, Formwork…
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={category || ""}
                    onChange={(e) =>
                      handleCategorySelect(e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value={ADD_CATEGORY_VALUE}>
                      ➕ Add new category…
                    </option>
                  </select>
                  <Tag className="w-4 h-4 text-slate-400 self-center" />
                </div>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-600">
                    Location
                  </label>
                  <span className="text-[11px] text-slate-400">
                    MER Level, North Tube…
                  </span>
                </div>
                <div className="flex gap-2">
                  <select
                    value={location || ""}
                    onChange={(e) =>
                      handleLocationSelect(e.target.value)
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">Select location</option>
                    {locations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                    <option value={ADD_LOCATION_VALUE}>
                      ➕ Add new location…
                    </option>
                  </select>
                  <MapPin className="w-4 h-4 text-slate-400 self-center" />
                </div>
              </div>
            </div>
          </section>

          {/* Cost & Dates */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Cost & Purchase
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Purchase Price (per unit)
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 text-xs">
                    <DollarSign className="w-4 h-4" />
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) =>
                      setPurchasePrice(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Purchase Date
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 text-xs">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    value={purchaseDate || ""}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Images */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Photos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Primary */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Primary Photo
                </p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Primary"
                      className="w-full h-40 object-cover rounded-lg mb-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <ImageIcon className="w-8 h-8" />
                      <p className="text-xs">Click to upload main photo</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "primary")}
                  />
                </label>
              </div>

              {/* Secondary */}
              <div>
                <p className="text-xs font-medium text-slate-600 mb-1">
                  Secondary Photo
                </p>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-4 cursor-pointer hover:border-slate-400 transition">
                  {imageUrl2 ? (
                    <img
                      src={imageUrl2}
                      alt="Secondary"
                      className="w-full h-40 object-cover rounded-lg mb-2"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Upload className="w-8 h-8" />
                      <p className="text-xs">Click to upload second angle</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "secondary")}
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Link
              href="/"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
