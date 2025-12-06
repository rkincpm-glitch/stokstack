"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  BarChart3,
  Package,
  ArrowLeft,
  AlertCircle,
  Calendar,
  MapPin,
  Tag,
  DollarSign,
  CheckCircle2,
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

type StockVerification = {
  id: string;
  item_id: string;
  verified_at: string; // date string
  verified_qty: number;
  notes: string | null;
  verified_by: string | null;
};

type ItemWithVerification = Item & {
  lastVerifiedAt?: string | null;
  lastVerifiedQty?: number | null;
};

type CategoryGroup = {
  category: string; // "Uncategorized" fallback
  totalQty: number;
  totalValue: number;
  items: ItemWithVerification[];
};

export default function ReportsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Overall stats
  const [totalValue, setTotalValue] = useState(0);
  const [totalQty, setTotalQty] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [neverVerifiedCount, setNeverVerifiedCount] = useState(0);

  // Selected item for popup
  const [selectedItem, setSelectedItem] = useState<ItemWithVerification | null>(
    null
  );
  const [verifications, setVerifications] = useState<StockVerification[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);

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
    const userId = userData.user.id;

    // 1) Load items for this user
    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (itemsError) {
      console.error("Error loading items:", itemsError);
      setErrorMsg("Error loading items for reports.");
      setLoading(false);
      return;
    }

    const itemList = (itemsData || []) as Item[];
    setItems(itemList);

    // 2) Load latest stock verifications for these items
    let verificationMap = new Map<string, StockVerification>();

    if (itemList.length > 0) {
      const itemIds = itemList.map((i) => i.id);

      const { data: verData, error: verError } = await supabase
        .from("stock_verifications")
        .select("id, item_id, verified_at, verified_qty, notes, verified_by")
        .in("item_id", itemIds);

      if (verError) {
        console.error("Error loading verifications:", verError);
        // don't block report, just continue without
      } else if (verData) {
        const list = verData as StockVerification[];

        // Build map: item_id -> latest verification
        for (const v of list) {
          const existing = verificationMap.get(v.item_id);
          if (!existing) {
            verificationMap.set(v.item_id, v);
          } else {
            // compare dates; keep latest
            if (v.verified_at > existing.verified_at) {
              verificationMap.set(v.item_id, v);
            }
          }
        }
      }
    }

    // 3) Attach last verification to items
    const itemsWithVerification: ItemWithVerification[] = itemList.map(
      (it) => {
        const v = verificationMap.get(it.id);
        return {
          ...it,
          lastVerifiedAt: v?.verified_at || null,
          lastVerifiedQty: v?.verified_qty ?? null,
        };
      }
    );

    // 4) Group by category
    const groupMap = new Map<string, CategoryGroup>();

    for (const item of itemsWithVerification) {
      const cat = item.category?.trim() || "Uncategorized";

      if (!groupMap.has(cat)) {
        groupMap.set(cat, {
          category: cat,
          totalQty: 0,
          totalValue: 0,
          items: [],
        });
      }

      const group = groupMap.get(cat)!;
      const qty = item.quantity || 0;
      const valuePerUnit = item.purchase_price || 0;
      group.totalQty += qty;
      group.totalValue += qty * valuePerUnit;
      group.items.push(item);
    }

    const groupList = Array.from(groupMap.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
    setGroups(groupList);

    // 5) Overall stats
    const totalQtyAll = itemsWithVerification.reduce(
      (sum, i) => sum + i.quantity,
      0
    );
    const totalValueAll = itemsWithVerification.reduce(
      (sum, i) => sum + (i.purchase_price || 0) * i.quantity,
      0
    );
    const neverVerified = itemsWithVerification.filter(
      (i) => !i.lastVerifiedAt
    ).length;

    setTotalQty(totalQtyAll);
    setTotalValue(totalValueAll);
    setTotalCategories(groupList.length);
    setNeverVerifiedCount(neverVerified);

    setLoading(false);
  };

  const loadVerificationsForItem = async (itemId: string) => {
    setLoadingVerifications(true);
    const { data, error } = await supabase
      .from("stock_verifications")
      .select("*")
      .eq("item_id", itemId)
      .order("verified_at", { ascending: false });

    if (error) {
      console.error("Error loading verification history:", error);
      setVerifications([]);
    } else {
      setVerifications((data || []) as StockVerification[]);
    }
    setLoadingVerifications(false);
  };

  const handleRowClick = (item: ItemWithVerification) => {
    setSelectedItem(item);
    loadVerificationsForItem(item.id);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setVerifications([]);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 p-2 rounded-lg">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Inventory Reports
              </p>
              <p className="text-xs text-slate-500">
                Grouped by category with stock value
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error */}
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Top Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">
                Total Inventory Value
              </p>
              <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
            </div>
            <div className="bg-emerald-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total Quantity</p>
              <p className="text-2xl font-bold">{totalQty}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Categories</p>
              <p className="text-2xl font-bold">{totalCategories}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">
                Items Never Verified
              </p>
              <p className="text-2xl font-bold">{neverVerifiedCount}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </section>

        {/* Category Groups */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              Category Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Click any line item to view full details.
            </p>
          </div>

          {loading ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">
              Loading reports...
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">
              No items found. Add items first to see reports.
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <div
                  key={group.category}
                  className="bg-white rounded-xl border shadow-sm overflow-hidden"
                >
                  {/* Category header */}
                  <div className="px-4 sm:px-6 py-3 bg-slate-50 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-100 w-9 h-9 rounded-lg flex items-center justify-center">
                        <Tag className="w-4 h-4 text-indigo-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {group.category}
                        </p>
                        <p className="text-xs text-slate-500">
                          {group.items.length} item
                          {group.items.length !== 1 ? "s" : ""} in this category
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="text-slate-500">Total Qty</p>
                        <p className="font-semibold">{group.totalQty}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Total Value</p>
                        <p className="font-semibold">
                          ${group.totalValue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white border-b">
                        <tr className="text-left text-xs text-slate-500">
                          <th className="px-4 sm:px-6 py-2">Item</th>
                          <th className="px-4 sm:px-6 py-2">TE#</th>
                          <th className="px-4 sm:px-6 py-2">Location</th>
                          <th className="px-4 sm:px-6 py-2 text-right">
                            Qty
                          </th>
                          <th className="px-4 sm:px-6 py-2 text-right">
                            Unit Price
                          </th>
                          <th className="px-4 sm:px-6 py-2 text-right">
                            Total
                          </th>
                          <th className="px-4 sm:px-6 py-2 text-right">
                            Last Verified
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const total =
                            (item.purchase_price || 0) * item.quantity;
                          const lowStock = item.quantity < 5;
                          const neverVerified = !item.lastVerifiedAt;

                          return (
                            <tr
                              key={item.id}
                              onClick={() => handleRowClick(item)}
                              className="border-b last:border-0 hover:bg-slate-50 cursor-pointer"
                            >
                              <td className="px-4 sm:px-6 py-2 align-top">
                                <div className="flex flex-col">
                                  <span className="font-medium text-slate-900">
                                    {item.name}
                                  </span>
                                  {item.description && (
                                    <span className="text-xs text-slate-500 line-clamp-2">
                                      {item.description}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-xs text-slate-600">
                                {item.te_number || "-"}
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-xs text-slate-600">
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  <span>{item.location || "-"}</span>
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-right">
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                    lowStock
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-green-100 text-green-700"
                                  }`}
                                >
                                  {item.quantity}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-right text-xs text-slate-700">
                                {item.purchase_price != null
                                  ? `$${item.purchase_price.toFixed(2)}`
                                  : "-"}
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-right text-xs font-semibold text-slate-900">
                                ${total.toFixed(2)}
                              </td>
                              <td className="px-4 sm:px-6 py-2 align-top text-right text-xs">
                                {neverVerified ? (
                                  <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                    <AlertCircle className="w-3 h-3" />
                                    Never
                                  </span>
                                ) : (
                                  <div className="inline-flex flex-col items-end gap-0.5">
                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {item.lastVerifiedAt?.slice(0, 10)}
                                    </span>
                                    {item.lastVerifiedQty != null && (
                                      <span className="text-[10px] text-slate-500">
                                        Verified qty: {item.lastVerifiedQty}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Item Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold">{selectedItem.name}</h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {/* Primary Photo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Primary Photo
                  </label>
                  <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border-2 border-slate-200">
                    {selectedItem.image_url ? (
                      <img
                        src={selectedItem.image_url}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <FileImage className="w-16 h-16 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">
                            No primary photo
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Secondary Photo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Secondary Photo
                  </label>
                  <div className="aspect-square bg-slate-100 rounded-xl overflow-hidden border-2 border-slate-200">
                    {selectedItem.image_url_2 ? (
                      <img
                        src={selectedItem.image_url_2}
                        alt={`${selectedItem.name} (2)`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <FileImage className="w-16 h-16 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">
                            No secondary photo
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity & Price summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Quantity</p>
                    <p className="text-2xl font-bold">
                      {selectedItem.quantity}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Unit Price</p>
                    <p className="text-2xl font-bold">
                      $
                      {selectedItem.purchase_price != null
                        ? selectedItem.purchase_price.toFixed(2)
                        : "0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Total Value</p>
                    <p className="text-2xl font-bold">
                      $
                      {(
                        (selectedItem.purchase_price || 0) *
                        selectedItem.quantity
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Tag className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Category</p>
                    <p className="font-medium">
                      {selectedItem.category || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Location</p>
                    <p className="font-medium">
                      {selectedItem.location || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Package className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">TE Number</p>
                    <p className="font-medium">
                      {selectedItem.te_number || "-"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Purchase Date</p>
                    <p className="font-medium">
                      {selectedItem.purchase_date || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedItem.description && (
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-slate-700">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Verification history */}
              <div className="bg-white rounded-xl p-4 border mb-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Stock Verification History
                  </h3>
                </div>

                {loadingVerifications ? (
                  <p className="text-xs text-slate-500">
                    Loading verification history...
                  </p>
                ) : verifications.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No physical stock verification recorded yet.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">
                            Date
                          </th>
                          <th className="text-left px-3 py-2 font-medium">
                            Qty
                          </th>
                          <th className="text-left px-3 py-2 font-medium">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {verifications.map((v) => (
                          <tr key={v.id} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              {v.verified_at?.slice(0, 10)}
                            </td>
                            <td className="px-3 py-2">{v.verified_qty}</td>
                            <td className="px-3 py-2">
                              {v.notes || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
