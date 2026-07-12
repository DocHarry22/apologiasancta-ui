"use client";

import type { AnswerResultEvent, QuizPhase, Choice } from "@/types/quiz";
import type { AnswerSubmissionState } from "@/lib/mobileUx";
import { isAnswerInteractionDisabled } from "@/lib/mobileUx";

interface AnswerListProps {
  options: Choice[];
  selectedId?: string;
  correctId?: string;
  phase?: QuizPhase;
  answerResult?: AnswerResultEvent | null;
  submissionState?: AnswerSubmissionState;
  onSelect?: (id: string) => void;
}

// Check icon for correct answer
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// X icon for wrong answer
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function AnswerList({ 
  options, 
  selectedId, 
  correctId,
  answerResult,
  submissionState = "idle",
  phase = "OPEN", 
  onSelect 
}: AnswerListProps) {
  const isLocked = phase === "LOCKED";
  const isReveal = phase === "REVEAL";
  const disableInteraction = isAnswerInteractionDisabled(phase, selectedId, submissionState);
  const statusText =
    submissionState === "submitting"
      ? "Submitting..."
      : submissionState === "submitted"
        ? "Submitted"
        : submissionState === "error"
          ? "Tap again"
          : selectedId && phase === "OPEN"
            ? "Selected"
            : "";

  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:gap-2.5 lg:px-3 lg:py-3" role="radiogroup" aria-label="Answer options">
      {phase === "LOCKED" ? (
        <div className="rounded-full border border-(--mobile-border) bg-(--mobile-elevated) px-3 py-2 text-center text-xs font-semibold text-(--mobile-muted)">
          Answers locked
        </div>
      ) : null}
      {options.map((option) => {
        const isSelected =
          selectedId?.toLowerCase() === option.id?.toLowerCase();
        const resultChoiceId = answerResult?.choiceId?.toLowerCase();
        const effectiveCorrectId = correctId ?? answerResult?.correctId;
        const isResultChoice = resultChoiceId === option.id?.toLowerCase();
        const isCorrect =
          effectiveCorrectId?.toLowerCase() === option.id?.toLowerCase();
        const isWrongSelected = (isReveal || Boolean(answerResult)) && (isSelected || isResultChoice) && !isCorrect;
        
        // Determine styling based on state
        let stateClasses = "";
        let badgeClasses = "";
        let animationClass = "";
        
        if (isReveal) {
          if (isCorrect) {
            stateClasses = "bg-(--correct-bg) border-(--correct) ring-1 ring-(--correct)";
            badgeClasses = "border-(--correct) bg-(--correct) text-white";
            animationClass = answerResult?.isCorrect && isResultChoice ? "answer-correct-player" : "answer-correct";
          } else if (isWrongSelected) {
            stateClasses = "bg-(--wrong-bg) border-(--wrong) ring-1 ring-(--wrong)";
            badgeClasses = "border-(--wrong) bg-(--wrong) text-white";
            animationClass = "answer-wrong";
          } else {
            stateClasses = "bg-(--mobile-elevated) border-(--mobile-border) opacity-55 lg:bg-(--option-bg) lg:border-(--option-border)";
            badgeClasses = "border-(--muted) text-(--muted)";
          }
        } else if (isLocked || (phase === "OPEN" && disableInteraction)) {
          stateClasses = `cursor-not-allowed border-(--mobile-border) bg-(--mobile-elevated) opacity-70 lg:bg-(--option-bg) lg:border-(--option-border) ${
            isSelected ? "ring-1 ring-(--accent)" : ""
          }`;
          badgeClasses = isSelected
            ? "border-(--accent) bg-(--accent) text-white"
            : "border-(--muted) text-(--muted)";
        } else {
          // Open state
          stateClasses = `cursor-pointer border-(--mobile-border) bg-(--mobile-elevated) hover:bg-(--mobile-elevated-hover) active:scale-[0.98] lg:bg-(--option-bg) lg:border-(--option-border) lg:hover:bg-(--option-hover) ${
            isSelected ? "bg-(--mobile-elevated-hover) ring-1 ring-(--accent) lg:bg-(--option-hover)" : ""
          }`;
          badgeClasses = isSelected
            ? "border-(--accent) bg-(--accent) text-white"
            : "border-(--accent) text-(--accent) group-hover:bg-(--accent) group-hover:text-white";
        }

        return (
          <button
            key={option.id}
            onClick={() => !disableInteraction && !isReveal && onSelect?.(option.id)}
            disabled={disableInteraction || isReveal}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={disableInteraction || isReveal}
            aria-label={`${option.label}. ${option.text}${isSelected && statusText ? `. ${statusText}` : ""}`}
            className={`
              group flex min-h-16 min-w-0 items-center gap-3 rounded-xl px-4 py-3 text-left
              border shadow-[0_8px_20px_rgba(89,68,38,0.06)] transition-all duration-150
              lg:min-h-14 lg:gap-3 lg:rounded-xl lg:px-4 lg:py-3 lg:shadow-sm
              ${stateClasses}
              ${animationClass}
            `}
          >
            {/* Option letter badge or icon */}
            <span
              className={`
                flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                border text-lg font-bold shadow-sm
                lg:h-8 lg:w-8 lg:text-sm lg:shadow-none
                transition-colors duration-150
                ${badgeClasses}
              `}
            >
              {isReveal && isCorrect ? (
                <CheckIcon />
              ) : isReveal && isWrongSelected ? (
                <XIcon />
              ) : (
                option.label
              )}
            </span>

            {/* Option text */}
            <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <span className={`min-w-0 break-words text-left text-base font-semibold leading-snug transition-colors duration-150 lg:text-base lg:font-medium ${
                isReveal && !isCorrect && !isWrongSelected
                  ? "text-(--muted)"
                  : "text-(--mobile-text) lg:text-(--text)"
              }`}>
                {option.text}
              </span>
              {!isReveal && isSelected && statusText ? (
                <span className="rounded-full border border-(--accent) bg-(--accent)/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--accent)">
                  {statusText}
                </span>
              ) : null}
            </span>

            {/* Correct indicator on reveal */}
            {isReveal && isCorrect && (
              <span className="shrink-0 text-[10px] font-semibold text-(--correct) uppercase tracking-wide lg:text-xs">
                Correct
              </span>
            )}
          </button>
        );
      })}
      {options.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--mobile-border) bg-(--mobile-elevated) px-4 py-6 text-center text-sm text-(--mobile-muted)">
          Waiting for host
        </div>
      ) : null}
    </div>
  );
}
