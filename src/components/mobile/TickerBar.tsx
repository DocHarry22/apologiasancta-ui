"use client";

interface TickerItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface TickerBarProps {
  items: TickerItem[];
}

export function TickerBar({ items }: TickerBarProps) {
  return (
    <div className="bg-(--ticker-bg) border-t border-(--border) py-1.5 px-3">
      <div className="flex items-center gap-1.5 text-[10px] overflow-x-auto scrollbar-hide">
        <span className="text-(--accent) shrink-0">▸</span>
        <div className="flex items-center gap-3 whitespace-nowrap">
          {items.map((item, index) => (
            <span key={index} className="flex items-center gap-1">
              <span className="text-(--muted)">{item.label}:</span>
              <span className={item.highlight ? "text-(--accent) font-semibold" : "text-(--text) font-medium"}>
                {item.value}
              </span>
              {index < items.length - 1 && (
                <span className="text-(--border) ml-2">•</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
