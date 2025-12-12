"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Search,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  type?: string | null;
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

type LastVerification = {
  item_id: string;
  verified_at: string;
  verified_qty: number;
  photo_url?: string | null;
};

export default function ExecutiveInventoryReport() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [lastVerifications, setLastVerifications] = useState<
    Record<string, LastVerification>
  >({});

  // Filters
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      router.push("/auth");
      return;
    }
    setUserId(userData.user.id);

    try {
      const { data: itemsData } = await supabase
        .from("items")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      const { data: verData } = await supabase
        .from("stock_verifications")
        .select("item_id, verified_at, verified_qty, photo_url")
        .order("verified_at", { ascending: false });

      const allItems = (itemsData || []) as Item[];
      setItems(allItems);

      // Build last verification map
      const verMap: Record<string, LastVerification> = {};
      for (const v of verData || []) {
        if (!verMap[v.item_id]) verMap[v.item_id] = v as LastVerification;
      }
      setLastVerifications(verMap);

      // Group by category
      const groupMap = new Map<string, CategoryGroup>();
      for (const item of allItems) {
        const cat = item.category || "Uncategorized";
        if (!groupMap.has(cat)) {
          groupMap.set(cat, { category: cat, totalQty: 0, totalValue: 0, items: [] });
        }
        const g = groupMap.get(cat)!;
        const price = item.purchase_price || 0;
        g.totalQty += item.quantity;
        g.totalValue += price * item.quantity;
        g.items.push(item);
      }

      const sortedGroups = Array.from(groupMap.values()).sort((a, b) =>
        a.category.localeCompare(b.category)
      );
      setGroups(sortedGroups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Derived data
  const categoryOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.category || "Uncategorized"));
    return Array.from(set).sort();
  }, [items]);

  const locationOptions = useMemo(() => {
    const set = new Set(items.map((i) => i.location || "Unspecified"));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterCategory !== "all" && (item.category || "Uncategorized") !== filterCategory)
        return false;
      if (filterLocation !== "all" && (item.location || "Unspecified") !== filterLocation)
        return false;
      if (search) {
        const term = search.toLowerCase();
        const hay = `${item.name} ${item.te_number || ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [items, filterCategory, filterLocation, search]);

  const totals = useMemo(() => {
    const totalValue = filteredItems.reduce(
      (sum, i) => sum + (i.purchase_price || 0) * i.quantity,
      0
    );
    const totalQty = filteredItems.reduce((sum, i) => sum + i.quantity, 0);
    const lowStock = filteredItems.filter((i) => i.quantity < 5).length;
    const categories = new Set(filteredItems.map((i) => i.category || "Uncategorized")).size;

    return { totalValue, totalQty, lowStock, categories };
  }, [filteredItems]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocale().format("MMM d, yyyy");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <h1 className="text-2xl font-bold text-slate-900">Executive Inventory Report</h1>
              <p className="text-sm text-slate-500">Real-time asset overview • {new Date().toLocaleDateString()}</p>
            </div>
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-3 rounded-xl">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Quick Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Locations</option>
                {locationOptions.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Search Item / TE#</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. Hilti, TE-045..."
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-foreground rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100">Total Inventory Value</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totals.totalValue)}</p>
              </div>
              <DollarSign className="w-10 h-10 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Total Items in Stock</p>
                <p className="text-3xl font-bold mt-2">{totals.totalQty.toLocaleString()}</p>
              </div>
              <Package className="w-10 h-10 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100">Active Categories</p>
                <p className="text-3xl font-bold mt-2">{totals.categories}</p>
              </div>
              <Tag className="w-10 h-10 opacity-80" />
            </div>
          </div>

          <div className={`rounded-2xl p-6 shadow-lg ${totals.lowStock > 0 ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white' : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={totals.lowStock > 0 ? "text-orange-100" : "text-green-100"}>Low Stock Alerts (&lt;5)</p>
                <p className="text-3xl font-bold mt-2">{totals.lowStock}</p>
              </div>
              {totals.lowStock > 0 ? <AlertTriangle className="w-10 h-10 opacity-80" /> : <CheckCircle2 className="w-10 h-10 opacity-80" />}
            </div>
          </div>
        </div>

        {/* Category Tables */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading executive report...</div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20 text-slate-500">No items match current filters.</div>
        ) : (
          <div className="space-y-8">
            {groups
              .filter((g) => {
                if (filterCategory !== "all" && g.category !== filterCategory) return false;
                return g.items.some((i) => filteredItems.includes(i));
              })
              .map((group) => (
                <div key={group.category} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-8 py-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold flex items-center gap-3">
                        <Tag className="w-6 h-6" />
                        {group.category}
                      </h2>
                      <div className="flex gap-8 text-sm">
                        <span>Qty: <strong className="text-xl">{group.totalQty.toLocaleString()}</strong></span>
                        <span>Value: <strong className="text-xl">{formatCurrency(group.totalValue)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b-2 border-slate-200">
                        <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          <th className="px-6 py-4">Item Name</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Location</th>
                          <th className="px-6 py-4">TE#</th>
                          <th className="px-6 py-4 text-center">Qty</th>
                          <th className="px-6 py-4 text-right">Unit Price</th>
                          <th className="px-6 py-4 text-right">Total Value</th>
                          <th className="px-6 py-4 text-center">Last Verified</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {group.items
                          .filter((item) => filteredItems.includes(item))
                          .map((item) => {
                            const unitPrice = item.purchase_price || 0;
                            const total = unitPrice * item.quantity;
                            const lastVer = lastVerifications[item.id];
                            const isLowStock = item.quantity < 5;

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-slate-50 transition-colors ${isLowStock ? 'bg-orange-50' : ''}`}
                              >
                                <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                                <td className="px-6 py-4 text-slate-600">{item.type || "—"}</td>
                                <td className="px-6 py-4">
                                  <span className="flex items-center gap-2 text-slate-600">
                                    <MapPin className="w-4 h-4" />
                                    {item.location || "—"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{item.te_number || "—"}</td>
                                <td className={`px-6 py-4 text-center font-bold ${isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                                  {item.quantity}
                                  {isLowStock && <AlertTriangle className="inline w-4 h-4 ml-2" />}
                                </td>
                                <td className="px-6 py-4 text-right text-slate-700">
                                  {unitPrice > 0 ? formatCurrency(unitPrice) : "—"}
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-slate-900">
                                  {total > 0 ? formatCurrency(total) : "—"}
                                </td>
                                <td className="px-6 py-4 text-center text-xs">
                                  {lastVer ? (
                                    <span className="text-green-700 flex items-center justify-center gap-1">
                                      <CheckCircle2 className="w-4 h-4" />
                                      {formatDate(lastVer.verified_at)}
                                    </span>
                                  ) : (
                                    <span className="text-amber-600">Never</span>
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

        {/* Footer Note */}
        <div className="mt-12 text-center text-sm text-slate-500">
          Report generated on {new Date().toLocaleString()} • Data sourced from Stokstak Supabase backend
        </div>
      </main>
    </div>
  );
}