"use client";

interface TimerProps {
  seconds: number;
  maxSeconds: number;
}

export function Timer({ seconds, maxSeconds }: TimerProps) {
  const progress = (seconds / maxSeconds) * 100;
  const circumference = 2 * Math.PI * 70; // radius = 70
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative flex flex-col items-center justify-center py-4">
      {/* Timer circle */}
      <div className="relative w-40 h-40 timer-glow">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          {/* Background ring */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="var(--timer-ring-bg)"
            strokeWidth="6"
          />
          {/* Progress ring - gold */}
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="url(#timerGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--timer-ring-gold)" />
              <stop offset="50%" stopColor="var(--timer-ring-blue)" />
              <stop offset="100%" stopColor="var(--timer-ring-gold)" />
            </linearGradient>
          </defs>
        </svg>

        {/* Timer text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-[color:var(--text)] tabular-nums">
            {formatTime(seconds)}
          </span>
          <span className="text-xs font-medium text-[color:var(--accent)] tracking-wider mt-1">
            ANSWER NOW!
          </span>
        </div>
      </div>
    </div>
  );
}
