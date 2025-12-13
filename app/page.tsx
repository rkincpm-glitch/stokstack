"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Search,
  Package,
  Plus,
  BarChart3,
  Grid,
  List,
  Filter,
  DollarSign,
  Tag,
  Settings,
  LogOut,
  ChevronDown,
  FileImage,
  MapPin,
  Calendar,
  Edit,
  X,
  CheckCircle2,
  Users,
  LayoutGrid,
  Home,
  ShoppingCart,
  MapPinned,
  Shapes,
} from "lucide-react";
import { useCompany } from "@/lib/useCompany";

type Item = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  location: string | null;
  type?: string | null;
  quantity: number;
  image_url: string | null;
  image_url_2: string | null;
  user_id: string | null;
  te_number: string | null;
  purchase_price?: number | null;
  purchase_date?: string | null;
  company_id?: string | null;
};

type CategoryRow = {
  id: string;
  name: string;
  company_id?: string | null;
  user_id: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  company_id?: string | null;
  user_id: string | null;
};

type StockVerification = {
  id: string;
  item_id: string;
  verified_at: string; // ISO date string
  verified_qty: number;
  notes: string | null;
  verified_by: string | null;
  company_id?: string | null;
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
};

type CategoryCard = {
  name: string;
  count: number;
  totalQty: number;
  thumbnails: string[]; // up to 4
};

