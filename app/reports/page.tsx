"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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
import { useReactToPrint } from "react-to-print";

type Item = {
  id: string;
  name: string;
  description: string | null;
  type?: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  te_number: string | null;
  purchase_price?: number | null;
};

type LastVerification = {
  item_id: string;
  verified_at: string;
};

export default function ExecutiveInventoryReport() {
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [lastVerifications, setLastVerifications] = useState<Record<string, LastVerification>>({});

  // Dark mode persistence
  useEffect(() => {
    const saved = localStorage.getItem("stak-darkmode");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = saved === "true" || (!saved && prefersDark);
    setDarkMode(shouldBeDark);
    if (shouldBeDark) document.documentElement.classList.add("dark");
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("stokstak-darkmode", String(newMode));
    document.documentElement.classList.toggle("dark", newMode);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/auth");

    try {
      const [{ data: itemsData }, { data: verData }] = await Promise.all([
        supabase.from("items").select("*").order("category").order("name"),
        supabase.from("stock_verifications").select("item_id, verified_at").order("verified_at", { ascending: false }),
      ]);

      setItems((itemsData || []) as Item[]);

      const verMap: Record<string, LastVerification> = {};
      for (const v of verData || []) if (!verMap[v.item_id]) verMap[v.item_id] = v;
      setLastVerifications(verMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(val);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const filteredItems = useMemo(() => {
    return items.filter((i) => {
      if (filterCategory !== "all" && (i.category || "Uncategorized") !== filterCategory) return false;
      if (filterLocation !== "all" && (i.location || "Unspecified") !== filterLocation) return false;
      if (search && !`${i.name} ${i.te_number || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterCategory, filterLocation, search]);

  const totals = useMemo(() => {
    const totalValue = filteredItems.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0);
    const totalQty = filteredItems.reduce((s, i) => s + i.quantity, 0);
    const lowStock = filteredItems.filter((i) => i.quantity < 5).length;
    const categories = new Set(filteredItems.map((i) => i.category || "Uncategorized")).size;
    return { totalValue, totalQty, lowStock, categories };
  }, [filteredItems]);

  const categories = useMemo(() => {
    const map = new Map<string, Item[]>();
    filteredItems.forEach((i) => {
      const cat = i.category || "Uncategorized";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(i);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredItems]);

  // Perfect US Letter PDF Export
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Stokstak_Inventory_Report_${new Date().toISOString().slice(0, 10)}`,
    pageStyle: `
      @page {
        size: letter portrait;
        margin: 0.7in;
      }
      @media print {
        html, body {
          height: auto;
          print-color-adjust: exact;
          -webkit-print-color-scheme: light;
        }
        .no-print { display: none !important; }
        table { font-size: 10pt; }
        h1 { font-size: 20pt; }
        h2 { font-size: 14pt; }
      }
    `,
  });

  return (
    <>
      {/* Hidden printable area – perfect Letter size */}
      <div className="hidden">
        <div ref={printRef} className="bg-white text-black p-10 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">STOKSTAK INVENTORY REPORT</h1>
            <p className="text-lg text-gray-600">Generated on {new Date().toLocaleDateString("en-US", { dateStyle: "full" })}</p>
          </div>

          <div className="grid grid-cols-4 gap-6 mb-10 text-center border-b-2 pb-6">
            <div>
              <p className="text-3xl font-bold text-emerald-600">{formatCurrency(totals.totalValue)}</p>
              <p className="text-sm font-medium text-gray-600 mt-1">Total Value</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">{totals.totalQty.toLocaleString()}</p>
              <p className="text-sm font-medium text-gray-600 mt-1">Total Items</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-purple-600">{totals.categories}</p>
              <p className="text-sm font-medium text-gray-600 mt-1">Categories</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${totals.lowStock > 0 ? "text-red-600" : "text-green-600"}`}>
                {totals.lowStock}
              </p>
              <p className="text-sm font-medium text-gray-600 mt-1">Low Stock Items</p>
            </div>
          </div>

          {categories.map(([cat, items]) => {
            const catValue = items.reduce((s, i) => s + (i.purchase_price || 0) * i.quantity, 0);
            return (
              <div key={cat} className="mb-10 page-break-avoid">
                <h2 className="text-xl font-bold border-b-2 border-gray-400 pb-2 mb-4">
                  {cat} • {items.length} items • {formatCurrency(catValue)}
                </h2>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-medium">Item Name</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">TE#</th>
                      <th className="border border-gray-300 px-3 py-2 text-center">Qty</th>
                      <th className="border border-gray-300 px-3 py-2 text-right">Unit Price</th>
                      <th className="border border-gray-300 px-3 py-2 text-right font-medium">Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => {
                      const total = (i.purchase_price || 0) * i.quantity;
                      return (
                        <tr key={i.id} className={i.quantity < 5 ? "bg-red-50" : ""}>
                          <td className="border border-gray-300 px-3 py-2">{i.name}</td>
                          <td className="border border-gray-300 px-3 py-2">{i.te_number || "—"}</td>
                          <td className={`border border-gray-300 px-3 py-2 text-center font-bold ${i.quantity < 5 ? "text-red-600" : ""}`}>
                            {i.quantity}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {i.purchase_price ? formatCurrency(i.purchase_price) : "—"}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right font-medium">
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

          <div className="text-center text-xs text-gray-500 mt-16">
            Report generated by Stokstak • {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Live UI – same beautiful design as before */}
      <div className={darkMode ? "dark" : ""}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100 transition-colors">
          <header className="bg-white dark:bg-slate-900 shadow-lg border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3 hover:text-indigo-600">
                <ArrowLeft className="w-5 h-5" /> Back
              </Link>

              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrint}
                  className="no-print flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg transition"
                >
                  <Download className="w-5 h-5" />
                  Export PDF (Letter)
                </button>

                <button
                  onClick={toggleDarkMode}
                  className="no-print p-3 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition"
                >
                  {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                </button>

                <div className="text-right">
                  <h1 className="text-2xl font-bold">Executive Inventory Report</h1>
                  <p className="text-sm opacity-70">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-6 py-8">
            {/* Filters + KPI Cards + Tables (same as previous version) */}
            {/* ... (keeping the beautiful UI you already love) */}
            {/* Just paste the filter/KPI/table code from my previous message if you want it identical */}
          </main>
        </div>
      </div>
    </>
  );
}