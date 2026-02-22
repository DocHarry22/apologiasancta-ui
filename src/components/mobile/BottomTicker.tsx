"use client";

interface TickerItem {
  type: "fastest" | "streak" | "chat";
  name: string;
  value: string;
}

interface BottomTickerProps {
  items: TickerItem[];
}

export function BottomTicker({ items }: BottomTickerProps) {
  return (
    <div className="bg-[color:var(--ticker-bg)] border-t border-[color:var(--border)] py-2 px-4">
      {/* Ticker content */}
      <div className="flex items-center gap-2 text-xs overflow-hidden">
        <span className="text-[color:var(--accent)]">▸</span>
        <span className="text-[color:var(--accent2)]">»</span>
        <div className="flex items-center gap-3 whitespace-nowrap">
          {items.map((item, index) => (
            <span key={index} className="flex items-center gap-1">
              {item.type === "fastest" && (
                <>
                  <span className="text-[color:var(--muted)]">Fastest Answer:</span>
                  <span className="text-[color:var(--text)] font-medium">{item.name}</span>
                  <span className="text-[color:var(--muted)]">- {item.value}</span>
                </>
              )}
              {item.type === "streak" && (
                <>
                  <span className="text-[color:var(--text)] font-medium">{item.name}</span>
                  <span className="text-[color:var(--accent)]">{item.value}</span>
                </>
              )}
              {item.type === "chat" && (
                <>
                  <span className="text-[color:var(--text)] font-medium">{item.name}:</span>
                  <span className="text-[color:var(--muted)]">{item.value}</span>
                </>
              )}
              {index < items.length - 1 && (
                <span className="text-[color:var(--border)] mx-1">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