export default function Dashboard() {
  const router = useRouter();
  const { loading: companyLoading, companyId, role: companyRole } = useCompany();

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Category-first browsing
  const [browseMode, setBrowseMode] = useState<"categories" | "items">("categories");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Master data for Categories & Locations
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  // Stock verification state
  const [verifications, setVerifications] = useState<StockVerification[]>([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);
  const [verifyDate, setVerifyDate] = useState("");
  const [verifyQty, setVerifyQty] = useState<number | "">("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [savingVerification, setSavingVerification] = useState(false);

  // current user's profile (role/display)
  const [profile, setProfile] = useState<Profile | null>(null);

  // Mobile default view should be LIST with thumbnails
  useEffect(() => {
    const setDefault = () => {
      if (typeof window !== "undefined") {
        setViewMode(window.innerWidth < 640 ? "list" : "grid");
      }
    };
    setDefault();
    window.addEventListener("resize", setDefault);
    return () => window.removeEventListener("resize", setDefault);
  }, []);

  useEffect(() => {
    // wait for company context
    if (companyLoading) return;
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyLoading, companyId]);

  const loadData = async () => {
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth");
      return;
    }

    const userId = userData.user.id;
    const email = userData.user.email || null;

    if (!companyId) {
      // company must exist for multi-tenant
      setItems([]);
      setCategoryOptions([]);
      setLocationOptions([]);
      setLoading(false);
      return;
    }

    // 1) Ensure profile
    let { data: profData, error: profError } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profData && !profError) {
      const { data: newProf } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "requester",
          display_name: email,
        })
        .select()
        .single();
      profData = newProf as any;
    }

    if (profData) {
      setProfile({
        id: profData.id,
        role: profData.role || "requester",
        display_name: profData.display_name || email,
      });
    }

    // 2) Load locations (company)
    const { data: locationsData } = await supabase
      .from("locations")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    // 3) Load this user's location access from user_locations (optional feature)
    const { data: accessData } = await supabase
      .from("user_locations")
      .select("*")
      .eq("user_id", userId);

    // 4) Determine allowed locations
    let allowedLocations: string[] | "ALL" = "ALL";
    if (accessData && accessData.length > 0) {
      const hasAll = accessData.some((a: any) => a.all_locations);
      if (!hasAll) {
        const locSet = new Set<string>();
        accessData.forEach((a: any) => {
          if (a.location_name) locSet.add(a.location_name);
        });
        const list = Array.from(locSet);
        allowedLocations = list.length > 0 ? list : "ALL";
      }
    }

    // 5) Load items (company scoped)
    let itemsQuery = supabase
      .from("items")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (allowedLocations !== "ALL") {
      itemsQuery = itemsQuery.in("location", allowedLocations);
    }

    const { data: itemsData, error: itemsError } = await itemsQuery;
    if (itemsError) console.error("Items error:", itemsError);

    // 6) Load categories (company)
    const { data: categoriesData } = await supabase
      .from("categories")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });

    // 7) Apply state
    const allItems = (itemsData || []) as Item[];
    setItems(allItems);

    const categorySet = new Set<string>();
    (categoriesData as CategoryRow[] | null)?.forEach((c) => c.name && categorySet.add(c.name));
    allItems.forEach((i) => i.category && categorySet.add(i.category));
    setCategoryOptions(Array.from(categorySet).sort());

    const locationSet = new Set<string>();
    (locationsData as LocationRow[] | null)?.forEach((l) => l.name && locationSet.add(l.name));
    allItems.forEach((i) => i.location && locationSet.add(i.location));
    setLocationOptions(Array.from(locationSet).sort());

    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    setVerifyDate(new Date().toISOString().slice(0, 10));
    setVerifyQty(item.quantity || "");
    setVerifyNotes("");
    void loadVerifications(item.id);
  };

  const loadVerifications = async (itemId: string) => {
    if (!companyId) return;
    setLoadingVerifications(true);

    const { data, error } = await supabase
      .from("stock_verifications")
      .select("*")
      .eq("company_id", companyId)
      .eq("item_id", itemId)
      .order("verified_at", { ascending: false });

    if (error) {
      console.error("Error loading verifications:", error);
    } else {
      setVerifications((data || []) as StockVerification[]);
    }
    setLoadingVerifications(false);
  };

  const handleSaveVerification = async () => {
    if (!companyId) return;
    if (!selectedItem || verifyQty === "" || !verifyDate) return;

    setSavingVerification(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id || null;

    const { data, error } = await supabase
      .from("stock_verifications")
      .insert({
        company_id: companyId,
        item_id: selectedItem.id,
        verified_at: verifyDate,
        verified_qty: verifyQty,
        notes: verifyNotes || null,
        verified_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error saving verification:", error);
    } else if (data) {
      setVerifications((prev) => [data as StockVerification, ...prev]);
    }

    setSavingVerification(false);
  };

  // Stats (rearranged; low stock removed)
  const stats = useMemo(() => {
    const totalValue = items.reduce((sum, i) => sum + (i.purchase_price || 0) * i.quantity, 0);
    const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
    const categories = categoryOptions.length;
    return { totalValue, totalItems, categories };
  }, [items, categoryOptions]);

  // Filter items for item view
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        `${item.name} ${item.description || ""} ${item.te_number || ""}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory === "all" || item.category === filterCategory;
      const matchesLocation = filterLocation === "all" || item.location === filterLocation;

      // when browsing a category, lock to that category
      const matchesActiveCategory =
        browseMode !== "items" || !activeCategory
          ? true
          : (item.category || "Uncategorized") === activeCategory;

      return matchesSearch && matchesCategory && matchesLocation && matchesActiveCategory;
    });
  }, [items, searchTerm, filterCategory, filterLocation, browseMode, activeCategory]);

  // Category cards (default mode)
  const categoryCards: CategoryCard[] = useMemo(() => {
    const map = new Map<string, CategoryCard>();

    for (const it of items) {
      const key = it.category || "Uncategorized";
      if (!map.has(key)) {
        map.set(key, { name: key, count: 0, totalQty: 0, thumbnails: [] });
      }
      const c = map.get(key)!;
      c.count += 1;
      c.totalQty += it.quantity;

      const thumb = it.image_url || it.image_url_2 || null;
      if (thumb && c.thumbnails.length < 4 && !c.thumbnails.includes(thumb)) {
        c.thumbnails.push(thumb);
      }
    }

    const list = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [items]);

  const isAdmin = (companyRole || profile?.role) === "admin" || (companyRole || profile?.role) === "owner";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-16 bg-white border-r border-slate-200 z-40 hidden sm:flex flex-col items-center py-4 gap-3">
        <Link href="/" className="p-2 rounded-xl hover:bg-slate-100" title="Dashboard">
          <Home className="w-5 h-5 text-slate-700" />
        </Link>
        <Link href="/add-item" className="p-2 rounded-xl hover:bg-slate-100" title="Add Item">
          <Plus className="w-5 h-5 text-slate-700" />
        </Link>
        <Link href="/reports" className="p-2 rounded-xl hover:bg-slate-100" title="Reports">
          <BarChart3 className="w-5 h-5 text-slate-700" />
        </Link>
        <Link href="/purchase-requests" className="p-2 rounded-xl hover:bg-slate-100" title="Purchasing">
          <ShoppingCart className="w-5 h-5 text-slate-700" />
        </Link>

        <div className="w-8 h-px bg-slate-200 my-1" />

        <Link href="/settings/categories" className="p-2 rounded-xl hover:bg-slate-100" title="Manage Categories">
          <Tag className="w-5 h-5 text-slate-700" />
        </Link>
        <Link href="/settings/locations" className="p-2 rounded-xl hover:bg-slate-100" title="Manage Locations">
          <MapPinned className="w-5 h-5 text-slate-700" />
        </Link>
        <Link href="/settings/types" className="p-2 rounded-xl hover:bg-slate-100" title="Manage Types">
          <Shapes className="w-5 h-5 text-slate-700" />
        </Link>

        <div className="flex-1" />

        {isAdmin && (
          <Link href="/admin/users" className="p-2 rounded-xl hover:bg-slate-100" title="Manage Users">
            <Users className="w-5 h-5 text-slate-700" />
          </Link>
        )}

        <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-slate-100" title="Logout">
          <LogOut className="w-5 h-5 text-slate-700" />
        </button>
      </div>

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:pl-16">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">stokstak</h1>
                <p className="text-xs text-slate-500">Inventory & Purchasing</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Keep existing top buttons (do not remove) */}
              {isAdmin && (
                <Link
                  href="/admin/users"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Users className="w-4 h-4" />
                  Manage Users
                </Link>
              )}

              <Link
                href="/add-item"
                className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Link>

              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Settings">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 hover:bg-slate-100 rounded-lg"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {profile?.display_name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-600" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border py-1">
                    <div className="px-4 py-2 text-xs text-slate-500 border-b">
                      {profile?.display_name ? `Signed in as ${profile.display_name}` : "Signed in"}
                      {(companyRole || profile?.role) && (
                        <span className="block text-[11px] text-slate-400">
                          Role: {companyRole || profile?.role}
                        </span>
                      )}
                    </div>

                    {isAdmin && (
                      <Link
                        href="/admin/users"
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex gap-2 items-center"
                      >
                        <Users className="w-4 h-4" />
                        Manage users
                      </Link>
                    )}

                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:pl-20">
        {/* If company missing */}
        {!companyLoading && !companyId && (
          <div className="bg-white border rounded-xl p-4 text-sm text-slate-700">
            No company assigned to this user. Please add this user to a company in <code>company_users</code>.
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Value</p>
                <p className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Items</p>
                <p className="text-2xl font-bold">{stats.totalItems}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Categories</p>
                <p className="text-2xl font-bold">{stats.categories}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Tag className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters + Actions */}
        <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg hover:bg-slate-50"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>

            {/* Browse mode toggle (Category-first default) */}
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setBrowseMode("categories");
                  setActiveCategory(null);
                  setFilterCategory("all");
                }}
                className={`p-2 rounded flex items-center gap-2 ${
                  browseMode === "categories" ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Categories</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBrowseMode("items");
                  setActiveCategory(null);
                }}
                className={`p-2 rounded flex items-center gap-2 ${
                  browseMode === "items" ? "bg-slate-900 text-white" : "hover:bg-slate-100"
                }`}
              >
                <Package className="w-4 h-4" />
                <span className="text-xs hidden sm:inline">Items</span>
              </button>
            </div>

            <div className="flex items-center gap-2 border rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded ${viewMode === "grid" ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded ${viewMode === "list" ? "bg-blue-600 text-white" : "hover:bg-slate-100"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Keep your existing buttons */}
            <Link
              href="/reports"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <BarChart3 className="w-5 h-5" />
              Reports
            </Link>

            <Link
              href="/purchase-requests"
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              <Package className="w-5 h-5" />
              Purchasing
            </Link>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Category</label>
                  <Link href="/settings/categories" className="text-xs text-blue-600 hover:underline">
                    Manage categories
                  </Link>
                </div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Location</label>
                  <Link href="/settings/locations" className="text-xs text-blue-600 hover:underline">
                    Manage locations
                  </Link>
                </div>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="all">All Locations</option>
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-center py-12 text-slate-600">Loading...</p>
        ) : browseMode === "categories" ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-900">Categories</p>
              <p className="text-xs text-slate-500">Click a category to view its items</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryCards.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setBrowseMode("items");
                    setActiveCategory(c.name);
                    setFilterCategory("all"); // category lock is handled by activeCategory
                    setViewMode((prev) => (prev === "grid" || prev === "list" ? prev : "grid"));
                  }}
                  className="text-left bg-white border rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden"
                >
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 line-clamp-1">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {c.count} items • {c.totalQty} qty
                      </p>
                    </div>
                    <div className="bg-slate-100 rounded-xl p-2">
                      <Tag className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>

                  {/* thumbnails */}
                  <div className="grid grid-cols-4 gap-1 p-3 pt-0">
                    {[0, 1, 2, 3].map((i) => {
                      const url = c.thumbnails[i] || null;
                      return (
                        <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                          {url ? (
                            <img src={url} alt={`${c.name}-${i}`} className="w-full h-full object-cover" />
                          ) : (
                            <FileImage className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Category breadcrumb when active */}
            {activeCategory && (
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setBrowseMode("categories");
                    setActiveCategory(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-2"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Back to categories
                </button>
                <div className="text-sm font-semibold text-slate-900">
                  {activeCategory}
                </div>
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition cursor-pointer group"
                  >
                    <div className="relative aspect-square bg-slate-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileImage className="w-12 h-12 text-slate-300" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-xs px-2 py-1 rounded-full font-medium">
                        Qty: {item.quantity}
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-1 line-clamp-1">{item.name}</h3>
                      <p className="text-sm text-slate-600 mb-2 line-clamp-2">{item.description}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <Tag className="w-3 h-3" />
                        {item.category || "Uncategorized"}
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-slate-500">{item.te_number}</span>
                        <span className="text-sm font-semibold">
                          ${item.purchase_price?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Item</th>
                      <th className="text-left p-4 text-sm font-medium">TE#</th>
                      <th className="text-left p-4 text-sm font-medium">Category</th>
                      <th className="text-left p-4 text-sm font-medium">Location</th>
                      <th className="text-right p-4 text-sm font-medium">Qty</th>
                      <th className="text-right p-4 text-sm font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className="border-b hover:bg-slate-50 cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                                <FileImage className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-slate-500 line-clamp-1">{item.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-sm">{item.te_number}</td>
                        <td className="p-4 text-sm">{item.category}</td>
                        <td className="p-4 text-sm">{item.location}</td>
                        <td className="p-4 text-right">{item.quantity}</td>
                        <td className="p-4 text-right text-sm font-semibold">
                          ${item.purchase_price?.toFixed(2) || "0.00"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Item Detail Modal (KEEP: click item → details + Edit) */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold">{selectedItem.name}</h2>
              <div className="flex gap-2">
                <Link
                  href={`/edit-item/${selectedItem.id}`}
                  className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                  title="Edit item"
                >
                  <Edit className="w-5 h-5" />
                </Link>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Photos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                          <p className="text-xs text-slate-400">No primary photo</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

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
                          <p className="text-xs text-slate-400">No secondary photo</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Item Details */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Quantity</p>
                    <p className="text-2xl font-bold">{selectedItem.quantity}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Unit Price</p>
                    <p className="text-2xl font-bold">
                      ${selectedItem.purchase_price?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Tag className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Category</p>
                    <p className="font-medium">{selectedItem.category || "-"}</p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Location</p>
                    <p className="font-medium">{selectedItem.location || "-"}</p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Package className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">TE Number</p>
                    <p className="font-medium">{selectedItem.te_number || "-"}</p>
                  </div>
                </div>

                <div className="flex gap-3 bg-white p-3 rounded-lg border">
                  <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600">Purchase Date</p>
                    <p className="font-medium">{selectedItem.purchase_date || "-"}</p>
                  </div>
                </div>
              </div>

              {selectedItem.description && (
                <div className="bg-slate-50 rounded-xl p-4 mb-6">
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-slate-700">{selectedItem.description}</p>
                </div>
              )}

              {/* Stock Verification */}
              <div className="bg-white rounded-xl p-4 border mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Stock Verification
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Verification Date
                    </label>
                    <input
                      type="date"
                      value={verifyDate}
                      onChange={(e) => setVerifyDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Verified Quantity
                    </label>
                    <input
                      type="number"
                      value={verifyQty}
                      onChange={(e) =>
                        setVerifyQty(e.target.value === "" ? "" : Number(e.target.value))
                      }
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Notes
                    </label>
                    <input
                      type="text"
                      value={verifyNotes}
                      onChange={(e) => setVerifyNotes(e.target.value)}
                      placeholder="e.g. Counted on shelf A3"
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveVerification}
                  disabled={savingVerification || verifyQty === "" || !verifyDate}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {savingVerification ? "Saving..." : "Save Verification"}
                </button>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2">Verification History</h4>
                  {loadingVerifications ? (
                    <p className="text-xs text-slate-500">Loading verification history...</p>
                  ) : verifications.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No physical stock verification recorded yet.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium">Date</th>
                            <th className="text-left px-3 py-2 font-medium">Qty</th>
                            <th className="text-left px-3 py-2 font-medium">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {verifications.map((v) => (
                            <tr key={v.id} className="border-b last:border-0">
                              <td className="px-3 py-2">{v.verified_at?.slice(0, 10)}</td>
                              <td className="px-3 py-2">{v.verified_qty}</td>
                              <td className="px-3 py-2">{v.notes || "-"}</td>
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
        </div>
      )}

      {/* Mobile FAB */}
      <Link
        href="/add-item"
        className="sm:hidden fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 z-30"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}
