interface Props {
  score: number | null;
  size?: "sm" | "md";
}

export const DealScoreBadge = ({ score, size = "md" }: Props) => {
  if (score === null || score === undefined) return null;

  const color =
    score >= 70
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border-emerald-500/20"
      : score >= 40
      ? "text-amber-600 dark:text-amber-400 bg-amber-500/8 border-amber-500/20"
      : "text-red-600 dark:text-red-400 bg-red-500/8 border-red-500/20";

  return (
    <span className={`inline-flex items-center rounded-lg border font-mono font-bold ${
      size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
    } ${color}`}>
      {score}
    </span>
  );
};
