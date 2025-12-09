"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Plus,
  Trash2,
  AlertCircle,
  Save,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  code: string | null;
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
  is_active: boolean;
};

type LineItem = {
  id: string;
  description: string;
  quantity: number | "";
  unit: string;
  application_location: string;
  est_unit_price: number | "";
};

export default function NewPurchaseRequestPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectId, setProjectId] = useState<string>("");
  const [neededBy, setNeededBy] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [items, setItems] = useState<LineItem[]>([
    {
      id: crypto.randomUUID(),
      description: "",
      quantity: "",
      unit: "ea",
      application_location: "",
      est_unit_price: "",
    },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const init = async () => {
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      router.push("/auth");
      return;
    }
    const userId = userData.user.id;

    // Load or create profile
    const email = userData.user.email || "";
    let { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("id, role, display_name, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!prof && !profError) {
      const { data: newProf, error: newProfError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "requester",
          display_name: email,
          is_active: true,
        })
        .select("id, role, display_name, is_active")
        .single();

      if (newProfError) {
        console.error("Error creating profile:", newProfError);
        setErrorMsg(
          `Could not create profile: ${newProfError.message}. Check Supabase "profiles" table.`
        );
        setLoading(false);
        return;
      }

      prof = newProf;
    }

    if (!prof) {
      setErrorMsg("Could not load your profile.");
      setLoading(false);
      return;
    }

    if (prof.is_active === false) {
      setErrorMsg(
        "Your account has been disabled. Contact your admin to re-enable access."
      );
      setLoading(false);
      return;
    }

    const myProfile: Profile = {
      id: prof.id,
      role: prof.role || "requester",
      display_name: prof.display_name || email,
      is_active: prof.is_active ?? true,
    };

    setProfile(myProfile);

    // Load projects
    const { data: projData, error: projError } = await supabase
      .from("projects")
      .select("id, name, code")
      .order("name", { ascending: true });

    if (projError) {
      console.error("Error loading projects:", projError);
      setErrorMsg(
        `Error loading projects: ${projError.message}. Ensure "projects" table exists and RLS allows select.`
      );
      setLoading(false);
      return;
    }

    setProjects((projData || []) as Project[]);
    setLoading(false);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        description: "",
        quantity: "",
        unit: "ea",
        application_location: "",
        est_unit_price: "",
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
    );
  };

  const validateForm = (): string | null => {
    if (!projectId) {
      return "Please select a project.";
    }

    const nonEmptyItems = items.filter(
      (it) => it.description.trim() !== "" && Number(it.quantity || 0) > 0
    );

    if (nonEmptyItems.length === 0) {
      return "Please add at least one line item with description and quantity.";
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!profile) return;

    setErrorMsg(null);
    setInfoMsg(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setSaving(true);

    try {
      // 1) Create purchase request (only columns we KNOW are safe)
      const { data: req, error: reqError } = await supabase
        .from("purchase_requests")
        .insert({
          project_id: projectId || null,
          requested_by: profile.id,
          status: "submitted",
          needed_by: neededBy || null,
          notes: notes || null,
        })
        .select("*")
        .single();

      if (reqError || !req) {
        console.error("Supabase insert error (purchase_requests):", reqError);
        setErrorMsg(
          `Error creating purchase request: ${
            reqError?.message || "Unknown error"
          }`
        );
        setSaving(false);
        return;
      }

      const requestId = req.id as string;

      // 2) Insert line items
      const payloadItems = items
        .filter(
          (it) => it.description.trim() !== "" && Number(it.quantity || 0) > 0
        )
        .map((it) => ({
          request_id: requestId,
          item_id: null, // link to inventory item later if needed
          description: it.description.trim(),
          quantity: Number(it.quantity || 0),
          unit: it.unit || "ea",
          application_location:
            it.application_location.trim() === ""
              ? null
              : it.application_location.trim(),
          est_unit_price:
            it.est_unit_price === "" ? null : Number(it.est_unit_price),
          status: "pending",
        }));

      if (payloadItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_request_items")
          .insert(payloadItems);

        if (itemsError) {
          console.error(
            "Supabase insert error (purchase_request_items):",
            itemsError
          );
          setErrorMsg(
            `Request created but items failed: ${itemsError.message}. Check "purchase_request_items" columns and RLS.`
          );
          setSaving(false);
          return;
        }
      }

      setInfoMsg("Purchase request created and submitted for approval.");
      // Short delay then go to detail page
      setTimeout(() => {
        router.push(`/purchase-requests/${requestId}`);
      }, 800);
    } catch (err: any) {
      console.error("Unexpected error creating purchase request:", err);
      setErrorMsg(
        `Unexpected error creating purchase request: ${
          err?.message || String(err)
        }`
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Could not load profile. Please sign out and sign in again.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/purchase-requests"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to requests
          </Link>

          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                New Purchase Request
              </p>
              <p className="text-xs text-slate-500">
                Role: {profile.role || "requester"}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {infoMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
            <Save className="w-4 h-4" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Request header card */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.code ? ` (${p.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Needed by */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Needed by date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Overall notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-y"
              placeholder="General notes for purchasing or jobsite (optional)..."
            />
          </div>
        </section>

        {/* Line items */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Line Items
            </h2>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800"
            >
              <Plus className="w-3 h-3" />
              Add item
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-500">
              No items yet. Click “Add item” to start.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div
                  key={it.id}
                  className="border rounded-xl p-3 bg-slate-50 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">
                      Item {idx + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(it.id)}
                      disabled={items.length === 1}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Description */}
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) =>
                          updateItem(it.id, {
                            description: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="e.g. 2\" rigid conduit, cordless hammer drill, safety harness..."
                      />
                    </div>

                    {/* Quantity & unit */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(it.id, {
                              quantity:
                                e.target.value === ""
                                  ? ""
                                  : Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={it.unit}
                          onChange={(e) =>
                            updateItem(it.id, {
                              unit: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          placeholder="ea, box, roll..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Location & price */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Application location (optional)
                      </label>
                      <input
                        type="text"
                        value={it.application_location}
                        onChange={(e) =>
                          updateItem(it.id, {
                            application_location: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="e.g. MER Level 02, North Tube, Roof Area A..."
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Est. unit price (optional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={it.est_unit_price}
                        onChange={(e) =>
                          updateItem(it.id, {
                            est_unit_price:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t mt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
