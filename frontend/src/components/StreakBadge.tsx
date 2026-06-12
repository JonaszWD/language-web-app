interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-brand-pink-soft border border-brand-pink-border rounded-xl px-4 py-3">
      <span className="text-2xl" role="img" aria-label="fire">
        🔥
      </span>
      <div>
        <div className="text-xl font-bold text-brand-pink-text">{streak}</div>
        <div className="text-xs text-gray-500">day streak</div>
      </div>
    </div>
  );
}
