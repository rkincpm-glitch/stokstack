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
};

type RequestWithProject = PurchaseRequest & {
  project_name: string | null;
  project_code: string | null;
};

type Profile = {
  id: string;
  role: string;
  display_name: string | null;
  can_purchase: boolean;
  can_receive: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  pm_approved: "PM Approved",
  president_approved: "President Approved",
  purchased: "Purchased",
  delivered: "Delivered",
  received: "Received",
  rejected: "Rejected",
};

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  pm_approved: "bg-indigo-100 text-indigo-700",
  president_approved: "bg-purple-100 text-purple-700",
  purchased: "bg-emerald-100 text-emerald-700",
  delivered: "bg-teal-100 text-teal-700",
  received: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [myRequests, setMyRequests] = useState<RequestWithProject[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<
    RequestWithProject[]
  >([]);
  const [involvedRequests, setInvolvedRequests] = useState<
    RequestWithProject[]
  >([]);

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

    // 1) Profile / role
    let role = "requester";
    let displayName: string | null = null;
    let can_purchase = false;
    let can_receive = false;

    const { data: profData, error: profError } = await supabase
      .from("profiles")
      .select("id, role, display_name, can_purchase, can_receive")
      .eq("id", userId)
      .maybeSingle();

    if (!profError && profData) {
      role = profData.role || "requester";
      displayName = profData.display_name || null;
      can_purchase = !!profData.can_purchase;
      can_receive = !!profData.can_receive;
    } else if (!profData) {
      // auto-create basic profile if missing
      await supabase.from("profiles").insert({
        id: userId,
        role: "requester",
        display_name: userData.user.email,
        is_active: true,
        can_purchase: false,
        can_receive: false,
      });
    }

    const myProfile: Profile = {
      id: userId,
      role,
      display_name: displayName,
      can_purchase,
      can_receive,
    };
    setProfile(myProfile);

    // 2) Load projects (map for join)
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
      .select("*")
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

    // 4) Pending approvals for my role
    let statusFilter: string[] = [];

    if (role === "pm") {
      statusFilter = ["submitted"];
    } else if (role === "president") {
      statusFilter = ["pm_approved"];
    } else if (can_purchase || role === "purchaser") {
      statusFilter = ["president_approved"];
    } else if (can_receive) {
      statusFilter = ["purchased", "delivered"];
    } else if (role === "admin") {
      statusFilter = [
        "submitted",
        "pm_approved",
        "president_approved",
        "purchased",
        "delivered",
      ];
    }

    if (statusFilter.length > 0) {
      const { data: pendingData, error: pendingError } = await supabase
        .from("purchase_requests")
        .select("*")
        .in("status", statusFilter)
        .order("created_at", { ascending: false });

      if (pendingError) {
        console.error(pendingError);
        setErrorMsg(`Error loading approvals: ${pendingError.message}`);
        setLoading(false);
        return;
      }

      const pendWithProj: RequestWithProject[] = (pendingData || []).map(
        (r) => {
          const proj = r.project_id ? projectMap.get(r.project_id) : undefined;
          return {
            ...(r as PurchaseRequest),
            project_name: proj?.name || null,
            project_code: proj?.code || null,
          };
        }
      );

      setPendingApprovals(pendWithProj);
    } else {
      setPendingApprovals([]);
    }

    // 5) Involved history (any request where I performed an event)
    const { data: evData, error: evError } = await supabase
      .from("purchase_request_events")
      .select("request_id")
      .eq("performed_by", userId);

    if (!evError && evData && evData.length > 0) {
      const ids = Array.from(
        new Set(evData.map((e: any) => e.request_id))
      ) as string[];

      if (ids.length > 0) {
        const { data: involvedData, error: invError } = await supabase
          .from("purchase_requests")
          .select("*")
          .in("id", ids)
          .order("created_at", { ascending: false });

        if (!invError && involvedData) {
          const involved: RequestWithProject[] = involvedData.map((r) => {
            const proj = r.project_id
              ? projectMap.get(r.project_id)
              : undefined;
            return {
              ...(r as PurchaseRequest),
              project_name: proj?.name || null,
              project_code: proj?.code || null,
            };
          });

          // Avoid duplicating myRequests – but it's okay if some overlap.
          setInvolvedRequests(involved);
        }
      }
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
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
                      >
                        {STATUS_LABEL[r.status] || r.status}
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
            Back to dashboard
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
                {profile ? `Role: ${profile.role}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            {myRequests.length} of your own requests
          </p>
          <Link
            href="/purchase-requests/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border shadow-sm p-6 text-center text-slate-500">
            Loading...
          </div>
        ) : (
          <>
            {/* My requests */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-800">
                My Requests
              </h2>
              {renderTable(myRequests)}
            </section>

            {/* Pending approvals */}
            {profile && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  Needs My Action
                </h2>
                {pendingApprovals.length === 0 ? (
                  <div className="bg-white rounded-xl border shadow-sm p-4 text-sm text-slate-500">
                    No requests waiting for your approval/processing.
                  </div>
                ) : (
                  renderTable(pendingApprovals)
                )}
              </section>
            )}

            {/* Involved history */}
            {profile && involvedRequests.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  History: Requests I Touched
                </h2>
                <p className="text-[11px] text-slate-500">
                  Requests where you were involved (approved, rejected, purchased,
                  delivered, received, etc.). May overlap with sections above.
                </p>
                {renderTable(involvedRequests)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
