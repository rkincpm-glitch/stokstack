import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!url || !serviceRole) {
      return NextResponse.json(
        { error: "Missing SUPABASE env vars." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const company_id = String(body?.company_id || "").trim();
    const role = String(body?.role || "member").trim(); // e.g. "admin" | "member"

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    if (!company_id) {
      return NextResponse.json({ error: "company_id is required." }, { status: 400 });
    }

    // Server-only client (bypasses RLS, can invite users)
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Invite user (Supabase sends an email invite)
    const { data: inviteData, error: inviteErr } =
      await admin.auth.admin.inviteUserByEmail(email, {
        data: { company_id, role },
        // redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`, // optional
      });

    if (inviteErr) {
      return NextResponse.json({ error: inviteErr.message }, { status: 400 });
    }

    const invitedUserId = inviteData?.user?.id;
    if (!invitedUserId) {
      return NextResponse.json(
        { error: "Invite succeeded but user id missing in response." },
        { status: 500 }
      );
    }

    // Ensure membership row exists (adjust table/columns to your schema)
    // If you already create this elsewhere, you can remove this block.
    const { error: memberErr } = await admin
      .from("company_users")
      .upsert(
        {
          company_id,
          user_id: invitedUserId,
          role,
        },
        { onConflict: "company_id,user_id" }
      );

    if (memberErr) {
      return NextResponse.json({ error: memberErr.message }, { status: 400 });
    }

    return NextResponse.json(
      { ok: true, user_id: invitedUserId, email, company_id, role },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
