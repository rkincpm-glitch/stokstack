"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCompany } from "@/lib/useCompany";
import {
  PlusCircle,
  BarChart3,
  Tag,
  Package,
  DollarSign,
  Grid3X3,
  List,
  Search,
  FileImage,
  ArrowLeft,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  category: string | null;
  location: string | null;
  quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  te_number: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
};

type CategorySummary = {
  category: string;
  itemCount: number;
  totalQty: number;
  totalValue: number;
  thumbnails: string[]; // up to 6
};

const MAX_CATEGORY_THUMBS = 6;

export default function DashboardPage() {
  const router = useRouter();
  const { loading: companyLoading, companyId } = useCompany();

  const [userReady, setUserReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Mobile default = list; desktop default = categories
  const [viewMode, setViewMode] = useState<"categories" | "tiles" | "list">(
    "categories"
  );

  useEffect(() => {
    // detect mobile width once on mount
    if (typeof window !== "undefined") {
      if (window.innerWidth < 640) setViewMode("list");
      else setViewMode("categories");
    }
  }, []);

  useEffect(() => {
    async function init() {
      setError(null);
      setLoading(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }
      setUserReady(true);

      if (companyLoading) return;

      if (!companyId) {
        setError("No company assigned to this user.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("items")
        .select(
          "id,name,description,type,category,location,quantity,image_url,image_url_2,te_number,purchase_price,purchase_date"
        )
        .eq("company_id", companyId)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        console.error(error);
        setError("Failed to load inventory.");
        setItems([]);
      } else {
        setItems((data || []) as Item[]);
      }

      setLoading(false);
    }

    void init();
  }, [router, companyLoading, companyId]);

  const overall = useMemo(() => {
    const totalValue = items.reduce(
      (sum, i) => sum + (i.purchase_price || 0) * i.quantity,
      0
    );
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    const categories = new Set(
      items.map((i) => (i.category || "Uncategorized").trim())
    ).size;

    return { totalValue, totalQty, categories };
  }, [items]);

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = [...items];

    if (selectedCategory) {
      list = list.filter(
        (i) => (i.category || "Uncategorized") === selectedCategory
      );
    }

    if (term) {
      list = list.filter((i) => {
        const hay = `${i.name} ${i.te_number || ""}`.toLowerCase();
        return hay.includes(term);
      });
    }

    return list;
  }, [items, search, selectedCategory]);

  const categorySummaries = useMemo(() => {
    const map = new Map<string, CategorySummary>();

    for (const it of items) {
      const cat = (it.category || "Uncategorized").trim();
      if (!map.has(cat)) {
        map.set(cat, {
          category: cat,
          itemCount: 0,
          totalQty: 0,
          totalValue: 0,
          thumbnails: [],
        });
      }
      const s = map.get(cat)!;
      s.itemCount += 1;
      s.totalQty += it.quantity;
      s.totalValue += (it.purchase_price || 0) * it.quantity;

      const thumb = it.image_url || it.image_url_2;
      if (thumb && s.thumbnails.length < MAX_CATEGORY_THUMBS) {
        s.thumbnails.push(thumb);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }, [items]);

  const showCategoryTiles = () => {
    setViewMode("tiles");
  };

  const showCategories = () => {
    setSelectedCategory(null);
    setSearch("");
    setViewMode("categories");
  };

  const openCategory = (cat: string) => {
    setSelectedCategory(cat);
    setSearch("");
    setViewMode("tiles"); // click category shows tiles
  };

  if (!userReady || companyLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        No company assigned to this user.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Stokstak</p>
              <p className="text-xs text-slate-500">
                Company inventory dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/add-item"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Add Item
            </Link>

            <Link
              href="/reports"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm text-slate-700"
            >
              <BarChart3 className="w-4 h-4" />
              Reports
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* KPI row (rearranged: Total Value, Total Items, Categories) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Value</p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrency(overall.totalValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Based on unit price × qty
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Items</p>
              <p className="text-2xl font-semibold text-slate-900">
                {overall.totalQty}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Sum of all quantities
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Categories</p>
              <p className="text-2xl font-semibold text-slate-900">
                {overall.categories}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Grouped reporting view
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-xl">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </section>

        {/* Toolbar */}
        <section className="bg-white border rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {selectedCategory ? (
              <button
                type="button"
                onClick={showCategories}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                All Categories
              </button>
            ) : (
              <p className="text-sm font-semibold text-slate-900">
                {viewMode === "categories"
                  ? "Browse by Category"
                  : "Inventory"}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search (applies in tiles/list views) */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search item name or TE#"
                className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode("categories")}
                className={[
                  "px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-2",
                  viewMode === "categories"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "hover:bg-slate-50",
                ].join(" ")}
              >
                <Grid3X3 className="w-4 h-4" />
                Categories
              </button>

              <button
                type="button"
                onClick={showCategoryTiles}
                className={[
                  "px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-2",
                  viewMode === "tiles"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "hover:bg-slate-50",
                ].join(" ")}
              >
                <Grid3X3 className="w-4 h-4" />
                Tiles
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={[
                  "px-3 py-2 rounded-lg border text-sm inline-flex items-center gap-2",
                  viewMode === "list"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "hover:bg-slate-50",
                ].join(" ")}
              >
                <List className="w-4 h-4" />
                List
              </button>
            </div>
          </div>
        </section>

        {/* CATEGORY VIEW (default on desktop) */}
        {viewMode === "categories" && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorySummaries.length === 0 ? (
              <div className="bg-white border rounded-2xl p-6 text-center text-slate-500 sm:col-span-2 lg:col-span-3">
                No items yet. Add your first item.
              </div>
            ) : (
              categorySummaries.map((c) => (
                <button
                  key={c.category}
                  onClick={() => openCategory(c.category)}
                  className="text-left bg-white border rounded-2xl p-4 hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {c.category}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.itemCount} items • Qty {c.totalQty}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(c.totalValue)}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-6 gap-1">
                    {Array.from({ length: MAX_CATEGORY_THUMBS }).map((_, idx) => {
                      const url = c.thumbnails[idx] || null;
                      return (
                        <div
                          key={idx}
                          className="aspect-square rounded-lg border bg-slate-50 overflow-hidden flex items-center justify-center"
                        >
                          {url ? (
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <FileImage className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              ))
            )}
          </section>
        )}

        {/* TILES VIEW (like your existing main page tiles, but filtered by category if selected) */}
        {viewMode === "tiles" && (
          <section>
            {selectedCategory && (
              <div className="mb-3">
                <p className="text-sm text-slate-600">
                  Category:{" "}
                  <span className="font-semibold text-slate-900">
                    {selectedCategory}
                  </span>
                </p>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="bg-white border rounded-2xl p-6 text-center text-slate-500">
                No items match your filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((it) => {
                  const img = it.image_url || it.image_url_2;
                  const total = (it.purchase_price || 0) * it.quantity;

                  return (
                    <div
                      key={it.id}
                      className="bg-white border rounded-2xl overflow-hidden hover:shadow-sm transition"
                    >
                      <div className="aspect-[4/3] bg-slate-50 overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt={it.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileImage className="w-10 h-10 text-slate-300" />
                        )}
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 line-clamp-1">
                              {it.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {it.category || "Uncategorized"} •{" "}
                              {it.location || "Unspecified"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              Qty {it.quantity}
                            </p>
                            <p className="text-xs text-slate-500">
                              {total ? formatCurrency(total) : ""}
                            </p>
                          </div>
                        </div>

                        {it.te_number && (
                          <p className="text-xs text-slate-500">
                            TE#: {it.te_number}
                          </p>
                        )}

                        {it.description && (
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {it.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* LIST VIEW (default on mobile) */}
        {viewMode === "list" && (
          <section className="bg-white border rounded-2xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Items ({filteredItems.length})
              </p>
              {selectedCategory && (
                <button
                  type="button"
                  onClick={showCategories}
                  className="text-sm text-blue-600 hover:underline"
                >
                  All Categories
                </button>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No items match your filters.
              </div>
            ) : (
              <div className="divide-y">
                {filteredItems.map((it) => {
                  const img = it.image_url || it.image_url_2;
                  return (
                    <div key={it.id} className="p-4 flex gap-3">
                      <div className="w-14 h-14 rounded-xl border bg-slate-50 overflow-hidden flex items-center justify-center">
                        {img ? (
                          <img
                            src={img}
                            alt={it.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FileImage className="w-6 h-6 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {it.name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {it.category || "Uncategorized"} •{" "}
                              {it.location || "Unspecified"}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {it.quantity}
                          </p>
                        </div>

                        {it.te_number && (
                          <p className="text-xs text-slate-500 mt-1">
                            TE#: {it.te_number}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
