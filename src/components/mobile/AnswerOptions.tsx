"use client";

interface Option {
  id: string;
  label: string;
  text: string;
}

interface AnswerOptionsProps {
  options: Option[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function AnswerOptions({ options, selectedId, onSelect }: AnswerOptionsProps) {
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {options.map((option) => {
        const isSelected =
          selectedId?.toLowerCase() === option.id?.toLowerCase();

        return (
          <button
            key={option.id}
            onClick={() => onSelect?.(option.id)}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg
              bg-[color:var(--option-bg)] border border-[color:var(--option-border)]
              hover:bg-[color:var(--option-hover)] transition-all duration-200
              ${isSelected ? "ring-2 ring-[color:var(--accent)] bg-[color:var(--option-hover)]" : ""}
            `}
          >
            {/* Option letter circle */}
            <span
              className={`
                flex items-center justify-center w-8 h-8 rounded-full
                border-2 text-sm font-bold
                ${isSelected
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-white"
                  : "border-[color:var(--accent)] text-[color:var(--accent)]"
                }
              `}
            >
              {option.label}
            </span>

            {/* Option text */}
            <span className="text-[color:var(--text)] text-sm font-medium text-left flex-1">
              {option.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
