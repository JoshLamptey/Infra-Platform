import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allTestIds } from "@/lib/qaTests";

// Deliberately public — no auth check. A non-technical tester filling
// this out shouldn't need an account. Basic shape validation only, to
// keep out garbage rather than to authenticate anyone.
export async function POST(request) {
  const body = await request.json();
  const { testerName, device, testDate, results } = body ?? {};

  if (!results || typeof results !== "object") {
    return NextResponse.json({ error: "results is required" }, { status: 400 });
  }

  const validIds = new Set(allTestIds());
  const cleanedResults = {};
  for (const [id, entry] of Object.entries(results)) {
    if (!validIds.has(id)) continue; // ignore anything that isn't a real test id
    if (!entry || typeof entry !== "object") continue;
    const result = ["pass", "fail", "na"].includes(entry.result) ? entry.result : null;
    if (!result) continue;
    cleanedResults[id] = {
      result,
      notes: typeof entry.notes === "string" ? entry.notes.slice(0, 2000) : "",
    };
  }

  if (Object.keys(cleanedResults).length === 0) {
    return NextResponse.json({ error: "No valid test results in submission" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("qa_submissions").insert({
    tester_name: typeof testerName === "string" ? testerName.slice(0, 200) : null,
    device: typeof device === "string" ? device.slice(0, 200) : null,
    test_date: testDate || null,
    results: cleanedResults,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}