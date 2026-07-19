import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeObjective, gradeOpenEnded } from "@/lib/grading";

export async function POST(request) {
  const { questionId, answerText } = await request.json();

  if (!questionId || !answerText?.trim()) {
    return NextResponse.json(
      { error: "questionId and answerText are required" },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Insert as the signed-in user — RLS enforces user_id = auth.uid(),
  // so there's no way to submit on someone else's behalf from here.
  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({ user_id: user.id, question_id: questionId, answer_text: answerText })
    .select()
    .single();

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 });
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", questionId)
    .single();

  if (questionError || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const questionShape = {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    rubric: question.rubric,
    maxScore: question.max_score,
  };

  const result =
    question.type === "mcq"
      ? gradeObjective(questionShape, answerText, question.correct_answer)
      : await gradeOpenEnded(questionShape, answerText);

  // Grades are server-authored — written with the admin client since
  // `grades` intentionally has no client-side insert policy.
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

  return NextResponse.json({ submission, grade });
}
