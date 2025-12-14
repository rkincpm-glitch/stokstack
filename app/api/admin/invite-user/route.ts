import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { companyId, email, role } = await req.json();

  if (!companyId || !email || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // 1) Validate caller (must be logged in) using SSR cookie client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const cookieStore = cookies();
  const supabaseAuth = createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {},
    },
  });

  const { data: userRes } = await supabaseAuth.auth.getUser();
  const caller = userRes.user;

  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Check caller is owner/admin for this company (RLS should also enforce, but we hard-check)
  const { data: membership } = await supabaseAuth
    .from("company_users")
    .select("role")
    .eq("company_id", companyId)
    .eq("user_id", caller.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3) Use service role to invite user
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabaseAdmin = createClient(url, serviceKey);

  // Invite (Supabase sends email). You can set redirectTo to your app.
  const { data: inviteData, error: inviteErr } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth`, // set NEXT_PUBLIC_SITE_URL in env for prod
    });

  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 400 });
  }

  const invitedUserId = inviteData.user?.id;
  if (!invitedUserId) {
    return NextResponse.json({ error: "Invite succeeded but no user id returned" }, { status: 500 });
  }

  // 4) Ensure membership row exists
  const { error: cuErr } = await supabaseAdmin
    .from("company_users")
    .upsert(
      { company_id: companyId, user_id: invitedUserId, role },
      { onConflict: "company_id,user_id" }
    );

  if (cuErr) {
    return NextResponse.json({ error: cuErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
