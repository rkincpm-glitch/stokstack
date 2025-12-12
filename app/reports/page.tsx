"use client";

import { useEffect, useMemo, useState } from "react";
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
  Search,
  Download,
  Moon,
  Sun,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  quantity: number;
  te_number: string | null;
  purchase_price?: number | null;
};

type Verification = {
  item_id: string;
  verified_at: string;
};

export default function ExecutiveInventoryReport() {
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [verifications, setVerifications] = useState<Record<string, Verification>>({});

  // Dark mode with persistence
  useEffect(() => {
    const saved = localStorage.getItem("stokstak-dark");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "true" || (!saved && prefersDark);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("stokstak-dark", String(newMode));
    document.documentElement.classList.toggle("dark", newMode);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/auth");

    const [{ data: itemsData }, { data: verData }] = await Promise.all([
      supabase.from("items").select("id,name,category,location,quantity,te_number,purchase_price"),
      supabase.from("stock_verifications").select("item_id,verified_at").order("verified_at", { ascending: false }),
    ]);

    setItems((itemsData || []) as Item[]);

    const map: Record<string, Verification> = {};
    for (const v of verData || []) if (!map[v.item_id]) map[v.item_id] = v;
    setVerifications(map);

    setLoading(false);
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (filterCategory !== "all" && (i.category || "Uncategorized") !== filterCategory) return false;
      if (filterLocation !== "all" && (i.location || "Unspecified") !== filterLocation) return false;
      if (search && !`${i.name} ${i.te_number || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterCategory, filterLocation, search]);

  const totals = useMemo(() => {
    const value = filtered.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0);
    const qty = filtered.reduce((s, i) => s + i.quantity, 0);
    const low = filtered.filter(i => i.quantity < 5).length;
    const cats = new Set(filtered.map(i => i.category || "Uncategorized")).size;
    return { value, qty, low, cats };
  }, [filtered]);

  const categories = useMemo(() => {
    const map = new Map<string, Item[]>();
    filtered.forEach(i => {
      const c = i.category || "Uncategorized";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(i);
    });
    return Array.from(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Native browser print → perfect US Letter PDF
  const exportPDF = () => {
    window.print();
  };

  return (
    <>
      {/* Printable version – hidden on screen */}
      <div className="print:block hidden">
        <div className="p-12 bg-white text-black max-w-5xl mx-auto">
          <h1 className="text-center text-4xl font-bold mb-4">STOKSTAK INVENTORY REPORT</h1>
          <p className="text-center text-lg mb-10 text-gray-600">
            Generated on {new Date().toLocaleDateString("en-US", { dateStyle: "full" })}
          </p>

          <div className="grid grid-cols-4 gap-8 text-center mb-12">
            <div><p className="text-3xl font-bold text-emerald-600">{formatCurrency(totals.value)}</p>
              <p className="text-sm text-gray-600">Total Value</p>
            </div>
            <div><p className="text-3xl font-bold text-blue-600">{totals.qty.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Items</p>
            </div>
            <div><p className="text-3xl font-bold text-purple-600">{totals.cats}</p>
              <p className="text-sm text-gray-600">Categories</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${totals.low > 0 ? "text-red-600" : "text-green-600"}`}>
                {totals.low}
              </p>
              <p className="text-sm text-gray-600">Low Stock</p>
            </div>
          </div>

          {categories.map(([cat, list]) => {
            const catValue = list.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0);
            return (
              <div key={cat} className="mb-12">
                <h2 className="text-2xl font-bold border-b-2 pb-2 mb-4">
                  {cat} — {list.length} items — {formatCurrency(catValue)}
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">TE#</th>
                      <th className="border border-gray-300 px-4 py-2 text-center">Qty</th>
                      <th className="border border-gray-300 px-4 py-2 text-right">Unit</th>
                      <th className="border border-gray-300 px-4 py-2 text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map(i => {
                      const total = (i.purchase_price || 0) * i.quantity;
                      return (
                        <tr key={i.id} className={i.quantity < 5 ? "bg-red-50" : ""}>
                          <td className="border border-gray-300 px-4 py-2">{i.name}</td>
                          <td className="border border-gray-300 px-4 py-2">{i.te_number || "—"}</td>
                          <td className={`border border-gray-300 px-4 py-2 text-center font-bold ${i.quantity < 5 ? "text-red-600" : ""}`}>
                            {i.quantity}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right">
                            {i.purchase_price ? formatCurrency(i.purchase_price) : "—"}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-right font-medium">
                            {formatCurrency(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          <p className="text-center text-xs text-gray-500 mt-20">
            Generated by Stokstak • {new Date().toLocaleString()}
          </p>
        </div>
      </div>

      {/* Live screen version */}
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100">
          <header className="bg-white dark:bg-slate-900 shadow-lg border-b">
            <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
              <Link href="/" className="flex items-center gap-3">
                <ArrowLeft className="w-5 h-5" /> Back
              </Link>

              <div className="flex items-center gap-4">
                <button
                  onClick={exportPDF}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg transition"
                >
                  <Download className="w-5 h-5" />
                  Export PDF (Letter)
                </button>

                <button
                  onClick={toggleDarkMode}
                  className="p-3 rounded-xl bg-slate-200 dark:bg-slate-700"
                >
                  {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                </button>

                <div className="text-right">
                  <h1 className="text-2xl font-bold">Executive Report</h1>
                  <p className="text-sm opacity-70">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-8">
            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-4 py-3 rounded-xl border dark:bg-slate-700"
                >
                  <option value="all">All Categories</option>
                  {Array.from(new Set(items.map(i => i.category || "Uncategorized"))).sort().map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={filterLocation}
                  onChange={e => setFilterLocation(e.target.value)}
                  className="px-4 py-3 rounded-xl border dark:bg-slate-700"
                >
                  <option value="all">All Locations</option>
                  {Array.from(new Set(items.map(i => i.location || "Unspecified"))).sort().map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search item or TE#..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border dark:bg-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl p-6 shadow-lg">
                <p className="opacity-90">Total Value</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totals.value)}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl p-6 shadow-lg">
                <p className="opacity-90">Items</p>
                <p className="text-3xl font-bold mt-2">{totals.qty.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-2xl p-6 shadow-lg">
                <p className="opacity-90">Categories</p>
                <p className="text-3xl font-bold mt-2">{totals.cats}</p>
              </div>
              <div className={`${totals.low > 0 ? 'bg-gradient-to-br from-orange-500 to-red-600' : 'bg-gradient-to-br from-green-500 to-emerald-600'} text-white rounded-2xl p-6 shadow-lg`}>
                <p className="opacity-90">Low Stock</p>
                <p className="text-3xl font-bold mt-2">{totals.low}</p>
              </div>
            </div>

            {/* Tables */}
            {loading ? (
              <div className="text-center py-20">Loading...</div>
            ) : categories.length === 0 ? (
              <div className="text-center py-20">No items found</div>
            ) : (
              <div className="space-y-8">
                {categories.map(([cat, list]) => {
                  const catVal = list.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0);
                  const catQty = list.reduce((s, i) => s + i.quantity, 0);
                  return (
                    <div key={cat} className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
                      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-8 py-5">
                        <div className="flex justify-between">
                          <h2 className="text-xl font-bold flex items-center gap-3">
                            <Tag className="w-6 h-6" />
                            {cat}
                          </h2>
                          <div className="flex gap-8">
                            <span>Qty: <strong>{catQty.toLocaleString()}</strong></span>
                            <span>Value: <strong>{formatCurrency(catVal)}</strong></span>
                          </div>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                              <th className="px-6 py-3 text-left">Item</th>
                              <th className="px-6 py-3">TE#</th>
                              <th className="px-6 py-3 text-center">Qty</th>
                              <th className="px-6 py-3 text-right">Unit</th>
                              <th className="px-6 py-3 text-right">Total</th>
                              <th className="px-6 py-3 text-center">Last Verified</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y dark:divide-slate-700">
                            {list.map(i => {
                              const total = (i.purchase_price || 0) * i.quantity;
                              const low = i.quantity < 5;
                              return (
                                <tr key={i.id} className={low ? "bg-orange-50 dark:bg-orange-900/20" : ""}>
                                  <td className="px-6 py-3 font-medium">{i.name}</td>
                                  <td className="px-6 py-3">{i.te_number || "—"}</td>
                                  <td className={`px-6 py-3 text-center font-bold ${low ? "text-red-600" : ""}`}>
                                    {i.quantity}
                                  </td>
                                  <td className="px-6 py-3 text-right">
                                    {i.purchase_price ? formatCurrency(i.purchase_price) : "—"}
                                  </td>
                                  <td className="px-6 py-3 text-right font-medium">{formatCurrency(total)}</td>
                                  <td className="px-6 py-3 text-center text-xs">
                                    {verifications[i.id] ? formatDate(verifications[i.id].verified_at) : "Never"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Print styles for perfect Letter PDF */}
      <style jsx global>{`
        @media print {
          @page { size: letter; margin: 0.7in; }
          body { print-color-adjust: exact; -webkit-print-color-scheme: light; }
          .no-print, header, footer { display: none !important; }
        }
      `}</style>
    </>
  );
}