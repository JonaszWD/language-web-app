interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-brand-pink-soft border border-brand-pink-border rounded-xl px-4 py-3">
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-brand-pink-text"
        role="img"
        aria-label="fire"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2c1 3-1 5-2.5 6.5C8 10 7 11.5 7 14a5 5 0 0 0 10 0c0-2.2-1-4-2.5-5.5.3 1.5-.2 2.5-1 3 .3-2.3-.8-4.5-1.5-5.5-.5 1.2-1.4 2-2.3 2.7C10.4 6 11.5 4 12 2Z" />
      </svg>
      <div>
        <div className="text-xl font-bold text-brand-pink-text">{streak}</div>
        <div className="text-xs text-gray-500">day streak</div>
      </div>
    </div>
  );
}
