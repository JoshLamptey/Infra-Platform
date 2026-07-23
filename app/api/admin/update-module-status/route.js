import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/isAdmin";

const VALID_STATUSES = ["not_started", "in_progress", "completed"];

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Never trust a client-side "isAdmin" flag for a mutating route — the
  // page may only show this form to admins, but the route itself has
  // to independently re-verify, since anyone can call an API directly.
  if (!isAdminEmail(user?.email)) {
    return NextResponse.json({ error: "Sorry, you are not allowed here !" }, { status: 403 });
  }

  const { moduleId, status } = await request.json();

  if (!moduleId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "moduleId and a valid status are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("sessions")
    .update({ status })
    .eq("module_id", moduleId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}