"use client";

import { Star } from "lucide-react";

type LeadFavoriteStarProps = {
  favorite: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  "aria-label"?: string;
  size?: number;
};

export function LeadFavoriteStar({
  favorite,
  onClick,
  "aria-label": ariaLabel,
  size = 20,
}: LeadFavoriteStarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center justify-center rounded-md p-1 transition-transform hover:scale-110 " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 " +
        (favorite
          ? "text-amber-400 hover:text-amber-500"
          : "text-gray-400 hover:text-amber-300/90")
      }
      aria-label={ariaLabel ?? (favorite ? "Remove from favorites" : "Add to favorites")}
      aria-pressed={favorite}
    >
      <Star
        size={size}
        className={
          favorite
            ? "fill-amber-400 text-amber-400"
            : "fill-transparent stroke-[1.5] text-gray-400"
        }
      />
    </button>
  );
}
