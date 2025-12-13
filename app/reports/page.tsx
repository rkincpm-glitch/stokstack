"use client";

import { useEffect, useMemo, useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useCompany } from "@/lib/useCompany";
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
  CheckCircle2,
  Upload,
  TrendingUp,
  Clock,
  FileSpreadsheet,
  FileText,
  Layers,
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
  verified_at: string; // ISO date
  verified_qty: number;
  photo_url?: string | null;
};

const VERIFICATION_STALE_DAYS = 90;

export default function ReportsPage() {
  const router = useRouter();
  const { loading: companyLoading, companyId } = useCompany();

  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [lastVerifications, setLastVerifications] = useState<
    Record<string, LastVerification>
  >({});

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Add verification form
  const [verDate, setVerDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [verQty, setVerQty] = useState<number | "">("");
  const [verNotes, setVerNotes] = useState<string>("");
  const [verPhotoUrl, setVerPhotoUrl] = useState<string | null>(null);
  const [savingVerification, setSavingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [verificationSuccess, setVerificationSuccess] =
    useState<boolean>(false);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLoading, companyId]);

  const loadData = async () => {
    if (companyLoading) return;

    setLoading(true);
    setErrorMsg(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) console.error(userError);

    if (!userData?.user) {
      router.push("/auth");
      return;
    }
    setUserId(userData.user.id);

    if (!companyId) {
      setErrorMsg("No company assigned to this user.");
      setItems([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .eq("company_id", companyId)
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

      // Group all items by category (raw, before filters)
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

      // Last verifications (company scoped)
      const { data: verData, error: verError } = await supabase
        .from("stock_verifications")
        .select("item_id, verified_at, verified_qty, photo_url")
        .eq("company_id", companyId)
        .order("verified_at", { ascending: false });

      if (verError) {
        console.error("Error loading stock verifications:", verError);
      } else {
        const map: Record<string, LastVerification> = {};
        for (const row of (verData || []) as any[]) {
          const itemId = row.item_id as string;
          if (!map[itemId]) {
            map[itemId] = {
              item_id: itemId,
              verified_at: row.verified_at as string,
              verified_qty: row.verified_qty as number,
              photo_url: row.photo_url ?? null,
            };
          }
        }
        setLastVerifications(map);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error while loading reports.");
    } finally {
      setLoading(false);
    }
  };

  // Helpers
  const daysSince = (isoDate: string) => {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

  const getLastVerificationText = (itemId: string) => {
    const lv = lastVerifications[itemId];
    if (!lv) return "No verification on record";
    const days = daysSince(lv.verified_at);
    const ageLabel =
      days <= VERIFICATION_STALE_DAYS
        ? `${days} days ago`
        : `${days} days ago (stale)`;
    return `Last verified ${ageLabel} → Qty ${lv.verified_qty}`;
  };

  const getLastVerificationMeta = (itemId: string) => {
    const lv = lastVerifications[itemId];
    if (!lv) return { date: "", qty: "", age: "" };
    const age = daysSince(lv.verified_at);
    return { date: lv.verified_at, qty: String(lv.verified_qty), age: String(age) };
  };

  // Derived options for filters (from all items)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category || "Uncategorized"));
    return Array.from(set).sort();
  }, [items]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.location || "Unspecified"));
    return Array.from(set).sort();
  }, [items]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.type || "Unspecified"));
    return Array.from(set).sort();
  }, [items]);

  // Filtered groups for the main table
  const filteredGroups = useMemo(() => {
    const groupMap = new Map<string, CategoryGroup>();

    const matchesFilters = (it: Item) => {
      if (filterCategory !== "all" && (it.category || "Uncategorized") !== filterCategory)
        return false;
      if (filterLocation !== "all" && (it.location || "Unspecified") !== filterLocation)
        return false;
      if (filterType !== "all" && (it.type || "Unspecified") !== filterType)
        return false;

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
        groupMap.set(key, { category: key, totalQty: 0, totalValue: 0, items: [] });
      }
      const g = groupMap.get(key)!;
      const price = it.purchase_price || 0;
      g.totalQty += it.quantity;
      g.totalValue += price * it.quantity;
      g.items.push(it);
    }

    return Array.from(groupMap.values()).sort((a, b) => a.category.localeCompare(b.category));
  }, [items, filterCategory, filterLocation, filterType, search]);

  // KPI (rearranged: Total Value, Total Items, Categories)
  const overall = useMemo(() => {
    const totalValue = items.reduce(
      (sum, i) => sum + (i.purchase_price || 0) * i.quantity,
      0
    );
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    const categories = new Set(
      items.map((i) => (i.category || "Uncategorized").trim())
    ).size;

    const avgUnitValue = totalQty > 0 ? totalValue / totalQty : 0;

    return { totalValue, totalQty, categories, avgUnitValue };
  }, [items]);

  // Top categories by value
  const topCategoriesByValue = useMemo(() => {
    const sorted = [...groups].sort((a, b) => b.totalValue - a.totalValue);
    return sorted.slice(0, 5);
  }, [groups]);

  // Top items by value (absolute)
  const topItemsByValue = useMemo(() => {
    const withValue = items.map((i) => ({
      ...i,
      totalValue: (i.purchase_price || 0) * i.quantity,
    }));
    withValue.sort((a, b) => b.totalValue - a.totalValue);
    return withValue.slice(0, 5);
  }, [items]);

  // Verification-stale items
  const staleVerificationItems = useMemo(() => {
    const flagged = items.filter((i) => {
      const lv = lastVerifications[i.id];
      if (!lv) return true;
      const days = daysSince(lv.verified_at);
      return days > VERIFICATION_STALE_DAYS;
    });
    return flagged.slice(0, 5);
  }, [items, lastVerifications]);

  const handleOpenItem = (it: Item) => {
    setSelectedItem(it);
    setVerificationError(null);
    setVerificationSuccess(false);
    setVerDate(new Date().toISOString().slice(0, 10));
    setVerQty(it.quantity);
    setVerNotes("");
    setVerPhotoUrl(null);
  };

  // Upload verification photo for a new verification
  const uploadVerificationPhoto = async (file: File) => {
    if (!userId || !selectedItem) return;

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
      setVerPhotoUrl(data.publicUrl);
    } catch (err) {
      console.error(err);
      setVerificationError("Unexpected error uploading verification photo.");
    }
  };

  const handleVerPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadVerificationPhoto(file);
  };

  const handleAddVerification = async () => {
    if (!selectedItem) return;
    if (!companyId) return;

    if (verQty === "" || Number.isNaN(Number(verQty))) {
      setVerificationError("Verified quantity must be a number.");
      return;
    }

    setSavingVerification(true);
    setVerificationError(null);
    setVerificationSuccess(false);

    try {
      const qtyNum = Number(verQty);

      const { error } = await supabase.from("stock_verifications").insert({
        company_id: companyId,
        item_id: selectedItem.id,
        verified_at: verDate || new Date().toISOString().slice(0, 10),
        verified_qty: qtyNum,
        notes: verNotes.trim() || "Periodic stock verification",
        verified_by: userId,
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
    }
  };

  // ---------- EXPORT HELPERS ----------
  const escapeCsv = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildFlatRows = () => {
    const rows: {
      category: string;
      type: string;
      name: string;
      location: string;
      te: string;
      qty: number;
      unitPrice: number;
      totalValue: number;
      lastVerDate: string;
      lastVerQty: string;
      lastVerAge: string;
    }[] = [];

    for (const g of filteredGroups) {
      for (const it of g.items) {
        const lvMeta = getLastVerificationMeta(it.id);
        const unit = it.purchase_price || 0;
        const total = unit * it.quantity;
        rows.push({
          category: g.category,
          type: it.type || "Unspecified",
          name: it.name,
          location: it.location || "",
          te: it.te_number || "",
          qty: it.quantity,
          unitPrice: unit,
          totalValue: total,
          lastVerDate: lvMeta.date,
          lastVerQty: lvMeta.qty,
          lastVerAge: lvMeta.age,
        });
      }
    }

    return rows;
  };

  const handleExportExcel = () => {
    const rows = buildFlatRows();
    if (rows.length === 0) {
      alert("No data to export for the current filters.");
      return;
    }

    const headers = [
      "Category",
      "Type",
      "Item Name",
      "Location",
      "TE Number",
      "Quantity",
      "Unit Price",
      "Total Value",
      "Last Verification Date",
      "Last Verification Qty",
      "Last Verification Age (days)",
    ];

    const lines = [
      headers.map(escapeCsv).join(","),
      ...rows.map((r) =>
        [
          r.category,
          r.type,
          r.name,
          r.location,
          r.te,
          r.qty,
          r.unitPrice,
          r.totalValue,
          r.lastVerDate,
          r.lastVerQty,
          r.lastVerAge,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];

    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `inventory-report-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = () => {
    const rows = buildFlatRows();
    if (rows.length === 0) {
      alert("No data to export for the current filters.");
      return;
    }

    const dateStr = new Date().toLocaleString();
    let tableRows = "";

    for (const r of rows) {
      tableRows += `<tr>
<td>${escapeHtml(r.category)}</td>
<td>${escapeHtml(r.type)}</td>
<td>${escapeHtml(r.name)}</td>
<td>${escapeHtml(r.location)}</td>
<td>${escapeHtml(r.te)}</td>
<td>${r.qty}</td>
<td>${r.unitPrice.toFixed(2)}</td>
<td>${r.totalValue.toFixed(2)}</td>
<td>${escapeHtml(r.lastVerDate || "")}</td>
<td>${escapeHtml(r.lastVerQty || "")}</td>
<td>${escapeHtml(r.lastVerAge || "")}</td>
</tr>`;
    }

    const html = `<!doctype html>
<html>
<head>
<title>Inventory Report</title>
<meta charset="utf-8" />
<style>
body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; font-size: 12px; padding: 16px; }
h1 { font-size: 18px; margin-bottom: 4px; }
p { margin: 0 0 8px 0; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
th { background: #f3f4f6; }
</style>
</head>
<body>
<h1>Inventory Report</h1>
<p>Generated: ${escapeHtml(dateStr)}</p>
<table>
<thead>
<tr>
  <th>Category</th><th>Type</th><th>Item Name</th><th>Location</th><th>TE Number</th>
  <th>Quantity</th><th>Unit Price</th><th>Total Value</th>
  <th>Last Verification Date</th><th>Last Verification Qty</th><th>Last Verification Age (days)</th>
</tr>
</thead>
<tbody>
${tableRows}
</tbody>
</table>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  if (companyLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel (CSV)
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-2 rounded-xl">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">Inventory Intelligence</p>
                <p className="text-xs text-slate-500">
                  Financial & operational overview
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Mobile export buttons */}
        <div className="sm:hidden flex gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel (CSV)
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* KPI row (rearranged, low stock removed) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Value</p>
              <p className="text-2xl font-semibold">
                {formatCurrency(overall.totalValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Avg unit value {formatCurrency(overall.avgUnitValue || 0)}
              </p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Total Items</p>
              <p className="text-2xl font-semibold">{overall.totalQty}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Sum of all quantities
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-1">Categories</p>
              <p className="text-2xl font-semibold">{overall.categories}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Grouped reporting view
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-xl">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </section>

        {/* Management insights row */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top categories by value */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Top Categories by Value
                </p>
                <p className="text-[11px] text-slate-500">
                  For budgeting & capex focus
                </p>
              </div>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            {topCategoriesByValue.length === 0 ? (
              <p className="text-xs text-slate-500">No data.</p>
            ) : (
              <div className="space-y-2">
                {topCategoriesByValue.map((cat) => {
                  const pct =
                    overall.totalValue > 0
                      ? (cat.totalValue / overall.totalValue) * 100
                      : 0;
                  return (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500">
                        <span className="font-medium text-slate-800">
                          {cat.category}
                        </span>
                        <span className="text-slate-800">
                          {formatCurrency(cat.totalValue)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* High-value items */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Highest Value Items
                </p>
                <p className="text-[11px] text-slate-500">
                  For insurance & critical asset tracking
                </p>
              </div>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            {topItemsByValue.length === 0 ? (
              <p className="text-xs text-slate-500">No data.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {topItemsByValue.map((it: any) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2 hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleOpenItem(it)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900">
                        {it.name}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {it.category || "Uncategorized"} • Qty {it.quantity}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency((it.purchase_price || 0) * it.quantity)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {formatCurrency(it.purchase_price || 0)} / unit
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Verification risk list */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-700">
                  Verification Risk
                </p>
                <p className="text-[11px] text-slate-500">
                  Items needing a physical check
                </p>
              </div>
              <Clock className="w-4 h-4 text-slate-400" />
            </div>

            {staleVerificationItems.length === 0 ? (
              <p className="text-xs text-slate-500">
                All items recently verified or no items.
              </p>
            ) : (
              <ul className="space-y-1 text-xs">
                {staleVerificationItems.map((it) => {
                  const lv = lastVerifications[it.id];
                  const badge = lv ? `${daysSince(lv.verified_at)} days` : "Never";
                  return (
                    <li
                      key={it.id}
                      className="flex justify-between items-center px-2 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer"
                      onClick={() => handleOpenItem(it)}
                    >
                      <span className="truncate max-w-[70%] text-slate-800">
                        {it.name}
                      </span>
                      <span className="text-[11px] text-rose-700">{badge}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* Filters */}
        <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-slate-600 mb-1">
              Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm"
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
              className="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm"
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
              className="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm"
            >
              <option value="all">All</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col flex-1 min-w-[180px]">
            <label className="text-xs font-medium text-slate-600 mb-1">
              Search (name or TE#)
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. Hilti, TE-045"
              className="px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm placeholder:text-slate-400"
            />
          </div>
        </section>

        {/* Groups by category */}
        <section className="space-y-4">
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-500">
              No inventory data matches the current filters.
            </div>
          ) : (
            filteredGroups.map((g) => (
              <div
                key={g.category}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-purple-600" />
                    <h2 className="text-sm font-semibold text-slate-900">
                      {g.category}
                    </h2>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span>
                      Qty:{" "}
                      <span className="font-semibold text-slate-900">
                        {g.totalQty}
                      </span>
                    </span>
                    <span>
                      Value:{" "}
                      <span className="font-semibold text-slate-900">
                        {formatCurrency(g.totalValue)}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-white border-b border-slate-200">
                      <tr className="text-left text-[11px] text-slate-600">
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
                            className="border-b border-slate-200 last:border-0 hover:bg-slate-50 cursor-pointer"
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
                                  <span className="text-[11px] text-slate-500 line-clamp-1">
                                    {it.description}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-[11px] text-slate-700">
                              {it.type || "Unspecified"}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="inline-flex items-center gap-1 text-slate-700">
                                <MapPin className="w-3 h-3" />
                                <span>{it.location || "-"}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top text-[11px] text-slate-500">
                              {it.te_number || "-"}
                            </td>
                            <td className="px-3 py-2 align-top text-right text-slate-900">
                              {it.quantity}
                            </td>
                            <td className="px-3 py-2 align-top text-right text-slate-900">
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
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
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
                  <div className="aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
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
                  <div className="aspect-square rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div>
                  <p className="text-[11px] text-slate-500 mb-1 uppercase">Type</p>
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
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] text-slate-500 mb-1 uppercase">
                    Description
                  </p>
                  <p className="text-sm text-slate-900">
                    {selectedItem.description}
                  </p>
                </div>
              )}

              {/* Latest verification photo (if any) */}
              {lastVerifications[selectedItem.id]?.photo_url && (
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-[11px] text-slate-500 mb-1 uppercase">
                    Latest Verification Photo
                  </p>
                  <div className="w-full max-w-xs">
                    <img
                      src={lastVerifications[selectedItem.id]?.photo_url as string}
                      alt="Latest verification"
                      className="w-full h-auto rounded-lg border border-slate-200"
                    />
                  </div>
                </div>
              )}

              {/* Add verification block */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-[11px] text-slate-500 mb-1 uppercase">
                  Add Stock Verification
                </p>

                {verificationError && (
                  <div className="text-xs text-rose-700 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {verificationError}
                  </div>
                )}
                {verificationSuccess && (
                  <div className="text-xs text-emerald-700 flex items-center gap-1">
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
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg"
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
                        setVerQty(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg"
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
                      className="w-full px-2 py-2 border border-slate-200 rounded-lg placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Verification photo upload */}
                <div className="mt-3 text-xs">
                  <label className="block text-slate-600 mb-1">
                    Verification Photo (optional)
                  </label>
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-700" />
                    <span className="text-slate-700">
                      {verPhotoUrl ? "Change verification photo" : "Upload verification photo"}
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
                        className="w-full h-auto rounded-md border border-slate-200"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={handleAddVerification}
                    disabled={savingVerification}
                    className="px-4 py-2 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1"
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
    </div>
  );
}
