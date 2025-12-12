"use client";import { useEffect, useMemo, useState, ChangeEvent } from "react";import { useRouter } from "next/navigation";import { supabase } from "@/lib/supabaseClient";import Link from "next/link";import {  ArrowLeft,  BarChart3,  Package,  Tag,  MapPin,  DollarSign,  AlertCircle,  FileImage,  X,  CheckCircle2,  Upload,} from "lucide-react";type Item = {  id: string;  name: string;  description: string | null;  type?: string | null;  category: string | null;  location: string | null;  quantity: number;  image_url: string | null;  image_url_2: string | null;  user_id: string | null;  te_number: string | null;  purchase_price?: number | null;  purchase_date?: string | null;};type CategoryGroup = {  category: string;  totalQty: number;  totalValue: number;  items: Item[];};type LastVerification = {  item_id: string;  verified_at: string; // ISO date  verified_qty: number;  photo_url?: string | null;};export default function ReportsPage() {  const router = useRouter();  const [userId, setUserId] = useState<string | null>(null);  const [items, setItems] = useState<Item[]>([]);  const [groups, setGroups] = useState<CategoryGroup[]>([]);  const [loading, setLoading] = useState(true);  const [errorMsg, setErrorMsg] = useState<string | null>(null);  const [selectedItem, setSelectedItem] = useState<Item | null>(null);  const [lastVerifications, setLastVerifications] = useState<Record<string, LastVerification>  >({});
  // filters  const [filterCategory, setFilterCategory] = useState<string>("all");  const [filterLocation, setFilterLocation] = useState<string>("all");  const [filterType, setFilterType] = useState<string>("all");  const [search, setSearch] = useState<string>("");  // add verification form  const [verDate, setVerDate] = useState<string>(new Date().toISOString().slice(0, 10)  );  const [verQty, setVerQty] = useState<number | "">("");  const [verNotes, setVerNotes] = useState<string>("");  const [verPhotoUrl, setVerPhotoUrl] = useState<string | null>(null);  const [savingVerification, setSavingVerification] = useState(false);  const [verificationError, setVerificationError] = useState<string | null>(null  );  const [verificationSuccess, setVerificationSuccess] = useState<boolean>(false);  useEffect(() => {void loadData();  }, []);  const loadData = async () => {setLoading(true);

setErrorMsg(null);
const { data: userData, error: userError } = await supabase.auth.getUser();

if (userError) {

  console.error(userError);

}
if (!userData?.user) {

  router.push("/auth");

  return;

}

setUserId(userData.user.id);
try {

  const { data: itemsData, error: itemsError } = await supabase

    .from("items")

    .select("*")

    .order("category", { ascending: true })

    .order("name", { ascending: true });
  if (itemsError) {

    console.error(itemsError);

    setErrorMsg("Error loading inventory for reports.");

    setItems([]);

    setGroups([]);

    setLoading(false);

    return;

  }
  const allItems = (itemsData || []) as Item[];

  setItems(allItems);
  const { data: verData, error: verError } = await supabase

    .from("stock_verifications")

    .select("item_id, verified_at, verified_qty, photo_url")

    .order("verified_at", { ascending: false });
  if (verError) {

    console.error("Error loading stock verifications:", verError);

  } else {

    const map: Record<string, LastVerification> = {};

    for (const row of verData || []) {

      const itemId = row.item_id as string;

      if (!map[itemId]) {

        map[itemId] = {

          item_id: itemId,

          verified_at: row.verified_at as string,

          verified_qty: row.verified_qty as number,

          photo_url: (row as any).photo_url ?? null,

        };

      }

    }

    setLastVerifications(map);

  }
  const groupMap = new Map<string, CategoryGroup>();

  for (const it of allItems) {

    const key = it.category || "Uncategorized";

    if (!groupMap.has(key)) {

      groupMap.set(key, {

        category: key,

        totalQty: 0,

        totalValue: 0,

        items: [],

      });

    }

    const g = groupMap.get(key)!;

    const price = it.purchase_price || 0;

    g.totalQty += it.quantity;

    g.totalValue += price * it.quantity;

    g.items.push(it);

  }
  const grouped = Array.from(groupMap.values()).sort((a, b) =>

    a.category.localeCompare(b.category)

  );

  setGroups(grouped);

} catch (err) {

  console.error(err);

  setErrorMsg("Unexpected error while loading reports.");

} finally {

  setLoading(false);

}  };  // options  const categoryOptions = useMemo(() => {const set = new Set<string>();

