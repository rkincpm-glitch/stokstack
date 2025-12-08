"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  MapPin,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Boxes,
  Info,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  code: string | null;
};

type PurchaseRequest = {
  id: string;
  pur_number: string | null;
  project_id: string | null;
  requested_by: string | null;
  status: string;
  needed_by: string | null;
  notes: string | null;
  created_at: string;
  pm_approved_by: string | null;
  pm_approved_at: string | null;
  president_approved_by: string | null;
  president_approved_at: string | null;
  purchased_by: string | null;
  purchased_at: string | null;
  received_by: string | null;
  received_at: string | null;
};

type RequestItem = {
  id: string;
  request_id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  application_location: string | null;
  est_unit_price: number | null;
  status: string; // pending, approved, rejected
  reject_comment: string | null;
  resubmit_comment: string | null;
  approved_qty: number | null; // NEW: partial approval
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  pm_approved: "PM Approved",
  president_approved: "President Approved",
  purchased: "Purchased",
  received: "Received",
  rejected: "Rejected",
};

export default function PurchaseRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params?.id as string;

  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState(false);
  const [stocking, setStocking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [request, setRequest] = useState<PurchaseRequest | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<RequestItem[]>([]);
  const [showTechnical, setShowTechnical] = useState(false);

  // UUID guard
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const invalidId = !uuidRegex.test(requestId);

  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.push("/auth");
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      // Profile
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, role, display_name")
        .eq("id", uid)
        .maybeSingle();

      let role = "requester";
      let displayName: string | null = null;
      if (profData) {
        role = profData.role || "requester";
        displayName = profData.display_name || null;
      }

      setProfile({ id: uid, role, display_name: displayName });

      if (!invalidId) {
        await loadRequest();
      }

      setLoading(false);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const loadRequest = async () => {
    setErrorMsg(null);
    setInfoMsg(null);

    const { data: reqData, error: reqError } = await supabase
      .from("purchase_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqError || !reqData) {
      console.error("Error loading request:", reqError);
      setRequest(null);
      setProject(null);
      setItems([]);
      setErrorMsg(
        `Could not load purchase request: ${reqError?.message || "Not found"}`
      );
      return;
    }

    setRequest(reqData as PurchaseRequest);

    if (reqData.project_id) {
      const { data: projData } = await supabase
        .from("projects")
        .select("id, name, code")
        .eq("id", reqData.project_id)
        .single();

      if (projData) {
        setProject(projData as Project);
      }
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("purchase_request_items")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (!itemsError && itemsData) {
      setItems(itemsData as RequestItem[]);
    }
  };

  // who can advance what?
  const canApproveReject =
    profile &&
    request &&
    ((profile.role === "pm" && request.status === "submitted") ||
      (profile.role === "president" && request.status === "pm_approved"));

  const canMarkPurchased =
    profile &&
    request &&
    profile.role === "purchaser" &&
    request.status === "president_approved";

  const canMarkReceived =
    profile && request && profile.role === "purchaser" && request.status === "purchased";

  const canReceiveToStock =
    profile && request && request.status === "received";

  const logEvent = async (opts: {
    event_type: string;
    from_status?: string | null;
    to_status?: string | null;
    item_id?: string | null;
    comment?: string | null;
  }) => {
    if (!userId || !request) return;

    await supabase.from("purchase_request_events").insert({
      request_id: request.id,
      item_id: opts.item_id || null,
      performed_by: userId,
      event_type: opts.event_type,
      from_status: opts.from_status || null,
      to_status: opts.to_status || null,
      comment: opts.comment || null,
    });
  };

  const updateRequestStatus = async (nextStatus: string, comment?: string) => {
    if (!request || !userId) return;

    setSavingStatus(true);
    setErrorMsg(null);
    setInfoMsg(null);

    const now = new Date().toISOString();
    const payload: any = { status: nextStatus };

    if (nextStatus === "pm_approved") {
      payload.pm_approved_by = userId;
      payload.pm_approved_at = now;
    } else if (nextStatus === "president_approved") {
      payload.president_approved_by = userId;
      payload.president_approved_at = now;
    } else if (nextStatus === "purchased") {
      payload.purchased_by = userId;
      payload.purchased_at = now;
    } else if (nextStatus === "received") {
      payload.received_by = userId;
      payload.received_at = now;
    }

    const from = request.status;

    const { error } = await supabase
      .from("purchase_requests")
      .update(payload)
      .eq("id", request.id);

    if (error) {
      console.error("Error updating status:", error);
      setErrorMsg(`Error updating status: ${error.message}`);
      setSavingStatus(false);
      return;
    }

    await logEvent({
      event_type: "status_change",
      from_status: from,
      to_status: nextStatus,
      comment: comment || null,
    });

    await loadRequest();
    setSavingStatus(false);
    setInfoMsg(`Status updated to ${STATUS_LABEL[nextStatus] || nextStatus}.`);
  };

  const handleApproveOrReject = async (action: "approve" | "reject") => {
    if (!request || !profile) return;

    if (!canApproveReject && action !== "reject") return;

    let nextStatus = request.status;
    let comment: string | undefined = undefined;

    if (action === "approve") {
      if (profile.role === "pm" && request.status === "submitted") {
        nextStatus = "pm_approved";
      } else if (
        profile.role === "president" &&
        request.status === "pm_approved"
      ) {
        nextStatus = "president_approved";
      }
    } else {
      // reject whole request
      const c = window.prompt("Enter rejection reason for this request:");
      if (!c || !c.trim()) {
        alert("Rejection reason is required.");
        return;
      }
      comment = c.trim();
      nextStatus = "rejected";
    }

    await updateRequestStatus(nextStatus, comment);
  };

  const handleItemDecision = async (
    item: RequestItem,
    action: "approve" | "reject"
  ) => {
    if (!profile) return;

    let comment: string | null = null;
    let approvedQty: number | null = item.approved_qty ?? item.quantity;

    if (action === "reject") {
      const c = window.prompt(
        "Enter rejection comment for this line item (required):"
      );
      if (!c || !c.trim()) {
        alert("Rejection comment is required.");
        return;
      }
      comment = c.trim();
      approvedQty = 0;
    } else {
      // Approve (full or partial)
      const defaultQty =
        approvedQty && approvedQty > 0 ? approvedQty : item.quantity;
      const qtyStr = window.prompt(
        `Enter approved quantity (<= ${item.quantity}):`,
        String(defaultQty)
      );
      if (!qtyStr) {
        // user cancelled
        return;
      }
      const qtyNum = Number(qtyStr);
      if (
        Number.isNaN(qtyNum) ||
        qtyNum <= 0 ||
        qtyNum > Number(item.quantity)
      ) {
        alert(
          `Approved quantity must be a number between 1 and ${item.quantity}.`
        );
        return;
      }
      approvedQty = qtyNum;

      if (item.status === "rejected") {
        const c = window.prompt(
          "This item was previously rejected. Enter special comment to approve it now:"
        );
        if (!c || !c.trim()) {
          alert("Comment is required to re-approve a rejected item.");
          return;
        }
        comment = c.trim();
      }
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const { error } = await supabase
      .from("purchase_request_items")
      .update({
        status: newStatus,
        approved_qty:
          action === "approve" ? approvedQty : 0,
        reject_comment:
          action === "reject" ? comment : item.reject_comment,
        resubmit_comment:
          action === "approve" && item.status === "rejected"
            ? comment
            : item.resubmit_comment,
      })
      .eq("id", item.id);

    if (error) {
      console.error("Error updating item:", error);
      setErrorMsg(`Error updating item: ${error.message}`);
      return;
    }

    await logEvent({
      event_type: action === "approve" ? "item_approved" : "item_rejected",
      item_id: item.id,
      comment: comment,
    });

    await loadRequest();
  };

  const handleReceiveToStock = async () => {
    if (!request || !userId) return;

    setStocking(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const freshItems = items;

      for (const it of freshItems) {
        if (it.status === "rejected") {
          continue; // don't stock rejected lines
        }

        const effectiveQty =
          it.approved_qty != null ? it.approved_qty : it.quantity;

        if (!effectiveQty || effectiveQty <= 0) {
          continue;
        }

        if (it.item_id) {
          // existing inventory item → increment quantity
          await supabase
            .from("items")
            .update({
              quantity: effectiveQty,
            })
            .eq("id", it.item_id)
            .then(({ error }) => {
              if (error) {
                console.error("Error updating stock item:", error);
              }
            });
        } else {
          // new inventory item
          const { data: newItem, error: newErr } = await supabase
            .from("items")
            .insert({
              user_id: userId,
              name: it.description,
              description: request.notes,
              quantity: effectiveQty,
              location: it.application_location,
              category: null,
              te_number: null,
              purchase_price: it.est_unit_price,
              purchase_date: new Date().toISOString().slice(0, 10),
            })
            .select()
            .single();

          if (newErr) {
            console.error("Error creating inventory item:", newErr);
          } else if (newItem) {
            // back-link line item → inventory item
            await supabase
              .from("purchase_request_items")
              .update({ item_id: newItem.id })
              .eq("id", it.id);
          }
        }
      }

      await logEvent({
        event_type: "stocked",
        comment: "Items received into Stokstak inventory.",
      });

      setInfoMsg("Items added/updated in Stokstak inventory.");
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Error receiving into stock. See console for details.");
    } finally {
      setStocking(false);
    }
  };

  // Render states
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading request...
      </div>
    );
  }

  if (invalidId) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Invalid request ID in URL.
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600 text-sm">
        {errorMsg || "Purchase request not found."}
      </div>
    );
  }

  const totalEst = items.reduce((sum, it) => {
    const price = it.est_unit_price || 0;
    return sum + price * Number(it.quantity || 0);
  }, 0);

  const currentStatusLabel = STATUS_LABEL[request.status] || request.status;

  const canActOnItem =
    (profile &&
      request &&
      ((profile.role === "pm" && request.status === "submitted") ||
        (profile.role === "president" &&
          request.status === "pm_approved"))) ||
    profile?.role === "admin";

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
                {request.pur_number || "Purchase Request"}
              </p>
              <p className="text-xs text-slate-500">
                Status: {currentStatusLabel}
                {profile ? ` · Role: ${profile.role}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Project & status card */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500">Project</p>
              <h1 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                {project?.name || "No project"}
                {project?.code && (
                  <span className="text-xs text-slate-500">
                    ({project.code})
                  </span>
                )}
              </h1>

              <button
                type="button"
                onClick={() => setShowTechnical((v) => !v)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
              >
                <Info className="w-3 h-3" />
                {showTechnical ? "Hide technical details" : "Show technical details"}
              </button>

              {showTechnical && (
                <p className="text-[11px] text-slate-500 mt-1 break-all">
                  Internal ID: {request.id}
                </p>
              )}
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                {currentStatusLabel}
              </span>
              <p className="text-[11px] text-slate-500">
                Created: {request.created_at.slice(0, 10)}
              </p>
              {request.needed_by && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Needed by: {request.needed_by}
                </p>
              )}
            </div>
          </div>

          {request.notes && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700">
              <span className="font-semibold text-xs text-slate-500">
                Notes:
              </span>
              <p>{request.notes}</p>
            </div>
          )}

          {/* Approver actions */}
          <div className="pt-3 border-t flex flex-wrap items-center gap-3 justify-between">
            <p className="text-xs text-slate-500">
              Use the actions below to move this request through the workflow.
            </p>

            <div className="flex flex-wrap gap-2">
              {canApproveReject && (
                <>
                  <button
                    type="button"
                    disabled={savingStatus}
                    onClick={() => handleApproveOrReject("approve")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {savingStatus ? "Working..." : "Approve Request"}
                  </button>
                  <button
                    type="button"
                    disabled={savingStatus}
                    onClick={() => handleApproveOrReject("reject")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Reject Request
                  </button>
                </>
              )}

              {canMarkPurchased && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => updateRequestStatus("purchased")}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  Mark Purchased
                </button>
              )}

              {canMarkReceived && (
                <button
                  type="button"
                  disabled={savingStatus}
                  onClick={() => updateRequestStatus("received")}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-lime-600 text-white hover:bg-lime-700 disabled:opacity-60"
                >
                  Mark Received
                </button>
              )}

              {canReceiveToStock && (
                <button
                  type="button"
                  disabled={stocking}
                  onClick={handleReceiveToStock}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <Boxes className="w-3 h-3" />
                  {stocking ? "Updating Stock..." : "Receive into Stokstak"}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Line items */}
        <section className="bg-white rounded-2xl shadow-sm border p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
              Line Items
            </h2>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <DollarSign className="w-3 h-3" />
              Est. total: ${totalEst.toFixed(2)}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-slate-500">
              No line items found for this request.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">
                      Description
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      Location
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Requested
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Approved
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Est. Unit
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Est. Total
                    </th>
                    <th className="text-left px-3 py-2 font-medium">
                      Status
                    </th>
                    <th className="text-right px-3 py-2 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const unit = it.unit || "ea";
                    const unitPrice = it.est_unit_price || 0;
                    const lineTotal =
                      unitPrice * Number(it.quantity || 0);

                    const statusBadge =
                      it.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : it.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700";

                    const approvedQty =
                      it.approved_qty != null ? it.approved_qty : null;
                    const isPartial =
                      approvedQty != null &&
                      approvedQty > 0 &&
                      approvedQty < Number(it.quantity);

                    return (
                      <tr key={it.id} className="border-b last:border-0">
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-900">
                              {it.description}
                            </span>
                            {it.item_id && (
                              <span className="text-[10px] text-slate-500">
                                Linked stock item: {it.item_id}
                              </span>
                            )}
                            {it.reject_comment && (
                              <span className="text-[10px] text-red-700">
                                Rejected: {it.reject_comment}
                              </span>
                            )}
                            {it.resubmit_comment && (
                              <span className="text-[10px] text-emerald-700">
                                Re-approval note: {it.resubmit_comment}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-3 h-3" />
                            <span>{it.application_location || "-"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {Number(it.quantity)} {unit}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {approvedQty != null ? (
                            <span
                              className={
                                isPartial
                                  ? "text-amber-700 font-semibold"
                                  : "text-slate-800"
                              }
                            >
                              {approvedQty} {unit}
                              {isPartial && (
                                <span className="ml-1 text-[10px] text-amber-600">
                                  (partial)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {unitPrice ? `$${unitPrice.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2 align-top text-right font-semibold text-slate-900">
                          {lineTotal ? `$${lineTotal.toFixed(2)}` : "-"}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full ${statusBadge}`}
                          >
                            {it.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          {canActOnItem && (
                            <div className="flex flex-col gap-1 items-end">
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemDecision(it, "approve")
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              >
                                Approve / Partial
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemDecision(it, "reject")
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-red-50 text-red-700 hover:bg-red-100"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && !items.some((i) => i.est_unit_price) && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" />
              No estimated prices entered; total is 0. Approvers may still use
              this for scope/quantity only.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
