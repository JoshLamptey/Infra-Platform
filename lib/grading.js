import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * MCQ / exact-match grading — no API call, no ambiguity, no cost.
 * @param {import('./content').QuizQuestion} question
 * @param {string} answerText
 * @param {string} correctAnswer
 */
export function gradeObjective(question, answerText, correctAnswer) {
  const correct = answerText.trim() === correctAnswer.trim();
  return {
    score: correct ? question.maxScore : 0,
    maxScore: question.maxScore,
    feedback: correct ? "Correct." : `Incorrect. Expected: ${correctAnswer}`,
    gradedBy: "auto",
  };
}

/**
 * Open-ended grading via Gemini (free tier: gemini-2.5-flash), scored
 * against the question's rubric. Requires GEMINI_API_KEY, issued free
 * with no credit card at aistudio.google.com. Falls back to a clearly
 * labeled "needs manual review" state if the key isn't configured,
 * rather than pretending to grade.
 *
 * Note: free-tier Gemini traffic may be used by Google to improve their
 * models. Fine for infra-concept quiz answers; keep that in mind if you
 * ever grade anything more sensitive.
 *
 * @param {import('./content').QuizQuestion} question
 * @param {string} answerText
 */
export async function gradeOpenEnded(question, answerText) {
  if (!process.env.GEMINI_API_KEY) {
    return {
      score: 0,
      maxScore: question.maxScore,
      feedback: "Auto-grading is not configured (missing GEMINI_API_KEY). Needs manual review.",
      gradedBy: "manual",
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are grading a DevOps/infrastructure engineering quiz answer.

Question: ${question.prompt}

Rubric: ${question.rubric ?? "Use general engineering judgment."}

Maximum score: ${question.maxScore}

Student's answer: ${answerText}

Score the answer against the rubric. Respond with ONLY a JSON object, no other text, in this exact shape:
{"score": <integer 0-${question.maxScore}>, "feedback": "<2-3 sentences, specific and direct, addressed to the student, naming what was right and what was missing>"}`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text().trim());

  return {
    score: Math.max(0, Math.min(question.maxScore, Number(parsed.score))),
    maxScore: question.maxScore,
    feedback: String(parsed.feedback),
    gradedBy: "auto",
  };
}
