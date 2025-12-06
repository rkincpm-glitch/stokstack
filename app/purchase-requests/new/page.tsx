"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  MapPin,
  Plus,
  Trash2,
  Package,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  code: string | null;
};

type LineItemForm = {
  description: string;
  quantity: number | "";
  unit: string;
  applicationLocation: string;
  estUnitPrice: number | "";
};

const ADD_PROJECT_VALUE = "__ADD_NEW_PROJECT__";

export default function NewPurchaseRequestPage() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");

  const [neededBy, setNeededBy] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<LineItemForm[]>([
    { description: "", quantity: "", unit: "ea", applicationLocation: "", estUnitPrice: "" },
  ]);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }
      const uid = userData.user.id;
      setUserId(uid);

      await loadProjects(uid);
      setNeededBy(new Date().toISOString().slice(0, 10));
      setLoading(false);
    };

    init();
  }, [router]);

  const loadProjects = async (uid: string) => {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, code")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading projects:", error);
      return;
    }

    setProjects((data || []) as Project[]);
  };

  const handleProjectChange = async (value: string) => {
    if (!userId) return;

    if (value !== ADD_PROJECT_VALUE) {
      setProjectId(value);
      return;
    }

    const name = window.prompt("Enter new project name:");
    if (!name || !name.trim()) return;

    const codeInput = window.prompt("Enter project code (optional):");
    const code = codeInput && codeInput.trim() ? codeInput.trim() : null;

    const { data, error } = await supabase
      .from("projects")
      .insert({
        user_id: userId,
        name: name.trim(),
        code,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("Error creating project:", error);
      setErrorMsg("Could not create project.");
      return;
    }

    const newProject = data as Project;
    setProjects((prev) => [...prev, newProject]);
    setProjectId(newProject.id);
  };

  const handleItemChange = (
    index: number,
    field: keyof LineItemForm,
    value: string
  ) => {
    setItems((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]:
                field === "quantity" || field === "estUnitPrice"
                  ? value === ""
                    ? ""
                    : Number(value)
                  : value,
            }
          : row
      )
    );
  };

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        description: "",
        quantity: "",
        unit: "ea",
        applicationLocation: "",
        estUnitPrice: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!projectId) {
        setErrorMsg("Project is required.");
        setSaving(false);
        return;
      }

      const validItems = items.filter(
        (it) => it.description.trim() && it.quantity !== ""
      );

      if (validItems.length === 0) {
        setErrorMsg("Add at least one line item with description and quantity.");
        setSaving(false);
        return;
      }

      // 1) Insert request header
      const { data: reqData, error: reqError } = await supabase
        .from("purchase_requests")
        .insert({
          project_id: projectId,
          requested_by: userId,
          status: "submitted",
          needed_by: neededBy || null,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (reqError || !reqData) {
        console.error("Error creating request:", reqError);
        setErrorMsg("Error creating purchase request.");
        setSaving(false);
        return;
      }

      const requestId = reqData.id as string;

      // 2) Insert line items
      const payload = validItems.map((it) => ({
        request_id: requestId,
        item_id: null,
        description: it.description.trim(),
        quantity: it.quantity === "" ? 0 : Number(it.quantity),
        unit: it.unit || "ea",
        application_location: it.applicationLocation.trim() || null,
        est_unit_price:
          it.estUnitPrice === "" ? null : Number(it.estUnitPrice),
      }));

      const { error: itemsError } = await supabase
        .from("purchase_request_items")
        .insert(payload);

      if (itemsError) {
        console.error("Error saving line items:", itemsError);
        setErrorMsg(
          "Request header saved, but there was an error saving line items."
        );
        setSaving(false);
        return;
      }

      setSuccessMsg("Purchase request created.");
      setTimeout(() => {
        router.push(`/purchase-requests/${requestId}`);
      }, 600);
    } catch (err) {
      console.error(err);
      setErrorMsg("Unexpected error. Please try again.");
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
                Select project and add items to buy
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-6"
        >
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          {/* Project & timing */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Project & Timing
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Project<span className="text-red-500">*</span>
                </label>
                <select
                  value={projectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Select project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ` (${p.code})` : ""}
                    </option>
                  ))}
                  <option value={ADD_PROJECT_VALUE}>➕ Add new project…</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Needed by
                </label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-8 h-8 border rounded-lg text-slate-500 text-xs">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    value={neededBy}
                    onChange={(e) => setNeededBy(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Notes to approver / purchaser
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Any specific vendor, alternates, or instructions."
              />
            </div>
          </section>

          {/* Line items */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Line Items
            </h2>

            <div className="space-y-3">
              {items.map((row, index) => (
                <div
                  key={index}
                  className="border rounded-xl p-3 bg-slate-50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <Package className="w-4 h-4" />
                      Item {index + 1}
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Description<span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        placeholder='e.g. 1-1/4" SDS+ drill bits, 12" long'
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Quantity<span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          value={row.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          className="w-full px-3 py-2 border rounded-lg text-xs"
                        />
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) =>
                            handleItemChange(index, "unit", e.target.value)
                          }
                          className="w-20 px-2 py-2 border rounded-lg text-xs"
                          placeholder="ea"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Application Location
                      </label>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <input
                          type="text"
                          value={row.applicationLocation}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "applicationLocation",
                              e.target.value
                            )
                          }
                          placeholder="e.g. MER, North Tube, Gridline 11"
                          className="w-full px-3 py-2 border rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Est. Unit Price (optional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.estUnitPrice}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "estUnitPrice",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 hover:text-emerald-900"
            >
              <Plus className="w-4 h-4" />
              Add line
            </button>
          </section>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <Link
              href="/purchase-requests"
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