items.forEach((i) => set.add(i.category || "Uncategorized"));

return Array.from(set).sort();  }, [items]);  const locationOptions = useMemo(() => {const set = new Set<string>();

items.forEach((i) => set.add(i.location || "Unspecified"));

return Array.from(set).sort();  }, [items]);  const typeOptions = useMemo(() => {const set = new Set<string>();

items.forEach((i) => set.add(i.type || "Unspecified"));

return Array.from(set).sort();  }, [items]);  const filteredGroups = useMemo(() => {const groupMap = new Map<string, CategoryGroup>();
const matchesFilters = (it: Item) => {

  if (

    filterCategory !== "all" &&

    (it.category || "Uncategorized") !== filterCategory

  ) {

    return false;

  }

  if (

    filterLocation !== "all" &&

    (it.location || "Unspecified") !== filterLocation

  ) {

    return false;

  }

  if (

    filterType !== "all" &&

    (it.type || "Unspecified") !== filterType

  ) {

    return false;

  }

  if (search.trim()) {

    const term = search.toLowerCase();

    const haystack = `${it.name} ${it.te_number || ""}`.toLowerCase();

    if (!haystack.includes(term)) return false;

  }

  return true;

};
for (const it of items) {

  if (!matchesFilters(it)) continue;
  const key = it.category || "Uncategorized";

  if (!groupMap.has(key)) {

    groupMap.set(key, {

      category: key,

      totalQty: 0,

      totalValue: 0,

      items: [],

    });

  }

  const g = groupMap.get(key)!;

  const price = it.purchase_price || 0;

  g.totalQty += it.quantity;

  g.totalValue += price * it.quantity;

  g.items.push(it);

}
return Array.from(groupMap.values()).sort((a, b) =>

  a.category.localeCompare(b.category)

);  }, [items, filterCategory, filterLocation, filterType, search]);  const overall = {categories: filteredGroups.length,

totalItems: filteredGroups.reduce((sum, g) => sum + g.totalQty, 0),

totalValue: filteredGroups.reduce((sum, g) => sum + g.totalValue, 0),

lowStock: items.filter((i) => i.quantity < 5).length,  };  const formatCurrency = (val: number) => $${val.toFixed(2)};  const getLastVerificationText = (itemId: string) => {const lv = lastVerifications[itemId];

if (!lv) return "No verification on record";

return `Last verified ${lv.verified_at} → Qty ${lv.verified_qty}`;  };  const handleOpenItem = (it: Item) => {setSelectedItem(it);

setVerificationError(null);

setVerificationSuccess(false);

setVerDate(new Date().toISOString().slice(0, 10));

setVerQty(it.quantity);

setVerNotes("");

const lv = lastVerifications[it.id];

setVerPhotoUrl(null);  };  // upload verification photo for this transaction  const uploadVerificationPhoto = async (file: File) => {if (!userId || !selectedItem) return;
try {

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";

  const fileName = `${Date.now()}-ver-${selectedItem.id}.${ext}`;

  const path = `${userId}/verifications/${fileName}`;
  const { error: uploadError } = await supabase.storage

    .from("item-images")

    .upload(path, file, { upsert: false });
  if (uploadError) {

    console.error(uploadError);

    setVerificationError("Verification photo upload failed.");

    return;

  }
  const { data } = supabase.storage.from("item-images").getPublicUrl(path);

  const url = data.publicUrl;

  setVerPhotoUrl(url);

} catch (err) {

  console.error(err);

  setVerificationError("Unexpected error uploading verification photo.");

}  };  const handleVerPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {const file = e.target.files?.[0];

if (file) void uploadVerificationPhoto(file);  };  const handleAddVerification = async () => {if (!selectedItem) return;

if (verQty === "" || Number.isNaN(Number(verQty))) {

  setVerificationError("Verified quantity must be a number.");

  return;

}
setSavingVerification(true);

setVerificationError(null);

setVerificationSuccess(false);
try {

  const qtyNum = Number(verQty);
  const verifiedBy = userId;
  const { error } = await supabase.from("stock_verifications").insert({

    item_id: selectedItem.id,

    verified_at: verDate || new Date().toISOString().slice(0, 10),

    verified_qty: qtyNum,

    notes: verNotes.trim() || "Periodic stock verification",

    verified_by: verifiedBy,

    photo_url: verPhotoUrl,

  });
  if (error) {

    console.error("Add verification error:", error);

    setVerificationError("Failed to save verification. Try again.");

    setSavingVerification(false);

    return;

  }
  setLastVerifications((prev) => ({

    ...prev,

    [selectedItem.id]: {

      item_id: selectedItem.id,

      verified_at: verDate || new Date().toISOString().slice(0, 10),

      verified_qty: qtyNum,

      photo_url: verPhotoUrl,

    },

  }));
  setVerificationSuccess(true);

} catch (err) {

  console.error("Add verification unexpected error:", err);

  setVerificationError("Unexpected error. Try again.");

} finally {

  setSavingVerification(false);

}  };  return (<div className="min-h-screen bg-slate-50">

  {/* Header */}

  <header className="bg-white border-b border-slate-200">

    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

      <Link

        href="/"

        className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"

      >

        <ArrowLeft className="w-4 h-4" />

        Back to Stokstak

      </Link>
      <div className="flex items-center gap-2">

        <div className="bg-purple-600 p-2 rounded-lg">

          <BarChart3 className="w-5 h-5 text-white" />

        </div>

        <div>

          <p className="text-sm font-semibold text-slate-900">

            Inventory Reports

          </p>

          <p className="text-xs text-slate-500">

            Category, type, location & verification overview

          </p>

        </div>

      </div>

    </div>

  </header>
  {/* Main */}

  <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

    {errorMsg && (

      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">

        <AlertCircle className="w-4 h-4" />

        <span>{errorMsg}</span>

      </div>

    )}
    {/* Filters */}

    <section className="bg-white border rounded-xl p-4 shadow-sm flex flex-wrap gap-4 items-end">

      <div className="flex flex-col">

        <label className="text-xs font-medium text-slate-600 mb-1">

          Category

        </label>

        <select

          value={filterCategory}

          onChange={(e) => setFilterCategory(e.target.value)}

          className="px-3 py-1.5 border rounded-lg text-sm"

        >

          <option value="all">All</option>

          {categoryOptions.map((cat) => (

            <option key={cat} value={cat}>

              {cat}

            </option>

          ))}

        </select>

      </div>
      <div className="flex flex-col">

        <label className="text-xs font-medium text-slate-600 mb-1">

          Location

        </label>

        <select

          value={filterLocation}

          onChange={(e) => setFilterLocation(e.target.value)}

          className="px-3 py-1.5 border rounded-lg text-sm"

        >

          <option value="all">All</option>

          {locationOptions.map((loc) => (

            <option key={loc} value={loc}>

              {loc}

            </option>

          ))}

        </select>

      </div>
      <div className="flex flex-col">

        <label className="text-xs font-medium text-slate-600 mb-1">

          Type

        </label>

        <select

          value={filterType}

          onChange={(e) => setFilterType(e.target.value)}

          className="px-3 py-1.5 border rounded-lg text-sm"

        >

          <option value="all">All</option>

          {typeOptions.map((t) => (

            <option key={t} value={t}>

              {t}

            </option>

          ))}

        </select>

      </div>
      <div className="flex flex-col flex-1 min-w-[160px]">

        <label className="text-xs font-medium text-slate-600 mb-1">

          Search (name or TE#)

        </label>

        <input

          type="text"

          value={search}

          onChange={(e) => setSearch(e.target.value)}

          placeholder="e.g. Hilti, TE-045"

          className="px-3 py-1.5 border rounded-lg text-sm"

        />

      </div>

    </section>
    {/* Stats */}

    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

      <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">

        <div>

          <p className="text-xs text-slate-500 mb-1">Total Value</p>

          <p className="text-2xl font-semibold">

            {formatCurrency(overall.totalValue)}

          </p>

        </div>

        <div className="bg-emerald-50 p-3 rounded-lg">

          <DollarSign className="w-6 h-6 text-emerald-600" />

        </div>

      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">

        <div>

          <p className="text-xs text-slate-500 mb-1">Total Quantity</p>

          <p className="text-2xl font-semibold">{overall.totalItems}</p>

        </div>

        <div className="bg-blue-50 p-3 rounded-lg">

          <Package className="w-6 h-6 text-blue-600" />

        </div>

      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">

        <div>

          <p className="text-xs text-slate-500 mb-1">Categories</p>

          <p className="text-2xl font-semibold">{overall.categories}</p>

        </div>

        <div className="bg-purple-50 p-3 rounded-lg">

          <Tag className="w-6 h-6 text-purple-600" />

        </div>

      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">

        <div>

          <p className="text-xs text-slate-500 mb-1">Low Stock (< 5)</p>

          <p className="text-2xl font-semibold">{overall.lowStock}</p>

        </div>

        <div className="bg-orange-50 p-3 rounded-lg">

          <AlertCircle className="w-6 h-6 text-orange-600" />

        </div>

      </div>

    </section>
    {/* Groups by category */}

    <section className="space-y-4">

      {loading ? (

        <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">

          Loading report...

        </div>

      ) : filteredGroups.length === 0 ? (

        <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">

          No inventory data matches the current filters.

        </div>

      ) : (

        filteredGroups.map((g) => (

          <div

            key={g.category}

            className="bg-white rounded-2xl shadow-sm border overflow-hidden"

          >

            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50">

              <div className="flex items-center gap-2">

                <Tag className="w-4 h-4 text-purple-500" />

                <h2 className="text-sm font-semibold text-slate-800">

                  {g.category}

                </h2>

              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">

                <span>

                  Qty:{" "}

                  <span className="font-semibold text-slate-800">

                    {g.totalQty}

                  </span>

                </span>

                <span>

                  Value:{" "}

                  <span className="font-semibold text-slate-800">

                    {formatCurrency(g.totalValue)}

                  </span>

                </span>

              </div>

            </div>
            <div className="overflow-x-auto">

              <table className="w-full text-xs">

                <thead className="bg-white border-b">

                  <tr className="text-left text-[11px] text-slate-500">

                    <th className="px-3 py-2">Item</th>

                    <th className="px-3 py-2">Type</th>

                    <th className="px-3 py-2">Location</th>

                    <th className="px-3 py-2">TE#</th>

                    <th className="px-3 py-2 text-right">Qty</th>

                    <th className="px-3 py-2 text-right">Unit Price</th>

                    <th className="px-3 py-2 text-right">Total</th>

                  </tr>

                </thead>

                <tbody>

                  {g.items.map((it) => {

                    const unit = it.purchase_price || 0;

                    const total = unit * it.quantity;

                    const lastVerText = getLastVerificationText(it.id);
                    return (

                      <tr

                        key={it.id}

                        onClick={() => handleOpenItem(it)}

                        className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"

                      >

                        <td className="px-3 py-2 align-top">

                          <div className="flex flex-col gap-0.5">

                            <span className="font-medium text-slate-900">

                              {it.name}

                            </span>

                            <span className="text-[11px] text-slate-500">

                              {lastVerText}

                            </span>

                            {it.description && (

                              <span className="text-[11px] text-slate-400 line-clamp-1">

                                {it.description}

                              </span>

                            )}

                          </div>

                        </td>

                        <td className="px-3 py-2 align-top text-[11px] text-slate-600">

                          {it.type || "Unspecified"}

                        </td>

                        <td className="px-3 py-2 align-top">

                          <div className="inline-flex items-center gap-1 text-slate-600">

                            <MapPin className="w-3 h-3" />

                            <span>{it.location || "-"}</span>

                          </div>

                        </td>

                        <td className="px-3 py-2 align-top text-[11px] text-slate-500">

                          {it.te_number || "-"}

                        </td>

                        <td className="px-3 py-2 align-top text-right">

                          {it.quantity}

                        </td>

                        <td className="px-3 py-2 align-top text-right">

                          {unit ? formatCurrency(unit) : "-"}

                        </td>

                        <td className="px-3 py-2 align-top text-right font-semibold text-slate-900">

                          {total ? formatCurrency(total) : "-"}

                        </td>

                      </tr>

                    );

                  })}

                </tbody>

              </table>

            </div>

          </div>

        ))

      )}

    </section>

  </main>
  {/* Item detail + verification modal */}

  {selectedItem && (

    <div

      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"

      onClick={() => setSelectedItem(null)}

    >

      <div

        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"

        onClick={(e) => e.stopPropagation()}

      >

        <div className="flex items-center justify-between px-5 py-3 border-b bg-white sticky top-0 z-10">

          <div>

            <h2 className="text-sm font-semibold text-slate-900">

              {selectedItem.name}

            </h2>

            <p className="text-[11px] text-slate-500">

              TE#: {selectedItem.te_number || "-"}

            </p>

            <p className="text-[11px] text-slate-500">

              {getLastVerificationText(selectedItem.id)}

            </p>

          </div>

          <button

            onClick={() => setSelectedItem(null)}

            className="p-2 rounded-lg hover:bg-slate-100"

          >

            <X className="w-4 h-4 text-slate-600" />

          </button>

        </div>
        <div className="p-5 space-y-4">

          {/* Photos */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>

              <p className="text-[11px] font-semibold text-slate-500 mb-1 uppercase">

                Primary Photo

              </p>

              <div className="aspect-square rounded-xl border bg-slate-50 overflow-hidden flex items-center justify-center">

                {selectedItem.image_url ? (

                  <img

                    src={selectedItem.image_url}

                    alt={selectedItem.name}

                    className="w-full h-full object-cover"

                  />

                ) : (

                  <FileImage className="w-10 h-10 text-slate-300" />

                )}

              </div>

            </div>

            <div>

              <p className="text-[11px] font-semibold text-slate-500 mb-1 uppercase">

                Secondary Photo

              </p>

              <div className="aspect-square rounded-xl border bg-slate-50 overflow-hidden flex items-center justify-center">

                {selectedItem.image_url_2 ? (

                  <img

                    src={selectedItem.image_url_2}

                    alt={`${selectedItem.name} (2)`}

                    className="w-full h-full object-cover"

                  />

                ) : (

                  <FileImage className="w-10 h-10 text-slate-300" />

                )}

              </div>

            </div>

          </div>
          {/* Details */}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4">

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Type

              </p>

              <p className="text-sm font-medium text-slate-900">

                {selectedItem.type || "Unspecified"}

              </p>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Category

              </p>

              <p className="text-sm font-medium text-slate-900">

                {selectedItem.category || "Uncategorized"}

              </p>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Location

              </p>

              <p className="text-sm font-medium text-slate-900">

                {selectedItem.location || "-"}

              </p>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Quantity

              </p>

              <p className="text-lg font-semibold text-slate-900">

                {selectedItem.quantity}

              </p>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Unit Price

              </p>

              <p className="text-lg font-semibold text-slate-900">

                {selectedItem.purchase_price

                  ? formatCurrency(selectedItem.purchase_price)

                  : "$0.00"}

              </p>

            </div>

            <div>

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Purchase Date

              </p>

              <p className="text-sm font-medium text-slate-900">

                {selectedItem.purchase_date || "-"}

              </p>

            </div>

          </div>
          {selectedItem.description && (

            <div className="bg-white rounded-xl border p-4">

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Description

              </p>

              <p className="text-sm text-slate-800">

                {selectedItem.description}

              </p>

            </div>

          )}
          {/* Latest verification photo (if any) */}

          {lastVerifications[selectedItem.id]?.photo_url && (

            <div className="bg-white rounded-xl border p-4">

              <p className="text-[11px] text-slate-500 mb-1 uppercase">

                Latest Verification Photo

              </p>

              <div className="w-full max-w-xs">

                <img

                  src={

                    lastVerifications[selectedItem.id]?.photo_url as string

                  }

                  alt="Latest verification"

                  className="w-full h-auto rounded-lg border"

                />

              </div>

            </div>

          )}
          {/* Add verification block */}

          <div className="bg-white rounded-xl border p-4 space-y-3">

            <p className="text-[11px] text-slate-500 mb-1 uppercase">

              Add Stock Verification

            </p>

            {verificationError && (

              <div className="text-xs text-red-600 flex items-center gap-1">

                <AlertCircle className="w-3 h-3" />

                {verificationError}

              </div>

            )}

            {verificationSuccess && (

              <div className="text-xs text-emerald-600 flex items-center gap-1">

                <CheckCircle2 className="w-3 h-3" />

                Verification saved.

              </div>

            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">

              <div>

                <label className="block text-slate-600 mb-1">

                  Verification Date

                </label>

                <input

                  type="date"

                  value={verDate}

                  onChange={(e) => setVerDate(e.target.value)}

                  className="w-full px-2 py-1.5 border rounded-lg"

                />

              </div>

              <div>

                <label className="block text-slate-600 mb-1">

                  Verified Quantity

                </label>

                <input

                  type="number"

                  value={verQty}

                  onChange={(e) =>

                    setVerQty(

                      e.target.value === "" ? "" : Number(e.target.value)

                    )

                  }

                  className="w-full px-2 py-1.5 border rounded-lg"

                />

              </div>

              <div>

                <label className="block text-slate-600 mb-1">

                  Notes (optional)

                </label>

                <input

                  type="text"

                  value={verNotes}

                  onChange={(e) => setVerNotes(e.target.value)}

                  placeholder="Counted in MER container..."

                  className="w-full px-2 py-1.5 border rounded-lg"

                />

              </div>

            </div>
            {/* Verification photo upload */}

            <div className="mt-3 text-xs">

              <label className="block text-slate-600 mb-1">

                Verification Photo (optional)

              </label>

              <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:border-slate-400">

                <Upload className="w-4 h-4" />

                <span>

                  {verPhotoUrl

                    ? "Change verification photo"

                    : "Upload verification photo"}

                </span>

                <input

                  type="file"

                  accept="image/*"

                  className="hidden"

                  onChange={handleVerPhotoChange}

                />

              </label>

              {verPhotoUrl && (

                <div className="mt-2 max-w-xs">

                  <img

                    src={verPhotoUrl}

                    alt="Verification preview"

                    className="w-full h-auto rounded-md border"

                  />

                </div>

              )}

            </div>
            <div className="flex justify-end mt-3">

              <button

                type="button"

                onClick={handleAddVerification}

                disabled={savingVerification}

                className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"

              >

                <CheckCircle2 className="w-3 h-3" />

                {savingVerification ? "Saving..." : "Save Verification"}

              </button>

            </div>

          </div>

        </div>

      </div>

    </div>

  )}

</div>  );}

