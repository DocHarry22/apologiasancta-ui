"use client";

import type { AnswerResultEvent, QuizPhase, Choice } from "@/types/quiz";

interface AnswerListProps {
  options: Choice[];
  selectedId?: string;
  correctId?: string;
  phase?: QuizPhase;
  answerResult?: AnswerResultEvent | null;
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
  phase = "OPEN", 
  onSelect 
}: AnswerListProps) {
  const isLocked = phase === "LOCKED";
  const isReveal = phase === "REVEAL";

  return (
    <div className="flex flex-col gap-3 px-4 py-3 lg:gap-1.5 lg:px-3 lg:py-2" role="radiogroup" aria-label="Answer options">
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
        } else if (isLocked) {
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
            onClick={() => !isLocked && !isReveal && onSelect?.(option.id)}
            disabled={isLocked || isReveal}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={isLocked || isReveal}
            className={`
              group flex min-h-16 items-center gap-3 rounded-xl px-4 py-3
              border shadow-[0_8px_20px_rgba(89,68,38,0.06)] transition-all duration-150
              lg:min-h-0 lg:gap-2.5 lg:rounded-lg lg:px-3 lg:py-2.5 lg:shadow-none
              ${stateClasses}
              ${animationClass}
            `}
          >
            {/* Option letter badge or icon */}
            <span
              className={`
                flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                border text-lg font-bold shadow-sm
                lg:h-6 lg:w-6 lg:text-xs lg:shadow-none
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
            <span className={`flex-1 text-left text-base font-semibold leading-snug transition-colors duration-150 lg:text-xs lg:font-medium ${
              isReveal && !isCorrect && !isWrongSelected 
                ? "text-(--muted)" 
                : "text-(--mobile-text) lg:text-(--text)"
            }`}>
              {option.text}
            </span>

            {/* Correct indicator on reveal */}
            {isReveal && isCorrect && (
              <span className="text-[10px] font-semibold text-(--correct) uppercase tracking-wide">
                Correct
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
