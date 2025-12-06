"use client";

import {
  FormEvent,
  useEffect,
  useState,
  ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
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
  CheckCircle2,
} from "lucide-react";

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

export default function AddItemPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  // Stock verification at creation
  const [verifyOnCreate, setVerifyOnCreate] = useState(true);
  const [verifyNotes, setVerifyNotes] = useState("");

  // Category & Location master data (names only)
  const [categories, setCategories] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }

      const currentUserId = userData.user.id;
      setUserId(currentUserId);

      await Promise.all([
        loadCategories(currentUserId),
        loadLocations(currentUserId),
      ]);

      // default purchase date to today
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setLoading(false);
    };

    init();
  }, [router]);

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
        .from("item-images") // bucket name
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

  // Handle selecting category from dropdown, including "Add new"
  const handleCategorySelect = async (value: string) => {
    if (!userId) return;

    // If regular category selected, just set it
    if (value !== ADD_CATEGORY_VALUE) {
      setCategory(value);
      return;
    }

    // Add new category flow
    const newName = window.prompt("Enter new category name:");
    if (!newName || !newName.trim()) {
      // user cancelled or empty -> keep previous selection
      return;
    }

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

    // Update list & select new category
    setCategories((prev) =>
      Array.from(new Set([...prev, trimmed])).sort()
    );
    setCategory(trimmed);
  };

  // Handle selecting location from dropdown, including "Add new"
  const handleLocationSelect = async (value: string) => {
    if (!userId) return;

    if (value !== ADD_LOCATION_VALUE) {
      setLocation(value);
      return;
    }

    const newName = window.prompt("Enter new location name:");
    if (!newName || !newName.trim()) {
      return;
    }

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
    if (!userId) return;

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

      const { data: inserted, error } = await supabase
        .from("items")
        .insert({
          user_id: userId,
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
        .select()
        .single();

      if (error) {
        console.error(error);
        setErrorMsg("Error saving item. Please try again.");
        setSaving(false);
        return;
      }

      const newItem = inserted;

      // Create initial stock verification if selected
      if (verifyOnCreate && newItem?.id) {
        const today = purchaseDate || new Date().toISOString().slice(0, 10);
        const { error: verError } = await supabase
          .from("stock_verifications")
          .insert({
            item_id: newItem.id,
            verified_at: today,
            verified_qty: qty,
            notes: verifyNotes || "Initial stock on creation",
            verified_by: userId,
          });

        if (verError) {
          console.error("Error creating initial verification:", verError);
          // don't block success on this
        }
      }

      setSuccessMsg("Item added successfully.");
      // Reset some fields, but keep category & location (often reused)
      setName("");
      setTeNumber("");
      setDescription("");
      setQuantity("");
      setPurchasePrice("");
      setImageUrl(null);
      setImageUrl2(null);
      setVerifyNotes("");

      // Navigate back to dashboard after a short delay
      setTimeout(() => {
        router.push("/");
      }, 800);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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
            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                New Item
              </p>
              <p className="text-xs text-slate-500">Add to StokStack</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Add Inventory Item
              </h1>
              <p className="text-sm text-slate-500">
                Record tools, equipment and materials with photos, location and
                TE number.
              </p>
            </div>
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
                  placeholder="e.g. Hilti Hammer Drill"
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
                  placeholder="e.g. TE-045"
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
                  placeholder="e.g. 10"
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
                  placeholder="e.g. Used for overhead demolition at MER, 110V, comes with 2 batteries."
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
                    e.g. Power Tools, PPE, Formwork
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
                    e.g. MER Level, North Tube, Container 3
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
                    placeholder="e.g. 250.00"
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
                    value={purchaseDate}
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

          {/* Initial Verification */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              Initial Stock Verification
            </h2>
            <div className="flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <label className="inline-flex items-start gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="mt-[3px]"
                  checked={verifyOnCreate}
                  onChange={(e) => setVerifyOnCreate(e.target.checked)}
                />
                <span>
                  Create a physical stock verification entry with today&apos;s
                  date and the quantity above for audit trail.
                </span>
              </label>
              {verifyOnCreate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="e.g. Counted in MER container"
                      className="w-full px-3 py-1.5 border rounded-lg"
                    />
                  </div>
                </div>
              )}
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
              {saving ? "Saving..." : "Save Item"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
