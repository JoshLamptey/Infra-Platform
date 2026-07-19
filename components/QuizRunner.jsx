"use client";

import { useState } from "react";

function QuestionCard({ question, existingSubmission }) {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState(existingSubmission ? "graded" : "idle"); // idle | submitting | graded | error
  const [result, setResult] = useState(
    existingSubmission
      ? { grade: existingSubmission.grades?.[0], submission: existingSubmission }
      : null
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: question.id, answerText: answer }),
    });

    const data = await response.json();

    if (!response.ok) {
      setStatus("error");
      setErrorMessage(data.error ?? "Something went wrong.");
      return;
    }

    setResult(data);
    setStatus("graded");
  }

  const alreadyAnswered = status === "graded" && result;

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <p className="text-sm leading-relaxed mb-4">{question.prompt}</p>

      {alreadyAnswered ? (
        <div className="space-y-3">
          <div className="rounded-md bg-surfaceRaised border border-border p-3">
            <p className="text-xs font-mono text-textMuted mb-1">Your answer</p>
            <p className="text-sm">{result.submission?.answer_text ?? answer}</p>
          </div>
          <div
            className={`rounded-md border p-3 ${
              result.grade?.graded_by === "manual"
                ? "border-pending/50 bg-pending/10"
                : "border-success/50 bg-success/10"
            }`}
          >
            <p className="text-xs font-mono mb-1">
              {result.grade?.graded_by === "manual"
                ? "Needs manual review"
                : `Score: ${result.grade?.score} / ${result.grade?.max_score}`}
            </p>
            <p className="text-sm text-textMuted">{result.grade?.feedback}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            required
            rows={5}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your answer…"
            className="w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent outline-none resize-y"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="rounded-md bg-accent text-bg text-sm font-medium px-4 py-2 disabled:opacity-60"
          >
            {status === "submitting" ? "Grading…" : "Submit answer"}
          </button>
          {status === "error" && <p className="text-sm text-danger">{errorMessage}</p>}
        </form>
      )}
    </div>
  );
}

export default function QuizRunner({ quiz, existingSubmissionsByQuestion }) {
  return (
    <div className="space-y-5">
      {quiz.questions.map((question, index) => (
        <div key={question.id}>
          <p className="text-xs font-mono text-textMuted mb-2">
            Question {index + 1} of {quiz.questions.length}
          </p>
          <QuestionCard
            question={question}
            existingSubmission={existingSubmissionsByQuestion[question.id]}
          />
        </div>
      ))}
    </div>
  );
}
