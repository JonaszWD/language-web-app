import type { Rating } from "@/types";

interface RatingButtonsProps {
  onRate: (rating: Rating) => void;
  disabled?: boolean;
}

const BUTTONS: { label: string; rating: Rating; color: string }[] = [
  { label: "Again", rating: 1, color: "bg-red-500 hover:bg-red-600 text-white" },
  { label: "Hard",  rating: 2, color: "bg-rose-300 hover:bg-rose-400 text-gray-900" },
  { label: "Good",  rating: 3, color: "bg-brand-pink hover:bg-brand-pink-hover text-gray-900" },
  { label: "Easy",  rating: 4, color: "bg-brand-aqua hover:bg-brand-aqua-hover text-gray-900" },
];

export default function RatingButtons({ onRate, disabled }: RatingButtonsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-sm mx-auto">
      {BUTTONS.map(({ label, rating, color }) => (
        <button
          key={rating}
          onClick={() => onRate(rating)}
          disabled={disabled}
          className={`${color} disabled:opacity-40 rounded-xl py-3 font-semibold text-sm transition-colors`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
