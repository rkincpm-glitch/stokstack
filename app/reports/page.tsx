"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Package,
  Tag,
  MapPin,
  DollarSign,
  AlertCircle,
  FileImage,
  X,
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

type CategoryGroup = {
  category: string;
  totalQty: number;
  totalValue: number;
  items: Item[];
};

export default function ReportsPage() {
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth");
      return;
    }

    // IMPORTANT: no user_id filter here so purchased items show up too
    const { data, error } = await supabase
      .from("items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setErrorMsg("Error loading inventory for reports.");
      setItems([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    const allItems = (data || []) as Item[];
    setItems(allItems);

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
    setLoading(false);
  };

  const overall = {
    categories: groups.length,
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
    totalValue: items.reduce(
      (sum, i) => sum + (i.purchase_price || 0) * i.quantity,
      0
    ),
    lowStock: items.filter((i) => i.quantity < 5).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
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
                Category & location overview
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

        {/* Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Value</p>
              <p className="text-2xl font-semibold">
                ${overall.totalValue.toFixed(2)}
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Items</p>
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
              <p className="text-xs text-slate-500 mb-1">Low Stock (&lt; 5)</p>
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
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">
              No inventory data yet.
            </div>
          ) : (
            groups.map((g) => (
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
                        ${g.totalValue.toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b">
                      <tr className="text-left text-[11px] text-slate-500">
                        <th className="px-3 py-2">Item</th>
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
                        return (
                          <tr
                            key={it.id}
                            onClick={() => setSelectedItem(it)}
                            className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-slate-900">
                                  {it.name}
                                </span>
                                {it.description && (
                                  <span className="text-[11px] text-slate-500 line-clamp-1">
                                    {it.description}
                                  </span>
                                )}
                              </div>
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
                              {unit ? `$${unit.toFixed(2)}` : "-"}
                            </td>
                            <td className="px-3 py-2 align-top text-right font-semibold text-slate-900">
                              {total ? `$${total.toFixed(2)}` : "-"}
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

      {/* Item detail modal for report row click */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
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
                    $
                    {selectedItem.purchase_price
                      ? selectedItem.purchase_price.toFixed(2)
                      : "0.00"}
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
