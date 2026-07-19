import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeObjective, gradeOpenEnded } from "@/lib/grading";

// Re-grades an existing submission. Useful after editing a rubric, or
// to retry a submission that was left "needs manual review" because
// GEMINI_API_KEY wasn't configured yet at submit time.
export async function POST(request) {
  const { submissionId } = await request.json();

  if (!submissionId) {
    return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // RLS ensures this only returns a row if it belongs to the caller.
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("*, questions(*)")
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const question = submission.questions;
  const questionShape = {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    rubric: question.rubric,
    maxScore: question.max_score,
  };

  const result =
    question.type === "mcq"
      ? gradeObjective(questionShape, submission.answer_text, question.correct_answer)
      : await gradeOpenEnded(questionShape, submission.answer_text);

  const admin = createAdminClient();
  const { data: grade, error: gradeError } = await admin
    .from("grades")
    .insert({
      submission_id: submission.id,
      score: result.score,
      max_score: result.maxScore,
      feedback: result.feedback,
      graded_by: result.gradedBy,
    })
    .select()
    .single();

  if (gradeError) {
    return NextResponse.json({ error: gradeError.message }, { status: 500 });
  }

  return NextResponse.json({ grade });
}
