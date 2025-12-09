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
  AlertCircle,
  Clock3,
  History,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  code: string | null;
};

type PurchaseRequest = {
  id: string;
  project_id: string | null;
  requested_by: string | null;
  status: string;
  needed_by: string | null;
  created_at: string;
  notes: string | null;
  pm_approved_by: string | null;
  president_approved_by: string | null;
  purchased_by: string | null;
  received_by: string | null;
  // optional human-readable number like PUR-00101 if you added it
  pur_number?: string | null;
};

type RequestWithProject = PurchaseRequest & {
  project_name: string | null;
  project_code: string | null;
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

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  pm_approved: "bg-indigo-100 text-indigo-700",
  president_approved: "bg-purple-100 text-purple-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRequests, setMyRequests] = useState<RequestWithProject[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<RequestWithProject[]>([]);
  const [historyRequests, setHistoryRequests] = useState<RequestWithProject[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const email = userData.user.email || "";

    // 1) Profile / role
    let role = "requester";
    let displayName: string | null = null;

    const { data: profData, error: profError } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profError && profData) {
      role = profData.role || "requester";
      displayName = profData.display_name || null;
    } else if (!profData) {
      // auto-create basic profile if missing
      await supabase.from("profiles").insert({
        id: userId,
        role: "requester",
        display_name: email,
      });
    }

    const myProfile: Profile = { id: userId, role, display_name: displayName };
    setProfile(myProfile);

    // 2) Load projects (simple org-wide list)
    const { data: projData, error: projError } = await supabase
      .from("projects")
      .select("id, name, code");

    if (projError) {
      console.error(projError);
      setErrorMsg("Error loading projects.");
      setLoading(false);
      return;
    }

    const projectMap = new Map<string, Project>();
    (projData || []).forEach((p) => {
      projectMap.set(p.id, p as Project);
    });

    // 3) My requests (I am requester)
    const { data: myReqData, error: myReqError } = await supabase
      .from("purchase_requests")
      .select(
        "id, project_id, requested_by, status, needed_by, created_at, notes, pm_approved_by, president_approved_by, purchased_by, received_by, pur_number"
      )
      .eq("requested_by", userId)
      .order("created_at", { ascending: false });

    if (myReqError) {
      console.error(myReqError);
      setErrorMsg(`Error loading your requests: ${myReqError.message}`);
      setLoading(false);
      return;
    }

    const myWithProj: RequestWithProject[] = (myReqData || []).map((r) => {
      const proj = r.project_id ? projectMap.get(r.project_id) : undefined;
      return {
        ...(r as PurchaseRequest),
        project_name: proj?.name || null,
        project_code: proj?.code || null,
      };
    });

    setMyRequests(myWithProj);

    // 4) Pending approvals for my role (Needs my attention)
    let statusFilter: string[] = [];

    if (role === "pm") {
      statusFilter = ["submitted"];
    } else if (role === "president") {
      statusFilter = ["pm_approved"];
    } else if (role === "purchaser") {
      statusFilter = ["president_approved"];
    } else if (role === "admin") {
      statusFilter = ["submitted", "pm_approved", "president_approved"];
    } else {
      statusFilter = [];
    }

    if (statusFilter.length > 0) {
      const { data: pendingData, error: pendingError } = await supabase
        .from("purchase_requests")
        .select(
          "id, project_id, requested_by, status, needed_by, created_at, notes, pm_approved_by, president_approved_by, purchased_by, received_by, pur_number"
        )
        .in("status", statusFilter)
        .order("created_at", { ascending: true }); // oldest first so you clear backlog

      if (pendingError) {
        console.error(pendingError);
        setErrorMsg(`Error loading approvals: ${pendingError.message}`);
        setLoading(false);
        return;
      }

      const pendWithProj: RequestWithProject[] = (pendingData || []).map((r) => {
        const proj = r.project_id ? projectMap.get(r.project_id) : undefined;
        return {
          ...(r as PurchaseRequest),
          project_name: proj?.name || null,
          project_code: proj?.code || null,
        };
      });

      setPendingApprovals(pendWithProj);
    } else {
      setPendingApprovals([]);
    }

    // 5) History: all requests where this user had any role in the workflow
    const { data: historyData, error: historyError } = await supabase
      .from("purchase_requests")
      .select(
        "id, project_id, requested_by, status, needed_by, created_at, notes, pm_approved_by, president_approved_by, purchased_by, received_by, pur_number"
      )
      .or(
        `requested_by.eq.${userId},pm_approved_by.eq.${userId},president_approved_by.eq.${userId},purchased_by.eq.${userId},received_by.eq.${userId}`
      )
      .order("created_at", { ascending: false });

    if (historyError) {
      console.error(historyError);
      // non-fatal: just leave history empty
      setHistoryRequests([]);
    } else {
      const histWithProj: RequestWithProject[] = (historyData || []).map((r) => {
        const proj = r.project_id ? projectMap.get(r.project_id) : undefined;
        return {
          ...(r as PurchaseRequest),
          project_name: proj?.name || null,
          project_code: proj?.code || null,
        };
      });
      setHistoryRequests(histWithProj);
    }

    setLoading(false);
  };

  const renderTable = (list: RequestWithProject[]) => {
    if (list.length === 0) {
      return (
        <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-slate-500">
          Nothing here.
        </div>
      );
    }

    return (
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-2">Project</th>
                <th className="px-4 py-2">Request</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Needed By</th>
                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const statusClass =
                  STATUS_COLOR[r.status] || "bg-slate-100 text-slate-700";
                const label = STATUS_LABEL[r.status] || r.status;
                const shortId = r.id.slice(0, 8);
                const numberLabel = r.pur_number || `PUR-${shortId}`;

                return (
                  <tr
                    key={r.id}
                    className="border-b last:border-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {r.project_name || "No project"}
                        </span>
                        {r.project_code && (
                          <span className="text-xs text-slate-500">
                            {r.project_code}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">
                          {numberLabel}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          ID: {shortId}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.needed_by ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {r.needed_by}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {r.created_at.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <Link
                        href={`/purchase-requests/${r.id}`}
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">
        Loading purchase requests...
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-600">
        Unable to load profile.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stokstak
          </Link>

          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Purchase Requests
              </p>
              <p className="text-xs text-slate-500">
                Role: {profile.role}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-600">
            {myRequests.length} request(s) created by you
          </p>
          <Link
            href="/purchase-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            New Purchase Request
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Needs my attention */}
        {(profile.role !== "requester" || pendingApprovals.length > 0) && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-slate-800">
              <Clock3 className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Needs My Attention
              </h2>
            </div>
            {pendingApprovals.length === 0 ? (
              <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-slate-500">
                No requests are currently waiting for your approval.
              </div>
            ) : (
              renderTable(pendingApprovals)
            )}
          </section>
        )}

        {/* My requests */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <ClipboardList className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              My Requests
            </h2>
          </div>
          {renderTable(myRequests)}
        </section>

        {/* My history */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-slate-800">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              My History
            </h2>
          </div>
          {historyRequests.length === 0 ? (
            <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-slate-500">
              You have no completed or past purchase requests yet.
            </div>
          ) : (
            renderTable(historyRequests)
          )}
        </section>
      </main>
    </div>
  );
}
