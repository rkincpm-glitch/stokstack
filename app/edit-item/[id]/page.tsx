"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { ArrowLeft, Save, FileImage, Loader2 } from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  te_number: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
};

export default function EditItemPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [teNumber, setTeNumber] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState<number | null>(null);
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUrl2, setImageUrl2] = useState<string | null>(null);

  useEffect(() => {
    loadItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadItem = async () => {
    setLoading(true);
    setErrorMsg(null);

    // ❗ DO NOT filter by user_id here – only by id
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error(error);
      setErrorMsg("Item could not be found.");
      setLoading(false);
      return;
    }

    const item = data as Item;
    setName(item.name);
    setDescription(item.description);
    setCategory(item.category);
    setLocation(item.location);
    setQuantity(item.quantity);
    setTeNumber(item.te_number);
    setPurchasePrice(item.purchase_price);
    setPurchaseDate(item.purchase_date);
    setImageUrl(item.image_url);
    setImageUrl2(item.image_url_2);

    setLoading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from("items")
      .update({
        name,
        description,
        category,
        location,
        quantity,
        te_number: teNumber,
        purchase_price: purchasePrice,
        purchase_date: purchaseDate,
        image_url: imageUrl,
        image_url_2: imageUrl2,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setErrorMsg("Error updating item.");
      setSaving(false);
      return;
    }

    setSaving(false);
    router.push("/");
  };

  const handleImageUpload = async (
    file: File,
    which: "image_url" | "image_url_2"
  ) => {
    const fileExt = file.name.split(".").pop();
    const filePath = `${id}-${which}-${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from("item-images")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error(error);
      alert("Error uploading image");
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("item-images")
      .getPublicUrl(data.path);

    if (which === "image_url") {
      setImageUrl(publicUrlData.publicUrl);
    } else {
      setImageUrl2(publicUrlData.publicUrl);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading item...
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-xl mx-auto px-4 py-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <p className="text-sm text-red-600">{errorMsg}</p>
          </div>
        </main>
      </div>
    );
  }

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
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileImage className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-semibold text-slate-900">
              Edit Item
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-6 space-y-4"
        >
          {errorMsg && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Name
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">
              Description
            </label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={description || ""}
              onChange={(e) =>
                setDescription(e.target.value || null)
              }
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Category
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={category || ""}
                onChange={(e) =>
                  setCategory(e.target.value || null)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Location
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={location || ""}
                onChange={(e) =>
                  setLocation(e.target.value || null)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Quantity
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={quantity}
                onChange={(e) =>
                  setQuantity(Number(e.target.value || 0))
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                TE Number
              </label>
              <input
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={teNumber || ""}
                onChange={(e) =>
                  setTeNumber(e.target.value || null)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Purchase Price
              </label>
              <input
                type="number"
                step="0.01"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={purchasePrice ?? ""}
                onChange={(e) =>
                  setPurchasePrice(
                    e.target.value === ""
                      ? null
                      : Number(e.target.value)
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">
                Purchase Date
              </label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2 text-sm"
                value={purchaseDate || ""}
                onChange={(e) =>
                  setPurchaseDate(e.target.value || null)
                }
              />
            </div>
          </div>

          {/* Images */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Primary */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">
                Primary photo
              </p>
              <div className="aspect-square border rounded-xl flex items-center justify-center overflow-hidden bg-slate-50">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileImage className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0], "image_url");
                  }
                }}
                className="text-xs"
              />
            </div>

            {/* Secondary */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-600">
                Secondary photo
              </p>
              <div className="aspect-square border rounded-xl flex items-center justify-center overflow-hidden bg-slate-50">
                {imageUrl2 ? (
                  <img
                    src={imageUrl2}
                    alt={`${name} 2`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileImage className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleImageUpload(e.target.files[0], "image_url_2");
                  }
                }}
                className="text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save item
              </>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
