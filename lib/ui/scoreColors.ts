export type ScoreTier = "hot" | "warm" | "cold";

export type ScoreColorConfig = {
  tier: ScoreTier;
  label: "Hot" | "Warm" | "Cold";
  bgClass: string;
  textClass: string;
  borderClass: string;
  pillClass: string;
};

export function scoreTierFromAiScore(aiScore: number | null | undefined): ScoreTier {
  const score = typeof aiScore === "number" && Number.isFinite(aiScore) ? aiScore : 0;
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export function scoreColorsForTier(tier: ScoreTier): ScoreColorConfig {
  if (tier === "hot") {
    return {
      tier,
      label: "Hot",
      bgClass: "bg-red-100 dark:bg-red-900/30",
      textClass: "text-red-700 dark:text-red-400",
      borderClass: "border-red-200 dark:border-red-800/50",
      pillClass: "border border-red-200 dark:border-red-800/50 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    };
  }
  if (tier === "warm") {
    return {
      tier,
      label: "Warm",
      bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
      textClass: "text-yellow-700 dark:text-yellow-400",
      borderClass: "border-yellow-200 dark:border-yellow-800/50",
      pillClass: "border border-yellow-200 dark:border-yellow-800/50 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
    };
  }
  return {
    tier,
    label: "Cold",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    textClass: "text-blue-700 dark:text-blue-400",
    borderClass: "border-blue-200 dark:border-blue-800/50",
    pillClass: "border border-blue-200 dark:border-blue-800/50 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  };
}

export function scoreColorsFromAiScore(aiScore: number | null | undefined): ScoreColorConfig {
  return scoreColorsForTier(scoreTierFromAiScore(aiScore));
}
