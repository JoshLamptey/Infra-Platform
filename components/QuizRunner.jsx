"use client";

import { useState } from "react";

function QuestionCard({ question, initialSubmission, attemptCount }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState(initialSubmission ? "graded" : "idle");
  const [result, setResult] = useState(
    initialSubmission
      ? { grade: initialSubmission.grades?.[0], submission: initialSubmission }
      : null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [localAttemptCount, setLocalAttemptCount] = useState(attemptCount);

  const showForm = status === "idle" || status === "submitting" || status === "error" || isRetrying;

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
    setIsRetrying(false);
    setAnswer("");
    setLocalAttemptCount((n) => n + 1);
  }

  return (
    <div className="rounded-md border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-sm leading-relaxed">{question.prompt}</p>
        {localAttemptCount > 0 && (
          <span className="shrink-0 text-xs font-mono text-textMuted">
            {showForm ? `attempt ${localAttemptCount + 1}` : `attempt ${localAttemptCount}`}
          </span>
        )}
      </div>

      {!showForm && result ? (
        <div className="space-y-3">
          <div className="rounded-md bg-surfaceRaised border border-border p-3">
            <p className="text-xs font-mono text-textMuted mb-1">Your answer</p>
            <p className="text-sm">{result.submission?.answer_text}</p>
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
          <button
            type="button"
            onClick={() => setIsRetrying(true)}
            className="text-xs font-mono text-accent hover:text-accentStrong"
          >
            ↻ Try again
          </button>
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
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={status === "submitting"}
              className="rounded-md bg-accent text-bg text-sm font-medium px-4 py-2 disabled:opacity-60"
            >
              {status === "submitting"
                ? "Grading…"
                : localAttemptCount > 0
                ? "Submit correction"
                : "Submit answer"}
            </button>
            {isRetrying && (
              <button
                type="button"
                onClick={() => {
                  setIsRetrying(false);
                  setAnswer("");
                  setStatus("graded");
                }}
                className="text-xs font-mono text-textMuted hover:text-text"
              >
                cancel
              </button>
            )}
          </div>
          {status === "error" && <p className="text-sm text-danger">{errorMessage}</p>}
        </form>
      )}
    </div>
  );
}

export default function QuizRunner({ quiz, existingSubmissionsByQuestion, attemptCountByQuestion }) {
  // Changing this key forces every QuestionCard to remount from scratch,
  // discarding local state (including whatever was in result/status) —
  // the simplest way to reset the whole quiz to a blank slate. Previous
  // attempts stay in the database; this only affects what's rendered.
  const [retakeKey, setRetakeKey] = useState(0);

  function handleRetakeQuiz() {
    const confirmed = confirm(
      "Retake the entire quiz? Your previous answers stay on record — you'll just answer every question fresh."
    );
    if (confirmed) setRetakeKey((key) => key + 1);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-textMuted">
          {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
        </p>
        <button
          type="button"
          onClick={handleRetakeQuiz}
          className="text-xs font-mono text-textMuted hover:text-accent"
        >
          ↻ Retake entire quiz
        </button>
      </div>

      {quiz.questions.map((question, index) => (
        <div key={`${question.id}-${retakeKey}`}>
          <p className="text-xs font-mono text-textMuted mb-2">
            Question {index + 1} of {quiz.questions.length}
          </p>
          <QuestionCard
            question={question}
            initialSubmission={retakeKey === 0 ? existingSubmissionsByQuestion[question.id] : null}
            attemptCount={attemptCountByQuestion[question.id] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}