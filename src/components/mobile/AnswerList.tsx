"use client";

import type { QuizPhase, Choice } from "@/types/quiz";

interface AnswerListProps {
  options: Choice[];
  selectedId?: string;
  correctId?: string;
  phase?: QuizPhase;
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
  phase = "OPEN", 
  onSelect 
}: AnswerListProps) {
  const isLocked = phase === "LOCKED";
  const isReveal = phase === "REVEAL";

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2" role="radiogroup" aria-label="Answer options">
      {options.map((option) => {
        const isSelected =
          selectedId?.toLowerCase() === option.id?.toLowerCase();
        const isCorrect =
          correctId?.toLowerCase() === option.id?.toLowerCase();
        const isWrongSelected = isReveal && isSelected && !isCorrect;
        
        // Determine styling based on state
        let stateClasses = "";
        let badgeClasses = "";
        let animationClass = "";
        
        if (isReveal) {
          if (isCorrect) {
            stateClasses = "bg-(--correct-bg) border-(--correct) ring-1 ring-(--correct)";
            badgeClasses = "border-(--correct) bg-(--correct) text-white";
            animationClass = "answer-correct";
          } else if (isWrongSelected) {
            stateClasses = "bg-(--wrong-bg) border-(--wrong) ring-1 ring-(--wrong)";
            badgeClasses = "border-(--wrong) bg-(--wrong) text-white";
            animationClass = "answer-wrong";
          } else {
            stateClasses = "opacity-50 bg-(--option-bg) border-(--option-border)";
            badgeClasses = "border-(--muted) text-(--muted)";
          }
        } else if (isLocked) {
          stateClasses = `cursor-not-allowed opacity-70 bg-(--option-bg) border-(--option-border) ${
            isSelected ? "ring-1 ring-(--accent)" : ""
          }`;
          badgeClasses = isSelected
            ? "border-(--accent) bg-(--accent) text-white"
            : "border-(--muted) text-(--muted)";
        } else {
          // Open state
          stateClasses = `cursor-pointer bg-(--option-bg) border-(--option-border) hover:bg-(--option-hover) active:scale-[0.98] ${
            isSelected ? "ring-1 ring-(--accent) bg-(--option-hover)" : ""
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
              group flex items-center gap-2.5 px-3 py-2.5 rounded-lg
              border transition-all duration-150
              ${stateClasses}
              ${animationClass}
            `}
          >
            {/* Option letter badge or icon */}
            <span
              className={`
                flex items-center justify-center w-6 h-6 rounded-full
                border text-xs font-bold shrink-0
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
            <span className={`text-xs font-medium text-left flex-1 transition-colors duration-150 ${
              isReveal && !isCorrect && !isWrongSelected 
                ? "text-(--muted)" 
                : "text-(--text)"
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
